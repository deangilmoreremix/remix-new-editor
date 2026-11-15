import { describe, it, expect } from 'vitest'
import { DESIGN_GOALS, recommendDesigns } from '../recommendations'
import { listRemotionDesignTemplates, isRemotionDesignTemplateSupported } from '..'

const designs = listRemotionDesignTemplates()
const run = (over: Partial<Parameters<typeof recommendDesigns>[0]> = {}) =>
  recommendDesigns({ designs, aspectRatio: '16:9', goal: 'introduce', available: { logo: true, product: true, service: true }, isSupported: (d) => isRemotionDesignTemplateSupported(d.id, '16:9').supported, ...over })

describe('design recommendations', () => {
  it('returns about six, deterministically', () => {
    const a = run(); const b = run()
    expect(a.length).toBeGreaterThan(0)
    expect(a.length).toBeLessThanOrEqual(6)
    expect(a.map((r) => r.design.id)).toEqual(b.map((r) => r.design.id))
  })
  it('every goal yields recommendations from the registry', () => {
    for (const g of DESIGN_GOALS) expect(run({ goal: g.id }).length, g.id).toBeGreaterThan(0)
  })
  it('only suggests designs in the goal\'s categories', () => {
    const cats = DESIGN_GOALS.find((g) => g.id === 'promote-offer')!.categories
    for (const r of run({ goal: 'promote-offer' })) expect(cats).toContain(r.design.category)
  })
  it('never suggests a design that needs a picture the customer does not have', () => {
    const none = recommendDesigns({ designs, aspectRatio: '16:9', goal: 'show-product', available: {} })
    for (const r of none) expect(r.design.requiredMedia ?? []).toEqual([])
  })
  it('respects the aspect ratio and the support check', () => {
    const r = recommendDesigns({ designs, aspectRatio: '9:16', goal: 'stand-out', available: { logo: true }, isSupported: (d) => isRemotionDesignTemplateSupported(d.id, '9:16').supported })
    for (const x of r) expect(isRemotionDesignTemplateSupported(x.design.id, '9:16').supported).toBe(true)
  })
  it('whole-frame scenes rank below overlays unless the goal is "stand out"', () => {
    const intro = run({ goal: 'introduce', limit: 50 })
    expect(intro.every((r) => r.design.category !== 'full-scene')).toBe(true)
  })
})
