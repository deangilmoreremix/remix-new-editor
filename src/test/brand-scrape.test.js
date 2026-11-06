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

describe('scrapeBrandSite upstream-parity extraction', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.PERSONALIZATION_RENDERED_DISCOVERY_URL;
  });
  const serve = (page, extra = () => null) =>
    vi.stubGlobal('fetch', vi.fn(async (url) => extra(String(url)) || html(page)));

  it('prefers the header/home-link logo and ignores customer-logo walls and descriptive alts', async () => {
    serve(`<html><head><title>Acme</title></head><body>
      <header><a href="/"><img src="/brand/acme-logo.svg" alt="Acme"></a></header>
      <section class="trusted-by"><img src="/c/hertz.png" alt="Hertz logo"><img src="/c/x.png" alt="logo"></section>
      <img src="/hero.png" alt="Aerial view of a street intersection imitating the Acme logo.">
      <p>${'Acme builds things for people. '.repeat(10)}</p></body></html>`);
    const out = await scrapeBrandSite('https://acme.example');
    expect(out.logoCandidates[0]).toBe('https://acme.example/brand/acme-logo.svg');
    expect(out.logoCandidates).not.toContain('https://acme.example/c/hertz.png');
    expect(out.logoCandidates).not.toContain('https://acme.example/hero.png');
  });

  it('does not treat a CDN host containing the brand name as a brand match', async () => {
    serve(`<html><head></head><body><nav><img src="https://acmeassets.example/nav/capture.png" alt="Capture"></nav>
      <p>${'Acme builds things. '.repeat(20)}</p></body></html>`);
    const out = await scrapeBrandSite('https://acme.example');
    expect(out.logoCandidates).toEqual([]);
  });

  it('resolves CSS variables and hsl, weights brand selectors and drops dark-mode and grey colors', async () => {
    serve(`<html><head><title>T</title><style>
      :root{--brand-primary: hsl(10 80% 50%); --grey:#888888}
      @media (prefers-color-scheme: dark){ a{color:#00ff00} .x{background:#00ff00} }
      a{color:var(--brand-primary)} .card{background:#cccccc} .y{color:#3366cc}
      </style></head><body>${'text '.repeat(80)}</body></html>`);
    const { pickPalette } = await import('../lib/colors.js');
    const out = await scrapeBrandSite('https://acme.example');
    const palette = pickPalette(out.rawColors);
    expect(palette.primary[0]).toBe('#e63c19');
    expect(out.rawColors).not.toContain('#00ff00');
    expect(out.rawColors).not.toContain('#888888');
  });

  it('reads brand fonts from @font-face and Google Fonts and skips icon fonts', async () => {
    serve(`<html><head><title>T</title>
      <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;700&family=Open+Sans&display=swap" rel="stylesheet">
      <style>@font-face{font-family:"Brand Display";src:url(x.woff2)} body{font-family:"FontAwesome",Arial,sans-serif} h1{font-family:'Roboto',sans-serif}</style>
      </head><body>${'text '.repeat(80)}</body></html>`);
    const out = await scrapeBrandSite('https://acme.example');
    expect(out.fonts).toEqual(expect.arrayContaining(['Brand Display', 'Poppins', 'Open Sans', 'Roboto']));
    expect(out.fonts).not.toContain('FontAwesome');
    expect(out.fonts).not.toContain('Arial');
  });

  it('strips navigation, footer and cookie banners from the text and puts headings first', async () => {
    serve(`<html><head><title>T</title></head><body>
      <nav>HOME PRICING LOGIN</nav><div id="cookie-banner">We use cookies</div>
      <main><h1>Roofs that last</h1><p>${'We install and repair roofs. '.repeat(15)}</p></main>
      <footer>Copyright 2025 legal</footer></body></html>`);
    const out = await scrapeBrandSite('https://acme.example');
    expect(out.bodyText.startsWith('Roofs that last')).toBe(true);
    expect(out.bodyText).not.toMatch(/PRICING|We use cookies|Copyright/);
  });

  it('prefers browser-computed styles from the rendered worker when it returns them', async () => {
    process.env.PERSONALIZATION_RENDERED_DISCOVERY_URL = 'https://worker.example/render';
    serve(PAGE, (url) => (url === 'https://worker.example/render'
      ? Response.json({
          screenshot: 'data:image/png;base64,iVBORw0KGgo=',
          computedStyles: { colors: ['rgb(12, 99, 200)', 'rgb(12, 99, 200)'], fonts: ['Inter', 'sans-serif'] },
          logoCandidates: ['/computed-logo.png'],
        })
      : null));
    const out = await scrapeBrandSite('https://acme.example');
    expect(out.rawColors).toEqual(['rgb(12, 99, 200)', 'rgb(12, 99, 200)']);
    expect(out.fonts).toEqual(['Inter']);
    expect(out.logoCandidates[0]).toBe('https://acme.example/computed-logo.png');
  });
});
