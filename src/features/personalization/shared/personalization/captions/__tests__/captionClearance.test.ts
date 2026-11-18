import { describe, expect, it } from 'vitest'
import { captionRect, clearCaptionOffset, coveredBy, rectsOverlap, type CaptionBand, type Rect } from '../captionClearance'

const band = (over: Partial<CaptionBand> = {}): CaptionBand => ({ position: 'bottom', size: 0.06, edge: 0.07, aspect: 16 / 9, chars: 20, ...over })
const full = (top: number, bottom: number): Rect => ({ left: 0.05, right: 0.95, top, bottom })

describe('captionRect', () => {
  it('puts the band near the bottom, the top and the middle for each place, centred on the frame', () => {
    const b = captionRect(band()), t = captionRect(band({ position: 'top' })), m = captionRect(band({ position: 'middle' }))
    expect(b.bottom).toBeCloseTo(0.93, 2)
    expect(t.top).toBeCloseTo(0.07, 2)
    expect((m.top + m.bottom) / 2).toBeCloseTo(0.5, 5)
    expect((b.left + b.right) / 2).toBeCloseTo(0.5, 5)
  })
  it('moves up for a positive offset and keeps the same size', () => {
    const a = captionRect(band()), up = captionRect(band({ offsetY: 0.2 }))
    expect(up.top).toBeCloseTo(a.top - 0.2, 5)
    expect(up.bottom - up.top).toBeCloseTo(a.bottom - a.top, 5)
  })
  it('is wider for longer text (up to 86 % of the frame), taller when it wraps, and padded with a box', () => {
    const short = captionRect(band({ chars: 8 })), long = captionRect(band({ chars: 200 }))
    expect(long.right - long.left).toBeGreaterThan(short.right - short.left)
    expect(long.right - long.left).toBeLessThanOrEqual(0.86 + 1e-9)
    expect(long.bottom - long.top).toBeGreaterThan(short.bottom - short.top)
    expect(captionRect(band({ box: true })).bottom - captionRect(band({ box: true })).top).toBeGreaterThan(captionRect(band()).bottom - captionRect(band()).top)
  })
})

describe('coveredBy / rectsOverlap', () => {
  it('finds the blockers the band covers, and ignores ones beside or clear of it', () => {
    const r = captionRect(band())
    const on = full(r.top + 0.01, r.bottom - 0.01)
    const above = full(0.1, 0.2)
    const beside: Rect = { left: 0, right: 0.02, top: r.top, bottom: r.bottom }
    expect(coveredBy(band(), [on, above, beside])).toEqual([on])
    expect(rectsOverlap({ left: 0, top: 0, right: 0.5, bottom: 0.5 }, { left: 0.5, top: 0, right: 1, bottom: 0.5 })).toBe(false) // touching is not covering
  })
})

describe('clearCaptionOffset', () => {
  it('leaves a clear caption alone', () => {
    expect(clearCaptionOffset(band(), [full(0.1, 0.2)])).toEqual({ offsetY: undefined, overlapped: false, cleared: true })
    expect(clearCaptionOffset(band({ offsetY: 0.1 }), [full(0.1, 0.2)]).offsetY).toBe(0.1)
  })
  it('moves a covering caption to the nearest clear spot, which is really clear', () => {
    const r = captionRect(band({ offsetY: 0.25 }))
    const blocker = full(r.top + 0.02, r.bottom - 0.02)
    const out = clearCaptionOffset(band({ offsetY: 0.25 }), [blocker])
    expect(out.overlapped).toBe(true)
    expect(out.cleared).toBe(true)
    expect(coveredBy(band({ offsetY: out.offsetY }), [blocker])).toHaveLength(0)
    expect(Math.abs((out.offsetY ?? 0) - 0.25)).toBeLessThan(0.2) // the nearest spot, not a far one
  })
  it('says so, and changes nothing, when there is no clear spot', () => {
    const wall = [full(0.02, 0.98)]
    expect(clearCaptionOffset(band({ offsetY: 0.1 }), wall)).toEqual({ offsetY: 0.1, overlapped: true, cleared: false })
  })
  it('keeps the caption on the frame and within the allowed offset', () => {
    const out = clearCaptionOffset(band(), [full(0.55, 0.99)])
    if (out.cleared) { const r = captionRect(band({ offsetY: out.offsetY })); expect(r.top).toBeGreaterThanOrEqual(0.02); expect(r.bottom).toBeLessThanOrEqual(0.98); expect(Math.abs(out.offsetY ?? 0)).toBeLessThanOrEqual(0.4) }
  })
})
