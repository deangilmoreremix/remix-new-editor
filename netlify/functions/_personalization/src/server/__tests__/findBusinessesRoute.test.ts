// @vitest-environment node
/**
 * Unit tests for app/api/personalization/find-businesses/route.ts.
 *
 * Fully offline and deterministic. Mocking/isolation approach:
 * - '../businessDiscovery/index' is mocked at the module boundary. The real
 *   getNicheMapping/getSupportedNiches are kept (re-exported from the
 *   dependency-free nicheMappings module) so niche-validation tests exercise
 *   the real supported list; every network-touching export (geocodeLocation,
 *   discoverBusinesses, deduplicateBusinesses,
 *   scoreAndSort, createCacheKey, businessDiscoveryCache) is a controllable
 *   mock.
 * - '../personalizationLog' and '../envValidation' are mocked.
 * - '../../../lib/rateLimit' lives at the repo-root lib/ directory and does NOT
 *   resolve under vitest (the @/lib/* alias points at /src/lib), so the
 *   limiter module is stubbed — the same idiom as
 *   tests/vfx-rate-limit-keying.vitest.test.ts. The stub re-implements the
 *   only two behaviors the route depends on (`userId || ip || 'anon'` key
 *   normalization and per-key counting) backed by a hoisted hits Map that the
 *   beforeEach reset clears, so in-process limiter state can never leak
 *   between tests or between route test files sharing a worker. The stub is
 *   spy-wrapped so tests can also assert exactly which key/max the route used.
 *
 * These tests live in src/server/__tests__/ rather than next to the route
 * because that is the existing convention for personalization route unit
 * tests (see downloadImageRoute.test.ts) and the only location matched by
 * this suite's vitest include patterns.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest, NextResponse } from '../../../shims/next-server'

vi.mock('../personalizationLog', () => ({
  logPersonalization: vi.fn(),
  createCorrelationId: vi.fn(),
  sanitizeForLog: vi.fn((s: unknown) => s),
}))

vi.mock('../envValidation', () => ({
  validatePersonalizationEnv: vi.fn(),
}))

// Hoisted entitlement mocks. vi.resetAllMocks() in beforeEach() would wipe
// `mockResolvedValue` set in a factory, so the mock is hoisted and the
// allow/deny return value is configured via the hoisted allow helper.
const entitlementMocks = vi.hoisted(() => ({
  allowed: true as boolean,
}))

vi.mock('../../../tests/stubs/apiRequireEntitlement', () => ({
  requireApiEntitlement: vi.fn(async () =>
    entitlementMocks.allowed ? { allowed: true } : { allowed: false, status: 403 }
  ),
  entitlementForbiddenResponse: vi.fn().mockReturnValue(
    new Response(JSON.stringify({ error: 'PAYMENT_REQUIRED' }), { status: 403 })
  ),
}))

// Rate-limiter stub. resolveRateLimitKey mirrors lib/rateLimit.ts
// (`userId || clientIp || 'anon'`); rateLimit/rateLimit429 are spies whose
// counting implementation is installed in beforeEach against a per-test
// reset Map (see the header comment).
const rateLimitMocks = vi.hoisted(() => ({
  hits: new Map<string, number>(),
  rateLimit: vi.fn(),
  rateLimit429: vi.fn(),
}))

vi.mock('../../../lib/rateLimit', () => ({
  resolveRateLimitKey: (userId?: string | null, clientIp?: string | null) =>
    userId || clientIp || 'anon',
  rateLimit: rateLimitMocks.rateLimit,
  rateLimit429: rateLimitMocks.rateLimit429,
}))

// The route is now gated by requireApiEntitlement, which pulls in the real
// server-only Clerk auth() and the Supabase-backed
// resolveSmartVideoAccessForUser. Stub both seams at the module boundary (the
// tests/proxy-routes.vitest.test.ts idiom) so the entitled path is exercised
// without a Clerk session or Supabase env; the entitlement-gate case flips
// resolveSmartVideoAccessForUser to hasSmartVideoGo:false to assert the 403.
vi.mock('../../../shims/clerk-server', () => ({
  auth: vi.fn(async () => ({ userId: 'test-user' })),
}))

vi.mock('../../../tests/stubs/resolveAccess', () => ({
  resolveSmartVideoAccessForUser: vi.fn(async () => ({ hasSmartVideoGo: true })),
}))

vi.mock('../businessDiscovery/index', async () => {
  // Real niche lookups come from the dependency-free nicheMappings module so
  // no part of the network graph (nominatim/overpass/research providers) is
  // ever loaded.
  const nicheMappings = await import('../businessDiscovery/nicheMappings')
  return {
    getNicheMapping: nicheMappings.getNicheMapping,
    getSupportedNiches: nicheMappings.getSupportedNiches,
    geocodeLocation: vi.fn(),
    discoverBusinesses: vi.fn(),
    // The route races the Overpass provider against the Nominatim business
    // search, so both are part of the mocked module surface. The Nominatim
    // search contributes no records here, which leaves the Overpass result
    // as the winner.
    searchBusinessesViaNominatim: vi.fn(async () => []),
    deduplicateBusinesses: vi.fn(),
    scoreAndSort: vi.fn(),
    // Ownership classification is part of the route's own pipeline, so the
    // mock must supply it or every success-path test fails with a 500.
    classifyRecords: vi.fn((records: unknown[]) => records),
    excludeNationalChains: vi.fn((records: unknown[]) => ({
      kept: records,
      excluded: [],
      unknownRetained: [],
    })),
    createCacheKey: vi.fn(),
    businessDiscoveryCache: { get: vi.fn(), set: vi.fn() },
  }
})

// Import after mocks are registered
import { POST } from '../../../app/api/personalization/find-businesses/route'
import { auth } from '../../../shims/clerk-server'
import { resolveSmartVideoAccessForUser } from '../../../tests/stubs/resolveAccess'
import {
  geocodeLocation,
  discoverBusinesses,
  deduplicateBusinesses,
  scoreAndSort,
  createCacheKey,
  businessDiscoveryCache,
  getSupportedNiches,
} from '../businessDiscovery/index'
import { logPersonalization, createCorrelationId } from '../personalizationLog'
import { validatePersonalizationEnv } from '../envValidation'

const NICHE = 'restaurants-food'
const LOCATION = 'Austin, TX'

function rawRecord(id: string) {
  return { id, name: `Business ${id}`, latitude: 30.26, longitude: -97.74 } as any
}

function post(body: unknown, headers: Record<string, string> = {}) {
  const req = new NextRequest('http://localhost/api/personalization/find-businesses', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  })
  return POST(req)
}

beforeEach(() => {
  vi.resetAllMocks()
  // Reset the limiter stub's per-key counters (the isolation mechanism).
  rateLimitMocks.hits.clear()
  // Default: every test in this file is a paid user. The free-user tests
  // flip entitlementMocks.allowed to false for the duration of one test.
  entitlementMocks.allowed = true

  // Default: an authenticated, entitled caller so the gate opens and every
  // pre-existing case exercises the handler's own logic.
  vi.mocked(auth).mockResolvedValue({ userId: 'test-user' } as any)
  vi.mocked(resolveSmartVideoAccessForUser).mockResolvedValue({ hasSmartVideoGo: true } as any)

  vi.mocked(createCorrelationId).mockReturnValue('test-correlation-id')
  vi.mocked(validatePersonalizationEnv).mockReturnValue({ valid: true, missingRequired: [] } as any)

  vi.mocked(geocodeLocation).mockResolvedValue({
    latitude: 30.2672,
    longitude: -97.7431,
    displayName: 'Austin, Texas, USA',
  } as any)
  vi.mocked(discoverBusinesses).mockResolvedValue([rawRecord('one'), rawRecord('two')] as any)
  vi.mocked(deduplicateBusinesses).mockImplementation((items: any) => items)
  vi.mocked(scoreAndSort).mockImplementation((items: any) => items)
  vi.mocked(createCacheKey).mockImplementation(
    (niche: string, location: string, radiusMiles: number) =>
      `${niche}|${location}|${radiusMiles}`,
  )
  vi.mocked(businessDiscoveryCache.get).mockReturnValue(null)

  // Counting limiter with the same allow/deny semantics as lib/rateLimit.ts:
  // the (max+1)-th hit inside the window is denied with a 60s retry-after.
  rateLimitMocks.rateLimit.mockImplementation((key: string, opts?: { max?: number }) => {
    const max = opts?.max ?? 10
    const count = (rateLimitMocks.hits.get(key) ?? 0) + 1
    rateLimitMocks.hits.set(key, count)
    if (count > max) return { allowed: false, remaining: 0, retryAfterMs: 60_000 }
    return { allowed: true, remaining: max - count, retryAfterMs: 0 }
  })
  rateLimitMocks.rateLimit429.mockImplementation((retryAfterMs: number) =>
    NextResponse.json(
      { error: 'Rate limit exceeded. Please wait before retrying.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil(retryAfterMs / 1000)) } },
    ),
  )
})

// ---------------------------------------------------------------------------
// 400 validation
// ---------------------------------------------------------------------------

describe('find-businesses route — validation 400s', () => {
  it('400 when niche is missing', async () => {
    const res = await post({ location: LOCATION })
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('niche is required')
    expect(geocodeLocation).not.toHaveBeenCalled()
  })

  it('400 when location is missing', async () => {
    const res = await post({ niche: NICHE })
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('location is required')
    expect(geocodeLocation).not.toHaveBeenCalled()
  })

  it('400 when location exceeds 200 characters', async () => {
    const res = await post({ niche: NICHE, location: 'x'.repeat(201) })
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('location must be at most 200 characters')
    expect(geocodeLocation).not.toHaveBeenCalled()
  })

  it('400 for an unsupported niche does NOT echo user input in the body (static message + supported list only)', async () => {
    const evilNiche = '<script>alert(1)</script>'
    const res = await post({ niche: evilNiche, location: LOCATION })
    expect(res.status).toBe(400)

    const body = await res.json()
    // No raw user input reflected back to the caller.
    expect(body.error).not.toContain('<script>')
    expect(body.error).not.toContain('alert')
    expect(body.error).not.toContain(evilNiche)
    // Static message listing every supported niche.
    for (const supported of getSupportedNiches()) {
      expect(body.error).toContain(supported)
    }

    // The server-side log keeps the input for support correlation.
    expect(logPersonalization).toHaveBeenCalledWith(
      expect.objectContaining({
        route: '/api/personalization/find-businesses',
        stage: 'validation',
        httpStatus: 400,
        safeErrorCode: 'UNSUPPORTED_NICHE',
        safeMessage: expect.stringContaining(evilNiche),
      }),
    )
    expect(geocodeLocation).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// No entitlement gate: find-businesses is free for the demo experience
// ---------------------------------------------------------------------------

describe('find-businesses route — no entitlement gate', () => {
  it('200 when the caller is authenticated but unentitled (free demo route)', async () => {
    vi.mocked(resolveSmartVideoAccessForUser).mockResolvedValue({ hasSmartVideoGo: false } as any)

    const res = await post({ niche: NICHE, location: LOCATION })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.ok).toBe(true)

    // Discovery machinery runs because there is no entitlement gate.
    expect(geocodeLocation).toHaveBeenCalled()
    expect(discoverBusinesses).toHaveBeenCalled()
  })

  it('200 when the caller has no session (free demo route, unauthenticated OK)', async () => {
    vi.mocked(auth).mockResolvedValue({ userId: null } as any)

    const res = await post({ niche: NICHE, location: LOCATION })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.ok).toBe(true)

    // Discovery machinery runs because there is no auth gate on this route.
    expect(geocodeLocation).toHaveBeenCalled()
    expect(discoverBusinesses).toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// radius / limit fallback + clamping
// ---------------------------------------------------------------------------

describe('find-businesses route — radius/limit bounds', () => {
  it('falls back to radius 15 for a non-numeric radius and limit 30 for a non-numeric limit', async () => {
    const res = await post({ niche: NICHE, location: LOCATION, radiusMiles: 'NaN', limit: 'many' })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.query.radiusMiles).toBe(15)
    expect(discoverBusinesses).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 90, radiusMiles: 15 }),
    )
  })

  it('clamps radius 9999 down to 50', async () => {
    const res = await post({ niche: NICHE, location: LOCATION, radiusMiles: 9999 })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.query.radiusMiles).toBe(50)
    expect(createCacheKey).toHaveBeenCalledWith(NICHE, LOCATION, 50)
  })

  it('clamps radius 0.4 up to 1', async () => {
    const res = await post({ niche: NICHE, location: LOCATION, radiusMiles: 0.4 })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.query.radiusMiles).toBe(1)
  })

  it('clamps limit 9999 down to 50 and limit 0 up to 1', async () => {
    const over = await post({ niche: NICHE, location: LOCATION, limit: 9999 })
    expect(over.status).toBe(200)
    expect(discoverBusinesses).toHaveBeenLastCalledWith(
      expect.objectContaining({ limit: 150 }),
    )

    const under = await post({ niche: NICHE, location: LOCATION, limit: 0 })
    expect(under.status).toBe(200)
    expect(discoverBusinesses).toHaveBeenLastCalledWith(
      expect.objectContaining({ limit: 3 }),
    )
  })
})

// ---------------------------------------------------------------------------
// 200 happy path + cache
// ---------------------------------------------------------------------------

describe('find-businesses route — success flow', () => {
  it('200 happy path runs geocode → discover → dedupe → score → enrich and returns businesses', async () => {
    const res = await post({ niche: NICHE, location: LOCATION })
    expect(res.status).toBe(200)

    const body = await res.json()
    expect(body.ok).toBe(true)
    expect(body.count).toBe(2)
    expect(body.businesses).toHaveLength(2)
    expect(body.providerUsed).toBe('OPENSTREETMAP')
    expect(body.query).toEqual({ niche: 'Restaurants / Food', location: LOCATION, radiusMiles: 15 })
    expect(body.cached).toBeUndefined()
    expect(typeof body.durationMs).toBe('number')

    // Full pipeline invoked in order against the mocked dependencies.
    // The geocoder receives the request budget's abort signal so a stalled
    // upstream is cancelled instead of lingering.
    expect(geocodeLocation).toHaveBeenCalledWith(
      LOCATION,
      expect.objectContaining({ signal: expect.anything() }),
    )
    expect(discoverBusinesses).toHaveBeenCalledWith(
      expect.objectContaining({
        niche: NICHE,
        latitude: 30.2672,
        longitude: -97.7431,
        radiusMiles: 15,
        limit: 90, // default limit 30 * 3 (extra headroom for dedupe)
      }),
    )
    expect(deduplicateBusinesses).toHaveBeenCalledTimes(1)
    expect(scoreAndSort).toHaveBeenCalledTimes(1)
    // Results are cached with the 1h TTL.
    expect(businessDiscoveryCache.set).toHaveBeenCalledWith(
      `${NICHE}|${LOCATION}|15`,
      expect.any(Array),
      60 * 60 * 1000,
    )
  })

  it('cache hit returns the cached businesses with cached: true and skips geocode/discover', async () => {
    const cached = [rawRecord('cached-1'), rawRecord('cached-2'), rawRecord('cached-3')]
    vi.mocked(businessDiscoveryCache.get).mockReturnValue(cached)

    const res = await post({ niche: NICHE, location: LOCATION })
    expect(res.status).toBe(200)

    const body = await res.json()
    expect(body.cached).toBe(true)
    expect(body.count).toBe(3)
    expect(body.businesses).toEqual(cached)
    expect(geocodeLocation).not.toHaveBeenCalled()
    expect(discoverBusinesses).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// Upstream (502) vs caller (400) errors
// ---------------------------------------------------------------------------

describe('find-businesses route — geocode failure mapping', () => {
  it('502 with GENERIC body + correlationId + x-correlation-id header when Nominatim returns HTTP 503', async () => {
    vi.mocked(geocodeLocation).mockRejectedValue(
      new Error('Nominatim geocoding failed: HTTP 503'),
    )

    const res = await post({ niche: NICHE, location: LOCATION })
    expect(res.status).toBe(502)

    const body = await res.json()
    expect(body.error).toBe('Unable to look up the location right now. Please try again shortly.')
    // No upstream internals leaked to the caller.
    expect(body.error).not.toMatch(/nominatim|503/i)
    expect(body.correlationId).toBe('test-correlation-id')
    expect(res.headers.get('x-correlation-id')).toBe('test-correlation-id')

    expect(logPersonalization).toHaveBeenCalledWith(
      expect.objectContaining({
        stage: 'geocode',
        httpStatus: 502,
        safeMessage: 'Nominatim geocoding failed: HTTP 503',
      }),
    )
  })

  it("400 (not 502) for 'Location not found: X'", async () => {
    vi.mocked(geocodeLocation).mockRejectedValue(new Error('Location not found: Atlantis'))

    const res = await post({ niche: NICHE, location: LOCATION })
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('Location not found: Atlantis')
  })
})

// ---------------------------------------------------------------------------
// Unexpected failure
// ---------------------------------------------------------------------------

describe('find-businesses route — unexpected failure', () => {
  it('500 with a generic body and correlationId when the pipeline throws', async () => {
    vi.mocked(deduplicateBusinesses).mockImplementation(() => {
      throw new Error('boom: internal detail')
    })

    const res = await post({ niche: NICHE, location: LOCATION })
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toBe('Unable to complete the business search. Please try again shortly.')
    expect(body.error).not.toContain('boom')
    expect(body.correlationId).toBe('test-correlation-id')
    expect(res.headers.get('x-correlation-id')).toBe('test-correlation-id')
  })
})

// ---------------------------------------------------------------------------
// Rate limiting: key derivation (x-real-ip first, LAST x-forwarded-for hop,
// anon fallback) and per-IP buckets
// ---------------------------------------------------------------------------

describe('find-businesses route — rate-limit key derivation', () => {
  it('prefers x-real-ip over the x-forwarded-for hops', async () => {
    await post({ niche: NICHE, location: LOCATION }, {
      'x-real-ip': '8.8.8.8',
      'x-forwarded-for': '1.2.3.4, 9.9.9.9',
    })
    expect(rateLimitMocks.rateLimit).toHaveBeenCalledWith('8.8.8.8', {
      windowMs: 60_000,
      max: 10,
    })
  })

  it('uses the LAST x-forwarded-for hop (the one appended by the nearest proxy), not the client-controlled first hop', async () => {
    await post({ niche: NICHE, location: LOCATION }, {
      'x-forwarded-for': '1.2.3.4, 203.0.113.7',
    })
    expect(rateLimitMocks.rateLimit).toHaveBeenCalledWith('203.0.113.7', {
      windowMs: 60_000,
      max: 10,
    })
  })

  it('still keys on the single hop when x-forwarded-for has one entry', async () => {
    await post({ niche: NICHE, location: LOCATION }, { 'x-forwarded-for': '203.0.113.8' })
    expect(rateLimitMocks.rateLimit).toHaveBeenCalledWith('203.0.113.8', {
      windowMs: 60_000,
      max: 10,
    })
  })

  it('rotating the client-controlled first XFF hop does NOT mint a fresh bucket', async () => {
    await post({ niche: NICHE, location: LOCATION }, { 'x-forwarded-for': '9.9.9.1, 203.0.113.5' })
    await post({ niche: NICHE, location: LOCATION }, { 'x-forwarded-for': '9.9.9.2, 203.0.113.5' })
    await post({ niche: NICHE, location: LOCATION }, { 'x-forwarded-for': '9.9.9.3, 203.0.113.5' })
    const keys = rateLimitMocks.rateLimit.mock.calls.map((c) => c[0])
    // Same proxy-appended bucket for all three spoofed first hops.
    expect(keys).toEqual(['203.0.113.5', '203.0.113.5', '203.0.113.5'])
  })

  it("falls back to the shared 'anon' bucket with a much higher max (100/min) when no proxy headers exist", async () => {
    // 11 anonymous requests all succeed: the shared bucket degrades
    // gracefully instead of every anonymous caller sharing 10/min.
    for (let i = 0; i < 11; i++) {
      const res = await post({ niche: NICHE, location: LOCATION })
      expect(res.status).toBe(200)
    }
    expect(rateLimitMocks.rateLimit).toHaveBeenCalledWith('anon', {
      windowMs: 60_000,
      max: 100,
    })
  })
})

describe('find-businesses route — rate limiting behavior', () => {
  it('429 with Retry-After after 10 requests for one IP, while a different x-real-ip is not limited', async () => {
    const ipA = { 'x-real-ip': '203.0.113.10' }
    for (let i = 0; i < 10; i++) {
      const res = await post({ niche: NICHE, location: LOCATION }, ipA)
      expect(res.status).toBe(200)
    }

    const blocked = await post({ niche: NICHE, location: LOCATION }, ipA)
    expect(blocked.status).toBe(429)
    expect(blocked.headers.get('retry-after')).toBe('60')
    const body = await blocked.json()
    expect(body.error).toMatch(/rate limit exceeded/i)
    expect(rateLimitMocks.rateLimit429).toHaveBeenCalledWith(60_000)

    // A different x-real-ip derives a different key → its own bucket.
    const otherIp = await post({ niche: NICHE, location: LOCATION }, {
      'x-real-ip': '198.51.100.99',
    })
    expect(otherIp.status).toBe(200)
  })

  it('429 answers with JSON carrying a stable code and the correlationId', async () => {
    // The rate limiter is an error path of this route, so it must obey the
    // same contract as every other error path: a JSON body a client can
    // branch on, plus the id that correlates the answer with the log.
    const ipA = { 'x-real-ip': '203.0.113.77' }
    for (let i = 0; i < 10; i += 1) {
      const res = await post({ niche: NICHE, location: LOCATION }, ipA)
      expect(res.status).toBe(200)
    }

    const blocked = await post({ niche: NICHE, location: LOCATION }, ipA)
    expect(blocked.status).toBe(429)
    expect(blocked.headers.get('content-type')).toMatch(/application\/json/i)
    expect(blocked.headers.get('retry-after')).toBe('60')
    expect(blocked.headers.get('x-correlation-id')).toBe('test-correlation-id')

    const body = await blocked.json()
    expect(body.error).toMatch(/rate limit exceeded/i)
    expect(body.code).toBe('RATE_LIMITED')
    expect(body.correlationId).toBe('test-correlation-id')
  })
})
