import { describe, expect, it } from 'vitest'
import { CAPTION_FALLBACK_FONT, CAPTION_FONTS, CAPTION_WEIGHTS, captionFontByName, captionFontFamily, captionFontStack, isCaptionWeight, normalizeCaptionFont } from '../capiteFonts'
import { CAPTION_STYLE_CONFIGS } from '../../preview/capite/captionStyles'

describe('capiteFonts', () => {
  it('lists the 16 families of Capite once each', () => {
    expect(CAPTION_FONTS).toHaveLength(16)
    expect(new Set(CAPTION_FONTS.map((f) => f.name)).size).toBe(16)
    expect(new Set(CAPTION_FONTS.map((f) => f.slug)).size).toBe(16)
  })
  it('covers the font of every one of the 27 looks, and their fallback', () => {
    const configs = Object.entries(CAPTION_STYLE_CONFIGS as Record<string, { fontName: string; fontNameFallback: string }>)
    expect(configs).toHaveLength(27)
    for (const [id, c] of configs) expect(captionFontByName(c.fontName), id).toBeDefined()
    expect(configs.every(([, c]) => c.fontNameFallback === CAPTION_FALLBACK_FONT.name)).toBe(true)
  })
  it('finds a font by name in any letter case and rejects everything else', () => {
    expect(captionFontByName('  montserrat ')?.name).toBe('Montserrat')
    expect(normalizeCaptionFont('BEBAS NEUE')).toBe('Bebas Neue')
    for (const bad of ['Comic Sans', '', undefined, null, 7, {}, '"; background:url(x)']) expect(normalizeCaptionFont(bad), String(bad)).toBeUndefined()
  })
  it('builds a stack with the font, the fallback and then the app\'s own stack; other names change nothing', () => {
    const base = '"Personalization Sans", Inter, ui-sans-serif, system-ui, sans-serif'
    expect(captionFontStack('Anton', base)).toBe(`"Capite Anton", "Capite IBM Plex Sans", ${base}`)
    expect(captionFontStack('Nope', base)).toBe(base)
    expect(captionFontStack(undefined, base)).toBe(base)
    expect(captionFontFamily(CAPTION_FONTS[0])).toBe('Capite Inter')
  })
  it('knows the five weights', () => {
    expect(CAPTION_WEIGHTS).toEqual({ light: 300, regular: 400, medium: 500, bold: 700, 'extra-bold': 800 })
    expect(isCaptionWeight('bold')).toBe(true)
    expect(isCaptionWeight('heavy')).toBe(false)
  })
})
