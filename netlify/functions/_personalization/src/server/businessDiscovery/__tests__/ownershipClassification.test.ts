// @vitest-environment node
/**
 * Tests for ownership classification (Phase 2) and the split scoring model
 * (Phase 3). All heuristics are deterministic and offline.
 */

import { describe, it, expect } from 'vitest'
import {
  classifyOwnership,
  classifyRecords,
  excludeNationalChains,
  stripLocationQualifiers,
} from '../ownershipClassification'
import {
  computeContactabilityScore,
  computeLeadScore,
  computeVideoOpportunityScore,
  scoreAndSort,
} from '../businessScoring'
import type { BusinessDiscoveryRecord } from '../types'

function makeRecord(overrides: Partial<BusinessDiscoveryRecord> = {}): BusinessDiscoveryRecord {
  return {
    id: 'osm-node-1',
    source: 'OPENSTREETMAP',
    name: 'Test Business',
    category: 'Restaurants / Food',
    websiteStatus: 'unknown',
    verificationStatus: 'unverified',
    ...overrides,
  }
}

describe('classifyOwnership', () => {
  it('classifies a national chain with a city suffix as national_bigbox', () => {
    const result = classifyOwnership({ name: "McDonald's of Fort Lauderdale" })
    expect(result.ownership).toBe('national_bigbox')
    expect(result.evidence.length).toBeGreaterThan(0)
  })

  it('classifies a national chain with a unit number as national_bigbox', () => {
    const result = classifyOwnership({ name: 'Chick-fil-A #123' })
    expect(result.ownership).toBe('national_bigbox')
  })

  it('matches bigbox by first token(s), not the whole string', () => {
    expect(classifyOwnership({ name: "Sam's Club of Hollywood" }).ownership).toBe('national_bigbox')
    expect(classifyOwnership({ name: 'Starbucks' }).ownership).toBe('national_bigbox')
  })

  it('does not over-match non-qualifier suffixes', () => {
    // "Ross Plumbing" is not the Ross big-box retailer
    expect(classifyOwnership({ name: 'Ross Plumbing & Heating' }).ownership).toBe('independent')
  })

  it('classifies Brazilian steakhouses and breakfast chains found by the real-search audit', () => {
    // 2026-10-21 Fort Lauderdale quality audit: Fogo de Chão (a ~60-unit
    // chain) was classified independent. These entries are regression pins.
    expect(classifyOwnership({ name: 'Fogo de Chão' }).ownership).toBe('national_bigbox')
    expect(classifyOwnership({ name: 'Fogo de Chao Brazilian Steakhouse' }).ownership).toBe('national_bigbox')
    expect(classifyOwnership({ name: 'Texas de Brazil' }).ownership).toBe('national_bigbox')
    expect(classifyOwnership({ name: "Miller's Ale House" }).ownership).toBe('national_bigbox')
    expect(classifyOwnership({ name: 'First Watch' }).ownership).toBe('national_bigbox')
  })

  it('classifies a business with no brand evidence as independent', () => {
    const result = classifyOwnership({ name: "Joe's Diner" })
    expect(result.ownership).toBe('independent')
  })

  it('classifies franchise via brand tag differing from operator', () => {
    const result = classifyOwnership({
      name: "Joe's Pizza",
      brand: 'Pizza Hut',
      operator: 'Local Operator LLC',
    })
    expect(result.ownership).toBe('franchise_chain')
  })

  it('classifies franchise via brand tag matching the business name', () => {
    const result = classifyOwnership({ name: 'Blue Coast Grill', brand: 'Blue Coast Grill' })
    expect(result.ownership).toBe('franchise_chain')
  })

  it('classifies franchise via operator matching a known chain', () => {
    const result = classifyOwnership({ name: 'Burger Spot', operator: 'Burger King' })
    expect(result.ownership).toBe('franchise_chain')
  })

  it('classifies local_multi_location via batch names', () => {
    const result = classifyOwnership({
      name: "Joe's Pizza - Miami",
      allNamesInBatch: ["Joe's Pizza - Miami", "Joe's Pizza - Tampa", "Ace Hardware"],
    })
    expect(result.ownership).toBe('local_multi_location')
  })

  it('keeps conflicting brand evidence as unknown (retain, never discard)', () => {
    const result = classifyOwnership({ name: "Joe's Diner", brand: 'Some Unregistered Brand' })
    expect(result.ownership).toBe('unknown')
    expect(result.evidence.length).toBeGreaterThan(0)
  })

  it('strips trailing location and unit qualifiers for base names', () => {
    expect(stripLocationQualifiers("Joe's Pizza #123")).toBe('joes pizza')
    expect(stripLocationQualifiers('Joe’s Pizza - Fort Lauderdale')).toBe('joes pizza')
    expect(stripLocationQualifiers('Bank of America')).toBe('bank of america')
  })

  it('assigns ownership across a batch via classifyRecords', () => {
    const records = classifyRecords([
      makeRecord({ name: 'Local Cafe' }),
      makeRecord({ name: 'Subway' }),
    ])
    expect(records[0].ownership).toBe('independent')
    expect(records[0].ownershipEvidence).toBeDefined()
    expect(records[1].ownership).toBe('national_bigbox')
  })
})

describe('excludeNationalChains', () => {
  it('excludes only national_bigbox and counts the rest', () => {
    const records = [
      makeRecord({ id: '1', name: 'Local Cafe' }),
      makeRecord({ id: '2', name: 'Subway' }),
      makeRecord({ id: '3', name: "Joe's Diner", brand: 'Unregistered Brand' }),
      makeRecord({ id: '4', name: 'Walmart' }),
      makeRecord({ id: '5', name: 'Pizza Hut' }),
    ]
    const { kept, excluded, unknownRetained } = excludeNationalChains(records)
    expect(excluded.length).toBe(3)
    expect(kept.length).toBe(2)
    expect(kept.map((r) => r.name)).toEqual(['Local Cafe', "Joe's Diner"])
    expect(unknownRetained).toBe(1)
  })

  it('keeps an empty batch untouched', () => {
    const { kept, excluded, unknownRetained } = excludeNationalChains([])
    expect(kept.length).toBe(0)
    expect(excluded.length).toBe(0)
    expect(unknownRetained).toBe(0)
  })
})

describe('computeVideoOpportunityScore', () => {
  it('is deterministic for the same record and research input', () => {
    const record = makeRecord({
      phone: '555-1234',
      website: 'https://abc.com',
      facebook: 'https://fb.com/abc',
      instagram: 'https://ig.com/abc',
    })
    const research = { hasPromoVideo: false }
    const a = computeVideoOpportunityScore(record, { research })
    const b = computeVideoOpportunityScore(record, { research })
    expect(a).toEqual(b)
    expect(a.score).toBeGreaterThanOrEqual(0)
    expect(a.score).toBeLessThanOrEqual(100)
    expect(a.signals.length).toBeGreaterThan(0)
  })

  it('gives more opportunity when no promo video was found than when one exists', () => {
    const record = makeRecord({ website: 'https://abc.com' })
    const none = computeVideoOpportunityScore(record, { research: { hasPromoVideo: false } })
    const has = computeVideoOpportunityScore(record, { research: { hasPromoVideo: true } })
    expect(none.score).toBeGreaterThan(has.score)
  })

  it('marks video presence unknown and applies no bonus when unverified', () => {
    const record = makeRecord({ website: 'https://abc.com' })
    const unknown = computeVideoOpportunityScore(record, { research: { hasPromoVideo: 'unknown' } })
    const absent = computeVideoOpportunityScore(record)
    expect(unknown).toEqual(absent)
    expect(unknown.signals).toContain('video_presence: unknown')
  })

  it('explains every contribution with a signal', () => {
    const record = makeRecord({
      website: 'https://abc.com',
      youtube: 'https://youtube.com/abc',
    })
    const { signals } = computeVideoOpportunityScore(record, { research: { hasPromoVideo: true } })
    expect(signals.some((s) => s.includes('industry suitability'))).toBe(true)
    expect(signals.some((s) => s.includes('website'))).toBe(true)
    expect(signals.some((s) => s.includes('youtube'))).toBe(true)
  })
})

describe('computeContactabilityScore (ex-computeLeadScore)', () => {
  it('keeps the original computeLeadScore weights', () => {
    const record = makeRecord({
      phone: '555-1234',
      email: 'a@b.com',
      website: 'https://abc.com',
      address: '123 Main St',
      latitude: 26.1,
      longitude: -80.1,
      facebook: 'https://fb.com/abc',
      instagram: 'https://ig.com/abc',
      linkedin: 'https://li.com/abc',
      openingHours: 'Mo-Fr 09:00-17:00',
      operator: 'Op LLC',
    })
    // 25+15+20+10+10+5+5+5+5+3 = 100
    expect(computeContactabilityScore(record)).toBe(100)
    expect(computeLeadScore(record)).toBe(100)
  })
})

describe('scoreAndSort with composite scoring', () => {
  it('computes all three scores plus scoreBreakdown and sorts descending', () => {
    const sorted = scoreAndSort([
      makeRecord({ id: '1', name: 'Small Cafe' }),
      makeRecord({
        id: '2',
        name: 'Busy Restaurant',
        phone: '555-1',
        website: 'https://b.com',
        openingHours: 'Mo-Su 09:00-21:00',
        facebook: 'https://fb.com/b',
        instagram: 'https://ig.com/b',
      }),
    ])
    for (const record of sorted) {
      expect(record.contactabilityScore).toBeDefined()
      expect(record.activityScore).toBeDefined()
      expect(record.videoOpportunityScore).toBeDefined()
      expect(record.ownership).toBeDefined()
      expect(record.scoreBreakdown?.ownership).toBe(record.ownership)
      expect(record.scoreBreakdown?.rationale.length).toBeGreaterThan(0)
    }
    expect(sorted[0].leadScore!).toBeGreaterThanOrEqual(sorted[sorted.length - 1].leadScore!)
  })

  it('caps leadScore at 100', () => {
    const [maxed] = scoreAndSort(
      [
        makeRecord({
          name: 'Maxed Out Diner',
          phone: '555-1',
          email: 'a@b.com',
          website: 'https://m.com',
          address: '1 Main St',
          latitude: 26.1,
          longitude: -80.1,
          facebook: 'https://fb.com/m',
          instagram: 'https://ig.com/m',
          linkedin: 'https://li.com/m',
          openingHours: 'Mo-Su 09:00-21:00',
          operator: 'Op',
          category: 'Restaurants / Food',
        }),
      ],
      { research: { hasPromoVideo: false } },
    )
    expect(maxed.leadScore).toBeLessThanOrEqual(100)
  })

  it('applies the ownership multiplier (independent above franchise)', () => {
    const independent = scoreAndSort([
      makeRecord({ name: 'Independent Cafe', ownership: 'independent' }),
    ])[0]
    const franchise = scoreAndSort([
      makeRecord({ name: 'Franchise Cafe', ownership: 'franchise_chain' }),
    ])[0]
    expect(independent.leadScore!).toBeGreaterThan(franchise.leadScore!)
  })
})
