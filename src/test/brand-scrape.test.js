import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('node:dns/promises', () => {
  const lookup = vi.fn(async () => [{ address: '93.184.216.34', family: 4 }]);
  return { default: { lookup }, lookup };
});

const { scrapeBrandSite } = await import('../../netlify/functions/_personalizationAssets.js');

const PAGE = `<!doctype html><html><head>
<title>Acme Roofing</title>
<meta name="description" content="Roofs that last.">
<meta property="og:image" content="/og.jpg">
<meta name="theme-color" content="#ff5500">
<link rel="icon" href="/fav.png">
<style>body{font-family:'Playfair Display',serif;color:#112233} .a{background:#ff5500}</style>
</head><body><img src="/img/acme-logo.png" alt="Acme logo">
<p>${'We install and repair roofs across the region. '.repeat(10)}</p></body></html>`;

const html = (body) =>
  new Response(body, { status: 200, headers: { 'content-type': 'text/html; charset=utf-8' } });

describe('scrapeBrandSite SSRF guards', () => {
  it.each([
    'http://localhost/test',
    'http://127.0.0.1/test',
    'http://169.254.169.254/latest/meta-data',
    'http://10.0.0.1/test',
    'file:///etc/passwd',
  ])('rejects unsafe URL %s', async (url) => {
    await expect(scrapeBrandSite(url)).rejects.toThrow();
  });

  it('requires a url', async () => {
    await expect(scrapeBrandSite('')).rejects.toThrow(/required/i);
  });
});

describe('scrapeBrandSite extraction', () => {
  let calls;
  beforeEach(() => {
    calls = [];
    delete process.env.PERSONALIZATION_RENDERED_DISCOVERY_URL;
    delete process.env.SCREENSHOT_API_URL;
    process.env.FIRECRAWL_API_KEY = 'should-never-be-used';
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.PERSONALIZATION_RENDERED_DISCOVERY_URL;
    delete process.env.FIRECRAWL_API_KEY;
  });

  const stubFetch = (handler) =>
    vi.stubGlobal('fetch', vi.fn(async (url, init) => {
      calls.push(String(url));
      return handler(String(url), init);
    }));

  it('extracts brand data statically, with no screenshot and no Firecrawl', async () => {
    stubFetch(() => html(PAGE));
    const out = await scrapeBrandSite('https://acme.example');
    expect(out.title).toBe('Acme Roofing');
    expect(out.description).toBe('Roofs that last.');
    expect(out.ogImage).toBe('https://acme.example/og.jpg');
    expect(out.logoCandidates).toContain('https://acme.example/img/acme-logo.png');
    expect(out.fonts).toContain('Playfair Display');
    expect(out.rawColors).toEqual(expect.arrayContaining(['#ff5500', '#112233']));
    expect(out.bodyText).toMatch(/install and repair roofs/);
    expect(out.screenshot).toBeNull();
    expect(calls.some((u) => u.includes('firecrawl'))).toBe(false);
  });

  it('takes the screenshot from the rendered worker (data URI)', async () => {
    process.env.PERSONALIZATION_RENDERED_DISCOVERY_URL = 'https://worker.example/render';
    stubFetch((url) =>
      url === 'https://worker.example/render'
        ? Response.json({ screenshot: 'data:image/png;base64,iVBORw0KGgo=' })
        : html(PAGE));
    const out = await scrapeBrandSite('https://acme.example');
    expect(out.screenshot).toBe('data:image/png;base64,iVBORw0KGgo=');
    expect(calls.some((u) => u.includes('firecrawl'))).toBe(false);
  });

  it('fetches a URL screenshot through the guarded path and returns a data URI', async () => {
    process.env.PERSONALIZATION_RENDERED_DISCOVERY_URL = 'https://worker.example/render';
    stubFetch((url) => {
      if (url === 'https://worker.example/render') return Response.json({ url: 'https://cdn.example/shot.png' });
      if (url === 'https://cdn.example/shot.png') {
        return new Response(new Uint8Array([137, 80, 78, 71]), { status: 200, headers: { 'content-type': 'image/png' } });
      }
      return html(PAGE);
    });
    const out = await scrapeBrandSite('https://acme.example');
    expect(out.screenshot).toBe(`data:image/png;base64,${Buffer.from([137, 80, 78, 71]).toString('base64')}`);
  });

  it('uses the worker DOM when the static page is thin (JS-heavy site)', async () => {
    process.env.PERSONALIZATION_RENDERED_DISCOVERY_URL = 'https://worker.example/render';
    stubFetch((url) =>
      url === 'https://worker.example/render'
        ? Response.json({ html: PAGE })
        : html('<html><head></head><body><div id="root"></div></body></html>'));
    const out = await scrapeBrandSite('https://acme.example');
    expect(out.title).toBe('Acme Roofing');
  });

  it('returns screenshot null when the worker is down', async () => {
    process.env.PERSONALIZATION_RENDERED_DISCOVERY_URL = 'https://worker.example/render';
    stubFetch((url) => (url === 'https://worker.example/render' ? new Response('', { status: 500 }) : html(PAGE)));
    const out = await scrapeBrandSite('https://acme.example');
    expect(out.screenshot).toBeNull();
    expect(out.title).toBe('Acme Roofing');
  });
});
