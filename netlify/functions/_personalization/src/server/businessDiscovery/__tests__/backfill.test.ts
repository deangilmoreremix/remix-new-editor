import { describe, it, expect } from 'vitest'
import {
  BACKFILL_TARGET, mergeDuplicates, normalizeDomain, planBackfillStages, runBackfill, type BackfillStage,
} from '../backfill'
import { excludeNationalChains } from '../ownershipClassification'
import { deduplicateBusinesses } from '../businessNormalizer'
import type { BusinessDiscoveryRecord } from '../types'

const WORDS = ['Anchor', 'Birch', 'Cedar', 'Delta', 'Ember', 'Falcon', 'Garnet', 'Harbor', 'Ivory', 'Juniper', 'Kestrel', 'Lantern', 'Maple', 'Nimbus', 'Onyx']
const rec = (i: number, over: Partial<BusinessDiscoveryRecord> = {}): BusinessDiscoveryRecord => ({
  id: `r${i}`, source: 'OPENSTREETMAP', osmType: 'node', osmId: String(1000 + i),
  name: `${WORDS[i % WORDS.length]} ${WORDS[(i * 7 + 3) % WORDS.length]} Studio ${i}`,
  category: 'plumber', city: 'Tampa', region: 'FL', websiteStatus: 'unknown', verificationStatus: 'unverified', ...over,
})
const many = (from: number, n: number, over: Partial<BusinessDiscoveryRecord> = {}) => Array.from({ length: n }, (_, k) => rec(from + k, over))
const qualify = (records: BusinessDiscoveryRecord[]) => excludeNationalChains(deduplicateBusinesses(records)).kept

describe('planBackfillStages', () => {
  it('widens 15 → 25 → 35 → 50 and then tries related niches at the widest radius', () => {
    const s = planBackfillStages('wellness-fitness', 15)
    expect(s.filter((x) => x.kind === 'primary').map((x) => x.radiusMiles)).toEqual([15, 25, 35, 50])
    expect(s.filter((x) => x.kind === 'synonym').every((x) => x.radiusMiles === 50)).toBe(true)
    expect(s.filter((x) => x.kind === 'synonym').map((x) => x.niche)).toEqual(['beauty', 'sports-outdoors'])
    expect(s.map((x) => x.index)).toEqual(s.map((_, i) => i))
  })
  it('starts from a larger requested radius and never exceeds the max', () => {
    expect(planBackfillStages('beauty', 35).map((x) => x.radiusMiles).slice(0, 2)).toEqual([35, 50])
    expect(Math.max(...planBackfillStages('beauty', 80, 50).map((x) => x.radiusMiles))).toBe(50)
  })
})

describe('mergeDuplicates', () => {
  it('merges by website domain and phone across records and fills gaps from the other record', () => {
    const a = rec(1, { website: 'https://www.joes.com/about', phone: undefined, name: 'Joes Plumbing' })
    const b = rec(2, { website: 'http://joes.com', phone: '(813) 555-0100', osmId: '9999', name: 'Different Name' })
    const c = rec(3, { phone: '813-555-0100', website: undefined, osmId: '8888', name: 'Third Name' })
    const out = mergeDuplicates([a, b, c])
    expect(out).toHaveLength(1)
    expect(out[0].phone).toBeTruthy()
    expect(normalizeDomain(out[0].website)).toBe('joes.com')
  })
  it('keeps genuinely different businesses apart', () => {
    expect(mergeDuplicates([rec(1), rec(2), rec(3)])).toHaveLength(3)
  })
  it('treats "ABC Roofing LLC" and "ABC Roofing" at the same address as one', () => {
    const a = rec(1, { name: 'ABC Roofing LLC', address: '12 Main St', osmId: '1' })
    const b = rec(2, { name: 'ABC Roofing', address: '12 main st.', osmId: '2' })
    expect(mergeDuplicates([a, b])).toHaveLength(1)
  })
})

describe('runBackfill', () => {
  it('does nothing when the seed already has ≥ 30 qualifying businesses', async () => {
    let calls = 0
    const r = await runBackfill({ stages: planBackfillStages('beauty', 15), seed: many(0, 31), search: async () => { calls++; return [] }, qualify })
    expect(calls).toBe(0)
    expect(r).toMatchObject({ found: 31, target: BACKFILL_TARGET, exhausted: false, stoppedBy: 'target' })
  })
  it('widens until 30 are found and stops at that stage', async () => {
    const seen: BackfillStage[] = []
    const r = await runBackfill({
      stages: planBackfillStages('beauty', 15), seed: many(0, 12),
      search: async (s) => { seen.push(s); return many(100 * (s.index + 1), 10) },
      qualify,
    })
    expect(r.found).toBeGreaterThanOrEqual(30)
    expect(r.stoppedBy).toBe('target')
    expect(seen.length).toBeLessThan(planBackfillStages('beauty', 15).length)
    expect(r.stages.at(-1)!.qualifyingAfter).toBe(r.found)
  })
  it('never invents businesses: exhausted with honest counts when the area simply has fewer than 30', async () => {
    const r = await runBackfill({ stages: planBackfillStages('beauty', 15), seed: many(0, 7), search: async () => many(0, 7), qualify })
    expect(r.found).toBe(7)
    expect(r.exhausted).toBe(true)
    expect(r.stoppedBy).toBe('stages')
    expect(r.stages.every((s) => s.newUnique === 0)).toBe(true)
  })
  it('excludes national chains from the count (all chains → 0 qualifying)', async () => {
    const chains = ['Walmart', 'Target', 'Home Depot', "Lowe's", 'Starbucks', "McDonald's", 'CVS Pharmacy'].map((name, i) => rec(i, { name, osmId: `c${i}` }))
    const r = await runBackfill({ stages: planBackfillStages('ecommerce', 15), seed: chains, search: async () => chains, qualify })
    expect(r.found).toBe(0)
    expect(r.exhausted).toBe(true)
  })
  it('counts only the non-chain part of a mixed batch', async () => {
    const mixed = [...many(0, 10), rec(50, { name: 'Walmart', osmId: 'w1' }), rec(51, { name: 'Walmart Supercenter', osmId: 'w2' })]
    const r = await runBackfill({ stages: [], seed: mixed, search: async () => [], qualify })
    expect(r.found).toBe(10)
  })
  it('survives a failing stage and keeps going, recording the error', async () => {
    let n = 0
    const r = await runBackfill({
      stages: planBackfillStages('beauty', 15), seed: many(0, 5),
      search: async (s) => { n++; if (s.index === 0) throw new Error('overpass down'); return many(200 * s.index, 15) }, qualify,
    })
    expect(r.stages[0].error).toBe('overpass down')
    expect(r.found).toBeGreaterThanOrEqual(30)
    expect(n).toBeGreaterThan(1)
  })
  it('stops on the time budget and says so (not "exhausted")', async () => {
    let calls = 0
    const r = await runBackfill({
      stages: planBackfillStages('beauty', 15), seed: many(0, 5),
      search: async () => { calls++; return many(300 * calls, 3) }, qualify,
      outOfTime: () => calls >= 1,
    })
    expect(calls).toBe(1)
    expect(r.stoppedBy).toBe('budget')
    expect(r.exhausted).toBe(false)
  })
  it('continues from a later stage (startStage) for a follow-up request', async () => {
    const seen: number[] = []
    await runBackfill({ stages: planBackfillStages('beauty', 15), seed: many(0, 2), startStage: 2, search: async (s) => { seen.push(s.index); return [] }, qualify })
    expect(seen[0]).toBe(2)
  })
  it('qualifying is uncapped (the caller caps for display)', async () => {
    const r = await runBackfill({ stages: [], seed: many(0, 45), search: async () => [], qualify })
    expect(r.qualifying).toHaveLength(45)
  })
})

describe('chain + format descriptor classification', () => {
  it('treats a chain name plus a generic format word as that chain, but not a trade word', async () => {
    const { classifyOwnership } = await import('../ownershipClassification')
    for (const n of ['Walmart Supercenter', 'CVS Pharmacy', 'Target Express']) {
      expect(classifyOwnership({ name: n } as never)).toMatchObject({ ownership: 'national_bigbox' })
    }
    expect(classifyOwnership({ name: 'Ross Plumbing' } as never)).not.toMatchObject({ ownership: 'national_bigbox' })
  })
})

describe('shared-host websites are not identity', () => {
  it('keeps two businesses on sites.google.com apart but still merges the same page', async () => {
    const { mergeDuplicates, websiteIdentity } = await import('../backfill')
    const a = { id: 'a', source: 'OPENSTREETMAP', name: 'Alpha Cafe', website: 'https://sites.google.com/view/alpha', websiteStatus: 'unknown', verificationStatus: 'unverified' } as never
    const b = { id: 'b', source: 'OPENSTREETMAP', name: 'Beta Salon', website: 'https://sites.google.com/view/beta', websiteStatus: 'unknown', verificationStatus: 'unverified' } as never
    expect(mergeDuplicates([a, b])).toHaveLength(2)
    expect(websiteIdentity('https://sites.google.com/view/alpha/')).toBe(websiteIdentity('https://sites.google.com/view/alpha'))
    expect(websiteIdentity('https://sites.google.com/')).toBeNull()
    expect(websiteIdentity('https://www.joes.com/about')).toBe('joes.com')
  })
})
