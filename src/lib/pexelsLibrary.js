/**
 * Simple localStorage-backed library for Pexels imports.
 *
 * Pexels media is hosted on Pexels/Vimeo CDN, so we don't re-upload it to
 * Supabase storage. Instead we store the metadata + attribution in
 * localStorage so it survives reloads and can be re-imported into projects.
 */

const STORAGE_KEY = 'pexels_library';

function readLibrary() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch {
    return [];
  }
}

function writeLibrary(items) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    // Storage may be disabled or full.
  }
}

export function listPexelsLibrary() {
  return readLibrary().sort((a, b) => new Date(b.importedAt || 0) - new Date(a.importedAt || 0));
}

export function savePexelsLibraryEntry(asset) {
  const items = readLibrary();
  const entry = {
    id: `pexels-${asset.id || Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    pexelsId: asset.id,
    type: asset.type || (asset.video_files ? 'video' : 'image'),
    src: asset.src || asset.url,
    thumb: asset.thumb || asset.image || (asset.src && asset.src.small) || '',
    width: asset.width,
    height: asset.height,
    duration: asset.duration || null,
    alt: asset.alt || '',
    photographer: asset.photographer || asset.user?.name || '',
    photographerUrl: asset.photographer_url || asset.user?.url || '',
    pexelsUrl: asset.url || '',
    source: 'pexels',
    importedAt: new Date().toISOString(),
  };
  items.unshift(entry);
  writeLibrary(items);
  return entry;
}

export function deleteFromPexelsLibrary(id) {
  const items = readLibrary().filter(item => item.id !== id);
  writeLibrary(items);
}

export function clearPexelsLibrary() {
  writeLibrary([]);
}
