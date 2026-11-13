/**
 * Anonymous public demo endpoint for asset discovery.
 *
 * This route is deliberately NOT authenticated: it is the free sample behind
 * the marketing landing page. Everything that makes that safe lives here —
 *
 *   - SSRF: `assertSafeUrlString` (literal/encoded private, loopback,
 *     link-local, CGNAT, metadata, IPv6 ULA/link-local, IPv4-mapped,
 *     unspecified, and the decimal/octal/hex spellings), then
 *     `researchBusiness()` (async DNS resolution that validates every address
 *     the host resolves to, per-hop redirect revalidation, connection pinning).
 *   - Cost: a cross-instance Supabase quota (10 requests / 10 minutes / IP)
 *     that fails CLOSED with 503, so a broken limiter can never become an
 *     unlimited anonymous outbound crawler.
 *   - Depth: landing page + its own sitemap.xml only, 12 assets, 1 MB bodies
 *     and 15 s timeouts (all enforced in `src/server/demoDiscovery.ts`).
 *   - No paid providers: no Crawlee, no browser discovery, no OpenAI, no MuAPI.
 *   - No persistence: no discovery job, no saved project, no identity row. The
 *     only write is the URL-keyed, public-assets-only demo cache, and a cache
 *     hit skips both the crawl and the quota.
 *   - No CORS: the response carries no `Access-Control-Allow-Origin`, so this
 *     stays same-origin only. A wildcard here would turn every other origin on
 *     the internet into a caller of the operator's bandwidth.
 *
 * The authenticated `POST /api/personalization/discover-assets` and
 * `POST /api/personalization/research-business` routes are separate code paths
 * and are untouched by this file.
 */

import { NextRequest, NextResponse } from '../../../../shims/next-server'
import { rateLimit429, resolveRateLimitKey } from '../../../../lib/rateLimit'
import { assertSafeUrlString } from '../../../../src/lib/networkSafety'
import { sanitizeForLog, createCorrelationId, logPersonalization } from '../../../../src/server/personalizationLog'
import {
  DEMO_MAX_WEBSITE_URL_LENGTH,
  isDemoBlockedTargetError,
  readDemoDiscoveryCache,
  runDemoDiscovery,
  writeDemoDiscoveryCache,
} from '../../../../src/server/demoDiscovery'
import type { DemoDiscoveryPayload } from '../../../../src/server/demoDiscovery'
import {
  consumeDemoQuota,
  DemoQuotaStoreError,
  DEMO_RATE_LIMIT_MAX_REQUESTS,
  DEMO_RATE_LIMIT_WINDOW_MS,
} from '../../../../src/server/demoRateLimit'

export const dynamic = 'force-dynamic'

export const runtime = 'nodejs'

const ROUTE = '/api/demo/discover'

/** Every 400 for a URL carries "not allowed", matching the personalization contract. */
const BLOCKED_URL_MESSAGE = 'This website URL is not allowed for the demo.'

const UNAVAILABLE_MESSAGE = 'Demo discovery is temporarily unavailable. Please try again later.'

function clientIpOf(req: NextRequest): string | undefined {
  // Same idiom as the personalization routes. Behind Netlify the first
  // x-forwarded-for entry is the client; a direct caller can of course forge
  // it, which is why the shared quota is defence in depth rather than the only
  // control, and why an unkeyed caller falls back to one shared bucket.
  const forwarded = req.headers.get('x-forwarded-for')
  if (forwarded) {
    const first = forwarded.split(',')[0].trim()
    if (first) return first
  }
  const realIp = req.headers.get('x-real-ip')
  return realIp ? realIp.trim() || undefined : undefined
}

/** A URL is never logged whole: 100 characters is the whole log budget. */
function urlForLog(url: unknown): string {
  const safe = String(sanitizeForLog(String(url || '')) || '')
  return safe.length > 100 ? `${safe.slice(0, 100)}...` : safe
}

function errorResponse(
  message: string,
  status: number,
  correlationId: string,
  headers: Record<string, string> = {},
) {
  // Same-origin only: no Access-Control-Allow-Origin is ever set here.
  return NextResponse.json(
    { error: message, correlationId },
    { status, headers: { 'x-correlation-id': correlationId, ...headers } },
  )
}

export async function POST(req: NextRequest) {
  const correlationId = createCorrelationId(req)
  const startTime = Date.now()

  try {
    const body = await req.json().catch(() => ({}))
    const rawWebsiteUrl = typeof body?.websiteUrl === 'string' ? body.websiteUrl : ''

    if (!rawWebsiteUrl.trim()) {
      logPersonalization({
        route: ROUTE,
        stage: 'validation',
        httpStatus: 400,
        safeErrorCode: 'MISSING_WEBSITE_URL',
        safeMessage: 'websiteUrl is required',
        correlationId,
      })
      return errorResponse('websiteUrl is required', 400, correlationId)
    }

    // Reject rather than truncate: a truncated URL is a DIFFERENT URL than the
    // caller asked for, and must never be the one that gets fetched.
    if (rawWebsiteUrl.length > DEMO_MAX_WEBSITE_URL_LENGTH) {
      logPersonalization({
        route: ROUTE,
        stage: 'validation',
        httpStatus: 400,
        safeErrorCode: 'INVALID_WEBSITE_URL',
        safeMessage: 'Website URL is not allowed (exceeds the maximum length)',
        correlationId,
      })
      return errorResponse(
        'Website URL is not allowed (exceeds the maximum length)',
        400,
        correlationId,
      )
    }

    // Step 1 - synchronous SSRF gate, before any network call and before the
    // cache or the quota is touched.
    let websiteUrl: string
    try {
      websiteUrl = assertSafeUrlString(rawWebsiteUrl)
    } catch {
      logPersonalization({
        route: ROUTE,
        stage: 'ssrf-validation',
        httpStatus: 400,
        safeErrorCode: 'BLOCKED_URL',
        safeMessage: 'Blocked URL: private/unsafe target is not allowed',
        correlationId,
      })
      return errorResponse(BLOCKED_URL_MESSAGE, 400, correlationId)
    }

    // Step 2 - shared cache. A hit costs no crawl and no fresh quota, so a
    // Netlify fan-out cannot re-crawl one site once per instance.
    let cached: DemoDiscoveryPayload | null = null
    try {
      cached = await readDemoDiscoveryCache(websiteUrl)
    } catch {
      logPersonalization({
        route: ROUTE,
        stage: 'cache-read',
        httpStatus: 200,
        safeErrorCode: 'DEMO_CACHE_UNAVAILABLE',
        safeMessage: 'Demo cache read unavailable; continuing without cache',
        correlationId,
        durationMs: Date.now() - startTime,
      })
      cached = null
    }

    if (cached) {
      logPersonalization({
        route: ROUTE,
        stage: 'cache',
        httpStatus: 200,
        correlationId,
        durationMs: Date.now() - startTime,
      })
      return NextResponse.json({
        ok: true,
        cached: true,
        url: cached.url ?? websiteUrl,
        title: cached.title,
        description: cached.description,
        logo: cached.logo,
        assets: cached.assets,
        ...(cached.brandColors ? { brandColors: cached.brandColors } : {}),
      })
    }

    // Step 3 - cross-instance quota, fail closed. An unusable limiter on an
    // anonymous crawling route means unlimited anonymous crawling, so this is
    // a 503 and not a bypass.
    let quota: { allowed: boolean; remaining: number; retryAfterMs: number }
    try {
      quota = await consumeDemoQuota(resolveRateLimitKey(null, clientIpOf(req)), {
        max: DEMO_RATE_LIMIT_MAX_REQUESTS,
        windowMs: DEMO_RATE_LIMIT_WINDOW_MS,
      })
    } catch (err) {
      logPersonalization({
        route: ROUTE,
        stage: 'rate-limit',
        httpStatus: 503,
        safeErrorCode: err instanceof DemoQuotaStoreError ? err.code : 'DEMO_QUOTA_STORE_UNAVAILABLE',
        safeMessage: 'Demo quota store unavailable',
        correlationId,
        durationMs: Date.now() - startTime,
      })
      return errorResponse(UNAVAILABLE_MESSAGE, 503, correlationId)
    }

    if (!quota.allowed) {
      logPersonalization({
        route: ROUTE,
        stage: 'rate-limit',
        httpStatus: 429,
        safeErrorCode: 'RATE_LIMIT_EXCEEDED',
        safeMessage: 'Anonymous demo quota exceeded',
        correlationId,
        durationMs: Date.now() - startTime,
      })
      return rateLimit429(quota.retryAfterMs)
    }

    // Step 4 - restricted pipeline. A blocked target is a caller mistake (400);
    // anything else is an internal failure (500) with a safe message.
    let result
    try {
      result = await runDemoDiscovery(websiteUrl)
    } catch (err) {
      if (isDemoBlockedTargetError(err)) {
        logPersonalization({
          route: ROUTE,
          stage: 'ssrf-validation',
          httpStatus: 400,
          safeErrorCode: 'BLOCKED_URL',
          safeMessage: 'Blocked URL: private/unsafe target is not allowed',
          correlationId,
        })
        return errorResponse(BLOCKED_URL_MESSAGE, 400, correlationId)
      }
      logPersonalization({
        route: ROUTE,
        stage: 'discovery',
        httpStatus: 500,
        safeErrorCode: 'DEMO_DISCOVERY_FAILED',
        safeMessage: err instanceof Error ? urlForLog(err.message) : 'Demo discovery failed',
        correlationId,
        durationMs: Date.now() - startTime,
      })
      return errorResponse('Demo discovery failed', 500, correlationId)
    }

    // Step 5 - best-effort cache write. A cache outage must not fail a demo
    // that already succeeded.
    try {
      await writeDemoDiscoveryCache(websiteUrl, {
        url: result.url,
        title: result.title,
        description: result.description,
        logo: result.logo,
        assets: result.assets,
        ...(result.brandColors ? { brandColors: result.brandColors } : {}),
      })
    } catch {
      logPersonalization({
        route: ROUTE,
        stage: 'cache-write',
        httpStatus: 200,
        safeErrorCode: 'DEMO_CACHE_UNAVAILABLE',
        safeMessage: 'Demo cache write unavailable',
        correlationId,
        durationMs: Date.now() - startTime,
      })
    }

    logPersonalization({
      route: ROUTE,
      stage: 'discovery',
      httpStatus: 200,
      correlationId,
      durationMs: Date.now() - startTime,
    })

    return NextResponse.json({
      ok: true,
      cached: false,
      url: result.url,
      title: result.title,
      description: result.description,
      logo: result.logo,
      assets: result.assets,
      ...(result.brandColors ? { brandColors: result.brandColors } : {}),
    })
  } catch (rawErr) {
    logPersonalization({
      route: ROUTE,
      stage: 'unhandled',
      httpStatus: 500,
      safeErrorCode: 'DEMO_ROUTE_ERROR',
      safeMessage: rawErr instanceof Error ? urlForLog(rawErr.message) : 'Unexpected error',
      correlationId,
      durationMs: Date.now() - startTime,
    })
    return errorResponse('Demo discovery failed', 500, correlationId)
  }
}
