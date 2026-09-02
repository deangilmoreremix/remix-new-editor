/**
 * Giphy API Client
 *
 * Frontend helper for interacting with the backend Giphy proxy.
 * All calls go to /api/giphy/... — never directly to api.giphy.com.
 *
 * Caching
 * -------
 * Search results are cached in sessionStorage for 5 minutes to reduce
 * redundant proxy calls and improve perceived performance.
 */

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes for search results
const CACHE_PREFIX = 'giphy_cache_';

function cacheKey(parts) {
  return CACHE_PREFIX + JSON.stringify(parts);
}

function getCached(key) {
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    const { ts, data } = JSON.parse(raw);
    if (Date.now() - ts > CACHE_TTL_MS) {
      sessionStorage.removeItem(key);
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

function setCache(key, data) {
  try {
    sessionStorage.setItem(key, JSON.stringify({ ts: Date.now(), data }));
  } catch {
    // Storage may be disabled or full; cache is best-effort.
  }
}

async function giphyFetch(path, options = {}) {
  const base = (import.meta?.env?.VITE_BACKEND_URL || '').replace(/\/$/, '');
  const url = `${base}/api/giphy${path}${options.query ? '?' + new URLSearchParams(options.query).toString() : ''}`;
  const headers = {
    ...(options.headers || {}),
  };
  const res = await fetch(url, {
    method: options.method || 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    try {
      const err = await res.json();
      detail = err?.error?.message || detail;
    } catch {}
    const err = new Error(detail);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

/**
 * Search Giphy for GIFs or stickers.
 *
 * @param {Object} params
 * @param {string} params.q - Search query
 * @param {string} [params.type='gifs'] - 'gifs' | 'stickers' | 'text' | 'emoji'
 * @param {number} [params.limit=15]
 * @param {number} [params.offset=0]
 * @param {string} [params.rating='g'] - 'g' | 'pg' | 'pg-13' | 'r'
 * @param {string} [params.lang]
 * @returns {Promise<{ data: Array, pagination: Object }>}
 */
export async function searchGiphy({
  q,
  type = 'gifs',
  limit = 15,
  offset = 0,
  rating = 'g',
  lang,
} = {}) {
  if (!q || !q.trim()) {
    const err = new Error('q is required for Giphy search');
    err.status = 400;
    throw err;
  }
  const key = cacheKey(['search', { q: String(q).trim(), type, limit, offset, rating, lang }]);
  const cached = getCached(key);
  if (cached) return cached;

  const data = await giphyFetch('/search', {
    query: {
      q: String(q).trim(),
      type: String(type),
      limit: String(Math.min(limit, 50)),
      offset: String(offset),
      rating: String(rating),
      lang: lang ? String(lang) : undefined,
    },
  });
  setCache(key, data);
  return data;
}

/**
 * Get trending GIFs or stickers from Giphy.
 */
export async function getTrendingGiphy({
  type = 'gifs',
  limit = 15,
  offset = 0,
  rating = 'g',
  lang,
} = {}) {
  const key = cacheKey(['trending', { type, limit, offset, rating, lang }]);
  const cached = getCached(key);
  if (cached) return cached;

  const data = await giphyFetch('/trending', {
    query: {
      type: String(type),
      limit: String(Math.min(limit, 50)),
      offset: String(offset),
      rating: String(rating),
      lang: lang ? String(lang) : undefined,
    },
  });
  setCache(key, data);
  return data;
}

/**
 * Get a specific Giphy GIF by ID.
 */
export async function getGiphyById(id) {
  if (!id) {
    const err = new Error('id is required');
    err.status = 400;
    throw err;
  }
  const data = await giphyFetch(`/gifs/${encodeURIComponent(id)}`, {});
  return data;
}

/**
 * Get a random Giphy GIF or sticker.
 */
export async function getRandomGiphy({
  tag,
  type = 'gifs',
  rating = 'g',
} = {}) {
  const key = cacheKey(['random', { tag, type, rating }]);
  const cached = getCached(key);
  if (cached) return cached;

  const data = await giphyFetch('/random', {
    query: {
      tag: tag || undefined,
      type: String(type),
      rating: String(rating),
    },
  });
  setCache(key, data);
  return data;
}

/**
 * Clear the Giphy search cache. Useful when we want to force fresh results.
 */
export function clearGiphyCache() {
  try {
    const keys = Object.keys(sessionStorage);
    for (const key of keys) {
      if (key.startsWith(CACHE_PREFIX)) {
        sessionStorage.removeItem(key);
      }
    }
  } catch {
    // Storage may be disabled.
  }
}

/**
 * Normalize a Giphy search result item to a standard media asset shape.
 */
export function normalizeGiphyItem(item, type = 'gif') {
  const images = item?.images || {};
  const original = images.original || {};
  const preview = images.preview_gif || images.fixed_width_small || {};
  return {
    id: `giphy-${item.id}`,
    type: type === 'stickers' ? 'sticker' : 'gif',
    source: 'giphy',
    provider: 'giphy',
    name: item.title || item.slug || `Giphy ${type} ${item.id}`,
    url: original.url || original.mp4 || '',
    thumbnail: preview.url || original.thumbnail || '',
    width: original.width ? Number(original.width) : undefined,
    height: original.height ? Number(original.height) : undefined,
    duration: type !== 'gifs' ? undefined : (original.mp4 && item.images?.original_mp4?.mp4_size ? Math.round((item.images?.original_mp4?.mp4_size || 0) / 1024) : undefined),
    metadata: {
      giphyId: item.id,
      slug: item.slug,
      rating: item.rating,
      tags: item.tags,
      type,
      user: item.user ? { username: item.user.username, display_name: item.user.display_name } : null,
    },
  };
}

export default {
  searchGiphy,
  getTrendingGiphy,
  getGiphyById,
  getRandomGiphy,
  clearGiphyCache,
  normalizeGiphyItem,
};
