import { describe, expect, it } from 'vitest'
import { cleanStudioCaptions } from '../studioCaptions'
import { studioBandRect, coveredStudio, clearStudioPosition, rectsOverlap } from '../studioClearance'

const tok = (text: string, i: number) => ({ text: (i ? ' ' : '') + text, fromMs: i * 400, toMs: i * 400 + 400 })
const studio = (style: Record<string, unknown> = {}) => cleanStudioCaptions({
  pages: [{ startMs: 0, durationMs: 1600, tokens: ['hello', 'brave', 'new', 'world'].map(tok) }],
  style: { fontSize: 6, position: 'bottom', ...style },
})!
const W = 1920, H = 1080

describe('where the Studio captions sit on the frame', () => {
  it('is a fraction of the frame, centred, and low for the bottom place', () => {
    const r = studioBandRect(studio(), W, H)
    expect(r.left).toBeGreaterThan(0); expect(r.right).toBeLessThan(1)
    expect((r.left + r.right) / 2).toBeCloseTo(0.5, 2)
    expect(r.bottom).toBeGreaterThan(r.top)
    expect((r.top + r.bottom) / 2).toBeGreaterThan(0.7)
  })
  it('follows the dragged height and the place', () => {
    const mid = studioBandRect(studio({ positionY: 0.4 }), W, H)
    expect((mid.top + mid.bottom) / 2).toBeCloseTo(0.4, 1)
    expect((studioBandRect(studio({ position: 'top' }), W, H).top)).toBeLessThan(0.15)
  })
  it('grows with the font size and with the longest page', () => {
    const small = studioBandRect(studio({ fontSize: 4 }), W, H)
    const big = studioBandRect(studio({ fontSize: 10 }), W, H)
    expect(big.bottom - big.top).toBeGreaterThan(small.bottom - small.top)
  })
})

describe('keeping Studio captions clear of a layer', () => {
  const nameBox = { left: 0.3, right: 0.7, top: 0.8, bottom: 0.88 }
  it('says what the captions cover', () => {
    expect(coveredStudio(studio(), [nameBox], W, H)).toHaveLength(1)
    expect(coveredStudio(studio({ positionY: 0.3 }), [nameBox], W, H)).toHaveLength(0)
  })
  it('moves them just above the layer, the nearest clear height', () => {
    const c = clearStudioPosition(studio(), [nameBox], W, H)
    expect(c).toMatchObject({ overlapped: true, cleared: true })
    expect(c.positionY).toBeLessThan(0.8)
    const moved = studioBandRect(studio({ positionY: c.positionY }), W, H)
    expect(rectsOverlap(moved, nameBox)).toBe(false)
    expect(moved.bottom).toBeGreaterThan(0.7) // nearest: just above, not the top of the frame
  })
  it('leaves clear captions alone', () => {
    expect(clearStudioPosition(studio({ positionY: 0.3 }), [nameBox], W, H)).toEqual({ positionY: 0.3, overlapped: false, cleared: true })
    expect(clearStudioPosition(studio(), [], W, H)).toMatchObject({ overlapped: false, cleared: true })
  })
  it('goes below the layer when that is the nearer clear spot', () => {
    const upper = { left: 0.2, right: 0.8, top: 0.04, bottom: 0.14 }
    const c = clearStudioPosition(studio({ position: 'top' }), [upper], W, H)
    expect(c.cleared).toBe(true)
    expect(c.positionY!).toBeGreaterThan(0.14)
  })
  it('reports when no clear spot exists and changes nothing', () => {
    const wall = { left: 0, right: 1, top: 0, bottom: 1 }
    expect(clearStudioPosition(studio({ positionY: 0.5 }), [wall], W, H)).toEqual({ positionY: 0.5, overlapped: true, cleared: false })
  })
})
