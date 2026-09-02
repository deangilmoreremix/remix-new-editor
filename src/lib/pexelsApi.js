/**
 * Pexels API Client
 *
 * Frontend helper for interacting with the backend Pexels proxy.
 * All calls go to /api/pexels/... — never directly to api.pexels.com.
 *
 * If the user has configured a personal Pexels API key in Settings,
 * it is forwarded via the `x-pexels-api-key` header so the backend
 * proxy can use their quota instead of the shared server key.
 *
 * Caching
 * -------
 * Search results are cached in sessionStorage for 5 minutes to reduce
 * redundant proxy calls and improve perceived performance.
 */

import { apiKeyManager } from './apiKeyManager.js';

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes for search results
const CACHE_PREFIX = 'pexels_cache_';

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

async function pexelsFetch(path, options = {}) {
  const base = (import.meta?.env?.VITE_BACKEND_URL || '').replace(/\/$/, '');
  const url = `${base}/api/pexels${path}${options.query ? '?' + new URLSearchParams(options.query).toString() : ''}`;
  const headers = {
    ...(options.headers || {}),
  };
  // Forward the user's personal Pexels key if they have one configured.
  const userPexelsKey = apiKeyManager.getPexelsKey?.();
  if (userPexelsKey) {
    headers['x-pexels-api-key'] = userPexelsKey;
  }
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

export async function searchPhotos({ query, orientation, size, color, locale, page = 1, per_page = 15 } = {}) {
  if (!query || !query.trim()) {
    const err = new Error('query is required for photo search');
    err.status = 400;
    throw err;
  }
  const key = cacheKey(['photos/search', { query: String(query).trim(), orientation, size, color, locale, page, per_page }]);
  const cached = getCached(key);
  if (cached) return cached;

  const data = await pexelsFetch('/photos/search', {
    query: { query: String(query).trim(), orientation, size, color, locale, page, per_page },
  });
  setCache(key, data);
  return data;
}

export async function searchVideos({ query, orientation, size, locale, min_duration, max_duration, min_width, min_height, page = 1, per_page = 15 } = {}) {
  if (!query || !query.trim()) {
    const err = new Error('query is required for video search');
    err.status = 400;
    throw err;
  }
  const key = cacheKey(['videos/search', { query: String(query).trim(), orientation, size, locale, min_duration, max_duration, min_width, min_height, page, per_page }]);
  const cached = getCached(key);
  if (cached) return cached;

  const data = await pexelsFetch('/videos/search', {
    query: { query: String(query).trim(), orientation, size, locale, min_duration, max_duration, min_width, min_height, page, per_page },
  });
  setCache(key, data);
  return data;
}

export async function getCuratedPhotos({ page = 1, per_page = 15 } = {}) {
  const key = cacheKey(['photos/curated', { page, per_page }]);
  const cached = getCached(key);
  if (cached) return cached;

  const data = await pexelsFetch('/photos/curated', {
    query: { page, per_page },
  });
  setCache(key, data);
  return data;
}

export async function getPopularVideos({ min_duration, max_duration, min_width, min_height, page = 1, per_page = 15 } = {}) {
  const key = cacheKey(['videos/popular', { min_duration, max_duration, min_width, min_height, page, per_page }]);
  const cached = getCached(key);
  if (cached) return cached;

  const data = await pexelsFetch('/videos/popular', {
    query: { min_duration, max_duration, min_width, min_height, page, per_page },
  });
  setCache(key, data);
  return data;
}

export async function getFeaturedCollections({ page = 1, per_page = 15 } = {}) {
  const key = cacheKey(['collections/featured', { page, per_page }]);
  const cached = getCached(key);
  if (cached) return cached;

  const data = await pexelsFetch('/collections/featured', {
    query: { page, per_page },
  });
  setCache(key, data);
  return data;
}

export async function getMyCollections({ page = 1, per_page = 15 } = {}) {
  const key = cacheKey(['collections', { page, per_page }]);
  const cached = getCached(key);
  if (cached) return cached;

  const data = await pexelsFetch('/collections', {
    query: { page, per_page },
  });
  setCache(key, data);
  return data;
}

export async function getCollectionMedia(collectionId, { type, sort = 'asc', page = 1, per_page = 15 } = {}) {
  if (!collectionId) {
    const err = new Error('collectionId is required');
    err.status = 400;
    throw err;
  }
  const key = cacheKey(['collections/media', { collectionId, type, sort, page, per_page }]);
  const cached = getCached(key);
  if (cached) return cached;

  const data = await pexelsFetch(`/collections/${encodeURIComponent(collectionId)}`, {
    query: { type, sort, page, per_page },
  });
  setCache(key, data);
  return data;
}

export async function getPhoto(id) {
  if (!id) {
    const err = new Error('photo id is required');
    err.status = 400;
    throw err;
  }
  const data = await pexelsFetch(`/photos/${encodeURIComponent(id)}`);
  return data;
}

export async function getVideo(id) {
  if (!id) {
    const err = new Error('video id is required');
    err.status = 400;
    throw err;
  }
  const data = await pexelsFetch(`/videos/${encodeURIComponent(id)}`);
  return data;
}

/**
 * Clear the Pexels search cache. Useful when the user changes their
 * Pexels API key or when we want to force fresh results.
 */
export function clearPexelsCache() {
  try {
    const keys = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const k = sessionStorage.key(i);
      if (k && k.startsWith(CACHE_PREFIX)) keys.push(k);
    }
    keys.forEach(k => sessionStorage.removeItem(k));
  } catch {
    // ignore
  }
}
