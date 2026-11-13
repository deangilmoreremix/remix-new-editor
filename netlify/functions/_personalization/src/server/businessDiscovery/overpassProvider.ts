/**
 * Overpass API provider for OpenStreetMap business discovery.
 *
 * Queries Overpass to find businesses matching specific tags within a
 * geographic bounding box derived from a center point + radius.
 *
 * Resilience (Lead Finder free path, Phase 3):
 *  - Per-request timeout is bounded (PER_REQUEST_TIMEOUT_MS) so a single slow
 *    mirror cannot dominate the user-visible latency.
 *  - The whole stage is bounded by STAGE_DEADLINE_MS, so the provider can
 *    never outrun the request budget the public route works with.
 *  - The mirrors are RACED, not chained. The stage costs the SLOWEST mirror
 *    instead of the SUM of all of them: the previous implementation walked
 *    the mirror list one after another, so three slow mirrors cost
 *    3 × PER_REQUEST_TIMEOUT_MS × MAX_RETRIES (up to ~90s) before any result
 *    could exist — that is what produced the platform's HTML 504.
 *  - Retries use exponential backoff with jitter.
 *  - A per-mirror circuit breaker opens a mirror for COOLDOWN_MS after
 *    FAILURE_THRESHOLD consecutive failures and short-circuits subsequent
 *    calls to that mirror until the cooldown expires, so one bad mirror
 *    cannot block the route indefinitely.
 *  - When every mirror is unavailable, throws an `AllOverpassProvidersFailed`
 *    error carrying a public-safe message; the public route translates it
 *    to a clear "service temporarily busy — try again or enter a business
 *    website manually" 502 (no provider internals leak).
 */

import type { BusinessDiscoveryRecord, OverpassQueryOptions } from './types'
import { getNicheMapping, getSupportedNiches } from './nicheMappings'
import { createStageDeadline, withDeadline, type StageDeadline } from './deadline'
import { extractWebsiteAndSocial } from './websiteTags'

const DEFAULT_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://lz4.overpass-api.de/api/interpreter',
  'https://z.overpass-api.de/api/interpreter',
  // Independent public mirrors (not operated by the overpass-api.de cluster).
  // When the whole cluster 502s at once, these frequently stay healthy; trades
  // categories (craft=plumber/electrician/…) have no Nominatim-search
  // coverage, so a working Overpass mirror is the only way to reach them.
  'https://overpass.kumi.systems/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
]

const USER_AGENT = 'SmartVideoGO-AI/1.0 (https://go.smartvid.app)'
// Per-mirror request timeout. Bounded so a single stuck mirror cannot
// dominate (was 30s × 3 mirrors × 2 retries = up to ~180s).
const PER_REQUEST_TIMEOUT_MS = 6_000
/**
 * Hard budget for the whole Overpass stage, retries included.
 *
 * The mirrors race, so the stage normally costs one mirror's latency. This
 * budget is the backstop for the case where EVERY mirror is slow: it caps
 * the stage at 9s instead of letting the per-mirror timeouts and retries
 * stack up.
 */
const STAGE_DEADLINE_MS = 9_000
const MAX_RETRIES = 2
const RESULT_LIMIT = 50
// Exponential backoff base (ms). attempt N waits base * 2^N + jitter.
const BACKOFF_BASE_MS = 400
// Per-mirror circuit breaker thresholds.
const FAILURE_THRESHOLD = 3
const COOLDOWN_MS = 60_000

/**
 * Fetches with a bounded timeout.
 *
 * EVERY external signal cancels the request: the stage budget expiring, the
 * caller's request budget expiring, and the race being decided by another
 * mirror. A spent budget must cancel in-flight work instead of letting it
 * linger on a socket.
 */
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

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// ── Circuit breaker (per mirror, module-scoped) ──────────────────────────────
// State is module-internal so it survives across calls within a single Node
// process (mirroring the upstream Overpass mirror outages we saw). Tests
// reset it via `__resetOverpassCircuitBreakerForTests`.

interface MirrorCircuit {
  consecutiveFailures: number
  openUntil: number // epoch ms; while Date.now < openUntil the mirror is skipped
}

const circuitByEndpoint: Map<string, MirrorCircuit> = new Map()

function recordSuccess(endpoint: string): void {
  const c = circuitByEndpoint.get(endpoint)
  if (!c) return
  c.consecutiveFailures = 0
  c.openUntil = 0
}

function recordFailure(endpoint: string): void {
  const c = circuitByEndpoint.get(endpoint) || { consecutiveFailures: 0, openUntil: 0 }
  c.consecutiveFailures += 1
  if (c.consecutiveFailures >= FAILURE_THRESHOLD) {
    c.openUntil = Date.now() + COOLDOWN_MS
  }
  circuitByEndpoint.set(endpoint, c)
}

function isOpen(endpoint: string): boolean {
  const c = circuitByEndpoint.get(endpoint)
  if (!c) return false
  if (c.openUntil === 0) return false
  if (Date.now() >= c.openUntil) {
    // Cooldown expired: half-open — reset and allow one probe.
    c.openUntil = 0
    c.consecutiveFailures = 0
    return false
  }
  return true
}

/**
 * Marker error for "every Overpass mirror failed". The public route reads
 * `.userMessage` (a static, provider-internals-free copy) and translates it
 * to a 502. Carrying the marker on the error class lets the route stay
 * generic for unrelated throws without false positives.
 */
export class AllOverpassProvidersFailed extends Error {
  readonly userMessage =
    'Local business search is temporarily busy. Please try again in a moment or enter a business website manually to continue.'
  constructor(message: string) {
    super(message)
    this.name = 'AllOverpassProvidersFailed'
  }
}

/**
 * Test-only helper. Resets the per-mirror circuit breaker state so a fresh
 * test starts with all mirrors available. Not part of the public API.
 */
export function __resetOverpassCircuitBreakerForTests(): void {
  circuitByEndpoint.clear()
}

/**
 * Test-only helper. Returns a shallow snapshot of the per-mirror circuit
 * state (failures + openUntil epoch). Not part of the public API.
 */
export function __overpassCircuitStateForTests(): Record<string, { consecutiveFailures: number; openUntil: number }> {
  const out: Record<string, { consecutiveFailures: number; openUntil: number }> = {}
  for (const [endpoint, c] of circuitByEndpoint.entries()) {
    out[endpoint] = { consecutiveFailures: c.consecutiveFailures, openUntil: c.openUntil }
  }
  return out
}

/**
 * Test-only helper. Exposes the stage budgets so tests can assert that the
 * provider's worst case fits inside the route's request budget.
 */
export function __overpassBudgetForTests(): {
  perRequestTimeoutMs: number
  stageDeadlineMs: number
  maxRetries: number
} {
  return {
    perRequestTimeoutMs: PER_REQUEST_TIMEOUT_MS,
    stageDeadlineMs: STAGE_DEADLINE_MS,
    maxRetries: MAX_RETRIES,
  }
}

// OSM tags that indicate a business is closed or not operational.
const CLOSED_LIFEcycle_TAGS = [
  'abandoned',
  'disused',
  'demolished',
  'razed',
  'removed',
  'closed',
  'vacant',
  'proposed',
  'planned',
  'construction',
]

// Tags to extract from OSM elements.
const NAME_TAGS = ['name', 'name:en']
const PHONE_TAGS = ['phone', 'contact:phone', 'contact:mobile', 'mobile']
const EMAIL_TAGS = ['email', 'contact:email']
const ADDRESS_TAGS: Record<string, string> = {
  addr: 'address',
  'addr:street': 'street',
  'addr:city': 'city',
  'addr:state': 'region',
  'addr:postcode': 'postalCode',
  'addr:country': 'country',
}
// Website/social tags are parsed by extractWebsiteAndSocial (./websiteTags),
// which keeps social profiles out of the website field.
// Ownership hints. `brand` is the primary OSM franchise/chain tag; `owner` and
// `contact:person` are weaker ownership hints kept in the same field so
// classifyOwnership can use them as evidence (they are not strictly brands,
// so an unmatched value classifies as `unknown`, never as a chain).
// Wikidata-style tags (brand:wikidata etc.) are deliberately ignored.
const BRAND_TAGS = ['brand', 'owner', 'contact:person']

interface OverpassElement {
  type: 'node' | 'way' | 'relation'
  id: number
  tags?: Record<string, string>
  lat?: number
  lon?: number
}

interface OverpassResult {
  elements: OverpassElement[]
}

/**
 * Build the Overpass QL query for a niche's tag tuples.
 *
 * Each tuple becomes its OWN selector and the selectors are OR'd by the
 * surrounding union block. Overpass ANDs filters inside a single selector, so
 * the tuples must never be merged into one filter list.
 *
 * The previous implementation grouped the tuples by key and joined them into a
 * single filter chain, which produced e.g.
 *
 *   node["office"~"^(estate_agent|insurance)$"]["shop"="real_estate"](bbox)
 *
 * — an element carrying BOTH an office and a shop tag. No real business does
 * that, so every niche that spans more than one tag key (real-estate,
 * restaurants-food, ecommerce, beauty, wellness-fitness, …) returned zero
 * results and Lead Finder searches came back empty. See the regression test in
 * `src/server/businessDiscovery/__tests__/overpassQuery.test.ts`.
 */
export function buildOverpassQuery(options: OverpassQueryOptions): string {
  const { south, west, north, east, tags, limit = RESULT_LIMIT } = options

  const bbox = `(${south},${west},${north},${east})`

  // Dedupe: a niche may list the same tuple twice (e.g. `spa` in both beauty
  // and wellness), and repeating a selector only duplicates rows.
  const selectors = Array.from(
    new Set(tags.map(([key, value]) => `["${key}"="${value.replace(/"/g, '\\"')}"]`)),
  )

  if (selectors.length === 0) {
    return `[out:json][timeout:25];();out body ${limit};`
  }

  const parts: string[] = []
  for (const selector of selectors) {
    parts.push(`node${selector}${bbox};`)
    parts.push(`way${selector}${bbox};`)
    parts.push(`relation${selector}${bbox};`)
  }

  // The trailing `(._;>;)` expands each way/relation into its member nodes so
  // the normalizer sees real coordinates instead of only a way id.
  return `[out:json][timeout:25];(${parts.join('')}(._;>;););out body ${limit};`
}

function isClosed(tags: Record<string, string> | undefined): boolean {
  if (!tags) return false

  for (const tag of CLOSED_LIFEcycle_TAGS) {
    const value = tags[tag]
    if (value === 'yes' || value === '1' || value === 'true') {
      return true
    }
  }

  // Check for lifecycle prefixes
  for (const key of Object.keys(tags)) {
    for (const closedTag of CLOSED_LIFEcycle_TAGS) {
      if (key.startsWith(`${closedTag}:`) && (tags[key] === 'yes' || tags[key] === '1')) {
        return true
      }
    }
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
 * Normalizes one OSM element into a business record.
 *
 * Returns `null` when the element cannot be a lead. An element without a
 * name is NOT a business as far as the Lead Finder is concerned: emitting a
 * placeholder ("Unnamed Business") would put a fabricated name in front of the
 * user, which is exactly what the "no fabrication" contract forbids. The
 * Nominatim fallback provider applies the same rule.
 */
function normalizeElement(
  element: OverpassElement,
  category: string,
): BusinessDiscoveryRecord | null {
  const tags = element.tags || {}

  const name = extractFirst(tags, NAME_TAGS)
  // Never fabricate a business: a POI without a usable name is not a lead.
  if (!name) return null
  const phone = extractFirst(tags, PHONE_TAGS)
  const email = extractFirst(tags, EMAIL_TAGS)

  const links = extractWebsiteAndSocial(tags)

  const addressParts: string[] = []
  let city: string | undefined
  let region: string | undefined
  let postalCode: string | undefined
  let country: string | undefined

  for (const [osmKey, displayKey] of Object.entries(ADDRESS_TAGS)) {
    const value = tags[osmKey]
    if (value && value.trim()) {
      if (displayKey === 'address') {
        addressParts.push(value.trim())
      } else if (displayKey === 'city') {
        city = value.trim()
      } else if (displayKey === 'region') {
        region = value.trim()
      } else if (displayKey === 'postalCode') {
        postalCode = value.trim()
      } else if (displayKey === 'country') {
        country = value.trim()
      }
    }
  }

  const address = addressParts.join(', ') || undefined

  const osmType = element.type as 'node' | 'way' | 'relation'
  const osmId = String(element.id)

  return {
    id: `osm-${osmType}-${osmId}`,
    source: 'OPENSTREETMAP',
    osmType,
    osmId,
    name,
    category,
    address,
    city,
    region,
    postalCode,
    country,
    latitude: element.lat,
    longitude: element.lon,
    phone,
    email,
    website: links.website,
    facebook: links.facebook,
    instagram: links.instagram,
    whatsapp: links.whatsapp,
    youtube: links.youtube,
    linkedin: links.linkedin,
    tiktok: links.tiktok,
    openingHours: tags['opening_hours'],
    operator: tags['operator'],
    brand: extractFirst(tags, BRAND_TAGS),
    websiteStatus: links.websiteStatus,
    verificationStatus: 'unverified',
    rawSource: tags,
  }
}

function buildBoundingBox(
  latitude: number,
  longitude: number,
  radiusMiles: number,
): { south: number; west: number; north: number; east: number } {
  // Approximate conversion: 1 degree latitude ≈ 69 miles
  // 1 degree longitude ≈ 69 * cos(latitude) miles
  const earthRadiusMiles = 3958.8
  const radiusRad = radiusMiles / earthRadiusMiles

  const latRad = (latitude * Math.PI) / 180
  const north = latitude + (radiusRad * 180) / Math.PI
  const south = latitude - (radiusRad * 180) / Math.PI
  const east = longitude + (radiusRad * 180) / (Math.PI * Math.cos(latRad))
  const west = longitude - (radiusRad * 180) / (Math.PI * Math.cos(latRad))

  return { south, west, north, east }
}

export interface DiscoverBusinessesOptions {
  niche: string
  latitude: number
  longitude: number
  radiusMiles: number
  limit?: number
  /**
   * The caller's abort signal (the route's request budget).
   *
   * When it fires, every in-flight mirror request is cancelled: a spent
   * budget must cancel the upstream work instead of letting it linger on a
   * socket after the caller has already been answered.
   */
  signal?: AbortSignal
  /**
   * Test/operator override. Allows injecting a custom list of Overpass
   * mirrors (e.g. a loopback URL in tests). Defaults to the public mirrors.
   * Not part of the public API surface — callers should not rely on it.
   */
  __endpoints?: string[]
}

/**
 * Runs one mirror's request loop (with retries) and resolves with its
 * Overpass payload, or rejects with the last error it saw.
 *
 * A mirror that is cancelled because ANOTHER mirror already won the race
 * must NOT be recorded as a failure: it did not misbehave, it simply lost.
 * `raceSignal` distinguishes the two cases.
 */
async function attemptMirror(
  endpoint: string,
  query: string,
  signals: AbortSignal[],
  raceSignal: AbortSignal,
  deadline: StageDeadline,
): Promise<OverpassResult> {
  let lastError: Error | null = null

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    if (deadline.expired()) break

    const budgetLeft = deadline.remaining()
    if (budgetLeft <= 0) break

    try {
      const response = await fetchWithTimeout(
        endpoint,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'User-Agent': USER_AGENT,
          },
          body: `data=${encodeURIComponent(query)}`,
        },
        Math.min(PER_REQUEST_TIMEOUT_MS, budgetLeft),
        signals,
      )

      if (!response.ok) {
        throw new Error(`Overpass HTTP ${response.status}`)
      }

      const result = (await response.json()) as OverpassResult
      recordSuccess(endpoint)
      return result
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err))

      // The race was decided elsewhere (or the stage budget is spent, or the
      // caller's budget expired): this mirror did not fail, it was cancelled.
      // Do not poison the circuit breaker with a loss.
      if (raceSignal.aborted || deadline.expired() || signals.some((s) => s.aborted)) {
        throw lastError
      }

      recordFailure(endpoint)

      // Exponential backoff with jitter between retries on the SAME mirror,
      // never sleeping past the stage budget.
      if (attempt < MAX_RETRIES - 1) {
        const backoff = BACKOFF_BASE_MS * Math.pow(2, attempt) + Math.floor(Math.random() * 100)
        const sleepMs = Math.min(backoff, deadline.remaining())
        if (sleepMs > 0) await sleep(sleepMs)
      }
    }
  }

  throw lastError ?? new Error(`Overpass mirror failed: ${endpoint}`)
}

/**
 * Turns a rejection into an error that names what actually went wrong.
 *
 * The individual mirror errors ("Overpass HTTP 502", "fetch failed", …) are
 * what the route and the logs need, so they are flattened back into the
 * message instead of the useless "All promises were rejected".
 */
function describeMirrorFailures(err: unknown): Error {
  if (err instanceof AggregateError && err.errors.length > 0) {
    const messages = err.errors
      .map((e) => (e instanceof Error ? e.message : String(e)))
      .filter(Boolean)
    if (messages.length > 0) return new Error(messages.join('; '))
  }
  return err instanceof Error ? err : new Error(String(err))
}

export async function discoverBusinesses(options: DiscoverBusinessesOptions): Promise<BusinessDiscoveryRecord[]> {
  const { niche, latitude, longitude, radiusMiles, limit = 30, __endpoints, signal } = options

  const mapping = getNicheMapping(niche)
  if (!mapping) {
    throw new Error(`Unsupported niche: "${niche}". Supported niches: ${getSupportedNiches().join(', ')}`)
  }

  const bbox = buildBoundingBox(latitude, longitude, radiusMiles)
  const query = buildOverpassQuery({
    south: bbox.south,
    west: bbox.west,
    north: bbox.north,
    east: bbox.east,
    tags: mapping.tags,
    limit: Math.min(limit * 3, RESULT_LIMIT),
  })

  const allEndpoints = __endpoints ?? DEFAULT_ENDPOINTS
  // Mirrors whose circuit breaker is open are skipped entirely.
  const endpoints = allEndpoints.filter((endpoint) => !isOpen(endpoint))

  if (endpoints.length === 0) {
    // Every mirror is in cooldown — fail fast instead of waiting on a stage
    // that cannot produce anything.
    throw new AllOverpassProvidersFailed(
      'All Overpass providers failed: every mirror is temporarily disabled',
    )
  }

  const deadline = createStageDeadline('overpass', STAGE_DEADLINE_MS)
  // Aborted as soon as one mirror wins, so the losing mirrors stop burning
  // upstream capacity and sockets.
  const raceController = new AbortController()
  // The stage signal cancels every mirror request when ANY of these happens:
  // the stage budget expires, the caller's request budget expires, or the
  // race is decided by another mirror. A spent budget must cancel in-flight
  // work rather than let it linger.
  const stageController = new AbortController()
  const abortStage = () => stageController.abort()
  if (signal) {
    if (signal.aborted) stageController.abort()
    else signal.addEventListener('abort', abortStage, { once: true })
  }
  deadline.signal.addEventListener('abort', abortStage, { once: true })

  const attempts = endpoints.map((endpoint) =>
    attemptMirror(
      endpoint,
      query,
      [stageController.signal, raceController.signal],
      raceController.signal,
      deadline,
    ).then(
      (result) => ({ ok: true as const, result }),
      (error: Error) => ({ ok: false as const, error }),
    ),
  )

  // NOTE: the explicit `as` unions keep the declared type — the assignments
  // happen inside promise callbacks, which TypeScript's control-flow
  // analysis does not track.
  let result = null as OverpassResult | null
  // A mirror that answered but had nothing for this bounding box. It is kept
  // so an honest empty answer is never reported as "every mirror failed",
  // but it does NOT win the race: a mirror with real elements does.
  let emptyResult = null as OverpassResult | null
  let lastError = null as Error | null

  try {
    // The mirrors race, so the stage costs the slowest mirror, never the sum
    // of all of them. The race ends as soon as a mirror returns real
    // elements; a mirror that answers with an EMPTY element list keeps the
    // race alive so a slower mirror with data can still win.
    await withDeadline(
      new Promise<void>((resolve) => {
        let pending = attempts.length
        for (const attempt of attempts) {
          attempt.then((outcome) => {
            if (outcome.ok) {
              const elements = outcome.result?.elements
              if (elements && elements.length > 0) {
                result = outcome.result
                resolve()
                return
              }
              if (!emptyResult) emptyResult = outcome.result
            } else {
              lastError = outcome.error
            }
            pending -= 1
            if (pending === 0) resolve()
          })
        }
      }),
      deadline,
    )
  } catch (err) {
    lastError = describeMirrorFailures(err)
  } finally {
    raceController.abort()
    stageController.abort()
  }

  const chosen = result ?? emptyResult
  if (!chosen || !chosen.elements) {
    throw new AllOverpassProvidersFailed(
      lastError
        ? `All Overpass providers failed: ${lastError.message}`
        : 'All Overpass providers failed',
    )
  }

  // Filter closed businesses and normalize
  const records: BusinessDiscoveryRecord[] = []
  const seen = new Set<string>()

  for (const element of chosen.elements) {
    if (isClosed(element.tags)) continue

    const record = normalizeElement(element, mapping.label)
    // A nameless OSM element is not a lead — never emit a placeholder name.
    if (!record) continue

    // Deduplicate by normalized name + approximate location
    const dedupeKey = `${record.name.toLowerCase()}-${record.city || ''}-${record.region || ''}`.trim()
    if (seen.has(dedupeKey)) continue
    seen.add(dedupeKey)

    records.push(record)

    if (records.length >= limit) break
  }

  return records
}