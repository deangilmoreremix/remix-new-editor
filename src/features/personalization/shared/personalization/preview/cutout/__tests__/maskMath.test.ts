import { describe, expect, it } from 'vitest'
import { containRect, coverRect, fitWithin, lerpMask, maskIndexAt, refineMask, smoothMask, type Mask } from '../maskMath'

const mask = (w: number, h: number, fill: number | ((i: number) => number)): Mask => ({
  w, h, data: Uint8ClampedArray.from({ length: w * h }, (_, i) => (typeof fill === 'number' ? fill : fill(i))),
})

describe('smoothMask', () => {
  it('returns the current mask when there is no usable previous one', () => {
    const cur = mask(2, 2, 100)
    expect(smoothMask(null, cur, 0.5)).toBe(cur)
    expect(smoothMask(mask(3, 3, 0), cur, 0.5)).toBe(cur)
    expect(smoothMask(mask(2, 2, 0), cur, 0)).toBe(cur)
  })
  it('blends the past into the present', () => {
    expect(Array.from(smoothMask(mask(2, 1, 200), mask(2, 1, 100), 0.5).data)).toEqual([150, 150])
  })
  it('never keeps more than 90% of the past', () => {
    expect(smoothMask(mask(1, 1, 0), mask(1, 1, 100), 5).data[0]).toBe(10)
  })
})

describe('lerpMask', () => {
  it('interpolates and handles the ends', () => {
    const a = mask(2, 1, 0)
    const b = mask(2, 1, 200)
    expect(Array.from(lerpMask(a, b, 0.25).data)).toEqual([50, 50])
    expect(lerpMask(a, b, 0)).toBe(a)
    expect(lerpMask(a, b, 1)).toBe(b)
    expect(lerpMask(a, mask(3, 1, 0), 0.5)).toBe(a)
  })
})

describe('maskIndexAt', () => {
  it('finds the two surrounding masks and the blend between them', () => {
    expect(maskIndexAt(0, 15, 30)).toEqual({ i0: 0, i1: 1, t: 0 })
    const r = maskIndexAt(0.1, 15, 30)
    expect(r.i0).toBe(1)
    expect(r.i1).toBe(2)
    expect(r.t).toBeCloseTo(0.5, 5)
  })
  it('clamps past the end and handles empty sets', () => {
    expect(maskIndexAt(99, 15, 10)).toEqual({ i0: 9, i1: 9, t: 0 })
    expect(maskIndexAt(-1, 15, 10).i0).toBe(0)
    expect(maskIndexAt(1, 15, 0)).toEqual({ i0: 0, i1: 0, t: 0 })
  })
})

describe('refineMask', () => {
  // a 9x1 strip: left half presenter, right half background
  const strip = mask(9, 1, (i) => (i < 5 ? 255 : 0))

  it('returns the same mask when nothing is adjusted', () => {
    expect(refineMask(strip, { feather: 0, shift: 0 })).toBe(strip)
  })
  it('a positive shift shrinks the presenter and a negative shift grows it', () => {
    const soft = mask(9, 1, (i) => [255, 255, 255, 200, 128, 60, 0, 0, 0][i])
    const total = (m: Mask) => Array.from(m.data).reduce((a, b) => a + b, 0)
    expect(total(refineMask(soft, { feather: 0.01, shift: 0.8 }))).toBeLessThan(total(refineMask(soft, { feather: 0.01, shift: 0 })))
    expect(total(refineMask(soft, { feather: 0.01, shift: -0.8 }))).toBeGreaterThan(total(refineMask(soft, { feather: 0.01, shift: 0 })))
  })
  it('feather softens a hard edge', () => {
    const hard = refineMask(strip, { feather: 0, shift: 0.0001 })
    const soft = refineMask(strip, { feather: 1, shift: 0.0001 })
    const mid = (m: Mask) => Array.from(m.data).filter((v) => v > 10 && v < 245).length
    expect(mid(soft)).toBeGreaterThan(mid(hard))
  })
  it('keeps size and stays within 0..255', () => {
    const out = refineMask(strip, { feather: 1, shift: -1 })
    expect(out.w).toBe(9)
    expect(Array.from(out.data).every((v) => v >= 0 && v <= 255)).toBe(true)
  })
})

describe('coverRect / fitWithin', () => {
  it('covers like object-fit: cover', () => {
    expect(coverRect(1600, 900, 900, 900)).toEqual({ x: -350, y: 0, w: 1600, h: 900 })
    expect(coverRect(900, 1600, 900, 900)).toEqual({ x: 0, y: -350, w: 900, h: 1600 })
    expect(coverRect(0, 0, 10, 10)).toEqual({ x: 0, y: 0, w: 10, h: 10 })
  })
  it('contains like object-fit: contain (the whole picture, centered)', () => {
    expect(containRect(900, 1600, 1600, 900)).toEqual({ x: 546.875, y: 0, w: 506.25, h: 900 })
    expect(containRect(1600, 900, 900, 900)).toEqual({ x: 0, y: 196.875, w: 900, h: 506.25 })
    expect(containRect(0, 0, 10, 10)).toEqual({ x: 0, y: 0, w: 10, h: 10 })
  })
  it('shrinks to a maximum side without changing aspect', () => {
    expect(fitWithin(1920, 1080, 384)).toEqual({ w: 384, h: 216 })
    expect(fitWithin(360, 640, 384)).toEqual({ w: 216, h: 384 })
    expect(fitWithin(100, 50, 384)).toEqual({ w: 100, h: 50 })
  })
})
