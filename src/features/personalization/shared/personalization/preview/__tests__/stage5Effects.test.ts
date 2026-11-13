/**
 * Stage 5 — footage look / motion / fades and text-layer effects: validation, the CSS they produce, the colour maths
 * (against values from the Filter Effects spec and from a real browser measurement), camera motion and fades over time,
 * exits and the new entrances, and the pure edits the panels make.
 */
import { describe, expect, it } from 'vitest'
import {
  DEFAULT_MOTION, IDENTITY_LOOK, LOOK_PRESETS, MOTION_PRESETS, fadeCoverAt, lookFilterCss, lookIsActive, lookPresetById, motionAt, motionIsActive,
  motionPresetById, normalizeFade, normalizeFootageEffects, normalizeLook, normalizeMotion, predictLookRgb, temperatureGains, temperatureOverlayColor, vignetteBackground,
} from '../videoEffects'
import { NEW_ENTRANCES, NO_EXIT, exitFactorsAt, newEntranceFactors, normalizeLayerEffect, normalizeLayerExit, textEffectStyle } from '../layerEffects'
import { createDefaultPreviewSettings, normalizePreviewSettings, PREVIEW_ANIMATIONS } from '../presets'
import { applyLookPreset, applyMotionPreset, clearFootageEffects, patchLook, patchMotion, setFade, setLayerEffect, setLayerExit } from '../../guided/effectsEdit'
import type { PreviewLayer } from '../types'

const look = (over: Partial<typeof IDENTITY_LOOK> = {}) => ({ ...IDENTITY_LOOK, ...over })
const near = (a: number[], b: number[], tol = 1.5) => a.every((v, i) => Math.abs(v - b[i]) <= tol)

describe('look: validation and CSS', () => {
  it('normalizeLook clamps and defaults; rejects non-objects', () => {
    for (const bad of [null, undefined, 4, 'x', []]) expect(normalizeLook(bad)).toBeUndefined()
    expect(normalizeLook({ brightness: 99, contrast: -5, saturation: 99, hue: 999, temperature: 9, grayscale: 3, sepia: -1, blur: 999, vignette: 5 })).toEqual({ enabled: true, brightness: 2, contrast: 0.3, saturation: 3, hue: 180, temperature: 1, grayscale: 1, sepia: 0, blur: 30, vignette: 1 })
    expect(normalizeLook({})).toEqual(IDENTITY_LOOK); expect(normalizeLook({ enabled: false })!.enabled).toBe(false)
  })
  it('an identity or disabled look changes nothing and emits no CSS', () => {
    expect(lookIsActive(IDENTITY_LOOK)).toBe(false); expect(lookFilterCss(IDENTITY_LOOK, 1920)).toBeUndefined()
    expect(lookIsActive(look({ enabled: false, contrast: 1.5 }))).toBe(false); expect(lookFilterCss(undefined, 1920)).toBeUndefined()
  })
  it('CSS filter string: fixed order, identity parts omitted, blur is resolution independent', () => {
    expect(lookFilterCss(look({ brightness: 1.2, contrast: 1.1, saturation: 0.8, hue: 20, sepia: 0.3, grayscale: 0.5, blur: 10 }), 1000)).toBe('brightness(1.2) contrast(1.1) saturate(0.8) hue-rotate(20deg) sepia(0.3) grayscale(0.5) blur(10px)')
    expect(lookFilterCss(look({ blur: 10 }), 1920)).toBe('blur(19.2px)')
    expect(lookFilterCss(look({ temperature: 0.5, vignette: 0.4 }), 1920)).toBeUndefined() // those two are overlays, not filters
  })
  it('temperature: no overlay at 0, warm lowers blue most, cool lowers red most, gains never exceed 1', () => {
    expect(temperatureOverlayColor(0)).toBeUndefined()
    const [wr, wg, wb] = temperatureGains(1); expect(wr).toBe(1); expect(wb).toBeLessThan(wg); expect(wg).toBeLessThan(wr)
    const [cr, cg, cb] = temperatureGains(-1); expect(cb).toBe(1); expect(cr).toBeLessThan(cg)
    for (const t of [-1, -0.3, 0.2, 1]) for (const g of temperatureGains(t)) { expect(g).toBeLessThanOrEqual(1); expect(g).toBeGreaterThan(0.5) }
    expect(temperatureOverlayColor(0.5)).toMatch(/^rgb\(\d+, \d+, \d+\)$/)
  })
  it('vignette: none at 0; stronger = darker and wider', () => {
    expect(vignetteBackground(0)).toBeUndefined(); expect(vignetteBackground(-1)).toBeUndefined()
    expect(vignetteBackground(1)).toContain('rgba(0,0,0,0.9)'); expect(vignetteBackground(0.5)).toContain('rgba(0,0,0,0.45)')
    expect(vignetteBackground(1)).toContain('40%'); expect(vignetteBackground(0.1)).toContain('60%')
  })
  it('presets are valid, stable under normalization and unique', () => {
    for (const p of LOOK_PRESETS) { const full = { enabled: true, ...p.look }; expect(normalizeLook(full), p.id).toEqual(full) }
    expect(new Set(LOOK_PRESETS.map((p) => p.id)).size).toBe(LOOK_PRESETS.length); expect(lookIsActive({ enabled: true, ...lookPresetById('natural')!.look })).toBe(false)
    for (const id of ['warm', 'cool', 'cinematic', 'vivid', 'vintage', 'mono']) expect(lookIsActive({ enabled: true, ...lookPresetById(id)!.look }), id).toBe(true)
  })
})

describe('look: colour maths (the same numbers the browser produces)', () => {
  it('brightness / contrast / saturate / hue-rotate / sepia / grayscale match the Filter Effects maths and measured browser output', () => {
    expect(predictLookRgb([128, 128, 128], look({ brightness: 1.5 })).map(Math.round)).toEqual([192, 192, 192]) // measured in the web renderer: 192
    expect(predictLookRgb([200, 50, 50], look({ saturation: 0 })).map(Math.round)).toEqual([82, 82, 82]) // measured: 82
    expect(predictLookRgb([255, 0, 0], look({ hue: 120 })).map(Math.round)).toEqual([0, 113, 0]) // measured: 0,113,0
    expect(near(predictLookRgb([100, 100, 100], look({ sepia: 1 })), [135, 118, 91], 3)).toBe(true) // measured: 135,118,91
    expect(predictLookRgb([200, 50, 50], look({ grayscale: 1 })).map(Math.round)).toEqual([82, 82, 82])
    expect(predictLookRgb([60, 120, 180], look({ contrast: 1 })).map(Math.round)).toEqual([60, 120, 180])
    expect(predictLookRgb([64, 64, 64], look({ contrast: 2 }))[0]).toBeCloseTo(0.5 * 255 - (127.5 - 64) * 2 + 127.5 - 127.5 + 0, 0) // (0.25-0.5)*2+0.5 = 0 → 0
  })
  it('saturation 1, hue 0, brightness 1 are exact identities; results stay in 0..255', () => {
    expect(predictLookRgb([10, 200, 77], IDENTITY_LOOK)).toEqual([10, 200, 77])
    for (const rgb of [[0, 0, 0], [255, 255, 255], [255, 0, 255]] as const) for (const l of LOOK_PRESETS) for (const v of predictLookRgb([...rgb] as never, { enabled: true, ...l.look }, 1)) { expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThanOrEqual(255) }
  })
  it('temperature multiplies by the gains; vignette darkens only towards the edge', () => {
    const g = temperatureGains(0.5)
    expect(predictLookRgb([200, 200, 200], look({ temperature: 0.5 }))).toEqual([200 * g[0], 200 * g[1], 200 * g[2]])
    const v = look({ vignette: 1 })
    expect(predictLookRgb([200, 200, 200], v, 0)).toEqual([200, 200, 200]); expect(predictLookRgb([200, 200, 200], v, 0.4)).toEqual([200, 200, 200])
    expect(predictLookRgb([200, 200, 200], v, 1)[0]).toBeCloseTo(20, 5); expect(predictLookRgb([200, 200, 200], v, 0.8)[0]).toBeLessThan(200)
  })
})

describe('camera motion and fades', () => {
  const m = (z: [number, number], px: [number, number] = [0, 0], py: [number, number] = [0, 0], ease: 'linear' | 'ease-in-out' = 'linear') => ({ enabled: true, zoom: { from: z[0], to: z[1] }, pan: { x: { from: px[0], to: px[1] }, y: { from: py[0], to: py[1] } }, ease })
  it('hits the endpoints exactly and is linear when asked', () => {
    const a = motionAt(0, m([1, 1.5], [-0.1, 0.1]), 101, 1000, 500), b = motionAt(100, m([1, 1.5], [-0.1, 0.1]), 101, 1000, 500), mid = motionAt(50, m([1, 1.5], [-0.1, 0.1]), 101, 1000, 500)
    expect(a).toEqual({ scale: 1, tx: -100, ty: 0 }); expect(b.scale).toBeCloseTo(1.5, 9); expect(b.tx).toBeCloseTo(100, 6); expect(mid.scale).toBeCloseTo(1.25, 9); expect(mid.tx).toBeCloseTo(0, 6)
  })
  it('ease-in-out is slower at the ends and the same at the middle', () => {
    const e = (f: number) => motionAt(f, m([1, 2], [0, 0], [0, 0], 'ease-in-out'), 101, 100, 100).scale
    expect(e(10) - 1).toBeLessThan(0.1 * 1 - 0.01 + 0.0001); expect(e(50)).toBeCloseTo(1.5, 9); expect(e(90)).toBeGreaterThan(1.9)
  })
  it('disabled / absent / zero-length clips are safe', () => {
    expect(motionAt(10, undefined, 100, 100, 100)).toEqual({ scale: 1, tx: 0, ty: 0 }); expect(motionAt(10, { ...m([1, 2]), enabled: false }, 100, 100, 100).scale).toBe(1)
    expect(motionAt(0, m([1, 2]), 1, 100, 100).scale).toBe(2); expect(motionAt(-5, m([1, 2]), 100, 100, 100).scale).toBe(1); expect(motionAt(500, m([1, 2]), 100, 100, 100).scale).toBe(2)
    expect(motionIsActive(m([1, 1]))).toBe(false); expect(motionIsActive(m([1, 1.1]))).toBe(true); expect(motionIsActive({ ...m([1, 2]), enabled: false })).toBe(false)
  })
  it('drift stays covered when the zoom is at least 1 + 2 * |drift| (no empty edge)', () => {
    for (const p of MOTION_PRESETS) {
      for (let f = 0; f <= 100; f += 5) { const s = motionAt(f, { enabled: true, ...p.motion }, 101, 1, 1); expect(Math.abs(s.tx), p.id).toBeLessThanOrEqual((s.scale - 1) / 2 + 1e-9) }
    }
  })
  it('normalizeMotion / presets', () => {
    expect(normalizeMotion({ zoom: { from: 9, to: 0 }, pan: { x: { from: 5, to: -5 } }, ease: 'x' })).toEqual({ enabled: true, zoom: { from: 3, to: 1 }, pan: { x: { from: 0.3, to: -0.3 }, y: { from: 0, to: 0 } }, ease: 'ease-in-out' })
    for (const p of MOTION_PRESETS) { const full = { enabled: true, ...p.motion }; expect(normalizeMotion(full), p.id).toEqual(full) }
    expect(motionPresetById('push-in')!.motion.zoom.to).toBeGreaterThan(1); expect(DEFAULT_MOTION.enabled).toBe(true)
  })
  it('fade cover: full black at the first/last frame, clear in the middle, both ends independent', () => {
    const f = { inFrames: 10, outFrames: 20 }
    expect(fadeCoverAt(0, f, 100)).toBe(1); expect(fadeCoverAt(10, f, 100)).toBe(0); expect(fadeCoverAt(5, f, 100)).toBeCloseTo(0.5, 9)
    expect(fadeCoverAt(99, f, 100)).toBe(1); expect(fadeCoverAt(79, f, 100)).toBe(0); expect(fadeCoverAt(89, f, 100)).toBeCloseTo(0.5, 9); expect(fadeCoverAt(50, f, 100)).toBe(0)
    expect(fadeCoverAt(3, undefined, 100)).toBe(0); expect(fadeCoverAt(0, { inFrames: 0, outFrames: 0 }, 100)).toBe(0)
    expect(fadeCoverAt(0, { inFrames: 60, outFrames: 60 }, 100)).toBe(1) // overlapping fades never exceed 1
    expect(normalizeFade({ inFrames: 0, outFrames: 0 })).toBeUndefined(); expect(normalizeFade({ inFrames: 5000, outFrames: -3 })).toEqual({ inFrames: 900, outFrames: 0 })
  })
  it('normalizeFootageEffects keeps only what is set; wired into normalizePreviewSettings', () => {
    expect(normalizeFootageEffects({})).toBeUndefined(); expect(normalizeFootageEffects('x')).toBeUndefined()
    const s = createDefaultPreviewSettings()
    const n = normalizePreviewSettings({ ...s, footageEffects: { look: look({ contrast: 1.2 }), fade: { inFrames: 5, outFrames: 0 } } } as never)
    expect(n.footageEffects?.look?.contrast).toBe(1.2); expect(n.footageEffects?.fade).toEqual({ inFrames: 5, outFrames: 0 }); expect(normalizePreviewSettings(s as never).footageEffects).toBeUndefined()
    expect(normalizePreviewSettings(JSON.parse(JSON.stringify(n)) as never).footageEffects).toEqual(n.footageEffects)
  })
})

describe('text layer effects, exits, new entrances', () => {
  it('normalizeLayerEffect: clamps, refuses bad colours, drops an empty effect', () => {
    expect(normalizeLayerEffect({ shadow: 0 })).toBeUndefined(); expect(normalizeLayerEffect(null)).toBeUndefined()
    expect(normalizeLayerEffect({ shadow: 9, glow: { color: 'red', strength: 1 }, outline: { color: '#fff', width: 5 } })).toEqual({ shadow: 1, glow: null, outline: { color: '#fff', width: 0.08 } })
    expect(normalizeLayerEffect({ glow: { color: '#ff0000', strength: 0 } })).toBeUndefined()
    const e = normalizeLayerEffect({ shadow: 0.5, glow: { color: '#00ff00', strength: 0.5 } })!; expect(normalizeLayerEffect(JSON.parse(JSON.stringify(e)))).toEqual(e)
  })
  it('textEffectStyle scales with the font size and only emits what is set', () => {
    expect(textEffectStyle(undefined, 40)).toEqual({})
    const s = textEffectStyle({ shadow: 1, glow: { color: '#ff0000', strength: 1 }, outline: { color: '#0000ff', width: 0.05 } }, 100)
    expect(s.textShadow).toContain('#ff0000'); expect(s.textShadow).toContain('rgba(0,0,0,0.9)'); expect(s.WebkitTextStroke).toBe('5px #0000ff')
    expect(textEffectStyle({ shadow: 0.5, glow: null, outline: null }, 100).WebkitTextStroke).toBeUndefined()
    expect(textEffectStyle({ shadow: 0, glow: null, outline: { color: '#000000', width: 0.02 } }, 50).textShadow).toBeUndefined()
    const a = textEffectStyle({ shadow: 1, glow: null, outline: null }, 50).textShadow!, b = textEffectStyle({ shadow: 1, glow: null, outline: null }, 100).textShadow!
    expect(parseFloat(b.split('px')[1] ?? '0') || 0).toBeGreaterThanOrEqual(0); expect(b).not.toBe(a)
  })
  it('exit: nothing before the window, fully gone at the end frame, per-style motion, never without an end frame', () => {
    const ex = (animation: 'fade' | 'slide-up' | 'slide-down' | 'zoom-out') => ({ animation, frames: 20 })
    expect(exitFactorsAt(undefined, 50, 60)).toBe(NO_EXIT); expect(exitFactorsAt(ex('fade'), 99999, undefined)).toBe(NO_EXIT); expect(exitFactorsAt({ animation: 'none', frames: 10 }, 59, 60)).toBe(NO_EXIT)
    expect(exitFactorsAt(ex('fade'), 40, 60)).toBe(NO_EXIT); expect(exitFactorsAt(ex('fade'), 60, 60).opacity).toBe(0); expect(exitFactorsAt(ex('fade'), 50, 60).opacity).toBeCloseTo(0.5, 9)
    expect(exitFactorsAt(ex('slide-up'), 60, 60).translateY).toBe(-40); expect(exitFactorsAt(ex('slide-down'), 60, 60).translateY).toBe(40); expect(exitFactorsAt(ex('zoom-out'), 60, 60).scale).toBe(0.75)
    let prev = 2; for (let f = 40; f <= 60; f++) { const o = exitFactorsAt(ex('fade'), f, 60).opacity; expect(o).toBeLessThanOrEqual(prev + 1e-12); prev = o }
    expect(normalizeLayerExit({ animation: 'wobble' })).toBeUndefined(); expect(normalizeLayerExit({ animation: 'none' })).toBeUndefined(); expect(normalizeLayerExit({ animation: 'fade', frames: 99999 })).toEqual({ animation: 'fade', frames: 120 }); expect(normalizeLayerExit({ animation: 'fade', frames: 0 })!.frames).toBe(2)
  })
  it('new entrances start hidden/offset and end at rest', () => {
    for (const id of NEW_ENTRANCES) { const a = newEntranceFactors(id, 0, 0), b = newEntranceFactors(id, 1, 1); expect(a.opacity, id).toBe(0); expect(b).toEqual({ opacity: 1, scale: 1, translateX: 0, translateY: 0, blurPx: 0 }) }
    expect(newEntranceFactors('blur-in', 0, 0).blurPx).toBe(14); expect(newEntranceFactors('zoom-in', 0, 0).scale).toBe(1.4); expect(newEntranceFactors('bounce', 0, 0).translateY).toBe(-90)
    expect(newEntranceFactors('bounce', 1, 1.15).translateY).toBeGreaterThan(0) // overshoots below its resting place, then settles
  })
  it('the new entrances are selectable and survive normalization of a layer', () => {
    const ids = PREVIEW_ANIMATIONS.map((a) => a.id); for (const id of NEW_ENTRANCES) expect(ids).toContain(id)
    const s = createDefaultPreviewSettings(); const l = { ...s.layers[0], animation: 'bounce', effect: { shadow: 0.5, glow: null, outline: null }, exit: { animation: 'fade', frames: 12 } }
    const n = normalizePreviewSettings({ ...s, layers: [l] } as never).layers[0]; expect(n.animation).toBe('bounce'); expect(n.effect?.shadow).toBe(0.5); expect(n.exit).toEqual({ animation: 'fade', frames: 12 })
    expect(normalizePreviewSettings({ ...s, layers: [{ ...l, exit: { animation: 'zzz' }, effect: { shadow: 'x' } }] } as never).layers[0].exit).toBeUndefined()
  })
})

describe('panel edits (pure)', () => {
  const base = createDefaultPreviewSettings()
  it('look: patching creates it, an identity look removes the key, presets apply, clear removes everything', () => {
    const a = patchLook(base, { contrast: 1.3 }); expect(a.footageEffects?.look?.contrast).toBe(1.3); expect(base.footageEffects).toBeUndefined()
    expect(patchLook(a, { contrast: 1 }).footageEffects?.look).toEqual(IDENTITY_LOOK) // kept (enabled identity) until cleared
    expect(applyLookPreset(base, 'cinematic').footageEffects?.look?.vignette).toBe(0.45); expect(applyLookPreset(base, 'nope')).toBe(base)
    expect(clearFootageEffects(a).footageEffects).toBeUndefined()
  })
  it('motion and fade edits keep each other', () => {
    let s = applyMotionPreset(base, 'push-in'); s = setFade(s, { inFrames: 10, outFrames: 10 }); s = patchLook(s, { saturation: 1.2 })
    expect(s.footageEffects).toMatchObject({ motion: { enabled: true, zoom: { to: 1.15 } }, fade: { inFrames: 10, outFrames: 10 }, look: { saturation: 1.2 } })
    expect(patchMotion(s, { enabled: false }).footageEffects?.motion?.enabled).toBe(false); expect(setFade(s, undefined).footageEffects?.fade).toBeUndefined()
    expect(setFade(setFade(base, { inFrames: 5, outFrames: 0 }), undefined).footageEffects).toBeUndefined()
  })
  it('patches are validated, never stored raw', () => { expect(patchLook(base, { brightness: 99 }).footageEffects?.look?.brightness).toBe(2); expect(patchMotion(base, { zoom: { from: 0, to: 99 } }).footageEffects?.motion?.zoom).toEqual({ from: 1, to: 3 }) })
  it('layer effect / exit edits only touch that layer and remove cleanly', () => {
    const s = { ...base, layers: [{ ...base.layers[0], id: 'a' }, { ...base.layers[0], id: 'b' }] } as typeof base
    const a = setLayerEffect(s, 'a', { shadow: 0.6 }); expect(a.layers[0].effect?.shadow).toBe(0.6); expect(a.layers[1].effect).toBeUndefined()
    const b = setLayerEffect(a, 'a', { glow: { color: '#ffcc00', strength: 0.5 } }); expect(b.layers[0].effect).toMatchObject({ shadow: 0.6, glow: { color: '#ffcc00' } })
    expect(setLayerEffect(b, 'a', null).layers[0].effect).toBeUndefined(); expect(setLayerEffect(a, 'a', { shadow: 0 }).layers[0].effect).toBeUndefined()
    const x = setLayerExit(s, 'b', { animation: 'slide-up' }); expect(x.layers[1].exit).toEqual({ animation: 'slide-up', frames: 15 }); expect(setLayerExit(x, 'b', { frames: 30 }).layers[1].exit?.frames).toBe(30)
    expect(setLayerExit(x, 'b', null).layers[1].exit).toBeUndefined(); expect(setLayerExit(s, 'b', { animation: 'none' }).layers[1].exit).toBeUndefined()
  })
  it('layer type keeps the optional fields optional', () => { const l: PreviewLayer = { ...createDefaultPreviewSettings().layers[0] }; expect(l.effect).toBeUndefined(); expect(l.exit).toBeUndefined() })
})
