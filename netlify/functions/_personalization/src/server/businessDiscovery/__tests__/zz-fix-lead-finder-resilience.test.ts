// @vitest-environment node
/**
 * Resilience tests for the Free Lead Finder public path (Defect B, Phase 3).
 *
 * The previous incident: all three Overpass mirrors returned HTTP 502 and
 * the chained 30s × 3 mirrors × 2 retries produced ~180s of user-visible
 * latency before any error surfaced. These tests pin the resilience
 * properties the fix must preserve:
 *
 *   1. Per-mirror request timeout is bounded (PER_REQUEST_TIMEOUT_MS in
 *      overpassProvider.ts). A hung mirror cannot dominate the user-visible
 *      latency: the call returns well under the previous 30s-per-mirror
 *      ceiling even when every mirror hangs.
 *   2. Per-mirror circuit breaker opens a mirror for COOLDOWN_MS after
 *      FAILURE_THRESHOLD consecutive failures and short-circuits subsequent
 *      calls to that mirror, so one bad mirror cannot block the route.
 *   3. The public route returns a clear, actionable 502 (not a 502 leak of
 *      provider internals) when every Overpass mirror is unavailable, and
 *      surfaces the geocoded location as `partial.geocode` so the UI can
 *      keep it in context for the manual-entry fallback path. The response
 *      never fabricates businesses.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from '../../../../shims/next-server'

import {
  discoverBusinesses,
  AllOverpassProvidersFailed,
  __resetOverpassCircuitBreakerForTests,
  __overpassCircuitStateForTests,
} from '../overpassProvider'

// ── Mocks for the public route test ────────────────────────────────────────
// The route lives outside this file's import graph (it's an app/api
// handler) so we mock the bare minimum surface it touches.

vi.mock('../../personalizationLog', () => ({
  logPersonalization: vi.fn(),
  createCorrelationId: vi.fn(() => 'corr-test'),
  sanitizeForLog: vi.fn((s: unknown) => s),
}))

vi.mock('../../envValidation', () => ({
  validatePersonalizationEnv: vi.fn(),
}))

// Hoisted entitlement mocks. vi.clearAllMocks() in beforeEach() would wipe
// `mockResolvedValue` set in a factory, so the mock is hoisted and the
// allow/deny return value is configured via the hoisted allow helper.
const entitlementMocks = vi.hoisted(() => ({
  allowed: true as boolean,
}))

vi.mock('../../../../tests/stubs/apiRequireEntitlement', () => ({
  requireApiEntitlement: vi.fn(async () =>
    entitlementMocks.allowed ? { allowed: true } : { allowed: false, status: 403 }
  ),
  entitlementForbiddenResponse: vi.fn().mockReturnValue(
    new Response(JSON.stringify({ error: 'PAYMENT_REQUIRED' }), { status: 403 })
  ),
}))

const rateLimitMocks = vi.hoisted(() => ({
  rateLimit: vi.fn(() => ({ allowed: true, retryAfterMs: 0 })),
  rateLimit429: vi.fn(),
}))

vi.mock('../../../../lib/rateLimit', () => ({
  resolveRateLimitKey: (_userId?: string | null, clientIp?: string | null) =>
    clientIp || 'test-ip',
  rateLimit: rateLimitMocks.rateLimit,
  rateLimit429: rateLimitMocks.rateLimit429,
}))

vi.mock('../index', async () => {
  const nicheMappings = await import('../nicheMappings')
  // The route uses `err instanceof AllOverpassProvidersFailed` to detect the
  // "all mirrors failed" case; the class identity must be the SAME instance
  // the route sees, so we expose a class we can throw from tests and that
  // the route can detect.
  class MockAllOverpassProvidersFailed extends Error {
    readonly userMessage =
      'Local business search is temporarily busy. Please try again in a moment or enter a business website manually to continue.'
    constructor(message: string) {
      super(message)
      this.name = 'AllOverpassProvidersFailed'
    }
  }
  return {
    getNicheMapping: nicheMappings.getNicheMapping,
    getSupportedNiches: nicheMappings.getSupportedNiches,
    geocodeLocation: vi.fn(),
    discoverBusinesses: vi.fn(),
    AllOverpassProvidersFailed: MockAllOverpassProvidersFailed,
    deduplicateBusinesses: vi.fn(),
    enrichBusinessRecord: vi.fn(),
    scoreAndSort: vi.fn(),
    createCacheKey: vi.fn(),
    businessDiscoveryCache: { get: vi.fn(), set: vi.fn() },
    // The route races the Overpass provider against the Nominatim business
    // search. It contributes no records here, so the Overpass failure is the
    // only outcome the route has to report.
    searchBusinessesViaNominatim: vi.fn(async () => []),
  }
})

import { POST } from '../../../../app/api/personalization/find-businesses/route'
import { validatePersonalizationEnv } from '../../envValidation'
import { geocodeLocation, discoverBusinesses as discoverBusinessesMock, AllOverpassProvidersFailed as MockedAllOverpassProvidersFailed } from '../index'

const SAMPLE_GEOCODE = {
  latitude: 30.2672,
  longitude: -97.7431,
  displayName: 'Austin, Travis County, Texas, United States',
}

beforeEach(() => {
  __resetOverpassCircuitBreakerForTests()
  vi.clearAllMocks()
  vi.restoreAllMocks()
  ;(discoverBusinessesMock as unknown as ReturnType<typeof vi.fn>).mockReset()
  ;(geocodeLocation as unknown as ReturnType<typeof vi.fn>).mockReset()
  rateLimitMocks.rateLimit.mockReturnValue({ allowed: true, retryAfterMs: 0 })
  // Default: every test in this file is a paid user and env validation passes.
  entitlementMocks.allowed = true
  vi.mocked(validatePersonalizationEnv).mockReturnValue({ valid: true, missingRequired: [] } as any)
})

// ── 1. Per-mirror timeout is bounded ───────────────────────────────────────

describe('discoverBusinesses — per-mirror timeout is bounded', () => {
  it('a hanging mirror cannot dominate: discoverBusinesses fails within ~25s even when every mirror hangs', async () => {
    // A single fake mirror so the test bounds ONE mirror's timeout, not 3.
    const fakeEndpoint = 'https://fake.overpass.test/api/interpreter'
    // Mirror the AbortSignal-driven timeout behaviour of a real fetch that
    // never returns: when the provider's setTimeout fires
    // controller.abort(), the mock must reject with an AbortError so the
    // provider sees the bounded timeout actually elapsing instead of hanging
    // forever (which is what the production mirror outage did).
    vi.spyOn(globalThis, 'fetch').mockImplementation((_input: any, init?: any) => {
      return new Promise<Response>((_resolve, reject) => {
        const signal: AbortSignal | undefined = init?.signal
        if (signal) {
          if (signal.aborted) {
            reject(new DOMException('Aborted', 'AbortError'))
            return
          }
          signal.addEventListener('abort', () => {
            reject(new DOMException('Aborted', 'AbortError'))
          })
        }
        // No resolve: the mirror never responds.
      })
    })

    const t0 = Date.now()
    let caught: unknown
    try {
      await discoverBusinesses({
        niche: 'restaurants-food',
        latitude: 26.1,
        longitude: -80.1,
        radiusMiles: 10,
        __endpoints: [fakeEndpoint],
      })
    } catch (err) {
      caught = err
    }
    const elapsed = Date.now() - t0

    expect(caught).toBeInstanceOf(AllOverpassProvidersFailed)
    // PER_REQUEST_TIMEOUT_MS = 15_000, MAX_RETRIES = 2 → ~30s ceiling, plus
    // exponential backoff between retries (≤ ~1.2s for two attempts). The
    // previous broken implementation waited 30s × 2 = 60s per mirror.
    // Assert a generous ceiling (35s) that proves we are NOT in the old
    // 30s-per-mirror regime and a generous floor (well above 0) that
    // catches a regression to "instant failure".
    expect(elapsed).toBeGreaterThan(1000)
    expect(elapsed).toBeLessThan(35_000)
  }, 45_000)
})

// ── 1b. The mirrors are raced CONCURRENTLY, and the budget cancels them ───

describe('discoverBusinesses — the mirrors race concurrently', () => {
  it('has every mirror in flight at the same time, so one slow mirror cannot delay the others', async () => {
    const endpoints = [
      'https://m1.overpass.test/api/interpreter',
      'https://m2.overpass.test/api/interpreter',
      'https://m3.overpass.test/api/interpreter',
    ]

    let inFlight = 0
    let maxInFlight = 0
    const responders: Array<() => void> = []

    vi.spyOn(globalThis, 'fetch').mockImplementation(() => {
      inFlight += 1
      maxInFlight = Math.max(maxInFlight, inFlight)
      return new Promise<Response>((resolve) => {
        responders.push(() => {
          inFlight -= 1
          resolve({
            ok: true,
            status: 200,
            json: async () => ({
              elements: [
                {
                  type: 'node' as const,
                  id: 1,
                  lat: 26.1,
                  lon: -80.1,
                  tags: { amenity: 'restaurant', name: 'Concurrent Eats' },
                },
              ],
            }),
          } as any)
        })
      })
    })

    const pending = discoverBusinesses({
      niche: 'restaurants-food',
      latitude: 26.1,
      longitude: -80.1,
      radiusMiles: 10,
      __endpoints: endpoints,
    })

    // Let the provider issue its requests.
    await new Promise((resolve) => setTimeout(resolve, 0))

    // All three mirrors are queried at the same time: the stage costs the
    // SLOWEST mirror, never the sum of all of them.
    expect(maxInFlight).toBe(3)

    // One mirror answers with real elements → the stage resolves and the
    // losers are cancelled.
    responders[0]()

    const records = await pending
    expect(records).toHaveLength(1)
    expect(records[0].name).toBe('Concurrent Eats')
  })

  it('cancels the in-flight mirror request when the caller\'s budget is spent', async () => {
    const endpoint = 'https://slow.overpass.test/api/interpreter'
    let observedAbort = false

    vi.spyOn(globalThis, 'fetch').mockImplementation((_input: any, init: any) => {
      return new Promise<Response>((_resolve, reject) => {
        const signal: AbortSignal | undefined = init?.signal
        if (!signal) return
        if (signal.aborted) {
          observedAbort = true
          reject(new DOMException('Aborted', 'AbortError'))
          return
        }
        signal.addEventListener('abort', () => {
          observedAbort = true
          reject(new DOMException('Aborted', 'AbortError'))
        })
      })
    })

    const controller = new AbortController()
    const pending = discoverBusinesses({
      niche: 'restaurants-food',
      latitude: 26.1,
      longitude: -80.1,
      radiusMiles: 10,
      __endpoints: [endpoint],
      signal: controller.signal,
    })

    await new Promise((resolve) => setTimeout(resolve, 0))
    controller.abort()

    // The provider settles (it never leaves the caller hanging) …
    await expect(pending).rejects.toBeInstanceOf(AllOverpassProvidersFailed)
    // … and the upstream request really was cancelled.
    expect(observedAbort).toBe(true)
  })
})

// ── 2. Per-mirror circuit breaker ──────────────────────────────────────────
describe('discoverBusinesses — per-mirror circuit breaker', () => {
  it('opens a mirror after FAILURE_THRESHOLD consecutive failures and short-circuits subsequent calls', async () => {
    // All three mirrors fail synchronously. The provider records each
    // failure against its mirror; after FAILURE_THRESHOLD (3) consecutive
    // failures the mirror's circuit must open (openUntil > 0).
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('ECONNRESET'))

    const fakeEndpoints = [
      'https://fake-1.overpass.test/api/interpreter',
      'https://fake-2.overpass.test/api/interpreter',
      'https://fake-3.overpass.test/api/interpreter',
    ]

    // Threshold is 3 consecutive failures per mirror. Run discoverBusinesses
    // enough times that each mirror accumulates ≥ 3 failures.
    for (let i = 0; i < 3; i++) {
      await expect(
        discoverBusinesses({
          niche: 'restaurants-food',
          latitude: 26.1,
          longitude: -80.1,
          radiusMiles: 10,
          __endpoints: fakeEndpoints,
        }),
      ).rejects.toBeInstanceOf(AllOverpassProvidersFailed)
    }

    const state = __overpassCircuitStateForTests()
    expect(Object.keys(state).length).toBeGreaterThanOrEqual(3)
    for (const endpoint of fakeEndpoints) {
      const circuit = state[endpoint]
      expect(circuit, `circuit entry for ${endpoint}`).toBeDefined()
      expect(circuit.consecutiveFailures).toBeGreaterThanOrEqual(3)
      expect(circuit.openUntil).toBeGreaterThan(Date.now())
    }

    // After the breaker opens, the next call must short-circuit all mirrors
    // (no fetch attempts at all) and still surface the same typed error.
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    const beforeCount = fetchSpy.mock.calls.length
    await expect(
      discoverBusinesses({
        niche: 'restaurants-food',
        latitude: 26.1,
        longitude: -80.1,
        radiusMiles: 10,
        __endpoints: fakeEndpoints,
      }),
    ).rejects.toBeInstanceOf(AllOverpassProvidersFailed)
    const afterCount = fetchSpy.mock.calls.length
    expect(afterCount - beforeCount).toBe(0)
  }, 30_000)

  it('a successful call on a mirror resets that mirror\'s consecutive-failure counter', async () => {
    const goodEndpoint = 'https://good.overpass.test/api/interpreter'
    const badEndpoint = 'https://bad.overpass.test/api/interpreter'

    const goodOverpassResponse = {
      elements: [
        {
          type: 'node' as const,
          id: 1,
          lat: 26.1,
          lon: -80.1,
          tags: { amenity: 'restaurant', name: 'Good Eats' },
        },
      ],
    }

    let goodHits = 0
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = typeof input === 'string' ? input : (input as Request).url
      if (url === badEndpoint) {
        throw new Error('bad mirror down')
      }
      goodHits++
      return {
        ok: true,
        status: 200,
        json: async () => goodOverpassResponse,
      } as any
    })

    // First call: bad mirror only (all retries fail).
    await expect(
      discoverBusinesses({
        niche: 'restaurants-food',
        latitude: 26.1,
        longitude: -80.1,
        radiusMiles: 10,
        __endpoints: [badEndpoint],
      }),
    ).rejects.toBeInstanceOf(AllOverpassProvidersFailed)

    const badState = __overpassCircuitStateForTests()[badEndpoint]
    expect(badState.consecutiveFailures).toBeGreaterThanOrEqual(2)

    // Now hit ONLY the good mirror and verify the result comes back.
    const ok = await discoverBusinesses({
      niche: 'restaurants-food',
      latitude: 26.1,
      longitude: -80.1,
      radiusMiles: 10,
      __endpoints: [goodEndpoint],
    })
    expect(ok.length).toBe(1)
    expect(goodHits).toBeGreaterThan(0)
    // The good mirror's success path leaves no stale failure counter behind.
    const goodState = __overpassCircuitStateForTests()[goodEndpoint]
    if (goodState) {
      expect(goodState.consecutiveFailures).toBe(0)
      expect(goodState.openUntil).toBe(0)
    }
  })
})

// ── 3. Public route surfaces a clear 502 + partial geocode ─────────────────

describe('POST /api/personalization/find-businesses — all Overpass mirrors failed', () => {
  function post(body: unknown, headers: Record<string, string> = {}) {
    const req = new NextRequest('http://localhost/api/personalization/find-businesses', {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...headers },
      body: JSON.stringify(body),
    })
    return POST(req)
  }

  it('returns 502 with an actionable "temporarily busy" message and the geocoded location as partial', async () => {
    // Nominatim succeeds (geocode known); every Overpass mirror fails
    // (the production scenario from the incident).
    ;(geocodeLocation as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(SAMPLE_GEOCODE)
    ;(discoverBusinessesMock as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(
      new MockedAllOverpassProvidersFailed('All Overpass providers failed: HTTP 502'),
    )

    const res = await post({ niche: 'restaurants-food', location: 'Austin, TX' })

    // 502, not 500 — an upstream failure, not an internal error.
    expect(res.status).toBe(502)

    const json = await res.json()
    // The actionable user-facing message — provider internals MUST NOT leak.
    expect(json.error).toMatch(/temporarily busy/i)
    expect(json.error).toMatch(/enter a business website manually/i)
    // No provider internals (no "Overpass", "502", "ECONNRESET", etc.) leak
    // into the user-facing body.
    expect(json.error).not.toMatch(/Overpass/)
    expect(json.error).not.toMatch(/502/)
    expect(json.error).not.toMatch(/ECONNRESET/i)

    // Partial result hands the resolved coordinates back so the UI can keep
    // them in context for the manual-entry fallback path.
    expect(json.partial).toBeDefined()
    expect(json.partial.geocode).toEqual({
      latitude: SAMPLE_GEOCODE.latitude,
      longitude: SAMPLE_GEOCODE.longitude,
      displayName: SAMPLE_GEOCODE.displayName,
    })

    // The result MUST NOT include any fabricated businesses.
    expect(json.businesses).toBeUndefined()
    expect(json.ok).not.toBe(true)
  })
})