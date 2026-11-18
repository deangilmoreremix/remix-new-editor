import { describe, it, expect } from 'vitest'
import {
  HEADSHOT_DEFAULT, ORIGINAL_STYLE, ROUNDED_RECT_DEFAULT, borderPx, borderRadiusCss, frameRect,
  isStylableRole, normalizeImageStyle, objectPosition, resolveBorderColor, resolveImageStyle,
  shadowBleedPx, shadowCss, type ImageStyle,
} from '../imageStyle'
import { analyzeImagePixels } from '../imagePixels'

describe('resolveImageStyle', () => {
  it('holds the automatic frame back until a contained picture\'s size is known (never a shadow around an empty square)', () => {
    const r = resolveImageStyle({ role: 'product-image' })
    expect(r.style!.shape).toBe('square')
    expect(r.style!.shadow).toBe('none')
    expect(r.reason).toBe('waiting for the image size')
  })

  it('product and service images default to a rounded rectangle that CONTAINS the picture (no cropping)', () => {
    for (const role of ['product-image', 'service-image'] as const) {
      const { style } = resolveImageStyle({ role, hints: { aspect: 1 } })
      expect(style!.shape).toBe('rounded-rect')
      expect(style!.fit).toBe('contain')
      expect(style!.shadow).toBe('subtle')
      expect(style!.auto).toBe(true)
    }
  })

  it('a circle is used ONLY for an explicit headshot — a photo with a person in it is not circular', () => {
    expect(resolveImageStyle({ role: 'product-image', hints: { isHeadshot: true } }).style!.shape).toBe('circle')
    expect(resolveImageStyle({ role: 'product-image', hints: { isHeadshot: true } }).style!.fit).toBe('cover') // cover needs no size
    expect(resolveImageStyle({ role: 'product-image', hints: { aspect: 1.5 } }).style!.shape).toBe('rounded-rect')
    expect(resolveImageStyle({ role: 'service-image', hints: { aspect: 1 } }).style!.shape).not.toBe('circle')
  })

  it('logos keep their proportions and transparency: no clip, no fill, no shadow, no border', () => {
    const { style } = resolveImageStyle({ role: 'logo', hints: { isHeadshot: true, aspect: 3 } })
    expect(style).toMatchObject({ shape: 'square', fit: 'contain', shadow: 'none', fill: null, borderWidth: 0 })
  })

  it('does not add a second frame to a transparent, already-shaped or already-framed image', () => {
    for (const hints of [{ transparentCorners: true }, { alreadyFramed: true }, { hasTransparency: true }]) {
      const r = resolveImageStyle({ role: 'product-image', hints })
      expect(r.style!.shape).toBe('square')
      expect(r.style!.shadow).toBe('none')
      expect(r.style!.borderWidth).toBe(0)
    }
  })

  it('a template-declared style wins over the defaults', () => {
    const r = resolveImageStyle({ role: 'product-image', hints: { aspect: 1.2 }, templateStyle: { shape: 'pill', shadow: 'medium', borderWidth: 0.006 } })
    expect(r.style).toMatchObject({ shape: 'pill', shadow: 'medium', borderWidth: 0.006, fit: 'contain' })
    expect(r.reason).toBe('template style')
  })

  it('a customer-edited style is never replaced automatically', () => {
    const mine: ImageStyle = { ...ROUNDED_RECT_DEFAULT, shape: 'square', shadow: 'none', auto: false }
    const r = resolveImageStyle({ role: 'product-image', layerStyle: mine, hints: { isHeadshot: true }, templateStyle: { shape: 'pill' } })
    expect(r.style).toBe(mine)
    expect(r.reason).toBe('customer-edited')
  })

  it('leaves picture-in-picture, full-frame, text and effect roles alone', () => {
    for (const role of ['picture-in-picture', 'full-frame-replacement', 'decorative', 'text', 'caption', 'background-video'] as const) {
      expect(resolveImageStyle({ role }).style, role).toBeNull()
      expect(isStylableRole(role)).toBe(false)
    }
  })
})

describe('geometry scales with the composition, not the surface', () => {
  const style = { ...ROUNDED_RECT_DEFAULT, borderWidth: 0.005 }
  it('radius is a fraction of the frame\'s shorter side', () => {
    expect(borderRadiusCss(style, { width: 400, height: 300 })).toBe('36px')
    expect(borderRadiusCss(style, { width: 800, height: 600 })).toBe('72px') // twice the frame => twice the radius
    expect(borderRadiusCss({ ...style, shape: 'pill' }, { width: 400, height: 100 })).toBe('50px')
    expect(borderRadiusCss({ ...style, shape: 'circle' }, { width: 400, height: 400 })).toBe('50%')
    expect(borderRadiusCss({ ...style, shape: 'square' }, { width: 1, height: 1 })).toBe('0')
    expect(borderRadiusCss({ ...style, shape: 'custom', customRadii: [0.5, 0, 0.5, 0] }, { width: 200, height: 100 })).toBe('50px 0px 50px 0px')
  })
  it('border and shadow are fractions of the composition height, times the surface factor', () => {
    expect(borderPx(style, 1080)).toBe(5.4)
    expect(borderPx(style, 1920)).toBe(9.6)
    expect(borderPx(style, 1080, 0.25)).toBe(1.35) // the editor stage at a quarter scale
    expect(shadowCss(style, 1000)).toBe('0 6px 18px rgba(0,0,0,0.28)')
    expect(shadowCss(style, 1000, 0.5)).toBe('0 3px 9px rgba(0,0,0,0.28)')
    expect(shadowCss({ ...style, shadow: 'none' }, 1000)).toBeUndefined()
    expect(shadowBleedPx(style, 1000)).toBe(24)
    expect(shadowBleedPx({ ...style, shadow: 'none' }, 1000)).toBe(0)
  })
  it('resolves brand-colour borders', () => {
    expect(resolveBorderColor('brand-primary', { primary: '#111', accent: '#222' })).toBe('#111')
    expect(resolveBorderColor('brand-accent', { primary: '#111', accent: '#222' })).toBe('#222')
    expect(resolveBorderColor('#abcdef', { primary: '#111', accent: '#222' })).toBe('#abcdef')
  })
  it('the same style gives proportional results at every aspect ratio', () => {
    for (const [w, h] of [[1920, 1080], [1080, 1920], [1080, 1080], [1080, 1350]]) {
      const frame = { width: Math.round(w * 0.3), height: Math.round(w * 0.3) }
      const r = parseFloat(borderRadiusCss(style, frame))
      expect(r / frame.width).toBeCloseTo(0.12, 2)
      expect(borderPx(style, h) / h).toBeCloseTo(0.005, 4)
    }
  })
})

describe('frameRect and crop', () => {
  it('contain: the frame hugs the fitted picture (a wide image in a square box)', () => {
    const f = frameRect(ROUNDED_RECT_DEFAULT, 400, 400, 2)
    expect(f).toEqual({ left: 0, top: 100, width: 400, height: 200 })
    const tall = frameRect(ROUNDED_RECT_DEFAULT, 400, 400, 0.5)
    expect(tall).toEqual({ left: 100, top: 0, width: 200, height: 400 })
  })
  it('contain with an unknown aspect uses the whole box; cover always does', () => {
    expect(frameRect(ROUNDED_RECT_DEFAULT, 400, 300)).toEqual({ left: 0, top: 0, width: 400, height: 300 })
    expect(frameRect({ ...ROUNDED_RECT_DEFAULT, fit: 'cover' }, 400, 300, 2)).toEqual({ left: 0, top: 0, width: 400, height: 300 })
  })
  it('a circle is the centred square', () => {
    expect(frameRect(HEADSHOT_DEFAULT, 400, 300, 1)).toEqual({ left: 50, top: 0, width: 300, height: 300 })
  })
  it('crop focus becomes object-position', () => {
    expect(objectPosition({ ...HEADSHOT_DEFAULT, cropX: 0.5, cropY: 0.35 })).toBe('50% 35%')
  })
})

describe('normalizeImageStyle', () => {
  it('clamps and repairs stored styles', () => {
    const s = normalizeImageStyle({ shape: 'hexagon', radius: 9, fit: 'stretch', cropX: -3, cropY: 4, borderWidth: 1, borderColor: ' ', shadow: 'huge', fill: 'red' })!
    expect(s).toMatchObject({ shape: 'rounded-rect', radius: 0.5, fit: 'contain', cropX: 0, cropY: 1, borderWidth: 0.03, shadow: 'subtle', fill: null })
    expect(s.borderColor).toBe('#ffffff')
    expect(normalizeImageStyle(null)).toBeUndefined()
    expect(normalizeImageStyle('x')).toBeUndefined()
    expect(normalizeImageStyle({ shape: 'custom', customRadii: [0.1, 0.2, 9, 0] })!.customRadii).toEqual([0.1, 0.2, 0.5, 0])
    expect(normalizeImageStyle({ fill: '#ff0000', auto: true })).toMatchObject({ fill: '#ff0000', auto: true })
  })
  it('exports an untouched original style', () => {
    expect(ORIGINAL_STYLE.shape).toBe('square')
  })
})

/** Builds an RGBA image: `paint(x, y)` returns [r,g,b,a]. */
const image = (w: number, h: number, paint: (x: number, y: number) => number[]) => {
  const d = new Uint8ClampedArray(w * h * 4)
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) d.set(paint(x, y), (y * w + x) * 4)
  return d
}

describe('analyzeImagePixels', () => {
  const W = 100
  it('detects transparent corners (an already-rounded or cut-out image)', () => {
    const rounded = image(W, W, (x, y) => (Math.hypot(x - 49.5, y - 49.5) > 50 ? [0, 0, 0, 0] : [200, 60, 60, 255]))
    const a = analyzeImagePixels(rounded, W, W)
    expect(a.transparentCorners).toBe(true)
    expect(a.hasTransparency).toBe(true)
  })
  it('an ordinary opaque photo is neither framed nor transparent', () => {
    const photo = image(W, W, (x, y) => [60 + ((x * 7 + y * 13) % 120), 90 + ((x * 3) % 100), 80 + ((y * 5) % 100), 255])
    expect(analyzeImagePixels(photo, W, W)).toMatchObject({ transparentCorners: false, alreadyFramed: false, hasTransparency: false })
  })
  it('a uniform coloured ring around a different interior reads as a decorative frame', () => {
    const framed = image(W, W, (x, y) => (x < 4 || y < 4 || x >= W - 4 || y >= W - 4 ? [20, 40, 120, 255] : [230, 200, 60 + ((x + y) % 40), 255]))
    expect(analyzeImagePixels(framed, W, W).alreadyFramed).toBe(true)
  })
  it('a solid coloured backdrop with a bright subject is NOT a frame (the colour continues inward)', () => {
    const backdrop = image(W, W, (x, y) => (Math.hypot(x - 50, y - 50) < 35 ? [255, 212, 0, 255] : [163, 59, 107, 255]))
    expect(analyzeImagePixels(backdrop, W, W).alreadyFramed).toBe(false)
  })
  it('a plain white margin is NOT mistaken for a frame', () => {
    const margin = image(W, W, (x, y) => (x < 4 || y < 4 || x >= W - 4 || y >= W - 4 ? [255, 255, 255, 255] : [30 + ((x * 5) % 90), 40, 50 + ((y * 3) % 90), 255]))
    expect(analyzeImagePixels(margin, W, W).alreadyFramed).toBe(false)
  })
  it('is safe on degenerate input', () => {
    expect(analyzeImagePixels(new Uint8Array(0), 0, 0).transparentCorners).toBe(false)
    expect(analyzeImagePixels(new Uint8Array(8), 2, 1).alreadyFramed).toBe(false)
  })
})
