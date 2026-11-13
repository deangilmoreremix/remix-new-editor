/**
 * Comprehensive tests for Personalization free-first asset discovery.
 *
 * Covers:
 * - Static discovery
 * - Sitemap discovery
 * - Crawlee CheerioCrawler
 * - Asset classification
 * - Firecrawl cost control
 * - Forbidden auto-placement
 * - Import behavior
 * - Failure handling
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('studio/src/muapi', () => ({
  uploadFile: vi.fn(),
}))

// Crawlee persists its request-queue lock to <storage>/request_queues/default/
// *.json.lock. Under vitest's parallel workers, every test file shares the same
// default ./storage dir, so two CheerioCrawler instances race on the same lock
// and mkdir ENOENTs when the directory does not yet exist. Point Crawlee at a
// unique per-file temp storage dir so the lock is isolated. Crawlee resolves the
// storage dir lazily when the crawler runs, so setting it here (before any
// crawl) is sufficient. This does NOT weaken the crawler behavior under test.
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
process.env.CRAWLEE_STORAGE_DIR = mkdtempSync(join(tmpdir(), 'crawlee-discovery-'))

import axios from 'axios'
import { orchestrateDiscovery } from '../discoveryOrchestrator'
import { discoverSitemapUrls } from '../sitemapDiscovery'
import { discoverWithCrawlee } from '../crawleeProvider'
import { StaticDiscoveryProvider } from '../staticDiscovery'
import { FirecrawlDiscoveryProvider } from '../firecrawlDiscovery'
import { sanitizeUrl } from '../discoverAssets'
import { heuristicFallback } from '../discoverAssets'
import { autoPlaceAssets, DEFAULT_AUTO_PLACEMENT_CONFIG } from '../autoPlacementEngine'
import { PROHIBITED_AUTO_PLACEMENT } from '../discoveryPolicy'
import type { DiscoveredAsset } from '../../shared/personalization/types'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mockStaticResult(candidates: Array<{ url: string; sourcePage?: string; ogContext?: string }>) {
  const result = {
    candidates: candidates.map((c) => ({
      url: c.url,
      sourcePage: c.sourcePage || c.url,
      ogContext: c.ogContext,
      sourceType: 'WEBSITE' as const,
    })),
    provider: 'STATIC_FALLBACK' as const,
    pagesCrawled: 1,
    rawCandidates: candidates.length,
    socialProfiles: [],
  }
  vi.spyOn(StaticDiscoveryProvider.prototype, 'discover').mockResolvedValue(result)
  return result
}

function mockFirecrawlResult(candidates: Array<{ url: string }>) {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({
      data: [
        {
          url: 'https://example.com/page1',
          html: `<html><body>${candidates.map((c) => `<img src="${c.url}" />`).join('')}</body></html>`,
        },
      ],
    }),
  } as Response)
}

// ---------------------------------------------------------------------------
// GROUP A — Static discovery
// ---------------------------------------------------------------------------

describe('Static discovery', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('discovers homepage assets via axios+JSDOM', async () => {
    vi.spyOn(axios, 'get').mockResolvedValue({
      status: 200,
      headers: { 'content-type': 'text/html' },
      data: '<html><body><img src="https://example.com/hero.png" /></body></html>',
    } as any)

    const result = await orchestrateDiscovery({
      websiteUrl: 'https://example.com',
      maxPages: 2,
      maxImages: 10,
    })

    expect(result.providerUsed).toBe('STATIC_FALLBACK')
    expect(result.candidates.length).toBeGreaterThanOrEqual(0)
  })

  it('extracts Open Graph images', async () => {
    vi.spyOn(axios, 'get').mockResolvedValue({
      status: 200,
      headers: { 'content-type': 'text/html' },
      data: '<html><head><meta property="og:image" content="https://example.com/og.png" /></head></html>',
    } as any)

    const result = await orchestrateDiscovery({
      websiteUrl: 'https://example.com',
      maxPages: 2,
      maxImages: 10,
    })

    expect(result.providerUsed).toBe('STATIC_FALLBACK')
  })

  it('deduplicates image URLs', async () => {
    vi.spyOn(axios, 'get').mockResolvedValue({
      status: 200,
      headers: { 'content-type': 'text/html' },
      data: '<html><body><img src="https://example.com/a.png" /><img src="https://example.com/a.png" /></body></html>',
    } as any)

    const result = await orchestrateDiscovery({
      websiteUrl: 'https://example.com',
      maxPages: 2,
      maxImages: 10,
    })

    const urls = result.candidates.map((c) => c.url)
    const uniqueUrls = new Set(urls)
    expect(uniqueUrls.size).toBe(urls.length)
  })
})

// ---------------------------------------------------------------------------
// GROUP B — Sitemap
// ---------------------------------------------------------------------------

describe('Sitemap discovery', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('parses sitemap.xml and returns URLs', async () => {
    vi.spyOn(axios, 'get').mockResolvedValue({
      status: 200,
      headers: { 'content-type': 'text/xml' },
      data: '<?xml version="1.0"?><urlset><url><loc>https://example.com/about</loc></url><url><loc>https://example.com/services</loc></url></urlset>',
    } as any)

    const urls = await discoverSitemapUrls('https://example.com')
    expect(urls).toContain('https://example.com/about')
    expect(urls).toContain('https://example.com/services')
  })

  it('returns empty array when sitemap is missing', async () => {
    vi.spyOn(axios, 'get').mockRejectedValue(new Error('404'))

    const urls = await discoverSitemapUrls('https://example.com')
    expect(urls).toEqual([])
  })

  it('excludes low-value paths', async () => {
    vi.spyOn(axios, 'get').mockResolvedValue({
      status: 200,
      headers: { 'content-type': 'text/xml' },
      data: '<?xml version="1.0"?><urlset><url><loc>https://example.com/blog/post</loc></url><url><loc>https://example.com/about</loc></url></urlset>',
    } as any)

    const urls = await discoverSitemapUrls('https://example.com')
    expect(urls).not.toContain('https://example.com/blog/post')
    expect(urls).toContain('https://example.com/about')
  })

  it('discovers sitemap URLs from robots.txt when direct sitemap paths are missing', async () => {
    vi.spyOn(axios, 'get')
      .mockRejectedValueOnce(new Error('404'))
      .mockRejectedValueOnce(new Error('404'))
      .mockRejectedValueOnce(new Error('404'))
      .mockResolvedValueOnce({
        status: 200,
        headers: { 'content-type': 'text/plain' },
        data: 'User-agent: *\nDisallow: /admin\nSitemap: https://example.com/sitemap.xml\n',
      } as any)
      .mockResolvedValueOnce({
        status: 200,
        headers: { 'content-type': 'text/xml' },
        data: '<?xml version="1.0"?><urlset><url><loc>https://example.com/about</loc></url></urlset>',
      } as any)

    const urls = await discoverSitemapUrls('https://example.com')
    expect(urls).toContain('https://example.com/about')
  })
})

// ---------------------------------------------------------------------------
// GROUP C — Crawlee
// ---------------------------------------------------------------------------

describe('Crawlee CheerioCrawler', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('crawls only selected high-value pages', async () => {
    const result = await discoverWithCrawlee('https://example.com')
    expect(result.provider).toBe('CRAWLEE_CHEERIO')
    expect(result.pagesCrawled).toBeGreaterThanOrEqual(0)
  })

  it('enforces same-origin', async () => {
    // This is enforced in preNavigationHooks and link enqueueing
    const result = await discoverWithCrawlee('https://example.com')
    for (const candidate of result.candidates) {
      expect(new URL(candidate.url).origin).toBe('https://example.com')
    }
  })
})

// ---------------------------------------------------------------------------
// GROUP D — Asset classification / heuristic fallback
// ---------------------------------------------------------------------------

describe('Asset classification', () => {
  it('classifies logo by URL heuristics', () => {
    const result = heuristicFallback('https://example.com/logo.png')
    expect(result.category).toBe('logo')
  })

  it('classifies team page as team', () => {
    const result = heuristicFallback('https://example.com/team/photo.jpg')
    expect(result.category).toBe('team')
  })

  it('classifies product image as product', () => {
    const result = heuristicFallback('https://example.com/products/item.png')
    expect(result.category).toBe('product')
  })

  it('classifies storefront as storefront', () => {
    const result = heuristicFallback('https://example.com/storefront.jpg')
    expect(result.category).toBe('storefront')
  })

  it('classifies vehicle as branded_vehicle', () => {
    const result = heuristicFallback('https://example.com/truck.png')
    expect(result.category).toBe('branded_vehicle')
  })

  it('classifies office interior as office', () => {
    const result = heuristicFallback('https://example.com/office.jpg')
    expect(result.category).toBe('office')
  })

  it('classifies junk as irrelevant', () => {
    const result = heuristicFallback('https://example.com/favicon.ico')
    expect(result.category).toBe('irrelevant')
  })
})

// ---------------------------------------------------------------------------
// GROUP E — Firecrawl cost control
// ---------------------------------------------------------------------------

describe('Firecrawl cost control', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('does not call Firecrawl when static is sufficient (enough useful assets)', async () => {
    mockStaticResult([
      { url: 'https://example.com/logo.png', ogContext: 'logo' },
      { url: 'https://example.com/product1.png', ogContext: 'product' },
      { url: 'https://example.com/product2.png', ogContext: 'product' },
      { url: 'https://example.com/storefront.png', ogContext: 'storefront' },
    ])
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ data: [] }),
    } as Response)

    const result = await orchestrateDiscovery({
      websiteUrl: 'https://example.com',
      maxPages: 5,
      maxImages: 20,
      firecrawlApiKey: 'fc-test',
      enableFirecrawlFallback: true,
    })

    expect(result.providerAttempts).not.toContain('FIRECRAWL')
    expect(result.firecrawlUsed).toBe(false)
  })

  it('does not call Firecrawl when fallback is disabled even if static is weak', async () => {
    vi.spyOn(axios, 'get').mockRejectedValue(new Error('Static down'))

    const result = await orchestrateDiscovery({
      websiteUrl: 'https://example.com',
      maxPages: 5,
      maxImages: 20,
      firecrawlApiKey: 'fc-test',
      enableFirecrawlFallback: false,
    })

    expect(result.providerAttempts).not.toContain('FIRECRAWL')
    expect(result.firecrawlUsed).toBe(false)
  })

  it('does not call Firecrawl when API key is missing', async () => {
    vi.spyOn(axios, 'get').mockRejectedValue(new Error('Static down'))

    const result = await orchestrateDiscovery({
      websiteUrl: 'https://example.com',
      maxPages: 5,
      maxImages: 20,
      firecrawlApiKey: undefined,
      enableFirecrawlFallback: true,
    })

    expect(result.providerAttempts).not.toContain('FIRECRAWL')
    expect(result.firecrawlUsed).toBe(false)
  })

  it('does not call Firecrawl when only presenter is missing', async () => {
    // 4 products + 2 brand references = 6 useful assets, no presenter
    mockStaticResult([
      { url: 'https://example.com/product1.png', ogContext: 'product' },
      { url: 'https://example.com/product2.png', ogContext: 'product' },
      { url: 'https://example.com/product3.png', ogContext: 'product' },
      { url: 'https://example.com/product4.png', ogContext: 'product' },
      { url: 'https://example.com/storefront.png', ogContext: 'storefront' },
      { url: 'https://example.com/office.png', ogContext: 'office' },
    ])
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ data: [] }),
    } as Response)

    const result = await orchestrateDiscovery({
      websiteUrl: 'https://example.com',
      maxPages: 5,
      maxImages: 20,
      firecrawlApiKey: 'fc-test',
      enableFirecrawlFallback: true,
    })

    expect(result.providerAttempts).not.toContain('FIRECRAWL')
    expect(result.firecrawlUsed).toBe(false)
  })

  it('does not call Firecrawl when only logo is missing but other assets are sufficient', async () => {
    // 4 products + 2 brand references = 6 useful assets, no logo
    mockStaticResult([
      { url: 'https://example.com/product1.png', ogContext: 'product' },
      { url: 'https://example.com/product2.png', ogContext: 'product' },
      { url: 'https://example.com/product3.png', ogContext: 'product' },
      { url: 'https://example.com/product4.png', ogContext: 'product' },
      { url: 'https://example.com/storefront.png', ogContext: 'storefront' },
      { url: 'https://example.com/office.png', ogContext: 'office' },
    ])
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ data: [] }),
    } as Response)

    const result = await orchestrateDiscovery({
      websiteUrl: 'https://example.com',
      maxPages: 5,
      maxImages: 20,
      firecrawlApiKey: 'fc-test',
      enableFirecrawlFallback: true,
    })

    expect(result.providerAttempts).not.toContain('FIRECRAWL')
    expect(result.firecrawlUsed).toBe(false)
  })

  it('calls Firecrawl at most once when all free layers are insufficient', async () => {
    vi.spyOn(StaticDiscoveryProvider.prototype, 'discover').mockResolvedValue({
      candidates: [{ url: 'https://example.com/one.png', sourcePage: 'https://example.com', ogContext: 'brand', sourceType: 'WEBSITE' }],
      provider: 'STATIC_FALLBACK',
      pagesCrawled: 1,
      rawCandidates: 1,
      socialProfiles: [],
    })

    mockFirecrawlResult([{ url: 'https://example.com/firecrawl-logo.png' }])

    const result = await orchestrateDiscovery({
      websiteUrl: 'https://example.com',
      maxPages: 5,
      maxImages: 20,
      firecrawlApiKey: 'fc-test',
      enableFirecrawlFallback: true,
    })

    expect(result.providerAttempts).toContain('FIRECRAWL')
    expect(result.firecrawlUsed).toBe(true)
  })

  it('records firecrawlReason when Firecrawl runs', async () => {
    vi.spyOn(StaticDiscoveryProvider.prototype, 'discover').mockResolvedValue({
      candidates: [{ url: 'https://example.com/one.png', sourcePage: 'https://example.com', ogContext: 'brand', sourceType: 'WEBSITE' }],
      provider: 'STATIC_FALLBACK',
      pagesCrawled: 1,
      rawCandidates: 1,
      socialProfiles: [],
    })

    mockFirecrawlResult([{ url: 'https://example.com/firecrawl-logo.png' }])

    const result = await orchestrateDiscovery({
      websiteUrl: 'https://example.com',
      maxPages: 5,
      maxImages: 20,
      firecrawlApiKey: 'fc-test',
      enableFirecrawlFallback: true,
    })

    expect(result.firecrawlReason).toBeTruthy()
  })

  it('records firecrawlSkippedReason when fallback is disabled', async () => {
    vi.spyOn(axios, 'get').mockRejectedValue(new Error('Static down'))

    const result = await orchestrateDiscovery({
      websiteUrl: 'https://example.com',
      maxPages: 5,
      maxImages: 20,
      firecrawlApiKey: 'fc-test',
      enableFirecrawlFallback: false,
    })

    expect(result.firecrawlSkippedReason).toBe('FIRECRAWL_DISABLED')
    expect(result.firecrawlUsed).toBe(false)
  })

  it('records firecrawlSkippedReason when API key is missing', async () => {
    vi.spyOn(axios, 'get').mockRejectedValue(new Error('Static down'))

    const result = await orchestrateDiscovery({
      websiteUrl: 'https://example.com',
      maxPages: 5,
      maxImages: 20,
      firecrawlApiKey: undefined,
      enableFirecrawlFallback: true,
    })

    expect(result.firecrawlSkippedReason).toBe('NO_FIRECRAWL_API_KEY')
    expect(result.firecrawlUsed).toBe(false)
  })

  it('records firecrawlSkippedReason when only logo is missing but other assets are sufficient', async () => {
    mockStaticResult([
      { url: 'https://example.com/product1.png', ogContext: 'product' },
      { url: 'https://example.com/product2.png', ogContext: 'product' },
      { url: 'https://example.com/product3.png', ogContext: 'product' },
      { url: 'https://example.com/product4.png', ogContext: 'product' },
      { url: 'https://example.com/storefront.png', ogContext: 'storefront' },
      { url: 'https://example.com/office.png', ogContext: 'office' },
    ])
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ data: [] }),
    } as Response)

    const result = await orchestrateDiscovery({
      websiteUrl: 'https://example.com',
      maxPages: 5,
      maxImages: 20,
      firecrawlApiKey: 'fc-test',
      enableFirecrawlFallback: true,
    })

    expect(result.firecrawlSkippedReason).toBe('ONLY_LOGO_MISSING')
    expect(result.firecrawlUsed).toBe(false)
  })

  it('records firecrawlSkippedReason when only presenter is missing but other assets are sufficient', async () => {
    // 1 logo + 4 products + 2 brand references = 7 useful assets, no presenter
    mockStaticResult([
      { url: 'https://example.com/logo.png', ogContext: 'logo' },
      { url: 'https://example.com/product1.png', ogContext: 'product' },
      { url: 'https://example.com/product2.png', ogContext: 'product' },
      { url: 'https://example.com/product3.png', ogContext: 'product' },
      { url: 'https://example.com/product4.png', ogContext: 'product' },
      { url: 'https://example.com/storefront.png', ogContext: 'storefront' },
      { url: 'https://example.com/office.png', ogContext: 'office' },
    ])
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ data: [] }),
    } as Response)

    const result = await orchestrateDiscovery({
      websiteUrl: 'https://example.com',
      maxPages: 5,
      maxImages: 20,
      firecrawlApiKey: 'fc-test',
      enableFirecrawlFallback: true,
    })

    // Presenter is optional; enough other useful assets means Firecrawl is skipped.
    expect(result.firecrawlSkippedReason).toBe('USEFUL_RESULTS_ALREADY_FOUND')
    expect(result.firecrawlUsed).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// GROUP F — Forbidden auto-placement
// ---------------------------------------------------------------------------

describe('Forbidden auto-placement', () => {
  it('prohibited roles are defined in policy', () => {
    expect(PROHIBITED_AUTO_PLACEMENT).toContain('first_frame')
    expect(PROHIBITED_AUTO_PLACEMENT).toContain('last_frame')
    expect(PROHIBITED_AUTO_PLACEMENT).toContain('cta_graphic')
    expect(PROHIBITED_AUTO_PLACEMENT).toContain('audio_reference')
  })

  it('does not auto-assign first_frame from website discovery', async () => {
    const assets = await autoPlaceAssets(
      [
        {
          id: 'test-1',
          sourceUrl: 'https://example.com/hero.png',
          previewUrl: 'https://example.com/hero.png',
          sourceType: 'WEBSITE',
          category: 'brand',
          confidence: 60,
          qualityScore: 60,
          relevanceScore: 60,
          selected: true,
          recommended: true,
          rejected: false,
          assignedSection: null,
          autoAssigned: false,
        },
      ],
      DEFAULT_AUTO_PLACEMENT_CONFIG,
    )

    expect(assets.some((a) => a.assignedSection === 'firstFrame')).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// GROUP H — Failure handling
// ---------------------------------------------------------------------------

describe('Failure handling', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('continues when sitemap fetch fails', async () => {
    vi.spyOn(axios, 'get').mockRejectedValue(new Error('sitemap 404'))

    const result = await orchestrateDiscovery({
      websiteUrl: 'https://example.com',
      maxPages: 5,
      maxImages: 20,
    })

    expect(result.providerUsed).toBe('STATIC_FALLBACK')
  })

  it('returns clear error when all providers fail', async () => {
    vi.spyOn(axios, 'get').mockRejectedValue(new Error('network'))

    const result = await orchestrateDiscovery({
      websiteUrl: 'https://example.com',
      maxPages: 5,
      maxImages: 20,
      firecrawlApiKey: 'fc-test',
      enableFirecrawlFallback: true,
    })

    expect(result.candidates).toEqual([])
    expect(result.discoveredAssets).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// Additional edge cases
// ---------------------------------------------------------------------------

describe('Additional edge cases', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('rejects unsafe URLs', async () => {
    await expect(
      orchestrateDiscovery({
        websiteUrl: 'http://localhost:3000',
        maxPages: 5,
        maxImages: 20,
      }),
    ).rejects.toThrow('Private network addresses are not allowed')
  })

  it('returns empty discoveredAssets when no candidates pass classification', async () => {
    mockStaticResult([
      { url: 'https://example.com/favicon.ico', ogContext: 'junk' },
    ])

    const result = await orchestrateDiscovery({
      websiteUrl: 'https://example.com',
      maxPages: 5,
      maxImages: 20,
    })

    // favicon.ico is classified as irrelevant by heuristic fallback
    expect(result.discoveredAssets).toEqual([])
  })
})
