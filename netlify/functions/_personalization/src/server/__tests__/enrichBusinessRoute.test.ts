import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from '../../../shims/next-server'

vi.mock('../../../src/server/personalizationLog', () => ({ logPersonalization: vi.fn(), createCorrelationId: vi.fn(() => 'cid') }))
const limiter = vi.hoisted(() => ({ allowed: true }))
vi.mock('../../../lib/rateLimit', () => ({
  resolveRateLimitKey: () => 'k', rateLimit: vi.fn(() => ({ allowed: limiter.allowed, retryAfterMs: 1 })),
  rateLimit429: vi.fn(() => new Response('rl', { status: 429 })),
}))
vi.mock('../../../src/server/businessEnrichment/enrich', () => ({ enrichBusinessWebsite: vi.fn() }))

import { POST } from '../../../app/api/personalization/enrich-business/route'
import { enrichBusinessWebsite } from '../../../src/server/businessEnrichment/enrich'

const post = (b: unknown) => POST(new NextRequest('http://x/api/personalization/enrich-business', { method: 'POST', body: JSON.stringify(b), headers: { 'content-type': 'application/json' } }))
const ok = (website: string) => ({ website, emails: [], phones: [], addresses: [], contactNames: [], socials: {}, pagesVisited: [], pagesSkipped: [], robots: { checked: true, status: 'allow-all' }, jsRendered: false, notes: [] })

beforeEach(() => { limiter.allowed = true; vi.mocked(enrichBusinessWebsite).mockReset().mockImplementation(async (w: string) => ok(w) as never) })

describe('POST /enrich-business — cache', () => {
  it('serves a repeat lookup from cache without crawling again', async () => {
    vi.mocked(enrichBusinessWebsite).mockImplementation(async (w: string) => ({ ...ok(w), pagesVisited: [w] }) as never)
    await post({ websiteUrl: 'https://cache-test-site.com' })
    await post({ websiteUrl: 'https://www.cache-test-site.com/' })
    expect(vi.mocked(enrichBusinessWebsite)).toHaveBeenCalledTimes(1)
  })
  it('does not cache a crawl that visited nothing (unreachable site)', async () => {
    await post({ websiteUrl: 'https://down-site.com' }); await post({ websiteUrl: 'https://down-site.com' })
    expect(vi.mocked(enrichBusinessWebsite)).toHaveBeenCalledTimes(2)
  })
})

describe('POST /enrich-business', () => {
  it('400 without a website', async () => { expect((await post({})).status).toBe(400) })
  it('429 when rate limited', async () => { limiter.allowed = false; expect((await post({ websiteUrl: 'https://a.com' })).status).toBe(429) })
  it('enriches a single websiteUrl', async () => {
    const body = await (await post({ websiteUrl: 'https://a.com' })).json()
    expect(body.results).toHaveLength(1); expect(body.results[0]).toMatchObject({ ok: true, website: 'https://a.com' })
  })
  it('caps a batch at 5 and reports the deferred ones', async () => {
    const businesses = Array.from({ length: 8 }, (_, i) => ({ id: `b${i}`, website: `https://s${i}.com` }))
    const body = await (await post({ businesses })).json()
    expect(body.results).toHaveLength(5); expect(body.deferred).toEqual(['b5', 'b6', 'b7'])
    expect(vi.mocked(enrichBusinessWebsite)).toHaveBeenCalledTimes(5)
  })
  it('a failing/blocked site is reported per business without leaking internals', async () => {
    vi.mocked(enrichBusinessWebsite).mockImplementation(async (w: string) => { if (w.includes('bad')) throw new Error('Blocked URL: 10.0.0.1 is not allowed'); return ok(w) as never })
    const body = await (await post({ businesses: [{ id: '1', website: 'https://bad.com' }, { id: '2', website: 'https://good.com' }] })).json()
    expect(body.results[0]).toEqual({ id: '1', website: 'https://bad.com', ok: false, error: 'website not allowed' })
    expect(body.results[1].ok).toBe(true)
  })
})
