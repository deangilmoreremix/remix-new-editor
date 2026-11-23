// @vitest-environment node
// Edge function for a business's own domain (netlify/edge-functions/custom-domain.js).
import { describe, it, expect, vi, beforeEach } from 'vitest';

const env = { VITE_SUPABASE_URL: 'https://db.example.co', VITE_SUPABASE_ANON_KEY: 'anon' };
let rpcAnswer;
const fetchMock = vi.fn(async () => ({ ok: true, json: async () => rpcAnswer }));

const load = async () => { vi.resetModules(); return (await import('../../netlify/edge-functions/custom-domain.js')); };
const html = '<!doctype html><html><head><title>x</title></head><body></body></html>';
const nextWith = () => vi.fn(async () => new Response(html, { status: 200, headers: { 'content-type': 'text/html', 'x-frame-options': 'SAMEORIGIN' } }));

beforeEach(() => {
  rpcAnswer = null;
  fetchMock.mockClear();
  vi.stubGlobal('Netlify', { env: { get: (k) => env[k] } });
  vi.stubGlobal('fetch', fetchMock);
});

describe('custom-domain edge function', () => {
  it('matches only single-segment paths', async () => {
    const { config } = await load();
    expect(config.path).toEqual(['/:slug', '/:slug/']);
  });

  it('passes the app\'s own hosts through without calling the database', async () => {
    const { default: handler } = await load();
    for (const host of ['smartvid.app', 'www.smartvid.app', 'develop--smartvideo2.netlify.app']) {
      const next = vi.fn(async () => new Response('app'));
      await handler(new Request(`https://${host}/intro`), { next });
      expect(next).toHaveBeenCalledWith();
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('passes an unverified or unknown host through', async () => {
    const { default: handler } = await load();
    rpcAnswer = null; // resolve_custom_domain returns null unless the domain is verified
    const next = vi.fn(async () => new Response('app'));
    const res = await handler(new Request('https://videos.acme.com/intro'), { next });
    expect(next).toHaveBeenCalledWith();
    expect(await res.text()).toBe('app');
  });

  it('ignores multi-segment paths and non-GET requests', async () => {
    const { default: handler } = await load();
    rpcAnswer = 'acme';
    for (const req of [new Request('https://videos.acme.com/a/b'), new Request('https://videos.acme.com/intro', { method: 'POST', body: 'x' })]) {
      const next = vi.fn(async () => new Response('app'));
      await handler(req, { next });
      expect(next).toHaveBeenCalledWith();
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('serves a verified host\'s video: rewrites to /v/<business>/<slug>, frames allowed, route hint injected', async () => {
    const { default: handler } = await load();
    rpcAnswer = 'acme';
    const next = nextWith();
    const res = await handler(new Request('https://videos.acme.com/intro?p=abc'), { next });
    const forwarded = next.mock.calls[0][0];
    expect(new URL(forwarded.url).pathname).toBe('/v/acme/intro');
    expect(new URL(forwarded.url).search).toBe('?p=abc');
    expect(res.headers.get('x-frame-options')).toBeNull();
    expect(res.headers.get('content-security-policy')).toBe('frame-ancestors *');
    expect(await res.text()).toContain('<head><meta name="sv-route" content="v/acme/intro">');
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ p_host: 'videos.acme.com' });
  });

  it('falls back to the normal site when the lookup fails', async () => {
    const { default: handler } = await load();
    fetchMock.mockRejectedValueOnce(new Error('down'));
    const next = vi.fn(async () => new Response('app'));
    const res = await handler(new Request('https://videos.acme.com/intro'), { next });
    expect(next).toHaveBeenCalledWith();
    expect(await res.text()).toBe('app');
  });
});
