import { describe, it, expect } from 'vitest'
import { isSingleLineBox, accentRuleStyle, ctaPillStyle, darkenHex, endCardBackground, isTextStyleKind, layerTextStyle, lightenHex, LEFT_COLUMN_MAX_X, PILL_SHADOW, TEXT_SHADOW, textAlignFor } from '../textStyle'

describe('layerTextStyle', () => {
  const base = { fontSizePx: 48, color: '#fff' }

  it('gives every text role a weight, line-height, tracking and the shared shadow', () => {
    for (const kind of ['headline', 'businessName', 'offer', 'tagline'] as const) {
      const s = layerTextStyle(kind, base)
      expect(s.fontSize).toBe(48)
      expect(s.color).toBe('#fff')
      expect(typeof s.fontWeight).toBe('number')
      expect(typeof s.lineHeight).toBe('number')
      expect(s.letterSpacing).toBeTruthy()
      expect(s.textShadow).toBe(TEXT_SHADOW)
      expect(s.textAlign).toBe('center')
    }
  })

  it('makes headlines heavy and tight, and taglines light and open', () => {
    const headline = layerTextStyle('headline', base)
    const tagline = layerTextStyle('tagline', base)
    expect(headline.fontWeight as number).toBeGreaterThan(tagline.fontWeight as number)
    expect(headline.lineHeight as number).toBeLessThan(tagline.lineHeight as number)
    expect(headline.letterSpacing).toMatch(/^-/)
    expect(tagline.letterSpacing).not.toMatch(/^-/)
  })

  it('only breaks a word that cannot fit on its own line', () => {
    expect(layerTextStyle('headline', base).overflowWrap).toBe('break-word')
  })
})

describe('ctaPillStyle', () => {
  it('is a rounded pill in the layer color with a soft shadow', () => {
    const s = ctaPillStyle({ fontSizePx: 30, background: '#28c98b', color: '#041014' })
    expect(s.background).toMatch(/^linear-gradient\(to bottom, #[0-9a-f]{6}, #28c98b\)$/)
    expect(s.color).toBe('#041014')
    expect(s.borderRadius).toBe('0.975em')
    expect(s.boxShadow).toBe(PILL_SHADOW)
    expect(s.fontSize).toBe(30)
  })

  it('never wraps its label (the box width is only an estimate)', () => {
    expect(ctaPillStyle({ fontSizePx: 30, background: '#28c98b', color: '#041014' }).whiteSpace).toBe('nowrap')
  })
})

describe('isTextStyleKind', () => {
  it('recognises the styled text kinds only', () => {
    expect(isTextStyleKind('headline')).toBe(true)
    expect(isTextStyleKind('cta')).toBe(true)
    expect(isTextStyleKind('logo')).toBe(false)
    expect(isTextStyleKind('design')).toBe(false)
  })
})

describe('accentRuleStyle', () => {
  const box = { leftPx: 400, topPx: 600, widthPx: 800, heightPx: 70 }
  it('draws only for headlines', () => {
    for (const k of ['tagline', 'businessName', 'offer', 'cta', 'logo', 'design'] as const) {
      expect(accentRuleStyle(k, 'slide-up', box, 1920, 1080, '#f00')).toBeNull()
    }
    expect(accentRuleStyle('headline', 'slide-up', box, 1920, 1080, '#f00')).not.toBeNull()
  })

  it('puts a short centered rule under the text', () => {
    const r = accentRuleStyle('headline', 'slide-up', box, 1920, 1080, '#f00')!
    expect(r.top as number).toBeGreaterThan(box.topPx + box.heightPx)
    expect((r.left as number) + (r.width as number) / 2).toBeCloseTo(box.leftPx + box.widthPx / 2, 0)
    expect(r.width as number).toBeLessThan(box.widthPx)
    expect(r.height as number).toBeGreaterThanOrEqual(3)
    expect(r.background).toBe('#f00')
  })

  it('uses a vertical bar on the left edge for the lower-third animation', () => {
    const r = accentRuleStyle('headline', 'lower-third', box, 1920, 1080, '#0f0')!
    expect((r.left as number) + (r.width as number)).toBeLessThan(box.leftPx)
    expect(r.height).toBe(box.heightPx)
    expect(r.top).toBe(box.topPx)
  })

  it('never goes off the left edge and ignores empty boxes', () => {
    const r = accentRuleStyle('headline', 'lower-third', { ...box, leftPx: 2 }, 1920, 1080, '#0f0')!
    expect(r.left as number).toBeGreaterThanOrEqual(0)
    expect(accentRuleStyle('headline', 'fade', { ...box, widthPx: 0 }, 1920, 1080, '#0f0')).toBeNull()
  })
})

describe('textAlignFor', () => {
  it('left-aligns text whose box the safe-area clamp pushed against the margin', () => {
    // x=.08 on 1920: unclamped left = 154 - 400 = -246, clamped to 38
    expect(textAlignFor({ x: 0.08 }, { leftPx: 38, widthPx: 800 }, 1920)).toBe('left')
  })
  it('keeps a centered column centered even when its wide box was nudged by the margin', () => {
    // x=.3 on 1920: unclamped left = 576 - 561 = 15, clamped to 38 -> still a centered column
    expect(0.3).toBeGreaterThan(LEFT_COLUMN_MAX_X)
    expect(textAlignFor({ x: 0.3 }, { leftPx: 38, widthPx: 1122 }, 1920)).toBe('center')
  })
  it('keeps centered text centered when nothing was clamped', () => {
    expect(textAlignFor({ x: 0.5 }, { leftPx: 560, widthPx: 800 }, 1920)).toBe('center')
  })
  it('layerTextStyle and the rule follow the alignment', () => {
    expect(layerTextStyle('headline', { fontSizePx: 40, color: '#fff', align: 'left' }).textAlign).toBe('left')
    expect(layerTextStyle('headline', { fontSizePx: 40, color: '#fff' }).textAlign).toBe('center')
    const box = { leftPx: 38, topPx: 400, widthPx: 800, heightPx: 60 }
    expect(accentRuleStyle('headline', 'slide-up', box, 1920, 1080, '#f00', 'left')!.left).toBe(38)
  })
})

describe('CTA pill highlight', () => {
  it('lightens hex colors toward white and rejects everything else', () => {
    expect(lightenHex('#000000', 0.5)).toBe('#808080')
    expect(lightenHex('#fff', 0.3)).toBe('#ffffff')
    expect(lightenHex('#28c98b', 0)).toBe('#28c98b')
    expect(lightenHex('rgb(1,2,3)', 0.2)).toBeNull()
    expect(lightenHex('red', 0.2)).toBeNull()
    expect(lightenHex('#28c98b', 5)).toBe('#ffffff')
  })

  it('is an opaque gradient ending in the exact color, so the exporter keeps the color', () => {
    const s = ctaPillStyle({ fontSizePx: 30, background: '#28c98b', color: '#041014' })
    const stops = String(s.background).match(/#[0-9a-f]{6}/g)!
    expect(stops[stops.length - 1]).toBe('#28c98b')
    expect(String(s.background)).not.toMatch(/rgba|transparent/i)
  })

  it('falls back to the plain color when it is not a hex value', () => {
    expect(ctaPillStyle({ fontSizePx: 30, background: 'tomato', color: '#000' }).background).toBe('tomato')
  })
})

describe('end card background', () => {
  it('is an opaque diagonal linear-gradient built around the brand color', () => {
    const css = endCardBackground('#29d3f2')
    expect(css).toMatch(/^linear-gradient\(155deg, #[0-9a-f]{6} 0%, #29d3f2 55%, #[0-9a-f]{6} 100%\)$/)
    expect(css).not.toMatch(/rgba|radial|transparent/i)
  })
  it('darkens toward black and falls back to the plain color for non-hex input', () => {
    expect(darkenHex('#ffffff', 0.5)).toBe('#808080')
    expect(darkenHex('#000', 0.5)).toBe('#000000')
    expect(darkenHex('hsl(10,10%,10%)', 0.3)).toBeNull()
    expect(endCardBackground('tomato')).toBe('tomato')
  })
})

describe('single-line text', () => {
  it('only boxes that were NOT capped at 90% of the frame are single-line', () => {
    expect(isSingleLineBox(480, 1920)).toBe(true)
    expect(isSingleLineBox(1728, 1920)).toBe(false)
    expect(isSingleLineBox(1726, 1920)).toBe(true)
  })

  it('keeps a centered single line on one line, centered on the box center whatever its real width', () => {
    const s = layerTextStyle('tagline', { fontSizePx: 34, color: '#fff', singleLine: true })
    expect(s.whiteSpace).toBe('nowrap')
    expect(s.width).toBe('max-content')
    expect(s.left).toBe('50%')
    expect(s.transform).toBe('translateX(-50%)')
  })

  it('pins a left-aligned single line to the left edge with no centering transform', () => {
    const s = layerTextStyle('tagline', { fontSizePx: 34, color: '#fff', singleLine: true, align: 'left' })
    expect(s.whiteSpace).toBe('nowrap')
    expect(s.transform).toBeUndefined()
    expect(s.left).toBeUndefined()
  })

  it('leaves wrapping text as a full-width block', () => {
    const s = layerTextStyle('headline', { fontSizePx: 60, color: '#fff' })
    expect(s.width).toBe('100%')
    expect(s.whiteSpace).toBeUndefined()
  })
})

describe('rotation in the shared styles', () => {
  it('rotates a text layer about its own center, and leaves unrotated styles without a transform', () => {
    const s = layerTextStyle('headline', { fontSizePx: 40, color: '#fff', rotation: 15 })
    expect(s.transform).toBe('rotate(15deg)')
    expect(s.transformOrigin).toBe('center center')
    expect(layerTextStyle('headline', { fontSizePx: 40, color: '#fff' }).transform).toBeUndefined()
    expect(layerTextStyle('headline', { fontSizePx: 40, color: '#fff', rotation: 0 }).transform).toBeUndefined()
    expect(layerTextStyle('headline', { fontSizePx: 40, color: '#fff', rotation: 360 }).transform).toBeUndefined()
  })

  it('applies the centering translate before the rotation, and no translate when left-aligned', () => {
    expect(layerTextStyle('tagline', { fontSizePx: 30, color: '#fff', singleLine: true, rotation: 20 }).transform).toBe('translateX(-50%) rotate(20deg)')
    expect(layerTextStyle('tagline', { fontSizePx: 30, color: '#fff', singleLine: true, align: 'left', rotation: 20 }).transform).toBe('rotate(20deg)')
    expect(layerTextStyle('tagline', { fontSizePx: 30, color: '#fff', singleLine: true }).transform).toBe('translateX(-50%)')
  })

  it('rotates the CTA pill about its center', () => {
    const s = ctaPillStyle({ fontSizePx: 30, background: '#28c98b', color: '#041014', rotation: -8 })
    expect(s.transform).toBe('rotate(-8deg)')
    expect(s.transformOrigin).toBe('center center')
    expect(ctaPillStyle({ fontSizePx: 30, background: '#28c98b', color: '#041014' }).transform).toBeUndefined()
  })
})

describe('accent rule follows a rotated headline', () => {
  const box = { leftPx: 400, topPx: 600, widthPx: 800, heightPx: 70 }

  it('has no transform when the headline is not rotated', () => {
    expect(accentRuleStyle('headline', 'slide-up', box, 1920, 1080, '#f00', 'center')!.transform).toBeUndefined()
    expect(accentRuleStyle('headline', 'slide-up', box, 1920, 1080, '#f00', 'center', 0)!.transform).toBeUndefined()
  })

  it('rotates about the center of the TEXT box, expressed in the rule\'s own coordinates', () => {
    const r = accentRuleStyle('headline', 'slide-up', box, 1920, 1080, '#f00', 'center', -12)!
    expect(r.transform).toBe('rotate(-12deg)')
    const [ox, oy] = String(r.transformOrigin).split(' ').map((v) => parseFloat(v))
    // the pivot, mapped back into the frame, is the text box center
    expect((r.left as number) + ox).toBeCloseTo(800, 6)
    expect((r.top as number) + oy).toBeCloseTo(635, 6)
  })

  it('does the same for the lower-third bar and for left-aligned text', () => {
    const bar = accentRuleStyle('headline', 'lower-third', box, 1920, 1080, '#0f0', 'center', 20)!
    expect((bar.left as number) + parseFloat(String(bar.transformOrigin).split(' ')[0])).toBeCloseTo(800, 6)
    const left = accentRuleStyle('headline', 'slide-up', box, 1920, 1080, '#0f0', 'left', 20)!
    expect((left.left as number) + parseFloat(String(left.transformOrigin).split(' ')[0])).toBeCloseTo(800, 6)
  })

  it('is still null for non-headlines whatever the rotation', () => {
    expect(accentRuleStyle('tagline', 'slide-up', box, 1920, 1080, '#f00', 'center', 30)).toBeNull()
  })
})
