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
import { rotatedExtent } from '../../preview/rotation'
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

describe('OverlayEditor undo/redo shortcuts', () => {
  function renderWithHistory() {
    const undoPreview = vi.fn()
    const redoPreview = vi.fn()
    const layers = [createLayer('logo', { x: 0.2, y: 0.5 })]
    const settings = { ...createDefaultPreviewSettings(), layers }
    vi.mocked(useDemoPersonalize).mockReturnValue({
      previewSettings: settings, updatePreviewLayer: vi.fn(), updatePreviewComposition: vi.fn(), resetPreviewLayout: vi.fn(), assets: ASSETS,
      undoPreview, redoPreview, canUndoPreview: true, canRedoPreview: true,
    } as unknown as ReturnType<typeof useDemoPersonalize>)
    render(createElement(OverlayEditor, { inputProps: { ...INPUT_PROPS, settings } }))
    return { undoPreview, redoPreview }
  }

  it('Ctrl/Cmd+Z undoes and Ctrl+Shift+Z / Ctrl+Y redo, when focus is on a layer', () => {
    const { undoPreview, redoPreview } = renderWithHistory()
    const box = screen.getByRole('button', { name: 'Move Logo' })
    act(() => { fireEvent.keyDown(box, { key: 'z', ctrlKey: true }) })
    expect(undoPreview).toHaveBeenCalledTimes(1)
    act(() => { fireEvent.keyDown(box, { key: 'z', metaKey: true }) })
    expect(undoPreview).toHaveBeenCalledTimes(2)
    act(() => { fireEvent.keyDown(box, { key: 'z', ctrlKey: true, shiftKey: true }) })
    act(() => { fireEvent.keyDown(box, { key: 'y', ctrlKey: true }) })
    expect(redoPreview).toHaveBeenCalledTimes(2)
  })

  it('leaves undo to a text field when typing in one', () => {
    const { undoPreview } = renderWithHistory()
    const field = document.createElement('input')
    field.type = 'text'
    screen.getByRole('button', { name: 'Move Logo' }).parentElement!.appendChild(field)
    act(() => { fireEvent.keyDown(field, { key: 'z', ctrlKey: true }) })
    expect(undoPreview).not.toHaveBeenCalled()
  })

  it('ignores a plain z and Alt combos', () => {
    const { undoPreview } = renderWithHistory()
    const box = screen.getByRole('button', { name: 'Move Logo' })
    act(() => { fireEvent.keyDown(box, { key: 'z' }) })
    act(() => { fireEvent.keyDown(box, { key: 'z', ctrlKey: true, altKey: true }) })
    expect(undoPreview).not.toHaveBeenCalled()
  })
})

describe('OverlayEditor floating toolbar', () => {
  it('shows actions for the selected layer and hides it from the toolbar', () => {
    const layers = [createLayer('logo', { x: 0.2, y: 0.5 }), createLayer('headline', { x: 0.6, y: 0.5 })]
    const { updatePreviewLayer } = renderEditor(layers)
    const toolbars = screen.getAllByTestId('layer-toolbar')
    expect(toolbars).toHaveLength(1) // only the selected layer has one
    act(() => { fireEvent.click(screen.getByTestId('layer-toolbar-hide')) })
    expect(updatePreviewLayer).toHaveBeenCalledWith('logo', { visible: false })
  })

  it('disables Send backward for the bottom layer and Bring forward for the top layer', () => {
    const layers = [createLayer('logo', { x: 0.2, y: 0.5 }), createLayer('headline', { x: 0.6, y: 0.5 })]
    renderEditor(layers) // the first layer (logo) is selected and is at the bottom of the stack
    expect((screen.getByTestId('layer-toolbar-backward') as HTMLButtonElement).disabled).toBe(true)
    expect((screen.getByTestId('layer-toolbar-forward') as HTMLButtonElement).disabled).toBe(false)
  })

  it('clicking a toolbar button does not start a drag or deselect', () => {
    const layers = [createLayer('logo', { x: 0.2, y: 0.5 })]
    const { updatePreviewLayer } = renderEditor(layers)
    act(() => { fireEvent.pointerDown(screen.getByTestId('layer-toolbar-hide'), { clientX: 10, clientY: 10, pointerId: 3 }) })
    act(() => { fireEvent.pointerMove(window, { clientX: 400, clientY: 300, pointerId: 3 }) })
    expect(updatePreviewLayer).not.toHaveBeenCalled()
  })
})

describe('OverlayEditor interaction', () => {
  it('snaps a dragged layer edge onto the right-third line and draws a guide, and Alt bypasses it', () => {
    const layers = [createLayer('logo', { x: 0.5, y: 0.5, scale: 0.22 })]
    const { updatePreviewLayer } = renderEditor(layers)
    const box = screen.getByRole('button', { name: 'Move Logo' })
    act(() => { fireEvent.pointerDown(box, { clientX: 400, clientY: 200, pointerId: 1 }) })
    // dx = 6.25%: the logo's right edge lands 0.6% past the 2/3 line, inside the snap range.
    act(() => { fireEvent.pointerMove(window, { clientX: 460, clientY: 200, pointerId: 1 }) })
    const snapped = updatePreviewLayer.mock.calls.at(-1)![1]
    expect(snapped.x).toBeLessThan(0.5625)
    expect(screen.getByTestId('snap-guide-x')).toBeTruthy()
    // Holding Alt turns snapping off for that move.
    act(() => { fireEvent.pointerMove(window, { clientX: 460, clientY: 200, pointerId: 1, altKey: true }) })
    expect(updatePreviewLayer).toHaveBeenLastCalledWith('logo', { x: 0.5625, y: 0.5 })
    expect(screen.queryByTestId('snap-guide-x')).toBeNull()
    act(() => { fireEvent.pointerUp(window, { pointerId: 1 }) })
  })

  it('the Snap toggle switches snapping off and on', () => {
    renderEditor([createLayer('logo', { x: 0.5, y: 0.5, scale: 0.22 })])
    const toggle = screen.getByTestId('editor-snap')
    expect(toggle.getAttribute('aria-pressed')).toBe('true')
    act(() => { fireEvent.click(toggle) })
    expect(toggle.getAttribute('aria-pressed')).toBe('false')
    expect(toggle.textContent).toContain('Off')
  })

  it('drags a layer and persists coordinates clamped into the frame', () => {
    const layers = [createLayer('logo', { x: 0.5, y: 0.5, scale: 0.22 })]
    const { updatePreviewLayer } = renderEditor(layers)
    act(() => { fireEvent.click(screen.getByTestId('editor-snap')) }) // exact pointer coordinates: snapping off
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

// ── Rotated layers are bounded by their rotated bounding box ──────────────────

describe('rotated layers', () => {
  const W = 1920
  const H = 1080
  const margin = (v: number) => v * SAFE_AREA_MARGIN
  const aabb = (layer: PreviewLayer) => {
    const m = layerBoxMetrics(layer, W, H)
    const ext = rotatedExtent(m.widthPx, m.heightPx, layer.rotation ?? 0)
    const cx = m.leftPx + m.widthPx / 2
    const cy = m.topPx + m.heightPx / 2
    return { left: cx - ext.w / 2, right: cx + ext.w / 2, top: cy - ext.h / 2, bottom: cy + ext.h / 2 }
  }

  it('an unrotated layer clamps exactly as before', () => {
    const base = createLayer('logo', { x: 0.99, y: 0.5, scale: 0.2 })
    const a = clampLayerToBounds({ ...base, rotation: 0 }, W, H)
    const b = clampLayerToBounds(base, W, H)
    expect([a.x, a.y, a.scale]).toEqual([b.x, b.y, b.scale])
  })

  it('keeps a rotated logo dragged past every edge inside the safe area', () => {
    for (const [x, y] of [[0, 0], [1, 0], [0, 1], [1, 1], [0.5, 0], [0.5, 1]] as const) {
      const out = clampLayerToBounds(createLayer('logo', { x, y, scale: 0.2, rotation: 33 }), W, H)
      const b = aabb(out)
      expect(b.left).toBeGreaterThanOrEqual(margin(W) - 1)
      expect(b.right).toBeLessThanOrEqual(W - margin(W) + 1)
      expect(b.top).toBeGreaterThanOrEqual(margin(H) - 1)
      expect(b.bottom).toBeLessThanOrEqual(H - margin(H) + 1)
    }
  })

  it('does not move a rotated layer that already fits', () => {
    const l = createLayer('logo', { x: 0.5, y: 0.5, scale: 0.15, rotation: 20 })
    const out = clampLayerToBounds(l, W, H)
    expect(out.x).toBeCloseTo(0.5, 6)
    expect(out.y).toBeCloseTo(0.5, 6)
  })

  it('a rotated layer is limited to a smaller scale than the same layer unrotated (its rotated box is bigger)', () => {
    const flat = maxScaleThatFits(createLayer('logo', { x: 0.5, y: 0.5, rotation: 0 }), W, H)
    const turned = maxScaleThatFits(createLayer('logo', { x: 0.5, y: 0.5, rotation: 45 }), W, H)
    expect(turned).toBeLessThanOrEqual(flat)
  })

  it('keeps rotated text inside the frame too', () => {
    const out = clampLayerToBounds({ ...createLayer('headline', { x: 0.02, y: 0.98, scale: 0.06, rotation: -15 }), text: 'A fairly long headline for this frame' }, W, H)
    const m = layerBoxMetrics(out, W, H, out.text)
    const ext = rotatedExtent(m.widthPx, m.heightPx, -15)
    const cx = m.leftPx + m.widthPx / 2
    const cy = m.topPx + m.heightPx / 2
    expect(cx - ext.w / 2).toBeGreaterThanOrEqual(margin(W) - 2)
    expect(cy + ext.h / 2).toBeLessThanOrEqual(H - margin(H) + 2)
  })
})

// ── Eight resize handles and the rotation handle ─────────────────────────────

describe('OverlayEditor handles', () => {
  // Stage is 960 x 540 for a 1920 x 1080 frame, so 1 stage px = 2 frame px.
  const logo = () => createLayer('logo', { x: 0.5, y: 0.5, scale: 0.2 }) // 384 px square, left 768 top 348 (frame px)
  const last = (fn: ReturnType<typeof vi.fn>) => fn.mock.calls.at(-1)![1] as Record<string, number>

  function drag(handleTestId: string, to: { x: number; y: number }, init: Record<string, unknown> = {}) {
    const handle = screen.getByTestId(handleTestId)
    act(() => { fireEvent.pointerDown(handle, { clientX: 0, clientY: 0, pointerId: 7 }) })
    act(() => { fireEvent.pointerMove(window, { clientX: to.x, clientY: to.y, pointerId: 7, ...init }) })
    act(() => { fireEvent.pointerUp(window, { pointerId: 7 }) })
  }

  it('shows eight resize handles on the selected layer: the bottom-right keeps its plain name, the rest say where they are', () => {
    renderEditor([logo()])
    for (const id of ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w']) expect(screen.getByTestId(`resize-handle-${id}`)).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Resize Logo' })).toBe(screen.getByTestId('resize-handle-se'))
    expect(screen.getByRole('button', { name: 'Resize Logo (top left)' })).toBe(screen.getByTestId('resize-handle-nw'))
    expect(screen.getByRole('button', { name: 'Resize Logo (right)' })).toBe(screen.getByTestId('resize-handle-e'))
  })

  it('a corner drag keeps the opposite corner fixed and the proportions', () => {
    const { updatePreviewLayer } = renderEditor([logo()])
    // se corner is at stage (576, 366); the anchor (nw) is at (384, 174). Drag to 1.5x the distance along the diagonal.
    drag('resize-handle-se', { x: 384 + 288, y: 174 + 288 })
    const p = last(updatePreviewLayer)
    expect(p.scale).toBeCloseTo(0.3, 3)
    const left = p.x * 1920 - (p.scale * 1920) / 2
    const top = p.y * 1080 - (p.scale * 1920) / 2
    expect(left).toBeCloseTo(768, 0)
    expect(top).toBeCloseTo(348, 0)
  })

  it('the top-left corner anchors the bottom-right corner instead', () => {
    const { updatePreviewLayer } = renderEditor([logo()])
    // nw corner at stage (384, 174), anchor se at (576, 366). Shrink to half the distance.
    drag('resize-handle-nw', { x: 576 - 96, y: 366 - 96 })
    const p = last(updatePreviewLayer)
    expect(p.scale).toBeCloseTo(0.1, 3)
    const right = p.x * 1920 + (p.scale * 1920) / 2
    const bottom = p.y * 1080 + (p.scale * 1920) / 2
    expect(right).toBeCloseTo(1152, 0)
    expect(bottom).toBeCloseTo(732, 0)
  })

  it('an edge handle resizes along its axis only: dragging the right edge sideways changes nothing, and up/down does nothing', () => {
    const { updatePreviewLayer } = renderEditor([logo()])
    // right edge midpoint at stage (576, 270); anchor = left edge midpoint (384, 270)
    drag('resize-handle-e', { x: 576, y: 480 }) // straight down: no change in factor
    expect(last(updatePreviewLayer).scale).toBeCloseTo(0.2, 3)
    updatePreviewLayer.mockClear()
    drag('resize-handle-e', { x: 384 + 288, y: 270 }) // 1.5x along the axis
    expect(last(updatePreviewLayer).scale).toBeCloseTo(0.3, 3)
  })

  it('a locked layer ignores resize drags', () => {
    const { updatePreviewLayer } = renderEditor([{ ...logo(), locked: true }])
    drag('resize-handle-se', { x: 900, y: 500 })
    expect(updatePreviewLayer).not.toHaveBeenCalled()
  })

  it('design layers never get a rotation handle', () => {
    renderEditor([{ ...createLayer('design'), designId: 'animated-headline' }])
    expect(screen.queryByTestId('rotate-handle')).toBeNull()
  })

  it('shows a rotation handle only on rotatable, unlocked layers', () => {
    renderEditor([logo()])
    expect(screen.getByRole('slider', { name: 'Rotate Logo' })).toBeTruthy()
    cleanup()
    renderEditor([{ ...logo(), locked: true }])
    expect(screen.queryByTestId('rotate-handle')).toBeNull()
  })

  it('dragging the rotation handle to the right of the layer rotates it 90 degrees; Shift snaps to 15', () => {
    const { updatePreviewLayer } = renderEditor([logo()])
    // layer center is at stage (480, 270). Pointer straight right of it:
    drag('rotate-handle', { x: 580, y: 270 })
    expect(last(updatePreviewLayer).rotation).toBeCloseTo(90, 0)
    updatePreviewLayer.mockClear()
    // about 20 degrees clockwise of straight up
    const a = (20 * Math.PI) / 180
    drag('rotate-handle', { x: 480 + Math.sin(a) * 100, y: 270 - Math.cos(a) * 100 }, { shiftKey: true })
    expect(last(updatePreviewLayer).rotation).toBe(15)
  })

  it('a rotation edit also carries a position, so the rotated box stays inside the frame', () => {
    const { updatePreviewLayer } = renderEditor([createLayer('logo', { x: 0.97, y: 0.5, scale: 0.2 })])
    drag('rotate-handle', { x: 860, y: 270 })
    const p = last(updatePreviewLayer)
    expect(p).toHaveProperty('x')
    expect(p).toHaveProperty('y')
    expect(p.x).toBeLessThanOrEqual(1)
  })

  it('keyboard: arrows rotate by 1 degree (Shift 15), Home straightens, and none of it nudges the layer', () => {
    const layer = { ...logo(), rotation: 30 }
    const { updatePreviewLayer } = renderEditor([layer])
    const h = screen.getByTestId('rotate-handle')
    act(() => { fireEvent.keyDown(h, { key: 'ArrowRight' }) })
    expect(last(updatePreviewLayer).rotation).toBe(31)
    act(() => { fireEvent.keyDown(h, { key: 'ArrowLeft', shiftKey: true }) })
    expect(last(updatePreviewLayer).rotation).toBe(15)
    act(() => { fireEvent.keyDown(h, { key: 'Home' }) })
    expect(last(updatePreviewLayer).rotation).toBe(0)
    for (const [, patch] of updatePreviewLayer.mock.calls) expect(patch).toHaveProperty('rotation')
  })

  it('double-clicking the rotation handle straightens the layer', () => {
    const { updatePreviewLayer } = renderEditor([{ ...logo(), rotation: 40 }])
    act(() => { fireEvent.doubleClick(screen.getByTestId('rotate-handle')) })
    expect(last(updatePreviewLayer).rotation).toBe(0)
  })

  it('the box and its handles turn with the layer, but the toolbar stays upright outside it', () => {
    renderEditor([{ ...logo(), rotation: 20 }])
    const box = screen.getByRole('button', { name: 'Move Logo' })
    expect(box.style.transform).toBe('rotate(20deg)')
    expect(box.contains(screen.getByTestId('resize-handle-se'))).toBe(true)
    expect(box.contains(screen.getByTestId('rotate-handle'))).toBe(true)
    expect(box.contains(screen.getByTestId('layer-toolbar'))).toBe(false)
    expect(screen.getByTestId('layer-toolbar').style.transform).toBe('')
  })

  it('an unrotated box has no transform at all', () => {
    renderEditor([logo()])
    expect(screen.getByRole('button', { name: 'Move Logo' }).style.transform).toBe('')
  })

  it('the inspector rotation field shows, sets and resets the rotation', () => {
    const { updatePreviewLayer } = renderEditor([{ ...logo(), rotation: 25 }])
    const field = screen.getByTestId('rotation-field') as HTMLInputElement
    expect(field.value).toBe('25')
    act(() => { fireEvent.change(field, { target: { value: '-40' } }) })
    expect(last(updatePreviewLayer).rotation).toBe(-40)
    act(() => { fireEvent.change(field, { target: { value: '' } }) })
    expect(updatePreviewLayer).toHaveBeenCalledTimes(1) // an empty box is ignored, not treated as 0
    act(() => { fireEvent.click(screen.getByTestId('rotation-reset')) })
    expect(last(updatePreviewLayer).rotation).toBe(0)
  })

  it('Reset is disabled when there is nothing to reset', () => {
    renderEditor([logo()])
    expect((screen.getByTestId('rotation-reset') as HTMLButtonElement).disabled).toBe(true)
    expect((screen.getByTestId('rotation-field') as HTMLInputElement).value).toBe('0')
  })

  it('has no rotation field for a design layer', () => {
    renderEditor([{ ...createLayer('design'), designId: 'animated-headline' }])
    expect(screen.queryByTestId('rotation-field')).toBeNull()
  })
})

describe('OverlayEditor inspector tabs', () => {
  const logo = () => createLayer('logo', { x: 0.5, y: 0.5, scale: 0.2 })
  const isShown = (el: HTMLElement) => !el.closest('[hidden]')

  it('starts on Content and shows one group of settings at a time', () => {
    renderEditor([logo()])
    expect(screen.getByTestId('inspector-tab-content').getAttribute('aria-pressed')).toBe('true')
    expect(isShown(screen.getByLabelText('Layer image'))).toBe(true)
    expect(isShown(screen.getByLabelText('Layer size'))).toBe(false)
    expect(isShown(screen.getByLabelText('Layer animation'))).toBe(false)
  })

  it('Layout shows size, opacity, rotation, lock and position presets', () => {
    renderEditor([logo()])
    act(() => { fireEvent.click(screen.getByTestId('inspector-tab-layout')) })
    for (const el of [screen.getByLabelText('Layer size'), screen.getByLabelText('Layer opacity'), screen.getByTestId('rotation-field'), screen.getByTestId('overlay-lock-position')]) {
      expect(isShown(el)).toBe(true)
    }
    expect(isShown(screen.getByLabelText('Layer image'))).toBe(false)
  })

  it('Timing shows animation and when the layer appears', () => {
    renderEditor([logo()])
    act(() => { fireEvent.click(screen.getByTestId('inspector-tab-timing')) })
    expect(isShown(screen.getByLabelText('Layer animation'))).toBe(true)
    expect(isShown(screen.getByLabelText('Shown from seconds'))).toBe(true)
    expect(isShown(screen.getByLabelText('Layer size'))).toBe(false)
  })

  it('changing a setting from a hidden-then-shown tab still updates the layer', () => {
    const { updatePreviewLayer } = renderEditor([logo()])
    act(() => { fireEvent.click(screen.getByTestId('inspector-tab-layout')) })
    act(() => { fireEvent.change(screen.getByLabelText('Layer opacity'), { target: { value: '0.5' } }) })
    expect(updatePreviewLayer).toHaveBeenCalledWith(expect.any(String), { opacity: 0.5 })
  })
})
