/**
 * MuAPI Studio Media Bridge
 *
 * Shared plumbing every MuAPI-bound studio uses to get a user file from the
 * device to a MuAPI model without ever making the user upload twice and
 * without ever persisting a MuAPI temporary URL:
 *
 *   pick/attach ──▶ validateMuAPIUpload()      (MuAPI type + size rules)
 *              ──▶ saveAsset()                 (permanent Asset Library row)
 *              ──▶ uploadImage/VideoToMuAPI()  (fresh temp URL for MuAPI)
 *
 * Re-using an existing asset (same name + size already in the library) skips
 * the re-upload and resolves through `resolveMuAPIMediaInput`, which re-uploads
 * only when the temporary URL expired.
 *
 * Generation time: studios hand the bridge a media reference
 * (`{ url, assetId }` or a plain URL) and receive a fresh MuAPI URL via
 * `resolveMuapiMediaRef()`.
 *
 * Dependencies on the adapter (src/lib/muapiUpload.js) and auth context
 * (src/lib/authContext.js) are loaded lazily and defensively: when either
 * module is not deployed yet, the bridge degrades to a locally derived auth
 * context instead of crashing the studio.
 */

import { apiKeyManager } from './apiKeyManager.js';
import { getUserKey } from './supabase.js';
import { saveAsset, listAssets, findDuplicateAsset } from './assetLibrary.js';

const WORKSPACE_STORAGE_KEYS = [
  'remix_workspace_id',
  'current_workspace_id',
  'workspace_id',
  'active_workspace_id',
];

function readStoredWorkspaceId() {
  try {
    const raw = globalThis.localStorage;
    if (!raw) return '';
    for (const key of WORKSPACE_STORAGE_KEYS) {
      const value = raw.getItem(key);
      if (value) return String(value);
    }
  } catch { /* storage disabled — workspace scoping falls back to user scope */ }
  return '';
}

/**
 * Auth context for the adapter. Prefers the shared authContext module; falls
 * back to a minimal context built from the MuAPI key + user key.
 * @returns {Promise<{ userId: string, workspaceId: string, muapiKey: string }>}
 */
export async function getMuapiAuthContext() {
  try {
    const mod = await import('./authContext.js');
    const get = mod.getAuthContext || mod.default?.getAuthContext;
    if (typeof get === 'function') {
      const ctx = await get();
      // Return the resolved Clerk identity even when no MuAPI key is
      // configured: dropping it here would save durable assets under the
      // shared 'anonymous' owner and strand them once a key is added.
      // BYOK is enforced by the adapter at upload time (MUAPI_KEY_MISSING).
      if (ctx && ctx.userId) {
        return {
          userId: ctx.userId,
          workspaceId: ctx.workspaceId || '',
          muapiKey: ctx.muapiKey || '',
        };
      }
    }
  } catch { /* authContext module unavailable — use the local fallback */ }

  // Fallback identity must match what assetLibrary/authContext write: the
  // verified Clerk user id when signed in (getUserKey prefers it), else the
  // local anonymous key — never a drifted 'anonymous' for a signed-in user.
  const userId = await getUserKey();
  return {
    userId,
    workspaceId: readStoredWorkspaceId() || 'personal',
    muapiKey: apiKeyManager.getMuapiKey?.() || '',
    source: 'fallback',
  };
}

/** Load the shared MuAPI upload adapter (Sub-agent A's module). */
async function loadMuapiUpload() {
  return import('./muapiUpload.js');
}

/**
 * Validate + durably store + (optionally) upload a studio file.
 *
 * @param {File} file
 * @param {{ studioId?: string, projectId?: string, uploadToMuapi?: boolean, authContext?: object }} [opts]
 *        `uploadToMuapi` defaults to true (picker-style eager upload). Studios
 *        that only resolve media at generation time pass `false`.
 * @returns {Promise<{ assetId: string, url: string, path: string, name: string, type: string,
 *                    category: 'image'|'video'|'other', mime: string, sizeBytes: number,
 *                    reused: boolean, muapiUrl: string|null }>}
 */
export async function ingestStudioUpload(file, opts = {}) {
  const muapiUpload = await loadMuapiUpload();
  const validation = await muapiUpload.validateMuAPIUpload(file);
  const authContext = opts.authContext || (await getMuapiAuthContext());

  // Warm the duplicate cache so we can avoid re-uploading a file the user
  // already stored (same name + size).
  await listAssets(authContext).catch(() => {});
  const duplicate = findDuplicateAsset(authContext, {
    name: file.name,
    size: file.size,
    type: file.type,
  });

  const asset = duplicate || await saveAsset(file, authContext, {
    projectId: opts.projectId || '',
  });

  let muapiUrl = null;
  if (duplicate) {
    muapiUrl = (await muapiUpload.resolveMuAPIMediaInput(asset.id, authContext))?.url || null;
  } else if (opts.uploadToMuapi !== false) {
    let media;
    if (validation.category === 'video') media = await muapiUpload.uploadVideoToMuAPI(file, authContext);
    else if (validation.category === 'image') media = await muapiUpload.uploadImageToMuAPI(file, authContext);
    else media = await muapiUpload.uploadFileToMuapi(file, authContext);
    muapiUrl = media?.url || null;
  }

  return {
    assetId: asset.id,
    url: asset.url,
    path: asset.path,
    name: asset.name,
    type: asset.type,
    category: validation.category,
    mime: validation.mime,
    sizeBytes: validation.sizeBytes,
    reused: Boolean(duplicate),
    muapiUrl,
  };
}

/**
 * Resolve a studio media reference to a URL MuAPI can fetch right now.
 *
 * @param {string|{ url?: string, assetId?: string }} ref
 * @param {object} [authContext] pre-fetched auth context (avoids re-reading it per ref)
 * @returns {Promise<string|null>}
 */
export async function resolveMuapiMediaRef(ref, authContext) {
  if (!ref) return null;
  if (typeof ref === 'string') return ref;
  if (!ref.assetId) return ref.url || null;
  const muapiUpload = await loadMuapiUpload();
  const ctx = authContext || (await getMuapiAuthContext());
  const media = await muapiUpload.resolveMuAPIMediaInput(ref.assetId, ctx);
  return media?.url || ref.url || null;
}

/**
 * Resolve a list of studio media references (keeps order, drops empties).
 */
export async function resolveMuapiMediaRefs(refs, authContext) {
  const list = Array.isArray(refs) ? refs : [];
  const resolved = await Promise.all(list.map((ref) => resolveMuapiMediaRef(ref, authContext)));
  return resolved.filter(Boolean);
}

/**
 * Resolve a personalization media reference (business / person / product /
 * brand image on a Personalizer element) to a URL MuAPI can fetch right now.
 *
 * Elements saved before the Asset Library existed keep a plain `src` URL, so a
 * reference without an `assetId` resolves through its stored URL unchanged —
 * that keeps every legacy personalization canvas working.
 *
 * @param {{ src?: string, url?: string, assetId?: string }|string} element
 * @returns {Promise<string|null>}
 */
export async function resolvePersonalizationMediaRef(element) {
  if (!element) return null;
  if (typeof element === 'string') return element;
  const url = element.src || element.url || null;
  if (!element.assetId) return url;
  const resolved = await resolveMuapiMediaRef({ url, assetId: element.assetId });
  return resolved || url;
}

/**
 * UI-safe message for an upload failure (adapter's userMessage when available).
 */export async function describeMuapiUploadError(error) {
  try {
    const { handleMuAPIUploadError } = await loadMuapiUpload();
    const info = handleMuAPIUploadError(error);
    return info?.userMessage || info?.message || error?.message || 'Upload failed.';
  } catch {
    return error?.message || 'Upload failed.';
  }
}

/**
 * Per-studio in-flight guard. Duplicate submissions (impatient double clicks,
 * repeated drops) are ignored instead of uploading the same file twice.
 */
export function createStudioInFlightGuard() {
  const inFlight = new Set();
  return {
    isBusy: (key = 'default') => inFlight.has(key),
    keys: () => Array.from(inFlight),
    async run(key, fn) {
      const slot = key || 'default';
      if (inFlight.has(slot)) return { skipped: true, value: null };
      inFlight.add(slot);
      try {
        return { skipped: false, value: await fn() };
      } finally {
        inFlight.delete(slot);
      }
    },
  };
}

export default {
  getMuapiAuthContext,
  ingestStudioUpload,
  resolveMuapiMediaRef,
  resolveMuapiMediaRefs,
  resolvePersonalizationMediaRef,
  describeMuapiUploadError,
  createStudioInFlightGuard,
};
