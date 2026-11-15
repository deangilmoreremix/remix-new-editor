/**
 * Route-level tests for the ≥30 backfill: the route widens the search (radius ladder, then related
 * niches) when the first pass leaves fewer than the target, and reports honest counts. Offline: the
 * providers are mocks, the backfill module itself is real.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from '../../../shims/next-server'

vi.mock('../../../src/server/personalizationLog', () => ({
  logPersonalization: vi.fn(), createCorrelationId: vi.fn(() => 'cid'), sanitizeForLog: vi.fn((s: unknown) => s),
}))
vi.mock('../../../src/server/envValidation', () => ({ validatePersonalizationEnv: vi.fn() }))
vi.mock('../../../lib/rateLimit', () => ({
  resolveRateLimitKey: () => 'k', rateLimit: vi.fn(() => ({ allowed: true, retryAfterMs: 1 })), rateLimit429: vi.fn(),
}))
vi.mock('../../../src/server/businessDiscovery', async () => {
  const nm = await import('../../../src/server/businessDiscovery/nicheMappings')
  const norm = await import('../../../src/server/businessDiscovery/businessNormalizer')
  const own = await import('../../../src/server/businessDiscovery/ownershipClassification')
  return {
    getNicheMapping: nm.getNicheMapping, getSupportedNiches: nm.getSupportedNiches,
    geocodeLocation: vi.fn(), discoverBusinesses: vi.fn(), searchBusinessesViaNominatim: vi.fn(),
    NominatimSearchUnavailable: class extends Error {}, AllOverpassProvidersFailed: class extends Error {},
    deduplicateBusinesses: norm.deduplicateBusinesses,
    scoreAndSort: vi.fn((items: any) => items),
    classifyRecords: own.classifyRecords, excludeNationalChains: own.excludeNationalChains,
    createCacheKey: (n: string, l: string, r: number) => `${n}|${l}|${r}`,
    businessDiscoveryCache: { get: vi.fn(), set: vi.fn() },
  }
})

import { POST } from '../../../app/api/personalization/find-businesses/route'
import { geocodeLocation, discoverBusinesses, searchBusinessesViaNominatim, businessDiscoveryCache } from '../../../src/server/businessDiscovery'

const W = ['Anchor', 'Birch', 'Cedar', 'Delta', 'Ember', 'Falcon', 'Garnet', 'Harbor', 'Ivory', 'Juniper']
const rec = (i: number, name?: string) => ({
  id: `r${i}`, source: 'OPENSTREETMAP', osmType: 'node', osmId: String(5000 + i),
  name: name ?? `${W[i % 10]} ${W[(i * 3 + 1) % 10]} Studio ${i}`, category: 'x', websiteStatus: 'unknown', verificationStatus: 'unverified',
})
const batch = (from: number, n: number) => Array.from({ length: n }, (_, k) => rec(from + k))
const post = (body: object = {}) =>
  POST(new NextRequest('http://localhost/api/personalization/find-businesses', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ niche: 'beauty', location: 'Tampa, FL', radiusMiles: 15, ...body }),
  }))

beforeEach(() => {
  vi.mocked(geocodeLocation).mockReset().mockResolvedValue({ latitude: 27.9, longitude: -82.4, displayName: 'Tampa' } as any)
  vi.mocked(discoverBusinesses).mockReset()
  vi.mocked(searchBusinessesViaNominatim).mockReset().mockResolvedValue([] as any)
})

describe('find-businesses resume', () => {
  const resumeRecord = {
    id: 'seed-1', name: 'Resumed Cafe', category: 'cafe', city: 'Tampa',
    brand: 'Acme Brand', operator: 'Acme Ops', network: 'Acme Network',
    youtube: 'https://youtube.com/@resumed', linkedin: 'https://linkedin.com/company/resumed', tiktok: 'https://tiktok.com/@resumed', whatsapp: '+18135550100',
  }

  it('never reads or writes the shared cache, so a continuation runs and its caller-supplied records are not served to others', async () => {
    vi.mocked(businessDiscoveryCache.get).mockReset().mockReturnValue([rec(777)] as any)
    vi.mocked(businessDiscoveryCache.set).mockReset()
    vi.mocked(discoverBusinesses).mockResolvedValue(batch(0, 40) as any)
    const res = await post({ resume: { startStage: 2, records: [resumeRecord] } })
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.cached).toBeUndefined()
    expect(vi.mocked(businessDiscoveryCache.get)).not.toHaveBeenCalled()
    expect(vi.mocked(businessDiscoveryCache.set)).not.toHaveBeenCalled()
  })

  it('keeps the classification and social fields of the records it was handed', async () => {
    vi.mocked(businessDiscoveryCache.get).mockReset()
    vi.mocked(discoverBusinesses).mockResolvedValue(batch(0, 40) as any)
    const body = await (await post({ resume: { startStage: 2, records: [resumeRecord] } })).json()
    const kept = body.businesses.find((b: any) => b.name === 'Resumed Cafe')
    expect(kept).toMatchObject({
      brand: 'Acme Brand', operator: 'Acme Ops', network: 'Acme Network',
      youtube: 'https://youtube.com/@resumed', linkedin: 'https://linkedin.com/company/resumed', tiktok: 'https://tiktok.com/@resumed', whatsapp: '+18135550100',
    })
  })

  it('a fresh search still uses and fills the cache', async () => {
    vi.mocked(businessDiscoveryCache.get).mockReset().mockReturnValue(undefined as any)
    vi.mocked(businessDiscoveryCache.set).mockReset()
    vi.mocked(discoverBusinesses).mockResolvedValue(batch(0, 40) as any)
    await post()
    expect(vi.mocked(businessDiscoveryCache.get)).toHaveBeenCalled()
    expect(vi.mocked(businessDiscoveryCache.set)).toHaveBeenCalledTimes(1)
  })
})

describe('find-businesses cache with skipped backfill', () => {
  it('does not cache an under-target list when backfill was skipped for lack of time', async () => {
    vi.mocked(businessDiscoveryCache.get).mockReset().mockReturnValue(undefined as any)
    vi.mocked(businessDiscoveryCache.set).mockReset()
    const realNow = Date.now.bind(Date)
    let offset = 0
    const spy = vi.spyOn(Date, 'now').mockImplementation(() => realNow() + offset)
    // The first pass is short AND eats almost the whole request budget, so backfill is skipped.
    vi.mocked(discoverBusinesses).mockImplementation(async () => { offset = 100_000; return batch(0, 5) as any })
    try {
      const body = await (await post()).json()
      expect(body.backfill).toBeUndefined()
      expect(vi.mocked(businessDiscoveryCache.set)).not.toHaveBeenCalled()
    } finally { spy.mockRestore() }
  })
  it('still caches an under-target list when backfill was switched off by the caller', async () => {
    vi.mocked(businessDiscoveryCache.get).mockReset().mockReturnValue(undefined as any)
    vi.mocked(businessDiscoveryCache.set).mockReset()
    vi.mocked(discoverBusinesses).mockResolvedValue(batch(0, 5) as any)
    await post({ backfill: false })
    expect(vi.mocked(businessDiscoveryCache.set)).toHaveBeenCalledTimes(1)
  })
})

describe('find-businesses backfill', () => {
  it('widens the radius until 30 independents are found', async () => {
    vi.mocked(discoverBusinesses).mockImplementation(async (o: any) => batch(0, o.radiusMiles === 15 ? 12 : o.radiusMiles === 25 ? 24 : 40) as any)
    const res = await post()
    const body = await res.json()
    expect(body.count).toBe(30)
    expect(body.backfill).toMatchObject({ requested: 30, exhausted: false, stoppedBy: 'target' })
    expect(body.backfill.stagesUsed).toBeGreaterThanOrEqual(1)
    expect(vi.mocked(discoverBusinesses).mock.calls.map((c: any) => c[0].radiusMiles)).toContain(25)
  })

  it('excludes chains from the count and keeps widening', async () => {
    vi.mocked(discoverBusinesses).mockImplementation(async (o: any) =>
      [...batch(0, 8), rec(900, 'Walmart'), rec(901, 'Target'), ...(o.radiusMiles >= 35 ? batch(100, 30) : [])] as any)
    const body = await (await post()).json()
    expect(body.count).toBe(30)
    expect(body.businesses.some((b: any) => b.name === 'Walmart' || b.name === 'Target')).toBe(false)
  })

  it('reports honestly when the area has fewer than 30 (no invented businesses)', async () => {
    vi.mocked(discoverBusinesses).mockResolvedValue(batch(0, 9) as any)
    const body = await (await post()).json()
    expect(body.count).toBe(9)
    expect(body.backfill).toMatchObject({ requested: 30, found: 9, exhausted: true })
    expect(body.backfill.message).toMatch(/Only 9 independent/)
  })

  it('does not widen when the first pass already has 30', async () => {
    vi.mocked(discoverBusinesses).mockResolvedValue(batch(0, 40) as any)
    const body = await (await post()).json()
    expect(body.count).toBe(30)
    expect(body.backfill).toBeUndefined()
    expect(vi.mocked(discoverBusinesses)).toHaveBeenCalledTimes(1)
  })

  it('backfill:false keeps the original single-pass behaviour', async () => {
    vi.mocked(discoverBusinesses).mockResolvedValue(batch(0, 5) as any)
    const body = await (await post({ backfill: false })).json()
    expect(body.count).toBe(5)
    expect(vi.mocked(discoverBusinesses)).toHaveBeenCalledTimes(1)
  })

  it('a failing widened stage does not break the response', async () => {
    let n = 0
    vi.mocked(discoverBusinesses).mockImplementation(async () => { if (n++ > 0) throw new Error('mirror down'); return batch(0, 6) as any })
    const res = await post()
    expect(res.status).toBe(200)
    expect((await res.json()).count).toBe(6)
  })
})

describe('find-businesses backfill — stage timeout', () => {
  it('a stage that hangs is cut off, recorded as failed, and the first-pass results are still returned', async () => {
    vi.useFakeTimers()
    try {
      let n = 0
      vi.mocked(discoverBusinesses).mockImplementation((o: any) => {
        n++
        if (n === 1) return Promise.resolve(batch(0, 6) as any)
        return new Promise((_res, rej) => o.signal?.addEventListener('abort', () => rej(new Error('aborted')))) as any // hangs until aborted
      })
      vi.mocked(searchBusinessesViaNominatim).mockImplementation((o: any) => new Promise((_res, rej) => o.signal?.addEventListener('abort', () => rej(new Error('aborted')))) as any)
      const p = post()
      await vi.advanceTimersByTimeAsync(30_000)
      const res = await p
      const body = await res.json()
      expect(res.status).toBe(200)
      expect(body.count).toBe(6)
      expect(body.backfill?.stages?.some((s: any) => s.failed)).toBe(true)
    } finally { vi.useRealTimers() }
  })
})

describe('find-businesses backfill — resume', () => {
  it('continues from the given stage with the supplied records and does not repeat the first-pass search', async () => {
    const seen: number[] = []
    vi.mocked(discoverBusinesses).mockImplementation(async (o: any) => { seen.push(o.radiusMiles); return batch(500, 40) as any })
    const have = batch(0, 8).map((b) => ({ ...b, junk: 'x', rawSource: { evil: true } }))
    const body = await (await post({ resume: { startStage: 2, records: have } })).json()
    expect(body.count).toBe(30)
    expect(seen[0]).toBe(35) // stage 2 of the 15 → 25 → 35 → 50 ladder; the 15 mi first pass was skipped
    expect(seen).not.toContain(15)
    expect(body.businesses.every((b: any) => !('junk' in b) && !('rawSource' in b && (b.rawSource as any)?.evil))).toBe(true)
  })
  it('ignores a malformed resume cursor and runs the normal search', async () => {
    vi.mocked(discoverBusinesses).mockResolvedValue(batch(0, 40) as any)
    for (const bad of [{ startStage: 0, records: [] }, { startStage: 'x' }, 'nope', { startStage: 2, records: [{ nope: 1 }] }]) {
      vi.mocked(discoverBusinesses).mockClear()
      const body = await (await post({ resume: bad })).json()
      expect(body.count).toBe(30)
      expect(vi.mocked(discoverBusinesses)).toHaveBeenCalledTimes(1)
    }
  })
  it('caps the number of resumed records', async () => {
    vi.mocked(discoverBusinesses).mockResolvedValue([] as any)
    const body = await (await post({ resume: { startStage: 3, records: batch(0, 400) }, limit: 50 })).json()
    expect(body.count).toBeLessThanOrEqual(50)
  })
})
