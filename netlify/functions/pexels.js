/**
 * Netlify function: Pexels proxy at /api/pexels/* (see netlify.toml).
 * Same routes and parameters as backend/services/pexelsProxyService.js.
 * Key: PEXELS_API_KEY (Netlify environment variable), or a user's own key
 * sent in the `x-pexels-api-key` header (Settings → API keys).
 */
import {
  makeHandler, upstreamGet, cleanParams, httpError, requireQuery, num, str, perPage,
} from './_shared/stockProxy.js';

export const PEXELS_BASE_URL = 'https://api.pexels.com/v1';

export function pexelsUrl(path, params) {
  const qs = new URLSearchParams(cleanParams(params)).toString();
  return `${PEXELS_BASE_URL}${path}${qs ? `?${qs}` : ''}`;
}

function resolveKey(event) {
  const headers = event.headers || {};
  const fromHeader = headers['x-pexels-api-key'] || headers['X-Pexels-Api-Key'];
  const key = String(fromHeader || process.env.PEXELS_API_KEY || '').trim();
  if (!key) throw httpError(503, 'PEXELS_NOT_CONFIGURED', 'No Pexels API key available. Set PEXELS_API_KEY in the Netlify environment.');
  return key;
}

const get = (path, params, ctx) => upstreamGet(pexelsUrl(path, params), {
  headers: { Authorization: resolveKey(ctx.event) },
  fetchImpl: ctx.fetchImpl,
  label: 'Pexels',
});

const id = (m, what) => {
  if (!m[1]) throw httpError(400, 'BAD_REQUEST', `${what} id is required`);
  return encodeURIComponent(m[1]);
};

export const routes = [
  [/^photos\/search$/, (q, _m, ctx) => get('/search', {
    query: requireQuery(q.query, 'photo'),
    orientation: str(q.orientation),
    size: str(q.size),
    color: str(q.color),
    locale: str(q.locale),
    page: q.page || '1',
    per_page: perPage(q.per_page, 80),
  }, ctx)],
  [/^photos\/curated$/, (q, _m, ctx) => get('/curated', { page: q.page || '1', per_page: perPage(q.per_page, 80) }, ctx)],
  [/^photos\/([^/]+)$/, (_q, m, ctx) => get(`/photos/${id(m, 'photo')}`, {}, ctx)],
  [/^videos\/search$/, (q, _m, ctx) => get('/videos/search', {
    query: requireQuery(q.query, 'video'),
    orientation: str(q.orientation),
    size: str(q.size),
    locale: str(q.locale),
    min_duration: num(q.min_duration),
    max_duration: num(q.max_duration),
    min_width: num(q.min_width),
    min_height: num(q.min_height),
    page: q.page || '1',
    per_page: perPage(q.per_page, 80),
  }, ctx)],
  [/^videos\/popular$/, (q, _m, ctx) => get('/videos/popular', {
    min_duration: num(q.min_duration),
    max_duration: num(q.max_duration),
    min_width: num(q.min_width),
    min_height: num(q.min_height),
    page: q.page || '1',
    per_page: perPage(q.per_page, 80),
  }, ctx)],
  [/^videos\/([^/]+)$/, (_q, m, ctx) => get(`/videos/${id(m, 'video')}`, {}, ctx)],
  [/^collections\/featured$/, (q, _m, ctx) => get('/collections/featured', { page: q.page || '1', per_page: perPage(q.per_page, 80) }, ctx)],
  [/^collections$/, (q, _m, ctx) => get('/collections', { page: q.page || '1', per_page: perPage(q.per_page, 80) }, ctx)],
  [/^collections\/([^/]+)$/, (q, m, ctx) => get(`/collections/${id(m, 'collection')}`, {
    type: str(q.type),
    sort: q.sort || 'asc',
    page: q.page || '1',
    per_page: perPage(q.per_page, 80),
  }, ctx)],
  [/^health$/, async () => ({ status: 'ok', baseUrl: PEXELS_BASE_URL, hasServerKey: Boolean((process.env.PEXELS_API_KEY || '').trim()) })],
];

export const handler = makeHandler('pexels', routes, { cacheSeconds: 300 });
