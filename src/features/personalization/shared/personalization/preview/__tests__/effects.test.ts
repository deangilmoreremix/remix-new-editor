import { describe, expect, it } from 'vitest'
import {
  LOOK_PRESETS, NEUTRAL_LAYER_EFFECTS, NEUTRAL_LOOK, applyLookPreset, hexWithAlpha, isNeutralLayerEffects, isNeutralLook, layerEffectsFilter,
  lookFilter, lookOverlays, normalizeLayerEffects, normalizeLook, vignetteStops, type LookSettings,
} from '../effects'
import { normalizePreviewSettings } from '../presets'

const look = (p: Partial<LookSettings>): LookSettings => ({ ...NEUTRAL_LOOK, ...p })

describe('lookFilter', () => {
  it('is undefined for a neutral or missing look', () => {
    expect(lookFilter(undefined)).toBeUndefined()
    expect(lookFilter(NEUTRAL_LOOK)).toBeUndefined()
    expect(lookFilter(look({ temperature: 0.5, vignette: 0.5 }))).toBeUndefined() // those are not filters
  })
  it('turns exposure into stops: +1 EV doubles brightness, -1 halves it', () => {
    expect(lookFilter(look({ exposure: 1 }))).toBe('brightness(2)')
    expect(lookFilter(look({ exposure: -1 }))).toBe('brightness(0.5)')
  })
  it('lists only what changed, in a fixed order', () => {
    expect(lookFilter(look({ saturation: 0, contrast: 1.2, blur: 4, exposure: 0.5 }))).toBe('brightness(1.414) contrast(1.2) saturate(0) blur(4px)')
  })
})

describe('layerEffectsFilter', () => {
  it('is undefined when neutral', () => {
    expect(layerEffectsFilter(undefined)).toBeUndefined()
    expect(layerEffectsFilter(NEUTRAL_LAYER_EFFECTS)).toBeUndefined()
  })
  it('builds brightness, blur, shadow and glow', () => {
    const f = layerEffectsFilter({ ...NEUTRAL_LAYER_EFFECTS, brightness: 1.3, blur: 2, shadow: 0.5, glow: { color: '#ffee00', amount: 0.5 } })!
    expect(f).toContain('brightness(1.3)')
    expect(f).toContain('blur(2px)')
    expect(f).toContain('drop-shadow(0 4px 9px rgba(0,0,0,0.6))')
    expect(f).toContain('drop-shadow(0 0 12px #ffee00)')
  })
})

describe('lookOverlays', () => {
  it('is empty for neutral', () => {
    expect(lookOverlays(undefined)).toEqual([])
    expect(lookOverlays(NEUTRAL_LOOK)).toEqual([])
  })
  it('warm is orange, cool is blue; tint is magenta or green; all low opacity', () => {
    const warm = lookOverlays(look({ temperature: 1 }))[0].color
    const cool = lookOverlays(look({ temperature: -1 }))[0].color
    expect(warm).toMatch(/^rgba\(255,150,40,0\.22\)$/)
    expect(cool).toMatch(/^rgba\(60,140,255,0\.22\)$/)
    expect(lookOverlays(look({ tint: 1 }))[0].color).toMatch(/^rgba\(255,60,200,/)
    expect(lookOverlays(look({ tint: -1 }))[0].color).toMatch(/^rgba\(60,220,110,/)
  })
  it('includes the color overlay last, with its opacity', () => {
    const l = lookOverlays(look({ temperature: 0.5, overlay: { color: '#ff0000', opacity: 0.3 } }))
    expect(l.map((x) => x.key)).toEqual(['temperature', 'overlay'])
    expect(l[1].color).toBe('rgba(255,0,0,0.3)')
  })
})

describe('hexWithAlpha / vignetteStops', () => {
  it('converts hex and leaves other syntaxes alone', () => {
    expect(hexWithAlpha('#fff', 0.5)).toBe('rgba(255,255,255,0.5)')
    expect(hexWithAlpha('red', 0.5)).toBe('red')
  })
  it('vignette is clear in the middle and darker with strength', () => {
    expect(vignetteStops(0)[2].alpha).toBe(0)
    expect(vignetteStops(1)[0].alpha).toBe(0)
    expect(vignetteStops(1)[2].alpha).toBeGreaterThan(vignetteStops(0.4)[2].alpha)
  })
})

describe('normalizing', () => {
  it('drops junk and neutral looks', () => {
    expect(normalizeLook(undefined)).toBeUndefined()
    expect(normalizeLook({})).toBeUndefined()
    expect(normalizeLook({ exposure: 'x' })).toBeUndefined()
  })
  it('clamps values and keeps a valid preset id', () => {
    const l = normalizeLook({ exposure: 9, contrast: 0, saturation: 9, temperature: -9, tint: 9, blur: 99, vignette: 9, preset: 'cinematic', overlay: { color: '#123456', opacity: 9 } })!
    expect(l).toMatchObject({ exposure: 2, contrast: 0.5, saturation: 2, temperature: -1, tint: 1, blur: 20, vignette: 1, preset: 'cinematic' })
    expect(l.overlay).toEqual({ color: '#123456', opacity: 0.8 })
    expect(normalizeLook({ exposure: 1, preset: 'nope' })!.preset).toBeUndefined()
  })
  it('layer effects: clamps, drops zero glow/shadow, and neutral becomes undefined', () => {
    expect(normalizeLayerEffects({})).toBeUndefined()
    expect(normalizeLayerEffects({ glow: { color: '#fff', amount: 0 }, shadow: 0 })).toBeUndefined()
    const fx = normalizeLayerEffects({ brightness: 9, blur: -3, glow: { color: 'bad color', amount: 5 }, shadow: 5 })!
    expect(fx.brightness).toBe(2)
    expect(fx.blur).toBe(0)
    expect(fx.glow).toEqual({ color: '#ffffff', amount: 1 })
    expect(fx.shadow).toBe(1)
  })
  it('survives normalizePreviewSettings, and an old project has neither', () => {
    const out = normalizePreviewSettings({ look: { saturation: 0 }, layers: [{ kind: 'logo', effects: { blur: 3 } }, { kind: 'cta' }] })
    expect(out.look?.saturation).toBe(0)
    expect(out.layers.find((l) => l.kind === 'logo')!.effects?.blur).toBe(3)
    expect(out.layers.find((l) => l.kind === 'cta')!.effects).toBeUndefined()
    const old = normalizePreviewSettings({ layers: [{ kind: 'logo' }] })
    expect(old.look).toBeUndefined()
    expect(old.layers.every((l) => l.effects === undefined)).toBe(true)
  })
})

describe('presets', () => {
  it('every preset is valid, non-neutral and round-trips through normalize', () => {
    for (const p of LOOK_PRESETS) {
      const applied = applyLookPreset(p.id)!
      expect(applied.preset).toBe(p.id)
      expect(isNeutralLook(applied)).toBe(false)
      expect(normalizeLook(applied)).toEqual(applied)
    }
    expect(applyLookPreset('nope')).toBeUndefined()
  })
  it('black and white is fully desaturated', () => {
    expect(lookFilter(applyLookPreset('bw'))).toContain('saturate(0)')
  })
  it('neutral helpers', () => {
    expect(isNeutralLook(undefined)).toBe(true)
    expect(isNeutralLayerEffects(undefined)).toBe(true)
  })
})
