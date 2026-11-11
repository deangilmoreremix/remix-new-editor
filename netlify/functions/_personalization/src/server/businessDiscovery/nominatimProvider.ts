/**
 * Nominatim geocoding provider for OpenStreetMap.
 *
 * Geocodes location strings into latitude/longitude coordinates.
 * Uses the public Nominatim API with proper rate limiting and user-agent.
 *
 * Budget: the request is paced through the shared Nominatim rate gate (so
 * the app-wide ~1 req/s policy holds) and bounded by REQUEST_TIMEOUT, so a
 * stalled geocoder can never eat the route's whole request budget.
 *
 * REQUEST_TIMEOUT is 12s because the public Nominatim instance answers a
 * geocode in well under a second when it is healthy, but degrades into the
 * 5-10s range while it is rate-limiting a burst of clients. A 6s ceiling
 * turned that transient back-pressure into a hard search failure (measured:
 * 3 of 4 sequential location searches answered 504 while the geocoder was
 * itself answering in ~1s). The route's budget still contains it — see
 * `src/server/businessDiscovery/__tests__/zz-lead-finder-request-budget.test.ts`.
 */

import type { GeocodeResult } from './types'
import { reserveNominatimStart } from './nominatimRateGate'

const NOMINATIM_BASE_URL = 'https://nominatim.openstreetmap.org'
const USER_AGENT = 'SmartVideoGO-AI/1.0 (https://go.smartvid.app)'
const REQUEST_TIMEOUT = 12_000

interface NominatimResponse {
  lat: string
  lon: string
  display_name: string
  boundingbox?: [string, string, string, string]
}

async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs = REQUEST_TIMEOUT,
  externalSignal?: AbortSignal,
): Promise<Response> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  const onExternalAbort = () => controller.abort()
  if (externalSignal) {
    if (externalSignal.aborted) controller.abort()
    else externalSignal.addEventListener('abort', onExternalAbort)
  }
  try {
    return await fetch(url, { ...options, signal: controller.signal })
  } finally {
    clearTimeout(timeout)
    externalSignal?.removeEventListener('abort', onExternalAbort)
  }
}

export interface GeocodeOptions {
  /** Cancels the request when the caller's budget is spent. */
  signal?: AbortSignal
}

export async function geocodeLocation(
  location: string,
  options: GeocodeOptions = {},
): Promise<GeocodeResult> {
  const trimmed = location.trim()
  if (!trimmed) {
    throw new Error('Location is required')
  }

  const url = new URL('/search', NOMINATIM_BASE_URL)
  url.searchParams.set('q', trimmed)
  url.searchParams.set('format', 'json')
  url.searchParams.set('limit', '1')
  url.searchParams.set('addressdetails', '1')

  // Paced through the shared gate so the app-wide Nominatim request rate
  // stays inside the public instance's ~1 req/s policy. The reservation is
  // abortable, so a request that is still queued when the stage budget is
  // spent releases its slot instead of waiting out the pacing interval.
  await reserveNominatimStart(options.signal)

  const response = await fetchWithTimeout(
    url.toString(),
    {
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'application/json',
      },
    },
    REQUEST_TIMEOUT,
    options.signal,
  )

  if (!response.ok) {
    throw new Error(`Nominatim geocoding failed: HTTP ${response.status}`)
  }

  const data: NominatimResponse[] = await response.json()

  if (!data || data.length === 0) {
    throw new Error(`Location not found: "${trimmed}"`)
  }

  const result = data[0]
  const latitude = parseFloat(result.lat)
  const longitude = parseFloat(result.lon)

  if (Number.isNaN(latitude) || Number.isNaN(longitude)) {
    throw new Error('Invalid coordinates returned from geocoding')
  }

  return {
    latitude,
    longitude,
    displayName: result.display_name,
    boundingBox: result.boundingbox?.map(Number) as [number, number, number, number] | undefined,
  }
}

/**
 * Test-only helper. Exposes the geocoder's timeout so tests can assert the
 * stage fits inside the route's request budget.
 */
export function __nominatimGeocodeBudgetForTests(): { requestTimeoutMs: number } {
  return { requestTimeoutMs: REQUEST_TIMEOUT }
}
