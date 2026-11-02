/**
 * Domain-level asset upload service for the Personalization system.
 *
 * This abstraction ensures the Personalization state does not depend on
 * which infrastructure stores or uploads media. Uploads go through the shared
 * MuAPI adapter (`@/lib/muapiUpload`), which routes every call through the
 * same-origin `/api/v1/upload_file` route — the same single endpoint the rest
 * of the app uses — and can be replaced or extended without touching
 * domain/state code.
 *
 * ── Why `url` is a durable URL and not the MuAPI URL ───────────────────────
 *
 * DEFECT (this file, before the shared adapter landed): the docstring below
 * promised "a durable URL", but the implementation returned the URL that
 * MuAPI's `upload_file` endpoint handed back. MuAPI upload URLs are
 * TEMPORARY: they expire one hour after they are issued. `DemoPersonalizeProvider`
 * (`src/shared/personalization/DemoPersonalizeProvider.tsx:1470`) stores the
 * returned value straight into the asset record as its `url` / `uploadedUrl`,
 * and `supabaseProjectPersistence` / `clientAssets` write that record to
 * long-term storage. An hour later the project still "had" its logo — the
 * identifier just pointed at nothing.
 *
 * FIX: the ORIGINAL bytes are written to durable storage first, and the
 * permanent identifier returned from this function is that durable reference.
 * The MuAPI URL is returned separately as `muapiUrl` and is treated as
 * strictly ephemeral. When an hour has passed, callers obtain a fresh MuAPI URL
 * with `resolvePersonalizationAssetMuAPIUrl`, which re-uploads the durable
 * original from authorized storage.
 */

import { getStableUserId } from '../auth/stableUserId';
import {
  handleMuAPIUploadError,
  persistMuAPIAssetOriginal,
  resolveMuAPIMediaInput,
  uploadImageToMuAPI,
  uploadVideoToMuAPI,
  type MuAPIAuthContext,
} from '@ohb/lib/muapiUpload';

export interface UploadPersonalizationAssetInput {
  file: File
  /**
   * Stable id for this asset inside the caller's workspace. Optional: when it
   * is omitted the id is derived from the file's own bytes, which keeps the
   * durable object address content-addressed and makes a repeat upload land on
   * the same object instead of creating a duplicate.
   */
  assetId?: string
  /** The caller's authorized workspace. Defaults to the signed-in identity. */
  workspaceId?: string
  onProgress?: (percent: number) => void
}

export interface UploadPersonalizationAssetResult {
  /**
   * The PERMANENT identifier: a durable storage URL. This is the value a
   * caller may persist — it does not expire.
   *
   * It is the only required field on purpose: the pre-adapter version of this
   * function returned `{ url }` holding a MuAPI temporary URL, and callers
   * persisted it. Keeping `url` as the single required property means existing
   * call sites keep compiling while the value they receive is now durable.
   */
  url: string
  /** Durable object reference (the canonical, storage-side identifier). */
  durableRef?: string
  /** Same as `url`; kept separate so the two roles stay explicit. */
  durableUrl?: string
  /** Ephemeral MuAPI URL. NEVER persist this: it expires after one hour. */
  muapiUrl?: string
  /** Epoch ms at which `muapiUrl` stops being usable. */
  muapiExpiresAt?: number
  name?: string
  size?: number
  type?: string
}

/**
 * Upload a personalization asset.
 *
 * Returns a durable URL as the permanent identifier plus a separate, ephemeral
 * MuAPI URL for immediate use. The underlying storage infrastructure remains an
 * implementation detail of this module.
 */
export async function uploadPersonalizationAsset(
  apiKey: string,
  { file, assetId, workspaceId, onProgress }: UploadPersonalizationAssetInput,
): Promise<UploadPersonalizationAssetResult> {
  if (!file) throw new Error('No file provided');

  // `apiKey` is the caller's own BYOK key. This service hands it to the shared
  // adapter and nothing else; it never stores it, logs it, or derives a
  // server-side fallback for it.
  const resolvedWorkspace = workspaceId?.trim() || getStableUserId()
  const resolvedAssetId = assetId?.trim() || (await deriveContentAssetId(file));

  const authContext: MuAPIAuthContext = {
    workspaceId: resolvedWorkspace,
    assetId: resolvedAssetId,
    apiKey: apiKey || null,
  };

  if (onProgress) onProgress(0);

  // 1. The original goes to durable storage, under the caller's own workspace
  //    prefix, before MuAPI ever sees it.
  let durable: { durableRef: string; durableUrl: string | null };
  try {
    durable = await persistMuAPIAssetOriginal({ file, assetId: resolvedAssetId, authContext });
  } catch (error) {
    const info = handleMuAPIUploadError(error);
    if (onProgress) onProgress(0);
    throw new Error(info.message);
  }

  // Saving needs no MuAPI key: without one the asset is stored durably and the
  // MuAPI copy is made later, from storage, when a generation needs it
  // (`resolvePersonalizationAssetMuAPIUrl`).
  if (!authContext.apiKey) {
    if (onProgress) onProgress(100);
    return {
      url: durable.durableUrl || durable.durableRef,
      durableRef: durable.durableRef,
      durableUrl: durable.durableUrl || durable.durableRef,
      name: file.name,
      size: file.size,
      type: file.type,
    };
  }

  // 2. Then the adapter obtains a MuAPI URL — straight from bytes for small
  //    files, or storage → MuAPI for anything too large to cross the
  //    serverless request hop.
  const isVideo = String(file.type || '').startsWith('video/');
  let uploaded;
  try {
    uploaded = isVideo
      ? await uploadVideoToMuAPI(file, authContext)
      : await uploadImageToMuAPI(file, authContext);
  } catch (error) {
    const info = handleMuAPIUploadError(error);
    if (onProgress) onProgress(0);
    throw new Error(info.message);
  }
  if (onProgress) onProgress(100);

  return {
    url: durable.durableUrl || durable.durableRef,
    durableRef: durable.durableRef,
    durableUrl: durable.durableUrl || durable.durableRef,
    muapiUrl: uploaded.url,
    muapiExpiresAt: uploaded.expiresAt || uploaded.uploadedAt + 60 * 60 * 1000,
    name: uploaded.name || file.name,
    size: uploaded.size || file.size,
    type: uploaded.type || file.type,
  };
}

/**
 * Resolve a FRESH MuAPI URL for an already-uploaded asset.
 *
 * Use this whenever an asset's MuAPI URL may have passed its one-hour
 * lifetime. The durable original is loaded from the caller's authorized
 * workspace and re-uploaded, so the caller never has to keep the file around
 * and never has to trust a stale URL.
 */
export async function resolvePersonalizationAssetMuAPIUrl(
  assetId: string,
  options: { workspaceId?: string; apiKey?: string | null } = {},
): Promise<{ url: string; durableRef: string; source: 'cache' | 'fresh'; expiresAt: number }> {
  const resolved = await resolveMuAPIMediaInput(assetId, {
    workspaceId: options.workspaceId?.trim() || getStableUserId(),
    apiKey: options.apiKey ?? null,
  });

  return {
    url: resolved.url,
    durableRef: resolved.durableRef,
    source: resolved.source,
    expiresAt: resolved.expiresAt,
  };
}

/**
 * Drop a cached MuAPI URL so the next resolve re-uploads the durable original.
 * Call this when a probe or a MuAPI use of the URL has failed — a failure is
 * proof enough that the URL is dead, expiry clock or not.
 */
export async function invalidatePersonalizationAssetMuAPIUrl(
  assetId: string,
  options: { workspaceId?: string } = {},
): Promise<void> {
  const { invalidateMuAPIMediaInput } = await import('@ohb/lib/muapiUpload');
  invalidateMuAPIMediaInput(assetId, {
    workspaceId: options.workspaceId?.trim() || getStableUserId(),
  });
}

/**
 * Content-addressed asset id.
 *
 * Deterministic in the file's bytes, so uploading the same file twice produces
 * the same durable object instead of a second copy — which is what keeps the
 * upload path idempotent when a caller has no stable id of its own to hand us.
 */
async function deriveContentAssetId(file: File): Promise<string> {
  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const subtle = globalThis.crypto?.subtle;
    if (!subtle) throw new Error('subtle unavailable');
    const digest = await subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(digest))
      .map(byte => byte.toString(16).padStart(2, '0'))
      .join('')
      .slice(0, 40);
  } catch {
    // Last resort: shape only. Still a single, stable path segment.
    return `asset-${file.name?.replace(/[^A-Za-z0-9._-]/g, '-') || 'file'}-${file.size}`;
  }
}
