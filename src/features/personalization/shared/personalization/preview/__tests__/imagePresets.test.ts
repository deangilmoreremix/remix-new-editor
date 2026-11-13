import { describe, it, expect } from 'vitest'
import {
  IMAGE_PRESETS, IMAGE_PRESET_ORDER, collageTiles, defaultPresetFor, imageRoleForLayerKind, imageRoleFromCategory,
  presetStyle, presetSuitsRole, resolveImageLook, splitSideFor,
} from '../imagePresets'
import { normalizeImageStyle, revealFactors, REVEAL_FRAMES, ORIGINAL_STYLE } from '../imageStyle'
import { createLayer, normalizePreviewSettings, createDefaultPreviewSettings } from '../presets'
import type { PreviewAspectRatio } from '../types'

const ASPECTS: PreviewAspectRatio[] = ['16:9', '9:16', '1:1', '4:5']
const look = (over: Partial<Parameters<typeof resolveImageLook>[0]> = {}) =>
  resolveImageLook({ role: 'product-image', kind: 'productImage', hints: { aspect: 1.5 }, ...over })

describe('image roles come from explicit categories and assignments — not filenames or order', () => {
  it('maps every discovery category to exactly one role', () => {
    expect(imageRoleFromCategory('product')).toBe('product')
    expect(imageRoleFromCategory('service')).toBe('service')
    expect(imageRoleFromCategory('person')).toBe('portrait')
    expect(imageRoleFromCategory('completed_work')).toBe('portfolio')
    expect(imageRoleFromCategory('storefront')).toBe('property')
    expect(imageRoleFromCategory('office')).toBe('property')
    expect(imageRoleFromCategory('logo')).toBe('logo')
    for (const c of ['team', 'branded_vehicle', 'brand', 'irrelevant', undefined, null]) expect(imageRoleFromCategory(c as never)).toBe('general')
  })
  it('the customer\'s explicit section wins over the category', () => {
    expect(imageRoleFromCategory('product', 'logo')).toBe('logo')
    expect(imageRoleFromCategory('product', 'person')).toBe('portrait')
  })
  it('the fallback role comes from the layer kind', () => {
    expect(imageRoleForLayerKind('logo')).toBe('logo')
    expect(imageRoleForLayerKind('serviceImage')).toBe('service')
    expect(imageRoleForLayerKind('productImage')).toBe('product')
  })
  it('the look does not depend on the image URL (filename) at all', () => {
    const a = look({ hints: { aspect: 1.5, role: 'product' } })
    const b = resolveImageLook({ role: 'product-image', kind: 'productImage', hints: { aspect: 1.5, role: 'product' } })
    expect(JSON.stringify(a)).toBe(JSON.stringify(b))
  })
})

describe('role + template → default preset', () => {
  it('chooses by role', () => {
    expect(defaultPresetFor('portrait')).toBe('circular-portrait')
    expect(defaultPresetFor('property')).toBe('rounded-floating-card') // wide rounded card per the role table
    expect(defaultPresetFor('real-estate')).toBe('rounded-floating-card')
    expect(defaultPresetFor('food')).toBe('rounded-floating-card')
    expect(defaultPresetFor('service')).toBe('rounded-floating-card')
    expect(defaultPresetFor('portfolio')).toBe('rounded-floating-card')
    expect(defaultPresetFor('general')).toBe('rounded-floating-card')
    expect(defaultPresetFor('logo')).toBeNull()
  })
  it('a product gets Product Spotlight only in the Product Showcase template', () => {
    expect(defaultPresetFor('product', 'product-showcase')).toBe('product-spotlight')
    expect(defaultPresetFor('product', 'business-introduction')).toBe('rounded-floating-card')
  })
  it('multi-image and split presets are never defaults — the customer chooses them', () => {
    for (const role of ['product', 'service', 'portrait', 'property', 'portfolio', 'general'] as const) {
      for (const layout of ['product-showcase', 'service-promotion', 'business-introduction']) {
        expect(['multi-image-collage', 'split-screen', 'polaroid', 'soft-masked']).not.toContain(defaultPresetFor(role, layout))
      }
    }
  })
})

describe('resolveImageLook', () => {
  it('portrait role → circle; property → wide rounded card; product in Product Showcase → spotlight', () => {
    expect(look({ hints: { role: 'portrait' } }).style).toMatchObject({ presetId: 'circular-portrait', shape: 'circle', fit: 'cover' })
    expect(look({ hints: { role: 'property', aspect: 1.6 } }).style).toMatchObject({ presetId: 'rounded-floating-card', shape: 'rounded-rect', radiusComp: 0.028, borderWidth: 0.003, borderColor: '#ffffff' })
    expect(look({ layout: 'product-showcase', hints: { role: 'product', aspect: 1 } }).style).toMatchObject({ presetId: 'product-spotlight', spotlight: true, fit: 'contain' })
  })
  it('a photo that merely contains a person (not a portrait role) is not circular', () => {
    expect(look({ hints: { role: 'general', aspect: 1.5 } }).style!.shape).not.toBe('circle')
    expect(look({ hints: { role: 'property', aspect: 1.5 } }).style!.shape).not.toBe('circle')
  })
  it('logos and already-framed or transparent images stay original; customer styles and template styles are honoured', () => {
    expect(resolveImageLook({ role: 'logo', kind: 'logo', hints: { aspect: 3 } }).style).toMatchObject({ shape: 'square', shadow: 'none' })
    for (const hints of [{ transparentCorners: true }, { alreadyFramed: true }, { hasTransparency: true }]) {
      expect(look({ hints: { ...hints, aspect: 1 } }).style).toMatchObject({ shape: 'square', shadow: 'none' })
    }
    const mine = { ...presetStyle('polaroid', '16:9', false) }
    expect(look({ layerStyle: mine }).style).toBe(mine)
    expect(look({ templateStyle: { shape: 'pill' }, hints: { aspect: 1 } }).reason).toBe('template style')
    expect(look({ templateStyle: { shape: 'pill' }, hints: { aspect: 1 } }).style!.shape).toBe('pill')
  })
  it('holds a contained preset back until the size is known; cover presets need no size', () => {
    expect(look({ hints: {} }).reason).toBe('waiting for the image size')
    expect(look({ hints: { role: 'portrait' } }).style!.presetId).toBe('circular-portrait')
  })
  it('does not style roles that keep their own treatment', () => {
    expect(resolveImageLook({ role: 'picture-in-picture', kind: 'design' }).style).toBeNull()
    expect(resolveImageLook({ role: 'full-frame-replacement', kind: 'endCard' }).style).toBeNull()
  })
})

describe('presets', () => {
  it('all eight exist and produce a valid style at every aspect ratio', () => {
    expect(IMAGE_PRESET_ORDER).toHaveLength(8)
    for (const id of IMAGE_PRESET_ORDER) {
      for (const a of ASPECTS) {
        const s = presetStyle(id, a)
        expect(normalizeImageStyle(s), `${id} @ ${a}`).toBeTruthy()
        expect(s.presetId).toBe(id)
        expect(IMAGE_PRESETS[id].style[a]).toBeTruthy()
      }
      const p = IMAGE_PRESETS[id]
      expect(p.placement.maxFrameFraction).toBeGreaterThan(0)
      expect(p.placement.images.min).toBeGreaterThanOrEqual(1)
    }
  })
  it('declares shape, border, shadow, placement and animation where the spec requires', () => {
    expect(presetStyle('rounded-floating-card').shadow).toBe('subtle')
    expect(presetStyle('circular-portrait').borderWidth).toBeGreaterThan(0)
    expect(presetStyle('product-spotlight')).toMatchObject({ spotlight: true, shadow: 'medium', fit: 'contain' })
    expect(presetStyle('cinematic-reveal').reveal).toBe('diagonal')
    expect(presetStyle('polaroid')).toMatchObject({ frame: 'polaroid', tilt: -5, accent: 'heart' })
    expect(presetStyle('soft-masked')).toMatchObject({ shape: 'blob', mask: 'soft', glow: '#ffc98a' })
    expect(presetStyle('product-spotlight')).toMatchObject({ glow: '#ffa63d', spotlight: true })
    expect(presetStyle('soft-masked')).toMatchObject({ mask: 'soft', shadow: 'none' })
    expect(IMAGE_PRESETS['split-screen'].placement.mayCoverSubject).toBe(true)
    expect(IMAGE_PRESETS['multi-image-collage'].placement.images).toEqual({ min: 2, max: 4 })
  })
  it('reuses existing templates instead of duplicating them', () => {
    expect(IMAGE_PRESETS.polaroid.reusesDesign?.id).toBe('rve-polaroid-frame')
    expect(IMAGE_PRESETS['multi-image-collage'].reusesDesign?.id).toBe('rve-gallery-grid')
    expect(IMAGE_PRESETS['split-screen'].reusesDesign?.id).toBe('rve-image-comparison-slider')
  })
  it('marks, but does not block, presets that suit the role', () => {
    expect(presetSuitsRole('circular-portrait', 'portrait')).toBe(true)
    expect(presetSuitsRole('circular-portrait', 'product')).toBe(false)
    expect(presetSuitsRole('product-spotlight', 'product')).toBe(true)
    expect(presetSuitsRole('rounded-floating-card', 'logo')).toBe(false)
  })
})

describe('collage and split geometry', () => {
  const overlap = (a: { x: number; y: number; w: number; h: number }, b: typeof a) =>
    Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x) > 1e-9 && Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y) > 1e-9
  it('2–4 tiles never overlap, stay inside the box, and keep an even gap', () => {
    for (const n of [1, 2, 3, 4]) {
      const t = collageTiles(n)
      expect(t).toHaveLength(n)
      for (const r of t) { expect(r.x).toBeGreaterThanOrEqual(0); expect(r.y).toBeGreaterThanOrEqual(0); expect(r.x + r.w).toBeLessThanOrEqual(1 + 1e-9); expect(r.y + r.h).toBeLessThanOrEqual(1 + 1e-9) }
      for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) expect(overlap(t[i], t[j]), `${n}: ${i}/${j}`).toBe(false)
    }
    const four = collageTiles(4, 0.03)
    expect(four[1].x - (four[0].x + four[0].w)).toBeCloseTo(0.03, 9)
    expect(four[2].y - (four[0].y + four[0].h)).toBeCloseTo(0.03, 9)
  })
  it('two pictures stack vertically as bordered tiles', () => {
    const [a, b] = collageTiles(2)
    expect(a).toMatchObject({ x: 0, w: 1 })
    expect(b.y).toBeGreaterThan(a.y + a.h)
    expect(presetStyle('multi-image-collage')).toMatchObject({ borderColor: '#ffffff' })
  })
  it('clamps the tile count to 1–4', () => { expect(collageTiles(9)).toHaveLength(4); expect(collageTiles(0)).toHaveLength(1) })
  it('split screen takes the half that overlaps the subject least', () => {
    expect(splitSideFor([{ x: 0.05, y: 0.1, w: 0.3, h: 0.8 }], 1920, 1080)).toBe('right')
    expect(splitSideFor([{ x: 0.65, y: 0.1, w: 0.3, h: 0.8 }], 1920, 1080)).toBe('left')
    expect(splitSideFor([], 1920, 1080)).toBe('left') // no zones: first half wins the tie
    expect(splitSideFor([{ x: 0.1, y: 0.05, w: 0.8, h: 0.3 }], 1080, 1920)).toBe('bottom')
  })
})

describe('cinematic reveal is frame-driven', () => {
  it('wipes in over REVEAL_FRAMES with a settle, identically for any caller', () => {
    const s = presetStyle('cinematic-reveal')
    expect(revealFactors(s, 10, 10)).toEqual({ progress: 0, scale: 1.06 })
    const mid = revealFactors(s, 10 + REVEAL_FRAMES / 2, 10)
    expect(mid.progress).toBeGreaterThan(0.5); expect(mid.progress).toBeLessThan(1)
    expect(revealFactors(s, 10 + REVEAL_FRAMES, 10)).toEqual({ progress: 1, scale: 1 })
    expect(revealFactors(s, 999, 10).progress).toBe(1)
    expect(revealFactors({ ...s, reveal: 'none' }, 0, 10)).toEqual({ progress: 1, scale: 1 })
    let last = -1
    for (let f = 10; f <= 10 + REVEAL_FRAMES; f++) { const p = revealFactors(s, f, 10).progress; expect(p).toBeGreaterThanOrEqual(last); last = p }
  })
})

describe('persistence and back-compat', () => {
  it('round-trips a preset style and collage images through the settings normalizer', () => {
    const base = createDefaultPreviewSettings()
    const layer = { ...createLayer('productImage'), imageStyle: presetStyle('polaroid', '1:1', false), imageUrls: ['https://a/1.png', 'https://a/2.png', 'blob:dead', ''] }
    const out = normalizePreviewSettings({ ...base, layers: [layer] })
    const l = out.layers[0]
    expect(l.imageStyle).toMatchObject({ presetId: 'polaroid', frame: 'polaroid', tilt: -5 })
    expect(l.imageStyle!.auto).toBeUndefined() // a customer's choice stays theirs
    expect(l.imageUrls).toEqual(['https://a/1.png', 'https://a/2.png']) // dead blob and blanks dropped
    expect(normalizePreviewSettings(JSON.parse(JSON.stringify(out))).layers[0].imageStyle?.presetId).toBe('polaroid')
  })
  it('saves made before presets (rounded style, no preset fields) still restore unchanged', () => {
    const legacy = { shape: 'rounded-rect', radius: 0.12, fit: 'contain', cropX: 0.5, cropY: 0.5, borderWidth: 0, borderColor: 'brand-primary', shadow: 'subtle', fill: null, auto: false }
    const s = normalizeImageStyle(legacy)!
    expect(s).toMatchObject({ shape: 'rounded-rect', radius: 0.12 })
    expect(s.auto).toBeUndefined()
    expect(s.presetId).toBeUndefined()
    const out = normalizePreviewSettings({ ...createDefaultPreviewSettings(), layers: [{ ...createLayer('productImage'), imageStyle: legacy }] })
    expect(out.layers[0].imageStyle).toMatchObject({ shape: 'rounded-rect', fit: 'contain' })
    expect(out.layers[0].imageUrls).toBeUndefined()
  })
  it('drops malformed preset fields and clamps tilt', () => {
    const s = normalizeImageStyle({ presetId: 'nope', frame: 'x', mask: 'y', reveal: 'z', tilt: 99, splitSide: 'diag' })!
    expect(s.presetId).toBeUndefined(); expect(s.frame).toBeUndefined(); expect(s.mask).toBeUndefined()
    expect(s.reveal).toBeUndefined(); expect(s.tilt).toBe(15); expect(s.splitSide).toBeUndefined()
    expect(ORIGINAL_STYLE.presetId).toBeUndefined()
  })
})
