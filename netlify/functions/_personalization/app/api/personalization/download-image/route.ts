import { NextRequest, NextResponse } from '../../../../shims/next-server'
import { auth } from '../../../../shims/clerk-server'
import { downloadImageAsDataUrl, BlockedTargetError } from '../../../../src/server/downloadImage'
import { assertSafeUrlString } from '../../../../src/lib/networkSafety'
import { logPersonalization, createCorrelationId, sanitizeForLog } from '../../../../src/server/personalizationLog'
import { validatePersonalizationEnv } from '../../../../src/server/envValidation'

export const dynamic = "force-dynamic";

export const runtime = 'nodejs'

const RATE_LIMIT_WINDOW_MS = 60_000
const RATE_LIMIT_MAX_REQUESTS = 30
const MAX_URLS_PER_REQUEST = 20
const MAX_URL_LENGTH = 2048

const rateLimitMap = new Map<string, { count: number; resetAt: number }>()

function checkRateLimit(key: string): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now()
  const entry = rateLimitMap.get(key)

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS })
    return { allowed: true, remaining: RATE_LIMIT_MAX_REQUESTS - 1, resetAt: now + RATE_LIMIT_WINDOW_MS }
  }

  if (entry.count >= RATE_LIMIT_MAX_REQUESTS) {
    return { allowed: false, remaining: 0, resetAt: entry.resetAt }
  }

  entry.count += 1
  return { allowed: true, remaining: RATE_LIMIT_MAX_REQUESTS - entry.count, resetAt: entry.resetAt }
}

function sanitizeUrl(url: string): string {
  const trimmed = url.trim().slice(0, MAX_URL_LENGTH)
  try {
    const parsed = new URL(trimmed)
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      throw new Error('Invalid protocol')
    }
    return parsed.toString()
  } catch {
    throw new Error('Invalid URL')
  }
}

export async function POST(req: NextRequest) {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 30_000)
  const correlationId = createCorrelationId(req)
  const startTime = Date.now()

  try {
    const envCheck = validatePersonalizationEnv()
    if (!envCheck.valid) {
      clearTimeout(timeoutId)
      logPersonalization({
        route: '/api/personalization/download-image',
        stage: 'env-validation',
        httpStatus: 500,
        safeErrorCode: 'ENV_MISSING',
        safeMessage: `Missing required env vars: ${envCheck.missingRequired.join(', ')}`,
        correlationId,
      })
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
    }

    const { userId } = await auth()
    if (!userId) {
      clearTimeout(timeoutId)
      logPersonalization({
        route: '/api/personalization/download-image',
        stage: 'auth',
        httpStatus: 401,
        safeErrorCode: 'UNAUTHENTICATED',
        safeMessage: 'No authenticated user',
        correlationId,
      })
      return NextResponse.json({ error: 'UNAUTHENTICATED' }, { status: 401 })
    }

    const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || req.headers.get('x-real-ip') || undefined
    const rateLimitKey = userId || clientIp || 'anon'
    const rateLimit = checkRateLimit(rateLimitKey)
    if (!rateLimit.allowed) {
      clearTimeout(timeoutId)
      logPersonalization({
        route: '/api/personalization/download-image',
        stage: 'rate-limit',
        httpStatus: 429,
        safeErrorCode: 'RATE_LIMIT_EXCEEDED',
        safeMessage: 'Rate limit exceeded. Please try again later.',
        correlationId,
      })
      return NextResponse.json(
        { error: 'Rate limit exceeded. Please try again later.' },
        { status: 429, headers: { 'Retry-After': String(Math.ceil((rateLimit.resetAt - Date.now()) / 1000)) } },
      )
    }

    let body: unknown
    try {
      body = await req.json()
    } catch {
      clearTimeout(timeoutId)
      logPersonalization({
        route: '/api/personalization/download-image',
        stage: 'parse-body',
        httpStatus: 400,
        safeErrorCode: 'INVALID_JSON',
        safeMessage: 'Invalid JSON body',
        correlationId,
      })
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const urls = Array.isArray((body as { urls?: unknown } | null)?.urls)
      ? ((body as { urls: string[] }).urls)
      : []
    if (urls.length === 0) {
      clearTimeout(timeoutId)
      logPersonalization({
        route: '/api/personalization/download-image',
        stage: 'validation',
        httpStatus: 400,
        safeErrorCode: 'MISSING_URLS',
        safeMessage: 'urls array is required',
        correlationId,
      })
      return NextResponse.json({ error: 'urls array is required' }, { status: 400 })
    }

    if (urls.length > MAX_URLS_PER_REQUEST) {
      clearTimeout(timeoutId)
      logPersonalization({
        route: '/api/personalization/download-image',
        stage: 'validation',
        httpStatus: 400,
        safeErrorCode: 'TOO_MANY_URLS',
        safeMessage: `Maximum ${MAX_URLS_PER_REQUEST} URLs allowed per request`,
        correlationId,
      })
      return NextResponse.json({ error: `Maximum ${MAX_URLS_PER_REQUEST} URLs allowed per request` }, { status: 400 })
    }

    const sanitizedUrls: string[] = []
    for (const url of urls) {
      if (typeof url !== 'string') {
        clearTimeout(timeoutId)
        logPersonalization({
          route: '/api/personalization/download-image',
          stage: 'validation',
          httpStatus: 400,
          safeErrorCode: 'INVALID_URL_TYPE',
          safeMessage: 'All URLs must be strings',
          correlationId,
        })
        return NextResponse.json({ error: 'All URLs must be strings' }, { status: 400 })
      }
      try {
        sanitizedUrls.push(sanitizeUrl(url))
      } catch {
        clearTimeout(timeoutId)
        logPersonalization({
          route: '/api/personalization/download-image',
          stage: 'validation',
          httpStatus: 400,
          safeErrorCode: 'INVALID_URL',
          safeMessage: `Invalid URL: ${url.slice(0, 100)}`,
          correlationId,
        })
        return NextResponse.json({ error: `Invalid URL: ${url.slice(0, 100)}` }, { status: 400 })
      }
    }

    // S8 pre-flight: reject any URL whose literal form or hostname is
    // private, link-local, metadata, CGNAT, ULA, unspecified, IPv4-mapped or
    // an alternate IP encoding BEFORE a single byte is fetched. The async
    // DNS-resolving gate + per-hop revalidation live in downloadImageAsDataUrl.
    for (const url of sanitizedUrls) {
      try {
        assertSafeUrlString(url)
      } catch {
        clearTimeout(timeoutId)
        logPersonalization({
          route: '/api/personalization/download-image',
          stage: 'ssrf',
          httpStatus: 400,
          safeErrorCode: 'BLOCKED_URL',
          safeMessage: `Blocked URL: ${url.slice(0, 100)} is not allowed`,
          correlationId,
        })
        return NextResponse.json(
          { error: `Blocked URL: ${url.slice(0, 100)} is not allowed` },
          { status: 400 },
        )
      }
    }

    const results = await Promise.all(
      sanitizedUrls.map(async (url) => {
        try {
          const dataUrl = await downloadImageAsDataUrl(url, 5 * 1024 * 1024)
          return { url, dataUrl, ok: true }
        } catch (err) {
          // A blocked redirect hop is a rejected request (→ 400 for the whole
          // batch), not a per-image failure.
          if (err instanceof BlockedTargetError) throw err
          const message = err instanceof Error ? err.message : 'Download failed'
          return { url, error: message, ok: false }
        }
      }),
    )

    clearTimeout(timeoutId)
    logPersonalization({
      route: '/api/personalization/download-image',
      stage: 'download',
      httpStatus: 200,
      provider: 'AXIOS',
      correlationId,
      durationMs: Date.now() - startTime,
    })

    return NextResponse.json({ ok: true, results }, {
      headers: {
        'X-RateLimit-Remaining': String(rateLimit.remaining),
        'X-RateLimit-Reset': String(rateLimit.resetAt),
      },
    })
  } catch (err) {
    clearTimeout(timeoutId)
    // A blocked destination (including a redirect hop that resolves to a
    // private address) is a rejected request, never an internal failure.
    if (err instanceof BlockedTargetError) {
      logPersonalization({
        route: '/api/personalization/download-image',
        stage: 'ssrf',
        httpStatus: 400,
        safeErrorCode: 'BLOCKED_URL',
        safeMessage: err.message,
        correlationId,
      })
      return NextResponse.json({ error: err.message }, { status: 400 })
    }
    if (err instanceof Error && err.name === 'AbortError') {
      logPersonalization({
        route: '/api/personalization/download-image',
        stage: 'request',
        httpStatus: 504,
        safeErrorCode: 'TIMEOUT',
        safeMessage: 'Request timed out',
        correlationId,
        durationMs: Date.now() - startTime,
      })
      return NextResponse.json({ error: 'Request timed out' }, { status: 504 })
    }
    const message = err instanceof Error ? err.message : 'Unknown error'
    const safeMessage = message.replace(/sk-[a-zA-Z0-9]{20,}/g, '[REDACTED]')
    logPersonalization({
      route: '/api/personalization/download-image',
      stage: 'unhandled',
      httpStatus: 500,
      safeErrorCode: 'UNEXPECTED_ERROR',
      safeMessage: safeMessage,
      correlationId,
      durationMs: Date.now() - startTime,
    })
    return NextResponse.json({ error: safeMessage }, { status: 500 })
  }
}
