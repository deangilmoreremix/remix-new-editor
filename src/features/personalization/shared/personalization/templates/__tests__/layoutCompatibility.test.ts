import { describe, it, expect } from 'vitest'
import {
  LAYER_IDS_BY_LAYOUT,
  normalizePreviewSettings,
  PREVIEW_LAYOUTS,
} from '../../preview/presets'
import { DEFAULT_PREVIEW_BRAND_COLORS } from '../../preview/types'

/**
 * The Remotion design registry is a SEPARATE registry from the preview layout
 * presets: designs never become layouts. These tests pin that contract so a
 * future change cannot quietly grow the customer-facing layout list or break
 * projects that were saved before the design registry existed.
 */
describe('preview layouts stay untouched by the design registry', () => {
  it('exposes exactly the five customer-facing layouts', () => {
    expect(PREVIEW_LAYOUTS).toHaveLength(5)
    expect(PREVIEW_LAYOUTS.map((layout) => layout.id)).toEqual([
      'business-introduction',
      'product-showcase',
      'service-promotion',
      'special-offer',
      'branded-ending',
    ])
  })

  it('keeps every layout free of design layers', () => {
    for (const layout of PREVIEW_LAYOUTS) {
      expect(LAYER_IDS_BY_LAYOUT[layout.id].some((kind) => kind === 'design')).toBe(false)
    }
  })

  it('restores legacy persisted settings without a remotionDesignId', () => {
    const legacy = {
      layout: 'product-showcase',
      layers: [
        {
          id: 'logo',
          kind: 'logo',
          visible: true,
          x: 0.08,
          y: 0.08,
          scale: 0.22,
          animation: 'logo-reveal',
          animationDelay: 0,
          startFrame: 0,
          opacity: 1,
          imageUrl: 'https://cdn.example.com/logo.png',
        },
        { id: 'headline', kind: 'headline', text: 'Legacy headline' },
      ],
      brandColors: DEFAULT_PREVIEW_BRAND_COLORS,
      aspectRatio: '16:9',
      fps: 30,
      durationInFrames: 150,
      showEndCard: true,
      width: 1920,
      height: 1080,
      audio: null,
    }

    const normalized = normalizePreviewSettings(legacy)

    expect(normalized.remotionDesignId).toBeNull()
    expect(normalized.layout).toBe('product-showcase')
    expect(normalized.layers.map((layer) => layer.kind)).toEqual(['logo', 'headline'])
    expect(normalized.layers[1].text).toBe('Legacy headline')
  })

  it('never throws on a legacy payload with no design fields', () => {
    for (const raw of [null, undefined, 'nope', 42, true, [], {}]) {
      const normalized = normalizePreviewSettings(raw)
      expect(normalized.remotionDesignId).toBeNull()
      expect(normalized.layers.length).toBeGreaterThan(0)
    }
  })
})
