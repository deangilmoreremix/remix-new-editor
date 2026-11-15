import { describe, it, expect } from 'vitest'
import { isRotated, normalizeAngle, rotateCss, rotatedExtent } from '../rotation'

describe('normalizeAngle', () => {
  it('keeps angles in (-180, 180]', () => {
    expect(normalizeAngle(0)).toBe(0)
    expect(normalizeAngle(45)).toBe(45)
    expect(normalizeAngle(180)).toBe(180)
    expect(normalizeAngle(-180)).toBe(180)
    expect(normalizeAngle(190)).toBe(-170)
    expect(normalizeAngle(-190)).toBe(170)
    expect(normalizeAngle(360)).toBe(0)
    expect(normalizeAngle(725)).toBe(5)
    expect(normalizeAngle(-725)).toBe(-5)
  })
  it('rounds to a tenth of a degree and never returns -0', () => {
    expect(normalizeAngle(12.34)).toBe(12.3)
    expect(normalizeAngle(-0.04)).toBe(0)
    expect(Object.is(normalizeAngle(-0.04), -0)).toBe(false)
  })
  it('treats anything that is not a finite number as no rotation', () => {
    for (const bad of [undefined, null, NaN, Infinity, -Infinity, '45', {}, []]) expect(normalizeAngle(bad)).toBe(0)
  })
})

describe('isRotated / rotateCss', () => {
  it('is false for no rotation and for a full turn', () => {
    expect(isRotated(undefined)).toBe(false)
    expect(isRotated(0)).toBe(false)
    expect(isRotated(360)).toBe(false)
    expect(isRotated(0.04)).toBe(false)
    expect(isRotated(15)).toBe(true)
    expect(rotateCss(undefined)).toBe('')
    expect(rotateCss(0)).toBe('')
    expect(rotateCss(15)).toBe('rotate(15deg)')
    expect(rotateCss(-30.04)).toBe('rotate(-30deg)')
  })
})

describe('rotatedExtent', () => {
  it('is the same box at 0 and 180 degrees, and swaps width and height at 90', () => {
    expect(rotatedExtent(200, 50, 0)).toEqual({ w: 200, h: 50 })
    const r180 = rotatedExtent(200, 50, 180)
    expect(r180.w).toBeCloseTo(200, 6)
    expect(r180.h).toBeCloseTo(50, 6)
    const r90 = rotatedExtent(200, 50, 90)
    expect(r90.w).toBeCloseTo(50, 6)
    expect(r90.h).toBeCloseTo(200, 6)
  })
  it('a square grows to side * sqrt(2) at 45 degrees', () => {
    const r = rotatedExtent(100, 100, 45)
    expect(r.w).toBeCloseTo(141.42, 1)
    expect(r.h).toBeCloseTo(141.42, 1)
  })
  it('is symmetric in the sign of the angle', () => {
    const a = rotatedExtent(300, 40, 20)
    const b = rotatedExtent(300, 40, -20)
    expect(a.w).toBeCloseTo(b.w, 9)
    expect(a.h).toBeCloseTo(b.h, 9)
  })
  it('a wide thin box is narrower, not wider, when rotated 45 degrees', () => {
    expect(rotatedExtent(400, 20, 45).w).toBeLessThan(400)
  })
})
