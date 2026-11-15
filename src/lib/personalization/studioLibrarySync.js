// src/lib/personalization/studioLibrarySync.js
//
// The Personalize window keeps each client's saved images in localStorage
// (`smartvideo_client_assets`); the timeline's contact profile holds a synced
// copy. An edit made on the timeline (a background removal, "use original")
// has to reach the window's copy too, or the window shows the old image and the
// next sync puts it back. Same asset id, same fields. Pure apart from `storage`.
const ASSETS_KEY = 'smartvideo_client_assets';
const LISTS = ['identities', 'logos', 'products', 'brandReferences'];
const SINGLES = ['primaryIdentity', 'primaryLogo'];
const isTemporary = (u) => /^blob:/i.test(String(u || ''));

/** The library with asset `assetId` replaced by `asset` (every place it appears). `changed` says whether it was found. */
export function applyAssetToLibrary(library, assetId, asset) {
  if (!library || typeof library !== 'object') return { library, changed: false };
  let changed = false;
  const next = { ...library };
  const swap = (a) => { if (a && a.id === assetId) { changed = true; return { ...a, ...asset, id: assetId }; } return a; };
  LISTS.forEach((k) => { if (Array.isArray(next[k])) next[k] = next[k].map(swap); });
  SINGLES.forEach((k) => { if (next[k]) next[k] = swap(next[k]); });
  ['firstFrame', 'lastFrame', 'ctaGraphic'].forEach((k) => { if (next[k]) next[k] = swap(next[k]); });
  return { library: next, changed };
}

/**
 * Write an edited asset into the studio's library for `clientId`.
 * Returns true when the studio's copy now matches. A `blob:` url (it dies with
 * the tab) is never written there.
 */
export function writeAssetToStudioLibrary(clientId, assetId, asset, storage = globalThis.localStorage) {
  if (!storage || !clientId || !assetId || !asset || isTemporary(asset.url)) return false;
  try {
    const all = JSON.parse(storage.getItem(ASSETS_KEY) || '{}') || {};
    if (!all[clientId]) return false;
    const { library, changed } = applyAssetToLibrary(all[clientId], assetId, asset);
    if (!changed) return false;
    all[clientId] = library;
    storage.setItem(ASSETS_KEY, JSON.stringify(all));
    return true;
  } catch {
    return false; // storage full or unreadable: the timeline copy still works
  }
}
