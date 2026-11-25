import { describe, it, expect, vi } from 'vitest';

const fetchMock = vi.hoisted(() => ({ fetchPageWithFinalUrl: vi.fn() }));
vi.mock('../_personalization/src/server/discoverAssets', () => fetchMock);

import { scrapeBrandStatic } from '../_personalization/src/server/brandStaticScrape';

describe('scrapeBrandStatic follows the redirect for relative links', () => {
  it('resolves media against the final URL but reports the URL that was asked for', async () => {
    fetchMock.fetchPageWithFinalUrl.mockResolvedValue({ html: '<html><head><title>Shop</title></head><body><img src="images/logo.svg" alt="logo"><p>' + 'text '.repeat(40) + '</p></body></html>', finalUrl: 'https://www.example.com/shop/' });
    const r = await scrapeBrandStatic('https://example.com/');
    expect(r.url).toBe('https://example.com/');
    expect(r.logoCandidates).toEqual(['https://www.example.com/shop/images/logo.svg']);
  });
  it('returns null when the page cannot be fetched', async () => {
    fetchMock.fetchPageWithFinalUrl.mockResolvedValue(null);
    expect(await scrapeBrandStatic('https://example.com/')).toBeNull();
  });
});
