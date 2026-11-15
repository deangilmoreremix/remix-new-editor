// src/lib/personalization/backgroundCutout.js
//
// Free, on-device background removal for a contact's saved image, usable from
// the Timeline Editor. It reuses the Personalization Studio's own engine
// (backgroundRemoval/*: @bg0/browser in a Web Worker, ~192 MB model fetched on
// first use) and writes the result the same way the studio's "Use Edited
// Asset" does: same asset id, cutout in `url`, the old image in `originalUrl`.
// So the studio and the timeline see one asset, and `{{logoUrl}}` etc. follow.
import { resolveAssetUrl, resolveOriginalAssetUrl } from './assetUrl.js';

const nowIso = () => new Date().toISOString();

/** The asset after a cutout. `url` is the new image (durable `uploadedUrl` when uploaded). */
export function buildCutoutPatch(asset, { url, uploadedUrl = '', provider = '', width, height } = {}) {
  const originalUrl = asset.originalUrl || resolveOriginalAssetUrl(asset);
  const version = { id: `${asset.id}:cutout:${Date.now()}`, url, type: 'background_removed', createdAt: nowIso() };
  return {
    ...asset,
    url,
    uploadedUrl: uploadedUrl || undefined,
    uploadStatus: uploadedUrl ? 'ready' : 'local',
    mimeType: 'image/png',
    originalUrl,
    edited: true,
    hasTransparency: true,
    ...(width && height ? { width, height } : {}),
    // The old crop focus / measured logo brightness belong to the old pixels.
    luminance: undefined,
    editMetadata: { ...(asset.editMetadata || {}), operation: 'remove_background', provider: provider || 'bg0' },
    versions: [...(Array.isArray(asset.versions) ? asset.versions : []), version],
  };
}

/** The asset back on its original image (the cutout stays in `versions`). */
export function buildRevertPatch(asset) {
  const original = asset.originalUrl;
  if (!original) return asset;
  return {
    ...asset,
    url: original,
    uploadedUrl: undefined,
    uploadStatus: 'ready',
    originalUrl: undefined,
    edited: false,
    hasTransparency: false,
    luminance: undefined,
    editMetadata: undefined,
  };
}

async function loadEngine() {
  const [client, loader, persist] = await Promise.all([
    import('../../features/personalization/shared/personalization/backgroundRemoval/backgroundRemovalClient'),
    import('../../features/personalization/shared/personalization/backgroundRemoval/loadImageBlob'),
    import('../../features/personalization/shared/personalization/editedAssetPersistence'),
  ]);
  return {
    canRemove: client.canRemoveBackgrounds,
    removeBackground: client.removeAssetBackground,
    loadImageBlob: loader.loadImageBlob,
    persist: persist.persistEditedPersonalizationAsset,
    blobToDataUrl: client.blobToDataUrl,
  };
}

/**
 * Remove the background of `asset` and return the asset patch.
 * `deps` lets tests (or another host) inject the engine.
 */
export async function cutoutAsset(asset, { onProgress, signal, deps, clientId } = {}) {
  const source = resolveAssetUrl(asset);
  if (!source) throw new Error('This image has no URL to cut out.');
  const engine = deps || await loadEngine();
  if (engine.canRemove && !(await engine.canRemove())) throw new Error('Background removal needs a browser with WebAssembly.');

  const input = await engine.loadImageBlob(source, { signal });
  const out = await engine.removeBackground(input, { quality: 'quality', onProgress, signal });

  // Make it durable (survives reload, usable by the export). If the upload
  // fails the cutout still works on this device until the tab is closed.
  let uploadedUrl = '';
  try {
    const dataUrl = engine.blobToDataUrl ? await engine.blobToDataUrl(out.blob) : '';
    const saved = await engine.persist({
      assetId: asset.id,
      originalAssetId: asset.id,
      clientId,
      dataUrl,
      blob: out.blob,
      mimeType: 'image/png',
      width: out.width,
      height: out.height,
      role: asset.role,
      name: `${asset.name || asset.role || 'image'} (cutout)`,
      operation: 'remove_background',
      outputFormat: 'png',
      transparent: true,
    });
    if (saved?.ok && saved.publicUrl) uploadedUrl = saved.publicUrl;
  } catch { /* keep the local result */ }

  const url = uploadedUrl || URL.createObjectURL(out.blob);
  return { patch: buildCutoutPatch(asset, { url, uploadedUrl, provider: out.provider, width: out.width, height: out.height }), uploaded: Boolean(uploadedUrl) };
}
