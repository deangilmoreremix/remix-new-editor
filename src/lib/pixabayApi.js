/**
 * Pixabay API Client
 *
 * Frontend helper for interacting with the backend Pixabay proxy.
 * All calls go to /api/pixabay/... — never directly to pixabay.com.
 *
 * Caching
 * -------
 * Search results are cached in sessionStorage for 5 minutes to reduce
 * redundant proxy calls and improve perceived performance.
 */

import { apiKeyManager } from './apiKeyManager.js';

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes for search results
const CACHE_PREFIX = 'pixabay_cache_';

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

async function pixabayFetch(path, options = {}) {
  const base = (import.meta?.env?.VITE_BACKEND_URL || '').replace(/\/$/, '');
  // Drop unset params: URLSearchParams would send them as the string "undefined".
  const query = options.query
    ? Object.fromEntries(Object.entries(options.query).filter(([, v]) => v !== undefined && v !== null && v !== ''))
    : null;
  const url = `${base}/api/pixabay${path}${query && Object.keys(query).length ? '?' + new URLSearchParams(query).toString() : ''}`;
  const headers = {
    ...(options.headers || {}),
  };
  // BYOK: the user's own Pixabay key (Settings → API keys) when they added one;
  // otherwise the proxy uses the platform key.
  try {
    const userKey = apiKeyManager.getPixabayKey?.();
    if (userKey) headers['x-pixabay-api-key'] = userKey;
  } catch { /* storage blocked: platform key */ }
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
 * Search Pixabay for images.
 *
 * @param {Object} params
 * @param {string} params.query
 * @param {string} [params.orientation] - 'all' | 'horizontal' | 'vertical'
 * @param {number} [params.page=1]
 * @param {number} [params.per_page=15]
 * @param {boolean} [params.safe_search=true]
 * @param {number} [params.min_width]
 * @param {number} [params.min_height]
 * @param {string} [params.category]
 * @param {string} [params.order] - 'popular' | 'latest'
 * @param {string} [params.colors]
 * @returns {Promise<{ hits: Array, total: number, totalHits: number }>}
 */
export async function searchPixabayImages({
  query,
  orientation,
  page = 1,
  per_page = 15,
  safe_search = true,
  min_width,
  min_height,
  category,
  order,
  colors,
  image_type, // 'photo' | 'illustration' | 'vector' | 'all'
} = {}) {
  if (!query || !query.trim()) {
    const err = new Error('query is required for image search');
    err.status = 400;
    throw err;
  }
  const key = cacheKey(['images/search', { query: String(query).trim(), orientation, page, per_page, safe_search, min_width, min_height, category, order, colors, image_type }]);
  const cached = getCached(key);
  if (cached) return cached;

  const data = await pixabayFetch('/images/search', {
    query: {
      query: String(query).trim(),
      orientation: orientation || undefined,
      page: String(page),
      per_page: String(Math.min(per_page, 50)),
      safe_search: safe_search ? 'true' : 'false',
      min_width: min_width || undefined,
      min_height: min_height || undefined,
      category: category || undefined,
      order: order || undefined,
      colors: colors || undefined,
      image_type: image_type || undefined,
    },
  });
  setCache(key, data);
  return data;
}

/**
 * Search Pixabay for videos.
 *
 * @param {Object} params
 * @param {string} params.query
 * @param {string} [params.orientation] - 'all' | 'horizontal' | 'vertical'
 * @param {number} [params.page=1]
 * @param {number} [params.per_page=15]
 * @param {boolean} [params.safe_search=true]
 * @param {number} [params.min_duration]
 * @param {number} [params.max_duration]
 * @param {number} [params.min_width]
 * @param {number} [params.min_height]
 * @param {string} [params.category]
 * @param {string} [params.order] - 'popular' | 'latest'
 * @returns {Promise<{ hits: Array, total: number, totalHits: number }>}
 */
export async function searchPixabayVideos({
  query,
  orientation,
  page = 1,
  per_page = 15,
  safe_search = true,
  min_duration,
  max_duration,
  min_width,
  min_height,
  category,
  order,
  video_type, // 'all' | 'film' | 'animation'
} = {}) {
  if (!query || !query.trim()) {
    const err = new Error('query is required for video search');
    err.status = 400;
    throw err;
  }
  const key = cacheKey(['videos/search', { query: String(query).trim(), orientation, page, per_page, safe_search, min_duration, max_duration, min_width, min_height, category, order, video_type }]);
  const cached = getCached(key);
  if (cached) return cached;

  const data = await pixabayFetch('/videos/search', {
    query: {
      query: String(query).trim(),
      orientation: orientation || undefined,
      page: String(page),
      per_page: String(Math.min(per_page, 50)),
      safe_search: safe_search ? 'true' : 'false',
      min_duration: min_duration || undefined,
      max_duration: max_duration || undefined,
      min_width: min_width || undefined,
      min_height: min_height || undefined,
      category: category || undefined,
      order: order || undefined,
      video_type: video_type || undefined,
    },
  });
  setCache(key, data);
  return data;
}

/**
 * Get curated images from Pixabay.
 */
export async function getCuratedPixabayImages({
  page = 1,
  per_page = 15,
  safe_search = true,
  category,
  order,
  image_type,
} = {}) {
  const key = cacheKey(['images/curated', { page, per_page, safe_search, category, order, image_type }]);
  const cached = getCached(key);
  if (cached) return cached;

  const data = await pixabayFetch('/images/curated', {
    query: {
      page: String(page),
      per_page: String(Math.min(per_page, 50)),
      safe_search: safe_search ? 'true' : 'false',
      category: category || undefined,
      order: order || undefined,
      image_type: image_type || undefined,
    },
  });
  setCache(key, data);
  return data;
}

/**
 * Get popular videos from Pixabay.
 */
export async function getPopularPixabayVideos({
  page = 1,
  per_page = 15,
  safe_search = true,
  min_duration,
  max_duration,
  min_width,
  min_height,
  category,
  order,
  video_type,
} = {}) {
  const key = cacheKey(['videos/popular', { page, per_page, safe_search, min_duration, max_duration, min_width, min_height, category, order, video_type }]);
  const cached = getCached(key);
  if (cached) return cached;

  const data = await pixabayFetch('/videos/popular', {
    query: {
      page: String(page),
      per_page: String(Math.min(per_page, 50)),
      safe_search: safe_search ? 'true' : 'false',
      min_duration: min_duration || undefined,
      max_duration: max_duration || undefined,
      min_width: min_width || undefined,
      min_height: min_height || undefined,
      category: category || undefined,
      order: order || undefined,
      video_type: video_type || undefined,
    },
  });
  setCache(key, data);
  return data;
}

/**
 * Clear the Pixabay search cache. Useful when we want to force fresh results.
 */
export function clearPixabayCache() {
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

export default {
  searchPixabayImages,
  searchPixabayVideos,
  getCuratedPixabayImages,
  getPopularPixabayVideos,
  clearPixabayCache,
};
