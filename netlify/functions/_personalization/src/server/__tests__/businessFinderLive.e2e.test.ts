/**
 * LIVE end-to-end check (network): real geocode + real discovery providers + backfill + real enrichment.
 * Skipped unless LIVE_BUSINESS_FINDER=1, so CI stays offline and deterministic.
 *   LIVE_BUSINESS_FINDER=1 npx vitest run src/server/__tests__/businessFinderLive.e2e.test.ts
 */
import { describe, it, expect, vi } from 'vitest'
import { NextRequest } from '../../../shims/next-server'

vi.mock('../../../src/server/personalizationLog', () => ({ logPersonalization: vi.fn(), createCorrelationId: vi.fn(() => 'live'), sanitizeForLog: (s: unknown) => s }))
vi.mock('../../../src/server/envValidation', () => ({ validatePersonalizationEnv: vi.fn(() => ({ valid: true, missingRequired: [] })) }))
vi.mock('../../../lib/rateLimit', () => ({ resolveRateLimitKey: () => 'live', rateLimit: () => ({ allowed: true, retryAfterMs: 0 }), rateLimit429: vi.fn() }))

import { POST as findBusinesses } from '../../../app/api/personalization/find-businesses/route'
import { POST as enrich } from '../../../app/api/personalization/enrich-business/route'

const live = process.env.LIVE_BUSINESS_FINDER === '1'
const call = (handler: typeof findBusinesses, url: string, body: unknown) =>
  handler(new NextRequest(`http://localhost/api/personalization/${url}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }))

describe.skipIf(!live)('LIVE Business Finder + enrichment', () => {
  it('finds independents (with backfill) and enriches the ones that have websites', async () => {
    const res = await call(findBusinesses, 'find-businesses', { niche: process.env.LIVE_NICHE ?? 'restaurants-food', location: process.env.LIVE_LOCATION ?? 'Tampa, FL', radiusMiles: 15 })
    const body = await res.json()
    console.log('FIND', res.status, JSON.stringify({ count: body.count, providerUsed: body.providerUsed, backfill: body.backfill, stats: body.stats, error: body.error, code: body.code }, null, 1))
    console.log('SAMPLE', JSON.stringify((body.businesses ?? []).slice(0, 8).map((b: any) => ({ n: b.name, own: b.ownershipType ?? b.ownership, w: b.website })), null, 1))
    if (process.env.LIVE_DUMP) (await import('node:fs')).writeFileSync(process.env.LIVE_DUMP, JSON.stringify(body))
    expect(res.status).toBe(200)
    const chains = (body.businesses ?? []).filter((b: any) => (b.ownershipType ?? b.ownership) === 'national_bigbox')
    expect(chains).toEqual([])
    const withSites = (body.businesses ?? []).filter((b: any) => b.website).slice(0, 5)
    console.log('WITH_WEBSITE', (body.businesses ?? []).filter((b: any) => b.website).length, 'of', body.count)
    if (!withSites.length) return
    const er = await call(enrich, 'enrich-business', { businesses: withSites.map((b: any) => ({ id: b.id, website: b.website })) })
    const eb = await er.json()
    console.log('ENRICH', er.status, JSON.stringify(eb.results?.map((r: any) => ({ site: r.website, ok: r.ok, err: r.error, pages: r.enrichment?.pagesVisited?.length, robots: r.enrichment?.robots?.status, emails: r.enrichment?.emails?.map((e: any) => [e.value, e.method, e.confidence]), phones: r.enrichment?.phones?.length, socials: Object.keys(r.enrichment?.socials ?? {}), notes: r.enrichment?.notes })), null, 1))
    if (process.env.LIVE_DUMP_ENRICH) (await import('node:fs')).writeFileSync(process.env.LIVE_DUMP_ENRICH, JSON.stringify(eb))
    expect(er.status).toBe(200)
  }, 120_000)
})
