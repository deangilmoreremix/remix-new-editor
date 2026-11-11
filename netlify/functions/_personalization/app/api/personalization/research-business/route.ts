import { NextRequest, NextResponse } from '../../../../shims/next-server'
import { logPersonalization, createCorrelationId, sanitizeForLog } from '../../../../src/server/personalizationLog'
import { validatePersonalizationEnv } from '../../../../src/server/envValidation'
import { rateLimit, rateLimit429, resolveRateLimitKey } from '../../../../lib/rateLimit'

export const dynamic = "force-dynamic";

export const runtime = 'nodejs'

const MAX_WEBSITE_URL_LENGTH = 2048
const RATE_LIMIT_WINDOW_MS = 60_000
const RATE_LIMIT_MAX = 10
// Higher ceiling for the shared 'anon' fallback bucket (see below).
const ANON_RATE_LIMIT_MAX = 100

// Proxy-trust assumption:
// - `x-real-ip` is stamped by the trusted reverse proxy (nginx
//   `proxy_set_header X-Real-IP $remote_addr`, or most load balancers) and is
//   not client-controllable once the proxy overwrites it.
// - `x-forwarded-for` is append-only ($proxy_add_x_forwarded_for): the FIRST
//   hop is whatever the client sent (rotating it mints fresh rate-limit
//   buckets), while the LAST hop is appended by the nearest trusted proxy.
// Therefore prefer x-real-ip, then the LAST x-forwarded-for hop, and give up
// (undefined) when neither exists so resolveRateLimitKey falls back to the
// shared 'anon' bucket — which is rate-limited with a much higher max below.
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

// Fetch-level failures against the target website (DNS, connect, timeout) are
// upstream failures, not malformed input: answer 502 instead of 500.
function isUpstreamFetchError(message: string, nodeCode?: string): boolean {
  if (nodeCode && /^(ECONN|ETIMEDOUT|EPIPE|EAI_AGAIN|ENOTFOUND|ECONNRESET)/.test(nodeCode)) {
    return true
  }
  return (
    /fetch failed/i.test(message) ||
    /network/i.test(message) ||
    /timeout/i.test(message) ||
    /socket hang up/i.test(message) ||
    /abort/i.test(message)
  )
}

// ---------------------------------------------------------------------------
// Error classification for a thrown provider error.
//
// researchBusiness can reject in three broad shapes:
//   1. SSRF / URL rejections from networkSafety (directly, or wrapped by the
//      provider as `Blocked URL: ... is not allowed`), and the legacy
//      discoverAssets sanitizer — the caller supplied a URL this endpoint
//      refuses to fetch (non-HTTP protocol, private/loopback target, internal
//      hostname, unresolvable host, invalid URL). The URL is unusable no
//      matter which way you look at it, and this server did not fail; these
//      are caller mistakes → 400.
//   2. Fetch-level failures (DNS, connect, timeout, socket, abort) against a
//      URL that passed validation — the upstream site is the problem → 502.
//   3. Anything else — an unexpected internal fault → 500.
//
// `Only http/https protocols are allowed` (networkSafety's protocol message,
// with the legacy `Only http(s) URLs are allowed` spelling kept for safety)
// and `DNS resolution failed` are the two messages that carry none of the
// words in the general 400 regex below, yet mean exactly the same thing as
// the rest of group 1: the caller's input, not a transport outage. Without
// the explicit patterns they would fall through to 500 and be misreported as
// internal failures. They are still distinct from group 2's fetch-level DNS
// failures, which axios surfaces as `fetch failed` with a node code
// (ENOTFOUND / EAI_AGAIN) and keep their 502 mapping.
// ---------------------------------------------------------------------------
const CALLER_MISTAKE_MESSAGE_PATTERNS: readonly RegExp[] = [
  // networkSafety protocol rejection (non-HTTP(S) scheme).
  /only http\/https protocols are allowed/i,
  // Legacy urlSecurity protocol rejection, kept for defence in depth.
  /only http\(s\) urls are allowed/i,
  // hostname that cannot be resolved.
  /dns resolution failed/i,
]

// General shapes already carrying the "unsafe target" vocabulary: the
// provider's `Blocked URL: ... is not allowed` wrapper and the raw
// networkSafety / legacy discoverAssets messages.
const BLOCKED_TARGET_PATTERN = /not allowed|Private|Invalid/i

function isCallerUrlMistake(message: string): boolean {
  return (
    BLOCKED_TARGET_PATTERN.test(message) ||
    CALLER_MISTAKE_MESSAGE_PATTERNS.some((pattern) => pattern.test(message))
  )
}

function classifyFailureStatus(message: string, nodeCode?: string): number {
  if (isCallerUrlMistake(message)) return 400
  if (isUpstreamFetchError(message, nodeCode)) return 502
  return 500
}

export async function POST(req: NextRequest) {
  const correlationId = createCorrelationId(req)
  const startTime = Date.now()

  // Per-IP rate limit (unauthenticated public-proxy route); protects the
  // upstream target site and this server from fetch abuse.
  const rateLimitKey = resolveRateLimitKey(undefined, clientIpOf(req))
  // When neither proxy header exists (self-hosted / proxy-less deploys),
  // resolveRateLimitKey falls back to the shared 'anon' bucket, so ALL
  // anonymous callers would share one 10/min bucket and self-DoS each other.
  // Such deployments degrade gracefully with a much higher max for that
  // bucket; IP-keyed callers keep the strict per-IP limit.
  const rateLimitMax = rateLimitKey === 'anon' ? ANON_RATE_LIMIT_MAX : RATE_LIMIT_MAX
  const rateLimitResult = rateLimit(rateLimitKey, { windowMs: RATE_LIMIT_WINDOW_MS, max: rateLimitMax })
  if (!rateLimitResult.allowed) return rateLimit429(rateLimitResult.retryAfterMs)

  try {
    const envCheck = validatePersonalizationEnv()
    if (!envCheck.valid) {
      logPersonalization({
        route: '/api/personalization/research-business',
        stage: 'env-validation',
        httpStatus: 500,
        safeErrorCode: 'ENV_MISSING',
        safeMessage: `Missing required env vars: ${envCheck.missingRequired.join(', ')}`,
        correlationId,
      })
      return NextResponse.json(
        { error: 'Server configuration error', correlationId },
        { status: 500, headers: { 'x-correlation-id': correlationId } },
      )
    }

    const body = await req.json().catch(() => ({}))
    const websiteUrl = typeof body?.websiteUrl === 'string' ? body.websiteUrl.trim() : ''

    if (!websiteUrl) {
      logPersonalization({
        route: '/api/personalization/research-business',
        stage: 'validation',
        httpStatus: 400,
        safeErrorCode: 'MISSING_WEBSITE_URL',
        safeMessage: 'websiteUrl is required',
        correlationId,
      })
      return NextResponse.json({ error: 'websiteUrl is required' }, { status: 400 })
    }

    if (websiteUrl.length > MAX_WEBSITE_URL_LENGTH) {
      logPersonalization({
        route: '/api/personalization/research-business',
        stage: 'validation',
        httpStatus: 400,
        safeErrorCode: 'WEBSITE_URL_TOO_LONG',
        safeMessage: `websiteUrl exceeds ${MAX_WEBSITE_URL_LENGTH} characters`,
        correlationId,
      })
      return NextResponse.json(
        { error: `websiteUrl must be at most ${MAX_WEBSITE_URL_LENGTH} characters` },
        { status: 400 },
      )
    }

    const { researchBusiness } = await import('../../../../src/server/businessDiscovery/researchProvider')
    const result = await researchBusiness(websiteUrl)

    logPersonalization({
      route: '/api/personalization/research-business',
      stage: 'research',
      provider: result.reachable ? 'STATIC_HTTP' : 'STATIC_HTTP_FAILED',
      httpStatus: 200,
      correlationId,
      durationMs: Date.now() - startTime,
    })

    return NextResponse.json({
      ok: true,
      research: result,
    })
  } catch (rawErr) {
    const err: Error = rawErr instanceof Error ? rawErr : new Error('Unknown error')
    const anyErr = rawErr as any
    const nodeCode = anyErr && typeof anyErr.code === 'string' ? anyErr.code : undefined
    const safeCode = nodeCode || 'PERSONALIZATION_RUNTIME_ERROR'
    const message = String(sanitizeForLog(err.message))
    // Rejected/blocked targets (networkSafety) are caller mistakes (400); fetch
    // level failures against the target are upstream (502); anything else is
    // an unexpected internal failure (500). All non-2xx bodies stay generic
    // with the correlationId for support correlation — never raw internals.
    // See the classification helpers above for why each message shape maps
    // where it does.
    const status = classifyFailureStatus(message, nodeCode)
    logPersonalization({
      route: '/api/personalization/research-business',
      stage: 'unhandled',
      provider: 'STATIC_HTTP',
      httpStatus: status,
      safeErrorCode: safeCode,
      safeMessage: message,
      correlationId,
      durationMs: Date.now() - startTime,
    })
    return NextResponse.json(
      { error: 'Personalization runtime error', code: safeCode, correlationId },
      { status, headers: { 'x-correlation-id': correlationId } },
    )
  }
}
