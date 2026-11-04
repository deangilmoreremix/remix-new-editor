/**
 * Netlify function: Pixabay proxy at /api/pixabay/* (see netlify.toml).
 * Same routes and parameters as backend/services/pixabayProxyService.js.
 * Key: PIXABAY_API_KEY (Netlify environment variable).
 *
 * Pixabay asks for results to be cached for 24 hours, hence the
 * Cache-Control max-age of 86400.
 */
import {
  makeHandler, upstreamGet, cleanParams, httpError, requireQuery, num, str, perPage,
} from './_shared/stockProxy.js';

// Origin only: the endpoint paths ('/api/', '/api/videos/') carry /api.
export const PIXABAY_ORIGIN = 'https://pixabay.com';

export function pixabayUrl(path, params, key) {
  const qs = new URLSearchParams({ key, ...cleanParams(params) });
  return `${PIXABAY_ORIGIN}${path}?${qs.toString()}`;
}

function serverKey() {
  const key = (process.env.PIXABAY_API_KEY || '').trim();
  if (!key) throw httpError(503, 'PIXABAY_NOT_CONFIGURED', 'No Pixabay API key available. Set PIXABAY_API_KEY in the Netlify environment.');
  return key;
}

const get = (path, params, ctx) => upstreamGet(pixabayUrl(path, params, serverKey()), { fetchImpl: ctx.fetchImpl, label: 'Pixabay' });
const safe = (v) => (v === undefined || v === 'true' || v === true ? 'true' : 'false');

export const routes = [
  [/^images\/search$/, (q, _m, ctx) => get('/api/', {
    q: requireQuery(q.query, 'image'),
    image_type: 'photo',
    orientation: str(q.orientation),
    page: q.page || '1',
    per_page: perPage(q.per_page, 50),
    safesearch: safe(q.safe_search),
    min_width: num(q.min_width),
    min_height: num(q.min_height),
    editors_choice: q.editors_choice === 'true' ? 'true' : undefined,
    category: str(q.category),
    order: str(q.order),
    colors: str(q.colors),
  }, ctx)],
  [/^images\/curated$/, (q, _m, ctx) => get('/api/', {
    image_type: 'photo',
    page: q.page || '1',
    per_page: perPage(q.per_page, 50),
    safesearch: safe(q.safe_search),
    editors_choice: q.editors_choice === 'true' ? 'true' : undefined,
    category: str(q.category),
    order: str(q.order),
  }, ctx)],
  [/^videos\/search$/, (q, _m, ctx) => get('/api/videos/', {
    q: requireQuery(q.query, 'video'),
    orientation: str(q.orientation),
    page: q.page || '1',
    per_page: perPage(q.per_page, 50),
    safesearch: safe(q.safe_search),
    min_duration: num(q.min_duration),
    max_duration: num(q.max_duration),
    min_width: num(q.min_width),
    min_height: num(q.min_height),
    category: str(q.category),
    order: str(q.order),
  }, ctx)],
  [/^videos\/popular$/, (q, _m, ctx) => get('/api/videos/', {
    video_type: 'film',
    page: q.page || '1',
    per_page: perPage(q.per_page, 50),
    safesearch: safe(q.safe_search),
    min_duration: num(q.min_duration),
    max_duration: num(q.max_duration),
    min_width: num(q.min_width),
    min_height: num(q.min_height),
    category: str(q.category),
    order: str(q.order),
  }, ctx)],
  [/^health$/, async () => ({ status: 'ok', baseUrl: PIXABAY_ORIGIN, hasServerKey: Boolean((process.env.PIXABAY_API_KEY || '').trim()) })],
];

export const handler = makeHandler('pixabay', routes, { cacheSeconds: 86400 });
