// @vitest-environment jsdom
/**
 * Stage 1 — crop mapping, on-canvas rotation ops and the crop dialog.
 *
 * The crop mapping is checked against an INDEPENDENT simulation of what the renderer does
 * (cover fit + object-position + scale about the focus), not against its own inverse.
 */
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import {
  areaToFocus,
  areaToStyleCrop,
  focusToArea,
  fractionToPercent,
  percentToFraction,
  visibleFractions,
} from '../cropMapping'
import { setLayerRotation, snapAngle } from '../layerOps'
import { createDefaultPreviewSettings, createLayer } from '../../preview/presets'
import { ImageCropDialog } from '../ImageCropDialog'
import { ImageStyleControls } from '../ImageStyleControls'
import { ROUNDED_RECT_DEFAULT } from '../../preview/imageStyle'

/** What the composition draws, computed from first principles (CSS semantics), as fractions of the image. */
function simulateVisible(cropX: number, cropY: number, zoom: number, imgW: number, imgH: number, boxW: number, boxH: number) {
  const s = Math.max(boxW / imgW, boxH / imgH) // object-fit: cover
  const Wi = imgW * s
  const Hi = imgH * s
  const L = (boxW - Wi) * cropX // object-position: cropX% cropY%
  const T = (boxH - Hi) * cropY
  const ox = cropX * boxW // transform-origin: cropX% cropY% of the element box
  const oy = cropY * boxH
  // The frame [0, box] seen through scale(zoom) about the origin shows this window of the un-zoomed element:
  const x0 = ox - ox / zoom
  const x1 = ox + (boxW - ox) / zoom
  const y0 = oy - oy / zoom
  const y1 = oy + (boxH - oy) / zoom
  return { x: (x0 - L) / Wi, y: (y0 - T) / Hi, width: (x1 - x0) / Wi, height: (y1 - y0) / Hi }
}

describe('cropMapping', () => {
  const aspects: Array<[number, number]> = [[1.78, 1], [0.56, 1], [1, 1], [2.4, 1], [0.8, 1.5]]
  const focuses = [0, 0.2, 0.5, 0.85, 1]
  const zooms = [1, 1.3, 2, 3.5, 4]

  it('matches an independent simulation of the renderer for every combination', () => {
    for (const [a, f] of aspects) for (const cx of focuses) for (const cy of focuses) for (const z of zooms) {
      const imgW = 1000 * a
      const imgH = 1000
      const sim = simulateVisible(cx, cy, z, imgW, imgH, 400 * f, 400)
      const got = focusToArea({ cropX: cx, cropY: cy }, z, a, f)
      expect(got.width, `w a=${a} f=${f} z=${z}`).toBeCloseTo(sim.width, 6)
      expect(got.height, `h a=${a} f=${f} z=${z}`).toBeCloseTo(sim.height, 6)
      expect(got.x, `x a=${a} f=${f} cx=${cx} z=${z}`).toBeCloseTo(sim.x, 6)
      expect(got.y, `y a=${a} f=${f} cy=${cy} z=${z}`).toBeCloseTo(sim.y, 6)
    }
  })

  it('round-trips focus -> area -> focus wherever the picture can move', () => {
    for (const [a, f] of aspects) for (const cx of focuses) for (const cy of focuses) for (const z of [1.5, 2, 4]) {
      const area = focusToArea({ cropX: cx, cropY: cy }, z, a, f)
      const back = areaToFocus(area)
      const { w, h } = visibleFractions(z, a, f)
      if (1 - w > 1e-6) expect(back.cropX).toBeCloseTo(cx, 6)
      if (1 - h > 1e-6) expect(back.cropY).toBeCloseTo(cy, 6)
    }
  })

  it('what a customer frames is what the renderer shows (area -> style -> simulated render)', () => {
    // A user frames the top-left quarter of a 4:3 picture in a square frame at zoom 2.
    const a = 4 / 3
    const { w, h } = visibleFractions(2, a, 1)
    const framed = { x: 0.05, y: 0.1, width: w, height: h }
    const style = areaToStyleCrop(framed, 2)
    const sim = simulateVisible(style.cropX, style.cropY, style.zoom, 1000 * a, 1000, 400, 400)
    expect(sim.x).toBeCloseTo(framed.x, 6)
    expect(sim.y).toBeCloseTo(framed.y, 6)
    expect(sim.width).toBeCloseTo(framed.width, 6)
    expect(style.fit).toBe('cover')
  })

  it('has no focus to give when the picture exactly fills the frame on that axis', () => {
    expect(areaToFocus({ x: 0, y: 0, width: 1, height: 0.5 }).cropX).toBe(0.5)
    expect(areaToFocus({ x: 0, y: 0.25, width: 0.5, height: 0.5 })).toEqual({ cropX: 0, cropY: 0.5 })
  })

  it('clamps out-of-range input and converts percent <-> fraction', () => {
    expect(areaToFocus({ x: 0.9, y: -1, width: 0.2, height: 0.2 })).toEqual({ cropX: 1, cropY: 0 })
    expect(areaToStyleCrop({ x: 0, y: 0, width: 0.5, height: 0.5 }, 99).zoom).toBe(4)
    expect(percentToFraction({ x: 10, y: 20, width: 50, height: 60 })).toEqual({ x: 0.1, y: 0.2, width: 0.5, height: 0.6 })
    expect(fractionToPercent({ x: 0.1, y: 0.2, width: 0.5, height: 0.6 })).toEqual({ x: 10, y: 20, width: 50, height: 60 })
    expect(visibleFractions(NaN, NaN, NaN)).toEqual({ w: 1, h: 1 })
  })
})

describe('setLayerRotation / snapAngle', () => {
  const base = { ...createDefaultPreviewSettings(), layers: [createLayer('headline'), createLayer('design', { designId: 'x' }), createLayer('cta', { locked: true })] }
  const [hl, design, cta] = base.layers

  it('sets, wraps and clears rotation, marking the layer hand-placed', () => {
    const r = setLayerRotation(base, hl.id, 190)
    expect(r.layers[0].rotation).toBe(-170)
    expect(r.layers[0].placementSource).toBe('manual')
    expect(setLayerRotation(r, hl.id, 0).layers[0].rotation).toBeUndefined()
    expect(setLayerRotation(r, hl.id, 360).layers[0].rotation).toBeUndefined()
  })
  it('returns the same object when nothing changes, and never rotates locked or design layers', () => {
    expect(setLayerRotation(base, hl.id, 0)).toBe(base)
    expect(setLayerRotation(base, design.id, 30)).toBe(base)
    expect(setLayerRotation(base, cta.id, 30)).toBe(base)
    expect(setLayerRotation(base, 'missing', 30)).toBe(base)
    const r = setLayerRotation(base, hl.id, 30)
    expect(setLayerRotation(r, hl.id, 30)).toBe(r)
  })
  it('snaps to 15 degree steps', () => {
    expect(snapAngle(7)).toBe(0)
    expect(snapAngle(8)).toBe(15)
    expect(snapAngle(-52)).toBe(-45)
    expect(snapAngle(100, 45)).toBe(90)
    expect(snapAngle(NaN)).toBe(0)
  })
})

// ── dialog ──────────────────────────────────────────────────────────────────
// react-easy-crop measures real layout; replace it with a stub that reports the area it is told to.
let reportedArea: { x: number; y: number; width: number; height: number } | null = null
vi.mock('react-easy-crop', () => ({
  default: ({ onCropAreaChange, initialCroppedAreaPercentages }: any) => {
    React.useEffect(() => {
      onCropAreaChange?.(reportedArea ?? initialCroppedAreaPercentages)
    }, [])
    return <div data-testid="cropper" data-initial={JSON.stringify(initialCroppedAreaPercentages)} />
  },
}))

class FakeImage {
  onload: (() => void) | null = null
  onerror: (() => void) | null = null
  naturalWidth = 1600
  naturalHeight = 900
  set src(_v: string) { queueMicrotask(() => this.onload?.()) }
}

describe('ImageCropDialog', () => {
  beforeEach(() => { reportedArea = null; vi.stubGlobal('Image', FakeImage) })
  afterEach(() => { cleanup(); vi.unstubAllGlobals() })

  it('applying without touching anything keeps the current crop (idempotent)', async () => {
    const onApply = vi.fn()
    render(<ImageCropDialog src="https://x/p.png" initial={{ cropX: 0.3, cropY: 0.6, zoom: 2 }} onApply={onApply} onCancel={vi.fn()} />)
    await screen.findByTestId('cropper')
    await act(async () => { fireEvent.click(screen.getByLabelText('Apply crop')) })
    const out = onApply.mock.calls[0][0]
    // 16:9 picture in a square frame: only the horizontal axis can move at zoom 1; at zoom 2 both can.
    expect(out.zoom).toBe(2)
    expect(out.fit).toBe('cover')
    expect(out.cropX).toBeCloseTo(0.3, 6)
    expect(out.cropY).toBeCloseTo(0.6, 6)
  })

  it('shows the initial framing to the cropper in percent', async () => {
    render(<ImageCropDialog src="https://x/p.png" initial={{ cropX: 0.5, cropY: 0.5, zoom: 1 }} onApply={vi.fn()} onCancel={vi.fn()} />)
    const initial = JSON.parse((await screen.findByTestId('cropper')).getAttribute('data-initial') as string)
    // 16:9 in a square at zoom 1: full height visible, 9/16 of the width, centred.
    expect(initial.height).toBeCloseTo(100, 6)
    expect(initial.width).toBeCloseTo(56.25, 4)
    expect(initial.x).toBeCloseTo(21.875, 4)
  })

  it('converts a framed area and the zoom slider into style values', async () => {
    reportedArea = { x: 0, y: 0, width: 28.125, height: 50 } // zoom 2 -> half the visible fraction
    const onApply = vi.fn()
    render(<ImageCropDialog src="https://x/p.png" initial={{ cropX: 0.5, cropY: 0.5, zoom: 1 }} onApply={onApply} onCancel={vi.fn()} />)
    await screen.findByTestId('cropper')
    fireEvent.change(screen.getByLabelText('Crop zoom'), { target: { value: '2' } })
    await act(async () => { fireEvent.click(screen.getByLabelText('Apply crop')) })
    expect(onApply).toHaveBeenCalledWith({ cropX: 0, cropY: 0, zoom: 2, fit: 'cover' })
  })

  it('cancels with the Cancel button, Escape and a backdrop click', async () => {
    const onCancel = vi.fn()
    render(<ImageCropDialog src="https://x/p.png" initial={{ cropX: 0.5, cropY: 0.5 }} onApply={vi.fn()} onCancel={onCancel} />)
    await screen.findByTestId('cropper')
    fireEvent.click(screen.getByLabelText('Cancel crop'))
    fireEvent.keyDown(window, { key: 'Escape' })
    fireEvent.click(screen.getByTestId('image-crop-dialog'))
    expect(onCancel).toHaveBeenCalledTimes(3)
  })

  it('says so when the picture cannot be loaded, and offers no Apply result', async () => {
    class Broken extends FakeImage { set src(_v: string) { queueMicrotask(() => this.onerror?.()) } }
    vi.stubGlobal('Image', Broken)
    const onApply = vi.fn()
    render(<ImageCropDialog src="https://x/missing.png" initial={{ cropX: 0.5, cropY: 0.5 }} onApply={onApply} onCancel={vi.fn()} />)
    expect((await screen.findByRole('alert')).textContent).toMatch(/could not be loaded/)
    expect((screen.getByLabelText('Apply crop') as HTMLButtonElement).disabled).toBe(true)
    expect(onApply).not.toHaveBeenCalled()
  })
})

describe('ImageStyleControls crop entry points', () => {
  beforeEach(() => vi.stubGlobal('Image', FakeImage))
  afterEach(() => { cleanup(); vi.unstubAllGlobals() })
  const props = (over: Record<string, unknown> = {}) => ({
    style: { ...ROUNDED_RECT_DEFAULT, fit: 'cover' as const, zoom: 1.5 }, isAuto: false, reason: '', onChange: vi.fn(), onReset: vi.fn(), ...over,
  })

  it('has no crop button without a picture URL', () => {
    render(<ImageStyleControls {...props()} />)
    expect(screen.queryByLabelText('Crop and zoom picture')).toBeNull()
  })
  it('opens the dialog and writes the applied crop through onChange', async () => {
    const p = props({ imageSrc: 'https://x/p.png' })
    render(<ImageStyleControls {...p} />)
    fireEvent.click(screen.getByLabelText('Crop and zoom picture'))
    await screen.findByTestId('cropper')
    await act(async () => { fireEvent.click(screen.getByLabelText('Apply crop')) })
    expect(p.onChange).toHaveBeenCalledWith(expect.objectContaining({ fit: 'cover', zoom: 1.5 }))
    expect(screen.queryByTestId('image-crop-dialog')).toBeNull()
  })
  it('the zoom slider writes ImageStyle.zoom', () => {
    const p = props()
    render(<ImageStyleControls {...p} />)
    fireEvent.change(screen.getByLabelText('Image zoom'), { target: { value: '2.5' } })
    expect(p.onChange).toHaveBeenCalledWith({ zoom: 2.5 })
  })
})
