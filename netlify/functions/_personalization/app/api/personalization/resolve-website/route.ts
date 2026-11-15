import { NextRequest, NextResponse } from '../../../../shims/next-server'
import { logPersonalization, createCorrelationId, sanitizeForLog } from '../../../../src/server/personalizationLog'
import { rateLimit, rateLimit429, resolveRateLimitKey } from '../../../../lib/rateLimit'

/**
 * POST /api/personalization/resolve-website
 *
 * Finds a discovered business's OWN website when OpenStreetMap lists only a
 * social page (or nothing). Free: guesses candidates from the business email
 * domain and name, and returns one only when the page verifiably belongs to
 * the business (see `src/server/businessDiscovery/websiteResolver.ts`).
 *
 * Kept separate from find-businesses so the search request budget is
 * untouched; the client calls this only for the lead the user selects.
 *
 * `website: null` is a normal answer ("not found"), not an error.
 */

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const ROUTE = '/api/personalization/resolve-website'
const RATE_LIMIT_WINDOW_MS = 60_000
const RATE_LIMIT_MAX = 10
// Higher ceiling for the shared 'anon' fallback bucket (no proxy IP header).
const ANON_RATE_LIMIT_MAX = 100

const FIELD_LIMITS = {
  name: 200,
  city: 120,
  region: 120,
  postalCode: 20,
  phone: 40,
  email: 254,
} as const

type Field = keyof typeof FIELD_LIMITS

// Same proxy-trust assumption as research-business: prefer x-real-ip, then
// the LAST x-forwarded-for hop (appended by the nearest trusted proxy).
function clientIpOf(req: NextRequest): string | undefined {
  const realIp = req.headers.get('x-real-ip')?.trim()
  if (realIp) return realIp
  const forwardedFor = req.headers.get('x-forwarded-for')
  if (forwardedFor) {
    const hops = forwardedFor.split(',').map((hop) => hop.trim()).filter(Boolean)
    if (hops.length > 0) return hops[hops.length - 1]
  }
  return undefined
}

function readField(body: Record<string, unknown>, field: Field): string | undefined {
  const value = body[field]
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  if (!trimmed) return undefined
  return trimmed.slice(0, FIELD_LIMITS[field])
}

export async function POST(req: NextRequest) {
  const correlationId = createCorrelationId(req)
  const startTime = Date.now()

  const rateLimitKey = resolveRateLimitKey(undefined, clientIpOf(req))
  const rateLimitMax = rateLimitKey === 'anon' ? ANON_RATE_LIMIT_MAX : RATE_LIMIT_MAX
  const rateLimitResult = rateLimit(`resolve-website:${rateLimitKey}`, {
    windowMs: RATE_LIMIT_WINDOW_MS,
    max: rateLimitMax,
  })
  if (!rateLimitResult.allowed) return rateLimit429(rateLimitResult.retryAfterMs)

  try {
    const raw = await req.json().catch(() => ({}))
    const body = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
    const name = readField(body, 'name')

    if (!name) {
      logPersonalization({
        route: ROUTE,
        stage: 'validation',
        httpStatus: 400,
        safeErrorCode: 'MISSING_BUSINESS_NAME',
        safeMessage: 'name is required',
        correlationId,
      })
      return NextResponse.json(
        { error: 'name is required', correlationId },
        { status: 400, headers: { 'x-correlation-id': correlationId } },
      )
    }

    const { resolveBusinessWebsite } = await import('../../../../src/server/businessDiscovery/websiteResolver')
    const result = await resolveBusinessWebsite({
      name,
      city: readField(body, 'city'),
      region: readField(body, 'region'),
      postalCode: readField(body, 'postalCode'),
      phone: readField(body, 'phone'),
      email: readField(body, 'email'),
    })

    logPersonalization({
      route: ROUTE,
      stage: 'resolve',
      provider: result ? 'STATIC_HTTP' : 'STATIC_HTTP_NOT_FOUND',
      httpStatus: 200,
      correlationId,
      durationMs: Date.now() - startTime,
    })

    return NextResponse.json(
      result
        ? { ok: true, website: result.website, confidence: result.confidence, evidence: result.evidence }
        : { ok: true, website: null },
      { headers: { 'x-correlation-id': correlationId } },
    )
  } catch (rawErr) {
    const err = rawErr instanceof Error ? rawErr : new Error('Unknown error')
    logPersonalization({
      route: ROUTE,
      stage: 'unhandled',
      provider: 'STATIC_HTTP',
      httpStatus: 500,
      safeErrorCode: 'PERSONALIZATION_RUNTIME_ERROR',
      safeMessage: String(sanitizeForLog(err.message)),
      correlationId,
      durationMs: Date.now() - startTime,
    })
    return NextResponse.json(
      { error: 'Unable to look up the business website right now.', correlationId },
      { status: 500, headers: { 'x-correlation-id': correlationId } },
    )
  }
}
