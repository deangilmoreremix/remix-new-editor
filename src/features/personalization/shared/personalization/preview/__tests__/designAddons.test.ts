import { describe, it, expect } from 'vitest'
import { applyLayoutPreset, createDefaultPreviewSettings, removeDesignLayer } from '../presets'
import { addDesignWithRules, canAddDesign, listAddedDesigns, moveDesignLayer } from '../designAddons'
import { listRemotionDesignTemplates } from '../../templates'

const base = () => applyLayoutPreset(createDefaultPreviewSettings(), 'business-introduction')
const all = listRemotionDesignTemplates()
const ctx = { logoUrl: 'logo.png', productUrl: 'p.png', serviceUrl: 's.png' }
const free = (cat: string) =>
  all.find((d) => d.category === cat && canAddDesign(base(), d, { logo: true, product: true, service: true }).ok)

describe('design add-on rules', () => {
  it('adds on top and keeps every layout layer', () => {
    const b = base()
    const d = all.find((x) => canAddDesign(b, x, { logo: true, product: true, service: true }).ok)!
    const r = addDesignWithRules(b, d.id, ctx)
    expect(r.error).toBeUndefined()
    expect(r.settings.layers.slice(0, b.layers.length)).toEqual(b.layers)
    expect(listAddedDesigns(r.settings)).toHaveLength(1)
  })

  it('refuses a duplicate with a reason and leaves settings unchanged', () => {
    const b = base()
    const d = all.find((x) => canAddDesign(b, x, { logo: true, product: true, service: true }).ok)!
    const once = addDesignWithRules(b, d.id, ctx).settings
    const twice = addDesignWithRules(once, d.id, ctx)
    expect(twice.error).toMatch(/already/)
    expect(twice.settings).toBe(once)
  })

  it('refuses an unknown design', () => {
    const b = base()
    expect(addDesignWithRules(b, 'nope', ctx).error).toBeTruthy()
  })

  it('allows only one full scene at a time', () => {
    const scenes = all.filter((d) => d.category === 'full-scene' && canAddDesign(base(), d, { logo: true, product: true, service: true }).ok)
    if (scenes.length < 2) return
    const first = addDesignWithRules(base(), scenes[0].id, ctx).settings
    expect(addDesignWithRules(first, scenes[1].id, ctx).error).toMatch(/one full scene/)
  })

  it('names the missing picture when a required one is absent', () => {
    const needy = all.find((d) => (d.requiredMedia ?? []).length > 0 || (d.media ?? []).some((m) => m.required))
    if (!needy) return
    const r = canAddDesign(base(), needy, {})
    expect(r.ok).toBe(false)
    expect(r.reason).toMatch(/Needs/)
  })

  it('removing one added design keeps the others and the layout', () => {
    const b = base()
    const ok = all.filter((x) => x.category !== 'full-scene' && x.category !== 'transition' && canAddDesign(b, x, { logo: true, product: true, service: true }).ok)
    const a = addDesignWithRules(b, ok[0].id, ctx).settings
    const c = addDesignWithRules(a, ok[1].id, ctx).settings
    const middle = listAddedDesigns(c)[0]
    const removed = removeDesignLayer(c, middle.id)
    expect(listAddedDesigns(removed).map((l) => l.designId)).toEqual([ok[1].id])
    expect(removed.layers.slice(0, b.layers.length)).toEqual(b.layers)
  })

  it('moves a design past other designs only, and not past the edge', () => {
    const b = base()
    const ok = all.filter((x) => x.category !== 'full-scene' && x.category !== 'transition' && canAddDesign(b, x, { logo: true, product: true, service: true }).ok)
    const s = addDesignWithRules(addDesignWithRules(b, ok[0].id, ctx).settings, ok[1].id, ctx).settings
    const [first, second] = listAddedDesigns(s)
    const swapped = moveDesignLayer(s, second.id, -1)
    expect(listAddedDesigns(swapped).map((l) => l.id)).toEqual([second.id, first.id])
    expect(moveDesignLayer(swapped, second.id, -1)).toBe(swapped)
  })

  it('does not mutate its input', () => {
    const b = base(); const snap = JSON.stringify(b)
    const d = free('animated-headline') ?? all[0]
    addDesignWithRules(b, d.id, ctx)
    expect(JSON.stringify(b)).toBe(snap)
  })
})

describe('design layer ids', () => {
  it('gives every added design its own id so one can be removed or edited alone', () => {
    const b = base()
    const ok = all.filter((x) => x.category !== 'full-scene' && x.category !== 'transition' && canAddDesign(b, x, { logo: true, product: true, service: true }).ok)
    const s = addDesignWithRules(addDesignWithRules(b, ok[0].id, ctx).settings, ok[1].id, ctx).settings
    const ids = s.layers.map((l) => l.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})

describe('intro designs on a short clip', () => {
  it('never starts an intro before the previous one ends, and says so when there is no room', () => {
    const short = { ...base(), durationInFrames: 45 }
    const scene = all.find((d) => d.category === 'full-scene' && typeof d.placement?.endFrame === 'number' && canAddDesign(short, d, { logo: true, product: true, service: true }).ok)
    const transition = all.find((d) => d.category === 'transition' && typeof d.placement?.endFrame === 'number' && canAddDesign(short, d, { logo: true, product: true, service: true }).ok)
    if (!scene || !transition) return
    const first = addDesignWithRules(short, scene.id, ctx)
    const second = addDesignWithRules(first.settings, transition.id, ctx)
    const intros = listAddedDesigns(second.settings).filter((l) => typeof l.endFrame === 'number')
    for (let i = 1; i < intros.length; i++) expect(intros[i].startFrame).toBeGreaterThan(intros[i - 1].endFrame as number)
    if (intros.length === 1) expect(second.error).toMatch(/no room/)
  })
})
