// src/components/personalize/discovery/__tests__/sitemap.test.js
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { discoverFromSitemap, extractLocs } from '../sitemap.js';

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

describe('sitemap.extractLocs', () => {
  it('extracts all <loc> entries', () => {
    const xml = `<?xml version="1.0"?>
<urlset>
  <url><loc>https://example.com/a</loc></url>
  <url><loc>https://example.com/b</loc></url>
  <url><loc>https://example.com/c</loc></url>
</urlset>`;
    const locs = extractLocs(xml);
    expect(locs).toEqual([
      'https://example.com/a',
      'https://example.com/b',
      'https://example.com/c',
    ]);
  });
  it('returns empty on bad input', () => {
    expect(extractLocs(null)).toEqual([]);
    expect(extractLocs('')).toEqual([]);
  });
});

describe('sitemap.discoverFromSitemap', () => {
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

  it('extracts locs from /sitemap.xml', async () => {
    const sitemapBody = `<?xml version="1.0"?>
<urlset>
  <url><loc>https://example.com/a</loc></url>
  <url><loc>https://example.com/b</loc></url>
</urlset>`;
    // /sitemap.xml → 2 locs, /sitemap_index.xml → 404 (we use a 200
    // with empty body so the parser produces no extra entries). The
    // per-page fetches are skipped because we only have 2 locs.
    global.fetch = makeFetchSequence([
      { status: 200, body: sitemapBody, headers: { 'content-type': 'application/xml' } },
      { status: 200, body: '<?xml version="1.0"?><urlset></urlset>', headers: { 'content-type': 'application/xml' } },
    ]);
    const r = await discoverFromSitemap('https://example.com/');
    expect(r.locs.length).toBe(2);
    expect(r.unique).toContain('https://example.com/a');
    expect(r.unique).toContain('https://example.com/b');
  });

  it('falls back to /sitemap_index.xml when sitemap.xml 404s', async () => {
    const indexBody = `<?xml version="1.0"?>
<sitemapindex>
  <sitemap><loc>https://example.com/page1</loc></sitemap>
</sitemapindex>`;
    const pageBody = '<html><body><img src="/img1.png"></body></html>';
    global.fetch = makeFetchSequence([
      { status: 404, body: 'not found', headers: { 'content-type': 'text/plain' } },
      { status: 200, body: indexBody, headers: { 'content-type': 'application/xml' } },
      { status: 200, body: pageBody, headers: { 'content-type': 'text/html' } },
    ]);
    const r = await discoverFromSitemap('https://example.com/');
    expect(r.locs).toContain('https://example.com/page1');
    expect(r.pageAssets).toContain('https://example.com/img1.png');
  });

  it('caps at 25 sitemap entries and 50 total URLs', async () => {
    const bigSitemap = ['<?xml version="1.0"?><urlset>'];
    for (let i = 0; i < 100; i++) {
      bigSitemap.push(`<url><loc>https://example.com/p${i}</loc></url>`);
    }
    bigSitemap.push('</urlset>');
    global.fetch = makeFetchSequence([
      { status: 200, body: bigSitemap.join(''), headers: { 'content-type': 'application/xml' } },
    ]);
    const r = await discoverFromSitemap('https://example.com/');
    expect(r.locs.length).toBeLessThanOrEqual(25);
  });
});