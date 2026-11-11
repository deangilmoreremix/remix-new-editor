/**
 * Centralized Personalization asset discovery policy.
 *
 * This is the single source of truth for:
 * - allowed asset categories
 * - asset role mapping
 * - prohibited auto-placement
 * - crawl limits
 * - result limits
 */

import type { DiscoveredAssetCategory } from '../shared/personalization/types'

export const USEFUL_CATEGORIES: DiscoveredAssetCategory[] = [
  'person',
  'logo',
  'product',
  'service',
  'completed_work',
  'storefront',
  'office',
  'branded_vehicle',
  'team',
  'brand',
]

export const ASSET_ROLE_MAP: Record<DiscoveredAssetCategory, string> = {
  person: 'presenter_identity',
  logo: 'logo',
  product: 'product_reference',
  service: 'product_reference',
  completed_work: 'product_reference',
  storefront: 'brand_reference',
  office: 'brand_reference',
  branded_vehicle: 'brand_reference',
  team: 'brand_reference',
  brand: 'brand_reference',
  irrelevant: 'irrelevant',
}

export const PROHIBITED_AUTO_PLACEMENT = [
  'first_frame',
  'last_frame',
  'cta_graphic',
  'audio_reference',
  'saved_reference',
] as const

export const PERSONALIZATION_ASSET_ROLES = [
  'presenter_identity',
  'logo',
  'product_reference',
  'brand_reference',
] as const

export const MAX_REVIEW_ASSETS = 25
export const MAX_RAW_CANDIDATES = 75
export const MAX_PAGES = 8
export const MAX_DEPTH = 1
export const MAX_FIRE_CRAWL_PAGES = 5

export const RESULTS_LIMITS = {
  logo: 3,
  presenter: 5,
  products: 10,
  brandReferences: 8,
} as const

export const FREE_DISCOVERY_MIN_USEFUL = 4

// ---------------------------------------------------------------------------
// Time budgets
// ---------------------------------------------------------------------------

/**
 * Wall-clock budget for ONE outbound request (page, sitemap, image probe).
 *
 * The old default was 15s, which — multiplied by the number of pages a crawl
 * visits and by the retry budget of the HTTP layer — let a single slow site
 * hold the discovery request open for the better part of a minute. Every
 * request now also respects the remaining run budget, so the per-request
 * timeout is a ceiling, not a promise.
 */
export const DISCOVERY_REQUEST_TIMEOUT_MS = 8_000

/**
 * How long the *synchronous* part of a discovery request may run before the
 * route answers with a job id and lets the work continue out of band.
 *
 * This is the "synchronous limit" the job contract is built around: a job that
 * outlives it is still created, still owned by its caller, and still reaches a
 * terminal state through the status endpoint.
 *
 * It is a HARD limit: the crawl clamps every outbound request to the time
 * that is left, and a redirect chain re-reads the clock at every hop, so a
 * chain of five slow redirects can no longer multiply the timeout and push
 * the request past the budget.
 */
export const DISCOVERY_SYNC_BUDGET_MS = 12_000

/**
 * Which share of the synchronous budget the *page fetching* phase may use.
 *
 * The rest of the budget is reserved for validating the images that were
 * found. Without the reservation a slow site spends the whole budget
 * downloading HTML, reaches the deadline with dozens of perfectly good image
 * URLs, and then validates none of them — the caller is told "no assets
 * found" about a site that publishes dozens. Measured: a 12 s budget on
 * rubirosa.com produced 46 candidates and 0 assets.
 */
export const DISCOVERY_PAGE_FETCH_BUDGET_RATIO = 0.55

/**
 * Upper bound for the whole background phase. A job that has not reached a
 * terminal state by then is failed by the owner that polls it, so a job can
 * never sit in `running` for ever and the client can never wait for ever.
 *
 * The browser phase's own run budget is 60 s, so 75 s leaves it 15 s of slack
 * and still fires well inside the 120 s the client polls for.
 */
export const DISCOVERY_BACKGROUND_BUDGET_MS = 75_000

/**
 * How long the route waits for the background worker to ACCEPT a job.
 *
 * The worker runs the whole browser phase before it answers, so awaiting its
 * response would hold the discovery request open for the length of the
 * browser crawl — on a hosting runtime with a 30 s function limit that is a
 * guaranteed timeout, and the job is left `running` for ever.
 *
 * The dispatch is therefore acknowledged, not awaited: the route waits at
 * most this long for the worker to pick the job up and then answers the
 * caller immediately. A worker that never picks the job up is caught by the
 * stale-job watchdog, so the job still reaches a terminal state.
 */
export const BACKGROUND_DISPATCH_ACK_TIMEOUT_MS = 3_000

// ---------------------------------------------------------------------------
// Concurrency
// ---------------------------------------------------------------------------

/**
 * How many image probes may be in flight at the same time.
 *
 * The validator used to build one promise per candidate and await them all,
 * so a page with 65 images produced 65 simultaneous outbound requests. The
 * declared constant was never used; this is the value that is actually
 * applied.
 */
export const MAX_IMAGE_VALIDATION_CONCURRENCY = 6

/** How many pages may be fetched at the same time. */
export const MAX_PAGE_FETCH_CONCURRENCY = 3

/** How many times the HTTP layer may retry a failed request. */
export const MAX_REQUEST_RETRIES = 1

export function isUsefulCategory(category: DiscoveredAssetCategory | undefined): boolean {
  if (!category) return false
  return USEFUL_CATEGORIES.includes(category)
}
