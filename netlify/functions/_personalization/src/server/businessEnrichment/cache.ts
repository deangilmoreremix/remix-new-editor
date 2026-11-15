/**
 * Small in-memory TTL cache for enrichment results.
 *
 * Why: the modal asks for the same business again when the user pages back, re-searches, or two people look at the
 * same area; re-crawling a small business's site each time is slow and impolite. The data is public website content
 * (no per-user data), so one shared cache is safe. It lives per serverless instance — a warm instance saves the
 * crawl, a cold one simply crawls again — so it is an optimisation, never required for correctness.
 */
import type { BusinessEnrichment } from './types'

export interface CacheOptions { ttlMs?: number; maxEntries?: number; now?: () => number }

export class EnrichmentCache {
  private map = new Map<string, { at: number; value: BusinessEnrichment }>()
  private readonly ttl: number
  private readonly max: number
  private readonly now: () => number
  constructor(o: CacheOptions = {}) { this.ttl = o.ttlMs ?? 24 * 60 * 60 * 1000; this.max = o.maxEntries ?? 500; this.now = o.now ?? Date.now }

  /** Stable key: host without www + path without trailing slash; null for unusable URLs. */
  static keyFor(website: string): string | null {
    try {
      const u = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(website) ? website : `https://${website}`)
      if (!/^https?:$/.test(u.protocol)) return null
      return `${u.hostname.replace(/^www\./, '').toLowerCase()}${u.pathname.replace(/\/+$/, '').toLowerCase()}`
    } catch { return null }
  }

  get(website: string): BusinessEnrichment | null {
    const k = EnrichmentCache.keyFor(website); if (!k) return null
    const hit = this.map.get(k)
    if (!hit) return null
    if (this.now() - hit.at > this.ttl) { this.map.delete(k); return null }
    this.map.delete(k); this.map.set(k, hit) // refresh LRU position
    return hit.value
  }

  set(website: string, value: BusinessEnrichment) {
    const k = EnrichmentCache.keyFor(website); if (!k) return
    this.map.delete(k)
    this.map.set(k, { at: this.now(), value })
    while (this.map.size > this.max) this.map.delete(this.map.keys().next().value as string) // evict oldest
  }

  get size() { return this.map.size }
}

/** Shared instance for the route. */
export const enrichmentCache = new EnrichmentCache()
