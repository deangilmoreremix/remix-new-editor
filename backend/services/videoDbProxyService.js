/**
 * VideoDB Proxy Service
 *
 * Express router mounted at /api/videodb.
 *
 * Provides a server-side proxy to the VideoDB Server API (https://api.videodb.io)
 * for the four studios that depend on VideoDB:
 *   - Timeline Editor  (index / retrieve media shown on the timeline)
 *   - Video Agent      (semantic search & pull source videos)
 *   - Render Studio    (resolve a VideoDB media id to a streamable URL)
 *   - Director         (semantic video search & retrieval backend)
 *
 * Auth model
 * ---------
 * This proxy uses a single server-side key (VIDEO_DB_API_KEY) by default so the
 * app can own/index media centrally and deploy cleanly on Render without every
 * user supplying a token. Callers may also pass a user-scoped token via the
 * `x-access-token` header (or `?accessToken=`) to operate on that user's own
 * VideoDB account — a true hybrid. The browser-side videoDb.js client keeps a
 * direct-call fallback when no server proxy is reachable.
 *
 * Every observable shape below mirrors the documented VideoDB REST responses
 * (data payload is unwrapped to `data` and forwarded), so frontend code that
 * already consumes `src/lib/videoDb.js` works unchanged.
 */

import express from 'express';
import axios from 'axios';

const router = express.Router();

const VIDEODB_BASE_URL = (
  process.env.VIDEO_DB_BASE_URL || 'https://api.videodb.io'
).replace(/\/$/, '');
const DEFAULT_COLLECTION = process.env.VIDEO_DB_DEFAULT_COLLECTION || 'default';

// Server-side key. May be empty at boot — routes then require a caller-supplied
// token (x-access-token) and return 400 otherwise, rather than failing silently.
const SERVER_KEY = () => (process.env.VIDEO_DB_API_KEY || '').trim();

/**
 * Resolve the access token for a request:
 *   1. Explicit header `x-access-token`
 *   2. Query param `accessToken`
 *   3. Server-side VIDEO_DB_API_KEY
 */
function resolveToken(req) {
  const fromHeader = req.header('x-access-token');
  if (fromHeader && String(fromHeader).trim()) return String(fromHeader).trim();
  const fromQuery = req.query.accessToken;
  if (fromQuery && String(fromQuery).trim()) return String(fromQuery).trim();
  const server = SERVER_KEY();
  if (server) return server;
  return null;
}

function clientHeaders(req, { token: overrideToken } = {}) {
  const token = (overrideToken && String(overrideToken).trim()) || resolveToken(req);
  if (!token) {
    const err = new Error(
      'No VideoDB access token available. Set VIDEO_DB_API_KEY on the server or pass x-access-token.'
    );
    err.status = 400;
    throw err;
  }
  return {
    'Content-Type': 'application/json',
    'x-access-token': token,
  };
}

// Unwrap the VideoDB envelope: responses are { status, data } and we forward
// `data`. Never assume success — propagate non-2xx as errors.
async function videodbRequest(req, method, path, { params, body, token } = {}) {
  const headers = clientHeaders(req, { token });
  try {
    const res = await axios({
      method,
      url: `${VIDEODB_BASE_URL}${path}`,
      headers,
      params,
      data: body,
      timeout: 60000,
      // We handle non-2xx manually to surface VideoDB's error body.
      validateStatus: () => true,
    });
    if (res.status < 200 || res.status >= 300) {
      const detail =
        (res.data && (res.data.message || JSON.stringify(res.data))) ||
        res.statusText ||
        `HTTP ${res.status}`;
      const err = new Error(`VideoDB ${method.toUpperCase()} ${path} failed (${res.status}): ${detail}`);
      err.status = res.status >= 500 ? 502 : 400;
      err.upstreamStatus = res.status;
      throw err;
    }
    const payload = res.data && typeof res.data === 'object' ? res.data : {};
    return payload.data !== undefined ? payload.data : payload;
  } catch (e) {
    if (e.status) throw e;
    // Network / timeout errors
    const err = new Error(`VideoDB request error: ${e.message}`);
    err.status = 502;
    throw err;
  }
}

function collectionId(req) {
  return (req.params.collectionId || req.body?.collectionId || req.query.collectionId || DEFAULT_COLLECTION);
}

function wrap(handler) {
  return async (req, res) => {
    try {
      const data = await handler(req, res);
      res.json({ status: 'success', data });
    } catch (e) {
      const status = e.status || 500;
      res.status(status).json({
        status: 'error',
        error: { code: status === 502 ? 'VIDEODB_UPSTREAM_ERROR' : 'VIDEODB_ERROR', message: e.message },
      });
    }
  };
}

// ---- Health / capability ---------------------------------------------------

router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    baseUrl: VIDEODB_BASE_URL,
    hasServerKey: Boolean(SERVER_KEY()),
    defaultCollection: DEFAULT_COLLECTION,
  });
});

// ---- Collections -----------------------------------------------------------

// GET /api/videodb/collections
router.get('/collections', wrap(async (req) => {
  return await videodbRequest(req, 'GET', '/collection');
}));

// GET /api/videodb/collections/:collectionId
router.get('/collections/:collectionId', wrap(async (req) => {
  const id = collectionId(req);
  return await videodbRequest(req, 'GET', `/collection/${encodeURIComponent(id)}`);
}));

// POST /api/videodb/collections  { name, description }
router.post('/collections', wrap(async (req) => {
  const { name, description = '' } = req.body || {};
  if (!name) {
    const err = new Error('name is required to create a collection');
    err.status = 400;
    throw err;
  }
  return await videodbRequest(req, 'POST', '/collection', {
    body: { name, description },
  });
}));

// ---- Upload / index --------------------------------------------------------

// POST /api/videodb/collections/:collectionId/upload
// Body: { url, name, media_type }  (media_type: video | audio | image)
router.post('/collections/:collectionId/upload', wrap(async (req) => {
  const id = collectionId(req);
  const { url, name, mediaType = 'video' } = req.body || {};
  if (!url) {
    const err = new Error('url is required to index media');
    err.status = 400;
    throw err;
  }
  return await videodbRequest(req, 'POST', `/collection/${encodeURIComponent(id)}/upload`, {
    body: { url, name, media_type: mediaType },
  });
}));

// ---- Search ----------------------------------------------------------------

// POST /api/videodb/collections/:collectionId/search
// Body: { query, index_type, search_type, result_threshold }
router.post('/collections/:collectionId/search', wrap(async (req) => {
  const id = collectionId(req);
  const {
    query,
    indexType = 'scene',
    searchType = 'semantic',
    resultThreshold = 10,
  } = req.body || {};
  if (!query) {
    const err = new Error('query is required for semantic search');
    err.status = 400;
    throw err;
  }
  return await videodbRequest(req, 'POST', `/collection/${encodeURIComponent(id)}/search/`, {
    body: {
      query,
      index_type: indexType,
      search_type: searchType,
      result_threshold: resultThreshold,
    },
  });
}));

// POST /api/videodb/videos/:videoId/search
// Body: { query, index_type, search_type, result_threshold }
router.post('/videos/:videoId/search', wrap(async (req) => {
  const { videoId } = req.params;
  const {
    query,
    indexType = 'scene',
    searchType = 'semantic',
    resultThreshold = 10,
  } = req.body || {};
  if (!query) {
    const err = new Error('query is required for video search');
    err.status = 400;
    throw err;
  }
  return await videodbRequest(req, 'POST', `/video/${encodeURIComponent(videoId)}/search/`, {
    body: {
      query,
      index_type: indexType,
      search_type: searchType,
      result_threshold: resultThreshold,
    },
  });
}));

// ---- Stream / resolve ------------------------------------------------------

// POST /api/videodb/videos/:videoId/stream  { format: hls|mp4|webm }
// Render Studio + Timeline use this to turn a media id into a playable URL.
router.post('/videos/:videoId/stream', wrap(async (req) => {
  const { videoId } = req.params;
  const { format = 'hls' } = req.body || {};
  const data = await videodbRequest(req, 'POST', `/video/${encodeURIComponent(videoId)}/stream/`, {
    body: { format },
  });
  // Normalize to a single stream_url for callers.
  const streamUrl = data?.stream_url || data?.player_url || null;
  return { ...data, stream_url: streamUrl };
}));

// GET /api/videodb/videos/:videoId/stream  (convenience GET for Render Studio
// deep links that only carry a query string, e.g. ?videoId=m-xxx&format=mp4)
router.get('/videos/:videoId/stream', wrap(async (req) => {
  const { videoId } = req.params;
  const { format = 'hls' } = req.query;
  const data = await videodbRequest(req, 'POST', `/video/${encodeURIComponent(videoId)}/stream/`, {
    body: { format },
  });
  const streamUrl = data?.stream_url || data?.player_url || null;
  return { ...data, stream_url: streamUrl };
}));

// GET /api/videodb/videos/:videoId  — metadata for a single media item.
router.get('/videos/:videoId', wrap(async (req) => {
  const { videoId } = req.params;
  return await videodbRequest(req, 'GET', `/video/${encodeURIComponent(videoId)}`);
}));

// ---- Catch-all proxy route --------------------------------------------------
// The DirectorPage client (and any other feature) can hit POST /api/videodb/proxy
// with { endpoint, method, body, videoDbKey } and we forward the call to
// api.videodb.io server-side. This is the path that the browser-side
// `src/lib/videoDb.js` falls back to when the proxy is reachable, and it
// matches the shape that Director uses to call any VideoDB endpoint
// (compile-timeline, search/, upload, etc.) without needing a dedicated
// route per endpoint.
router.post('/proxy', wrap(async (req) => {
  const { endpoint, method = 'POST', body = null, videoDbKey: userKey } = req.body || {};
  if (!endpoint || typeof endpoint !== 'string') {
    const err = new Error('endpoint is required');
    err.status = 400;
    throw err;
  }
  // Reject obviously bad paths to prevent SSRF / path traversal.
  if (endpoint.startsWith('http://') || endpoint.startsWith('https://') || endpoint.includes('..')) {
    const err = new Error('endpoint must be a relative VideoDB path');
    err.status = 400;
    throw err;
  }
  // Normalize to a leading slash so we always build `https://api.videodb.io/path`
  // regardless of whether the caller passed `health` or `/health`.
  const path = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  // If a user-supplied key is in the body, pass it as a direct token override.
  // Do NOT clone the Express req — spreading strips methods like `req.header()`
  // and breaks the non-override path too.
  const token = userKey ? String(userKey).trim() : undefined;
  return await videodbRequest(req, method, path, { body, token });
}));

// ---- Convenience composite for the four studios ----------------------------

// POST /api/videodb/resolve  { videoId, format }
// Returns { streamUrl, video } so Render/Timeline get both the playable URL
// and the underlying metadata in one call.
router.post('/resolve', wrap(async (req) => {
  const { videoId, format = 'hls' } = req.body || {};
  if (!videoId) {
    const err = new Error('videoId is required to resolve media');
    err.status = 400;
    throw err;
  }
  const [video, stream] = await Promise.all([
    videodbRequest(req, 'GET', `/video/${encodeURIComponent(videoId)}`).catch(() => null),
    videodbRequest(req, 'POST', `/video/${encodeURIComponent(videoId)}/stream/`, {
      body: { format },
    }).catch(() => null),
  ]);
  const streamUrl = stream?.stream_url || stream?.player_url || null;
  return { videoId, video, streamUrl };
}));

export default router;
export { router as videoDbProxyService };
