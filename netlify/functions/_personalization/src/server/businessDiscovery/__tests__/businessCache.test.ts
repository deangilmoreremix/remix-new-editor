// @vitest-environment node
/**
 * Bounds and correctness tests for the business discovery cache.
 *
 * The find-businesses route is public and unauthenticated, and its cache keys
 * embed an attacker-chosen `location` string, so the cache MUST stay bounded:
 * without the entry cap + sweep, a long-lived process grows the Map forever.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  BusinessDiscoveryCache,
  DEFAULT_MAX_CACHE_ENTRIES,
  businessDiscoveryCache,
  createCacheKey,
} from '../businessCache'
import type { BusinessDiscoveryRecord } from '../types'

function record(id: string): BusinessDiscoveryRecord {
  return { id, name: `Business ${id}` } as BusinessDiscoveryRecord
}

describe('BusinessDiscoveryCache bounds', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('stores and retrieves entries within the TTL', () => {
    const cache = new BusinessDiscoveryCache()
    cache.set('a', [record('1')], 60_000)
    expect(cache.get('a')).toEqual([record('1')])
    expect(cache.get('missing')).toBeNull()
  })

  it('treats expired entries as misses and removes them', () => {
    const cache = new BusinessDiscoveryCache()
    cache.set('a', [record('1')], 1_000)
    vi.advanceTimersByTime(1_001)
    expect(cache.get('a')).toBeNull()
    expect(cache.size).toBe(0)
  })

  it('evicts the least-recently-used entry when over the cap', () => {
    const cache = new BusinessDiscoveryCache(3)
    cache.set('a', [record('a')], 60_000)
    cache.set('b', [record('b')], 60_000)
    cache.set('c', [record('c')], 60_000)
    expect(cache.size).toBe(3)

    // Reading 'a' refreshes its recency, so 'b' becomes the LRU victim.
    expect(cache.get('a')).not.toBeNull()

    cache.set('d', [record('d')], 60_000)
    expect(cache.size).toBe(3)
    expect(cache.get('b')).toBeNull()
    expect(cache.get('a')).not.toBeNull()
    expect(cache.get('c')).not.toBeNull()
    expect(cache.get('d')).not.toBeNull()
  })

  it('prefers evicting an expired entry over a live LRU one', () => {
    const cache = new BusinessDiscoveryCache(2)
    cache.set('a', [record('a')], 500) // expires first
    cache.set('b', [record('b')], 60_000)

    vi.advanceTimersByTime(501) // 'a' is now expired
    cache.set('c', [record('c')], 60_000) // overflow evicts the expired 'a', not 'b'

    expect(cache.size).toBe(2)
    expect(cache.get('b')).not.toBeNull()
    expect(cache.get('c')).not.toBeNull()
  })

  it('sweeps expired entries on set so the cap counts only live entries', () => {
    const cache = new BusinessDiscoveryCache(2)
    cache.set('a', [record('a')], 500)
    cache.set('b', [record('b')], 60_000)
    vi.advanceTimersByTime(501)

    cache.set('c', [record('c')], 60_000)
    cache.set('d', [record('d')], 60_000)

    // Both expired entries are gone and no live entry was evicted.
    expect(cache.size).toBe(2)
    expect(cache.get('c')).not.toBeNull()
    expect(cache.get('d')).not.toBeNull()
  })

  it('overwriting an existing key refreshes recency without growing', () => {
    const cache = new BusinessDiscoveryCache(2)
    cache.set('a', [record('a')], 60_000)
    cache.set('b', [record('b')], 60_000)
    cache.set('a', [record('a2')], 60_000)
    expect(cache.size).toBe(2)
    expect(cache.get('a')).toEqual([record('a2')])
    expect(cache.get('b')).not.toBeNull()
  })

  it('normalizes non-finite / non-positive maxEntries to a safe bound', () => {
    expect(new BusinessDiscoveryCache(Number.NaN).size).toBe(0)
    expect(new BusinessDiscoveryCache(0).size).toBe(0)
    expect(new BusinessDiscoveryCache(-5).size).toBe(0)
    // Floor of 1 entry: inserting a second key evicts the first.
    const cache = new BusinessDiscoveryCache(0)
    cache.set('a', [record('a')], 60_000)
    cache.set('b', [record('b')], 60_000)
    expect(cache.size).toBe(1)
    expect(cache.get('b')).not.toBeNull()
  })

  it('clamps a negative TTL to immediate expiry instead of caching forever', () => {
    const cache = new BusinessDiscoveryCache()
    cache.set('a', [record('a')], -100)
    // The clamp makes expiresAt === now, so the entry is dead the next tick.
    vi.advanceTimersByTime(1)
    expect(cache.get('a')).toBeNull()
  })

  it('supports clear and delete', () => {
    const cache = new BusinessDiscoveryCache()
    cache.set('a', [record('a')], 60_000)
    cache.set('b', [record('b')], 60_000)
    cache.delete('a')
    expect(cache.get('a')).toBeNull()
    cache.clear()
    expect(cache.size).toBe(0)
  })

  it('exposes a default-bounded global instance', () => {
    expect(businessDiscoveryCache).toBeInstanceOf(BusinessDiscoveryCache)
    expect(DEFAULT_MAX_CACHE_ENTRIES).toBeGreaterThan(0)
  })
})

describe('createCacheKey normalization', () => {
  it('collapses internal whitespace and case so equivalent queries share an entry', () => {
    expect(createCacheKey('Real Estate', 'Tampa,   FL', 15)).toBe(
      createCacheKey('real estate', 'tampa, fl', 15),
    )
    expect(createCacheKey('Real Estate', ' Tampa, FL ', 15)).toBe(
      createCacheKey('real estate', 'tampa, fl', 15),
    )
  })

  it('keeps niche, location, and radius distinct', () => {
    expect(createCacheKey('a', 'b', 1)).not.toBe(createCacheKey('a', 'b', 2))
    expect(createCacheKey('a', 'b', 1)).not.toBe(createCacheKey('b', 'a', 1))
  })
})
