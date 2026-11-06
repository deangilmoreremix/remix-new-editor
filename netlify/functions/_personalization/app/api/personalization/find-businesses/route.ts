import { NextRequest, NextResponse } from '../../../../shims/next-server'
import { geocodeLocation, discoverBusinesses, searchBusinessesViaNominatim, deduplicateBusinesses, scoreAndSort, classifyRecords, excludeNationalChains, createCacheKey, businessDiscoveryCache } from '../../../../src/server/businessDiscovery/index'
import type { BusinessDiscoveryRecord, OwnershipType } from '../../../../src/server/businessDiscovery/index'
import { getNicheMapping, getSupportedNiches } from '../../../../src/server/businessDiscovery/index'
import { createStageDeadline, withDeadline, DeadlineExceededError, ROUTE_DEADLINE_MS } from '../../../../src/server/businessDiscovery/deadline'
import { logPersonalization, createCorrelationId } from '../../../../src/server/personalizationLog'
import { rateLimit, rateLimit429, resolveRateLimitKey } from '../../../../lib/rateLimit'

export const dynamic = "force-dynamic";

export const runtime = 'nodejs'

const CACHE_TTL_MS = 1000 * 60 * 60 // 1 hour
const MAX_RADIUS_MILES = 50
const DEFAULT_RADIUS_MILES = 15
const MAX_LIMIT = 50
const DEFAULT_LIMIT = 30
const MAX_LOCATION_LENGTH = 200
const RATE_LIMIT_WINDOW_MS = 60_000
const RATE_LIMIT_MAX = 10
// Higher ceiling for the shared 'anon' fallback bucket (see below).
const ANON_RATE_LIMIT_MAX = 100

/**
 * Hard budget for the whole request lives in
 * `@/server/businessDiscovery/deadline` (`ROUTE_DEADLINE_MS`) so the route and
 * the budget regression test read the same numbers.
 *
 * The route runs behind a proxy that aborts a request which has not produced
 * any bytes for ~30s and answers the client with an HTML "Inactivity Timeout"
 * page — the exact failure this route kept hitting. A JSON body produced
 * inside this budget is strictly better than that HTML page, so the deadline
 * is the last line of defence and is deliberately well under the platform
 * ceiling.
 */

/**
 * Public-safe message for a request that ran out of budget.
 */
const SEARCH_TIMEOUT_MESSAGE =
  'Business search timed out. Please try a smaller radius or a different location.'

// Stable, machine-readable error codes. Every error path of this route
// answers with one of these plus the correlationId, so a client can branch
// on the failure without parsing prose.
const ERROR_CODES = {
  MISSING_NICHE: 'MISSING_NICHE',
  MISSING_LOCATION: 'MISSING_LOCATION',
  LOCATION_TOO_LONG: 'LOCATION_TOO_LONG',
  UNSUPPORTED_NICHE: 'UNSUPPORTED_NICHE',
  GEOCODE_FAILED: 'GEOCODE_FAILED',
  GEOCODE_UPSTREAM_FAILED: 'GEOCODE_UPSTREAM_FAILED',
  SEARCH_TIMEOUT: 'SEARCH_TIMEOUT',
  OVERPASS_ALL_MIRRORS_FAILED: 'OVERPASS_ALL_MIRRORS_FAILED',
  DISCOVERY_UPSTREAM_FAILED: 'DISCOVERY_UPSTREAM_FAILED',
  UNEXPECTED_ERROR: 'UNEXPECTED_ERROR',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  RATE_LIMITED: 'RATE_LIMITED',
} as const

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

// Nominatim/Overpass outages are upstream failures, not caller mistakes: they
// must surface as 502 with a generic message (plus correlationId) instead of
// leaking provider internals or being mislabeled as a bad request.
function isUpstreamProviderError(message: string): boolean {
  return (
    /Nominatim geocoding failed: HTTP/i.test(message) ||
    /Overpass HTTP/i.test(message) ||
    /All Overpass providers failed/i.test(message) ||
    /No results from Overpass/i.test(message) ||
    /fetch failed/i.test(message) ||
    /network/i.test(message) ||
    /timeout/i.test(message) ||
    /abort/i.test(message)
  )
}

/**
 * True when the failure is the request budget running out.
 *
 * The budget aborts the in-flight upstream request, so the provider surfaces
 * an `AbortError` rather than the budget's own error. Both mean "we ran out
 * of time", which is a 504, not an upstream outage.
 */
function isBudgetExhausted(err: unknown): boolean {
  if (err instanceof DeadlineExceededError) return true
  return err instanceof Error && err.name === 'AbortError'
}

// Free-path actionable copy: when every Overpass mirror is down the caller
// cannot get businesses from search but can still paste a website URL into
// the research step. Keep it provider-internals free.
const ALL_OVERPASS_FAILED_USER_MESSAGE =
  'Local business search is temporarily busy. Please try again in a moment or enter a business website manually to continue.'

// Ownership classification runs at the ROUTE level (after deduplication)
// rather than inside the Overpass provider, because the local_multi_location
// heuristic needs the full batch of names (allNamesInBatch) — something the
// per-element normalizer cannot see. Big-box chains are excluded by default;
// `includeChains: true` opts in to keeping them.
interface DiscoveryStats {
  discovered: number
  independent: number
  localMultiLocation: number
  franchiseChain: number
  nationalBigboxExcluded: number
  unknownOwnership: number
  withContact: number
}

function countOwnership(records: BusinessDiscoveryRecord[], ownership: OwnershipType): number {
  return records.filter((r) => r.ownership === ownership).length
}

function buildStats(
  classified: BusinessDiscoveryRecord[],
  nationalBigboxExcluded: number,
  pool: BusinessDiscoveryRecord[],
): DiscoveryStats {
  return {
    discovered: classified.length,
    independent: countOwnership(classified, 'independent'),
    localMultiLocation: countOwnership(classified, 'local_multi_location'),
    franchiseChain: countOwnership(classified, 'franchise_chain'),
    nationalBigboxExcluded,
    unknownOwnership: countOwnership(classified, 'unknown'),
    withContact: pool.filter((r) => r.phone || r.email).length,
  }
}

function processDiscoveryBatch(
  results: BusinessDiscoveryRecord[],
  includeChains: boolean,
): { enriched: BusinessDiscoveryRecord[]; stats: DiscoveryStats } {
  const classified = classifyRecords(deduplicateBusinesses(results))
  const { kept, excluded } = excludeNationalChains(classified)
  const pool = includeChains ? classified : kept
  // scoreAndSort assigns every score field itself; enriching again would just
  // recompute identical values (the double-source pattern behind the old
  // "displayed score ≠ ranked score" bug).
  const enriched = scoreAndSort(pool)
  return { enriched, stats: buildStats(classified, excluded.length, pool) }
}

/**
 * JSON answer for an upstream (502) failure.
 *
 * The body always carries a stable `code` and the `correlationId`, so the
 * client can branch on the failure and a support request can be correlated
 * with the server-side log. Provider internals never leak into it.
 */
function serverErrorResponse(
  error: string,
  correlationId: string,
  code: string,
  extras: Record<string, unknown> = {},
): NextResponse {
  return NextResponse.json(
    { error, code, correlationId, ...extras },
    { status: 502, headers: { 'x-correlation-id': correlationId } },
  )
}

/**
 * JSON answer for a caller (400) error.
 *
 * Same contract as the 502/504 answers: a stable `code` and the
 * `correlationId` are always present.
 */
function clientErrorResponse(
  error: string,
  correlationId: string,
  code: string,
  status = 400,
): NextResponse {
  return NextResponse.json(
    { error, code, correlationId },
    { status, headers: { 'x-correlation-id': correlationId } },
  )
}

/**
 * JSON answer for a request that ran out of budget.
 *
 * A JSON body with a stable `code` is strictly better than the platform's
 * HTML "Inactivity Timeout" page: the client can render it, the banner shows
 * an actionable message, and the response is machine-readable.
 */
function searchTimeoutResponse(
  correlationId: string,
  extras: Record<string, unknown> = {},
): NextResponse {
  return NextResponse.json(
    { error: SEARCH_TIMEOUT_MESSAGE, code: ERROR_CODES.SEARCH_TIMEOUT, correlationId, ...extras },
    { status: 504, headers: { 'x-correlation-id': correlationId } },
  )
}

type ProviderOutcome<T> = {
  source: 'OPENSTREETMAP' | 'NOMINATIM_SEARCH'
  records?: T[]
  error?: Error
}

/** How a provider contributed to the answer. */
type ProviderState = 'contributed' | 'failed' | 'empty' | 'cancelled'

/**
 * Resolves with the first provider that produced REAL records.
 *
 * The two providers are independent OSM query paths, so the request costs the
 * fastest one that has data — never the sum of both. Concretely:
 *
 *  - The first provider that returns at least one record wins the race. The
 *    Nominatim fallback therefore NEVER waits for the Overpass provider to
 *    finish: a degraded Overpass (the production incident: every mirror
 *    hanging) can no longer add its full stage deadline to the fallback's
 *    latency.
 *  - A provider that FAILS never stops the other one, and a provider that
 *    fails is never a reason to discard a good sibling result.
 *  - When both providers have already settled, the RICHER record set wins
 *    (more businesses for the same request).
 *  - `abort` is called as soon as the race is decided, so the losing
 *    provider's in-flight upstream requests are cancelled instead of
 *    lingering after the response was produced.
 */
function raceProviders<T>(
  providers: Array<Promise<ProviderOutcome<T>>>,
  abort: () => void,
): Promise<{ winner: ProviderOutcome<T> | null; outcomes: ProviderOutcome<T>[] }> {
  return new Promise((resolve) => {
    const outcomes: ProviderOutcome<T>[] = []
    let pending = providers.length
    let settled = false

    if (pending === 0) {
      resolve({ winner: null, outcomes })
      return
    }

    const settle = (winner: ProviderOutcome<T> | null) => {
      if (settled) return
      settled = true
      // The loser must stop working: cancel its in-flight upstream requests.
      abort()
      resolve({ winner, outcomes })
    }

    for (const provider of providers) {
      provider.then((outcome) => {
        if (settled) return
        outcomes.push(outcome)
        pending -= 1
        const count = outcome.records?.length ?? 0
        if (count > 0) {
          // Prefer an already-settled sibling that has MORE records.
          const best = outcomes
            .filter((o) => (o.records?.length ?? 0) > 0)
            .sort((a, b) => (b.records?.length ?? 0) - (a.records?.length ?? 0))[0]
          settle(best)
          return
        }
        if (pending === 0) {
          settle(null)
        }
      })
    }
  })
}

export async function POST(req: NextRequest) {
  const correlationId = createCorrelationId(req)
  const startTime = Date.now()

  // Per-IP rate limit (unauthenticated public-proxy route). The limiter is
  // in-process only (see lib/rateLimit.ts), matching the other personalization
  // routes; it exists to protect the upstream Nominatim/Overpass quota.
  const rateLimitKey = resolveRateLimitKey(undefined, clientIpOf(req))
  // When neither proxy header exists (self-hosted / proxy-less deploys),
  // resolveRateLimitKey falls back to the shared 'anon' bucket, so ALL
  // anonymous callers would share one 10/min bucket and self-DoS each other.
  // Such deployments degrade gracefully with a much higher max for that
  // bucket; IP-keyed callers keep the strict per-IP limit.
  const rateLimitMax = rateLimitKey === 'anon' ? ANON_RATE_LIMIT_MAX : RATE_LIMIT_MAX
  const rateLimitResult = rateLimit(rateLimitKey, { windowMs: RATE_LIMIT_WINDOW_MS, max: rateLimitMax })
  if (!rateLimitResult.allowed) {
    logPersonalization({
      route: '/api/personalization/find-businesses',
      stage: 'rate-limit',
      httpStatus: 429,
      safeErrorCode: ERROR_CODES.RATE_LIMITED,
      safeMessage: 'Rate limit exceeded',
      correlationId,
    })
    // The shared limiter helper owns the user-facing copy and the Retry-After
    // header; the route adds the stable `code` and the `correlationId` so
    // EVERY error path of this route answers with the same JSON contract
    // (a JSON body a client can branch on, never a bare string).
    const limited = rateLimit429(rateLimitResult.retryAfterMs)
    let limitedMessage = 'Rate limit exceeded. Please wait before retrying.'
    try {
      const limitedBody = (await limited.json()) as { error?: string }
      if (typeof limitedBody?.error === 'string' && limitedBody.error.length > 0) {
        limitedMessage = limitedBody.error
      }
    } catch {
      // The helper answered with a non-JSON body: keep the local copy.
    }
    return NextResponse.json(
      { error: limitedMessage, code: ERROR_CODES.RATE_LIMITED, correlationId },
      {
        status: 429,
        headers: {
          'Retry-After':
            limited.headers.get('retry-after') ??
            String(Math.ceil(rateLimitResult.retryAfterMs / 1000)),
          'x-correlation-id': correlationId,
        },
      },
    )
  }

  try {
    const body = await req.json().catch(() => ({}))
    const niche = typeof body?.niche === 'string' ? body.niche.trim() : ''
    const location = typeof body?.location === 'string' ? body.location.trim() : ''
    const radiusMiles =
      typeof body?.radiusMiles === 'number' && Number.isFinite(body.radiusMiles)
        ? body.radiusMiles
        : DEFAULT_RADIUS_MILES
    const rawLimit =
      typeof body?.limit === 'number' && Number.isFinite(body.limit)
        ? body.limit
        : DEFAULT_LIMIT
    const limit = Math.max(1, Math.min(Math.floor(rawLimit), MAX_LIMIT))
    // Big-box/national chains are excluded by default; `includeChains: true`
    // opts in to keeping them.
    const includeChains = body?.includeChains === true

    // Validate input
    if (!niche) {
      logPersonalization({
        route: '/api/personalization/find-businesses',
        stage: 'validation',
        httpStatus: 400,
        safeErrorCode: ERROR_CODES.MISSING_NICHE,
        safeMessage: 'niche is required',
        correlationId,
      })
      return clientErrorResponse('niche is required', correlationId, ERROR_CODES.MISSING_NICHE)
    }
    if (!location) {
      logPersonalization({
        route: '/api/personalization/find-businesses',
        stage: 'validation',
        httpStatus: 400,
        safeErrorCode: ERROR_CODES.MISSING_LOCATION,
        safeMessage: 'location is required',
        correlationId,
      })
      return clientErrorResponse('location is required', correlationId, ERROR_CODES.MISSING_LOCATION)
    }
    if (location.length > MAX_LOCATION_LENGTH) {
      logPersonalization({
        route: '/api/personalization/find-businesses',
        stage: 'validation',
        httpStatus: 400,
        safeErrorCode: ERROR_CODES.LOCATION_TOO_LONG,
        safeMessage: `location exceeds ${MAX_LOCATION_LENGTH} characters`,
        correlationId,
      })
      return clientErrorResponse(
        `location must be at most ${MAX_LOCATION_LENGTH} characters`,
        correlationId,
        ERROR_CODES.LOCATION_TOO_LONG,
      )
    }

    // Validate niche is supported. The response body stays STATIC — echoing
    // the user-supplied niche back would reflect raw input to the caller, so
    // only the supported list is returned; the raw niche stays in the
    // server-side log for support correlation.
    const mapping = getNicheMapping(niche)
    if (!mapping) {
      logPersonalization({
        route: '/api/personalization/find-businesses',
        stage: 'validation',
        provider: 'OPENSTREETMAP',
        httpStatus: 400,
        safeErrorCode: ERROR_CODES.UNSUPPORTED_NICHE,
        safeMessage: `Unsupported niche: "${niche}". Supported: ${getSupportedNiches().join(', ')}`,
        correlationId,
      })
      return clientErrorResponse(
        `Unsupported niche. Supported niches: ${getSupportedNiches().join(', ')}`,
        correlationId,
        ERROR_CODES.UNSUPPORTED_NICHE,
      )
    }

    // Validate and bound radius
    const boundedRadius = Math.max(1, Math.min(radiusMiles, MAX_RADIUS_MILES))

    // Check cache
    const cacheKey = createCacheKey(niche, location, boundedRadius)
    const cached = businessDiscoveryCache.get(cacheKey)
    if (cached) {
      logPersonalization({
        route: '/api/personalization/find-businesses',
        stage: 'cache',
        provider: 'OPENSTREETMAP',
        httpStatus: 200,
        correlationId,
        durationMs: Date.now() - startTime,
      })
      return NextResponse.json({
        ok: true,
        query: { niche: mapping.label, location, radiusMiles: boundedRadius },
        count: cached.length,
        businesses: cached,
        providerUsed: 'OPENSTREETMAP',
        durationMs: 0,
        cached: true,
      })
    }

    // ── Request budget ───────────────────────────────────────────────────
    // The route answers with JSON inside this budget. A response that arrives
    // later would be replaced by the platform's HTML "Inactivity Timeout"
    // page, which no client can use.
    const deadline = createStageDeadline('find-businesses', ROUTE_DEADLINE_MS)

    // Geocode the location
    let geocodeResult
    try {
      geocodeResult = await withDeadline(
        geocodeLocation(location, { signal: deadline.signal }),
        deadline,
      )
    } catch (err) {
      if (isBudgetExhausted(err)) {
        logPersonalization({
          route: '/api/personalization/find-businesses',
          stage: 'geocode',
          provider: 'NOMINATIM',
          httpStatus: 504,
          safeErrorCode: ERROR_CODES.SEARCH_TIMEOUT,
          safeMessage: 'Request budget exhausted during geocoding',
          correlationId,
          durationMs: Date.now() - startTime,
        })
        return searchTimeoutResponse(correlationId)
      }
      const message = err instanceof Error ? err.message : 'Geocoding failed'
      if (isUpstreamProviderError(message)) {
        logPersonalization({
          route: '/api/personalization/find-businesses',
          stage: 'geocode',
          provider: 'NOMINATIM',
          httpStatus: 502,
          safeErrorCode: ERROR_CODES.GEOCODE_UPSTREAM_FAILED,
          safeMessage: message,
          correlationId,
          durationMs: Date.now() - startTime,
        })
        return serverErrorResponse(
          'Unable to look up the location right now. Please try again shortly.',
          correlationId,
          ERROR_CODES.GEOCODE_UPSTREAM_FAILED,
        )
      }
      logPersonalization({
        route: '/api/personalization/find-businesses',
        stage: 'geocode',
        provider: 'NOMINATIM',
        httpStatus: 400,
        safeErrorCode: ERROR_CODES.GEOCODE_FAILED,
        safeMessage: message,
        correlationId,
        durationMs: Date.now() - startTime,
      })
      return clientErrorResponse(message, correlationId, ERROR_CODES.GEOCODE_FAILED)
    }

    // ── Discover businesses ──────────────────────────────────────────────
    // The Overpass mirrors and the Nominatim business-list search run
    // CONCURRENTLY. They are two independent OSM query paths, so the request
    // costs the fastest provider that has real records instead of the sum of
    // both. This is what keeps the free path inside the function budget:
    // chaining them meant a degraded Overpass (measured at 27-39s for a
    // 15-mile radius) pushed the whole request past the platform's timeout
    // even though Nominatim could have answered in ~4s.
    //
    // Both providers carry their own stage budget (Overpass 9s, Nominatim
    // 7s), so neither can outrun the request.
    //
    // The geocode is computed ONCE and its coordinates feed BOTH providers,
    // so the location is never looked up twice.
    //
    // `providerAbort` is the request budget's cancellation handle for the
    // discovery stage: it fires when the route budget expires AND when the
    // race is decided, so the losing provider's upstream requests are
    // cancelled instead of lingering after the answer was produced.
    const providerAbort = new AbortController()
    const abortProviders = () => providerAbort.abort()
    deadline.signal.addEventListener('abort', abortProviders, { once: true })

    const overpassOutcome = discoverBusinesses({
      niche,
      latitude: geocodeResult.latitude,
      longitude: geocodeResult.longitude,
      radiusMiles: boundedRadius,
      limit: limit * 3, // Get extra for deduplication
      signal: providerAbort.signal,
    }).then(
      (records) => ({ source: 'OPENSTREETMAP' as const, records }),
      (error: Error) => ({ source: 'OPENSTREETMAP' as const, error }),
    )

    // The Nominatim search is scoped by the geocoded viewbox; the raw
    // location string is accepted for API compatibility but is deliberately
    // NOT part of the query: appending it made Nominatim parse the search as
    // an address lookup and return nothing.
    const nominatimOutcome = searchBusinessesViaNominatim({
      niche,
      latitude: geocodeResult.latitude,
      longitude: geocodeResult.longitude,
      radiusMiles: boundedRadius,
      location,
      limit: limit * 3, // Get extra for deduplication
      signal: providerAbort.signal,
    }).then(
      (records) => ({ source: 'NOMINATIM_SEARCH' as const, records }),
      (error: Error) => ({ source: 'NOMINATIM_SEARCH' as const, error }),
    )

    let race: { winner: ProviderOutcome<unknown> | null; outcomes: ProviderOutcome<unknown>[] }
    try {
      race = await withDeadline(
        // The race is decided by the first provider with REAL records; the
        // loser is cancelled the moment the race is decided.
        raceProviders([overpassOutcome, nominatimOutcome], abortProviders),
        deadline,
      )
    } catch (err) {
      if (isBudgetExhausted(err)) {
        logPersonalization({
          route: '/api/personalization/find-businesses',
          stage: 'discover',
          provider: 'OPENSTREETMAP',
          httpStatus: 504,
          safeErrorCode: ERROR_CODES.SEARCH_TIMEOUT,
          safeMessage: 'Request budget exhausted during business discovery',
          correlationId,
          durationMs: Date.now() - startTime,
        })
        return searchTimeoutResponse(correlationId, {
          partial: {
            geocode: {
              latitude: geocodeResult.latitude,
              longitude: geocodeResult.longitude,
              displayName: geocodeResult.displayName,
            },
          },
        })
      }
      throw err
    } finally {
      // Whatever happened, the discovery stage is over: cancel the providers
      // that are still working so nothing lingers behind the response.
      abortProviders()
    }

    const winner = race.winner

    // Per-provider contribution report. A provider that never settled was
    // cancelled when the race was decided; it contributed nothing.
    const providerStates: Record<string, ProviderState> = {}
    for (const source of ['OPENSTREETMAP', 'NOMINATIM_SEARCH'] as const) {
      const outcome = race.outcomes.find((o) => o.source === source)
      if (!outcome) {
        providerStates[source] = 'cancelled'
      } else if (outcome.error) {
        providerStates[source] = 'failed'
      } else if ((outcome.records?.length ?? 0) > 0) {
        providerStates[source] = 'contributed'
      } else {
        providerStates[source] = 'empty'
      }
    }
    const contributingProviders = Object.values(providerStates).filter(
      (state) => state === 'contributed',
    ).length

    if (!winner || !winner.records || winner.records.length === 0) {
      // Neither provider produced a business. Report the honest upstream
      // failure (502) with the resolved location so the UI keeps it.
      const overpassError = race.outcomes.find((o) => o.source === 'OPENSTREETMAP')?.error
      const nominatimError = race.outcomes.find((o) => o.source === 'NOMINATIM_SEARCH')?.error
      const safeMessage =
        overpassError?.message ||
        nominatimError?.message ||
        'No businesses found for this niche and location'

      logPersonalization({
        route: '/api/personalization/find-businesses',
        stage: 'discover',
        provider: 'OPENSTREETMAP',
        httpStatus: 502,
        safeErrorCode: overpassError
          ? ERROR_CODES.OVERPASS_ALL_MIRRORS_FAILED
          : ERROR_CODES.DISCOVERY_UPSTREAM_FAILED,
        safeMessage,
        correlationId,
        durationMs: Date.now() - startTime,
      })

      return serverErrorResponse(
        ALL_OVERPASS_FAILED_USER_MESSAGE,
        correlationId,
        overpassError
          ? ERROR_CODES.OVERPASS_ALL_MIRRORS_FAILED
          : ERROR_CODES.DISCOVERY_UPSTREAM_FAILED,
        {
          partial: {
            geocode: {
              latitude: geocodeResult.latitude,
              longitude: geocodeResult.longitude,
              displayName: geocodeResult.displayName,
            },
            providers: providerStates,
          },
        },
      )
    }

    // Deduplicate, classify ownership, exclude big-box chains by default, then
    // score and sort (classification needs the full batch of names, so it runs
    // at the route level — see processDiscoveryBatch above).
    const { enriched, stats } = processDiscoveryBatch(winner.records as any[], includeChains)

    // Limit results
    const limited = enriched.slice(0, limit)

    const durationMs = Date.now() - startTime

    // Cache results
    businessDiscoveryCache.set(cacheKey, limited, CACHE_TTL_MS)

    logPersonalization({
      route: '/api/personalization/find-businesses',
      stage: 'discover',
      provider: winner.source,
      httpStatus: 200,
      correlationId,
      durationMs,
    })

    // `partial` is present when exactly ONE provider contributed the
    // businesses: the answer is real and valid, but it came from a single
    // source, so the client (and the support log) can tell a degraded
    // answer from a full one.
    const partial =
      contributingProviders === 1
        ? {
            geocode: {
              latitude: geocodeResult.latitude,
              longitude: geocodeResult.longitude,
              displayName: geocodeResult.displayName,
            },
            providers: providerStates,
          }
        : undefined

    return NextResponse.json(
      {
        ok: true,
        query: { niche: mapping.label, location, radiusMiles: boundedRadius },
        count: limited.length,
        businesses: limited,
        stats,
        providerUsed: winner.source,
        durationMs,
        correlationId,
        ...(partial ? { partial } : {}),
      },
      { headers: { 'x-correlation-id': correlationId } },
    )
  } catch (err) {
    if (isBudgetExhausted(err)) {
      logPersonalization({
        route: '/api/personalization/find-businesses',
        stage: 'unhandled',
        provider: 'OPENSTREETMAP',
        httpStatus: 504,
        safeErrorCode: ERROR_CODES.SEARCH_TIMEOUT,
        safeMessage: 'Request budget exhausted',
        correlationId,
        durationMs: Date.now() - startTime,
      })
      return searchTimeoutResponse(correlationId)
    }
    const message = err instanceof Error ? err.message : 'Unknown error'
    // SSRF/networkSafety rejections are caller mistakes (400); everything else
    // here is unexpected and must stay generic (details go to the log only).
    const status = message.includes('not allowed') || message.includes('Private') ? 400 : 500
    const code = status >= 500 ? ERROR_CODES.UNEXPECTED_ERROR : ERROR_CODES.VALIDATION_ERROR
    logPersonalization({
      route: '/api/personalization/find-businesses',
      stage: 'unhandled',
      provider: 'OPENSTREETMAP',
      httpStatus: status,
      safeErrorCode: code,
      safeMessage: message,
      correlationId,
      durationMs: Date.now() - startTime,
    })
    if (status >= 500) {
      return NextResponse.json(
        {
          error: 'Unable to complete the business search. Please try again shortly.',
          code,
          correlationId,
        },
        { status, headers: { 'x-correlation-id': correlationId } },
      )
    }
    return clientErrorResponse(message, correlationId, code, status)
  }
}
