import { NextRequest, NextResponse, after } from '../../../../shims/next-server'
import { auth } from '../../../../shims/clerk-server'
import type { ImageCandidate, SocialProfileSource } from '../../../../src/server/discoveryProvider'
import type { DiscoveredAsset } from '../../../../src/server/discoverAssets'
import { logPersonalization, createCorrelationId, sanitizeForLog } from '../../../../src/server/personalizationLog'
import { validatePersonalizationEnv } from '../../../../src/server/envValidation'
import {
  createDiscoveryJob,
  getDiscoveryJobForUser,
  updateDiscoveryJob,
  type DiscoveryJobRow,
} from '../../../../src/server/discoveryJobs'
import { withDbTimeout, DiscoveryDbTimeoutError, DISCOVERY_BUSY_MESSAGE } from '../../../../src/server/dbTimeout'
import { buildDiscoveryJobResponse } from '../../../../src/server/discoveryJobResponse'
import { assertSafeUrlString } from '../../../../src/lib/networkSafety'

export const dynamic = "force-dynamic";

export const runtime = 'nodejs'

type RawDiscoveryResult = {
  providerUsed: string
  providerAttempted: string
  candidates: ImageCandidate[]
  pagesCrawled: number
  rawCandidates: number
  duration: number
  socialProfiles: SocialProfileSource[]
  discoveredAssets: DiscoveredAsset[]
  firecrawlUsed: boolean
  providerAttempts: string[]
  firecrawlReason?: string
  firecrawlSkippedReason?: string
  localUsefulAssetCount?: number
  firecrawlUsefulAssetCount?: number
  sitemapFound?: boolean
  crawleePagesCrawled?: number
}

const discoveryCache = new Map<string, { result: RawDiscoveryResult; expiresAt: number }>()
const isTestModeAllowed = process.env.NODE_ENV !== 'production'

const RATE_LIMIT_WINDOW_MS = 60_000
const RATE_LIMIT_MAX_REQUESTS = 10
const MAX_WEBSITE_URL_LENGTH = 2048

// Shared secret for internal dispatch to the background worker. Mirrors the
// pattern used by assets.js, brands.js, campaigns.js, and photo-studio.js:
// every internal call carries `x-internal-service-token`, and the worker
// rejects calls that lack it or carry the wrong value. Anonymous callers can
// still trigger discovery — the secret authenticates the dispatch, not the
// end user.
const INTERNAL_FUNCTION_SECRET = process.env.INTERNAL_FUNCTION_SECRET || ''

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

/**
 * Validates the submitted website URL.
 *
 * The gate is the shared one (`src/lib/networkSafety.ts`), which is
 * strictly stronger than the hand-rolled list this route used to carry: it
 * covers every numeric spelling of a private address (decimal, hex, octal,
 * short form), the link-local and CGNAT ranges, the cloud metadata hosts,
 * the IPv6 unique-local and link-local ranges, the IPv4-mapped IPv6 forms and
 * the reserved local suffixes. A schemeless input is read as `https://`
 * rather than rejected, so the URL a business directory hands over ("joes.com")
 * is usable.
 */
function sanitizeWebsiteUrl(url: string): string {
  const trimmed = url.trim()
  // Reject instead of silently truncating: a truncated URL is a DIFFERENT URL
  // than the caller asked for, and must never be the one we fetch.
  if (trimmed.length > MAX_WEBSITE_URL_LENGTH) {
    throw new Error('Website URL exceeds maximum length')
  }
  return assertSafeUrlString(trimmed)
}

function sanitizeErrorMessage(message: string): string {
  const safe = message
    .replace(/sk-[a-zA-Z0-9]{20,}/g, '[REDACTED]')
    .replace(/AIza[a-zA-Z0-9_-]{35}/g, '[REDACTED]')
    .replace(/Bearer\s+[a-zA-Z0-9._-]+/g, 'Bearer [REDACTED]')
  return safe
}

/**
 * The Clerk session token of the current request.
 *
 * The background worker (`personalization-browser-discovery`) verifies the
 * caller server-side, so the dispatch has to carry the session. Clerk names
 * the cookie `__session` on a single-domain instance and `__session_<suffix>`
 * on a multi-domain one, so both spellings are accepted.
 */
function extractClerkSessionToken(req: NextRequest): string | null {
  const authorization = req.headers.get('authorization')
  if (authorization) {
    const match = /^Bearer\s+(.+)$/i.exec(authorization.trim())
    if (match) return match[1].trim()
  }

  for (const cookie of req.cookies.getAll()) {
    if (cookie.name === '__session' || cookie.name.startsWith('__session_')) {
      if (cookie.value) return cookie.value
    }
  }
  return null
}

/**
 * The absolute URL of the background worker.
 *
 * Returns null when the deployment has no public base URL, because a
 * relative URL is not a URL `fetch` can resolve. The old code built
 * `/.netlify/functions/...` in that case, the fetch threw, the error was
 * logged and the job was left in `running` for ever.
 */
function backgroundWorkerUrl(req: NextRequest): string | null {
  // An explicit site URL wins. When it is not configured, the worker's URL is
  // derived from the request that is asking for it: the browser-discovery
  // worker is a function on the SAME site, so the request's own origin is
  // always the right base. Relying on NEXT_PUBLIC_SITE_URL alone meant that
  // on a deployment where that variable is not set the escalation could not
  // run at all, and the job was terminated instead of being escalated.
  const configured = (process.env.NEXT_PUBLIC_SITE_URL || '').replace(/\/+$/, '')
  const base = configured || req.nextUrl?.origin || ''
  if (!base) return null
  return `${base}/.netlify/functions/personalization-browser-discovery`
}

/**
 * Hands the rest of the discovery to the background worker.
 *
 * Returns true when the worker accepted the job. A false return means the
 * job has to be finished by the caller, because nothing else is going to
 * finish it.
 */
async function dispatchBackgroundJob(
  req: NextRequest,
  jobId: string,
  websiteUrl: string,
  priorityPages: string[],
  jobOwnerId: string,
): Promise<{ dispatched: boolean; reason?: string }> {
  const workerUrl = backgroundWorkerUrl(req)
  if (!workerUrl) {
    return { dispatched: false, reason: 'NO_BACKGROUND_WORKER_URL' }
  }

  // Discovery is free: a Clerk session is not required to dispatch a
  // background job. Anonymous callers are scoped by their IP-scoped job owner
  // id (set when the job row was created). The background worker accepts
  // requests without a session token and drives the job under its existing
  // owner identity.
  const sessionToken = extractClerkSessionToken(req)
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    // This fetch is server-to-server, so the worker sees this function's
    // egress IP, never the end user's. The owner the job was created under is
    // forwarded explicitly so the worker can match it against the job row.
    'x-discovery-job-owner': jobOwnerId,
  }
  if (sessionToken) {
    headers.Authorization = `Bearer ${sessionToken}`
  }
  // Internal dispatch authentication: every call to the background worker
  // carries INTERNAL_FUNCTION_SECRET so the worker can reject public
  // invocation. Mirrors assets.js, brands.js, campaigns.js, photo-studio.js.
  if (INTERNAL_FUNCTION_SECRET) {
    headers['x-internal-service-token'] = INTERNAL_FUNCTION_SECRET
  }

  try {
    const response = await fetch(workerUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        jobId,
        websiteUrl,
        priorityPages: priorityPages.slice(0, 4),
      }),
    })

    if (!response.ok) {
      return { dispatched: false, reason: `BACKGROUND_WORKER_${response.status}` }
    }
    return { dispatched: true }
  } catch (err) {
    return {
      dispatched: false,
      reason: `BACKGROUND_WORKER_UNREACHABLE: ${err instanceof Error ? err.message : 'unknown'}`,
    }
  }
}

export async function POST(req: NextRequest) {
  const correlationId = createCorrelationId(req)
  const startTime = Date.now()

  try {
    const envCheck = validatePersonalizationEnv()
    if (!envCheck.valid) {
      logPersonalization({
        route: '/api/personalization/discover-assets',
        stage: 'env-validation',
        httpStatus: 500,
        safeErrorCode: 'ENV_MISSING',
        safeMessage: `Missing required env vars: ${envCheck.missingRequired.join(', ')}`,
        correlationId,
      })
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
    }

    const { userId } = await auth()
    // S7: anonymous callers used to fall through to `clerkUserId: userId || 'anon'`,
    // which persisted discovery jobs under a single shared anonymous identity —
    // every anonymous visitor shared one job bucket. Asset discovery is FREE, so
    // an anonymous caller is allowed, but its jobs are scoped to the caller's IP
    // (the same per-caller identity the demo route's quota uses) instead of one
    // shared 'anon' bucket. Signed-in callers keep their per-user scope.
    const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || req.headers.get('x-real-ip') || undefined
    const jobOwnerId = userId || (clientIp ? `anon-${clientIp}` : 'anon')
    if (!userId) {
      logPersonalization({
        route: '/api/personalization/discover-assets',
        stage: 'auth',
        httpStatus: 200,
        safeErrorCode: 'ANONYMOUS_DISCOVERY',
        safeMessage: 'Discovery proceeding without a session (free feature)',
        correlationId,
      })
    }
    const body = await req.json().catch(() => ({}))
    const rawWebsiteUrl = typeof body?.websiteUrl === 'string' ? body.websiteUrl : ''
    const requestedTestMode = typeof body?.testMode === 'boolean' ? body.testMode : false
    const testMode = isTestModeAllowed ? requestedTestMode : false

    if (!rawWebsiteUrl) {
      logPersonalization({
        route: '/api/personalization/discover-assets',
        stage: 'validation',
        httpStatus: 400,
        safeErrorCode: 'MISSING_WEBSITE_URL',
        safeMessage: 'websiteUrl is required',
        correlationId,
      })
      return NextResponse.json({ error: 'websiteUrl is required' }, { status: 400 })
    }

    let websiteUrl: string
    try {
      websiteUrl = sanitizeWebsiteUrl(rawWebsiteUrl)
    } catch {
      logPersonalization({
        route: '/api/personalization/discover-assets',
        stage: 'validation',
        httpStatus: 400,
        safeErrorCode: 'INVALID_WEBSITE_URL',
        safeMessage: 'Invalid website URL format',
        correlationId,
      })
      return NextResponse.json({ error: 'Invalid website URL format' }, { status: 400 })
    }

    const rateLimitKey = jobOwnerId
    const rateLimit = checkRateLimit(rateLimitKey)
    if (!rateLimit.allowed) {
      logPersonalization({
        route: '/api/personalization/discover-assets',
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

    const cacheKey = `${websiteUrl}:${testMode ? 'test' : 'live'}:${jobOwnerId}`

    // The job row is created BEFORE the crawl starts. The caller gets a job
    // id it can poll even when the crawl outlives the synchronous budget,
    // and the row is the proof that the job belongs to this caller.
    let job: DiscoveryJobRow
    try {
      job = await withDbTimeout(createDiscoveryJob({
        clerkUserId: jobOwnerId,
        websiteUrl,
        telemetry: { startedAt: new Date().toISOString(), anonymous: !userId },
      }))
    } catch (err) {
      if (err instanceof DiscoveryDbTimeoutError) {
        logPersonalization({
          route: '/api/personalization/discover-assets',
          stage: 'job-create',
          httpStatus: 503,
          safeErrorCode: 'JOB_STORE_TIMEOUT',
          safeMessage: 'Discovery job store did not respond in time',
          correlationId,
          durationMs: Date.now() - startTime,
        })
        return NextResponse.json({ error: DISCOVERY_BUSY_MESSAGE }, { status: 503, headers: { 'Retry-After': '60' } })
      }
      logPersonalization({
        route: '/api/personalization/discover-assets',
        stage: 'job-create',
        httpStatus: 500,
        safeErrorCode: 'JOB_CREATE_FAILED',
        safeMessage: 'Failed to create discovery job',
        correlationId,
        durationMs: Date.now() - startTime,
      })
      return NextResponse.json({ error: 'Failed to create discovery job' }, { status: 500 })
    }

    if (!testMode) {
      const cached = discoveryCache.get(cacheKey)
      if (cached && cached.expiresAt > Date.now()) {
        // A cache hit still gets a job: the contract is that every accepted
        // discovery request hands the caller a job id it can poll, whatever
        // produced the assets.
        await updateDiscoveryJob(job.id, {
          status: 'complete',
          completedAt: new Date().toISOString(),
          fastResult: cached.result,
          finalResult: cached.result,
          telemetry: {
            providerAttempts: cached.result.providerAttempts,
            providerUsed: cached.result.providerUsed,
            pagesCrawled: cached.result.pagesCrawled,
            rawCandidates: cached.result.rawCandidates,
            cached: true,
          },
        }).catch((persistErr) => {
          console.error('[discover-assets] Failed to persist job state:', persistErr)
        })

        logPersonalization({
          route: '/api/personalization/discover-assets',
          stage: 'cache',
          httpStatus: 202,
          correlationId,
          durationMs: Date.now() - startTime,
        })
        return NextResponse.json(
          {
            ok: true,
            cached: true,
            status: 'complete',
            providerUsed: cached.result.providerUsed,
            providerAttempted: cached.result.providerAttempted,
            discoveredAssets: cached.result.discoveredAssets,
            candidates: cached.result.candidates,
            count: cached.result.discoveredAssets.length,
            pagesCrawled: cached.result.pagesCrawled,
            rawCandidates: cached.result.rawCandidates,
            duration: cached.result.duration,
            socialProfiles: cached.result.socialProfiles,
            jobId: job.id,
            browserQueued: false,
          },
          { status: 202 },
        )
      }
    }

    const startedAt = new Date().toISOString()
    await withDbTimeout(updateDiscoveryJob(job.id, { status: 'running', startedAt })).catch((persistErr) => {
      console.error('[discover-assets] Failed to persist job state:', persistErr)
    })

    // Discovery always runs in the background worker. The HTTP handler never
    // runs the crawl synchronously: a slow site would hold this serverless
    // function open past Netlify's 30s limit and return 504 before the caller
    // ever receives a job id. The worker performs the full pipeline — static
    // HTTP, sitemap, Crawlee/Cheerio, and browser escalation when enabled —
    // and writes the result back to the job row for the status endpoint.
    const priorityPages = Array.from(
      new Set([
        websiteUrl,
      ]),
    ).slice(0, 4)

    // Durably dispatch discovery to the background worker. `after()` keeps the
    // serverless function alive until the dispatch settles, so a slow network
    // or cold-starting worker cannot lose the job. If this function dies before
    // the dispatch settles, the stale-job watchdog on the status endpoint
    // recovers the job on the next poll.
    // `after()` throws outside a Next.js request scope (e.g. unit tests),
    // so we fall back to fire-and-forget there.
    // A dispatch the worker refused (or never received) is recorded on the job
    // straight away, so the caller's next poll reports the real reason instead
    // of waiting for the watchdog. `expectedStatus` keeps it from overwriting a
    // result the worker already wrote.
    const dispatchAndRecord = () =>
      dispatchBackgroundJob(req, job.id, websiteUrl, priorityPages, jobOwnerId)
        .then(async (dispatch) => {
          if (dispatch.dispatched) return
          console.error('[discover-assets] Background dispatch failed:', dispatch.reason)
          await updateDiscoveryJob(job.id, {
            status: 'error',
            completedAt: new Date().toISOString(),
            errorCode: (dispatch.reason || 'BACKGROUND_DISPATCH_FAILED').split(':')[0],
            errorMessage: 'Asset discovery could not be started. Please try again.',
            expectedStatus: 'running',
          })
        })
        .catch((dispatchErr) => {
          console.error('[discover-assets] Background dispatch failed:', dispatchErr instanceof Error ? dispatchErr.message : String(dispatchErr))
        })
    try {
      // The callback returns the promise so `after()` waits for it.
      after(dispatchAndRecord)
    } catch {
      void dispatchAndRecord()
    }

    logPersonalization({
      route: '/api/personalization/discover-assets',
      stage: 'discovery',
      httpStatus: 202,
      correlationId,
      durationMs: Date.now() - startTime,
    })

    return NextResponse.json(
      {
        ok: true,
        cached: false,
        status: 'pending',
        providerUsed: null,
        providerAttempted: null,
        discoveredAssets: [],
        candidates: [],
        count: 0,
        pagesCrawled: 0,
        rawCandidates: 0,
        duration: 0,
        socialProfiles: [],
        jobId: job.id,
        browserQueued: false,
      },
      { status: 202 },
    )
  } catch (rawErr) {
    const err: Error = rawErr instanceof Error ? rawErr : new Error('Unknown error')
    const anyErr = rawErr as any
    const nodeCode = anyErr && typeof anyErr.code === 'string' ? anyErr.code : undefined
    const safeCode = nodeCode || 'PERSONALIZATION_RUNTIME_ERROR'
    const message = String(sanitizeForLog(err.message))
    const status = /not allowed|Private|Invalid/i.test(message) ? 400 : 500
    logPersonalization({
      route: '/api/personalization/discover-assets',
      stage: 'unhandled',
      provider: 'ORCHESTRATOR',
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

export async function GET(req: NextRequest) {
  const correlationId = createCorrelationId(req)
  const jobId = req.nextUrl.searchParams.get('jobId')

  if (!jobId) {
    return NextResponse.json({ error: 'jobId is required' }, { status: 400 })
  }

  const { userId } = await auth()
  // Same per-caller scope as the POST: signed-in users read their own jobs,
  // anonymous callers read the jobs scoped to their IP (never one shared
  // 'anon' bucket — see the POST handler).
  const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || req.headers.get('x-real-ip') || undefined
  const jobOwnerId = userId || (clientIp ? `anon-${clientIp}` : 'anon')

  // Owner-scoped lookup: a job that belongs to somebody else is not found.
  const job = await getDiscoveryJobForUser(jobId, jobOwnerId)
  if (!job) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 })
  }

  return NextResponse.json(buildDiscoveryJobResponse(job))
}
