/**
 * Tests for auto-placement engine.
 */

import { describe, it, expect } from 'vitest'
import { autoPlaceAssets, DEFAULT_AUTO_PLACEMENT_CONFIG } from '../autoPlacementEngine'
import type { DiscoveredAsset } from '../../shared/personalization/types'

function makeAsset(overrides: Partial<DiscoveredAsset> = {}): DiscoveredAsset {
  return {
    id: 'test-1',
    sourceUrl: 'https://example.com/asset.jpg',
    previewUrl: 'https://example.com/asset.jpg',
    sourceType: 'WEBSITE',
    category: 'brand',
    confidence: 50,
    qualityScore: 50,
    relevanceScore: 50,
    selected: false,
    recommended: false,
    rejected: false,
    assignedSection: null,
    autoAssigned: false,
    ...overrides,
  }
}

describe('autoPlaceAssets', () => {
  it('auto-places high-confidence person into person section', () => {
    const assets = [
      makeAsset({ id: '1', category: 'person', confidence: 90, recommended: true }),
    ]

    const result = autoPlaceAssets(assets)
    expect(result[0].assignedSection).toBe('person')
    expect(result[0].autoAssigned).toBe(true)
  })

  it('auto-places high-confidence logo into logo section', () => {
    const assets = [
      makeAsset({ id: '1', category: 'logo', confidence: 85, recommended: true }),
    ]

    const result = autoPlaceAssets(assets)
    expect(result[0].assignedSection).toBe('logo')
    expect(result[0].autoAssigned).toBe(true)
  })

  it('auto-places high-confidence product into products section', () => {
    const assets = [
      makeAsset({ id: '1', category: 'product', confidence: 80, recommended: true }),
    ]

    const result = autoPlaceAssets(assets)
    expect(result[0].assignedSection).toBe('products')
    expect(result[0].autoAssigned).toBe(true)
  })

  it('auto-places high-confidence storefront into brand section', () => {
    const assets = [
      makeAsset({ id: '1', category: 'storefront', confidence: 88, recommended: true }),
    ]

    const result = autoPlaceAssets(assets)
    expect(result[0].assignedSection).toBe('brand')
    expect(result[0].autoAssigned).toBe(true)
  })

  it('does not auto-place medium-confidence asset', () => {
    const assets = [
      makeAsset({ id: '1', category: 'product', confidence: 60, recommended: true }),
    ]

    const result = autoPlaceAssets(assets)
    expect(result[0].assignedSection).toBeNull()
    expect(result[0].autoAssigned).toBe(false)
  })

  it('does not auto-place low-confidence asset', () => {
    const assets = [
      makeAsset({ id: '1', category: 'logo', confidence: 30, recommended: true }),
    ]

    const result = autoPlaceAssets(assets)
    expect(result[0].assignedSection).toBeNull()
    expect(result[0].autoAssigned).toBe(false)
  })

  it('does not auto-place rejected asset', () => {
    const assets = [
      makeAsset({ id: '1', category: 'person', confidence: 90, recommended: true, rejected: true }),
    ]

    const result = autoPlaceAssets(assets)
    expect(result[0].assignedSection).toBeNull()
    expect(result[0].autoAssigned).toBe(false)
  })

  it('respects person limit of 4', () => {
    const assets = Array.from({ length: 10 }, (_, i) =>
      makeAsset({ id: String(i), category: 'person', confidence: 90, recommended: true }),
    )

    const result = autoPlaceAssets(assets, { ...DEFAULT_AUTO_PLACEMENT_CONFIG, personLimit: 4 })
    const assigned = result.filter((a) => a.assignedSection === 'person')
    expect(assigned.length).toBeLessThanOrEqual(4)
  })

  it('respects logo limit of 1', () => {
    const assets = Array.from({ length: 5 }, (_, i) =>
      makeAsset({ id: String(i), category: 'logo', confidence: 90, recommended: true }),
    )

    const result = autoPlaceAssets(assets, { ...DEFAULT_AUTO_PLACEMENT_CONFIG, logoLimit: 1 })
    const assigned = result.filter((a) => a.assignedSection === 'logo')
    expect(assigned.length).toBeLessThanOrEqual(1)
  })

  it('never auto-assigns to firstFrame, lastFrame, or ctaGraphic', () => {
    const assets = [
      makeAsset({ id: '1', category: 'person', confidence: 90, recommended: true }),
    ]

    const result = autoPlaceAssets(assets, { ...DEFAULT_AUTO_PLACEMENT_CONFIG, minConfidence: 0 })
    expect(result[0].assignedSection).not.toBe('firstFrame')
    expect(result[0].assignedSection).not.toBe('lastFrame')
    expect(result[0].assignedSection).not.toBe('ctaGraphic')
  })
})
