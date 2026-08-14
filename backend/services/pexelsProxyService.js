/**
 * Pexels Proxy Service
 *
 * Express router mounted at /api/pexels.
 *
 * Provides a server-side proxy to the Pexels REST API
 * (https://api.pexels.com) for photos and videos.
 *
 * Auth model
 * ----------
 * This proxy uses a single server-side key (PEXELS_API_KEY) by default so the
 * app can browse stock media centrally without exposing the key in the browser.
 * Callers may also pass a user-scoped key via the `x-pexels-api-key` header
 * to operate on their own Pexels quota — a true hybrid.
 *
 * All responses are forwarded verbatim (unwrapped) so frontend code can
 * consume them directly, matching the documented Pexels shapes.
 */

import express from 'express';
import axios from 'axios';

const router = express.Router();

const PEXELS_BASE_URL = 'https://api.pexels.com/v1';

// Server-side key. Empty string if not configured.
const SERVER_KEY = () => (process.env.PEXELS_API_KEY || '').trim();

/**
 * Resolve the access token for a request:
 *   1. Explicit header `x-pexels-api-key`
 *   2. Server-side PEXELS_API_KEY
 */
function resolveToken(req) {
  const fromHeader = req.header('x-pexels-api-key');
  if (fromHeader && String(fromHeader).trim()) return String(fromHeader).trim();
  const server = SERVER_KEY();
  if (server) return server;
  return null;
}

function clientHeaders(req) {
  const token = resolveToken(req);
  if (!token) {
    const err = new Error(
      'No Pexels API key available. Set PEXELS_API_KEY on the server or pass x-pexels-api-key.'
    );
    err.status = 500;
    throw err;
  }
  return {
    Authorization: token,
  };
}

// Simple retry wrapper for upstream Pexels calls.
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
          console.error(`[pexels-proxy:${requestId}] attempt ${attempt}/${maxAttempts} failed (status=${status || 'network'}) — exhausted`, { upstreamStatus: status, message: err?.message });
        }
        throw err;
      }
      const jitter = Math.random() * baseDelay;
      const delay = Math.min(baseDelay * 2 ** (attempt - 1) + jitter, maxDelay);
      console.warn(`[pexels-proxy:${requestId}] attempt ${attempt}/${maxAttempts} failed (status=${status || 'network'}), retrying in ${Math.round(delay)}ms`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}

// ---- Simple in-memory cache -------------------------------------------------
const CACHE_TTLS = {
  search: 300,        // 5 minutes for search results
  curated: 600,       // 10 minutes for curated/popular
  detail: 3600,       // 1 hour for photo/video details
};

function getCacheTtl(path) {
  if (path.includes('/search')) return CACHE_TTLS.search;
  if (path.includes('/curated') || path.includes('/popular')) return CACHE_TTLS.curated;
  return CACHE_TTLS.detail;
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

async function pexelsRequest(req, method, path, { params, body } = {}) {
  const requestId = req.requestId;
  const token = resolveToken(req);
  const cacheKey = `${method}:${path}:${new URLSearchParams(params || {}).toString()}:${token?.slice(-4) || 'anon'}`;
  const ttl = getCacheTtl(path) * 1000;

  // Try cache first (except for POST/body requests)
  if (method === 'GET') {
    const cached = cacheGet(cacheKey);
    if (cached) {
      console.debug(`[pexels-proxy:${requestId}] cache hit ${path}`);
      return cached;
    }
  }

  const headers = clientHeaders(req);
  const result = await withRetry(async () => {
    const res = await axios({
      method,
      url: `${PEXELS_BASE_URL}${path}`,
      headers,
      params,
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
      const err = new Error(`Pexels ${method.toUpperCase()} ${path} failed (${res.status}): ${detail}`);
      err.status = res.status === 429 ? 429 : (res.status >= 500 ? 502 : 400);
      err.upstreamStatus = res.status;
      throw err;
    }
    // Forward rate-limit headers if present.
    const limit = res.headers['x-ratelimit-limit'];
    const remaining = res.headers['x-ratelimit-remaining'];
    const reset = res.headers['x-ratelimit-reset'];
    const payload = res.data && typeof res.data === 'object' ? res.data : {};
    const result = { ...payload, _rateLimit: limit !== undefined ? { limit, remaining, reset } : undefined };

    // Cache GET responses
    if (method === 'GET') {
      cacheSet(cacheKey, result, ttl);
    }

    return result;
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
      
      // Log successful request with rate-limit info
      const rateInfo = result?._rateLimit;
      if (rateInfo && Number(rateInfo.remaining) < 20) {
        console.warn(`[pexels-proxy:${requestId}] ${method} ${path} rate-limit low: remaining=${rateInfo.remaining} reset=${rateInfo.reset}`);
      }
      console.debug(`[pexels-proxy:${requestId}] ${method} ${path} ${res.statusCode} ${duration}ms remaining=${rateInfo?.remaining ?? '?'}`);
      
      res.json(result);
    } catch (e) {
      const duration = Date.now() - start;
      const status = e.status || 500;
      console.error(`[pexels-proxy:${requestId}] ${method} ${path} failed ${status} ${duration}ms: ${e.message}`);
      res.status(status).json({
        ok: false,
        error: { code: status === 429 ? 'RATE_LIMITED' : (status === 502 ? 'PEXELS_UPSTREAM_ERROR' : 'PEXELS_ERROR'), message: e.message },
        ...(e.upstreamStatus ? { upstreamStatus: e.upstreamStatus } : {}),
      });
    }
  };
}

// ---- Photos ---------------------------------------------------------------

// GET /api/pexels/photos/search?query=nature&orientation=landscape&size=large&color=blue&locale=en-US&page=1&per_page=15
router.get('/photos/search', wrap(async (req, res) => {
  const { query, orientation, size, color, locale, page = '1', per_page = '15' } = req.query;
  if (!query || typeof query !== 'string' || !query.trim()) {
    const err = new Error('query is required for photo search');
    err.status = 400;
    throw err;
  }
  const data = await pexelsRequest(req, 'GET', '/search', {
    params: {
      query: String(query).trim(),
      orientation: orientation ? String(orientation) : undefined,
      size: size ? String(size) : undefined,
      color: color ? String(color) : undefined,
      locale: locale ? String(locale) : undefined,
      page: String(page),
      per_page: Math.min(Number(per_page) || 15, 80),
    },
  });
  return data;
}));

// GET /api/pexels/photos/curated?page=1&per_page=15
router.get('/photos/curated', wrap(async (req, res) => {
  const { page = '1', per_page = '15' } = req.query;
  const data = await pexelsRequest(req, 'GET', '/curated', {
    params: {
      page: String(page),
      per_page: Math.min(Number(per_page) || 15, 80),
    },
  });
  return data;
}));

// GET /api/pexels/photos/:id
router.get('/photos/:id', wrap(async (req, res) => {
  const { id } = req.params;
  if (!id) {
    const err = new Error('photo id is required');
    err.status = 400;
    throw err;
  }
  const data = await pexelsRequest(req, 'GET', `/photos/${encodeURIComponent(id)}`);
  return data;
}));

// ---- Videos ---------------------------------------------------------------

// GET /api/pexels/videos/search?query=nature&orientation=landscape&size=large&locale=en-US&page=1&per_page=15&min_duration=5&max_duration=60&min_width=1920&min_height=1080
router.get('/videos/search', wrap(async (req, res) => {
  const { query, orientation, size, locale, min_duration, max_duration, min_width, min_height, page = '1', per_page = '15' } = req.query;
  if (!query || typeof query !== 'string' || !query.trim()) {
    const err = new Error('query is required for video search');
    err.status = 400;
    throw err;
  }
  const data = await pexelsRequest(req, 'GET', '/videos/search', {
    params: {
      query: String(query).trim(),
      orientation: orientation ? String(orientation) : undefined,
      size: size ? String(size) : undefined,
      locale: locale ? String(locale) : undefined,
      min_duration: min_duration ? Number(min_duration) : undefined,
      max_duration: max_duration ? Number(max_duration) : undefined,
      min_width: min_width ? Number(min_width) : undefined,
      min_height: min_height ? Number(min_height) : undefined,
      page: String(page),
      per_page: Math.min(Number(per_page) || 15, 80),
    },
  });
  return data;
}));

// GET /api/pexels/videos/popular?page=1&per_page=15&min_duration=5&max_duration=60&min_width=1920&min_height=1080
router.get('/videos/popular', wrap(async (req, res) => {
  const { min_duration, max_duration, min_width, min_height, page = '1', per_page = '15' } = req.query;
  const data = await pexelsRequest(req, 'GET', '/videos/popular', {
    params: {
      min_duration: min_duration ? Number(min_duration) : undefined,
      max_duration: max_duration ? Number(max_duration) : undefined,
      min_width: min_width ? Number(min_width) : undefined,
      min_height: min_height ? Number(min_height) : undefined,
      page: String(page),
      per_page: Math.min(Number(per_page) || 15, 80),
    },
  });
  return data;
}));

// GET /api/pexels/videos/:id
router.get('/videos/:id', wrap(async (req, res) => {
  const { id } = req.params;
  if (!id) {
    const err = new Error('video id is required');
    err.status = 400;
    throw err;
  }
  const data = await pexelsRequest(req, 'GET', `/videos/${encodeURIComponent(id)}`);
  return data;
}));

// ---- Collections -----------------------------------------------------------

// GET /api/pexels/collections/featured?page=1&per_page=15
router.get('/collections/featured', wrap(async (req, res) => {
  const { page = '1', per_page = '15' } = req.query;
  const data = await pexelsRequest(req, 'GET', '/collections/featured', {
    params: {
      page: String(page),
      per_page: Math.min(Number(per_page) || 15, 80),
    },
  });
  return data;
}));

// GET /api/pexels/collections?page=1&per_page=15
router.get('/collections', wrap(async (req, res) => {
  const { page = '1', per_page = '15' } = req.query;
  const data = await pexelsRequest(req, 'GET', '/collections', {
    params: {
      page: String(page),
      per_page: Math.min(Number(per_page) || 15, 80),
    },
  });
  return data;
}));

// GET /api/pexels/collections/:id?type=photos&sort=asc&page=1&per_page=15
router.get('/collections/:id', wrap(async (req, res) => {
  const { id } = req.params;
  const { type, sort = 'asc', page = '1', per_page = '15' } = req.query;
  if (!id) {
    const err = new Error('collection id is required');
    err.status = 400;
    throw err;
  }
  const data = await pexelsRequest(req, 'GET', `/collections/${encodeURIComponent(id)}`, {
    params: {
      type: type ? String(type) : undefined,
      sort: sort ? String(sort) : 'asc',
      page: String(page),
      per_page: Math.min(Number(per_page) || 15, 80),
    },
  });
  return data;
}));

// ---- Health ---------------------------------------------------------------

router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    baseUrl: PEXELS_BASE_URL,
    hasServerKey: Boolean(SERVER_KEY()),
  });
});

export default router;
