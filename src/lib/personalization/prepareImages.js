// src/lib/personalization/prepareImages.js
//
// "Prepare all contacts' images": remove the background (free, on-device) from
// the logo / headshot / product image each contact's video uses, for every
// contact, in one batch. Planning is pure; the actual cutout and the save are
// injected, so it is testable and reuses the step 3 cutout and step 5 batch.
import { runBatch } from './batchExport.js';
import { assetForImageToken } from './timelineAssets.js';
import { isCutoutAsset, resolveAssetUrl } from './assetUrl.js';

/** Image tokens where a transparent background makes sense (not full-frame cards). */
export const CUTOUT_TOKEN_KEYS = Object.freeze(['logoUrl', 'avatarUrl', 'productImageUrl']);

const LABELS = { logoUrl: 'Logo', avatarUrl: 'Photo', productImageUrl: 'Product' };

/** The saved asset object (with its id) behind an id, in any of a profile's asset lists. */
export function findSavedAsset(profile, assetId) {
  const assets = profile?.personalization?.assets || {};
  return Object.values(assets).flat().find((a) => a && typeof a === 'object' && a.id === assetId) || null;
}

/**
 * What would be prepared.
 * @returns {{ items: object[], skipped: { done: number, missing: number } }}
 *   items: [{ id, name, profileId, assetId }], one per distinct asset.
 */
export function planPrepareImages(profiles, keys, { contactName = (p) => p?.name || p?.id } = {}) {
  const wanted = (keys || []).filter((k) => CUTOUT_TOKEN_KEYS.includes(k));
  const items = [];
  const seen = new Set();
  const skipped = { done: 0, missing: 0 };
  for (const profile of profiles || []) {
    for (const key of wanted) {
      const asset = assetForImageToken(profile, key);
      if (!asset?.id || !resolveAssetUrl(asset)) { skipped.missing += 1; continue; }
      const id = `${profile.id}:${asset.id}`;
      if (seen.has(id)) continue;
      seen.add(id);
      if (isCutoutAsset(asset)) { skipped.done += 1; continue; }
      items.push({ id, name: `${contactName(profile)} · ${LABELS[key] || 'Image'}`, profileId: profile.id, assetId: asset.id, profile });
    }
  }
  return { items, skipped };
}

/**
 * Run it. `cutout(asset) -> { patch }` (see backgroundCutout.cutoutAsset);
 * `save(profile, assetId, patch)` stores it. One failure never stops the rest.
 */
export async function prepareImages({ items, cutout, save, signal, onProgress } = {}) {
  return runBatch(items || [], async (item) => {
    const asset = findSavedAsset(item.profile, item.assetId);
    if (!asset) throw new Error('image no longer saved');
    const { patch, uploaded } = await cutout(asset, item);
    save(item.profile, item.assetId, patch);
    return { uploaded };
  }, { signal, onProgress });
}
