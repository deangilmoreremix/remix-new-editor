// @vitest-environment jsdom
/**
 * Unit tests for the overlay editor geometry helpers, plus one jsdom
 * interaction test that drags a layer and asserts the persisted coordinates
 * are clamped into the frame's safe area.
 */

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { createElement } from 'react'
import { useDemoPersonalize } from '../../DemoPersonalizeProvider'
import { OverlayEditor } from '../OverlayEditor'
import { createDefaultPreviewSettings, createLayer } from '../../preview/presets'
import type { PreviewInputProps, PreviewLayer } from '../../preview/types'
import type { AssetLibrary, PersonalizationAsset } from '../../types'
import {
  MAX_LAYER_SCALE,
  MIN_LAYER_SCALE,
  NUDGE_STEP,
  NUDGE_STEP_LARGE,
  SAFE_AREA_MARGIN,
  boxFitsSafeArea,
  clampLayerToBounds,
  imageAssetDefaultLabel,
  imageAssetOptions,
  estimateTextLineCount,
  layerBoxMetrics,
  maxScaleThatFits,
  nudgeDeltaForKey,
  nudgeLayer,
  offsetLayer,
  resolveCompositionSize,
  scaleLayerTo,
  stageScaleFactor,
  toStageBox,
} from '../overlayGeometry'

vi.mock('../../DemoPersonalizeProvider', () => ({
  useDemoPersonalize: vi.fn(),
}))

// ── Aspect ratios the preview can render ──────────────────────────────────────

const ASPECTS = [
  { ratio: '16:9', width: 1920, height: 1080 },
  { ratio: '9:16', width: 1080, height: 1920 },
  { ratio: '1:1', width: 1080, height: 1080 },
  { ratio: '4:5', width: 1080, height: 1350 },
] as const

function asset(id: string, name: string, url: string, uploadedUrl?: string): PersonalizationAsset {
  return {
    id,
    name,
    url,
    uploadedUrl,
    role: 'logo',
    isPrimary: false,
    createdAt: '2026-01-01T00:00:00.000Z',
  }
}

const ASSETS: Partial<AssetLibrary> = {
  logos: [
    asset('logo-1', 'Main logo', 'https://cdn.example.com/logo.png', 'https://cdn.example.com/logo-uploaded.png'),
    asset('logo-2', 'Alt logo', 'https://cdn.example.com/alt.png'),
    asset('logo-3', 'Broken logo', ''),
  ],
  products: [
    asset('product-1', 'Roof', 'https://cdn.example.com/roof.png'),
    asset('product-2', 'Gutter', 'https://cdn.example.com/gutter.png', 'https://cdn.example.com/gutter-uploaded.png'),
  ],
}

const SAMPLE_LAYERS: PreviewLayer[] = [
  createLayer('logo', { x: 0, y: 0, scale: 0.22 }),
  createLayer('logo', { x: 1, y: 1, scale: 0.4 }),
  createLayer('businessName', { x: -0.4, y: 1.4, scale: 0.055, text: 'Acme Roofing' }),
  createLayer('headline', { x: 0.05, y: 0.05, scale: 0.08, text: 'A headline long enough to wrap onto two lines' }),
  createLayer('offer', { x: 0.9, y: 0.95, scale: 0.06, text: '50% off' }),
  createLayer('cta', { x: 0.5, y: 0.5, scale: 0.05, text: 'Book now' }),
  createLayer('productImage', { x: 1, y: 1, scale: 0.3 }),
]

// ── Pure geometry ─────────────────────────────────────────────────────────────

describe('resolveCompositionSize / stageScaleFactor', () => {
  it('keeps usable dimensions and falls back for missing ones', () => {
    expect(resolveCompositionSize(1920, 1080)).toEqual({ width: 1920, height: 1080 })
    expect(resolveCompositionSize(0, 0)).toEqual({ width: 1920, height: 1080 })
    expect(resolveCompositionSize(Number.NaN, -20)).toEqual({ width: 1920, height: 1080 })
  })

  it('uses one factor for both axes, 0 before the stage is measured', () => {
    expect(stageScaleFactor(960, 1920)).toBe(0.5)
    expect(stageScaleFactor(0, 1920)).toBe(0)
  })
})

describe('layerBoxMetrics', () => {
  it('derives the font size from the composition height in every aspect ratio', () => {
    const layer = createLayer('headline', { scale: 0.05, text: 'Hello' })
    expect(layerBoxMetrics(layer, 1920, 1080).fontSizePx).toBe(54) // 0.05 * 1080
    expect(layerBoxMetrics(layer, 1080, 1920).fontSizePx).toBe(96) // 0.05 * 1920
    expect(layerBoxMetrics(layer, 1080, 1080).fontSizePx).toBe(54)
    expect(layerBoxMetrics(layer, 1080, 1350).fontSizePx).toBe(68) // 0.05 * 1350
  })

  it('sizes image layers from the composition width and keeps them square', () => {
    for (const aspect of ASPECTS) {
      const metrics = layerBoxMetrics(createLayer('logo'), aspect.width, aspect.height)
      expect(metrics.isImage).toBe(true)
      expect(metrics.widthPx).toBe(Math.round(0.22 * aspect.width))
      // Square boxes come from the WIDTH fraction — never the composition height.
      expect(metrics.heightPx).toBe(metrics.widthPx)
      expect(metrics.fontSizePx).toBe(0)
    }
  })

  it('estimates text height from the line height and the wrap count', () => {
    const short = layerBoxMetrics(createLayer('headline', { scale: 0.05, text: 'Hi' }), 1920, 1080)
    expect(short.heightPx).toBe(Math.round(54 * 1.15))
    const wrapping = layerBoxMetrics(
      createLayer('headline', { scale: 0.05, text: 'word '.repeat(40).trim() }),
      1920,
      1080,
    )
    expect(wrapping.heightPx).toBeGreaterThan(short.heightPx)

    // Wrap count uses toBox's own character width, on the unrounded box width.
    expect(estimateTextLineCount('Acme Roofing', 59, 389.4)).toBe(1)
    expect(estimateTextLineCount('x'.repeat(200), 59, 1728)).toBe(4)
    expect(estimateTextLineCount('', 59, 1728)).toBe(1)
    expect(estimateTextLineCount('x'.repeat(5000), 59, 1728)).toBe(8) // capped
  })
})

describe('clampLayerToBounds', () => {
  it('keeps every box inside the safe area for every aspect ratio', () => {
    for (const aspect of ASPECTS) {
      for (const layer of SAMPLE_LAYERS) {
        const clamped = clampLayerToBounds(layer, aspect.width, aspect.height)
        const metrics = layerBoxMetrics(clamped, aspect.width, aspect.height)

        expect(boxFitsSafeArea(metrics, aspect.width, aspect.height)).toBe(true)
        expect(clamped.scale).toBeGreaterThanOrEqual(MIN_LAYER_SCALE)
        expect(clamped.scale).toBeLessThanOrEqual(MAX_LAYER_SCALE)
        expect(clamped.x).toBeGreaterThanOrEqual(SAFE_AREA_MARGIN - 1e-6)
        expect(clamped.x).toBeLessThanOrEqual(1 - SAFE_AREA_MARGIN + 1e-6)
        expect(clamped.y).toBeGreaterThanOrEqual(SAFE_AREA_MARGIN - 1e-6)
        expect(clamped.y).toBeLessThanOrEqual(1 - SAFE_AREA_MARGIN + 1e-6)
        expect(metrics.leftPx).toBeGreaterThanOrEqual(-1e-6)
        expect(metrics.topPx).toBeGreaterThanOrEqual(-1e-6)
        expect(metrics.leftPx + metrics.widthPx).toBeLessThanOrEqual(aspect.width + 1e-6)
        expect(metrics.topPx + metrics.heightPx).toBeLessThanOrEqual(aspect.height + 1e-6)
      }
    }
  })

  it('leaves already in-bounds layers untouched', () => {
    const layer = createLayer('businessName', { x: 0.5, y: 0.5, scale: 0.055, text: 'Acme Roofing' })
    for (const aspect of ASPECTS) {
      const clamped = clampLayerToBounds(layer, aspect.width, aspect.height)
      expect(clamped.x).toBeCloseTo(layer.x, 6)
      expect(clamped.y).toBeCloseTo(layer.y, 6)
      expect(clamped.scale).toBeCloseTo(layer.scale, 6)
    }
  })

  it('clamps scale to the absolute range', () => {
    for (const aspect of ASPECTS) {
      const tooSmall = clampLayerToBounds(createLayer('logo', { scale: 0.001 }), aspect.width, aspect.height)
      expect(tooSmall.scale).toBe(MIN_LAYER_SCALE)

      const tooLarge = clampLayerToBounds(createLayer('logo', { scale: 9 }), aspect.width, aspect.height)
      expect(tooLarge.scale).toBeLessThanOrEqual(MAX_LAYER_SCALE)
      expect(tooLarge.scale).toBeGreaterThanOrEqual(MIN_LAYER_SCALE)
    }
  })

  it('shrinks an oversized image to the largest scale that still fits', () => {
    // 16:9 is height limited: the square box may only be as tall as the frame.
    const wide = clampLayerToBounds(createLayer('logo', { x: 0.5, y: 0.5, scale: 1.5 }), 1920, 1080)
    expect(wide.scale).toBeCloseTo((1080 * (1 - SAFE_AREA_MARGIN * 2)) / 1920, 3)
    expect(maxScaleThatFits(createLayer('logo'), 1920, 1080)).toBeCloseTo(0.54, 3)

    // 9:16 is width limited: the same square box may fill the frame width.
    const tall = clampLayerToBounds(createLayer('logo', { x: 0.5, y: 0.5, scale: 1.5 }), 1080, 1920)
    expect(tall.scale).toBeCloseTo(1 - SAFE_AREA_MARGIN * 2, 2)
    expect(maxScaleThatFits(createLayer('logo'), 1080, 1920)).toBeCloseTo(0.96, 2)

    // A 1:1 frame sits between the two.
    expect(maxScaleThatFits(createLayer('logo'), 1080, 1080)).toBeCloseTo(0.96, 2)
    expect(maxScaleThatFits(createLayer('logo'), 1080, 1350)).toBeCloseTo(0.96, 2)
  })

  it('pulls centers that sit outside the frame back inside the inset', () => {
    const layer = createLayer('logo', { x: 0, y: 1, scale: 0.22 })
    const clamped = clampLayerToBounds(layer, 1920, 1080)
    const metrics = layerBoxMetrics(clamped, 1920, 1080)
    const halfW = metrics.widthPx / 2 / 1920
    const halfH = metrics.heightPx / 2 / 1080
    expect(clamped.x).toBeCloseTo(SAFE_AREA_MARGIN + halfW, 6)
    expect(clamped.y).toBeCloseTo(1 - SAFE_AREA_MARGIN - halfH, 6)
  })

  it('is pure: it never mutates the input layer', () => {
    const layer = createLayer('logo', { x: 5, y: -5, scale: 4 })
    const snapshot = { ...layer }
    clampLayerToBounds(layer, 1920, 1080)
    expect(layer).toEqual(snapshot)
  })
})

describe('offsetLayer / scaleLayerTo / nudgeLayer', () => {
  it('clamps a drag offset instead of leaving the frame', () => {
    const layer = createLayer('logo', { x: 0.5, y: 0.5, scale: 0.22 })
    const moved = offsetLayer(layer, 5, 5, 1920, 1080)
    const metrics = layerBoxMetrics(moved, 1920, 1080)
    expect(moved.x).toBeCloseTo(1 - SAFE_AREA_MARGIN - (metrics.widthPx / 2 / 1920), 6)
    expect(moved.y).toBeCloseTo(1 - SAFE_AREA_MARGIN - (metrics.heightPx / 2 / 1080), 6)

    const back = offsetLayer(layer, -5, -5, 1920, 1080)
    expect(back.x).toBeCloseTo(SAFE_AREA_MARGIN + (metrics.widthPx / 2 / 1920), 6)
    expect(back.y).toBeCloseTo(SAFE_AREA_MARGIN + (metrics.heightPx / 2 / 1080), 6)
  })

  it('nudges by 1% per press and 5% with Shift', () => {
    const layer = createLayer('businessName', { x: 0.5, y: 0.5, scale: 0.055, text: 'Acme Roofing' })
    expect(nudgeLayer(layer, NUDGE_STEP, 0, 1920, 1080).x).toBeCloseTo(0.51, 6)
    expect(nudgeLayer(layer, 0, -NUDGE_STEP, 1920, 1080).y).toBeCloseTo(0.49, 6)
    expect(nudgeLayer(layer, NUDGE_STEP_LARGE, NUDGE_STEP_LARGE, 1920, 1080).x).toBeCloseTo(0.55, 6)
    expect(nudgeLayer(layer, NUDGE_STEP_LARGE, NUDGE_STEP_LARGE, 1920, 1080).y).toBeCloseTo(0.55, 6)
  })

  it('maps arrow keys to nudge deltas', () => {
    expect(nudgeDeltaForKey('ArrowLeft')).toEqual({ dx: -NUDGE_STEP, dy: 0 })
    expect(nudgeDeltaForKey('ArrowRight')).toEqual({ dx: NUDGE_STEP, dy: 0 })
    expect(nudgeDeltaForKey('ArrowUp')).toEqual({ dx: 0, dy: -NUDGE_STEP })
    expect(nudgeDeltaForKey('ArrowDown')).toEqual({ dx: 0, dy: NUDGE_STEP })
    expect(nudgeDeltaForKey('ArrowRight', true)).toEqual({ dx: NUDGE_STEP_LARGE, dy: 0 })
    expect(nudgeDeltaForKey('ArrowDown', true)).toEqual({ dx: 0, dy: NUDGE_STEP_LARGE })
    expect(nudgeDeltaForKey('a')).toBeNull()
  })

  it('applies a resize and re-clamps the scale', () => {
    const layer = createLayer('logo', { x: 0.5, y: 0.5, scale: 0.22 })
    expect(scaleLayerTo(layer, 0.4, 1920, 1080).scale).toBeCloseTo(0.4, 6)
    const oversized = scaleLayerTo(layer, 4, 1920, 1080)
    expect(oversized.scale).toBeCloseTo(maxScaleThatFits(layer, 1920, 1080), 6)
    expect(scaleLayerTo(layer, 0, 1920, 1080).scale).toBe(MIN_LAYER_SCALE)
  })
})

describe('toStageBox', () => {
  it('mirrors the composition geometry at any stage width, for every aspect ratio', () => {
    for (const aspect of ASPECTS) {
      const stageWidth = 480
      const factor = stageScaleFactor(stageWidth, aspect.width)

      const image = createLayer('logo', { x: 0.4, y: 0.6, scale: 0.2 })
      const imageStage = toStageBox(image, aspect.width, aspect.height, stageWidth)
      const imageComp = layerBoxMetrics(clampLayerToBounds(image, aspect.width, aspect.height), aspect.width, aspect.height)
      expect(imageStage.left).toBeCloseTo(imageComp.leftPx * factor, 6)
      expect(imageStage.top).toBeCloseTo(imageComp.topPx * factor, 6)
      expect(imageStage.width).toBeCloseTo(imageComp.widthPx * factor, 6)
      expect(imageStage.height).toBeCloseTo(imageComp.widthPx * factor, 6)

      const text = createLayer('headline', { x: 0.4, y: 0.6, scale: 0.045, text: 'Hello' })
      const textStage = toStageBox(text, aspect.width, aspect.height, stageWidth)
      const textComp = layerBoxMetrics(clampLayerToBounds(text, aspect.width, aspect.height), aspect.width, aspect.height)
      expect(textStage.fontSize).toBeCloseTo(textComp.fontSizePx * factor, 6)
      expect(textStage.height).toBeUndefined()
    }
  })

  it('keeps the on-stage width fraction aspect invariant and the height fraction not', () => {
    const widths = ASPECTS.map((aspect) => toStageBox(createLayer('logo'), aspect.width, aspect.height, 900).width)
    for (const width of widths) expect((width ?? 0) / 900).toBeCloseTo(0.22, 2)

    const heights = ASPECTS.map((aspect) => toStageBox(createLayer('logo'), aspect.width, aspect.height, 900).height)
    // Square in every aspect ratio, up to toBox's whole-pixel rounding.
    for (const height of heights) expect(Math.abs((height ?? 0) - (widths[0] ?? 0))).toBeLessThanOrEqual(1)

    // Relative height inside the frame depends on the composition's height.
    const wide = (toStageBox(createLayer('logo'), 1920, 1080, 900).height ?? 0) / (900 * (1080 / 1920))
    const tall = (toStageBox(createLayer('logo'), 1080, 1920, 900).height ?? 0) / (900 * (1920 / 1080))
    expect(wide).toBeGreaterThan(tall)
  })
})

describe('imageAssetOptions', () => {
  it('offers the logo library for the logo layer', () => {
    const options = imageAssetOptions(createLayer('logo'), ASSETS)
    expect(options).toEqual([
      { value: 'https://cdn.example.com/logo-uploaded.png', label: 'Main logo' },
      { value: 'https://cdn.example.com/alt.png', label: 'Alt logo' },
    ])
  })

  it('offers the product library for product and service images', () => {
    const options = imageAssetOptions(createLayer('productImage'), ASSETS)
    expect(options).toEqual([
      { value: 'https://cdn.example.com/roof.png', label: 'Roof' },
      { value: 'https://cdn.example.com/gutter-uploaded.png', label: 'Gutter' },
    ])
    expect(imageAssetOptions(createLayer('serviceImage'), ASSETS)).toEqual(options)
    expect(imageAssetOptions(createLayer('serviceImage'), {})).toEqual([])
  })

  it('offers nothing for text layers and labels the fallback option', () => {
    expect(imageAssetOptions(createLayer('headline'), ASSETS)).toEqual([])
    expect(imageAssetDefaultLabel('logo')).toBe('Use your logo')
    expect(imageAssetDefaultLabel('productImage')).toBe('Use your photo')
    expect(imageAssetDefaultLabel('serviceImage')).toBe('Use your photo')
  })
})

// ── One jsdom interaction test: drag + nudge + asset swap ────────────────────

const STAGE_WIDTH = 960
const STAGE_HEIGHT = 540

beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
    configurable: true,
    get: () => STAGE_WIDTH,
  })
  Element.prototype.getBoundingClientRect = function getBoundingClientRect() {
    return {
      width: STAGE_WIDTH,
      height: STAGE_HEIGHT,
      top: 0,
      left: 0,
      right: STAGE_WIDTH,
      bottom: STAGE_HEIGHT,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    } as DOMRect
  }
})

beforeEach(() => {
  vi.mocked(useDemoPersonalize).mockReset()
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

const INPUT_PROPS: PreviewInputProps = {
  videoUrl: null,
  posterUrl: null,
  isImageSource: false,
  audioUrl: null,
  settings: createDefaultPreviewSettings(),
  brand: {
    businessName: 'Acme Roofing',
    headline: 'Roofs that last',
    offer: '10% off',
    cta: 'Book now',
    phone: '555-0100',
    website: 'acme.test',
    logoUrl: 'https://cdn.example.com/logo.png',
    productUrl: 'https://cdn.example.com/product.png',
    serviceUrl: null,
  },
}

interface EditorStub {
  updatePreviewLayer: ReturnType<typeof vi.fn>
}

function renderEditor(layers: PreviewLayer[]): EditorStub {
  const updatePreviewLayer = vi.fn()
  const settings = { ...createDefaultPreviewSettings(), layers }
  vi.mocked(useDemoPersonalize).mockReturnValue({
    previewSettings: settings,
    updatePreviewLayer,
    updatePreviewComposition: vi.fn(),
    resetPreviewLayout: vi.fn(),
    assets: ASSETS,
  } as unknown as ReturnType<typeof useDemoPersonalize>)
  render(createElement(OverlayEditor, { inputProps: { ...INPUT_PROPS, settings } }))
  return { updatePreviewLayer }
}

describe('OverlayEditor interaction', () => {
  it('drags a layer and persists coordinates clamped into the frame', () => {
    const layers = [createLayer('logo', { x: 0.5, y: 0.5, scale: 0.22 })]
    const { updatePreviewLayer } = renderEditor(layers)
    const box = screen.getByRole('button', { name: 'Move Logo' })

    act(() => {
      fireEvent.pointerDown(box, { clientX: 400, clientY: 200, pointerId: 1 })
    })
    act(() => {
      fireEvent.pointerMove(window, { clientX: 460, clientY: 200, pointerId: 1 })
    })
    // dx = 60 stage px / 960 = 6.25% of the frame width.
    expect(updatePreviewLayer).toHaveBeenLastCalledWith('logo', { x: 0.5625, y: 0.5 })

    act(() => {
      fireEvent.pointerMove(window, { clientX: 5000, clientY: 5000, pointerId: 1 })
    })
    const calls = updatePreviewLayer.mock.calls
    const lastPatch = calls[calls.length - 1][1]
    const metrics = layerBoxMetrics(clampLayerToBounds(layers[0], 1920, 1080), 1920, 1080)
    const maxX = 1 - SAFE_AREA_MARGIN - (metrics.widthPx / 2 / 1920)
    const maxY = 1 - SAFE_AREA_MARGIN - (metrics.heightPx / 2 / 1080)
    expect(lastPatch.x).toBeCloseTo(maxX, 4)
    expect(lastPatch.y).toBeCloseTo(maxY, 4)
    expect(lastPatch.x).toBeLessThanOrEqual(maxX)
    expect(lastPatch.y).toBeLessThanOrEqual(maxY)

    const callsBeforeUp = updatePreviewLayer.mock.calls.length
    act(() => {
      fireEvent.pointerUp(window, { pointerId: 1 })
    })
    act(() => {
      fireEvent.pointerMove(window, { clientX: 10, clientY: 10, pointerId: 1 })
    })
    expect(updatePreviewLayer.mock.calls.length).toBe(callsBeforeUp)
  })

  it('nudges the focused layer with the arrow keys and hides it with Delete', () => {
    const layers = [createLayer('businessName', { x: 0.5, y: 0.5, scale: 0.055, text: 'Acme Roofing' })]
    const { updatePreviewLayer } = renderEditor(layers)
    const box = screen.getByRole('button', { name: 'Move Business name' })

    act(() => {
      fireEvent.keyDown(box, { key: 'ArrowRight' })
    })
    expect(updatePreviewLayer).toHaveBeenLastCalledWith('businessName', { x: 0.51, y: 0.5 })

    act(() => {
      fireEvent.keyDown(box, { key: 'ArrowDown', shiftKey: true })
    })
    expect(updatePreviewLayer).toHaveBeenLastCalledWith('businessName', { x: 0.5, y: 0.55 })

    act(() => {
      fireEvent.keyDown(box, { key: 'Delete' })
    })
    expect(updatePreviewLayer).toHaveBeenLastCalledWith('businessName', { visible: false })
  })

  it('swaps the image asset and clears it back to the brand fallback', () => {
    const layers = [createLayer('logo', { x: 0.08, y: 0.08, scale: 0.22 })]
    const { updatePreviewLayer } = renderEditor(layers)
    const select = screen.getByRole('combobox', { name: 'Layer image' }) as HTMLSelectElement

    expect(Array.from(select.options).map((option) => option.value)).toEqual([
      '',
      'https://cdn.example.com/logo-uploaded.png',
      'https://cdn.example.com/alt.png',
    ])

    act(() => {
      fireEvent.change(select, { target: { value: 'https://cdn.example.com/alt.png' } })
    })
    expect(updatePreviewLayer).toHaveBeenLastCalledWith('logo', {
      imageUrl: 'https://cdn.example.com/alt.png',
    })

    act(() => {
      fireEvent.change(select, { target: { value: '' } })
    })
    expect(updatePreviewLayer).toHaveBeenLastCalledWith('logo', { imageUrl: undefined })
  })
})
