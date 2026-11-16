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

describe('context-aware ranking ("why this one")', () => {
  const fake = (id: string, category: any, media: any[] = []): any => ({ id, name: id, description: '', category, media, capabilities: { preview: true, browserExport: true } })
  const pool = [fake('headline', 'animated-headline'), fake('reveal', 'logo-reveal', [{ role: 'logo' }]), fake('lower', 'lower-third'), fake('promo', 'promo-cta')]
  const rank = (goal: any, context?: any) =>
    recommendDesigns({ designs: pool, aspectRatio: '16:9', goal, available: { logo: true, product: true, service: true }, context })

  it('is unchanged without a context, and the reason is just the goal', () => {
    const r = rank('introduce')
    expect(r.every((x) => x.reasons.length === 1)).toBe(true)
    expect(r.map((x) => x.design.id)).toEqual(['headline', 'lower', 'reveal'])
  })
  it('prefers designs with room for long text and explains why', () => {
    const r = rank('introduce', { textLength: 70 })
    expect(r.map((x) => x.design.id)).toEqual(['headline', 'lower', 'reveal'])
    expect(r[0].reasons).toContain('has room for longer text')
    expect(r.find((x) => x.design.id === 'reveal')!.score).toBeLessThan(rank('introduce').find((x) => x.design.id === 'reveal')!.score)
  })
  it('lifts a logo design when a logo exists, and a short name suits logo/promo designs', () => {
    const base = rank('brand-moment').find((x) => x.design.id === 'reveal')!
    const withLogo = rank('brand-moment', { hasLogo: true, textLength: 10 }).find((x) => x.design.id === 'reveal')!
    expect(withLogo.score).toBe(base.score + 6 + 4)
    expect(withLogo.reason).toContain('shows your logo')
    expect(withLogo.reason).toContain('suits a short name or line')
  })
  it('is deterministic for the same context', () => {
    const ctx = { textLength: 50, hasLogo: true, imageCount: 3 }
    expect(rank('introduce', ctx).map((x) => x.design.id)).toEqual(rank('introduce', ctx).map((x) => x.design.id))
  })
})
