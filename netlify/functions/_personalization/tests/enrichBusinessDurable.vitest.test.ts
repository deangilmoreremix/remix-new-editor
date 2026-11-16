import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from '../shims/next-server'

const enrichment = (site: string) => ({
  website: site, emails: [], phones: [], addresses: [], contactNames: [], socials: {}, pagesVisited: [site],
  pagesSkipped: [], robots: { checked: true, status: 'allow-all' }, jsRendered: false, notes: [], enrichedAt: '2026-11-15T00:00:00Z',
})
let crawls: string[] = []
let durableStore: Record<string, unknown> = {}
const puts: string[] = []

beforeEach(() => {
  vi.resetModules()
  crawls = []; durableStore = {}; puts.length = 0
  vi.doMock('../src/server/businessEnrichment/enrich', () => ({ enrichBusinessWebsite: vi.fn(async (site: string) => { crawls.push(site); return enrichment(site) }) }))
  vi.doMock('../src/server/businessEnrichment/durableCache', () => ({
    durableGet: vi.fn(async (site: string) => (durableStore[site] as never) ?? null),
    durablePut: vi.fn(async (site: string) => { puts.push(site) }),
  }))
  vi.doMock('../src/server/personalizationLog', () => ({ logPersonalization: vi.fn(), createCorrelationId: vi.fn(() => 'corr-1') }))
  vi.doMock('../lib/rateLimit', async () => await import('../lib/rateLimit'))
})

const post = (site: string) =>
  new NextRequest('http://localhost/api/personalization/enrich-business', { method: 'POST', body: JSON.stringify({ businesses: [{ id: 'b1', website: site }] }), headers: { 'content-type': 'application/json' } })

describe('enrich-business cache layers', () => {
  it('crawls on a full miss, then stores the result durably', async () => {
    const { POST } = await import('../app/api/personalization/enrich-business/route')
    const res = await POST(post('https://miss-one.example.com'))
    expect((await res.json()).results[0].ok).toBe(true)
    expect(crawls).toEqual(['https://miss-one.example.com'])
    expect(puts).toEqual(['https://miss-one.example.com'])
  })
  it('uses the durable cache on a memory miss: no crawl, no re-write', async () => {
    durableStore['https://hit-two.example.com'] = enrichment('https://hit-two.example.com')
    const { POST } = await import('../app/api/personalization/enrich-business/route')
    const res = await POST(post('https://hit-two.example.com'))
    expect((await res.json()).results[0].enrichment.website).toBe('https://hit-two.example.com')
    expect(crawls).toEqual([])
    expect(puts).toEqual([])
  })
  it('a durable hit warms the memory cache, so the next request does not even ask the database', async () => {
    durableStore['https://warm-three.example.com'] = enrichment('https://warm-three.example.com')
    const { POST } = await import('../app/api/personalization/enrich-business/route')
    const dc = await import('../src/server/businessEnrichment/durableCache')
    await POST(post('https://warm-three.example.com'))
    await POST(post('https://warm-three.example.com'))
    expect(dc.durableGet).toHaveBeenCalledTimes(1)
    expect(crawls).toEqual([])
  })
})
