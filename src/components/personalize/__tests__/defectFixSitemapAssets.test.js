/**
 * defectFixSitemapAssets.test.js
 *
 * Regression: for a plain <urlset> sitemap the <loc> entries are HTML
 * PAGE URLs, not media. They were merged into `unique` and, because
 * extensionless URLs pass `validateAssetUrl`, they reached the hub as
 * broken image cards. Page URLs must now be crawl targets only, and
 * the asset-extension allowlist must gate everything that reaches the
 * results. Image sitemaps (<image:image><image:loc>) still return
 * real media.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { discoverFromSitemap, extractLocs, extractImageLocs } from '../discovery/sitemap.js';
import { runDiscoveryWorker } from '../discovery/worker.js';

function makeFetchSequence(responses) {
  let i = 0;
  return vi.fn(async () => {
    const r = responses[i++] || responses[responses.length - 1];
    return {
      status: r.status,
      headers: { get: (k) => r.headers?.[k.toLowerCase()] ?? null },
      text: async () => r.body,
    };
  });
}

describe('defect: sitemap results contain only media URLs', () => {
  let originalLookup;
  beforeEach(() => {
    originalLookup = require('node:dns').promises.lookup;
    require('node:dns').promises.lookup = (host) => {
      if (host === 'example.com') return Promise.resolve([{ address: '93.184.216.34' }]);
      return Promise.reject(new Error('ENOTFOUND'));
    };
  });
  afterEach(() => {
    require('node:dns').promises.lookup = originalLookup;
    delete global.fetch;
  });

  it('extractLocs returns page URLs; extractImageLocs returns media URLs', () => {
    const xml = `<urlset xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
  <url>
    <loc>https://example.com/page</loc>
    <image:image><image:loc>https://example.com/img/a.png</image:loc></image:image>
  </url>
</urlset>`;
    expect(extractLocs(xml)).toEqual(['https://example.com/page']);
    expect(extractImageLocs(xml)).toEqual(['https://example.com/img/a.png']);
    expect(extractImageLocs(null)).toEqual([]);
  });

  it('never returns <urlset> page URLs as assets, only crawled images', async () => {
    const sitemapBody = `<?xml version="1.0"?>
<urlset>
  <url><loc>https://example.com/about</loc></url>
  <url><loc>https://example.com/products</loc></url>
</urlset>`;
    global.fetch = makeFetchSequence([
      { status: 200, body: sitemapBody, headers: { 'content-type': 'application/xml' } },
      { status: 200, body: '<html><body><img src="/about-hero.png"></body></html>', headers: { 'content-type': 'text/html' } },
      { status: 200, body: '<html><body><img src="/products/shoe.jpg"></body></html>', headers: { 'content-type': 'text/html' } },
      { status: 200, body: '<?xml version="1.0"?><urlset></urlset>', headers: { 'content-type': 'application/xml' } },
    ]);

    const r = await discoverFromSitemap('https://example.com/');
    // Page URLs survive as crawl targets…
    expect(r.locs).toEqual(['https://example.com/about', 'https://example.com/products']);
    // …and the crawled media is what reaches the asset results.
    expect(r.unique).toContain('https://example.com/about-hero.png');
    expect(r.unique).toContain('https://example.com/products/shoe.jpg');
    // No HTML page URL in the assets — this was the broken-image bug.
    expect(r.unique).not.toContain('https://example.com/about');
    expect(r.unique).not.toContain('https://example.com/products');
    expect(r.pageAssets).not.toContain('https://example.com/about');
  });

  it('returns <image:loc> media from an image sitemap as assets', async () => {
    const imageSitemap = `<?xml version="1.0"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
  <url>
    <loc>https://example.com/gallery</loc>
    <image:image>
      <image:loc>https://example.com/img/hero.png</image:loc>
      <image:loc>https://example.com/img/shoe.jpg</image:loc>
    </image:image>
  </url>
</urlset>`;
    global.fetch = makeFetchSequence([
      { status: 200, body: imageSitemap, headers: { 'content-type': 'application/xml' } },
      { status: 200, body: '<html><body></body></html>', headers: { 'content-type': 'text/html' } },
      { status: 200, body: '<?xml version="1.0"?><urlset></urlset>', headers: { 'content-type': 'application/xml' } },
    ]);

    const r = await discoverFromSitemap('https://example.com/');
    expect(r.unique).toContain('https://example.com/img/hero.png');
    expect(r.unique).toContain('https://example.com/img/shoe.jpg');
    // The hosting page stays a crawl target, never an asset.
    expect(r.unique).not.toContain('https://example.com/gallery');
    expect(r.locs).toContain('https://example.com/gallery');
  });

  it('applies the asset-extension allowlist to image-sitemap entries', async () => {
    const imageSitemap = `<urlset xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
  <url>
    <loc>https://example.com/downloads</loc>
    <image:image>
      <image:loc>https://example.com/files/evil.exe</image:loc>
      <image:loc>https://example.com/img/ok.png</image:loc>
    </image:image>
  </url>
</urlset>`;
    global.fetch = makeFetchSequence([
      { status: 200, body: imageSitemap, headers: { 'content-type': 'application/xml' } },
      { status: 200, body: '<html><body></body></html>', headers: { 'content-type': 'text/html' } },
      { status: 200, body: '<?xml version="1.0"?><urlset></urlset>', headers: { 'content-type': 'application/xml' } },
    ]);

    const r = await discoverFromSitemap('https://example.com/');
    expect(r.unique).toContain('https://example.com/img/ok.png');
    expect(r.unique).not.toContain('https://example.com/files/evil.exe');
  });

  it('keeps the worker output free of HTML page URLs end-to-end', async () => {
    const homeBody = '<html><body><img src="/hero.jpg"></body></html>';
    const sitemapBody = `<?xml version="1.0"?>
<urlset>
  <url><loc>https://example.com/about</loc></url>
  <url><loc>https://example.com/products</loc></url>
</urlset>`;
    global.fetch = makeFetchSequence([
      { status: 200, body: homeBody, headers: { 'content-type': 'text/html' } },
      { status: 200, body: sitemapBody, headers: { 'content-type': 'application/xml' } },
      { status: 200, body: '<html><body><img src="/about-hero.png"></body></html>', headers: { 'content-type': 'text/html' } },
      { status: 200, body: '<html><body><img src="/products/shoe.jpg"></body></html>', headers: { 'content-type': 'text/html' } },
      { status: 200, body: '<?xml version="1.0"?><urlset></urlset>', headers: { 'content-type': 'application/xml' } },
    ]);

    const r = await runDiscoveryWorker('https://example.com/', { allowHeadless: false });
    expect(r.urls).toContain('https://example.com/hero.jpg');
    expect(r.urls).toContain('https://example.com/about-hero.png');
    expect(r.urls).toContain('https://example.com/products/shoe.jpg');
    // The defect: page URLs used to land here as "images".
    expect(r.urls).not.toContain('https://example.com/about');
    expect(r.urls).not.toContain('https://example.com/products');
    expect(r.logos).toEqual([]);
    expect(r.errors).toEqual([]);
  });
});
