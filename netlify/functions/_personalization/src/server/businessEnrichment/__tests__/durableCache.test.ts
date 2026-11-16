import { describe, expect, it, vi } from 'vitest'
import { DURABLE_TTL_SECONDS, durableGet, durableKeyFor, durablePut, looksLikeEnrichment } from '../durableCache'

vi.mock('../../../lib/supabase', () => ({ createServerClient: () => { throw new Error('no env') } }))

const enrichment = {
  website: 'https://joes.com', emails: [], phones: [], addresses: [], contactNames: [], socials: {}, pagesVisited: ['https://joes.com'],
  pagesSkipped: [], robots: { checked: true, status: 'allow-all' }, jsRendered: false, notes: [], enrichedAt: '2026-11-15T00:00:00Z',
} as never
const client = (result: { data: unknown; error: { message: string } | null } | Promise<never>) => {
  const calls: Array<{ fn: string; args: Record<string, unknown> }> = []
  return { calls, rpc: (fn: string, args: Record<string, unknown>) => { calls.push({ fn, args }); return Promise.resolve(result) } }
}

describe('durableKeyFor', () => {
  it('uses the in-memory key and refuses unusable or oversized ones', () => {
    expect(durableKeyFor('https://www.Joes.com/')).toBe('joes.com')
    expect(durableKeyFor('https://sites.example.com/joe/')).toBe('sites.example.com/joe')
    expect(durableKeyFor('ftp://x.com')).toBeNull()
    expect(durableKeyFor('not a url ::::')).toBeNull()
    expect(durableKeyFor(`https://a.com/${'x'.repeat(260)}`)).toBeNull()
  })
})

describe('durableGet', () => {
  it('returns a stored, well-formed result and asks for the right key', async () => {
    const c = client({ data: enrichment, error: null })
    expect(await durableGet('https://www.joes.com', c)).toEqual(enrichment)
    expect(c.calls[0]).toEqual({ fn: 'business_enrichment_cache_get', args: { p_host: 'joes.com' } })
  })
  it('returns null on a miss, an error, a corrupt row and a missing client', async () => {
    expect(await durableGet('https://joes.com', client({ data: null, error: null }))).toBeNull()
    expect(await durableGet('https://joes.com', client({ data: null, error: { message: 'db down' } }))).toBeNull()
    expect(await durableGet('https://joes.com', client({ data: { website: 5 }, error: null }))).toBeNull()
    expect(await durableGet('https://joes.com')).toBeNull() // createServerClient throws (no env) -> carry on
  })
  it('gives up on a slow or rejecting database instead of waiting', async () => {
    vi.useFakeTimers()
    const slow = { rpc: () => new Promise<never>(() => undefined) }
    const p = durableGet('https://joes.com', slow as never)
    await vi.advanceTimersByTimeAsync(1_300)
    expect(await p).toBeNull()
    vi.useRealTimers()
    const rejecting = { rpc: () => Promise.reject(new Error('boom')) }
    expect(await durableGet('https://joes.com', rejecting as never)).toBeNull()
  })
})

describe('durablePut', () => {
  it('stores with the 7-day TTL under the normalised key', async () => {
    const c = client({ data: null, error: null })
    await durablePut('https://www.joes.com/', enrichment, c)
    expect(c.calls[0]).toEqual({ fn: 'business_enrichment_cache_put', args: { p_host: 'joes.com', p_enrichment: enrichment, p_ttl_seconds: DURABLE_TTL_SECONDS } })
    expect(DURABLE_TTL_SECONDS).toBe(604_800)
  })
  it('never throws: bad url, no client, database error', async () => {
    const c = client({ data: null, error: { message: 'x' } })
    await expect(durablePut('::::', enrichment, c)).resolves.toBeUndefined()
    expect(c.calls).toEqual([])
    await expect(durablePut('https://joes.com', enrichment)).resolves.toBeUndefined()
    await expect(durablePut('https://joes.com', enrichment, c)).resolves.toBeUndefined()
  })
})

describe('looksLikeEnrichment', () => {
  it('accepts the real shape only', () => {
    expect(looksLikeEnrichment(enrichment)).toBe(true)
    for (const bad of [null, 'x', {}, { website: 'a', emails: [] }, { website: 'a', emails: [], phones: [], socials: null, pagesVisited: [] }]) expect(looksLikeEnrichment(bad)).toBe(false)
  })
})
