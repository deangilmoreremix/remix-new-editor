// @vitest-environment node
// Edge function for a business's own domain (netlify/edge-functions/custom-domain.js).
import { describe, it, expect, vi, beforeEach } from 'vitest';

const env = { VITE_SUPABASE_URL: 'https://db.example.co', VITE_SUPABASE_ANON_KEY: 'anon' };
let rpcAnswer;
const fetchMock = vi.fn(async () => ({ ok: true, json: async () => rpcAnswer }));

const load = async () => { vi.resetModules(); return (await import('../../netlify/edge-functions/custom-domain.js')); };
const html = '<!doctype html><html><head><title>x</title></head><body><div id="app"></div></body></html>';
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

  it('serves a verified host\'s video: the request is forwarded unchanged, frames allowed, route hint injected', async () => {
    const { default: handler } = await load();
    rpcAnswer = 'acme';
    const next = nextWith();
    const res = await handler(new Request('https://videos.acme.com/intro?p=abc'), { next });
    expect(next).toHaveBeenCalledWith(); // no rewritten request: the catch-all rule answers with the app shell
    expect(res.headers.get('x-frame-options')).toBeNull();
    expect(res.headers.get('content-security-policy')).toBe('frame-ancestors *');
    expect(await res.text()).toContain('<head><meta name="sv-route" content="v/acme/intro">');
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ p_host: 'videos.acme.com' });
  });

  it('drops the stale length, encoding and etag after changing the body', async () => {
    const { default: handler } = await load();
    rpcAnswer = 'acme';
    const next = vi.fn(async () => new Response(html, { status: 200, headers: { 'content-type': 'text/html', 'content-length': String(html.length), 'content-encoding': 'br', etag: '"x"' } }));
    const res = await handler(new Request('https://videos.acme.com/intro'), { next });
    expect(res.headers.get('content-length')).toBeNull();
    expect(res.headers.get('content-encoding')).toBeNull();
    expect(res.headers.get('etag')).toBeNull();
    expect((await res.text()).length).toBeGreaterThan(html.length);
  });

  it('adds the hint only to the app shell, not to any other page, file or error', async () => {
    const { default: handler } = await load();
    rpcAnswer = 'acme';
    const other = '<!doctype html><html><head><title>t</title></head><body>a static page</body></html>';
    const cases = [
      new Response(other, { status: 200, headers: { 'content-type': 'text/html' } }),
      new Response('nope', { status: 404, headers: { 'content-type': 'text/html' } }),
      new Response('{"a":1}', { status: 200, headers: { 'content-type': 'application/json' } }),
    ];
    for (const r of cases) {
      const res = await handler(new Request('https://videos.acme.com/intro'), { next: vi.fn(async () => r) });
      expect(await res.text()).not.toContain('sv-route');
    }
  });

  it('never takes over the app\'s reserved paths, even on a verified host', async () => {
    const { default: handler } = await load();
    rpcAnswer = 'acme';
    for (const path of ['/signin', '/api', '/assets', '/v', '/watch', '/settings']) {
      const next = vi.fn(async () => new Response('app'));
      await handler(new Request(`https://videos.acme.com${path}`), { next });
      expect(next).toHaveBeenCalledWith();
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('serves a video whose address matches one of the app\'s own pages (academy, studios, recorder...)', async () => {
    const { default: handler } = await load();
    rpcAnswer = 'acme';
    for (const path of ['/academy', '/studios', '/recorder', '/zackd']) {
      const res = await handler(new Request(`https://videos.acme.com${path}`), { next: nextWith() });
      expect(await res.text()).toContain(`content="v/acme/${path.slice(1)}"`);
    }
  });

  it('skips exactly the words the publish rules refuse as a video address, so no valid video is ever skipped', async () => {
    const { APP_PATHS } = await load();
    const { validateSlug, RESERVED_SLUGS } = await import('../lib/editor/publish/publishClient.js');
    for (const word of APP_PATHS) expect(validateSlug(word)).not.toBeNull();
    expect([...APP_PATHS].sort()).toEqual([...RESERVED_SLUGS].sort());
  });

  it('treats an upper-case or trailing-dot host like its normal form', async () => {
    const { default: handler, normalizeHost } = await load();
    expect(normalizeHost('Videos.ACME.com.')).toBe('videos.acme.com');
    rpcAnswer = 'acme';
    await handler(new Request('https://Videos.Acme.com/intro'), { next: nextWith() });
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ p_host: 'videos.acme.com' });
  });

  it('remembers an answer for a minute, a failure briefly, and keeps the cache bounded', async () => {
    const { default: handler } = await load();
    rpcAnswer = 'acme';
    await handler(new Request('https://videos.acme.com/intro'), { next: nextWith() });
    await handler(new Request('https://videos.acme.com/other'), { next: nextWith() });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    fetchMock.mockRejectedValueOnce(new Error('down'));
    await handler(new Request('https://down.example.com/intro'), { next: nextWith() });
    await handler(new Request('https://down.example.com/intro'), { next: nextWith() });
    expect(fetchMock).toHaveBeenCalledTimes(2); // the second visit did not ask again
    for (let i = 0; i < 520; i += 1) await handler(new Request(`https://h${i}.example.com/intro`), { next: nextWith() });
    expect(fetchMock.mock.calls.length).toBe(522);
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
