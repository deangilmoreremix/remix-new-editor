// @vitest-environment node
/**
 * Route-level tests for the Lead Finder Overpass → Nominatim search fallback.
 *
 * Fully offline and deterministic. Isolates
 * `app/api/personalization/find-businesses/route.ts` the same way
 * `findBusinessesRoute.test.ts` does: '../businessDiscovery/index' is mocked at
 * the module boundary (real niche lookups from the dependency-free
 * nicheMappings module), every network-touching export is a controllable mock.
 *
 * These tests pin the fallback contract:
 *  - every Overpass mirror failing → the Nominatim search endpoint is tried
 *  - a fallback success returns real businesses with providerUsed
 *    'NOMINATIM_SEARCH' (so the path is traceable, not silently identical)
 *  - both providers failing → honest 502 with actionable copy and NO
 *    fabricated businesses
 *  - a caller-shaped error (unsupported niche) does NOT silently become a
 *    Nominatim search
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from '../../../shims/next-server'

vi.mock('../personalizationLog', () => ({
  logPersonalization: vi.fn(),
  createCorrelationId: vi.fn(),
  sanitizeForLog: vi.fn((s: unknown) => s),
}))

vi.mock('../envValidation', () => ({
  validatePersonalizationEnv: vi.fn(),
}))

vi.mock('../../../lib/rateLimit', () => ({
  resolveRateLimitKey: (userId?: string | null, clientIp?: string | null) =>
    userId || clientIp || 'anon',
  rateLimit: vi.fn(() => ({ allowed: true, retryAfterMs: 60000 })),
  rateLimit429: vi.fn(() => new Response('rate limited', { status: 429 })),
}))

// vi.mock factories are hoisted, so the marker class must be created inside
// vi.hoisted() for the factory to reference it.
const mocks = vi.hoisted(() => {
  class AllOverpassProvidersFailedError extends Error {}
  return { AllOverpassProvidersFailedError }
})

vi.mock('../businessDiscovery/index', async () => {
  const nicheMappings = await import('../businessDiscovery/nicheMappings')
  return {
    getNicheMapping: nicheMappings.getNicheMapping,
    getSupportedNiches: nicheMappings.getSupportedNiches,
    geocodeLocation: vi.fn(),
    discoverBusinesses: vi.fn(),
    searchBusinessesViaNominatim: vi.fn(),
    NominatimSearchUnavailable: class NominatimSearchUnavailableMock extends Error {},
    AllOverpassProvidersFailed: mocks.AllOverpassProvidersFailedError,
    deduplicateBusinesses: vi.fn((items: any) => items),
    enrichBusinessRecord: vi.fn((record: any) => record),
    scoreAndSort: vi.fn((items: any) => items),
    // Ownership classification runs inside both the Overpass and the
    // Nominatim fallback path, so the mock must supply it.
    classifyRecords: vi.fn((items: any) => items),
    excludeNationalChains: vi.fn((items: any) => ({
      kept: items,
      excluded: [],
      unknownRetained: [],
    })),
    createCacheKey: vi.fn(
      (niche: string, location: string, radiusMiles: number) => `${niche}|${location}|${radiusMiles}`,
    ),
    businessDiscoveryCache: { get: vi.fn(), set: vi.fn() },
  }
})

import { POST } from '../../../app/api/personalization/find-businesses/route'
import {
  geocodeLocation,
  discoverBusinesses,
  searchBusinessesViaNominatim,
  NominatimSearchUnavailable,
  deduplicateBusinesses,
} from '../businessDiscovery/index'
import { createCorrelationId } from '../personalizationLog'

const NICHE = 'restaurants-food'
const LOCATION = 'Austin, TX'

function fallbackRecord(id: string) {
  return {
    id,
    name: `Fallback Business ${id}`,
    website: `https://business-${id}.example.com`,
    city: 'Austin',
    source: 'OPENSTREETMAP',
  }
}

function overpassRecord(id: string) {
  return {
    id,
    name: `Overpass Business ${id}`,
    source: 'OPENSTREETMAP',
  }
}

/** A promise the test controls, so provider ORDERING is deterministic. */
function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  let settled = false
  const promise = new Promise<T>((res, rej) => {
    resolve = (value: T) => {
      settled = true
      res(value)
    }
    reject = (reason?: unknown) => {
      settled = true
      rej(reason)
    }
  })
  return {
    promise,
    resolve,
    reject,
    get settled() {
      return settled
    },
  }
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
  vi.clearAllMocks()
  vi.mocked(createCorrelationId).mockReturnValue('test-correlation-id')
  vi.mocked(geocodeLocation).mockResolvedValue({
    latitude: 30.2672,
    longitude: -97.7431,
    displayName: 'Austin, Texas, USA',
  } as any)
  // Provider defaults. Every test overrides what it needs, so no test can
  // depend on an implementation another test left behind.
  vi.mocked(discoverBusinesses).mockReset()
  vi.mocked(discoverBusinesses).mockResolvedValue([overpassRecord('one')] as any)
  vi.mocked(searchBusinessesViaNominatim).mockReset()
  vi.mocked(searchBusinessesViaNominatim).mockResolvedValue([] as any)
  vi.mocked(deduplicateBusinesses).mockReset()
  vi.mocked(deduplicateBusinesses).mockImplementation((items: any) => items)
})

describe('Lead Finder fallback — every Overpass mirror down', () => {
  it('falls back to the Nominatim search endpoint and returns real businesses', async () => {
    vi.mocked(discoverBusinesses).mockRejectedValue(
      new mocks.AllOverpassProvidersFailedError('All Overpass providers failed: Overpass HTTP 502'),
    )
    vi.mocked(searchBusinessesViaNominatim).mockResolvedValue([
      fallbackRecord('a'),
      fallbackRecord('b'),
    ] as any)

    const res = await post({ niche: NICHE, location: LOCATION })
    expect(res.status).toBe(200)

    const body = await res.json()
    expect(body.ok).toBe(true)
    expect(body.count).toBe(2)
    expect(body.businesses).toHaveLength(2)
    expect(body.businesses[0].name).toBe('Fallback Business a')
    // The provider is traceable rather than silently identical to Overpass.
    expect(body.providerUsed).toBe('NOMINATIM_SEARCH')
    expect(body.cached).toBeUndefined()

    expect(searchBusinessesViaNominatim).toHaveBeenCalledTimes(1)
    expect(searchBusinessesViaNominatim).toHaveBeenCalledWith(
      expect.objectContaining({
        niche: NICHE,
        location: LOCATION,
        latitude: 30.2672,
        longitude: -97.7431,
      }),
    )
  })

  it('caches fallback results so a repeat search does not re-hit the provider', async () => {
    const { businessDiscoveryCache } = await import('../businessDiscovery/index')
    vi.mocked(discoverBusinesses).mockRejectedValue(new mocks.AllOverpassProvidersFailedError('down'))
    vi.mocked(searchBusinessesViaNominatim).mockResolvedValue([fallbackRecord('a')] as any)

    await post({ niche: NICHE, location: LOCATION })

    expect(businessDiscoveryCache.set).toHaveBeenCalledTimes(1)
  })

  it('passes the location string through so the fallback stays geo-scoped', async () => {
    vi.mocked(discoverBusinesses).mockRejectedValue(new mocks.AllOverpassProvidersFailedError('down'))
    vi.mocked(searchBusinessesViaNominatim).mockResolvedValue([fallbackRecord('a')] as any)

    await post({ niche: NICHE, location: LOCATION, radiusMiles: 25 })

    expect(searchBusinessesViaNominatim).toHaveBeenCalledWith(
      expect.objectContaining({ location: LOCATION, radiusMiles: 25 }),
    )
  })
})

describe('Lead Finder fallback — both providers fail', () => {
  it('returns an actionable 502 and never fabricates businesses', async () => {
    vi.mocked(discoverBusinesses).mockRejectedValue(new mocks.AllOverpassProvidersFailedError('down'))
    vi.mocked(searchBusinessesViaNominatim).mockRejectedValue(
      new (NominatimSearchUnavailable as any)('circuit open'),
    )

    const res = await post({ niche: NICHE, location: LOCATION })
    expect(res.status).toBe(502)

    const body = await res.json()
    expect(body.error).toMatch(/temporarily busy/i)
    expect(body.error).toMatch(/enter a business website manually/i)
    // Partial geocode is preserved so the UI keeps the resolved location.
    expect(body.partial.geocode.latitude).toBeCloseTo(30.2672)
    // No businesses are invented.
    expect(body.businesses).toBeUndefined()
  })

  it('returns 502 with actionable copy when the fallback finds nothing', async () => {
    vi.mocked(discoverBusinesses).mockRejectedValue(new mocks.AllOverpassProvidersFailedError('down'))
    vi.mocked(searchBusinessesViaNominatim).mockResolvedValue([] as any)

    const res = await post({ niche: NICHE, location: LOCATION })
    expect(res.status).toBe(502)

    const body = await res.json()
    expect(body.error).toMatch(/temporarily busy/i)
    expect(body.businesses).toBeUndefined()
  })
})

describe('Lead Finder fallback — non-Overpass failures do not fall back', () => {
  it('rejects an unsupported niche before any provider is contacted', async () => {
    vi.mocked(discoverBusinesses).mockRejectedValue(
      new Error('Unsupported niche: "not-a-niche". Supported niches: ecommerce, real-estate'),
    )

    const res = await post({ niche: 'not-a-niche', location: LOCATION })
    // Niche validation happens before discovery, so this is a caller error.
    expect(res.status).toBe(400)

    const body = await res.json()
    expect(body.error).toMatch(/Unsupported niche/i)
    expect(searchBusinessesViaNominatim).not.toHaveBeenCalled()
    expect(discoverBusinesses).not.toHaveBeenCalled()
  })

  it('uses the Overpass path when Overpass succeeds', async () => {
    vi.mocked(discoverBusinesses).mockResolvedValue([
      { id: 'osm-1', name: 'Overpass Business', source: 'OPENSTREETMAP' },
    ] as any)
    vi.mocked(searchBusinessesViaNominatim).mockResolvedValue([] as any)

    const res = await post({ niche: NICHE, location: LOCATION })
    expect(res.status).toBe(200)

    const body = await res.json()
    expect(body.providerUsed).toBe('OPENSTREETMAP')
    expect(body.businesses[0].name).toBe('Overpass Business')
    // The two providers run CONCURRENTLY (that is what keeps the request
    // inside the platform's function budget), so the Nominatim search IS
    // contacted even when Overpass answers. What matters is that the
    // Overpass result is the one that is returned.
    expect(searchBusinessesViaNominatim).toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// The race: the fallback must not wait for the Overpass provider
// ---------------------------------------------------------------------------

describe('Lead Finder fallback — the race is decided by the first real records', () => {
  it('returns the fallback result WITHOUT waiting for the Overpass provider to settle', async () => {
    // The Overpass provider never answers (the production incident: every
    // mirror hanging). The fallback must still answer.
    const overpass = deferred<any[]>()
    vi.mocked(discoverBusinesses).mockImplementation(() => overpass.promise as any)
    vi.mocked(searchBusinessesViaNominatim).mockResolvedValue([
      fallbackRecord('a'),
      fallbackRecord('b'),
    ] as any)

    const res = await post({ niche: NICHE, location: LOCATION })
    expect(res.status).toBe(200)

    const body = await res.json()
    expect(body.providerUsed).toBe('NOMINATIM_SEARCH')
    expect(body.count).toBe(2)
    expect(body.businesses[0].name).toBe('Fallback Business a')

    // The Overpass provider never settled, so the route demonstrably did not
    // wait for it. (An implementation that awaited it would burn the whole
    // request budget and answer 504 instead.)
    expect(overpass.settled).toBe(false)

    overpass.resolve([]) // release the pending promise
  })

  it('returns the fallback result even when it is THINNER than the caller asked for', async () => {
    // A thin answer from the fallback must not be held hostage by the
    // Overpass provider: the request budget is the scarce resource.
    const overpass = deferred<any[]>()
    vi.mocked(discoverBusinesses).mockImplementation(() => overpass.promise as any)
    vi.mocked(searchBusinessesViaNominatim).mockResolvedValue([fallbackRecord('a')] as any)

    const res = await post({ niche: NICHE, location: LOCATION, limit: 30 })
    expect(res.status).toBe(200)

    const body = await res.json()
    expect(body.providerUsed).toBe('NOMINATIM_SEARCH')
    expect(body.count).toBe(1)
    expect(overpass.settled).toBe(false)

    overpass.resolve([])
  })

  it('cancels the losing provider so no upstream work lingers behind the response', async () => {
    const overpass = deferred<any[]>()
    vi.mocked(discoverBusinesses).mockImplementation(() => overpass.promise as any)
    vi.mocked(searchBusinessesViaNominatim).mockResolvedValue([fallbackRecord('a')] as any)

    await post({ niche: NICHE, location: LOCATION })

    const overpassSignal: AbortSignal | undefined =
      vi.mocked(discoverBusinesses).mock.calls[0][0].signal
    const nominatimSignal: AbortSignal | undefined =
      vi.mocked(searchBusinessesViaNominatim).mock.calls[0][0].signal
    expect(overpassSignal).toBeDefined()
    expect(nominatimSignal).toBeDefined()
    // The race is decided: the remaining provider work is cancelled.
    expect(overpassSignal?.aborted).toBe(true)
    expect(nominatimSignal?.aborted).toBe(true)

    overpass.resolve([])
  })
})

// ---------------------------------------------------------------------------
// The geocode is computed once and reused
// ---------------------------------------------------------------------------

describe('Lead Finder fallback — the geocode is computed once', () => {
  it('geocodes exactly once and reuses the coordinates for both providers', async () => {
    await post({ niche: NICHE, location: LOCATION })

    expect(geocodeLocation).toHaveBeenCalledTimes(1)

    const overpassOptions = vi.mocked(discoverBusinesses).mock.calls[0][0]
    const nominatimOptions = vi.mocked(searchBusinessesViaNominatim).mock.calls[0][0]

    expect(overpassOptions.latitude).toBe(30.2672)
    expect(overpassOptions.longitude).toBe(-97.7431)
    expect(nominatimOptions.latitude).toBe(30.2672)
    expect(nominatimOptions.longitude).toBe(-97.7431)

    // The geocoder itself receives the request budget's abort signal.
    expect(geocodeLocation).toHaveBeenCalledWith(
      LOCATION,
      expect.objectContaining({ signal: expect.anything() }),
    )
  })
})

// ---------------------------------------------------------------------------
// A good result is never discarded because a sibling failed
// ---------------------------------------------------------------------------

describe('Lead Finder fallback — a sibling failure never discards a good result', () => {
  it('keeps the Nominatim result when the Overpass provider fails', async () => {
    vi.mocked(discoverBusinesses).mockRejectedValue(
      new mocks.AllOverpassProvidersFailedError('All Overpass providers failed: HTTP 502'),
    )
    vi.mocked(searchBusinessesViaNominatim).mockResolvedValue([
      fallbackRecord('a'),
      fallbackRecord('b'),
      fallbackRecord('c'),
    ] as any)

    const res = await post({ niche: NICHE, location: LOCATION })
    expect(res.status).toBe(200)

    const body = await res.json()
    expect(body.providerUsed).toBe('NOMINATIM_SEARCH')
    expect(body.count).toBe(3)
    expect(body.businesses.map((b: any) => b.name)).toEqual([
      'Fallback Business a',
      'Fallback Business b',
      'Fallback Business c',
    ])
  })

  it('keeps the Overpass result when the Nominatim search fails', async () => {
    vi.mocked(discoverBusinesses).mockResolvedValue([overpassRecord('x')] as any)
    vi.mocked(searchBusinessesViaNominatim).mockRejectedValue(
      new (NominatimSearchUnavailable as any)('Nominatim search HTTP 503'),
    )

    const res = await post({ niche: NICHE, location: LOCATION })
    expect(res.status).toBe(200)

    const body = await res.json()
    expect(body.providerUsed).toBe('OPENSTREETMAP')
    expect(body.businesses[0].name).toBe('Overpass Business x')
  })
})

// ---------------------------------------------------------------------------
// Partial results and the error contract
// ---------------------------------------------------------------------------

describe('Lead Finder fallback — partial results and the error contract', () => {
  it('carries `partial` when exactly one provider contributed the businesses', async () => {
    vi.mocked(discoverBusinesses).mockRejectedValue(
      new mocks.AllOverpassProvidersFailedError('down'),
    )
    vi.mocked(searchBusinessesViaNominatim).mockResolvedValue([fallbackRecord('a')] as any)

    const res = await post({ niche: NICHE, location: LOCATION })
    expect(res.status).toBe(200)

    const body = await res.json()
    expect(body.partial).toBeDefined()
    expect(body.partial.providers.NOMINATIM_SEARCH).toBe('contributed')
    // The resolved location travels with the partial result so the UI keeps
    // it in context.
    expect(body.partial.geocode.latitude).toBeCloseTo(30.2672)
  })

  it('answers every error path with a JSON body carrying a stable code and the correlationId', async () => {
    const cases: Array<{
      name: string
      arrange: () => void
      status: number
      code: string
    }> = [
      {
        name: 'missing niche',
        arrange: () => {},
        status: 400,
        code: 'MISSING_NICHE',
      },
      {
        name: 'missing location',
        arrange: () => {},
        status: 400,
        code: 'MISSING_LOCATION',
      },
      {
        name: 'location too long',
        arrange: () => {},
        status: 400,
        code: 'LOCATION_TOO_LONG',
      },
      {
        name: 'unsupported niche',
        arrange: () => {},
        status: 400,
        code: 'UNSUPPORTED_NICHE',
      },
      {
        name: 'geocode rejected (caller error)',
        arrange: () => {
          vi.mocked(geocodeLocation).mockRejectedValue(new Error('Location not found: Atlantis'))
        },
        status: 400,
        code: 'GEOCODE_FAILED',
      },
      {
        name: 'geocode upstream down',
        arrange: () => {
          vi.mocked(geocodeLocation).mockRejectedValue(
            new Error('Nominatim geocoding failed: HTTP 503'),
          )
        },
        status: 502,
        code: 'GEOCODE_UPSTREAM_FAILED',
      },
      {
        name: 'both discovery providers down',
        arrange: () => {
          vi.mocked(discoverBusinesses).mockRejectedValue(
            new mocks.AllOverpassProvidersFailedError('down'),
          )
          vi.mocked(searchBusinessesViaNominatim).mockRejectedValue(
            new (NominatimSearchUnavailable as any)('down'),
          )
        },
        status: 502,
        code: 'OVERPASS_ALL_MIRRORS_FAILED',
      },
      {
        name: 'request budget exhausted',
        arrange: () => {
          const abort = new Error('The operation was aborted')
          abort.name = 'AbortError'
          vi.mocked(geocodeLocation).mockRejectedValue(abort)
        },
        status: 504,
        code: 'SEARCH_TIMEOUT',
      },
    ]

    for (const testCase of cases) {
      vi.mocked(geocodeLocation).mockResolvedValue({
        latitude: 30.2672,
        longitude: -97.7431,
        displayName: 'Austin, Texas, USA',
      } as any)
      vi.mocked(discoverBusinesses).mockReset()
      vi.mocked(discoverBusinesses).mockResolvedValue([overpassRecord('one')] as any)
      vi.mocked(searchBusinessesViaNominatim).mockReset()
      vi.mocked(searchBusinessesViaNominatim).mockResolvedValue([] as any)
      testCase.arrange()

      const body: Record<string, unknown> =
        testCase.name === 'missing niche'
          ? { niche: '', location: LOCATION }
          : testCase.name === 'missing location'
            ? { niche: NICHE, location: '' }
            : testCase.name === 'location too long'
              ? { niche: NICHE, location: 'x'.repeat(201) }
              : testCase.name === 'unsupported niche'
                ? { niche: 'not-a-niche', location: LOCATION }
                : { niche: NICHE, location: LOCATION }

      const res = await post(body)
      expect(res.status, testCase.name).toBe(testCase.status)

      const json = await res.json()
      // A JSON body (never an HTML page), a stable code, and the id that
      // correlates the answer with the server-side log.
      expect(typeof json.error, testCase.name).toBe('string')
      expect(json.code, testCase.name).toBe(testCase.code)
      expect(json.correlationId, testCase.name).toBe('test-correlation-id')
      expect(res.headers.get('x-correlation-id'), testCase.name).toBe('test-correlation-id')
    }
  })

  it('answers 500 with a stable code and the correlationId when the pipeline throws', async () => {
    const { deduplicateBusinesses } = await import('../businessDiscovery/index')
    vi.mocked(deduplicateBusinesses).mockImplementation(() => {
      throw new Error('boom: internal detail')
    })

    const res = await post({ niche: NICHE, location: LOCATION })
    expect(res.status).toBe(500)

    const body = await res.json()
    expect(body.code).toBe('UNEXPECTED_ERROR')
    expect(body.correlationId).toBe('test-correlation-id')
    expect(body.error).not.toContain('boom')
  })
})

// ---------------------------------------------------------------------------
// The route must ALWAYS answer with JSON — it may never hang
// ---------------------------------------------------------------------------

describe('Lead Finder fallback — the route always answers with JSON', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('answers 504 with JSON (never hangs) when BOTH discovery providers never settle', async () => {
    // The production incident shape: every upstream is dead. The route must
    // fall back to its own request budget and answer with a JSON body instead
    // of letting the platform's HTML "Inactivity Timeout" page win.
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] })

    vi.mocked(discoverBusinesses).mockImplementation(() => new Promise<any[]>(() => {}))
    vi.mocked(searchBusinessesViaNominatim).mockImplementation(() => new Promise<any[]>(() => {}))

    const pending = post({ niche: NICHE, location: LOCATION })
    // Let the route reach the discovery stage, then burn the whole budget.
    // The clock is advanced in small steps so the route's own deadline timer
    // is registered before the clock passes it.
    for (let i = 0; i < 40; i += 1) {
      await vi.advanceTimersByTimeAsync(1_000)
    }

    const res = await pending
    expect(res.status).toBe(504)
    expect(res.headers.get('content-type')).toMatch(/application\/json/i)

    const body = await res.json()
    expect(body.code).toBe('SEARCH_TIMEOUT')
    expect(body.correlationId).toBe('test-correlation-id')
    expect(body.businesses).toBeUndefined()
    expect(body.ok).not.toBe(true)
  })

  it('answers 504 with JSON when the GEOFCODE never settles', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] })

    vi.mocked(geocodeLocation).mockImplementation(() => new Promise<any>(() => {}))

    const pending = post({ niche: NICHE, location: LOCATION })
    for (let i = 0; i < 40; i += 1) {
      await vi.advanceTimersByTimeAsync(1_000)
    }

    const res = await pending
    expect(res.status).toBe(504)
    expect(res.headers.get('content-type')).toMatch(/application\/json/i)

    const body = await res.json()
    expect(body.code).toBe('SEARCH_TIMEOUT')
    expect(body.correlationId).toBe('test-correlation-id')
  })
})

// ---------------------------------------------------------------------------
// Both providers are started before either settles
// ---------------------------------------------------------------------------

describe('Lead Finder fallback — both providers start concurrently', () => {
  it('contacts BOTH providers before either one settles', async () => {
    const overpass = deferred<any[]>()
    const nominatim = deferred<any[]>()
    vi.mocked(discoverBusinesses).mockImplementation(() => overpass.promise as any)
    vi.mocked(searchBusinessesViaNominatim).mockImplementation(() => nominatim.promise as any)

    const pending = post({ niche: NICHE, location: LOCATION })
    // Give the route a tick to issue both provider calls.
    await new Promise((resolve) => setTimeout(resolve, 0))

    // Both upstreams are already in flight — the request costs the fastest
    // one that has data, never the sum of both.
    expect(discoverBusinesses).toHaveBeenCalledTimes(1)
    expect(searchBusinessesViaNominatim).toHaveBeenCalledTimes(1)
    expect(overpass.settled).toBe(false)
    expect(nominatim.settled).toBe(false)

    nominatim.resolve([fallbackRecord('a')])
    const res = await pending
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.providerUsed).toBe('NOMINATIM_SEARCH')

    overpass.resolve([])
  })
})
