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

