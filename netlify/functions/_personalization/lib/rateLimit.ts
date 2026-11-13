import { NextResponse } from '../shims/next-server'

/**
 * Compute a per-caller rate-limit key from the authenticated Clerk userId,
 * falling back to the client IP. Mirrors the `userId || clientIp || 'anon'`
 * idiom already used across the personalization API routes.
 *
 * Security: the key MUST NOT be derived from a client-supplied API key/header
 * (e.g. the rotatable `x-api-key`) — a caller could mint a fresh bucket on
 * every request and bypass the limit. Also remember this limiter is in-process
 * only (see the caveat above): not shared across serverless instances, so a
 * caller that can reach several instances gets one bucket per instance.
 */
export function resolveRateLimitKey(
  userId?: string | null,
  clientIp?: string | null,
): string {
  return userId || clientIp || 'anon'
}

export function rateLimit429(retryAfterMs: number) {
  return NextResponse.json(
    { error: 'Rate limit exceeded. Please wait before retrying.' },
    { status: 429, headers: { 'Retry-After': String(Math.ceil(retryAfterMs / 1000)) } }
  )
}

type RateLimitResult = {
  allowed: boolean
  remaining: number
  retryAfterMs: number
}

type RateLimitOpts = {
  windowMs?: number
  max?: number
}

// In-process sliding-window rate limiter.
//
// Caveat: state lives in the Node process memory, so it resets on restart and
// is NOT shared across serverless instances / multiple workers. This is the
// same in-process trade-off already accepted for the `cancelledRequestIds`
// registry, and is sufficient for single-instance deployments. For a globally
// consistent limit across instances, swap this for a shared store (Upstash/
// Redis/Supabase) — intentionally avoided here to keep the dependency surface
// at zero.
const timestampsByKey = new Map<string, number[]>()

function prune(key: string, windowMs: number, now: number): number[] {
  const cutoff = now - windowMs
  const times = (timestampsByKey.get(key) || []).filter((t) => t > cutoff)
  if (times.length > 0) {
    timestampsByKey.set(key, times)
  } else {
    timestampsByKey.delete(key)
  }
  return times
}

export function rateLimit(
  key: string,
  opts?: RateLimitOpts,
): RateLimitResult {
  // Normalize empty key to a fallback bucket so unkeyed traffic shares one
  // bucket instead of colliding with a real empty-string key.
  const effectiveKey = key || '__anonymous__'
  const windowMs = opts?.windowMs ?? 60_000
  const max = opts?.max ?? 10
  const now = Date.now()

  const times = prune(effectiveKey, windowMs, now)
  const remaining = Math.max(0, max - times.length)

  if (times.length >= max) {
    const oldest = times[0]
    const retryAfterMs = Math.max(0, oldest + windowMs - now)
    return { allowed: false, remaining: 0, retryAfterMs }
  }

  times.push(now)
  timestampsByKey.set(effectiveKey, times)

  return { allowed: true, remaining: remaining - 1, retryAfterMs: 0 }
}


// ── Shared (database-backed) limiter ─────────────────────────────────────────
// The limiter above lives in one process, so on serverless every instance has its own count and a caller who lands on
// different instances multiplies their allowance. For costly, abusable operations (e.g. launching a browser to capture a
// website) use this one: it counts in the database through the repo's `rate_limit_check` RPC, shared by every instance.

/** The slice of a Supabase client this needs: `rpc(name, args)`. */
export interface RpcClient {
  rpc(name: string, args: Record<string, unknown>): PromiseLike<{ data: unknown; error: { message?: string } | null }>
}

/**
 * Counts one call against `scope`/`key` in the database. If the database cannot answer (error, thrown exception, malformed
 * reply, no client) it falls back to the in-process limiter, which is weaker but still enforces a limit: this never
 * "fails open". `rate_limit_check` is a fixed window aligned to the epoch.
 */
export async function rateLimitShared(
  client: RpcClient | null | undefined,
  scope: string,
  key: string,
  opts: { windowMs: number; max: number },
): Promise<RateLimitResult & { source: 'database' | 'memory' }> {
  const fallback = () => ({ ...rateLimit(`${scope}:${key || '__anonymous__'}`, opts), source: 'memory' as const })
  if (!client) return fallback()
  try {
    const { data, error } = await client.rpc('rate_limit_check', {
      p_scope: scope,
      p_key: key || '__anonymous__',
      p_limit: opts.max,
      p_window_seconds: Math.max(1, Math.ceil(opts.windowMs / 1000)),
    })
    const reply = data as { allowed?: unknown; count?: unknown; reset_at?: unknown } | null
    if (error || !reply || typeof reply.allowed !== 'boolean' || typeof reply.count !== 'number') return fallback()
    const resetMs = typeof reply.reset_at === 'string' ? Date.parse(reply.reset_at) : NaN
    return {
      allowed: reply.allowed,
      remaining: Math.max(0, opts.max - reply.count),
      retryAfterMs: reply.allowed ? 0 : Math.max(1000, Number.isFinite(resetMs) ? resetMs - Date.now() : opts.windowMs),
      source: 'database',
    }
  } catch {
    return fallback()
  }
}
