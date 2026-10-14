/**
 * Permanent Asset Library
 *
 * Durable, workspace-scoped home for every file a user references in a studio
 * (MuAPI studios included). This module is the ONLY place that writes asset
 * rows: media rows store the PERMANENT Supabase Storage URL — never a MuAPI
 * temporary URL (those expire after 1 hour and must never become an
 * identifier or a canonical `media.url`).
 *
 * Storage layout (identical to the existing durable upload path, prefixed
 * with the app tag so the shared `uploads` bucket can scope this app's
 * objects):
 *   bucket : 'uploads'  (see uploadService.resolveSupabaseBucket)
 *   path   : `smartvideo/${userId}/${unique}_${safeBase}.${ext}`
 *
 * Every media row is tagged `app_id: 'smartvideo'` so the shared public.media
 * table can route this app's rows to the owner-scoped `smartvideo_media_owner_all`
 * RLS policy while other apps keep the blanket policy (migration
 * 20261014120000_smartvideo_media_rls_tagged.sql). Reads/deletes use the
 * stored `path` unchanged.
 *
 * Caller identity: `authContext.userId` is the shared-database identity (the
 * Clerk user id when signed in, otherwise 'anonymous' — see authContext.js).
 * The media row AND the storage object are written under that SAME identity
 * (path segment 2 after `smartvideo/` always equals `media.user_id`), because
 * the RLS policies scope both to one owner; the offline BYOK hash from
 * userKey.js is never used for either.
 *
 * Database: public.media (id, user_id, workspace_id, project_id, name, type,
 * size, path, url, created_at). `workspace_id` is written when the column
 * exists (migration owned by the auth/RLS work); queries degrade gracefully to
 * user-scoped selects when it does not, so the app never hard-crashes on an
 * older schema.
 *
 * Cross-workspace protection is enforced twice:
 *   1. app level — every read is scoped to the caller's user + workspace and
 *      `getAsset`/`resolvePermanentMediaReference` re-check ownership,
 *   2. DB level — RLS policies (owned by the auth/RLS work).
 */

import { supabase, isSupabaseConfigured, getUserKey, primeSupabaseIdentity, assertVerifiedWriteIdentity } from './supabase.js';

const MEDIA_TABLE = 'media';
const ASSET_BUCKET = 'uploads';
const DEFAULT_WORKSPACE_ID = 'personal';
// Application tag: identifies this app's rows (public.media.app_id) and
// objects (`smartvideo/` prefix in the shared uploads bucket) so the
// shared-database RLS policies can scope them to their owner.
const APP_ID = 'smartvideo';
const APP_STORAGE_PREFIX = 'smartvideo';

// ── Errors ─────────────────────────────────────────────────────────────────

export class AssetLibraryError extends Error {
  constructor(message, { code, cause } = {}) {
    super(message);
    this.name = 'AssetLibraryError';
    this.code = code;
    this.cause = cause;
  }
}

function assetError(message, code, cause) {
  return new AssetLibraryError(message, { code, cause });
}

function requireConfigured() {
  if (!isSupabaseConfigured()) {
    throw assetError(
      'Asset Library is unavailable: Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.',
      'ASSET_STORE_UNAVAILABLE',
    );
  }
}

// ── Ids / paths ────────────────────────────────────────────────────────────

function makeUuid() {
  const c = globalThis.crypto;
  if (c && typeof c.randomUUID === 'function') return c.randomUUID();
  const bytes = new Uint8Array(16);
  if (c && typeof c.getRandomValues === 'function') c.getRandomValues(bytes);
  else for (let i = 0; i < 16; i += 1) bytes[i] = Math.floor(Math.random() * 256);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function normalizeExtension(name) {
  if (!name || typeof name !== 'string') return 'bin';
  if (name.includes('/') || name.includes('\\') || name.includes('..')) return 'bin';
  const parts = name.split('.');
  if (parts.length < 2) return 'bin';
  return parts.pop().replace(/[^a-zA-Z0-9]/g, '').toLowerCase() || 'bin';
}

function buildObjectPath(file, userId) {
  const raw = String(file?.name || 'asset');
  const ext = normalizeExtension(raw);
  // safeBase never keeps the extension — it is appended once below.
  const safeBase = raw.replace(/[^a-zA-Z0-9_.-]/g, '_').replace(/\.[^.]*$/, '').slice(0, 80) || 'asset';
  const unique = `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  const userPrefix = userId && userId !== 'anonymous' ? userId : 'anonymous';
  return `${APP_STORAGE_PREFIX}/${userPrefix}/${unique}_${safeBase}.${ext}`;
}

// ── Row helpers ────────────────────────────────────────────────────────────

/**
 * Resolve the caller identity and prime the verified Supabase access token
 * (Authorization) on the shared client before any DB/storage operation, so
 * every read and write carries the verified `sub` claim rather than relying
 * on the spoofable header alone. No-ops for anonymous callers (which keep
 * the header identity) and when the token exchange is unavailable.
 *
 * The identity is the shared-database one: `authContext.userId` (Clerk id
 * when signed in, else 'anonymous'), falling back to the supabase.js client
 * identity (same rule) — never the offline BYOK hash from userKey.js.
 */
async function resolveIdentity(authContext) {
  try {
    await primeSupabaseIdentity();
  } catch { /* client without token exchange — header identity still applies */ }
  return {
    userId: authContext?.userId || (await getUserKey()),
    workspaceId: authContext?.workspaceId || DEFAULT_WORKSPACE_ID,
  };
}

export function categoryFromMime(mime) {
  const m = String(mime || '').toLowerCase();
  if (m.startsWith('image/')) return 'image';
  if (m.startsWith('video/')) return 'video';
  if (m.startsWith('audio/')) return 'audio';
  return 'other';
}

function isMissingColumnError(err, column) {
  if (!err) return false;
  const code = String(err.code || '');
  if (code === '42703' || code === 'PGRST204') return true;
  const message = String(err.message || err.details || '').toLowerCase();
  return message.includes(column) && (message.includes('column') || message.includes('schema cache'));
}

function toAsset(row) {
  if (!row) return null;
  return {
    id: row.id,
    url: row.url,
    path: row.path,
    name: row.name,
    type: row.type,
    category: categoryFromMime(row.type),
    size: Number(row.size || 0),
    userId: row.user_id,
    workspaceId: row.workspace_id || '',
    projectId: row.project_id || '',
    createdAt: row.created_at || null,
  };
}

function sameScope(row, authContext) {
  if (!row) return false;
  if (row.user_id !== authContext.userId) return false;
  const rowWorkspace = row.workspace_id || '';
  const ctxWorkspace = authContext.workspaceId || '';
  // Rows written before workspace scoping existed ('' / null) belong to the
  // user and stay readable for that user only.
  if (!rowWorkspace || !ctxWorkspace) return true;
  return rowWorkspace === ctxWorkspace;
}

// ── In-memory cache (powers the synchronous duplicate check) ───────────────

const assetCache = new Map();

function cacheKey(authContext) {
  return `${authContext?.userId || 'anonymous'}::${authContext?.workspaceId || ''}`;
}

function cacheAssets(authContext, rows) {
  assetCache.set(cacheKey(authContext), rows);
}

/**
 * Drop the cached asset list (account switch, logout, tests).
 */
export function resetAssetCache() {
  assetCache.clear();
}

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Durably save a file to the Asset Library.
 *
 * Uploads the original to Supabase Storage and inserts a `public.media` row
 * whose `url` is the PERMANENT storage URL (never a MuAPI temporary URL).
 *
 * @param {File} file
 * @param {{ userId: string, workspaceId?: string, muapiKey?: string }} authContext
 * @param {{ projectId?: string, source?: string }} [meta]
 * @returns {Promise<{ id: string, url: string, path: string, name: string, type: string, size: number, userId: string, workspaceId: string }>}
 */
export async function saveAsset(file, authContext, meta = {}) {
  requireConfigured();
  if (!file) throw assetError('No file supplied to the Asset Library.', 'ASSET_NO_FILE');

  // ONE identity for the media row AND the storage object: the RLS policies
  // scope both to the same owner (media.user_id and path segment 2 after
  // `smartvideo/`), so any drift between them would lock the caller out of
  // their own object. The path is built from this same identity below.
  const { userId, workspaceId } = await resolveIdentity(authContext);

  // Durable assets require a real account: without one every signed-out user
  // would share the single 'anonymous' owner and could read or delete each
  // other's "permanent" files. Sign in instead of silently pooling assets.
  if (!userId || userId === 'anonymous') {
    throw assetError(
      'Sign in to save assets to your permanent Asset Library.',
      'ASSET_SIGN_IN_REQUIRED',
    );
  }
  // Fail closed: a signed-in caller whose verified Supabase token cannot be
  // obtained (token exchange down / SUPABASE_JWT_SECRET missing) must not
  // silently degrade to the spoofable x-user-key header identity.
  await assertVerifiedWriteIdentity(userId);

  const path = buildObjectPath(file, userId);
  const mime = file.type || `application/${normalizeExtension(file.name)}`;

  const { error: uploadError } = await supabase.storage
    .from(ASSET_BUCKET)
    .upload(path, file, { contentType: mime, upsert: false });
  if (uploadError) {
    throw assetError(`Asset upload failed: ${uploadError.message || 'storage error'}`, 'ASSET_UPLOAD_FAILED', uploadError);
  }

  const { data: urlData, error: urlError } = supabase.storage.from(ASSET_BUCKET).getPublicUrl(path);
  if (urlError || !urlData?.publicUrl) {
    throw assetError('Asset uploaded, but the permanent URL could not be resolved.', 'ASSET_URL_MISSING', urlError);
  }

  const permanentUrl = urlData.publicUrl;
  const row = {
    id: makeUuid(),
    app_id: APP_ID,
    user_id: userId,
    workspace_id: workspaceId,
    project_id: meta.projectId || '',
    name: file.name || 'asset',
    type: mime,
    size: Number(file.size || 0),
    path,
    url: permanentUrl,
    created_at: new Date().toISOString(),
  };

  const { data: inserted, error: insertError } = await supabase
    .from(MEDIA_TABLE)
    .insert(row)
    .select()
    .single();

  if (insertError) {
    // Older schemas may not carry workspace_id yet — retry without it so the
    // asset (and its permanent URL) is still persisted.
    if (isMissingColumnError(insertError, 'workspace_id')) {
      const fallbackRow = { ...row };
      delete fallbackRow.workspace_id;
      const retry = await supabase.from(MEDIA_TABLE).insert(fallbackRow).select().single();
      if (retry.error) {
        throw assetError(`Asset row could not be saved: ${retry.error.message || 'insert failed'}`, 'ASSET_INSERT_FAILED', retry.error);
      }
      const asset = toAsset(retry.data) || toAsset(fallbackRow);
      cacheAssets(authContext, [...(assetCache.get(cacheKey(authContext)) || []), retry.data || fallbackRow]);
      return asset;
    }
    throw assetError(`Asset row could not be saved: ${insertError.message || 'insert failed'}`, 'ASSET_INSERT_FAILED', insertError);
  }

  cacheAssets(authContext, [...(assetCache.get(cacheKey(authContext)) || []), inserted || row]);
  return toAsset(inserted) || toAsset(row);
}

/**
 * List assets for the caller's workspace (optionally filtered by type).
 * `type` accepts a category ('image' | 'video') or a full MIME type.
 */
export async function listAssets(authContext, { type } = {}) {
  requireConfigured();
  const { userId, workspaceId } = await resolveIdentity(authContext);
  const scope = { userId, workspaceId };

  let rows;

  const withWorkspace = await supabase
    .from(MEDIA_TABLE)
    .select('*')
    .eq('user_id', userId)
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false });

  if (withWorkspace.error && isMissingColumnError(withWorkspace.error, 'workspace_id')) {
    const userScoped = await supabase
      .from(MEDIA_TABLE)
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (userScoped.error) {
      throw assetError(`Asset Library could not be read: ${userScoped.error.message || 'select failed'}`, 'ASSET_READ_FAILED', userScoped.error);
    }
    rows = userScoped.data || [];
  } else if (withWorkspace.error) {
    throw assetError(`Asset Library could not be read: ${withWorkspace.error.message || 'select failed'}`, 'ASSET_READ_FAILED', withWorkspace.error);
  } else {
    rows = withWorkspace.data || [];
  }

  cacheAssets(scope, rows);

  let assets = rows.map(toAsset).filter(Boolean);
  if (type) {
    const wanted = String(type).toLowerCase();
    assets = wanted.includes('/')
      ? assets.filter((a) => a.type === wanted)
      : assets.filter((a) => a.category === wanted || a.type === wanted);
  }
  return assets;
}

/**
 * Fetch one asset. Throws ASSET_ACCESS_DENIED when the row belongs to another
 * user or workspace.
 */
export async function getAsset(assetId, authContext) {
  requireConfigured();
  const { userId, workspaceId } = await resolveIdentity(authContext);

  let result = await supabase
    .from(MEDIA_TABLE)
    .select('*')
    .eq('id', assetId)
    .maybeSingle();

  if (result.error && isMissingColumnError(result.error, 'workspace_id')) {
    result = await supabase.from(MEDIA_TABLE).select('*').eq('id', assetId).maybeSingle();
  }
  if (result.error) {
    throw assetError(`Asset lookup failed: ${result.error.message || 'select failed'}`, 'ASSET_READ_FAILED', result.error);
  }
  const row = result.data;
  if (!row) throw assetError('Asset not found.', 'ASSET_NOT_FOUND');
  if (!sameScope(row, { userId, workspaceId })) {
    throw assetError('You do not have access to that asset.', 'ASSET_ACCESS_DENIED');
  }
  return toAsset(row);
}

/**
 * Permanent reference for an asset (used by the MuAPI adapter to re-upload an
 * expired file). Permanent fields only — never a MuAPI temporary URL.
 */
export async function resolvePermanentMediaReference(assetId, authContext) {
  const asset = await getAsset(assetId, authContext);
  return {
    url: asset.url,
    path: asset.path,
    name: asset.name,
    mime: asset.type,
    category: asset.category,
    sizeBytes: asset.size,
  };
}

/**
 * Delete an asset row (workspace-scoped).
 */
export async function deleteAsset(assetId, authContext) {
  // Ownership check first so another workspace's row can never be deleted.
  const asset = await getAsset(assetId, authContext);
  // Remove the durable original from storage before dropping the row so a
  // "Delete" never leaves the file publicly reachable.
  if (asset?.path) {
    try {
      const { error: storageError } = await supabase.storage.from(ASSET_BUCKET).remove([asset.path]);
      if (storageError) {
        console.error('[AssetLibrary] Failed to remove stored object:', storageError.message);
      }
    } catch (err) {
      // Storage cleanup must not block the row deletion.
      console.error('[AssetLibrary] Storage removal threw:', err);
    }
  }
  const { error } = await supabase.from(MEDIA_TABLE).delete().eq('id', assetId);
  if (error) {
    throw assetError(`Asset could not be deleted: ${error.message || 'delete failed'}`, 'ASSET_DELETE_FAILED', error);
  }
  const key = cacheKey({ userId: authContext?.userId, workspaceId: authContext?.workspaceId });
  const cached = assetCache.get(key);
  if (cached) cacheAssets(authContext, cached.filter((row) => row.id !== assetId));
  return { id: assetId, deleted: true };
}

/**
 * Synchronous duplicate lookup over the cached asset list (populated by
 * `listAssets` / `saveAsset`). Call `listAssets` first so the cache is warm.
 * Returns the matching asset row or null.
 */
export function findDuplicateAsset(authContext, { name, size, type } = {}) {
  const cached = assetCache.get(cacheKey(authContext)) || [];
  const wantedMime = String(type || '').toLowerCase();
  const wantedCategory = wantedMime.includes('/') ? categoryFromMime(wantedMime) : wantedMime;
  const match = cached.find((row) => {
    if (!row) return false;
    if (row.name !== name) return false;
    if (Number(row.size || 0) !== Number(size || 0)) return false;
    if (wantedMime.includes('/')) return row.type === wantedMime;
    return categoryFromMime(row.type) === wantedCategory || row.type === wantedCategory;
  });
  return match ? toAsset(match) : null;
}

/**
 * Fetch the permanent bytes for an asset reference. Used by the MuAPI adapter
 * when a temporary upload URL expired and the original file must be re-sent.
 *
 * Accepts an asset object, a `{ url }` reference, or a permanent URL string.
 * MuAPI temporary URLs are rejected on purpose: the library never re-reads
 * from an expiring source.
 */
export async function downloadAssetBytes(reference) {
  const url = typeof reference === 'string' ? reference : reference?.url;
  if (!url) throw assetError('Asset reference has no URL.', 'ASSET_URL_MISSING');
  if (/muapi\.ai/i.test(url)) {
    throw assetError(
      'Refusing to fetch a temporary MuAPI URL. Pass the permanent asset reference (assetId) instead.',
      'ASSET_URL_TEMPORARY',
    );
  }

  let response;
  try {
    response = await fetch(url);
  } catch (err) {
    throw assetError(`Asset download failed: ${err.message || 'network error'}`, 'ASSET_DOWNLOAD_FAILED', err);
  }
  if (!response.ok) {
    throw assetError(`Asset download failed (${response.status}).`, 'ASSET_DOWNLOAD_FAILED');
  }

  const blob = await response.blob();
  const name = (typeof reference === 'object' && reference.name) || 'asset';
  const mime = (typeof reference === 'object' && (reference.mime || reference.type)) || blob.type || 'application/octet-stream';
  try {
    return new File([blob], name, { type: mime });
  } catch {
    // Environments without a File constructor still get usable bytes.
    return blob;
  }
}

export default {
  saveAsset,
  listAssets,
  getAsset,
  resolvePermanentMediaReference,
  deleteAsset,
  findDuplicateAsset,
  downloadAssetBytes,
  resetAssetCache,
};
