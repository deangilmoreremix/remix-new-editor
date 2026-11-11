/**
 * Cross-instance quota for the anonymous demo discovery endpoint.
 *
 * `lib/rateLimit.ts` keeps its buckets in process memory, so on Netlify every
 * Lambda instance gets its own bucket and a caller that can reach several
 * instances (or several concurrent invocations of the same instance) gets
 * several buckets. That is fine for an authenticated caller whose identity is
 * already checked by Clerk, but `POST /api/demo/discover` is anonymous outbound
 * crawling on the operator's bandwidth, so its limit has to be shared.
 *
 * This module therefore keeps its counters in Supabase and moves the whole
 * "may this caller proceed?" decision into one atomic RPC
 * (`personalization_demo_consume_quota`, see
 * supabase/migrations/20261014000000_demo_discovery_limits.sql), so two
 * concurrent invocations cannot both read the old count and both pass.
 *
 * FAIL CLOSED. An anonymous route with an unusable limiter is an unlimited
 * anonymous route, so every failure mode here — missing Supabase env vars, an
 * RPC transport error, an RPC-level error, or a result this module cannot
 * parse — raises `DemoQuotaStoreError`. The route maps that to HTTP 503 instead
 * of letting traffic through unmeasured.
 */

import { createServerClient } from '../lib/supabase'

/** Anonymous requests allowed per key per window. */
export const DEMO_RATE_LIMIT_MAX_REQUESTS = 10

/** Sliding window for the anonymous demo quota (10 minutes). */
export const DEMO_RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000

/** The single atomic quota RPC. */
export const DEMO_QUOTA_RPC = 'personalization_demo_consume_quota'

/** Table backing the RPC (documentational; the route never touches it directly). */
export const DEMO_QUOTA_TABLE = 'personalization_demo_discovery_limits'

export interface DemoQuotaOptions {
  max?: number
  windowMs?: number
}

export interface DemoQuotaResult {
  allowed: boolean
  remaining: number
  retryAfterMs: number
}

/** Raised for every unusable-quota condition; callers must fail closed. */
export class DemoQuotaStoreError extends Error {
  readonly code = 'DEMO_QUOTA_STORE_UNAVAILABLE'

  constructor(message = 'Demo quota store is unavailable') {
    super(message)
    this.name = 'DemoQuotaStoreError'
  }
}

function positiveInt(value: unknown, fallback: number, minimum: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < minimum) {
    return fallback
  }
  return Math.floor(value)
}

/**
 * Parses the jsonb the RPC returns. A row without a boolean `allowed` is
 * treated as unusable (→ `DemoQuotaStoreError` → 503) rather than guessed at,
 * so a schema change cannot silently turn into "everyone is allowed".
 */
function parseQuotaRow(row: unknown): DemoQuotaResult | null {
  if (!row || typeof row !== 'object') return null
  const record = row as Record<string, unknown>
  if (typeof record.allowed !== 'boolean') return null

  const remaining =
    typeof record.remaining === 'number' && Number.isFinite(record.remaining)
      ? Math.max(0, Math.floor(record.remaining))
      : 0
  const retryAfterMs =
    typeof record.retry_after_ms === 'number' && Number.isFinite(record.retry_after_ms)
      ? Math.max(0, Math.ceil(record.retry_after_ms))
      : 0

  return { allowed: record.allowed, remaining, retryAfterMs }
}

/**
 * Atomically consumes one unit of `key`'s quota and reports whether the caller
 * may proceed. Throws `DemoQuotaStoreError` when the shared store cannot answer
 * (missing env, transport/RPC error, unusable result).
 */
export async function consumeDemoQuota(
  key: string,
  options: DemoQuotaOptions = {},
): Promise<DemoQuotaResult> {
  const effectiveKey = typeof key === 'string' ? key.trim() : ''
  if (!effectiveKey) {
    // An unkeyed caller must never share a bucket that can be minted at will.
    throw new DemoQuotaStoreError('Demo quota key is missing')
  }

  const max = positiveInt(options.max, DEMO_RATE_LIMIT_MAX_REQUESTS, 1)
  const windowMs = positiveInt(options.windowMs, DEMO_RATE_LIMIT_WINDOW_MS, 1000)

  let client: ReturnType<typeof createServerClient>
  try {
    client = createServerClient()
  } catch {
    throw new DemoQuotaStoreError('Supabase configuration is missing')
  }

  let response: { data: unknown; error: unknown } | null = null
  try {
    response = (await client.rpc(DEMO_QUOTA_RPC, {
      p_key: effectiveKey,
      p_max: max,
      p_window_ms: windowMs,
    })) as { data: unknown; error: unknown }
  } catch {
    throw new DemoQuotaStoreError('Demo quota RPC failed')
  }

  if (!response || response.error) {
    throw new DemoQuotaStoreError('Demo quota RPC returned an error')
  }

  const row = Array.isArray(response.data) ? response.data[0] : response.data
  const parsed = parseQuotaRow(row)
  if (!parsed) {
    throw new DemoQuotaStoreError('Demo quota RPC returned an unusable result')
  }

  return parsed
}
