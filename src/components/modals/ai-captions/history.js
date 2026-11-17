/**
 * AI Captions — history of caption jobs, kept in this browser only (IndexedDB; an in-memory list when IndexedDB is not available).
 * A job: `{ id, title, durationSec, language, styleId, position, processingMs, fileSize, createdAt, segments, video? }`.
 * `video` is the source clip (a Blob) and is only kept for clips up to MAX_KEPT_VIDEO_BYTES, so "Open" can edit and re-render it again.
 */
const DB = 'remix-ai-captions';
const STORE = 'jobs';
export const MAX_JOBS = 30;
export const MAX_KEPT_VIDEO_BYTES = 100 * 1024 * 1024;

const OPEN_TIMEOUT_MS = 1500;
const memory = new Map();

function open(idb) {
  return new Promise((resolve, reject) => {
    const req = idb.open(DB, 1);
    req.onupgradeneeded = () => { req.result.createObjectStore(STORE, { keyPath: 'id' }); };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error('blocked'));
    setTimeout(() => reject(new Error('IndexedDB did not answer')), OPEN_TIMEOUT_MS);   // private modes can leave the request pending forever
  });
}
const wrap = (req) => new Promise((resolve, reject) => { req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error); });

async function db(idb) {
  const factory = idb === undefined ? globalThis.indexedDB : idb;
  if (!factory) return null;
  try { return await open(factory); } catch { return null; }
}

export const newJobId = () => `cap-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

/** Newest first. */
export async function listJobs({ idb } = {}) {
  const d = await db(idb);
  const all = d ? await wrap(d.transaction(STORE).objectStore(STORE).getAll()).catch(() => []) : [...memory.values()];
  d?.close();
  return all.sort((a, b) => b.createdAt - a.createdAt);
}

export async function getJob(id, { idb } = {}) {
  const d = await db(idb);
  const job = d ? await wrap(d.transaction(STORE).objectStore(STORE).get(id)).catch(() => undefined) : memory.get(id);
  d?.close();
  return job;
}

/** Save (or replace) a job and trim the list to MAX_JOBS. Returns the saved job. */
export async function saveJob(job, { idb } = {}) {
  const rec = { createdAt: Date.now(), ...job, id: job.id || newJobId() };
  if (rec.video && rec.video.size > MAX_KEPT_VIDEO_BYTES) delete rec.video;
  const d = await db(idb);
  if (d) {
    try { await wrap(d.transaction(STORE, 'readwrite').objectStore(STORE).put(rec)); } catch { memory.set(rec.id, rec); }
    d.close();
  } else memory.set(rec.id, rec);
  const jobs = await listJobs({ idb });
  for (const old of jobs.slice(MAX_JOBS)) await deleteJob(old.id, { idb });
  return rec;
}

export async function deleteJob(id, { idb } = {}) {
  memory.delete(id);
  const d = await db(idb);
  if (d) { await wrap(d.transaction(STORE, 'readwrite').objectStore(STORE).delete(id)).catch(() => {}); d.close(); }
}

export async function clearJobs({ idb } = {}) {
  memory.clear();
  const d = await db(idb);
  if (d) { await wrap(d.transaction(STORE, 'readwrite').objectStore(STORE).clear()).catch(() => {}); d.close(); }
}

export const formatBytes = (n) => (!n ? '—' : n >= 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);
export const formatDuration = (sec) => { const t = Math.max(0, Math.round(sec || 0)); return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`; };
