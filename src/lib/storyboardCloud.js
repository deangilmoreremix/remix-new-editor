/**
 * Storyboard Studio: cloud copy of saved projects.
 *
 * Projects live in public.storyboard_projects
 * (supabase/migrations/20261127120000_create_storyboard_projects.sql), one row
 * per (signed-in user, project name). The studio always keeps a local copy as
 * well; this module is the optional second copy for signed-in users.
 *
 * Every function takes the Supabase client as its first argument so the studio
 * can hand it the identity-primed client and tests can hand it a fake.
 * Row-level security does the real access control (owner = the verified Clerk
 * `sub` on the JWT); nothing here is a security boundary.
 */

export const CLOUD_TABLE = 'storyboard_projects';
export const MAX_CLOUD_NAME = 120;
/** The table rejects a project at 1.5MB; stay clearly under that. */
export const MAX_CLOUD_BYTES = 1_300_000;

export class CloudSyncError extends Error {
  constructor(code, message, extra = {}) {
    super(message);
    this.name = 'CloudSyncError';
    this.code = code;
    Object.assign(this, extra);
  }
}

const IMAGE_FIELDS = ['imageUrl'];
const isWebUrl = (v) => typeof v === 'string' && /^https?:\/\//i.test(v);
const isInline = (v) => typeof v === 'string' && /^data:/i.test(v);

/** Keys that only mean something at runtime. */
const RUNTIME_KEYS = new Set(['status']);

/**
 * The JSON that goes to the cloud: the editable storyboard, minus anything that
 * can't (or shouldn't) travel. Inline (data:) images, such as OpenAI results,
 * are far too large for a row and are dropped; the frame keeps its text and
 * settings and can simply be regenerated.
 * @returns {{ project: object, frameCount: number, totalSeconds: number, strippedImages: number }}
 */
export function prepareCloudProject(state) {
  let strippedImages = 0;
  const frames = (state?.frames || []).map((frame) => {
    const out = {};
    Object.entries(frame || {}).forEach(([key, value]) => {
      if (RUNTIME_KEYS.has(key) || value === undefined || typeof value === 'function') return;
      if (IMAGE_FIELDS.includes(key)) {
        if (isInline(value)) { strippedImages += 1; out[key] = null; return; }
        out[key] = isWebUrl(value) ? value : null;
        return;
      }
      if (key === 'referenceImages') {
        out[key] = (Array.isArray(value) ? value : [])
          .filter((r) => isWebUrl(r?.url))
          .map((r) => ({ ...r, thumbnail: isWebUrl(r.thumbnail) ? r.thumbnail : r.url }));
        return;
      }
      out[key] = value;
    });
    return out;
  });

  const project = {
    version: 1,
    frames,
    layout: state?.layout,
    selectedModel: state?.selectedModel,
    selectedModelName: state?.selectedModelName,
    selectedAr: state?.selectedAr,
    selectedStyle: state?.selectedStyle,
    selectedLighting: state?.selectedLighting,
    selectedColor: state?.selectedColor,
    settings: state?.settings || {},
    brief: state?.brief || {},
  };

  const bytes = new TextEncoder().encode(JSON.stringify(project)).length;
  if (bytes > MAX_CLOUD_BYTES) {
    throw new CloudSyncError('too_large', `This storyboard is too large to sync (${Math.round(bytes / 1024)} KB).`);
  }
  const totalSeconds = frames.reduce((sum, f) => sum + (Number(f.duration) || 0), 0);
  return { project, frameCount: frames.length, totalSeconds, strippedImages };
}

/**
 * Turn a Supabase/PostgREST/network failure into a short code the studio can
 * act on: signed_out | not_set_up | offline | limit | too_large | error.
 */
export function classifyCloudError(error) {
  if (error instanceof CloudSyncError) return error.code;
  const text = `${error?.message || ''} ${error?.details || ''} ${error?.hint || ''}`;
  const code = String(error?.code || '');
  // supabase-js reports a lost connection as "TypeError: Failed to fetch" or, in newer versions, "Offline".
  if (/failed to fetch|networkerror|load failed|network request failed|^\s*offline\b/i.test(text) || error?.name === 'TypeError') return 'offline';
  if (code === '42P01' || code === 'PGRST205' || /relation .* does not exist|could not find the table|schema cache/i.test(text)) return 'not_set_up';
  if (/storyboard limit reached/i.test(text)) return 'limit';
  if (code === '23514' && /project_size/i.test(text)) return 'too_large';
  if (/JWT|row-level security|permission denied|not authenticated|\b40[13]\b/i.test(text) || code === '42501') return 'signed_out';
  return 'error';
}

const MESSAGES = {
  signed_out: 'Sign in to sync your storyboards.',
  not_set_up: 'Cloud sync is not set up for this site yet. Your storyboard is saved on this device.',
  offline: 'You appear to be offline. Saved on this device; it will sync the next time you save.',
  limit: 'Your account already holds 100 storyboards. Delete one to sync a new one.',
  too_large: 'This storyboard is too large to sync. It is saved on this device.',
  error: 'Cloud sync failed. Your storyboard is saved on this device.',
};

/** Normalise any failure into a CloudSyncError with a user-facing message. */
export function toCloudError(error, fallback = 'error') {
  if (error instanceof CloudSyncError) return error;
  const code = classifyCloudError(error) || fallback;
  return new CloudSyncError(code, MESSAGES[code] || MESSAGES.error, { cause: error });
}

const assertName = (name) => {
  const n = String(name || '').trim();
  if (!n) throw new CloudSyncError('error', 'Give the storyboard a name first.');
  if (n.length > MAX_CLOUD_NAME) throw new CloudSyncError('error', `Project names can be at most ${MAX_CLOUD_NAME} characters to sync.`);
  return n;
};

/** Names and timestamps of the user's cloud storyboards, newest first. */
export async function listCloudProjects(client) {
  const { data, error } = await client
    .from(CLOUD_TABLE)
    .select('name, updated_at, frame_count, total_seconds')
    .order('updated_at', { ascending: false })
    .limit(200);
  if (error) throw toCloudError(error);
  return data || [];
}

/** One project's full content, or null when there is none by that name. */
export async function loadCloudProject(client, name) {
  const n = assertName(name);
  const { data, error } = await client
    .from(CLOUD_TABLE)
    .select('name, project, updated_at')
    .eq('name', n)
    .maybeSingle();
  if (error) throw toCloudError(error);
  if (!data) return null;
  return { name: data.name, state: data.project, updatedAt: data.updated_at };
}

/**
 * Save (create or replace) a project.
 *
 * `expectedUpdatedAt` is the server timestamp this device last saw for the
 * project. If the cloud copy has moved on since (saved from another browser),
 * a `conflict` error is thrown rather than silently overwriting it; pass
 * `force: true` once the user has agreed to overwrite.
 * @returns {{ updatedAt: string, strippedImages: number, frameCount: number }}
 */
export async function saveCloudProject(client, name, state, { expectedUpdatedAt = null, force = false } = {}) {
  const n = assertName(name);
  const { project, frameCount, totalSeconds, strippedImages } = prepareCloudProject(state);

  if (expectedUpdatedAt && !force) {
    const { data, error } = await client.from(CLOUD_TABLE).select('updated_at').eq('name', n).maybeSingle();
    if (error) throw toCloudError(error);
    if (data && data.updated_at !== expectedUpdatedAt) {
      throw new CloudSyncError('conflict', 'This storyboard was changed on another device.', { remoteUpdatedAt: data.updated_at });
    }
  }

  const { data, error } = await client
    .from(CLOUD_TABLE)
    .upsert(
      { name: n, project, frame_count: frameCount, total_seconds: totalSeconds },
      { onConflict: 'clerk_user_id,name' },
    )
    .select('updated_at')
    .single();
  if (error) throw toCloudError(error);
  return { updatedAt: data.updated_at, strippedImages, frameCount };
}

export async function deleteCloudProject(client, name) {
  const n = assertName(name);
  const { error } = await client.from(CLOUD_TABLE).delete().eq('name', n);
  if (error) throw toCloudError(error);
}

/** True when `a` is a later instant than `b` (either may be missing). */
export function isNewer(a, b) {
  const ta = a ? Date.parse(a) : NaN;
  const tb = b ? Date.parse(b) : NaN;
  if (Number.isNaN(ta)) return false;
  if (Number.isNaN(tb)) return true;
  return ta > tb;
}
