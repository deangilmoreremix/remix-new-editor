/**
 * Nominatim search provider — free business-LIST fallback that does NOT depend
 * on Overpass.
 *
 * Why this exists
 * ---------------
 * Lead Finder's primary business-list source is the Overpass API. All three
 * public Overpass mirrors returned HTTP 502 for an extended period, which made
 * the whole free Lead Finder unusable even though the Nominatim geocoder (a
 * separate OSM query path) stayed healthy. Later, the Overpass mirrors were
 * serving a 15-mile radius query in 27-39s — far past the request budget the
 * route runs in — so this provider had to become a first-class source rather
 * than a rarely-taken fallback.
 *
 * Nominatim's `/search` endpoint returns named POIs — with `extratags=1` it
 * carries the same contact/branding fields the Overpass path extracts
 * (website, phone, email, opening_hours, social links, address parts). Querying
 * it is therefore a legitimate, free, permitted fallback that keeps working when
 * every Overpass mirror is down.
 *
 * Design constraints (Lead Finder free path)
 * ------------------------------------------
 *  - No paid APIs, no customer API keys, no AI credits.
 *  - Nominatim's usage policy allows at most ~1 request/second, so every
 *    request START is paced through the shared rate gate
 *    (`nominatimRateGate.ts`) and the number of Nominatim calls per business
 *    search is capped (`MAX_QUERIES_PER_SEARCH`) to bound both latency and
 *    public quota use.
 *  - The queries of one search are issued CONCURRENTLY. The policy limits the
 *    request RATE, not the number of in-flight requests, so the gate still
 *    keeps consecutive starts ~1.1s apart while the responses overlap. The
 *    stage therefore costs the pacing interval plus the slowest single
 *    response instead of the sum of every response.
 *  - The stage is bounded by STAGE_DEADLINE_MS, and each request by
 *    PER_REQUEST_TIMEOUT_MS, so a degraded Nominatim can never consume the
 *    whole request budget.
 *  - A per-endpoint circuit breaker opens for COOLDOWN_MS after
 *    FAILS_BEFORE_COOLDOWN consecutive failures so a degradation of this
 *    provider short-circuits instead of adding latency to every search.
 *  - SSRF / private-address protections are inherited from the URL builder
 *    (we only ever build absolute https URLs to the fixed Nominatim host) and
 *    from `assertUrlSafe` on the business website when the record is later
 *    researched — no raw user-supplied URL is fetched here.
 *  - Results are NEVER fabricated: a record is only emitted when Nominatim
 *    returns a real named POI. When nothing is found the provider returns an
 *    empty array and the route reports an honest empty result.
 *  - Nominatim only indexes OSM data, so coverage is sparser than Overpass. The
 *    route tries both providers and uses whichever answers with real records.
 *
 * Query shape (measured, this is the whole point of the rewrite)
 * -------------------------------------------------------------
 * The query is the niche's own OSM TAG, scoped to the search area:
 *
 *     /search?q=[amenity=restaurant]&viewbox=<w,s,e,n>&bounded=1
 *
 * Two earlier shapes were measured and rejected:
 *
 *  1. `"<category>, Miami, Florida"` — Nominatim parses that as an ADDRESS
 *     query and returns 0-4 rows for almost every category.
 *  2. A natural-language category word (`q=cafe`) — Nominatim matches those
 *     against POI NAMES, so it only finds businesses whose name contains the
 *     word ("Airport Cafe"), and misses the rest of the category
 *     ("Starbucks"). Measured in Miami: `q=cafe` returned 50 rows, all of them
 *     named "... Cafe", and `q=coffee shop` returned 0 rows.
 *
 * Nominatim's tag syntax (`[key=value]`) matches the OSM TAG exactly, so the
 * fallback searches the SAME population as the Overpass query: measured in
 * Miami, `[amenity=cafe]` returns 50 rows including "Starbucks", and
 * `[shop=car_repair]` returns 42 rows in Austin where the word query `car`
 * returns 0.
 */

import type { BusinessDiscoveryRecord } from './types'
import { getNicheMapping, getSupportedNiches } from './nicheMappings'
import { reserveNominatimStart, __resetNominatimRateGateForTests } from './nominatimRateGate'
import { createStageDeadline, withDeadline, type StageDeadline } from './deadline'
import { extractWebsiteAndSocial } from './websiteTags'

const NOMINATIM_SEARCH_BASE_URL = 'https://nominatim.openstreetmap.org'
const USER_AGENT = 'SmartVideoGO-AI/1.0 (https://go.smartvid.app)'

/** Per-request timeout for a single Nominatim search call. */
const PER_REQUEST_TIMEOUT_MS = 4_000

/**
 * Hard budget for the whole Nominatim search stage (all of its queries).
 *
 * Sized so the stage always finishes inside the route's request budget: the
 * three queries start ~1.1s apart and each may take up to
 * PER_REQUEST_TIMEOUT_MS, so 2.2s + 4s = 6.2s < 7s.
 */
const STAGE_DEADLINE_MS = 7_000

/**
 * Nominatim's public instance is limited to ~1 request/second. Every call is
 * paced through the shared gate (see `nominatimRateGate.ts`) so a burst of
 * searches cannot exceed it.
 */

/** Cap on Nominatim calls issued for a single business search. */
const MAX_QUERIES_PER_SEARCH = 3

/** Results requested per Nominatim call (Nominatim's own maximum). */
const RESULT_LIMIT_PER_QUERY = 50

/** Per-endpoint circuit breaker thresholds for this provider. */
const FAILS_BEFORE_COOLDOWN = 2
const COOLDOWN_MS = 60_000

/** OSM lifecycle tags that mark a POI as not operational. */
const CLOSED_LIFECYCLE_TAGS = [
  'abandoned', 'disused', 'demolished', 'razed', 'removed',
  'closed', 'vacant', 'proposed', 'planned', 'construction',
]

const NAME_TAGS = ['name', 'name:en']
const PHONE_TAGS = ['phone', 'contact:phone', 'contact:mobile', 'mobile']
const EMAIL_TAGS = ['email', 'contact:email']

/**
 * Tag values that match every element of their key and therefore carry no
 * category meaning ("shop=yes" is "any shop"). They are useless as a search
 * term and are skipped — the Overpass query still uses them.
 */
const GENERIC_TAG_VALUES = new Set(['yes', 'all', 'any'])

/**
 * OSM tag migrations.
 *
 * The niche mappings still list the pre-2020 tagging of fitness and spa
 * venues; modern OSM data uses the `leisure=*` form. Nominatim's tag syntax
 * matches the exact key, so the deprecated key returns nothing at all
 * (measured in Austin: `[amenity=fitness_centre]` → 0 rows while
 * `[leisure=fitness_centre]` → 47 rows). The modern form is queried instead.
 */
const TAG_MIGRATIONS: Record<string, string> = {
  'amenity=fitness_centre': 'leisure=fitness_centre',
  'amenity=gym': 'leisure=fitness_centre',
  'amenity=spa': 'leisure=spa',
}

interface NominatimSearchResult {
  place_id?: number
  osm_type?: 'node' | 'way' | 'relation'
  osm_id?: number
  lat?: string
  lon?: string
  name?: string
  display_name?: string
  type?: string
  class?: string
  extratags?: Record<string, string>
  address?: Record<string, string>
}

// ── Circuit breaker (provider-scoped, module-internal) ───────────────────────

interface ProviderCircuit {
  consecutiveFailures: number
  openUntil: number
}

const circuitState: ProviderCircuit = { consecutiveFailures: 0, openUntil: 0 }

function isOpen(): boolean {
  if (circuitState.openUntil === 0) return false
  if (Date.now() >= circuitState.openUntil) {
    // Half-open: reset and allow a probe.
    circuitState.openUntil = 0
    circuitState.consecutiveFailures = 0
    return false
  }
  return true
}

function recordSuccess(): void {
  circuitState.consecutiveFailures = 0
  circuitState.openUntil = 0
}

function recordFailure(): void {
  circuitState.consecutiveFailures += 1
  if (circuitState.consecutiveFailures >= FAILS_BEFORE_COOLDOWN) {
    circuitState.openUntil = Date.now() + COOLDOWN_MS
  }
}

/**
 * Test-only helper. Resets the provider circuit breaker and the shared
 * request gate so a fresh test starts from a clean state. Not part of the
 * public API surface.
 */
export function __resetNominatimSearchCircuitForTests(): void {
  circuitState.consecutiveFailures = 0
  circuitState.openUntil = 0
  // The request gate is shared with the geocoder, so it is reset too.
  __resetNominatimRateGateForTests()
}

/**
 * Test-only helper. Returns a snapshot of the provider circuit state.
 * Not part of the public API surface.
 */
export function __nominatimSearchCircuitStateForTests(): {
  consecutiveFailures: number
  openUntil: number
} {
  return { ...circuitState }
}

/**
 * Test-only helper. Exposes the stage budgets so tests can assert the search
 * fits inside the route's request budget.
 */
export function __nominatimSearchBudgetForTests(): {
  perRequestTimeoutMs: number
  stageDeadlineMs: number
  maxQueriesPerSearch: number
} {
  return {
    perRequestTimeoutMs: PER_REQUEST_TIMEOUT_MS,
    stageDeadlineMs: STAGE_DEADLINE_MS,
    maxQueriesPerSearch: MAX_QUERIES_PER_SEARCH,
  }
}

async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs = PER_REQUEST_TIMEOUT_MS,
  externalSignals: AbortSignal[] = [],
): Promise<Response> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  const onExternalAbort = () => controller.abort()
  const listeners: Array<() => void> = []
  for (const signal of externalSignals) {
    if (signal.aborted) {
      controller.abort()
      continue
    }
    signal.addEventListener('abort', onExternalAbort)
    listeners.push(() => signal.removeEventListener('abort', onExternalAbort))
  }
  try {
    return await fetch(url, { ...options, signal: controller.signal })
  } finally {
    clearTimeout(timeout)
    for (const remove of listeners) remove()
  }
}

/**
 * Marker error thrown when this provider cannot produce results. Carries a
 * public-safe message so the route can surface actionable copy without leaking
 * provider internals.
 */
export class NominatimSearchUnavailable extends Error {
  readonly userMessage =
    'Local business search is temporarily busy. Please try again in a moment or enter a business website manually to continue.'
  constructor(message: string) {
    super(message)
    this.name = 'NominatimSearchUnavailable'
  }
}

function isClosed(tags: Record<string, string> | undefined): boolean {
  if (!tags) return false
  for (const tag of CLOSED_LIFECYCLE_TAGS) {
    const value = tags[tag]
    if (value === 'yes' || value === '1' || value === 'true') return true
  }
  return false
}

function extractFirst(tags: Record<string, string> | undefined, keys: string[]): string | undefined {
  if (!tags) return undefined
  for (const key of keys) {
    const value = tags[key]
    if (value && value.trim()) {
      return value.trim()
    }
  }
  return undefined
}

/**
 * Derives the ordered, de-duplicated list of OSM tag queries for a niche.
 *
 * The niche's own OSM tag tuples are the source, so the fallback searches
 * exactly the population the Overpass query would have matched, rather than
 * inventing categories. Each tuple is emitted as `key=value` (the form
 * Nominatim's tag syntax expects) after the OSM tag migrations are applied.
 *
 * Tag values that match every element of their key ("shop=yes") are skipped:
 * they name no category, so they are not searchable, but the Overpass query
 * still uses them.
 */
export function buildNicheSearchTerms(niche: string): string[] {
  const mapping = getNicheMapping(niche)
  if (!mapping) return []

  const terms: string[] = []
  const seen = new Set<string>()

  for (const [key, value] of mapping.tags) {
    if (GENERIC_TAG_VALUES.has(value)) continue

    const raw = `${key}=${value}`
    const term = TAG_MIGRATIONS[raw] ?? raw
    if (!term || seen.has(term)) continue

    seen.add(term)
    terms.push(term)
  }

  return terms
}

function normalizeResult(
  result: NominatimSearchResult,
  category: string,
  index: number,
): BusinessDiscoveryRecord | null {
  const tags = result.extratags || {}
  if (isClosed(tags)) return null

  const name = extractFirst(tags, NAME_TAGS) || (result.name && result.name.trim()) || undefined
  // Never fabricate a business: a POI without a usable name is not a lead.
  if (!name) return null

  const phone = extractFirst(tags, PHONE_TAGS)
  const email = extractFirst(tags, EMAIL_TAGS)
  const links = extractWebsiteAndSocial(tags)

  const address = result.address || {}
  const street = address.road || address.pedestrian || address.footway
  const houseNumber = address.house_number
  const city = address.city || address.town || address.village || address.suburb || address.municipality
  const region = address.state || address.province || address.county
  const postalCode = address.postcode
  const country = address.country

  const addressParts: string[] = []
  if (houseNumber && street) addressParts.push(`${houseNumber} ${street}`)
  else if (street) addressParts.push(street)
  const addressString = addressParts.length > 0 ? addressParts.join(', ') : undefined

  const latitude = result.lat != null ? parseFloat(result.lat) : undefined
  const longitude = result.lon != null ? parseFloat(result.lon) : undefined

  const osmType = result.osm_type
  const osmId = result.osm_id != null ? String(result.osm_id) : undefined

  return {
    id: osmType && osmId ? `osm-${osmType}-${osmId}` : `nominatim-search-${osmId || result.place_id || index}`,
    // Nominatim serves the same OpenStreetMap dataset as Overpass, so the
    // provenance stays OPENSTREETMAP; the route reports which provider produced
    // the result so the fallback is traceable in logs/UI.
    source: 'OPENSTREETMAP',
    osmType,
    osmId,
    name,
    category,
    address: addressString,
    city,
    region,
    postalCode,
    country,
    latitude: Number.isNaN(latitude as number) ? undefined : latitude,
    longitude: Number.isNaN(longitude as number) ? undefined : longitude,
    phone,
    email,
    website: links.website,
    facebook: links.facebook,
    instagram: links.instagram,
    whatsapp: links.whatsapp,
    youtube: links.youtube,
    linkedin: links.linkedin,
    tiktok: links.tiktok,
    openingHours: tags.opening_hours,
    operator: tags.operator,
    websiteStatus: links.websiteStatus,
    verificationStatus: 'unverified',
    rawSource: { ...tags, _nominatimType: result.type, _nominatimClass: result.class },
  }
}

/** Great-circle distance in miles between two coordinates. */
function distanceMiles(
  lat1: number, lon1: number, lat2: number, lon2: number,
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const earthRadiusMiles = 3958.8
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
  return 2 * earthRadiusMiles * Math.asin(Math.min(1, Math.sqrt(a)))
}

export interface NominatimSearchOptions {
  niche: string
  latitude: number
  longitude: number
  radiusMiles: number
  /**
   * The caller's location string.
   *
   * Accepted for API compatibility but NOT part of the query: appending it to
   * the query text made Nominatim parse the search as an address lookup and
   * return nothing. The search area is expressed with `viewbox`/`bounded`
   * instead.
   */
  location?: string
  limit?: number
  /**
   * Test-only override for the Nominatim base URL (e.g. a loopback server).
   * Not part of the public API surface — callers should not rely on it.
   */
  __baseUrl?: string
  /**
   * The caller's abort signal (the route's request budget).
   *
   * When it fires, the in-flight Nominatim requests AND the queued rate-gate
   * reservations are cancelled: a spent budget must cancel the upstream work
   * instead of letting it linger after the caller has been answered.
   */
  signal?: AbortSignal
}

/**
 * Builds the bounding box the search is scoped to, as Nominatim's
 * `viewbox` value (`<west>,<south>,<east>,<north>` — longitude first).
 */
function buildViewbox(
  latitude: number,
  longitude: number,
  radiusMiles: number,
): { west: number; south: number; east: number; north: number } {
  const earthRadiusMiles = 3958.8
  const radiusRad = radiusMiles / earthRadiusMiles
  const latRad = (latitude * Math.PI) / 180
  return {
    south: latitude - (radiusRad * 180) / Math.PI,
    north: latitude + (radiusRad * 180) / Math.PI,
    west: longitude - (radiusRad * 180) / (Math.PI * Math.cos(latRad)),
    east: longitude + (radiusRad * 180) / (Math.PI * Math.cos(latRad)),
  }
}

/** Outcome of one category query of a search. */
interface QueryOutcome {
  rows: NominatimSearchResult[]
  error?: Error
}

/**
 * Searches Nominatim for named businesses matching a niche near a location.
 *
 * Returns an empty array when Nominatim has nothing (honest empty result — no
 * fabrication). Throws `NominatimSearchUnavailable` only when the provider
 * itself could not be reached or returned a non-OK response, so the route can
 * distinguish "nothing found" from "provider down".
 */
export async function searchBusinessesViaNominatim(
  options: NominatimSearchOptions,
): Promise<BusinessDiscoveryRecord[]> {
  const { niche, latitude, longitude, radiusMiles, limit = 30, __baseUrl, signal } = options

  const mapping = getNicheMapping(niche)
  if (!mapping) {
    throw new Error(`Unsupported niche: "${niche}". Supported niches: ${getSupportedNiches().join(', ')}`)
  }

  const terms = buildNicheSearchTerms(niche)
  if (terms.length === 0) return []

  const baseUrl = __baseUrl || NOMINATIM_SEARCH_BASE_URL
  const viewbox = buildViewbox(latitude, longitude, radiusMiles)
  const viewboxParam = `${viewbox.west},${viewbox.south},${viewbox.east},${viewbox.north}`

  const deadline = createStageDeadline('nominatim-search', STAGE_DEADLINE_MS)
  // One signal cancels the whole stage: the stage budget expiring, the
  // caller's request budget expiring, or the stage finishing. A spent budget
  // must cancel the queued reservations and the in-flight requests instead of
  // leaving them running after the caller has been answered.
  const stageController = new AbortController()
  const abortStage = () => stageController.abort()
  if (signal) {
    if (signal.aborted) stageController.abort()
    else signal.addEventListener('abort', abortStage, { once: true })
  }
  deadline.signal.addEventListener('abort', abortStage, { once: true })
  const stageSignal = stageController.signal

  const seen = new Set<string>()
  let providerError: Error | null = null

  // One query per OSM tag, capped by the per-search query budget.
  const plannedTerms = terms.slice(0, MAX_QUERIES_PER_SEARCH)

  if (isOpen()) {
    throw new NominatimSearchUnavailable('Nominatim search circuit is open')
  }

  /**
   * Issues one tag query and returns its POIs. The request START is paced by
   * the shared rate gate; the request itself may overlap with the other
   * queries of this search.
   */
  const runQuery = async (term: string): Promise<NominatimSearchResult[]> => {
    const url = new URL('/search', baseUrl)
    // Nominatim's tag syntax: the query matches the OSM tag exactly, so the
    // fallback searches the same population as the Overpass query.
    url.searchParams.set('q', `[${term}]`)
    url.searchParams.set('format', 'jsonv2')
    url.searchParams.set('limit', String(RESULT_LIMIT_PER_QUERY))
    url.searchParams.set('addressdetails', '1')
    // extratags carries website/phone/email/opening_hours/social links.
    url.searchParams.set('extratags', '1')
    // Scope the category search to the requested area instead of appending the
    // location to the query text (which Nominatim parses as an address).
    url.searchParams.set('viewbox', viewboxParam)
    url.searchParams.set('bounded', '1')

    // The reservation is abortable, so a query that is still queued when the
    // budget is spent releases its slot instead of waiting out the pacing
    // interval.
    await reserveNominatimStart(stageSignal)

    const response = await fetchWithTimeout(
      url.toString(),
      { headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' } },
      PER_REQUEST_TIMEOUT_MS,
      [stageSignal],
    )

    if (!response.ok) {
      throw new Error(`Nominatim search HTTP ${response.status}`)
    }

    const data = await response.json()
    return Array.isArray(data) ? (data as NominatimSearchResult[]) : []
  }

  // Each query records its outcome as soon as it settles, so a stage timeout
  // never discards results that already arrived.
  const outcomes: Array<QueryOutcome | undefined> = new Array(plannedTerms.length)

  const tasks = plannedTerms.map(async (term, index) => {
    try {
      const rows = await runQuery(term)
      outcomes[index] = { rows }
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err))
      outcomes[index] = { rows: [], error }
      if (error.name !== 'AbortError') {
        providerError = providerError ?? error
      }
    }
  })

  try {
    // Hard backstop: the stage can never run past its budget.
    await withDeadline(Promise.all(tasks), deadline)
  } catch (err) {
    if (!(err instanceof Error) || err.name !== 'DeadlineExceededError') {
      providerError = providerError ?? (err instanceof Error ? err : new Error(String(err)))
    }
  } finally {
    // The stage is over: cancel whatever is still in flight (a query that
    // outlived the stage deadline, or a query the caller no longer needs).
    // Nothing may keep running after the stage returned.
    stageController.abort()
  }

  // Circuit breaker bookkeeping: one call per query, in query order.
  //
  // A CANCELLED query (the stage budget expired, or the caller already had
  // its answer and cancelled the loser) is NOT a provider failure: the
  // provider did not misbehave, it was stopped. Counting those as failures
  // would open the circuit after two healthy requests and silently disable
  // the fallback for the cooldown window.
  let firstError: Error | null = null
  for (const outcome of outcomes) {
    if (!outcome) continue
    if (outcome.error) {
      if (outcome.error.name === 'AbortError') continue
      recordFailure()
      if (!firstError) firstError = outcome.error
      continue
    }
    recordSuccess()
  }

  // Round-robin across the queries so the per-query row cap cannot starve the
  // other categories of the niche.
  const rowsByQuery = outcomes.map((outcome) => outcome?.rows ?? [])
  const maxRows = rowsByQuery.reduce((max, rows) => Math.max(max, rows.length), 0)

  const records: BusinessDiscoveryRecord[] = []

  for (let row = 0; row < maxRows && records.length < limit; row += 1) {
    for (const rows of rowsByQuery) {
      if (records.length >= limit) break
      const result = rows[row]
      if (!result) continue

      const record = normalizeResult(result, mapping.label, records.length + 1)
      if (!record) continue

      const key = `${record.name.toLowerCase()}|${(record.city || '').toLowerCase()}`
      if (seen.has(key)) continue

      // Keep the search geographically honest. The query is already bounded to
      // the requested area, but a POI can still report a coordinate outside
      // it (Nominatim occasionally returns a slightly wider match), so the
      // distance is verified. POIs without coordinates cannot be
      // distance-checked and are kept.
      if (
        record.latitude != null &&
        record.longitude != null &&
        Number.isFinite(latitude) &&
        Number.isFinite(longitude)
      ) {
        const within = distanceMiles(latitude, longitude, record.latitude, record.longitude)
        // Slack because the location phrase resolves to a metro area while
        // the customer's radius may target a single neighborhood.
        if (within > Math.max(radiusMiles * 2, 10)) continue
      }

      seen.add(key)
      records.push(record)
    }
  }

  if (records.length === 0 && (firstError || providerError)) {
    const cause = firstError ?? providerError!
    throw cause instanceof NominatimSearchUnavailable
      ? cause
      : new NominatimSearchUnavailable(`Nominatim search failed: ${cause.message}`)
  }

  if (records.length === 0 && deadline.expired()) {
    // The stage ran out of budget without producing anything. That is a
    // provider failure (the route must report it as such), not an honest
    // "nothing found".
    throw new NominatimSearchUnavailable('Nominatim search timed out')
  }

  return records
}
