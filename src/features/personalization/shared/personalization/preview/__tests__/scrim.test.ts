import { describe, it, expect } from 'vitest'
import { footageLuminanceAt, hasTextScrim, peakFromLuminance, scrimAlphaAt, scrimAlphaOverBox, scrimBackground, scrimForBox, scrimPeakAt, scrimStyle, SCRIM_MAX, SCRIM_MIN, SCRIM_PEAK } from '../scrim'
import { worstContrast } from '../placement/engine'
import type { LumaSample } from '../placement/types'

const W = 1920
const H = 1080
const box = { left: 200, top: 700, width: 700, height: 90 }

describe('text scrim geometry', () => {
  it('only plain text kinds get one (never the CTA pill, images or designs)', () => {
    for (const k of ['headline', 'businessName', 'tagline', 'offer'] as const) expect(hasTextScrim(k)).toBe(true)
    for (const k of ['cta', 'logo', 'productImage', 'serviceImage', 'endCard', 'design'] as const) expect(hasTextScrim(k)).toBe(false)
  })

  it('is a full-width band centered on the text row, taller than the text', () => {
    const s = scrimForBox(box, W, H)
    expect(s.cy).toBe(745)
    expect(s.ry).toBeGreaterThan(box.height / 2)
    expect(s.frameWidth).toBe(W)
    const style = scrimStyle(s)
    expect(style.left).toBe(0)
    expect(style.width).toBe(W)
    expect(style.height as number).toBeGreaterThan(box.height)
    expect(Math.abs((style.top as number) + (style.height as number) / 2 - 745)).toBeLessThanOrEqual(1)
  })

  it('is darkest at the row, fades smoothly, and is zero outside the band', () => {
    const s = scrimForBox(box, W, H)
    const center = scrimAlphaAt(s, 0, s.cy)
    const mid = scrimAlphaAt(s, 0, s.cy + s.ry * 0.6)
    const edge = scrimAlphaAt(s, 0, s.cy + s.ry * 0.97)
    expect(center).toBeCloseTo(SCRIM_PEAK, 5)
    expect(mid).toBeLessThan(center)
    expect(edge).toBeLessThan(mid)
    expect(scrimAlphaAt(s, 0, s.cy + s.ry * 1.2)).toBe(0)
    expect(scrimAlphaAt(s, 0, s.cy - s.ry * 1.2)).toBe(0)
  })

  it('is symmetric above and below the row, and ignores horizontal position', () => {
    const s = scrimForBox(box, W, H)
    expect(scrimAlphaAt(s, 0, s.cy - 50)).toBeCloseTo(scrimAlphaAt(s, 1500, s.cy + 50), 10)
  })

  it('the alpha a box can rely on is its weakest edge, and still positive for real text', () => {
    const s = scrimForBox(box, W, H)
    const reliable = scrimAlphaOverBox(s, box)
    expect(reliable).toBeGreaterThan(0)
    expect(reliable).toBeLessThanOrEqual(scrimAlphaAt(s, 0, s.cy))
  })
})

describe('scrim CSS stays inside what the browser exporter can draw', () => {
  // @remotion/web-renderer only parses `linear-gradient(`. A radial/conic gradient is
  // silently dropped there, so the preview would show a scrim the export never draws.
  const css = scrimBackground()

  it('uses a single linear-gradient and nothing else', () => {
    expect(css).toMatch(/^linear-gradient\(to bottom, /)
    expect(css).not.toMatch(/radial|conic|repeating/i)
    expect(css.match(/linear-gradient\(/g)).toHaveLength(1)
  })

  it('starts and ends fully transparent and peaks in the middle', () => {
    const alphas = [...css.matchAll(/rgba\(0,0,0,([\d.]+)\) ([\d.]+)%/g)].map((m) => ({ a: Number(m[1]), pos: Number(m[2]) }))
    expect(alphas[0]).toEqual({ a: 0, pos: 0 })
    expect(alphas[alphas.length - 1]).toEqual({ a: 0, pos: 100 })
    const max = Math.max(...alphas.map((s) => s.a))
    expect(max).toBeCloseTo(SCRIM_PEAK, 3)
    // stop positions are strictly increasing
    for (let i = 1; i < alphas.length; i++) expect(alphas[i].pos).toBeGreaterThanOrEqual(alphas[i - 1].pos)
  })
})

describe('contrast credit for a drawn scrim', () => {
  // A uniformly bright frame: white text on it is unreadable without help.
  const bright: LumaSample = { t: 1, cols: 4, rows: 4, luma: new Array(16).fill(0.9) }

  it('without a scrim white text on bright footage fails; with one it improves', () => {
    const none = worstContrast(box, [bright], W, H, '#ffffff')!
    const withScrim = worstContrast(box, [bright], W, H, '#ffffff', scrimAlphaOverBox(scrimForBox(box, W, H), box))!
    expect(none.ratio).toBeLessThan(3)
    expect(withScrim.ratio).toBeGreaterThan(none.ratio)
  })

  it('a zero or out-of-range alpha never changes or breaks the result', () => {
    const base = worstContrast(box, [bright], W, H, '#ffffff')!
    expect(worstContrast(box, [bright], W, H, '#ffffff', 0)!.ratio).toBeCloseTo(base.ratio, 10)
    expect(worstContrast(box, [bright], W, H, '#ffffff', -5)!.ratio).toBeCloseTo(base.ratio, 10)
    expect(Number.isFinite(worstContrast(box, [bright], W, H, '#ffffff', 5)!.ratio)).toBe(true)
  })
})

describe('adaptive scrim strength', () => {
  const grid = (t: number, v: number): LumaSample => ({ t, cols: 4, rows: 4, luma: new Array(16).fill(v) })
  const rect = { left: 0, top: 0, width: 1920, height: 1080 }

  it('is stronger over bright footage than over dark footage, within the safe range', () => {
    const dark = peakFromLuminance(0.02, 1)
    const mid = peakFromLuminance(0.4, 1)
    const bright = peakFromLuminance(0.9, 1)
    expect(dark).toBeLessThan(mid)
    expect(mid).toBeLessThan(bright)
    expect(dark).toBeGreaterThanOrEqual(SCRIM_MIN)
    expect(bright).toBeLessThanOrEqual(SCRIM_MAX)
  })

  it('uses the default strength when the footage was not measured', () => {
    expect(peakFromLuminance(null, 1)).toBe(SCRIM_PEAK)
    expect(peakFromLuminance(undefined, 1)).toBe(SCRIM_PEAK)
    expect(peakFromLuminance(NaN, 1)).toBe(SCRIM_PEAK)
  })

  it('draws no darkening scrim behind dark text', () => {
    expect(peakFromLuminance(0.9, 0.02)).toBe(0)
    expect(peakFromLuminance(null, 0.1)).toBe(0)
  })

  it('footage luminance is null without samples and interpolates smoothly between samples', () => {
    expect(footageLuminanceAt([], rect, W, H, 1)).toBeNull()
    expect(footageLuminanceAt(null, rect, W, H, 1)).toBeNull()
    const samples = [grid(0, 0), grid(2, 1)]
    const lo = footageLuminanceAt(samples, rect, W, H, 0)!
    const hi = footageLuminanceAt(samples, rect, W, H, 2)!
    const mid = footageLuminanceAt(samples, rect, W, H, 1)!
    expect(mid).toBeCloseTo((lo + hi) / 2, 6)
    // clamps outside the measured range
    expect(footageLuminanceAt(samples, rect, W, H, -5)).toBeCloseTo(lo, 10)
    expect(footageLuminanceAt(samples, rect, W, H, 99)).toBeCloseTo(hi, 10)
  })

  it('never steps: scrim strength changes by only a small amount frame to frame across a sample boundary', () => {
    const samples = [grid(0, 0.1), grid(1, 0.9), grid(2, 0.1)]
    let prev = scrimPeakAt(samples, rect, W, H, 0, '#ffffff')
    let maxStep = 0
    for (let f = 1; f <= 60; f++) {
      const cur = scrimPeakAt(samples, rect, W, H, f / 30, '#ffffff')
      maxStep = Math.max(maxStep, Math.abs(cur - prev))
      prev = cur
    }
    expect(maxStep).toBeLessThan(0.05)
  })

  it('works whatever order the samples arrive in', () => {
    const a = footageLuminanceAt([grid(2, 1), grid(0, 0)], rect, W, H, 1)
    const b = footageLuminanceAt([grid(0, 0), grid(2, 1)], rect, W, H, 1)
    expect(a).toBeCloseTo(b!, 10)
  })
})

describe('contrast credit follows the adaptive scrim', () => {
  const bright: LumaSample = { t: 1, cols: 4, rows: 4, luma: new Array(16).fill(0.9) }
  it('a per-luminance alphaFor replaces the fixed alpha and improves contrast on bright footage', () => {
    const s = scrimForBox(box, W, H)
    const fixed = worstContrast(box, [bright], W, H, '#ffffff', scrimAlphaOverBox(s, box))!
    const adaptive = worstContrast(box, [bright], W, H, '#ffffff', 0, (lum) => scrimAlphaOverBox(s, box, peakFromLuminance(lum, 1)))!
    const none = worstContrast(box, [bright], W, H, '#ffffff')!
    expect(adaptive.ratio).toBeGreaterThan(none.ratio)
    // bright footage maps to a stronger scrim than the default, so the adaptive credit is at least the fixed one
    expect(adaptive.ratio).toBeGreaterThanOrEqual(fixed.ratio)
  })
  it('alphaFor of 0 is the same as no scrim', () => {
    const none = worstContrast(box, [bright], W, H, '#ffffff')!
    expect(worstContrast(box, [bright], W, H, '#ffffff', 0, () => 0)!.ratio).toBeCloseTo(none.ratio, 10)
  })
})
