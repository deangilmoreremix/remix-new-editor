import { NextRequest, NextResponse } from '../../../../shims/next-server'
import { createLimiter } from '../../../../src/server/businessEnrichment/limit'
import { clientIpFromHeaders } from '../../../../src/server/clientIp'
import { createCorrelationId, logPersonalization } from '../../../../src/server/personalizationLog'
import { rateLimit, rateLimit429, resolveRateLimitKey } from '../../../../lib/rateLimit'
import { createStageDeadline, withDeadline, ROUTE_DEADLINE_MS } from '../../../../src/server/businessDiscovery/deadline'
import { enrichBusinessWebsite } from '../../../../src/server/businessEnrichment/enrich'
import { enrichmentCache } from '../../../../src/server/businessEnrichment/cache'
import { durableGet, durablePut } from '../../../../src/server/businessEnrichment/durableCache'
import { DomainThrottle } from '../../../../src/server/businessEnrichment/throttle'
import { CircuitBreaker } from '../../../../src/server/businessEnrichment/retry'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * Contact/website enrichment for businesses already found by the Business Finder.
 *
 * Techniques reimplemented in TypeScript, inspired by Scrapling (this route does NOT use the
 * Scrapling library). Each business is crawled politely (robots.txt, adaptive per-domain
 * throttle, SSRF-safe fetch on every hop). Every returned value carries sourceUrl, method and
 * confidence; nothing is inferred. Requests are chunked (MAX_BATCH) so each stays inside the
 * Netlify budget — the client enriches the rest with follow-up calls, no extra backend.
 */
const MAX_BATCH = 5
/** Hard cap on how many entries a request may list at all; only the first MAX_BATCH are fetched, the rest are echoed back as deferred. */
const MAX_LISTED = 200
const BATCH_CONCURRENCY = 3
const MAX_URL_LENGTH = 2048
const RATE_LIMIT_WINDOW_MS = 60_000
const RATE_LIMIT_MAX = 10
const ANON_RATE_LIMIT_MAX = 100

export async function POST(req: NextRequest) {
  const correlationId = createCorrelationId(req)
  const startedAt = Date.now()
  const key = resolveRateLimitKey(undefined, clientIpFromHeaders(req.headers))
  const limited = rateLimit(`enrich-business:${key}`, { windowMs: RATE_LIMIT_WINDOW_MS, max: key === 'anon' ? ANON_RATE_LIMIT_MAX : RATE_LIMIT_MAX })
  if (!limited.allowed) return rateLimit429(limited.retryAfterMs)

  const body = await req.json().catch(() => ({}))
  const raw: Array<{ id?: string; website?: string }> = Array.isArray(body?.businesses)
    ? body.businesses
    : typeof body?.websiteUrl === 'string' ? [{ website: body.websiteUrl }] : []
  if (raw.length > MAX_LISTED) return NextResponse.json({ error: `at most ${MAX_LISTED} businesses may be listed per request` }, { status: 400 })
  const items = raw
    .map((b) => ({ id: typeof b?.id === 'string' ? b.id.slice(0, 120) : undefined, website: typeof b?.website === 'string' ? b.website.trim() : '' }))
    .filter((b) => b.website)

  if (!items.length) return NextResponse.json({ error: 'websiteUrl or businesses[].website is required' }, { status: 400 })
  if (items.some((b) => b.website.length > MAX_URL_LENGTH)) return NextResponse.json({ error: `website must be at most ${MAX_URL_LENGTH} characters` }, { status: 400 })

  const batch = items.slice(0, MAX_BATCH)
  const deferred = items.slice(MAX_BATCH).map((b) => b.id ?? b.website)
  const deadline = createStageDeadline('enrich-business', ROUTE_DEADLINE_MS - 2_000)
  const throttle = new DomainThrottle() // shared: two businesses on one host are paced together
  const breaker = new CircuitBreaker()
  const gate = createLimiter(BATCH_CONCURRENCY)

  type Row =
    | { id?: string; website: string; ok: true; enrichment: Awaited<ReturnType<typeof enrichBusinessWebsite>> }
    | { id?: string; website: string; ok: false; error: string }
  // One slot per business, filled as each finishes, so a stalled site cannot hold back the ones that completed.
  const slots: Array<Row | undefined> = new Array(batch.length).fill(undefined)
  const work = Promise.all(batch.map((b, i) => gate(async () => {
    try {
      const cached = enrichmentCache.get(b.website)
      if (cached) { slots[i] = { id: b.id, website: b.website, ok: true, enrichment: cached }; return }
      // Second layer: the durable cache survives cold starts and is shared across instances (public data, 7-day TTL).
      // Best-effort and time-bounded: a miss, an error or a slow database simply means "crawl as before".
      const stored = await durableGet(b.website)
      if (stored) { enrichmentCache.set(b.website, stored); slots[i] = { id: b.id, website: b.website, ok: true, enrichment: stored }; return }
      const enrichment = await enrichBusinessWebsite(b.website, { throttle, breaker, signal: deadline.signal, maxPages: 4 })
      // Only a crawl that actually completed is worth keeping: a deadline abort or an unreachable site would
      // otherwise pin an empty result for a day.
      if (!deadline.signal.aborted && (enrichment.pagesVisited.length > 0 || enrichment.robots.status === 'disallow-all')) { enrichmentCache.set(b.website, enrichment); await durablePut(b.website, enrichment) }
      slots[i] = { id: b.id, website: b.website, ok: true, enrichment }
    } catch (err) {
      // SSRF rejections and other failures are reported per business, without internals.
      const msg = err instanceof Error ? err.message : 'failed'
      slots[i] = { id: b.id, website: b.website, ok: false, error: /not allowed|Private|blocked/i.test(msg) ? 'website not allowed' : 'could not be enriched' }
    }
  })))
  // The deadline settles the response even if a site stalls: finished businesses are returned, the rest are
  // reported as timed out, instead of the platform cutting off the whole request.
  await withDeadline(work, deadline).catch(() => undefined)
  const results: Row[] = batch.map((b, i) => slots[i] ?? { id: b.id, website: b.website, ok: false, error: 'timed out' })

  logPersonalization({ route: '/api/personalization/enrich-business', stage: 'enrich', httpStatus: 200, correlationId, durationMs: Date.now() - startedAt })
  return NextResponse.json(
    {
      ok: true,
      results,
      ...(deferred.length ? { deferred, message: `Only ${MAX_BATCH} businesses are enriched per request; send the deferred ones in a follow-up request.` } : {}),
      timedOut: deadline.expired(),
      durationMs: Date.now() - startedAt,
      correlationId,
    },
    { headers: { 'x-correlation-id': correlationId } },
  )
}
