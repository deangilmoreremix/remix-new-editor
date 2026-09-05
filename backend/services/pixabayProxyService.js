/**
 * Pixabay Proxy Service
 *
 * Express router mounted at /api/pixabay.
 *
 * Provides a server-side proxy to the Pixabay REST API
 * (https://pixabay.com/api) for images and videos.
 *
 * Auth model
 * ----------
 * This proxy uses a single server-side key (PIXABAY_API_KEY) so the
 * app can browse stock media centrally without exposing the key in the browser.
 *
 * All responses are forwarded verbatim (unwrapped) so frontend code can
 * consume them directly, matching the documented Pixabay shapes.
 */

import express from 'express';
import axios from 'axios';

const router = express.Router();

const PIXABAY_BASE_URL = 'https://pixabay.com/api';

// Server-side key. Empty string if not configured.
const SERVER_KEY = () => (process.env.PIXABAY_API_KEY || '').trim();

/**
 * Resolve the access token for a request:
 *   1. Server-side PIXABAY_API_KEY
 */
function resolveToken(req) {
  const server = SERVER_KEY();
  if (server) return server;
  return null;
}

function clientHeaders(req) {
  const token = resolveToken(req);
  if (!token) {
    const err = new Error(
      'No Pixabay API key available. Set PIXABAY_API_KEY on the server.'
    );
    err.status = 500;
    throw err;
  }
  return {
    // Pixabay uses query param key, not header auth
  };
}

// Simple retry wrapper for upstream Pixabay calls.
// baseDelay=500ms, maxDelay=8000ms, factor=2, jitter=true, maxAttempts=2.
// Only retries on: network errors, 429, 5xx.
async function withRetry(fn, { maxAttempts = 2, baseDelay = 500, maxDelay = 8000 } = {}, requestId) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const status = err?.upstreamStatus || err?.status;
      const isNetwork = !err?.status && !err?.upstreamStatus && !err?.response;
      const retryable = isNetwork || status === 429 || (typeof status === 'number' && status >= 500);
      if (!retryable || attempt === maxAttempts) {
        if (attempt > 1) {
          console.error(`[pixabay-proxy:${requestId}] attempt ${attempt}/${maxAttempts} failed (status=${status || 'network'}) — exhausted`, { upstreamStatus: status, message: err?.message });
        }
        throw err;
      }
      const jitter = Math.random() * baseDelay;
      const delay = Math.min(baseDelay * 2 ** (attempt - 1) + jitter, maxDelay);
      console.warn(`[pixabay-proxy:${requestId}] attempt ${attempt}/${maxAttempts} failed (status=${status || 'network'}), retrying in ${Math.round(delay)}ms`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}

// ---- Simple in-memory cache -------------------------------------------------
const CACHE_TTLS = {
  search: 300,        // 5 minutes for search results
  curated: 600,       // 10 minutes for curated/popular
};

function getCacheTtl(path) {
  if (path.includes('/search')) return CACHE_TTLS.search;
  if (path.includes('/curated') || path.includes('/popular')) return CACHE_TTLS.curated;
  return 300;
}

const cache = new Map();

function cacheGet(key) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }
  return entry.value;
}

function cacheSet(key, value, ttlMs) {
  cache.set(key, { value, expiresAt: Date.now() + ttlMs });
  // Prune if cache grows too large
  if (cache.size > 500) {
    const oldest = [...cache.entries()].sort((a, b) => a[1].expiresAt - b[1].expiresAt).slice(0, 100);
    oldest.forEach(([k]) => cache.delete(k));
  }
}

async function pixabayRequest(req, method, path, { params, body } = {}) {
  const requestId = req.requestId;
  const token = resolveToken(req);
  const cacheKey = `${method}:${path}:${new URLSearchParams(params || {}).toString()}:${token?.slice(-4) || 'anon'}`;
  const ttl = getCacheTtl(path) * 1000;

  // Try cache first (except for POST/body requests)
  if (method === 'GET') {
    const cached = cacheGet(cacheKey);
    if (cached) {
      console.debug(`[pixabay-proxy:${requestId}] cache hit ${path}`);
      return cached;
    }
  }

  const headers = clientHeaders(req);
  const apiKey = token;

  const result = await withRetry(async () => {
    const url = `${PIXABAY_BASE_URL}${path}`;
    const res = await axios({
      method,
      url,
      headers: {
        ...headers,
      },
      params: {
        ...params,
        key: apiKey,
      },
      data: body,
      timeout: 30000,
      validateStatus: () => true,
    });
    if (res.status < 200 || res.status >= 300) {
      const rawDetail =
        (res.data && (res.data.message || JSON.stringify(res.data))) ||
        res.statusText ||
        `HTTP ${res.status}`;
      const detail = rawDetail.replace(/:\/\/[^\s]*/g, '[redacted]').replace(/\\[^\s:]+/g, '[redacted]');
      const err = new Error(`Pixabay ${method.toUpperCase()} ${path} failed (${res.status}): ${detail}`);
      err.status = res.status === 429 ? 429 : (res.status >= 500 ? 502 : 400);
      err.upstreamStatus = res.status;
      throw err;
    }
    const payload = res.data && typeof res.data === 'object' ? res.data : {};

    // Cache GET responses
    if (method === 'GET') {
      cacheSet(cacheKey, payload, ttl);
    }

    return payload;
  }, {}, requestId);

  return result;
}

function wrap(handler) {
  return async (req, res) => {
    const start = Date.now();
    const requestId = req.requestId;
    const method = req.method;
    const path = req.path;
    try {
      const result = await handler(req, res);
      const duration = Date.now() - start;
      // If the handler returned something, forward it. Otherwise assume it
      // already called res.json / res.send.
      if (res.writableEnded) return;

      // Add Cache-Control based on endpoint type
      const ttl = getCacheTtl(path);
      res.set('Cache-Control', `public, max-age=${ttl}`);

      console.debug(`[pixabay-proxy:${requestId}] ${method} ${path} ${res.statusCode} ${duration}ms`);

      res.json(result);
    } catch (e) {
      const duration = Date.now() - start;
      const status = e.status || 500;
      console.error(`[pixabay-proxy:${requestId}] ${method} ${path} failed ${status} ${duration}ms: ${e.message}`);
      res.status(status).json({
        ok: false,
        error: { code: status === 429 ? 'RATE_LIMITED' : (status === 502 ? 'PIXABAY_UPSTREAM_ERROR' : 'PIXABAY_ERROR'), message: e.message },
        ...(e.upstreamStatus ? { upstreamStatus: e.upstreamStatus } : {}),
      });
    }
  };
}

// ---- Images ---------------------------------------------------------------

// GET /api/pixabay/images/search?query=nature&orientation=horizontal&page=1&per_page=15&safe_search=true
router.get('/images/search', wrap(async (req, res) => {
  const { query, orientation, page = '1', per_page = '15', safe_search = 'true', min_width, min_height, editors_choice, category, order, colors } = req.query;
  if (!query || typeof query !== 'string' || !query.trim()) {
    const err = new Error('query is required for image search');
    err.status = 400;
    throw err;
  }
  const data = await pixabayRequest(req, 'GET', '/api', {
    params: {
      q: String(query).trim(),
      image_type: 'photo',
      orientation: orientation ? String(orientation) : undefined,
      page: String(page),
      per_page: Math.min(Number(per_page) || 15, 50),
      safesearch: safe_search === 'true' ? 'true' : 'false',
      min_width: min_width ? Number(min_width) : undefined,
      min_height: min_height ? Number(min_height) : undefined,
      editors_choice: editors_choice === 'true' ? 'true' : undefined,
      category: category ? String(category) : undefined,
      order: order ? String(order) : undefined,
      colors: colors ? String(colors) : undefined,
    },
  });
  return data;
}));

// GET /api/pixabay/images/curated?page=1&per_page=15
router.get('/images/curated', wrap(async (req, res) => {
  const { page = '1', per_page = '15', safe_search = 'true', editors_choice, category, order } = req.query;
  const data = await pixabayRequest(req, 'GET', '/api', {
    params: {
      image_type: 'photo',
      page: String(page),
      per_page: Math.min(Number(per_page) || 15, 50),
      safesearch: safe_search === 'true' ? 'true' : 'false',
      editors_choice: editors_choice === 'true' ? 'true' : undefined,
      category: category ? String(category) : undefined,
      order: order ? String(order) : undefined,
    },
  });
  return data;
}));

// ---- Videos ---------------------------------------------------------------

// GET /api/pixabay/videos/search?query=nature&orientation=horizontal&page=1&per_page=15&safe_search=true&min_duration=5&max_duration=60
router.get('/videos/search', wrap(async (req, res) => {
  const { query, orientation, page = '1', per_page = '15', safe_search = 'true', min_duration, max_duration, min_width, min_height, category, order } = req.query;
  if (!query || typeof query !== 'string' || !query.trim()) {
    const err = new Error('query is required for video search');
    err.status = 400;
    throw err;
  }
  const data = await pixabayRequest(req, 'GET', '/api/videos/', {
    params: {
      q: String(query).trim(),
      orientation: orientation ? String(orientation) : undefined,
      page: String(page),
      per_page: Math.min(Number(per_page) || 15, 50),
      safesearch: safe_search === 'true' ? 'true' : 'false',
      min_duration: min_duration ? Number(min_duration) : undefined,
      max_duration: max_duration ? Number(max_duration) : undefined,
      min_width: min_width ? Number(min_width) : undefined,
      min_height: min_height ? Number(min_height) : undefined,
      category: category ? String(category) : undefined,
      order: order ? String(order) : undefined,
    },
  });
  return data;
}));

// GET /api/pixabay/videos/popular?page=1&per_page=15
router.get('/videos/popular', wrap(async (req, res) => {
  const { page = '1', per_page = '15', safe_search = 'true', min_duration, max_duration, min_width, min_height, category, order } = req.query;
  const data = await pixabayRequest(req, 'GET', '/api/videos/', {
    params: {
      video_type: 'film',
      page: String(page),
      per_page: Math.min(Number(per_page) || 15, 50),
      safesearch: safe_search === 'true' ? 'true' : 'false',
      min_duration: min_duration ? Number(min_duration) : undefined,
      max_duration: max_duration ? Number(max_duration) : undefined,
      min_width: min_width ? Number(min_width) : undefined,
      min_height: min_height ? Number(min_height) : undefined,
      category: category ? String(category) : undefined,
      order: order ? String(order) : undefined,
    },
  });
  return data;
}));

// ---- Health ---------------------------------------------------------------
router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    baseUrl: PIXABAY_BASE_URL,
    hasServerKey: Boolean(SERVER_KEY()),
  });
});

export default router;
