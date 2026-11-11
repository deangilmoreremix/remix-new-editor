/**
 * Stock images and videos from Pixabay and Pexels for the overlay pickers:
 *   - Image overlay: photos from either source
 *   - Overlay Transitions: videos (light leaks, film burns, glitches, wipes)
 *
 * Searches go through the editor's existing server-side proxies
 * (src/lib/pixabayApi.js → /api/pixabay, src/lib/pexelsApi.js → /api/pexels),
 * the same ones the "Browse Stock Media" panel uses, so the API keys never
 * reach the browser. The search functions are injected so this module has
 * no app imports and is testable.
 *
 * API terms honoured here:
 *  - Pixabay: results cached for 24 hours; the picker shows where results
 *    come from; images are not permanently hotlinked (the page copies a
 *    picked Pixabay image to its own storage — see importStockImage).
 *  - Pexels: the picker shows a link to Pexels.
 */

export const STOCK_CACHE_MS = 24 * 60 * 60 * 1000;

/** [id, label] */
export const STOCK_SOURCES = [['pixabay', 'Pixabay'], ['pexels', 'Pexels']];
export const STOCK_HOME = { pixabay: 'https://pixabay.com', pexels: 'https://www.pexels.com' };

/** Overlay Transitions picker tabs: [id, label, search query]. */
export const TRANSITION_CATEGORIES = [
  ['light-leaks', 'Light leaks', 'light leak'],
  ['film-burn', 'Film burn', 'film burn'],
  ['glitch', 'Glitch', 'glitch transition'],
  ['wipes', 'Wipes', 'transition overlay'],
];

const tagName = (tags, fallback) => String(tags || '').split(',').map((t) => t.trim()).filter(Boolean).slice(0, 2).join(', ') || fallback;
const slugName = (url, fallback) => {
  const slug = String(url || '').split('/').filter(Boolean).pop() || '';
  return slug.replace(/-\d+$/, '').replace(/-/g, ' ').trim() || fallback;
};

// ---------------------------------------------------------------- normalizers
// Common shape: { id, source, name, src, preview, thumbnail, duration?, width?, height?, user, pageURL }

export function normalizePixabayVideo(hit) {
  const v = hit?.videos || {};
  const pick = (...sizes) => sizes.map((s) => v[s]).find((x) => x && x.url);
  const play = pick('small', 'medium', 'tiny', 'large');
  const preview = pick('tiny', 'small');
  if (!play) return null;
  return {
    id: `pixabay-${hit.id}`,
    source: 'pixabay',
    name: tagName(hit.tags, `Pixabay ${hit.id}`),
    src: play.url,
    preview: preview?.url || play.url,
    thumbnail: play.thumbnail || preview?.thumbnail || '',
    duration: Number(hit.duration) || 0,
    user: hit.user || '',
    pageURL: hit.pageURL || `https://pixabay.com/videos/id-${hit.id}/`,
  };
}

export function normalizePexelsVideo(video) {
  const files = (video?.video_files || []).filter((f) => f.link && /mp4/i.test(f.file_type || 'video/mp4'));
  if (!files.length) return null;
  const closest = (target) => [...files].sort((a, b) => Math.abs((a.width || 0) - target) - Math.abs((b.width || 0) - target))[0];
  const play = closest(1280);
  return {
    id: `pexels-${video.id}`,
    source: 'pexels',
    name: slugName(video.url, `Pexels ${video.id}`),
    src: play.link,
    preview: closest(640).link,
    thumbnail: video.image || '',
    duration: Number(video.duration) || 0,
    user: video.user?.name || '',
    pageURL: video.url || '',
  };
}

export function normalizePixabayImage(hit) {
  const src = hit?.largeImageURL || hit?.webformatURL;
  if (!src) return null;
  return {
    id: `pixabay-${hit.id}`,
    source: 'pixabay',
    name: tagName(hit.tags, `Pixabay ${hit.id}`),
    src,
    preview: hit.webformatURL || src,
    thumbnail: hit.previewURL || hit.webformatURL || src,
    width: hit.imageWidth,
    height: hit.imageHeight,
    user: hit.user || '',
    pageURL: hit.pageURL || '',
    // Pixabay URLs may not be hotlinked permanently: copy before use.
    mustCopy: true,
  };
}

export function normalizePexelsPhoto(photo) {
  const s = photo?.src || {};
  const src = s.large2x || s.large || s.original;
  if (!src) return null;
  return {
    id: `pexels-${photo.id}`,
    source: 'pexels',
    name: photo.alt || slugName(photo.url, `Pexels ${photo.id}`),
    src,
    preview: s.medium || src,
    thumbnail: s.tiny || s.small || s.medium || src,
    width: photo.width,
    height: photo.height,
    user: photo.photographer || '',
    pageURL: photo.url || '',
  };
}

// ---------------------------------------------------------------- search

function cacheGet(storage, key) {
  try {
    const raw = storage?.getItem(key);
    if (!raw) return null;
    const { at, items } = JSON.parse(raw);
    return Date.now() - at < STOCK_CACHE_MS ? items : null;
  } catch {
    return null;
  }
}

function cacheSet(storage, key, items) {
  try {
    storage?.setItem(key, JSON.stringify({ at: Date.now(), items }));
  } catch { /* quota / private mode: best-effort */ }
}

/**
 * Build a search function over both sources.
 * clients: { pixabay: { searchImages, searchVideos }, pexels: { searchPhotos, searchVideos } }
 * Returns search(kind: 'images'|'videos', source, query) → { ok, items, error? }.
 */
export function createStockSearch(clients = {}, { storage = globalThis.localStorage, perPage = 24 } = {}) {
  return async function search(kind, source, query) {
    const q = String(query || '').trim().slice(0, 100);
    if (!q) return { ok: true, items: [] };
    const key = `stock:${source}:${kind}:${q.toLowerCase()}`;
    const cached = cacheGet(storage, key);
    if (cached) return { ok: true, items: cached, cached: true };
    try {
      let items;
      if (source === 'pixabay' && kind === 'videos') {
        const data = await clients.pixabay.searchVideos({ query: q, per_page: perPage, max_duration: 30, safe_search: true });
        items = (data?.hits || []).map(normalizePixabayVideo);
      } else if (source === 'pixabay') {
        const data = await clients.pixabay.searchImages({ query: q, per_page: perPage, safe_search: true });
        items = (data?.hits || []).map(normalizePixabayImage);
      } else if (source === 'pexels' && kind === 'videos') {
        const data = await clients.pexels.searchVideos({ query: q, orientation: 'landscape', min_duration: 1, max_duration: 30, per_page: perPage });
        items = (data?.videos || []).map(normalizePexelsVideo);
      } else if (source === 'pexels') {
        const data = await clients.pexels.searchPhotos({ query: q, per_page: perPage });
        items = (data?.photos || []).map(normalizePexelsPhoto);
      } else {
        return { ok: false, items: [], error: `Unknown source ${source}` };
      }
      items = items.filter(Boolean);
      cacheSet(storage, key, items);
      return { ok: true, items };
    } catch (err) {
      const msg = err?.status === 503 || /not configured/i.test(err?.message || '')
        ? `${source === 'pexels' ? 'Pexels' : 'Pixabay'} isn't connected on the server yet`
        : (err?.message || 'Search failed');
      return { ok: false, items: [], error: msg };
    }
  };
}
