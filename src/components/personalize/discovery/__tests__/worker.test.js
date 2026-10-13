// src/components/personalize/discovery/__tests__/worker.test.js
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { runDiscoveryWorker } from '../worker.js';

function makeFetchSequence(responses) {
  let i = 0;
  return vi.fn(async (url) => {
    const r = responses[i++] || responses[responses.length - 1];
    return {
      status: r.status,
      headers: { get: (k) => r.headers?.[k.toLowerCase()] ?? null },
      text: async () => r.body,
    };
  });
}

describe('worker.runDiscoveryWorker', () => {
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
  });

  it('rejects unsafe URLs', async () => {
    const r = await runDiscoveryWorker('http://127.0.0.1/');
    expect(r.ok).toBe(false);
    expect(r.errors.length).toBeGreaterThan(0);
  });

  it('end-to-end: static fetch + sitemap + dedup + categorize', async () => {
    const homeBody = `<html><body>
      <img src="/logo.png" />
      <img src="/products/shoe.png" />
      <img src="/hero.jpg" />
      <meta property="og:image" content="/og.png" />
    </body></html>`;
    const sitemapBody = `<?xml version="1.0"?>
<urlset>
  <url><loc>https://example.com/about</loc></url>
  <url><loc>https://example.com/products</loc></url>
</urlset>`;
    const aboutBody = '<html><body><img src="/about-banner.png"></body></html>';
    const productsBody = '<html><body><img src="/products/sneaker.jpg"></body></html>';

    global.fetch = makeFetchSequence([
      // 1. Static fetch home
      { status: 200, body: homeBody, headers: { 'content-type': 'text/html' } },
      // 2. sitemap.xml
      { status: 200, body: sitemapBody, headers: { 'content-type': 'application/xml' } },
      // 3. about page
      { status: 200, body: aboutBody, headers: { 'content-type': 'text/html' } },
      // 4. products page
      { status: 200, body: productsBody, headers: { 'content-type': 'text/html' } },
    ]);

    const r = await runDiscoveryWorker('https://example.com/');
    // Expect: logo, products/shoe, hero, og, about-banner, products/sneaker
    expect(r.urls.length).toBeGreaterThanOrEqual(6);
    // Logo URL
    expect(r.logos).toContain('https://example.com/logo.png');
    // Product URL
    expect(r.products).toContain('https://example.com/products/shoe.png');
    expect(r.products).toContain('https://example.com/products/sneaker.jpg');
    // Other
    expect(r.brandReferences.length).toBeGreaterThan(0);
    // No errors
    expect(r.errors).toEqual([]);
    expect(r.ok).toBe(true);
  });

  it('handles total failure gracefully', async () => {
    global.fetch = vi.fn(async () => { throw new Error('network down'); });
    // Pass allowHeadless: false so the headless fallback (which would
    // attempt to launch puppeteer) is skipped.
    const r = await runDiscoveryWorker('https://example.com/', { allowHeadless: false });
    expect(r.ok).toBe(false);
    expect(r.urls).toEqual([]);
    expect(r.errors.length).toBeGreaterThan(0);
  }, 10000);
});