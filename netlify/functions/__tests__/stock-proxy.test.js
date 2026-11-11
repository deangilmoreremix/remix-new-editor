import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { handler as pixabay, pixabayUrl, routes as pixabayRoutes } from '../pixabay.js';
import { handler as pexels, pexelsUrl } from '../pexels.js';
import { routePath, cleanParams } from '../_shared/stockProxy.js';

const ev = (path, query = {}, headers = {}) => ({ httpMethod: 'GET', path, queryStringParameters: query, headers });
const ok = (body) => ({ ok: true, json: async () => body, text: async () => JSON.stringify(body) });

describe('Netlify stock proxies', () => {
  const env = { ...process.env };
  let fetchMock;
  beforeEach(() => {
    process.env.PIXABAY_API_KEY = 'pk';
    process.env.PEXELS_API_KEY = 'xk';
    fetchMock = vi.fn(async () => ok({ hits: [{ id: 1 }], videos: [{ id: 2 }], photos: [{ id: 3 }] }));
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => {
    process.env = { ...env };
    vi.unstubAllGlobals();
  });

  it('parses routes from both the function path and the /api redirect path', () => {
    expect(routePath('/.netlify/functions/pixabay/videos/search', 'pixabay')).toBe('videos/search');
    expect(routePath('/api/pexels/photos/123', 'pexels')).toBe('photos/123');
    expect(cleanParams({ a: undefined, b: '', c: 0, d: 'x', e: NaN })).toEqual({ c: '0', d: 'x' });
  });

  it('Pixabay: origin + /api/videos/ (regression guard for the /api/api bug), no "undefined" params', async () => {
    const res = await pixabay(ev('/api/pixabay/videos/search', { query: 'light leak', per_page: '24', max_duration: '30' }));
    expect(res.statusCode).toBe(200);
    expect(res.headers['Cache-Control']).toBe('public, max-age=86400');
    const url = new URL(fetchMock.mock.calls[0][0]);
    expect(url.origin + url.pathname).toBe('https://pixabay.com/api/videos/');
    expect(Object.fromEntries(url.searchParams)).toEqual({ key: 'pk', q: 'light leak', page: '1', per_page: '24', safesearch: 'true', max_duration: '30' });
    expect(pixabayUrl('/api/', { q: 'office', image_type: 'photo' }, 'k')).toBe('https://pixabay.com/api/?key=k&q=office&image_type=photo');
    expect(pixabayRoutes.map(([re]) => re.source)).toEqual(['^images\\/search$', '^images\\/curated$', '^videos\\/search$', '^videos\\/popular$', '^health$']);
  });

  it('Pexels: Authorization header, user key header wins, routes with ids', async () => {
    await pexels(ev('/api/pexels/photos/search', { query: 'team', per_page: '200' }));
    let [url, opts] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.pexels.com/v1/search?query=team&page=1&per_page=80');
    expect(opts.headers.Authorization).toBe('xk');
    await pexels(ev('/api/pexels/videos/77', {}, { 'x-pexels-api-key': 'user-key' }));
    [url, opts] = fetchMock.mock.calls[1];
    expect(url).toBe('https://api.pexels.com/v1/videos/77');
    expect(opts.headers.Authorization).toBe('user-key');
    expect(pexelsUrl('/curated', { page: 2 })).toBe('https://api.pexels.com/v1/curated?page=2');
  });

  it('503 with a clear message when the key is missing; 400 without a query; 404 unknown route', async () => {
    delete process.env.PEXELS_API_KEY;
    const missing = await pexels(ev('/api/pexels/videos/search', { query: 'x' }));
    expect(missing.statusCode).toBe(503);
    expect(JSON.parse(missing.body).error.message).toContain('PEXELS_API_KEY');
    const bad = await pixabay(ev('/api/pixabay/images/search', {}));
    expect(bad.statusCode).toBe(400);
    const nf = await pixabay(ev('/api/pixabay/nope', {}));
    expect(nf.statusCode).toBe(404);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('upstream errors never echo URLs (which carry the Pixabay key)', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 400, text: async () => 'bad request for https://pixabay.com/api/?key=pk&q=x' });
    const res = await pixabay(ev('/api/pixabay/images/search', { query: 'x' }));
    expect(res.statusCode).toBe(400);
    expect(res.body).not.toContain('key=pk');
  });

  it('Pixabay: user key header wins, image_type is allow-listed, per_page is at least 3', async () => {
    await pixabay(ev('/api/pixabay/images/curated', { image_type: 'vector', per_page: '1' }, { 'X-Pixabay-Api-Key': 'mine' }));
    let url = new URL(fetchMock.mock.calls[0][0]);
    expect(url.searchParams.get('key')).toBe('mine');
    expect(url.searchParams.get('image_type')).toBe('vector');
    expect(url.searchParams.get('per_page')).toBe('3');
    await pixabay(ev('/api/pixabay/images/search', { query: 'x', image_type: 'bogus' }));
    url = new URL(fetchMock.mock.calls[1][0]);
    expect(url.searchParams.get('image_type')).toBe('photo');
    expect(url.searchParams.get('key')).toBe('pk');
  });

  it('Pixabay: 503 tells the user to add a key in Settings', async () => {
    delete process.env.PIXABAY_API_KEY;
    const res = await pixabay(ev('/api/pixabay/videos/popular', {}));
    expect(res.statusCode).toBe(503);
    expect(JSON.parse(res.body).error.message).toContain('Settings');
  });
});
