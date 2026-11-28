import { describe, expect, it } from 'vitest'
import { productCropFromDetections } from '../productCrop'
import { canApplyImprove, improveLook } from '../grade'
import { pickThumbnails, scoreFrame } from '../thumbnailIntel'
import { classifyOcrLines } from '../ocrIntel'
import { videoGainAt } from '../../preview/audioMix'
import { NEUTRAL_LOOK } from '../../preview/effects'
import { normalizePreviewSettings } from '../../preview/presets'

describe('product crop', () => {
  const d = (label: string, score: number, b: [number, number, number, number]) => ({ label, score, box: { xmin: b[0], ymin: b[1], xmax: b[2], ymax: b[3] } })
  it('ignores people and picks the biggest confident object, padded and inside the picture', () => {
    const r = productCropFromDetections([d('person', 0.99, [0, 0, 600, 600]), d('bottle', 0.8, [200, 100, 400, 500]), d('cup', 0.5, [10, 10, 60, 60])], 640, 640)!
    expect(r.x).toBeLessThan(200); expect(r.x).toBeGreaterThanOrEqual(0)
    expect(r.x + r.w).toBeLessThanOrEqual(640); expect(r.y + r.h).toBeLessThanOrEqual(640)
    expect(r.w).toBeGreaterThan(200)
  })
  it('returns null when nothing is usable or the object already fills the frame', () => {
    expect(productCropFromDetections([d('person', 0.9, [0, 0, 100, 100])], 640, 640)).toBeNull()
    expect(productCropFromDetections([d('box', 0.9, [0, 0, 640, 640])], 640, 640)).toBeNull()
    expect(productCropFromDetections([d('box', 0.2, [100, 100, 300, 300])], 640, 640)).toBeNull()
  })
})

describe('improve look', () => {
  it('brightens dark footage and darkens bright footage, within half a stop', () => {
    expect(improveLook(40).exposure).toBeGreaterThan(0)
    expect(improveLook(220).exposure).toBeLessThan(0)
    expect(Math.abs(improveLook(5).exposure)).toBeLessThanOrEqual(0.5)
    expect(improveLook(125).exposure).toBe(0)
  })
  it('only applies over a neutral look', () => {
    expect(canApplyImprove(undefined)).toBe(true)
    expect(canApplyImprove(NEUTRAL_LOOK)).toBe(true)
    expect(canApplyImprove({ ...NEUTRAL_LOOK, contrast: 1.3 })).toBe(false)
  })
})

describe('thumbnails', () => {
  it('prefers sharp mid-tone frames and keeps picks apart in time', () => {
    const frames = [
      { t: 1, sharpness: 400, brightness: 125, contrast: 60 }, { t: 1.5, sharpness: 390, brightness: 125, contrast: 60 },
      { t: 6, sharpness: 250, brightness: 130, contrast: 50 }, { t: 9, sharpness: 5, brightness: 20, contrast: 5 },
    ]
    expect(scoreFrame(frames[0]!)).toBeGreaterThan(scoreFrame(frames[3]!))
    const p = pickThumbnails(frames, 3, 1.5)
    expect(p.map((x) => x.t)).toEqual([1, 6, 9])
  })
})

describe('OCR line handling', () => {
  it('drops low-confidence noise and flags prices and promotions for confirmation', () => {
    const out = classifyOcrLines([
      { text: 'Joe’s Pizza', confidence: 90 }, { text: 'Large pizza $12.99', confidence: 88 }, { text: '50% OFF today', confidence: 80 },
      { text: 'Call 555-123-4567', confidence: 85 }, { text: 'xZq~', confidence: 30 }, { text: 'www.joespizza.com', confidence: 91 },
    ])
    expect(out.map((l) => [l.text, l.kind, l.needsConfirm])).toEqual([
      ['Joe’s Pizza', 'text', false], ['Large pizza $12.99', 'price', true], ['50% OFF today', 'claim', true],
      ['Call 555-123-4567', 'phone', false], ['www.joespizza.com', 'url', false],
    ])
  })
})

describe('video sound fades', () => {
  const s = { fps: 30, durationInFrames: 300, videoFadeIn: 1, videoFadeOut: 2 }
  it('ramps in and out and leaves the middle at the set volume', () => {
    expect(videoGainAt(s, 0)).toBe(0)
    expect(videoGainAt(s, 15)).toBeCloseTo(0.5)
    expect(videoGainAt(s, 150)).toBe(1)
    expect(videoGainAt(s, 270)).toBeCloseTo(0.5)
    expect(videoGainAt({ ...s, videoVolume: 0.5 }, 150)).toBe(0.5)
    expect(videoGainAt({ ...s, videoMuted: true }, 150)).toBe(0)
  })
  it('is saved with the project and bad values are dropped on restore', () => {
    const ok = normalizePreviewSettings({ videoFadeIn: 2, videoFadeOut: 99, videoFocus: { x: 2, y: -1 } } as never)
    expect(ok.videoFadeIn).toBe(2); expect(ok.videoFadeOut).toBe(10); expect(ok.videoFocus).toEqual({ x: 1, y: 0 })
    const bad = normalizePreviewSettings({ videoFadeIn: 'x', videoFadeOut: -3, videoFocus: { x: 'a' } } as never)
    expect(bad.videoFadeIn).toBeUndefined(); expect(bad.videoFadeOut).toBeUndefined(); expect(bad.videoFocus).toBeUndefined()
  })
})
