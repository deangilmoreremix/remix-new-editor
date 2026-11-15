import { describe, it, expect } from 'vitest'
import { applyBrandKit, buildBrandKit, isBrandKitApplied } from '../brandKit'
import { createDefaultPreviewSettings, createLayer } from '../../preview/presets'
import { contrastBetween } from '../../guided/editor/colorMath'

describe('buildBrandKit', () => {
  it('returns null when the site gave no usable colour', () => {
    expect(buildBrandKit(undefined, 0.5)).toBeNull()
    expect(buildBrandKit({ primary: 'red', palette: ['nope', ''] }, 0.5)).toBeNull()
  })
  it('normalises, de-duplicates and keeps the site order', () => {
    const kit = buildBrandKit({ primary: '#ABC', palette: ['#aabbcc', '#112233', '#112233'] }, 0.5)!
    expect(kit.palette).toEqual(['#aabbcc', '#112233'])
    expect(kit.primary).toBe('#aabbcc')
  })
  it('picks the most distinct palette colour when the accent is missing or too close to the primary', () => {
    const noAccent = buildBrandKit({ primary: '#101010', palette: ['#111111', '#ffd400', '#222222'] }, 0.5)!
    expect(noAccent.accent).toBe('#ffd400')
    const tooClose = buildBrandKit({ primary: '#101010', accent: '#111111', palette: ['#ffd400'] }, 0.5)!
    expect(tooClose.accent).toBe('#ffd400')
  })
  it('keeps a distinct accent the site named', () => {
    expect(buildBrandKit({ primary: '#101010', accent: '#ff0066', palette: ['#ffd400'] }, 0.5)!.accent).toBe('#ff0066')
  })
  it('falls back to the primary for a one-colour brand', () => {
    expect(buildBrandKit({ primary: '#336699' }, 0.5)!.accent).toBe('#336699')
  })
  it('chooses a text colour that reads on the brightest footage the dim leaves', () => {
    expect(buildBrandKit({ primary: '#336699' }, 0)!.text).toBe('#000000')
    expect(buildBrandKit({ primary: '#336699' }, 0.8)!.text).toBe('#ffffff')
    const dim = 0.35
    const kit = buildBrandKit({ primary: '#336699' }, dim)!
    const v = Math.round(255 * (1 - dim)).toString(16).padStart(2, '0')
    expect(contrastBetween(kit.text, `#${v}${v}${v}`)).toBeGreaterThanOrEqual(3)
  })
})

describe('applyBrandKit', () => {
  const kit = buildBrandKit({ primary: '#112233', accent: '#ff0066' }, 0.7)!
  it('sets the three brand colours and recolours only layers that had an explicit colour', () => {
    const s = createDefaultPreviewSettings()
    s.layers = [
      createLayer('headline', { color: '#123456' }), createLayer('cta', { id: 'cta', color: '#654321' }),
      createLayer('tagline', { id: 'tagline' }), createLayer('logo'),
    ]
    const out = applyBrandKit(kit, s)
    expect(out.brandColors).toEqual({ primary: '#112233', accent: '#ff0066', text: kit.text })
    expect(out.layerPatches).toEqual([
      { layerId: 'headline', patch: { color: kit.text } },
      { layerId: 'cta', patch: { color: '#ff0066' } },
    ])
  })
  it('recolours a design layer that has an explicit colour, and leaves one without alone', () => {
    const s = createDefaultPreviewSettings()
    s.layers = [createLayer('design', { id: 'd1', designId: 'x', color: '#123456' }), createLayer('design', { id: 'd2', designId: 'y' })]
    expect(applyBrandKit(kit, s).layerPatches).toEqual([{ layerId: 'd1', patch: { color: kit.text } }])
  })
  it('never recolours a locked layer', () => {
    const s = createDefaultPreviewSettings()
    s.layers = [createLayer('headline', { color: '#123456', locked: true })]
    expect(applyBrandKit(kit, s).layerPatches).toEqual([])
  })
})

describe('isBrandKitApplied', () => {
  const kit = buildBrandKit({ primary: '#112233', accent: '#ff0066' }, 0.7)!
  const withColors = (colors: object, layers = createDefaultPreviewSettings().layers) => ({
    brandColors: { primary: '#112233', accent: '#FF0066', text: kit.text, backgroundDim: 0.7, ...colors }, layers,
  })
  it('compares colours ignoring case and shorthand', () => {
    expect(isBrandKitApplied(kit, withColors({}, []))).toBe(true)
    expect(isBrandKitApplied(kit, withColors({ primary: '#000' }, []))).toBe(false)
  })
  it('stays available while a layer with an explicit colour differs from the kit', () => {
    const recoloured = [createLayer('headline', { color: '#123456' })]
    expect(isBrandKitApplied(kit, withColors({}, recoloured))).toBe(false)
    const inSync = [createLayer('headline', { color: kit.text })]
    expect(isBrandKitApplied(kit, withColors({}, inSync))).toBe(true)
  })
  it('ignores layers without an explicit colour and locked layers', () => {
    expect(isBrandKitApplied(kit, withColors({}, [createLayer('headline')]))).toBe(true)
    expect(isBrandKitApplied(kit, withColors({}, [createLayer('headline', { color: '#123456', locked: true })]))).toBe(true)
  })
})
