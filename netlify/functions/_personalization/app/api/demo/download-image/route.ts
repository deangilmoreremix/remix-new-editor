import { NextRequest, NextResponse } from '../../../../shims/next-server'
import { downloadImageAsDataUrl, BlockedTargetError } from '../../../../src/server/downloadImage'
import { assertSafeUrlString } from '../../../../src/lib/networkSafety'
import { resolveRateLimitKey } from '../../../../lib/rateLimit'
import { logPersonalization, createCorrelationId } from '../../../../src/server/personalizationLog'
import { consumeDemoQuota, DemoQuotaStoreError } from '../../../../src/server/demoRateLimit'

/**
 * Public (no sign-in) image download for the free demo's on-device background
 * removal. It answers like `/api/personalization/download-image` ({ ok, results })
 * but is tighter, because anyone on the internet can call it:
 *   - same-site callers only (a cross-site page cannot use it as a free proxy),
 *   - at most 5 URLs per call, 5 MB per image, images only,
 *   - the same SSRF gates as the signed-in route (literal pre-flight + DNS and
 *     per-redirect-hop checks inside downloadImageAsDataUrl),
 *   - a shared cross-instance quota per client that fails CLOSED (503) when the
 *     quota store cannot answer.
 */

export const dynamic = 'force-dynamic'

export const runtime = 'nodejs'

const ROUTE = '/api/demo/download-image'
const MAX_URLS_PER_REQUEST = 5
const MAX_URL_LENGTH = 2048
const MAX_IMAGE_BYTES = 5 * 1024 * 1024
/** Image calls per client per window (a business has ~10-30 images, one call each). */
export const DEMO_IMAGE_QUOTA_MAX = 120
export const DEMO_IMAGE_QUOTA_WINDOW_MS = 10 * 60 * 1000

function clientIpOf(req: NextRequest): string | undefined {
  const forwarded = req.headers.get('x-forwarded-for')
  if (forwarded) {
    const first = forwarded.split(',')[0].trim()
    if (first) return first
  }
  const realIp = req.headers.get('x-real-ip')
  return realIp ? realIp.trim() || undefined : undefined
}

/** Browsers always send Sec-Fetch-Site; refuse an explicit cross-site caller. */
function isCrossSite(req: NextRequest): boolean {
  const site = req.headers.get('sec-fetch-site')
  if (site === 'cross-site') return true
  const origin = req.headers.get('origin')
  if (origin) {
    try {
      return new URL(origin).host !== req.nextUrl.host
    } catch {
      return true
    }
  }
  return false
}

function sanitizeUrl(url: string): string {
  const parsed = new URL(url.trim().slice(0, MAX_URL_LENGTH))
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') throw new Error('Invalid protocol')
  return parsed.toString()
}

function fail(
  correlationId: string,
  status: number,
  code: string,
  message: string,
  startTime: number,
  headers?: Record<string, string>,
) {
  logPersonalization({
    route: ROUTE,
    stage: 'request',
    httpStatus: status,
    safeErrorCode: code,
    safeMessage: message,
    correlationId,
    durationMs: Date.now() - startTime,
  })
  return NextResponse.json({ error: message }, { status, headers })
}

export async function POST(req: NextRequest) {
  const correlationId = createCorrelationId(req)
  const startTime = Date.now()

  try {
    if (isCrossSite(req)) return fail(correlationId, 403, 'CROSS_SITE', 'Not allowed', startTime)

    let body: unknown
    try {
      body = await req.json()
    } catch {
      return fail(correlationId, 400, 'INVALID_JSON', 'Invalid JSON body', startTime)
    }

    const urls = Array.isArray((body as { urls?: unknown } | null)?.urls) ? (body as { urls: unknown[] }).urls : []
    if (urls.length === 0) return fail(correlationId, 400, 'MISSING_URLS', 'urls array is required', startTime)
    if (urls.length > MAX_URLS_PER_REQUEST) {
      return fail(correlationId, 400, 'TOO_MANY_URLS', `Maximum ${MAX_URLS_PER_REQUEST} URLs allowed per request`, startTime)
    }

    const sanitized: string[] = []
    for (const url of urls) {
      if (typeof url !== 'string') return fail(correlationId, 400, 'INVALID_URL_TYPE', 'All URLs must be strings', startTime)
      try {
        sanitized.push(sanitizeUrl(url))
      } catch {
        return fail(correlationId, 400, 'INVALID_URL', 'Invalid URL', startTime)
      }
    }
    for (const url of sanitized) {
      try {
        assertSafeUrlString(url)
      } catch {
        return fail(correlationId, 400, 'BLOCKED_URL', 'This URL is not allowed', startTime)
      }
    }

    // Quota last among the cheap checks, before any outbound request is made.
    let quota: { allowed: boolean; remaining: number; retryAfterMs: number }
    try {
      quota = await consumeDemoQuota(`img:${resolveRateLimitKey(null, clientIpOf(req))}`, {
        max: DEMO_IMAGE_QUOTA_MAX,
        windowMs: DEMO_IMAGE_QUOTA_WINDOW_MS,
      })
    } catch (err) {
      return fail(
        correlationId,
        503,
        err instanceof DemoQuotaStoreError ? err.code : 'DEMO_QUOTA_STORE_UNAVAILABLE',
        'Image download is temporarily unavailable',
        startTime,
      )
    }
    if (!quota.allowed) {
      return fail(correlationId, 429, 'RATE_LIMIT_EXCEEDED', 'Rate limit exceeded. Please try again later.', startTime, {
        'Retry-After': String(Math.max(1, Math.ceil(quota.retryAfterMs / 1000))),
      })
    }

    const results = await Promise.all(
      sanitized.map(async (url) => {
        try {
          const dataUrl = await downloadImageAsDataUrl(url, MAX_IMAGE_BYTES)
          return { url, dataUrl, ok: true }
        } catch (err) {
          // A blocked redirect hop rejects the whole request, like the signed-in route.
          if (err instanceof BlockedTargetError) throw err
          return { url, error: err instanceof Error ? err.message : 'Download failed', ok: false }
        }
      }),
    )

    logPersonalization({
      route: ROUTE,
      stage: 'download',
      httpStatus: 200,
      correlationId,
      durationMs: Date.now() - startTime,
    })
    return NextResponse.json({ ok: true, results }, { headers: { 'X-RateLimit-Remaining': String(quota.remaining) } })
  } catch (err) {
    if (err instanceof BlockedTargetError) {
      return fail(correlationId, 400, 'BLOCKED_URL', 'This URL is not allowed', startTime)
    }
    return fail(correlationId, 500, 'UNEXPECTED_ERROR', 'Image download failed', startTime)
  }
}
