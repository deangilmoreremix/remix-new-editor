/**
 * Simple in-memory cache for business discovery results.
 *
 * Cache key includes normalized niche, location, and radius.
 *
 * The cache is bounded so a long-lived process cannot grow without limit:
 * expired entries are swept on every mutation, and a least-recently-used entry
 * is evicted once the entry count passes `maxEntries`. No timers are used, so
 * the cache stays safe to import from serverless route handlers.
 * Can be replaced with Redis/Supabase later without changing callers.
 */

import type { BusinessDiscoveryRecord } from './types'

export interface CacheEntry {
  businesses: BusinessDiscoveryRecord[]
  expiresAt: number
}

/** Default upper bound on retained entries before LRU eviction kicks in. */
export const DEFAULT_MAX_CACHE_ENTRIES = 500

export class BusinessDiscoveryCache {
  private cache = new Map<string, CacheEntry>()
  private readonly maxEntries: number

  constructor(maxEntries: number = DEFAULT_MAX_CACHE_ENTRIES) {
    const normalized = Number.isFinite(maxEntries) ? Math.floor(maxEntries) : DEFAULT_MAX_CACHE_ENTRIES
    this.maxEntries = Math.max(1, normalized)
  }

  /** Number of retained entries, including expired ones not swept yet. */
  get size(): number {
    return this.cache.size
  }

  get(key: string): BusinessDiscoveryRecord[] | null {
    const entry = this.cache.get(key)
    if (!entry) return null
    if (entry.expiresAt < Date.now()) {
      this.cache.delete(key)
      return null
    }
    // Re-insert so the Map ordering reflects recency (first = least recent).
    this.cache.delete(key)
    this.cache.set(key, entry)
    return entry.businesses
  }

  set(key: string, businesses: BusinessDiscoveryRecord[], ttlMs: number): void {
    this.sweepExpired()
    const lifetime = Number.isFinite(ttlMs) ? Math.max(0, ttlMs) : 0
    // Delete first so an existing key is overwritten and becomes the newest.
    this.cache.delete(key)
    this.cache.set(key, {
      businesses,
      expiresAt: Date.now() + lifetime,
    })
    this.evictOverflow()
  }

  clear(): void {
    this.cache.clear()
  }

  delete(key: string): void {
    this.cache.delete(key)
  }

  /** Drops every entry whose TTL has already elapsed. */
  private sweepExpired(): void {
    const now = Date.now()
    for (const [key, entry] of this.cache) {
      if (entry.expiresAt < now) {
        this.cache.delete(key)
      }
    }
  }

  /** Evicts until the entry count is back within `maxEntries`. */
  private evictOverflow(): void {
    while (this.cache.size > this.maxEntries) {
      this.evictOne()
    }
  }

  /**
   * Removes a single entry, preferring an expired one and otherwise the least
   * recently used key (Map iteration order is recency order).
   */
  private evictOne(): void {
    const now = Date.now()
    let lruKey: string | null = null
    for (const [key, entry] of this.cache) {
      if (entry.expiresAt < now) {
        this.cache.delete(key)
        return
      }
      if (lruKey === null) lruKey = key
    }
    if (lruKey !== null) this.cache.delete(lruKey)
  }
}

// Global cache instance
export const businessDiscoveryCache = new BusinessDiscoveryCache()

export function createCacheKey(niche: string, location: string, radiusMiles: number): string {
  return `${normalizeKeyPart(niche)}|${normalizeKeyPart(location)}|${radiusMiles}`
}

/**
 * Collapses leading/trailing and repeated internal whitespace and lowercases,
 * so "Tampa,  FL", "Tampa, FL" and "tampa, fl" share a single cache entry.
 */
function normalizeKeyPart(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLowerCase()
}
