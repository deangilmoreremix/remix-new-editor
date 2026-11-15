import { describe, it, expect } from 'vitest'
import { EnrichmentCache } from '../cache'
const e = (w: string) => ({ website: w, emails: [], phones: [], addresses: [], contactNames: [], socials: {}, pagesVisited: ['x'], pagesSkipped: [], robots: { checked: true, status: 'allow-all' as const }, jsRendered: false, notes: [] })

describe('EnrichmentCache', () => {
  it('normalizes the key (www, scheme, case, trailing slash) and rejects non-http', () => {
    expect(EnrichmentCache.keyFor('https://www.Joes.com/')).toBe('joes.com')
    expect(EnrichmentCache.keyFor('joes.com')).toBe('joes.com')
    expect(EnrichmentCache.keyFor('http://joes.com/About/')).toBe('joes.com/about')
    expect(EnrichmentCache.keyFor('ftp://joes.com')).toBeNull()
  })
  it('expires entries after the TTL', () => {
    let t = 0; const c = new EnrichmentCache({ ttlMs: 1000, now: () => t })
    c.set('https://a.com', e('a')); expect(c.get('https://www.a.com/')?.website).toBe('a')
    t = 1500; expect(c.get('https://a.com')).toBeNull(); expect(c.size).toBe(0)
  })
  it('evicts the least recently used entry beyond the max', () => {
    const c = new EnrichmentCache({ maxEntries: 2 })
    c.set('a.com', e('a')); c.set('b.com', e('b')); c.get('a.com'); c.set('c.com', e('c'))
    expect(c.get('a.com')).not.toBeNull(); expect(c.get('b.com')).toBeNull(); expect(c.get('c.com')).not.toBeNull()
  })
})
