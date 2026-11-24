import { describe, expect, it } from 'vitest'
import { assBoldOf, assCasingOf, normalizeCustom, offsetPositionPct, resolveCasing, resolveWeight, textTransformOf } from '../captionCustom'

describe('normalizeCustom', () => {
  it('keeps valid values, with the font in its canonical spelling', () => {
    expect(normalizeCustom({ fontFamily: 'bebas neue', weight: 'light', casing: 'title', offsetY: 0.12 })).toEqual({ fontFamily: 'Bebas Neue', weight: 'light', casing: 'title', offsetY: 0.12 })
  })
  it('drops everything that is not valid', () => {
    expect(normalizeCustom({ fontFamily: 'Comic Sans', weight: 'heavy', casing: 'shout', offsetY: 'up' })).toEqual({})
    for (const junk of [undefined, null, 5, 'x', []]) expect(normalizeCustom(junk), String(junk)).toEqual({})
    expect(normalizeCustom({ offsetY: NaN })).toEqual({})
  })
  it('stores keepClear only when it is off, and drops anything else', () => {
    expect(normalizeCustom({ keepClear: false })).toEqual({ keepClear: false })
    for (const v of [true, 'no', 0, null, undefined]) expect(normalizeCustom({ keepClear: v }), String(v)).toEqual({})
  })
  it('keeps the offset within 0.4 of the frame, and treats 0 as not moved', () => {
    expect(normalizeCustom({ offsetY: 9 }).offsetY).toBe(0.4)
    expect(normalizeCustom({ offsetY: -9 }).offsetY).toBe(-0.4)
    expect(normalizeCustom({ offsetY: 0 })).toEqual({})
    expect(normalizeCustom({ offsetY: 0.0004 })).toEqual({})
  })
})

describe('casing, weight and place', () => {
  it('uses the chosen casing, else the look\'s own', () => {
    expect(resolveCasing(undefined, true)).toBe('upper')
    expect(resolveCasing(undefined, false)).toBe('original')
    expect(resolveCasing('original', true)).toBe('original')
    expect(resolveCasing('title', false)).toBe('title')
    expect([textTransformOf('upper'), textTransformOf('title'), textTransformOf('original')]).toEqual(['uppercase', 'capitalize', 'none'])
    expect([assCasingOf('upper'), assCasingOf('title'), assCasingOf('original')]).toEqual(['uppercase', 'title', 'original'])
  })
  it('uses the chosen weight, else bold or medium, and the .ass is bold from 700', () => {
    expect(resolveWeight('light', true)).toBe(300)
    expect(resolveWeight('extra-bold', false)).toBe(800)
    expect(resolveWeight(undefined, true)).toBe(800)
    expect(resolveWeight(undefined, false)).toBe(500)
    expect(assBoldOf(700)).toBe(true)
    expect(assBoldOf(500)).toBe(false)
  })
  it('moves the place up for a positive offset and keeps it on the frame', () => {
    expect(offsetPositionPct(10, undefined)).toBe(10)
    expect(offsetPositionPct(10, 0.2)).toBeCloseTo(30, 5)
    expect(offsetPositionPct(10, -0.4)).toBe(1)
    expect(offsetPositionPct(86, 0.4)).toBe(99)
  })
})
