/**
 * Shared server-side proxy for the stock media APIs (Pixabay, Pexels),
 * used by netlify/functions/pixabay.js and netlify/functions/pexels.js.
 *
 * Mirrors the Express routers in backend/services/pixabayProxyService.js
 * and backend/services/pexelsProxyService.js route-for-route, so the
 * frontend clients (src/lib/pixabayApi.js → /api/pixabay/*,
 * src/lib/pexelsApi.js → /api/pexels/*) work unchanged on Netlify, with no
 * separate backend server. API keys stay server-side (Netlify env vars).
 */

const TIMEOUT_MS = 30_000;

export const json = (statusCode, body, extraHeaders = {}) => ({
  statusCode,
  headers: {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, x-pexels-api-key, x-pixabay-api-key',
    ...extraHeaders,
  },
  body: JSON.stringify(body),
});

export const httpError = (status, code, message) => Object.assign(new Error(message), { status, code });

/** Strip the function prefix: "/.netlify/functions/pexels/videos/search" or "/api/pexels/videos/search" → "videos/search". */
export function routePath(eventPath, name) {
  const path = String(eventPath || '').split('?')[0];
  const markers = [`/.netlify/functions/${name}`, `/api/${name}`];
  for (const m of markers) {
    const i = path.indexOf(m);
    if (i >= 0) return path.slice(i + m.length).replace(/^\/+|\/+$/g, '');
  }
  return path.replace(/^\/+|\/+$/g, '');
}

/** Drop undefined / null / '' and stringify the rest. */
export function cleanParams(params) {
  const out = {};
  for (const [k, v] of Object.entries(params || {})) {
    if (v === undefined || v === null || v === '' || (typeof v === 'number' && Number.isNaN(v))) continue;
    out[k] = String(v);
  }
  return out;
}

export const num = (v) => (v === undefined || v === null || v === '' ? undefined : Number(v));
export const str = (v) => (v ? String(v) : undefined);
export const perPage = (v, max, fallback = 15) => Math.min(Number(v) || fallback, max);

export function requireQuery(q, what) {
  if (!q || typeof q !== 'string' || !q.trim()) throw httpError(400, 'BAD_REQUEST', `query is required for ${what} search`);
  return q.trim();
}

/** Upstream GET with timeout; returns parsed JSON or throws httpError. */
export async function upstreamGet(url, { headers = {}, fetchImpl = globalThis.fetch, label = 'upstream' } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let res;
  try {
    res = await fetchImpl(url, { headers: { Accept: 'application/json', ...headers }, signal: controller.signal });
  } catch (err) {
    throw httpError(502, 'UPSTREAM_UNREACHABLE', err?.name === 'AbortError' ? `${label} request timed out` : `${label} network error`);
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) {
    let detail = '';
    try { detail = (await res.text()).slice(0, 200); } catch { /* best-effort */ }
    // Never echo URLs (they can carry the key in the query string).
    detail = detail.replace(/https?:\/\/\S+/g, '[redacted]');
    throw httpError(res.status === 429 ? 429 : res.status >= 500 ? 502 : 400, res.status === 429 ? 'RATE_LIMITED' : 'UPSTREAM_ERROR', `${label} request failed (${res.status})${detail ? `: ${detail}` : ''}`);
  }
  return res.json();
}

/**
 * Build a Netlify handler from a route table:
 *   routes: [[/^videos\/search$/, async (query, match, ctx) => data], ...]
 * ctx = { event, fetchImpl }. Errors become { ok:false, error:{ code, message } }.
 */
export function makeHandler(name, routes, { cacheSeconds = 300, fetchImpl } = {}) {
  return async function handler(event) {
    if (event.httpMethod === 'OPTIONS') return json(204, {});
    if (event.httpMethod !== 'GET') return json(405, { ok: false, error: { code: 'METHOD_NOT_ALLOWED', message: 'Use GET' } });
    const path = routePath(event.path, name);
    const query = event.queryStringParameters || {};
    try {
      for (const [pattern, fn] of routes) {
        const match = path.match(pattern);
        if (match) {
          const data = await fn(query, match, { event, fetchImpl: fetchImpl || globalThis.fetch });
          return json(200, data, { 'Cache-Control': `public, max-age=${cacheSeconds}` });
        }
      }
      return json(404, { ok: false, error: { code: 'NOT_FOUND', message: `Unknown ${name} route: ${path || '/'}` } });
    } catch (err) {
      const status = err.status || 500;
      return json(status, { ok: false, error: { code: err.code || 'ERROR', message: err.message || 'Request failed' } });
    }
  };
}
