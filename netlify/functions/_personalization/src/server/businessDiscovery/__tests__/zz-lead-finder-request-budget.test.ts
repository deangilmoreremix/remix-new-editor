// @vitest-environment node
/**
 * Request-budget regression tests for the Lead Finder public path.
 *
 * The production incident these pin: the free Lead Finder search answered with
 * the platform's HTML "Inactivity Timeout" page because the upstream chain
 * (geocode → Overpass mirrors → Nominatim fallback) could take longer than the
 * proxy's ~30s inactivity ceiling.
 *
 * The fix is a set of explicit budgets, one per stage, plus a route-level
 * backstop. Budgets are only useful if they are ASSERTED, so this file pins
 * the arithmetic:
 *
 *   - every provider stage fits inside the route's request budget;
 *   - the Nominatim search stage is long enough for the paced queries it
 *     issues (the ~1 req/s policy spaces the starts out);
 *   - the worst case of the whole chain stays under the platform ceiling, so
 *     the answer is always JSON and never the platform's HTML error page.
 */

import { describe, it, expect } from 'vitest'

import {
  ROUTE_DEADLINE_MS,
  PLATFORM_REQUEST_CEILING_MS,
} from '../deadline'
import { __overpassBudgetForTests } from '../overpassProvider'
import { __nominatimSearchBudgetForTests } from '../nominatimSearchProvider'
import { __nominatimGeocodeBudgetForTests } from '../nominatimProvider'
import { MIN_REQUEST_INTERVAL_MS } from '../nominatimRateGate'

describe('Lead Finder request budget', () => {
  it('the route budget is inside the platform ceiling', () => {
    expect(ROUTE_DEADLINE_MS).toBeLessThan(PLATFORM_REQUEST_CEILING_MS)
  })

  it('every provider stage fits inside the route budget', () => {
    const geocode = __nominatimGeocodeBudgetForTests().requestTimeoutMs
    const overpass = __overpassBudgetForTests().stageDeadlineMs
    const nominatim = __nominatimSearchBudgetForTests().stageDeadlineMs

    expect(geocode).toBeLessThan(ROUTE_DEADLINE_MS)
    expect(overpass).toBeLessThan(ROUTE_DEADLINE_MS)
    expect(nominatim).toBeLessThan(ROUTE_DEADLINE_MS)

    // The stages run in sequence (geocode, then the two discovery providers
    // concurrently), so their sum is the request's worst case.
    const worstCase = geocode + Math.max(overpass, nominatim)
    expect(worstCase).toBeLessThan(ROUTE_DEADLINE_MS)
    expect(worstCase).toBeLessThan(PLATFORM_REQUEST_CEILING_MS)
  })

  it('the Nominatim stage is long enough for its paced queries', () => {
    const { perRequestTimeoutMs, stageDeadlineMs, maxQueriesPerSearch } =
      __nominatimSearchBudgetForTests()

    // The queries of one search start ~MIN_REQUEST_INTERVAL_MS apart (the
    // ~1 req/s usage policy) and the slowest one may take the full
    // per-request timeout.
    const worstCase = (maxQueriesPerSearch - 1) * MIN_REQUEST_INTERVAL_MS + perRequestTimeoutMs
    expect(worstCase).toBeLessThanOrEqual(stageDeadlineMs)
  })

  it('the stage deadline — not the retry stack — is what bounds the Overpass stage', () => {
    const { perRequestTimeoutMs, stageDeadlineMs, maxRetries } = __overpassBudgetForTests()

    // The naive "timeout per attempt, every attempt" stack would be far past
    // the request budget; the stage deadline is what actually caps it.
    expect(maxRetries * perRequestTimeoutMs).toBeGreaterThan(stageDeadlineMs)
    expect(stageDeadlineMs).toBeLessThan(ROUTE_DEADLINE_MS)
  })
})
