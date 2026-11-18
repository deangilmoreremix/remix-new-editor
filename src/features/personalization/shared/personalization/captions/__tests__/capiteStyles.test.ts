import { describe, it, expect } from 'vitest'
import { CAPITE_CAPTION_STYLES, CAPITE_CATEGORIES, CAPITE_FONT_FAMILIES, capiteStyleById, capiteTextCss, capiteWordCss, isCapiteStyleId } from '../capiteStyles'

describe('Capite caption styles', () => {
  it('has the 27 looks with unique ids, valid colours and a known category', () => {
    expect(CAPITE_CAPTION_STYLES).toHaveLength(27)
    expect(new Set(CAPITE_CAPTION_STYLES.map((s) => s.id)).size).toBe(27)
    const cats = new Set(CAPITE_CATEGORIES.map((c) => c.id))
    for (const s of CAPITE_CAPTION_STYLES) {
      expect(cats.has(s.category), s.id).toBe(true)
      for (const c of [s.primaryColor, s.highlightColor, s.outlineColor, s.shadowColor]) expect(c, s.id).toMatch(/^#[0-9a-f]{6}$/i)
      expect(s.fontSize).toBeGreaterThan(0)
    }
    expect(CAPITE_FONT_FAMILIES.length).toBe(13)
  })
  it('looks styles up by id and rejects anything else', () => {
    expect(capiteStyleById('hormozi')?.name).toBe('Hormozi')
    expect(isCapiteStyleId('bold')).toBe(false)
    expect(isCapiteStyleId(undefined)).toBe(false)
    expect(isCapiteStyleId('__proto__')).toBe(false)
  })
  it('scales outline with the text and puts the embedded font first, then the fallback, then the host stack', () => {
    const s = capiteStyleById('hormozi')!
    const small = capiteTextCss(s, 20, 'sans-serif'), big = capiteTextCss(s, 80, 'sans-serif')
    // The embedded copy of the font, under its alias, then Capite's fallback, then the host stack.
    expect(String(small.fontFamily)).toBe('"Capite Montserrat", "Capite IBM Plex Sans", sans-serif')
    expect(String(small.textShadow)).not.toBe(String(big.textShadow))
    expect(String(big.textShadow)).toContain(s.outlineColor)
  })
  it('glow looks add a glow in the highlight colour; box looks have no outline ring', () => {
    const glow = CAPITE_CAPTION_STYLES.find((s) => s.animationType === 'glow')!
    expect(String(capiteTextCss(glow, 60, 'x').textShadow)).toContain(glow.highlightColor)
    const box = CAPITE_CAPTION_STYLES.find((s) => s.animationType === 'box')!
    expect(String(capiteTextCss(box, 60, 'x').textShadow ?? '')).not.toContain(box.outlineColor)
    expect(capiteWordCss(box, 'active', 60).background).toBe(box.highlightColor)
    expect(capiteWordCss(box, 'idle', 60)).toEqual({})
  })
})
