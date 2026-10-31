/**
 * Background Full Body Recast jobs.
 *
 * A recast takes minutes, so jobs live here rather than in the editor: they
 * keep running when the editor or the Personalize modal closes, and the MuAPI
 * request id is stored so polling resumes after a page reload. When a job
 * finishes, its video is stored durably and added to the contact's
 * Presenter Videos through the shared contact store, with no UI open.
 */

import { getProfile, saveProfile } from '../contactStore.js';
import { showToast } from '../loading.js';
import { FULL_BODY_MODEL } from '../../components/personalize/modelCapabilityResolver.js';
import {
  buildRecastPayload,
  persistRecastVideo,
  pollRecast,
  submitRecast,
} from './fullBodyRecast.js';
import {
  addPersonalizationAsset,
  createPersonalizationAsset,
  getAllPersonalizationAssets,
} from './personalizationProfile.js';

const STORAGE_KEY = 'remix_recast_jobs';
const MAX_JOBS = 20;
const KEEP_FINISHED_MS = 24 * 60 * 60 * 1000;
export const RECAST_MAX_RUN_MS = 60 * 60 * 1000;
const ACTIVE_STATUSES = new Set(['submitting', 'running', 'saving']);

let jobs = null;
const listeners = new Set();
const pollers = new Map();
const runs = new Map();

export function isRecastJobActive(job) {
  return ACTIVE_STATUSES.has(job?.status);
}

function prune(list, now = Date.now()) {
  return list
    .filter((job) => job?.id && (
      isRecastJobActive(job) || now - (job.finishedAt || job.startedAt || 0) < KEEP_FINISHED_MS
    ))
    .sort((a, b) => (b.startedAt || 0) - (a.startedAt || 0))
    .slice(0, MAX_JOBS);
}

function load() {
  if (jobs) return jobs;
  let stored = [];
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    if (Array.isArray(parsed)) stored = parsed;
  } catch {
    // Storage unavailable or corrupt: start empty.
  }
  jobs = prune(stored);
  return jobs;
}

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(jobs));
  } catch {
    // Jobs still run in memory; they just won't survive a reload.
  }
}

function emit() {
  const snapshot = jobs.map((job) => ({ ...job }));
  listeners.forEach((fn) => {
    try { fn(snapshot); } catch { /* a broken listener must not stop others */ }
  });
}

function find(id) {
  return load().find((job) => job.id === id) || null;
}

function update(id, patch) {
  const job = find(id);
  if (!job) return null;
  Object.assign(job, patch);
  persist();
  emit();
  return job;
}

function notify(message, type) {
  try { showToast(message, type); } catch { /* toasts are best effort */ }
}

function errorMessage(error, fallback) {
  return error?.message || fallback;
}

async function saveResult(id) {
  const job = find(id);
  if (!job || job.status === 'cancelled' || job.savedAssetId) return;

  let profile = getProfile(job.contactId);
  if (!profile) {
    update(id, { status: 'error', error: 'The contact for this recast no longer exists.', finishedAt: Date.now() });
    return;
  }

  // Never add the same job twice (a resume in another tab, or a retry).
  const existing = getAllPersonalizationAssets(profile)
    .find((asset) => asset?.editMetadata?.jobId === job.id);
  if (existing) {
    update(id, { status: 'done', savedAssetId: existing.id, savedUrl: existing.url, finishedAt: Date.now() });
    return;
  }

  const name = job.characterName || 'Presenter';
  const stored = await persistRecastVideo(job.resultUrl, { name: `${name} Recast` });
  if (find(id)?.status === 'cancelled') return;

  const asset = createPersonalizationAsset({
    role: 'presenter_video',
    name: `${name} — Full Body Recast`,
    url: stored.url,
    originalUrl: stored.url,
    sourceType: 'AI_GENERATED',
    mimeType: 'video/mp4',
    editMetadata: {
      operation: 'full_body_recast',
      model: job.model || FULL_BODY_MODEL,
      jobId: job.id,
      sourceVideoUrl: job.sourceUrl,
      characterAssetId: job.characterAssetId,
      providerUrl: job.resultUrl,
      durable: stored.durable,
      prompt: job.prompt || '',
    },
  });
  profile = addPersonalizationAsset(getProfile(job.contactId) || profile, asset);
  saveProfile(profile);
  update(id, { status: 'done', savedAssetId: asset.id, savedUrl: stored.url, finishedAt: Date.now() });
  notify(`Recast ready for ${name} — saved to Presenter Videos`, 'success');
}

function poll(id) {
  if (pollers.has(id)) return runs.get(id);
  const controller = new AbortController();
  pollers.set(id, controller);

  const run = (async () => {
    try {
      const job = find(id);
      if (!job?.requestId) throw new Error('This recast has no request to check.');
      const resultUrl = await pollRecast(job.requestId, controller.signal);
      if (controller.signal.aborted || find(id)?.status === 'cancelled') return;
      update(id, { status: 'saving', resultUrl });
      await saveResult(id);
    } catch (error) {
      if (controller.signal.aborted || find(id)?.status === 'cancelled') return;
      update(id, {
        status: 'error',
        error: errorMessage(error, 'Could not check the recast.'),
        finishedAt: Date.now(),
      });
    } finally {
      pollers.delete(id);
    }
  })();
  runs.set(id, run);
  return run;
}

/**
 * Start a recast in the background and return the job right away.
 * `characterImageUrl` must already be fetchable (see resolveRecastCharacterUrl).
 */
export function startRecastJob({
  contactId,
  editorAssetId = '',
  characterAssetId = '',
  characterName = '',
  characterImageUrl,
  sourceUrl,
  duration,
  prompt = '',
} = {}) {
  if (!contactId) throw new Error('Select a contact before starting a recast.');
  const payload = buildRecastPayload({ sourceUrl, characterUrl: characterImageUrl, duration, prompt });

  const job = {
    id: `recast_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    contactId,
    editorAssetId,
    characterAssetId,
    characterName,
    characterImageUrl,
    sourceUrl,
    duration: payload.duration,
    prompt: payload.prompt || '',
    model: FULL_BODY_MODEL,
    requestId: '',
    status: 'submitting',
    startedAt: Date.now(),
    finishedAt: 0,
    resultUrl: '',
    savedAssetId: '',
    savedUrl: '',
    error: '',
  };
  jobs = prune([job, ...load()]);
  persist();
  emit();

  const run = (async () => {
    try {
      const requestId = await submitRecast(payload);
      if (find(job.id)?.status === 'cancelled') return;
      // Stored before polling so a reload can pick the job back up.
      update(job.id, { requestId, status: 'running' });
    } catch (error) {
      if (find(job.id)?.status === 'cancelled') return;
      update(job.id, {
        status: 'error',
        error: errorMessage(error, 'The recast could not be started.'),
        finishedAt: Date.now(),
      });
      return;
    }
    await poll(job.id);
  })();
  runs.set(job.id, run);
  return { ...job };
}

/** Resolves when the job's current run settles (mainly for tests). */
export function waitForRecastJob(id) {
  return runs.get(id) || Promise.resolve();
}

export function cancelRecastJob(id) {
  const job = find(id);
  if (!job || !isRecastJobActive(job)) return false;
  pollers.get(id)?.abort();
  pollers.delete(id);
  update(id, { status: 'cancelled', error: '', finishedAt: Date.now() });
  return true;
}

/** Check the same request again after a polling error. */
export function retryRecastJob(id) {
  const job = find(id);
  if (!job || job.status !== 'error' || !job.requestId) return false;
  if (job.resultUrl && !job.savedAssetId) {
    update(id, { status: 'saving', error: '', finishedAt: 0 });
    const run = saveResult(id).catch((error) => {
      update(id, { status: 'error', error: errorMessage(error, 'Could not save the recast.'), finishedAt: Date.now() });
    });
    runs.set(id, run);
    return true;
  }
  update(id, { status: 'running', error: '', finishedAt: 0 });
  poll(id);
  return true;
}

export function dismissRecastJob(id) {
  const job = find(id);
  if (!job || isRecastJobActive(job)) return false;
  jobs = jobs.filter((candidate) => candidate.id !== id);
  persist();
  emit();
  return true;
}

export function getRecastJobs({ contactId, characterAssetId } = {}) {
  return load()
    .filter((job) => (!contactId || job.contactId === contactId)
      && (!characterAssetId || job.characterAssetId === characterAssetId))
    .map((job) => ({ ...job }));
}

export function subscribeRecastJobs(fn) {
  load();
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Resume jobs saved by an earlier page load. Safe to call more than once. */
export function resumeRecastJobs({ now = Date.now() } = {}) {
  let resumed = 0;
  for (const job of [...load()]) {
    if (pollers.has(job.id)) continue;
    if (job.status === 'submitting') {
      update(job.id, { status: 'error', error: 'The page closed before the recast started. Try again.', finishedAt: now });
    } else if (job.status === 'running') {
      if (now - (job.startedAt || 0) > RECAST_MAX_RUN_MS) {
        update(job.id, { status: 'error', error: 'Timed out waiting for the recast.', finishedAt: now });
      } else {
        poll(job.id);
        resumed += 1;
      }
    } else if (job.status === 'saving' && job.resultUrl) {
      const run = saveResult(job.id).catch((error) => {
        update(job.id, { status: 'error', error: errorMessage(error, 'Could not save the recast.'), finishedAt: Date.now() });
      });
      runs.set(job.id, run);
      resumed += 1;
    }
  }
  return resumed;
}

export function __resetRecastJobsForTests() {
  pollers.forEach((controller) => controller.abort());
  pollers.clear();
  runs.clear();
  listeners.clear();
  jobs = null;
}
