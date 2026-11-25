import { describe, expect, it } from 'vitest'
import { ALL_CAPTION_PRESETS, CAPITE_PRESETS, captionPreset, normalizeCaptions, type CaptionSettings } from '../captions'
import { addStyle, applyCaptionStyle, captureCaptionStyle, normalizeTextStyles } from '../textStyles'
import { captionsToAss } from '../captionAss'
import { CAPTION_STYLE_CONFIGS } from '../capite/captionStyles'
import { captionFontByName } from '../../captions/capiteFonts'

const brand = { primary: '#112233', accent: '#ddeeff', text: '#ffffff' }
const base = (style: Record<string, unknown>) => ({ enabled: true, cues: [{ id: 'a', start: 0, end: 2, text: 'hello big world' }], style: { ...captionPreset('karaoke', brand)!, ...style } })

describe('customizer fields in the model', () => {
  it('keeps a valid font, weight, casing and offset, with the font in its canonical spelling', () => {
    const s = normalizeCaptions(base({ fontFamily: 'bebas neue', weight: 'light', casing: 'title', offsetY: 0.12 }))!.style
    expect(s).toMatchObject({ fontFamily: 'Bebas Neue', weight: 'light', casing: 'title', offsetY: 0.12 })
  })
  it('drops what is not valid, and an offset of zero', () => {
    const s = normalizeCaptions(base({ fontFamily: 'Comic Sans', weight: 'heavy', casing: 'shout', offsetY: 'up' }))!.style
    for (const k of ['fontFamily', 'weight', 'casing', 'offsetY']) expect(k in s, k).toBe(false)
    expect('offsetY' in normalizeCaptions(base({ offsetY: 0 }))!.style).toBe(false)
    expect(normalizeCaptions(base({ offsetY: 7 }))!.style.offsetY).toBe(0.4)
  })
  it('gives each of the 27 Capite looks its own font', () => {
    expect(CAPITE_PRESETS).toHaveLength(27)
    for (const p of CAPITE_PRESETS) {
      const s = captionPreset(p.id, brand)!
      const config = (CAPTION_STYLE_CONFIGS as Record<string, { fontName: string }>)[p.id.slice('capite-'.length)]
      expect(s.fontFamily, p.id).toBe(captionFontByName(config.fontName)!.name)
    }
    expect(ALL_CAPTION_PRESETS.filter((p) => !p.id.startsWith('capite-')).every((p) => captionPreset(p.id, brand)!.fontFamily === undefined)).toBe(true)
  })
  it('keeps the new fields in saved styles', () => {
    const style = { ...captionPreset('karaoke', brand)!, fontFamily: 'Anton', weight: 'medium' as const, casing: 'original' as const, offsetY: -0.1, keepClear: false as const }
    const look = captureCaptionStyle(style, brand)
    const { list } = addStyle([], { kind: 'captions', name: 'Mine', style: look })
    const restored = normalizeTextStyles(JSON.parse(JSON.stringify(list)))![0]
    expect(restored.kind === 'captions' && restored.style).toMatchObject({ fontFamily: 'Anton', weight: 'medium', casing: 'original', offsetY: -0.1, keepClear: false })
    expect(applyCaptionStyle(look, brand)).toMatchObject({ fontFamily: 'Anton', weight: 'medium', casing: 'original', offsetY: -0.1, keepClear: false, preset: 'custom' })
  })
})

describe('customizer fields in the .ass export', () => {
  const caps = (style: Record<string, unknown>): CaptionSettings => normalizeCaptions(base(style))!
  const styleLine = (ass: string) => ass.split('\n').find((l) => l.startsWith('Style: '))!.split(',')
  const text = (ass: string) => ass.split('\n').filter((l) => l.startsWith('Dialogue:')).map((l) => l.replace(/^Dialogue:(?:[^,]*,){9}/, '').replace(/\{[^}]*\}/g, '')).join(' ')
  it('uses the chosen font, bold from 700 up, and the chosen casing', () => {
    const ass = captionsToAss(caps({ fontFamily: 'Anton', weight: 'light', casing: 'title', uppercase: true }), { width: 1920, height: 1080 })
    expect(styleLine(ass)[1]).toBe('Anton')
    expect(styleLine(ass)[7]).toBe('0') // Bold off for light
    expect(text(ass)).toMatch(/Hello/)
    expect(captionsToAss(caps({ weight: 'extra-bold' }), { width: 1920, height: 1080 }).split('\n').find((l) => l.startsWith('Style: '))!.split(',')[7]).toBe('-1')
  })
  it('keeps the look\'s font and casing when nothing is chosen', () => {
    const ass = captionsToAss(caps({ ...captionPreset('capite-hormozi', brand)! }), { width: 1920, height: 1080 })
    expect(styleLine(ass)[1]).toBe('Montserrat')
    expect(text(ass)).toBe(text(ass).toUpperCase())
  })
  it('moves the caption up for a positive offset', () => {
    const marginV = (ass: string) => Number(styleLine(ass)[21])
    const o = { width: 1920, height: 1080 }
    expect(marginV(captionsToAss(caps({ offsetY: 0.2 }), o))).toBeGreaterThan(marginV(captionsToAss(caps({}), o)))
    expect(marginV(captionsToAss(caps({ offsetY: -0.05 }), o))).toBeLessThan(marginV(captionsToAss(caps({}), o)))
  })
})
