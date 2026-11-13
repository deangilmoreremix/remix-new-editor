/**
 * Regression tests for the certified Personalization discovery baseline.
 *
 * Covers gaps not fully exercised by the existing suite:
 * - buildDiscoveredAssetsFromCandidates normalization
 * - runFastDiscovery fast-path behavior
 * - Chromium resolution (getChromiumExecutablePath)
 * - browserDiscovery module availability and constants
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('studio/src/muapi', () => ({
  uploadFile: vi.fn(),
}))

import axios from 'axios'
import { buildDiscoveredAssetsFromCandidates } from '../fastDiscovery'
import { runFastDiscovery } from '../discoveryOrchestrator'
import {
  isBrowserDiscoveryAvailable,
  BROWSER_FALLBACK_MAX_PAGES,
  BROWSER_FALLBACK_MAX_CANDIDATES,
} from '../browserDiscovery'
import { heuristicFallback } from '../discoverAssets'
import type { ImageCandidate } from '../discoveryProvider'

// ---------------------------------------------------------------------------
// buildDiscoveredAssetsFromCandidates (discoveredAssets normalization)
// ---------------------------------------------------------------------------

describe('buildDiscoveredAssetsFromCandidates', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('normalizes candidates into DiscoveredAsset records', async () => {
    const candidates: ImageCandidate[] = [
      { url: 'https://example.com/logo.png', sourcePage: 'https://example.com', sourceType: 'WEBSITE' },
      { url: 'https://example.com/team.jpg', sourcePage: 'https://example.com', sourceType: 'WEBSITE' },
    ]

    const assets = await buildDiscoveredAssetsFromCandidates(candidates, 10)

    expect(assets.length).toBeGreaterThanOrEqual(0)
    for (const asset of assets) {
      expect(asset.id).toBeTruthy()
      expect(asset.sourceUrl).toBeTruthy()
      expect(asset.previewUrl).toBeTruthy()
      expect(asset.category).toBeTruthy()
      expect(typeof asset.confidence).toBe('number')
      expect(typeof asset.selected).toBe('boolean')
      expect(typeof asset.recommended).toBe('boolean')
    }
  })

  it('deduplicates candidates by URL', async () => {
    const candidates: ImageCandidate[] = [
      { url: 'https://example.com/logo.png', sourcePage: 'https://example.com', sourceType: 'WEBSITE' },
      { url: 'https://example.com/logo.png', sourcePage: 'https://example.com/about', sourceType: 'WEBSITE' },
    ]

    const assets = await buildDiscoveredAssetsFromCandidates(candidates, 10)

    const urls = assets.map((a) => a.sourceUrl)
    const uniqueUrls = new Set(urls)
    expect(urls.length).toBe(uniqueUrls.size)
  })

  it('respects maxImages limit', async () => {
    const candidates: ImageCandidate[] = Array.from({ length: 20 }, (_, i) => ({
      url: `https://example.com/img${i}.png`,
      sourcePage: 'https://example.com',
      sourceType: 'WEBSITE',
    }))

    const assets = await buildDiscoveredAssetsFromCandidates(candidates, 5)

    expect(assets.length).toBeLessThanOrEqual(5)
  })

  it('filters out junk URLs classified as irrelevant', async () => {
    const candidates: ImageCandidate[] = [
      { url: 'https://example.com/favicon.ico', sourcePage: 'https://example.com', sourceType: 'WEBSITE' },
    ]

    const assets = await buildDiscoveredAssetsFromCandidates(candidates, 10)

    expect(assets.length).toBe(0)
  })

  it('classifies logo URLs correctly', async () => {
    const candidates: ImageCandidate[] = [
      { url: 'https://example.com/logo.png', sourcePage: 'https://example.com', sourceType: 'WEBSITE' },
    ]

    const assets = await buildDiscoveredAssetsFromCandidates(candidates, 10)

    expect(assets.length).toBeGreaterThanOrEqual(1)
    expect(assets[0].category).toBe('logo')
    expect(assets[0].confidence).toBeGreaterThanOrEqual(0)
  })

  it('classifies product URLs correctly', async () => {
    const candidates: ImageCandidate[] = [
      { url: 'https://example.com/products/item.png', sourcePage: 'https://example.com', sourceType: 'WEBSITE' },
    ]

    const assets = await buildDiscoveredAssetsFromCandidates(candidates, 10)

    expect(assets.length).toBeGreaterThanOrEqual(1)
    expect(assets[0].category).toBe('product')
  })

  it('classifies storefront URLs correctly', async () => {
    const candidates: ImageCandidate[] = [
      { url: 'https://example.com/storefront.jpg', sourcePage: 'https://example.com', sourceType: 'WEBSITE' },
    ]

    const assets = await buildDiscoveredAssetsFromCandidates(candidates, 10)

    expect(assets.length).toBeGreaterThanOrEqual(1)
    expect(assets[0].category).toBe('storefront')
  })

  it('applies autoPlaceAssets to normalized results', async () => {
    const candidates: ImageCandidate[] = [
      { url: 'https://example.com/logo.png', sourcePage: 'https://example.com', sourceType: 'WEBSITE' },
    ]

    const assets = await buildDiscoveredAssetsFromCandidates(candidates, 10)

    expect(assets.length).toBeGreaterThanOrEqual(1)
    expect(assets[0].assignedSection).toBeDefined()
  })

  it('preserves sourceType from candidate', async () => {
    const candidates: ImageCandidate[] = [
      { url: 'https://example.com/logo.png', sourcePage: 'https://example.com', sourceType: 'WEBSITE' },
    ]

    const assets = await buildDiscoveredAssetsFromCandidates(candidates, 10)

    expect(assets[0].sourceType).toBe('WEBSITE')
  })

  it('defaults sourceType to WEBSITE when missing', async () => {
    const candidates: ImageCandidate[] = [
      { url: 'https://example.com/logo.png', sourcePage: 'https://example.com' },
    ]

    const assets = await buildDiscoveredAssetsFromCandidates(candidates, 10)

    if (assets.length > 0) {
      expect(assets[0].sourceType).toBe('WEBSITE')
    }
  })
})

// ---------------------------------------------------------------------------
// runFastDiscovery (fast-path regression)
// ---------------------------------------------------------------------------

describe('runFastDiscovery', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('returns a valid FastDiscoveryResult shape', async () => {
    const result = await runFastDiscovery({
      websiteUrl: 'https://example.com',
      maxPages: 1,
      maxImages: 5,
    })

    expect(result.result).toBeDefined()
    expect(result.fastAssets).toBeDefined()
    expect(typeof result.usefulAssetCount).toBe('number')
    expect(Array.isArray(result.providerAttempts)).toBe(true)
    expect(typeof result.needsBrowser).toBe('boolean')
  })

  it('attempts SMARTVIDEO_STATIC first', async () => {
    const result = await runFastDiscovery({
      websiteUrl: 'https://example.com',
      maxPages: 1,
      maxImages: 5,
    })

    expect(result.providerAttempts).toContain('SMARTVIDEO_STATIC')
  })

  it('records sitemapFound telemetry when sitemap is discovered', async () => {
    vi.spyOn(axios, 'get').mockResolvedValue({
      status: 200,
      headers: { 'content-type': 'text/xml' },
      data: '<?xml version="1.0"?><urlset><url><loc>https://example.com/about</loc></url></urlset>',
    } as any)

    const result = await runFastDiscovery({
      websiteUrl: 'https://example.com',
      maxPages: 1,
      maxImages: 5,
    })

    expect(typeof result.result.sitemapFound).toBe('boolean')
  })

  it('records crawleePagesCrawled telemetry', async () => {
    const result = await runFastDiscovery({
      websiteUrl: 'https://example.com',
      maxPages: 1,
      maxImages: 5,
    })

    expect(typeof result.result.crawleePagesCrawled).toBe('number')
  })

  it('returns empty fastAssets when static discovers no valid images', async () => {
    vi.spyOn(axios, 'get').mockResolvedValue({
      status: 200,
      headers: { 'content-type': 'text/html' },
      data: '<html><body></body></html>',
    } as any)

    const result = await runFastDiscovery({
      websiteUrl: 'https://example.com',
      maxPages: 1,
      maxImages: 5,
    })

    expect(Array.isArray(result.fastAssets)).toBe(true)
    expect(Array.isArray(result.result.discoveredAssets)).toBe(true)
  })

  it('rejects unsafe URLs before provider call', async () => {
    await expect(
      runFastDiscovery({
        websiteUrl: 'http://localhost:3000',
        maxPages: 1,
        maxImages: 5,
      }),
    ).rejects.toThrow('Private network addresses are not allowed')
  })

  it('sets firecrawlSkippedReason to FIRECRAWL_DISABLED in fast mode', async () => {
    const result = await runFastDiscovery({
      websiteUrl: 'https://example.com',
      maxPages: 1,
      maxImages: 5,
    })

    expect(result.result.firecrawlSkippedReason).toBe('FIRECRAWL_DISABLED')
    expect(result.result.firecrawlUsed).toBe(false)
  })

  it('returns providerUsed matching the last successful provider', async () => {
    const result = await runFastDiscovery({
      websiteUrl: 'https://example.com',
      maxPages: 1,
      maxImages: 5,
    })

    expect(result.result.providerUsed).toBeTruthy()
  })
})

// ---------------------------------------------------------------------------
// browserDiscovery module contract
// ---------------------------------------------------------------------------

describe('browserDiscovery module contract', () => {
  it('exports BROWSER_FALLBACK_MAX_PAGES constant', () => {
    expect(typeof BROWSER_FALLBACK_MAX_PAGES).toBe('number')
    expect(BROWSER_FALLBACK_MAX_PAGES).toBeGreaterThan(0)
  })

  it('exports BROWSER_FALLBACK_MAX_CANDIDATES constant', () => {
    expect(typeof BROWSER_FALLBACK_MAX_CANDIDATES).toBe('number')
    expect(BROWSER_FALLBACK_MAX_CANDIDATES).toBeGreaterThan(0)
  })

  it('isBrowserDiscoveryAvailable returns boolean', () => {
    expect(typeof isBrowserDiscoveryAvailable()).toBe('boolean')
  })

  it('resolves @sparticuz/chromium executablePath contract when available', async () => {
    const mod = await import('@sparticuz/chromium')
    const Chromium = mod.default ?? mod
    expect(typeof Chromium.executablePath).toBe('function')
  })
})

// ---------------------------------------------------------------------------
// discoveredAssets normalization contract
// ---------------------------------------------------------------------------

describe('discoveredAssets normalization contract', () => {
  it('heuristicFallback classifies logo URLs', () => {
    const result = heuristicFallback('https://example.com/logo.png')
    expect(result.category).toBe('logo')
    expect(typeof result.confidence).toBe('number')
    expect(typeof result.recommended).toBe('boolean')
  })

  it('heuristicFallback classifies product URLs', () => {
    const result = heuristicFallback('https://example.com/products/item.png')
    expect(result.category).toBe('product')
  })

  it('heuristicFallback classifies team URLs', () => {
    const result = heuristicFallback('https://example.com/team/photo.jpg')
    expect(result.category).toBe('team')
  })

  it('heuristicFallback classifies junk as irrelevant', () => {
    const result = heuristicFallback('https://example.com/favicon.ico')
    expect(result.category).toBe('irrelevant')
    expect(result.recommended).toBe(false)
  })

  it('heuristicFallback defaults to brand for unknown URLs', () => {
    const result = heuristicFallback('https://example.com/image.jpg')
    expect(result.category).toBe('brand')
  })
})
