/**
 * Regression tests for defect I5 (Agent C):
 *   "POST /api/personalization/discover-assets returns assets with
 *    selected/recommended but autoAssigned=false and assignedSection=null
 *    for every asset."
 *
 * Root cause: heuristicFallback in src/server/discoverAssets.ts emits
 * confidence values in the 40-70 band (logo=70, team=65, product=65,
 * service=55, brand fallback=40, irrelevant=80). The auto-placement
 * engine's default `minConfidence: 70` then rejected every useful
 * candidate except `logo`, so the review panel reported
 * "0 assets assigned across 0 blocks" for any typical discovery.
 *
 * Fix: buildDiscoveredAssetsFromCandidates now normalizes the
 * classification confidence to AUTO_ASSIGN_CONFIDENCE_FLOOR (70) for
 * any recommended (selected, useful) asset before handing it to
 * autoPlaceAssets. Irrelevant / deselected assets keep their raw
 * confidence and are filtered upstream as before. The engine itself
 * is unchanged, so the existing firstFrame/lastFrame/ctaGraphic
 * NEVER_AUTO_ASSIGN guarantee, per-section limits, and the
 * `rejected`/`recommended` gates are all preserved.
 *
 * These tests prove:
 *   - realistic discoveries (logo + product + brand + team) produce
 *     NON-zero auto-assigned assets in the right sections,
 *   - unsuitable / empty inputs produce ZERO (no fabrication),
 *   - manually-removed assets stay unassigned,
 *   - never-auto-assign sections stay forbidden,
 *   - junk (favicon, pixel) is filtered before reaching the engine.
 */

import { describe, it, expect, vi } from 'vitest'

vi.mock('studio/src/muapi', () => ({
  uploadFile: vi.fn(),
}))

import { buildDiscoveredAssetsFromCandidates } from '../fastDiscovery'
import { autoPlaceAssets } from '../autoPlacementEngine'
import { heuristicFallback } from '../discoverAssets'
import type { ImageCandidate } from '../discoveryProvider'
import type { DiscoveredAsset } from '../../shared/personalization/types'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function candidate(url: string, sourceType: 'WEBSITE' | 'PUBLIC_SEARCH' = 'WEBSITE'): ImageCandidate {
  return { url, sourcePage: 'https://example.com', sourceType }
}

function assignedBySection(assets: DiscoveredAsset[]) {
  const counts: Record<string, number> = {}
  for (const a of assets) {
    if (a.assignedSection) counts[a.assignedSection] = (counts[a.assignedSection] || 0) + 1
  }
  return counts
}

// ---------------------------------------------------------------------------
// Group A: realistic discovery produces non-zero assigned assets
// ---------------------------------------------------------------------------

describe('I5: realistic discovery auto-assigns assets to composition blocks', () => {
  it('heuristic confidence values are normalized to the auto-placement gate by buildDiscoveredAssetsFromCandidates', async () => {
    // The raw heuristicFallback values intentionally stay in the 40-80
    // band (logo=70, team=65, product=65, service=55, brand fallback=40,
    // irrelevant=80). buildDiscoveredAssetsFromCandidates floors a
    // recommended asset's confidence at AUTO_ASSIGN_CONFIDENCE_FLOOR
    // (70) before handing it to autoPlaceAssets, so all useful
    // categories clear the engine's default `minConfidence: 70`.
    const rawSamples: Array<[string, string]> = [
      ['https://example.com/logo.png', 'logo'],
      ['https://example.com/team/photo.jpg', 'team'],
      ['https://example.com/products/item.png', 'product'],
      ['https://example.com/storefront.jpg', 'storefront'],
      ['https://example.com/office.jpg', 'office'],
      ['https://example.com/truck.png', 'branded_vehicle'],
      ['https://example.com/gallery/project.jpg', 'completed_work'],
      ['https://example.com/services/consulting.jpg', 'service'],
      ['https://example.com/headshot-jane.jpg', 'person'],
    ]
    for (const [url, category] of rawSamples) {
      const raw = heuristicFallback(url)
      expect(raw.category).toBe(category)
      expect(raw.recommended).toBe(true)
      const assets = await buildDiscoveredAssetsFromCandidates(
        [candidate(url)],
        5,
      )
      expect(assets.length).toBe(1)
      expect(assets[0].category).toBe(category)
      expect(assets[0].confidence).toBeGreaterThanOrEqual(70)
      expect(assets[0].autoAssigned).toBe(true)
      expect(assets[0].assignedSection).not.toBeNull()
    }
  })

  it('buildDiscoveredAssetsFromCandidates assigns logo, products, and brand from a realistic mix', async () => {
    const candidates: ImageCandidate[] = [
      candidate('https://acme-roofing.example/logo.png'),
      candidate('https://acme-roofing.example/products/shingle-a.png'),
      candidate('https://acme-roofing.example/products/shingle-b.png'),
      candidate('https://acme-roofing.example/storefront.jpg'),
      candidate('https://acme-roofing.example/office.jpg'),
      candidate('https://acme-roofing.example/team/crew.jpg'),
      candidate('https://acme-roofing.example/truck.png'),
    ]

    const assets = await buildDiscoveredAssetsFromCandidates(candidates, 20)

    expect(assets.length).toBe(7)
    const counts = assignedBySection(assets)
    expect(counts.logo).toBe(1)
    expect(counts.products).toBe(2)
    expect(counts.brand).toBeGreaterThanOrEqual(3)
    expect(counts.brand).toBeLessThanOrEqual(5)

    for (const asset of assets) {
      expect(asset.autoAssigned).toBe(true)
      expect(asset.assignedSection).not.toBeNull()
      expect(asset.selected).toBe(true)
      expect(asset.recommended).toBe(true)
      expect(asset.rejected).toBe(false)
    }

    // Header line should never include a firstFrame/lastFrame/ctaGraphic
    // assignment from a discovered remote asset.
    for (const asset of assets) {
      expect(['firstFrame', 'lastFrame', 'ctaGraphic']).not.toContain(asset.assignedSection)
    }
  })

  it('multiple logos stay within the logoLimit cap', async () => {
    const candidates: ImageCandidate[] = Array.from({ length: 5 }, (_, i) =>
      candidate(`https://example.com/logo-${i}.png`),
    )

    const assets = await buildDiscoveredAssetsFromCandidates(candidates, 20)
    const logosAssigned = assets.filter((a) => a.assignedSection === 'logo')
    expect(logosAssigned.length).toBe(1)
    expect(logosAssigned[0].autoAssigned).toBe(true)

    // Overflow logos are kept as discovered assets (selected/recommended)
    // but are not auto-assigned; the review panel can move them manually.
    const overflow = assets.filter((a) => a.category === 'logo' && !a.autoAssigned)
    expect(overflow.length).toBe(4)
    for (const a of overflow) {
      expect(a.recommended).toBe(true)
      expect(a.assignedSection).toBeNull()
    }
  })

  it('firstFrame / lastFrame / ctaGraphic are NEVER assigned by the engine', async () => {
    const assets = await autoPlaceAssets([
      {
        id: '1',
        sourceUrl: 'https://example.com/anything.png',
        previewUrl: 'https://example.com/anything.png',
        sourceType: 'WEBSITE',
        category: 'person',
        confidence: 99,
        qualityScore: 100,
        relevanceScore: 100,
        selected: true,
        recommended: true,
        rejected: false,
        assignedSection: null,
        autoAssigned: false,
      },
    ])
    expect(assets[0].assignedSection).not.toBe('firstFrame')
    expect(assets[0].assignedSection).not.toBe('lastFrame')
    expect(assets[0].assignedSection).not.toBe('ctaGraphic')
  })
})

// ---------------------------------------------------------------------------
// Group B: empty / unsuitable inputs yield ZERO (no fabrication)
// ---------------------------------------------------------------------------

describe('I5: empty / unsuitable inputs produce zero (no fabrication)', () => {
  it('returns zero discovered assets when the candidate list is empty', async () => {
    const assets = await buildDiscoveredAssetsFromCandidates([], 20)
    expect(assets).toEqual([])
    expect(assignedBySection(assets)).toEqual({})
  })

  it('returns zero discovered assets when every URL is junk', async () => {
    const candidates: ImageCandidate[] = [
      candidate('https://example.com/favicon.ico'),
      candidate('https://example.com/tracking-pixel.png'),
      candidate('https://example.com/icon-sprite.png'),
    ]
    const assets = await buildDiscoveredAssetsFromCandidates(candidates, 20)
    expect(assets).toEqual([])
  })

  it('returns zero when the engine refuses every asset (confidence below threshold)', () => {
    const result = autoPlaceAssets([
      {
        id: '1',
        sourceUrl: 'https://example.com/asset.png',
        previewUrl: 'https://example.com/asset.png',
        sourceType: 'WEBSITE',
        category: 'product',
        confidence: 40, // below the 70 gate
        qualityScore: 40,
        relevanceScore: 40,
        selected: true,
        recommended: true,
        rejected: false,
        assignedSection: null,
        autoAssigned: false,
      },
    ])
    expect(result[0].autoAssigned).toBe(false)
    expect(result[0].assignedSection).toBeNull()
  })

  it('returns zero assigned when every asset is manually rejected', () => {
    const result = autoPlaceAssets([
      {
        id: '1',
        sourceUrl: 'https://example.com/logo.png',
        previewUrl: 'https://example.com/logo.png',
        sourceType: 'WEBSITE',
        category: 'logo',
        confidence: 95,
        qualityScore: 95,
        relevanceScore: 95,
        selected: false,
        recommended: true,
        rejected: true,
        assignedSection: null,
        autoAssigned: false,
      },
    ])
    expect(result[0].autoAssigned).toBe(false)
    expect(result[0].assignedSection).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// Group C: per-category deterministic matching (logo/product/service/team)
// ---------------------------------------------------------------------------

describe('I5: deterministic category -> section mapping', () => {
  it('logo -> logo', async () => {
    const [asset] = await buildDiscoveredAssetsFromCandidates(
      [candidate('https://example.com/logo.png')],
      5,
    )
    expect(asset.category).toBe('logo')
    expect(asset.assignedSection).toBe('logo')
    expect(asset.autoAssigned).toBe(true)
  })

  it('product -> products', async () => {
    const [asset] = await buildDiscoveredAssetsFromCandidates(
      [candidate('https://example.com/products/widget.png')],
      5,
    )
    expect(asset.category).toBe('product')
    expect(asset.assignedSection).toBe('products')
    expect(asset.autoAssigned).toBe(true)
  })

  it('service -> products (service imagery joins the product rail)', async () => {
    const [asset] = await buildDiscoveredAssetsFromCandidates(
      [candidate('https://example.com/services/install.png')],
      5,
    )
    expect(asset.category).toBe('service')
    expect(asset.assignedSection).toBe('products')
    expect(asset.autoAssigned).toBe(true)
  })

  it('storefront -> brand', async () => {
    const [asset] = await buildDiscoveredAssetsFromCandidates(
      [candidate('https://example.com/storefront.jpg')],
      5,
    )
    expect(asset.category).toBe('storefront')
    expect(asset.assignedSection).toBe('brand')
    expect(asset.autoAssigned).toBe(true)
  })

  it('brand fallback for an unknown URL -> brand', async () => {
    const [asset] = await buildDiscoveredAssetsFromCandidates(
      [candidate('https://example.com/photo-12345.jpg')],
      5,
    )
    expect(asset.category).toBe('brand')
    expect(asset.assignedSection).toBe('brand')
    expect(asset.autoAssigned).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Group D: manually removed assets are honored
// ---------------------------------------------------------------------------

describe('I5: manually-removed assets stay unassigned', () => {
  it('rejected assets are never auto-assigned even when confidence is high', () => {
    const result = autoPlaceAssets([
      {
        id: 'kept',
        sourceUrl: 'https://example.com/logo.png',
        previewUrl: 'https://example.com/logo.png',
        sourceType: 'WEBSITE',
        category: 'logo',
        confidence: 95,
        qualityScore: 95,
        relevanceScore: 95,
        selected: true,
        recommended: true,
        rejected: false,
        assignedSection: null,
        autoAssigned: false,
      },
      {
        id: 'removed',
        sourceUrl: 'https://example.com/products/sku.png',
        previewUrl: 'https://example.com/products/sku.png',
        sourceType: 'WEBSITE',
        category: 'product',
        confidence: 95,
        qualityScore: 95,
        relevanceScore: 95,
        selected: false,
        recommended: true,
        rejected: true,
        assignedSection: null,
        autoAssigned: false,
      },
    ])
    expect(result[0].autoAssigned).toBe(true)
    expect(result[1].autoAssigned).toBe(false)
    expect(result[1].assignedSection).toBeNull()
  })

  it('deselected (recommended: false) assets stay unassigned', () => {
    const result = autoPlaceAssets([
      {
        id: 'noise',
        sourceUrl: 'https://example.com/some.png',
        previewUrl: 'https://example.com/some.png',
        sourceType: 'WEBSITE',
        category: 'product',
        confidence: 99,
        qualityScore: 99,
        relevanceScore: 99,
        selected: false,
        recommended: false,
        rejected: false,
        assignedSection: null,
        autoAssigned: false,
      },
    ])
    expect(result[0].autoAssigned).toBe(false)
    expect(result[0].assignedSection).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// Group E: dedup + security/limits contracts are preserved
// ---------------------------------------------------------------------------

describe('I5: discovery contracts preserved alongside the assignment fix', () => {
  it('deduplicates identical URLs before counting assignments', async () => {
    const candidates: ImageCandidate[] = [
      candidate('https://example.com/logo.png'),
      candidate('https://example.com/logo.png'),
      candidate('https://example.com/logo.png'),
    ]
    const assets = await buildDiscoveredAssetsFromCandidates(candidates, 20)
    expect(assets.length).toBe(1)
    expect(assets[0].assignedSection).toBe('logo')
  })

  it('respects maxImages cap from the caller', async () => {
    const candidates: ImageCandidate[] = Array.from({ length: 25 }, (_, i) =>
      candidate(`https://example.com/photo-${i}.jpg`),
    )
    const assets = await buildDiscoveredAssetsFromCandidates(candidates, 8)
    expect(assets.length).toBe(8)
  })

  it('filters favicon-classified URLs before the engine sees them', async () => {
    const candidates: ImageCandidate[] = [
      candidate('https://example.com/favicon.ico'),
      candidate('https://example.com/logo.png'),
    ]
    const assets = await buildDiscoveredAssetsFromCandidates(candidates, 20)
    expect(assets.length).toBe(1)
    expect(assets[0].category).toBe('logo')
    expect(assets[0].assignedSection).toBe('logo')
  })
})