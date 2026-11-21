/**
 * Durable (Supabase) layer under the in-memory enrichment cache. It holds PUBLIC website data only (what the
 * business's own pages published, the same JSON the in-memory cache holds): no user ids, no notes. Reads and
 * writes go through service-role-only RPCs (`business_enrichment_cache_get/put`).
 *
 * Strictly best-effort: every call is bounded by a short timeout and swallows its own errors, so a slow or
 * unavailable database can never slow down or fail an enrichment request. null / void always means "carry on".
 */
import { EnrichmentCache } from './cache'
import type { BusinessEnrichment } from './types'

export const DURABLE_TTL_SECONDS = 7 * 24 * 60 * 60
const DB_TIMEOUT_MS = 1_200

interface RpcClient { rpc: (fn: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { message: string } | null }> }

// Imported lazily and guarded: if the Supabase module or its environment is unavailable (tests, a misconfigured
// deploy), the cache is simply off and the route behaves exactly as it did before the durable layer existed.
async function clientOrNull(client?: RpcClient): Promise<RpcClient | null> {
  if (client) return client
  try {
    const { createServerClient } = await import('../../lib/supabase')
    return createServerClient() as unknown as RpcClient
  } catch { return null }
}

function withTimeout<T>(p: PromiseLike<T>, ms: number): Promise<T | null> {
  return new Promise((resolve) => {
    const t = setTimeout(() => resolve(null), ms)
    Promise.resolve(p).then((v) => { clearTimeout(t); resolve(v) }, () => { clearTimeout(t); resolve(null) })
  })
}

/** Cheap shape check so a corrupt row is ignored instead of crashing the route. */
export function looksLikeEnrichment(v: unknown): v is BusinessEnrichment {
  if (!v || typeof v !== 'object') return false
  const o = v as Record<string, unknown>
  return typeof o.website === 'string' && Array.isArray(o.emails) && Array.isArray(o.phones) && typeof o.socials === 'object' && o.socials !== null && Array.isArray(o.pagesVisited)
}

/** The same normalised key as the in-memory cache; unusable or oversized keys are never stored. */
export function durableKeyFor(website: string): string | null {
  const key = EnrichmentCache.keyFor(website)
  return key && key.length >= 3 && key.length <= 253 ? key : null
}

export async function durableGet(website: string, client?: RpcClient): Promise<BusinessEnrichment | null> {
  const key = durableKeyFor(website)
  const c = key ? await clientOrNull(client) : null
  if (!key || !c) return null
  const res = await withTimeout(c.rpc('business_enrichment_cache_get', { p_host: key }), DB_TIMEOUT_MS)
  if (!res || res.error || !looksLikeEnrichment(res.data)) return null
  return res.data
}

export async function durablePut(website: string, value: BusinessEnrichment, client?: RpcClient): Promise<void> {
  const key = durableKeyFor(website)
  const c = key ? await clientOrNull(client) : null
  if (!key || !c) return
  await withTimeout(c.rpc('business_enrichment_cache_put', { p_host: key, p_enrichment: value, p_ttl_seconds: DURABLE_TTL_SECONDS }), DB_TIMEOUT_MS)
}
