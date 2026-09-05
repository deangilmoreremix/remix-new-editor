/**
 * Giphy Proxy Service
 *
 * Express router mounted at /api/giphy.
 *
 * Provides a server-side proxy to the Giphy REST API
 * (https://developers.giphy.com/docs/api/) for GIFs and stickers.
 *
 * Auth model
 * ----------
 * This proxy uses a single server-side key (GIPHY_API_KEY) so the
 * app can browse stock media centrally without exposing the key in the browser.
 *
 * All responses are forwarded verbatim (unwrapped) so frontend code can
 * consume them directly, matching the documented Giphy shapes.
 */

import express from 'express';
import axios from 'axios';

const router = express.Router();

const GIPHY_BASE_URL = 'https://api.giphy.com/v1';

// Server-side key. Empty string if not configured.
const SERVER_KEY = () => (process.env.GIPHY_API_KEY || '').trim();

/**
 * Resolve the access token for a request:
 *   1. Server-side GIPHY_API_KEY
 */
function resolveToken(req) {
  const server = SERVER_KEY();
  if (server) return server;
  return null;
}

// Simple retry wrapper for upstream Giphy calls.
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
          console.error(`[giphy-proxy:${requestId}] attempt ${attempt}/${maxAttempts} failed (status=${status || 'network'}) — exhausted`, { upstreamStatus: status, message: err?.message });
        }
        throw err;
      }
      const jitter = Math.random() * baseDelay;
      const delay = Math.min(baseDelay * 2 ** (attempt - 1) + jitter, maxDelay);
      console.warn(`[giphy-proxy:${requestId}] attempt ${attempt}/${maxAttempts} failed (status=${status || 'network'}), retrying in ${Math.round(delay)}ms`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}

// ---- Simple in-memory cache -------------------------------------------------
const CACHE_TTLS = {
  search: 300,        // 5 minutes for search results
  trending: 600,      // 10 minutes for trending
};

function getCacheTtl(path) {
  if (path.includes('/search')) return CACHE_TTLS.search;
  if (path.includes('/trending') || path.includes('/gifs/trending')) return CACHE_TTLS.trending;
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

async function giphyRequest(req, method, path, { params } = {}) {
  const requestId = req.requestId;
  const apiKey = resolveToken(req);
  const cacheKey = `${method}:${path}:${new URLSearchParams(params || {}).toString()}:${apiKey?.slice(-4) || 'anon'}`;
  const ttl = getCacheTtl(path) * 1000;

  if (method === 'GET') {
    const cached = cacheGet(cacheKey);
    if (cached) {
      console.debug(`[giphy-proxy:${requestId}] cache hit ${path}`);
      return cached;
    }
  }

  const result = await withRetry(async () => {
    const url = `${GIPHY_BASE_URL}${path}`;
    const res = await axios({
      method,
      url,
      params: {
        ...params,
        api_key: apiKey,
      },
      timeout: 30000,
      validateStatus: () => true,
    });
    if (res.status < 200 || res.status >= 300) {
      const rawDetail =
        (res.data && (res.data.message || JSON.stringify(res.data))) ||
        res.statusText ||
        `HTTP ${res.status}`;
      const detail = rawDetail.replace(/:\/\/[^\s]*/g, '[redacted]').replace(/\\[^\s:]+/g, '[redacted]');
      const err = new Error(`Giphy ${method.toUpperCase()} ${path} failed (${res.status}): ${detail}`);
      err.status = res.status === 429 ? 429 : (res.status >= 500 ? 502 : 400);
      err.upstreamStatus = res.status;
      throw err;
    }
    const payload = res.data && typeof res.data === 'object' ? res.data : {};

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
      if (res.writableEnded) return;

      const ttl = getCacheTtl(path);
      res.set('Cache-Control', `public, max-age=${ttl}`);

      console.debug(`[giphy-proxy:${requestId}] ${method} ${path} ${res.statusCode} ${duration}ms`);

      res.json(result);
    } catch (e) {
      const duration = Date.now() - start;
      const status = e.status || 500;
      console.error(`[giphy-proxy:${requestId}] ${method} ${path} failed ${status} ${duration}ms: ${e.message}`);
      res.status(status).json({
        ok: false,
        error: { code: status === 429 ? 'RATE_LIMITED' : (status === 502 ? 'GIPHY_UPSTREAM_ERROR' : 'GIPHY_ERROR'), message: e.message },
        ...(e.upstreamStatus ? { upstreamStatus: e.upstreamStatus } : {}),
      });
    }
  };
}

// ---- Search ---------------------------------------------------------------

// GET /api/giphy/search?q=cat&type=gifs&limit=15&offset=0&rating=g
router.get('/search', wrap(async (req, res) => {
  const { q, type = 'gifs', limit = '15', offset = '0', rating = 'g', lang } = req.query;
  if (!q || typeof q !== 'string' || !q.trim()) {
    const err = new Error('q is required for search');
    err.status = 400;
    throw err;
  }
  const data = await giphyRequest(req, 'GET', '/gifs/search', {
    params: {
      q: String(q).trim(),
      type: String(type),
      limit: Math.min(Number(limit) || 15, 50),
      offset: Number(offset) || 0,
      rating: String(rating),
      lang: lang ? String(lang) : undefined,
    },
  });
  return data;
}));

// GET /api/giphy/trending?type=gifs&limit=15&offset=0&rating=g
router.get('/trending', wrap(async (req, res) => {
  const { type = 'gifs', limit = '15', offset = '0', rating = 'g', lang } = req.query;
  const data = await giphyRequest(req, 'GET', '/gifs/trending', {
    params: {
      type: String(type),
      limit: Math.min(Number(limit) || 15, 50),
      offset: Number(offset) || 0,
      rating: String(rating),
      lang: lang ? String(lang) : undefined,
    },
  });
  return data;
}));

// GET /api/giphy/gifs/:id
router.get('/gifs/:id', wrap(async (req, res) => {
  const { id } = req.params;
  if (!id) {
    const err = new Error('gif id is required');
    err.status = 400;
    throw err;
  }
  const data = await giphyRequest(req, 'GET', `/gifs/${encodeURIComponent(id)}`, {
    params: {},
  });
  return data;
}));

// GET /api/giphy/random?tag=cat&rating=g
router.get('/random', wrap(async (req, res) => {
  const { tag, type = 'gifs', rating = 'g' } = req.query;
  const data = await giphyRequest(req, 'GET', '/gifs/random', {
    params: {
      tag: tag ? String(tag) : undefined,
      type: String(type),
      rating: String(rating),
    },
  });
  return data;
}));

// ---- Health ---------------------------------------------------------------
router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    baseUrl: GIPHY_BASE_URL,
    hasServerKey: Boolean(SERVER_KEY()),
  });
});

export default router;
