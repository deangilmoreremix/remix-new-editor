/**
 * Server-side business asset discovery from a public website.
 *
 * Flow:
 * 1. Validate and sanitize the submitted URL (SSRF protection).
 * 2. Crawl the homepage plus a small number of relevant internal pages.
 * 3. Extract candidate image URLs from img[src], srcset, picture/source,
 *    Open Graph tags, and other structured image references.
 * 4. Filter out obvious junk (favicons, tracking pixels, UI graphics, etc.).
 * 5. For each remaining candidate, download the image and validate MIME/dimensions.
 * 6. Classify the image via OpenAI Vision to determine its category and confidence.
 * 7. Return a structured list of DiscoveredAsset candidates for the client to review.
 */

import axios from 'axios'
import * as cheerio from 'cheerio'
import OpenAI from 'openai'
import { getBusinessAssetClassificationModel } from './discoveryClassificationConfig'
import {
  classifyAssetCandidate,
  isJunkAssetUrl,
  isSocialAssetUrl,
  normalizeAssetUrl,
  tokenize,
} from './discoveryAssetFilter'
import { collectSiteLogoImages } from './discoverySiteLogo'
import {
  assertSafeUrlString,
  checkDestination,
  isBlockedHostname,
  isRedirectStatus,
  NetworkSafetyError,
  safeRequestConfig,
  validateRedirect,
} from '../lib/networkSafety'
import {
  DISCOVERY_PAGE_FETCH_BUDGET_RATIO,
  DISCOVERY_REQUEST_TIMEOUT_MS,
  MAX_IMAGE_VALIDATION_CONCURRENCY,
  MAX_PAGE_FETCH_CONCURRENCY,
} from './discoveryPolicy'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type DiscoveredAssetCategory =
  | 'person'
  | 'logo'
  | 'product'
  | 'service'
  | 'completed_work'
  | 'storefront'
  | 'office'
  | 'branded_vehicle'
  | 'team'
  | 'brand'
  | 'irrelevant'

export interface DiscoveredAsset {
  id: string
  sourceUrl: string
  previewUrl: string
  category: DiscoveredAssetCategory
  confidence?: number
  qualityScore?: number
  relevanceScore?: number
  selected: boolean
  recommended: boolean
  rejected: boolean
  /** The page the image was found on. Used by the browser fallback. */
  sourcePage?: string
  /** The `alt` text of the `<img>` element, when the page provided one. */
  altText?: string
  /** The Open Graph / Twitter context the URL came from, when any. */
  ogContext?: string
  /**
   * True when the image is the site's own logo — the image the site links to
   * its home page with.
   */
  isSiteLogo?: boolean
}

interface DiscoveryOptions {
  websiteUrl: string
  maxPages?: number
  maxImages?: number
  maxImageBytes?: number
  openAiKey?: string
  openAiModel?: string
  /** Crawl the site's other pages too, up to `maxPages` (the asset finder of films); off for the personalization modal. */
  thorough?: boolean
  enableBrowserFallback?: boolean
  /**
   * Absolute epoch milliseconds after which the crawl must stop making new
   * requests. Every outbound request is clamped to the time that is left, so
   * a slow site can never hold the caller open past its budget.
   */
  deadlineAt?: number
}

interface ImageCandidate {
  url: string
  sourcePage: string
  altText?: string
  ogContext?: string
  isSiteLogo?: boolean
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_PAGES = 8
const MAX_IMAGES = 60
const MAX_IMAGE_BYTES = 5 * 1024 * 1024 // 5MB per image
const REQUEST_TIMEOUT = DISCOVERY_REQUEST_TIMEOUT_MS
const REDIRECT_LIMIT = 5

const PRIORITY_PAGE_PATHS = [
  '/about', '/about-us', '/our-story', '/team', '/our-team', '/staff',
  '/services', '/products', '/gallery', '/portfolio', '/projects', '/work',
  '/contact', '/locations', '/store', '/shop',
]

// ---------------------------------------------------------------------------
// SSRF / URL validation
// ---------------------------------------------------------------------------

/**
 * @deprecated Kept only so the historical name still resolves. The real
 * predicate lives in `src/lib/networkSafety.ts` (shared with the upload
 * proxy) and covers the four legacy ranges *plus* 169.254/16 link-local,
 * 100.64/10 CGNAT, 0.0.0.0/8, TEST-NET/multicast/reserved IPv4, ::1,
 * fc00::/7, fe80::/10, ::ffff: IPv4-mapped IPv6 and every decimal / hex /
 * octal / short-hand IPv4 spelling.
 */
function isPrivateIp(hostname: string): boolean {
  return isBlockedHostname(hostname)
}

/**
 * Synchronous gate: protocol, hostname literals and reserved local names.
 * Throws the historical messages so existing callers keep working.
 *
 * NOTE: this is intentionally NOT sufficient on its own. A hostname that is a
 * real DNS name can still resolve to a private address, so every request also
 * goes through `checkDestination()` (which resolves and validates) and then
 * connects to a pinned address (see `safeRequestConfig`).
 */
function sanitizeUrl(input: string): string {
  return assertSafeUrlString(input)
}

export { sanitizeUrl }

// ---------------------------------------------------------------------------
// Destination-validated requests
// ---------------------------------------------------------------------------

type SimpleResponse = {
  status: number
  headers: Record<string, unknown>
  data: unknown
}

type SimpleRequest = (url: string, config: Record<string, unknown>) => Promise<SimpleResponse>

/**
 * Milliseconds left before the run's deadline, clamped to the per-request
 * timeout. Returns 0 when the budget is already gone.
 */
export function remainingBudgetMs(deadlineAt?: number): number {
  if (!deadlineAt) return REQUEST_TIMEOUT
  const remaining = deadlineAt - Date.now()
  if (remaining <= 0) return 0
  return Math.min(REQUEST_TIMEOUT, remaining)
}

/**
 * The deadline the *page fetching* phase may use.
 *
 * The page phase gets a bounded share of the run's budget and the rest is
 * reserved for validating the images it found. Without the reservation a slow
 * site spends the whole budget on HTML, reaches the deadline with dozens of
 * good image URLs and validates none of them, and the caller is told "no
 * assets found" about a site that publishes dozens (measured: 46 candidates,
 * 0 assets).
 */
export function pageFetchDeadlineAt(deadlineAt?: number): number | undefined {
  if (!deadlineAt) return undefined
  const now = Date.now()
  const remaining = deadlineAt - now
  if (remaining <= 0) return deadlineAt
  return now + Math.floor(remaining * DISCOVERY_PAGE_FETCH_BUDGET_RATIO)
}

/**
 * Issues one request, re-validating the destination at every hop.
 *
 * This is the TOCTOU / redirect fix for the discovery crawl:
 *
 * 1. `checkDestination()` resolves the host and rejects the request unless
 *    EVERY resolved address is public (closes "public name -> 127.0.0.1").
 * 2. `safeRequestConfig()` hands axios a `lookup` that can only return the
 *    address we just validated, so the resolver cannot be re-queried between
 *    validation and connect (closes the classic rebind window).
 * 3. `maxRedirects: 0` plus an explicit loop means every 30x Location is
 *    validated as a brand new destination before we follow it (closes
 *    "public URL 302 -> http://169.254.169.254/").
 *
 * The per-hop timeout is re-read from the clock at every hop. It used to be
 * the full request timeout for every hop, so a chain of five redirects could
 * hold one request open for five times the timeout — and so could push a
 * discovery request past the budget it is supposed to respect.
 */
async function requestWithValidatedRedirects(
  initialUrl: string,
  request: SimpleRequest,
  maxRedirects: number,
  timeoutMs: number = REQUEST_TIMEOUT,
  deadlineAt?: number,
): Promise<SimpleResponse> {
  let current = initialUrl

  for (let hop = 0; hop <= maxRedirects; hop += 1) {
    // Every hop pays only the time the run has left.
    const hopTimeout = deadlineAt
      ? Math.min(timeoutMs, Math.max(0, deadlineAt - Date.now()))
      : timeoutMs
    if (hopTimeout <= 0) {
      throw new NetworkSafetyError('deadline_reached')
    }

    const destination = await checkDestination(current, {})
    if (!destination.ok) {
      throw new NetworkSafetyError(destination.reason)
    }

    const response = await request(current, { ...safeRequestConfig(destination), timeout: hopTimeout })

    if (!isRedirectStatus(response.status)) {
      return response
    }

    const rawLocation = response.headers?.location
    const location = Array.isArray(rawLocation) ? rawLocation[0] : rawLocation
    const next = await validateRedirect(String(location || ''), current)
    if (!next) {
      throw new NetworkSafetyError('unsafe_redirect')
    }
    current = next.url
  }

  throw new NetworkSafetyError('too_many_redirects')
}

const PAGE_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (compatible; AssetDiscovery/1.0; +https://example.com/bot)',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
}

const IMAGE_HEADERS = { 'User-Agent': 'Mozilla/5.0 (compatible; AssetDiscovery/1.0)' }

/**
 * Fetches a page, following only redirects whose destination passes the full
 * validation. Exported so the SSRF regression tests can drive it directly.
 */
export async function fetchPage(url: string, deadlineAt?: number): Promise<string | null> {
  const timeout = remainingBudgetMs(deadlineAt)
  if (timeout <= 0) {
    console.log(`[fetchPage] ${url} -> skipped (deadline reached)`)
    return null
  }

  try {
    const response = await requestWithValidatedRedirects(
      url,
      (target, config) =>
        axios.get(target, {
          ...config,
          responseType: 'arraybuffer',
          headers: PAGE_HEADERS,
          validateStatus: (s: number) => s >= 200 && s < 400,
        }),
      REDIRECT_LIMIT,
      timeout,
      deadlineAt,
    )

    const contentType = String(response.headers['content-type'] || '')
    if (!contentType.includes('text/html') && !contentType.includes('application/xhtml')) {
      return null
    }
    const buffer = Buffer.from(response.data as ArrayBuffer)
    return buffer.toString('utf-8')
  } catch (err) {
    const reason = err instanceof NetworkSafetyError ? err.reason : null
    if (reason === 'deadline_reached') {
      console.log(`[fetchPage] ${url} -> skipped (deadline reached)`)
      return null
    }
    console.log(`[fetchPage] ${url} -> refused${reason ? ` (${reason})` : ''}`)
    return null
  }
}

// ---------------------------------------------------------------------------
// Link extraction
// ---------------------------------------------------------------------------

function extractInternalLinks(baseUrl: string, html: string): string[] {
  const $ = cheerio.load(html)
  const base = new URL(baseUrl)
  const links = new Set<string>()

  $('a[href]').each((_i, elem) => {
    const href = $(elem).attr('href') || ''
    try {
      const absolute = new URL(href, base)
      if (absolute.hostname === base.hostname) {
        links.add(absolute.toString())
      }
    } catch {
      // skip invalid URLs
    }
  })

  return Array.from(links)
}

function selectPriorityPages(_baseUrl: string, links: string[], limit = MAX_PAGES - 1, fill = false): string[] {
  const scored = links.map((link) => {
    const url = new URL(link)
    const path = url.pathname.toLowerCase()
    let score = 0
    for (const pattern of PRIORITY_PAGE_PATHS) {
      if (path.includes(pattern)) {
        score += pattern.length // longer matches score higher
      }
    }
    return { url: link, score }
  })

  scored.sort((a, b) => b.score - a.score)
  const selected = scored
    .filter((s) => s.score > 0)
    .slice(0, limit)
    .map((s) => s.url)
  // A thorough crawl (films) goes on with the site's other pages once the priority ones are taken.
  if (fill) for (const s of scored) if (selected.length < limit && !selected.includes(s.url)) selected.push(s.url)

  if (selected.length === 0 && links.length > 0) {
    selected.push(links[0])
  }

  return selected
}

// ---------------------------------------------------------------------------
// Image extraction
// ---------------------------------------------------------------------------

/**
 * True when the URL is obviously a UI decoration rather than a business
 * asset.
 *
 * The decision is delegated to `discoveryAssetFilter` so that the static path
 * and the Crawlee path filter identically. The old local implementation
 * matched junk fragments as raw substrings of the path (which dropped real
 * photos whose name merely contained "icon") and rejected every `.svg`
 * (which dropped the single most valuable asset a business site publishes:
 * its logo).
 */
function isLikelyJunk(url: string, altText?: string, isSiteLogo?: boolean): boolean {
  // A proven site logo is never junk: the site itself says which image is
  // its brand mark, and the name-based rules would drop it (`/icons/siren.svg`).
  if (isSiteLogo) return false
  if (isSocialAssetUrl(url)) return true
  const altTokens = altText ? tokenize(altText) : []
  return isJunkAssetUrl(url, altTokens, { allowSiteLogo: isSiteLogo })
}

/**
 * Picks the largest entry of a `srcset`.
 *
 * The first entry of a `srcset` is normally the SMALLEST rendering, so
 * taking `entries[0]` handed the user a thumbnail of every responsive image.
 */
function largestSrcsetEntry(srcset: string): string {
  const entries = srcset
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const parts = entry.split(/\s+/)
      return { url: parts[0] || '', descriptor: parts[1] || '' }
    })
    .filter((entry) => entry.url)

  if (entries.length === 0) return ''

  const score = (descriptor: string): number => {
    const match = /^(\d+(?:\.\d+)?)([wx])$/.exec(descriptor)
    if (!match) return 1
    return match[2] === 'w' ? Number(match[1]) : Number(match[1]) * 100
  }

  return entries.reduce((best, entry) =>
    score(entry.descriptor) > score(best.descriptor) ? entry : best,
  ).url
}

function extractImages(baseUrl: string, html: string, pageUrl: string): ImageCandidate[] {
  const $ = cheerio.load(html)
  const candidates: ImageCandidate[] = []
  const seen = new Set<string>()

  // The images the site links to its own home page with are its logo.
  const siteLogoImages = collectSiteLogoImages($, baseUrl)

  const add = (
    rawUrl: string,
    altText?: string,
    ogContext?: string,
    element?: any,
  ) => {
    if (!rawUrl || rawUrl.startsWith('data:')) return
    let absolute: string
    try {
      absolute = new URL(rawUrl, baseUrl).toString()
    } catch {
      return
    }
    const isSiteLogo = element ? siteLogoImages.has(element) : false
    // De-duplicate on the NORMALIZED url: a CDN that re-sizes one file emits
    // one URL per width, and those are one asset, not twenty.
    const key = normalizeAssetUrl(absolute)
    if (!key || seen.has(key)) return
    if (isLikelyJunk(absolute, altText, isSiteLogo)) return
    seen.add(key)
    candidates.push({ url: absolute, sourcePage: pageUrl, altText, ogContext, isSiteLogo })
  }

  // img[src]
  $('img[src]').each((_i, elem) => {
    add($(elem).attr('src') || '', $(elem).attr('alt') || undefined, undefined, elem)
  })

  // srcset
  $('img[srcset]').each((_i, elem) => {
    const srcset = $(elem).attr('srcset') || ''
    const entry = largestSrcsetEntry(srcset)
    if (entry) {
      add(entry, $(elem).attr('alt') || undefined)
    }
  })

  // picture/source
  $('picture source[srcset]').each((_i, elem) => {
    const srcset = $(elem).attr('srcset') || ''
    const entry = largestSrcsetEntry(srcset)
    if (entry) {
      add(entry)
    }
  })

  // Open Graph / Twitter / structured data
  const metaTags = [
    { attr: 'property', values: ['og:image', 'og:image:url'] },
    { attr: 'name', values: ['twitter:image', 'twitter:image:src'] },
  ]
  for (const { attr, values } of metaTags) {
    for (const val of values) {
      $(`meta[${attr}="${val}"]`).each((_i, elem) => {
        const content = $(elem).attr('content') || ''
        add(content, undefined, val)
      })
    }
  }

  return candidates
}

// ---------------------------------------------------------------------------
// Image validation
// ---------------------------------------------------------------------------

export async function validateImage(url: string, deadlineAt?: number): Promise<{ valid: boolean; mime?: string }> {
  const timeout = remainingBudgetMs(deadlineAt)
  if (timeout <= 0) return { valid: false }

  try {
    const response = await requestWithValidatedRedirects(
      url,
      (target, config) =>
        axios.head(target, {
          ...config,
          headers: IMAGE_HEADERS,
          validateStatus: (s: number) => s >= 200 && s < 500,
        }),
      REDIRECT_LIMIT,
      timeout,
    )

    if (response.status < 200 || response.status >= 300) {
      return fallbackBoundedGetValidation(url, deadlineAt)
    }

    const contentType = String(response.headers['content-type'] || '')
    console.log(`[validateImage] ${url} -> status=${response.status} type=${contentType}`)
    if (!contentType.startsWith('image/')) {
      return { valid: false }
    }
    return { valid: true, mime: contentType }
  } catch (err) {
    const axiosError = err as unknown as { response?: { status?: number } }
    if (axiosError?.response?.status) {
      console.log(`[validateImage] ${url} -> error status=${axiosError.response.status}`)
      return fallbackBoundedGetValidation(url, deadlineAt)
    }
    const reason = err instanceof NetworkSafetyError ? err.reason : null
    console.log(
      `[validateImage] ${url} -> error${reason ? ` (${reason})` : ''}: ${
        err instanceof Error ? err.message : err
      }`,
    )
    return { valid: false }
  }
}

async function fallbackBoundedGetValidation(
  url: string,
  deadlineAt?: number,
): Promise<{ valid: boolean; mime?: string }> {
  const timeout = remainingBudgetMs(deadlineAt)
  if (timeout <= 0) return { valid: false }

  try {
    const response = await requestWithValidatedRedirects(
      url,
      (target, config) =>
        axios.get(target, {
          ...config,
          headers: IMAGE_HEADERS,
          responseType: 'arraybuffer',
          maxContentLength: MAX_IMAGE_BYTES,
          validateStatus: (s: number) => s >= 200 && s < 300,
        }),
      REDIRECT_LIMIT,
      timeout,
    )

    const contentType = String(response.headers['content-type'] || '')
    console.log(`[validateImage:fallback] ${url} -> status=${response.status} type=${contentType}`)
    if (!contentType.startsWith('image/')) {
      return { valid: false }
    }
    return { valid: true, mime: contentType }
  } catch (err) {
    console.log(`[validateImage:fallback] ${url} -> error: ${err instanceof Error ? err.message : err}`)
    return { valid: false }
  }
}

// ---------------------------------------------------------------------------
// Heuristic fallback classification (no OpenAI required)
// ---------------------------------------------------------------------------

/**
 * Classifies a candidate from its URL alone.
 *
 * The matching is now token based (see `discoveryAssetFilter`), so a URL
 * containing "facebook" is no longer read as a face, and a CDN path
 * containing "/shopify-cdn" is no longer read as a shop.
 */
export function heuristicFallback(
  url: string,
  context: { altText?: string; ogContext?: string; sourcePage?: string; isSiteLogo?: boolean } = {},
): { category: DiscoveredAssetCategory; confidence: number; recommended: boolean } {
  return classifyAssetCandidate({
    url,
    altText: context.altText,
    ogContext: context.ogContext,
    sourcePage: context.sourcePage,
    isSiteLogo: context.isSiteLogo,
  })
}

// ---------------------------------------------------------------------------
// OpenAI classification
// ---------------------------------------------------------------------------

export async function classifyImage(
  url: string,
  openAiKey?: string,
  model = getBusinessAssetClassificationModel(),
  context: { altText?: string; ogContext?: string; sourcePage?: string; isSiteLogo?: boolean } = {},
): Promise<{ category: DiscoveredAssetCategory; confidence: number; recommended: boolean } | null> {
  // A proven site logo is not a judgement call: the site itself says which
  // image is its brand mark, so the name-based rules (and the vision call)
  // cannot overrule it.
  if (context.isSiteLogo) {
    return { category: 'logo', confidence: 85, recommended: true }
  }

  try {
    const hasExplicitKey = Boolean(openAiKey && openAiKey.trim().length > 0)

    if (!hasExplicitKey) {
      return heuristicFallback(url, context)
    }

    const openai = new OpenAI({ apiKey: openAiKey })
    const response = await openai.chat.completions.create({
      model,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `Classify this image for a business marketing asset library. Return ONLY a JSON object with:
- category: one of [person, logo, product, service, completed_work, storefront, office, branded_vehicle, team, brand, irrelevant]
- confidence: 0-100
- recommended: true/false

Categories:
- person: clear face/headshot, full-body, 3/4 body, or side/profile of a person
- logo: actual business logo (not favicon, not social icon)
- product: physical products or service offerings
- service: work being performed, crew working
- completed_work: finished projects, before/after
- storefront: exterior of business location
- office: interior office/showroom
- branded_vehicle: truck, van with company branding
- team: group of people, uniformed staff
- brand: brand photography, packaging, signage, uniforms
- irrelevant: anything not useful for marketing`,
            },
            {
              type: 'image_url',
              image_url: { url },
            },
          ],
        },
      ],
      max_tokens: 100,
      temperature: 0,
    })

    const text = response.choices[0]?.message?.content?.trim() || ''
    console.log(`[classify] ${url} -> response: ${text.substring(0, 200)}`)
    const jsonMatch = text.match(/\{.*\}/)
    if (!jsonMatch) {
      console.log(`[classify] ${url} -> no JSON found`)
      return null
    }

    const parsed = JSON.parse(jsonMatch[0])
    const category = parsed.category as DiscoveredAssetCategory
    const confidence = typeof parsed.confidence === 'number' ? parsed.confidence : 50
    const recommended = Boolean(parsed.recommended)

    if (
      ![
        'person', 'logo', 'product', 'service', 'completed_work',
        'storefront', 'office', 'branded_vehicle', 'team', 'brand', 'irrelevant',
      ].includes(category)
    ) {
      console.log(`[classify] ${url} -> invalid category: ${category}`)
      return null
    }

    console.log(`[classify] ${url} -> ${category} (${confidence}%) recommended=${recommended}`)
    return { category, confidence, recommended }
  } catch (err) {
    console.log(`[classify] ${url} -> error: ${err instanceof Error ? err.message : err}`)
    return null
  }
}

// ---------------------------------------------------------------------------
// Main discovery function
// ---------------------------------------------------------------------------

/**
 * Runs `tasks` with at most `limit` of them in flight.
 *
 * The validator used to start one promise per candidate and await them all,
 * so a page with 65 images opened 65 simultaneous outbound connections. The
 * pool keeps the outbound pressure bounded and lets the run stop early when
 * the deadline passes.
 */
export async function runWithConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<R>,
  shouldStop: () => boolean = () => false,
): Promise<R[]> {
  const results: R[] = []
  let cursor = 0

  const runners = Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, async () => {
    while (cursor < items.length) {
      if (shouldStop()) return
      const index = cursor
      cursor += 1
      const item = items[index]
      try {
        results.push(await worker(item))
      } catch {
        // A failed item must not abort the pool.
      }
    }
  })

  await Promise.all(runners)
  return results
}

export async function discoverBusinessAssets(options: DiscoveryOptions): Promise<DiscoveredAsset[]> {
  const {
    websiteUrl,
    maxPages = MAX_PAGES,
    maxImages = MAX_IMAGES,
    openAiKey,
    openAiModel = getBusinessAssetClassificationModel(),
    deadlineAt,
  } = options

  const baseUrl = sanitizeUrl(websiteUrl)

  // 1. Fetch homepage
  const homeHtml = await fetchPage(baseUrl, deadlineAt)
  if (!homeHtml) {
    return []
  }

  const allCandidates: ImageCandidate[] = []

  // 2. Extract images from homepage. The homepage is already fetched, so it
  //    is not fetched a second time below.
  const homeImages = extractImages(baseUrl, homeHtml, baseUrl)
  allCandidates.push(...homeImages)

  // 3. Discover linked pages and crawl them
  const links = extractInternalLinks(baseUrl, homeHtml)
  const priorityLinks = selectPriorityPages(baseUrl, links, Math.max(0, maxPages - 1), Boolean(options.thorough))
  const pagesToCrawl = priorityLinks.slice(0, Math.max(0, maxPages - 1))

  if (pagesToCrawl.length > 0) {
    const deadlineReached = () => Boolean(deadlineAt && Date.now() >= deadlineAt)
    const fetched = await runWithConcurrency(
      pagesToCrawl,
      MAX_PAGE_FETCH_CONCURRENCY,
      async (pageUrl) => ({ pageUrl, html: await fetchPage(pageUrl, deadlineAt) }),
      deadlineReached,
    )

    for (const { pageUrl, html } of fetched) {
      if (!html) continue
      allCandidates.push(...extractImages(baseUrl, html, pageUrl))
    }
  }

  // 4. Deduplicate by the NORMALIZED url so that one asset served at several
  //    sizes is one candidate.
  const uniqueCandidates: ImageCandidate[] = []
  const seenCandidateKeys = new Set<string>()
  for (const candidate of allCandidates) {
    const key = normalizeAssetUrl(candidate.url)
    if (!key || seenCandidateKeys.has(key)) continue
    seenCandidateKeys.add(key)
    uniqueCandidates.push(candidate)
  }
  console.log(`[discovery] unique candidates: ${uniqueCandidates.length}`)

  // 5. Filter out junk and validate images, with a bounded number of probes
  //    in flight and a hard stop at the deadline.
  const deadlineReached = () => Boolean(deadlineAt && Date.now() >= deadlineAt)
  const validationResults = await runWithConcurrency(
    uniqueCandidates,
    MAX_IMAGE_VALIDATION_CONCURRENCY,
    async (candidate) => {
      const validation = await validateImage(candidate.url, deadlineAt)
      return { candidate, valid: validation.valid, mime: validation.mime }
    },
    deadlineReached,
  )

  const validCandidates: ImageCandidate[] = []
  for (const result of validationResults) {
    if (validCandidates.length >= maxImages) break
    if (!result.valid) {
      console.log(`[validateImage] ${result.candidate.url} -> rejected`)
      continue
    }
    console.log(`[validateImage] ${result.candidate.url} -> valid (${result.mime})`)
    validCandidates.push(result.candidate)
  }
  console.log(`[discovery] valid candidates: ${validCandidates.length}`)

  // 6. Classify each image
  const MAX_CLASSIFICATION_CONCURRENCY = 4
  const classificationChunks: ImageCandidate[][] = []
  for (let i = 0; i < validCandidates.length; i += MAX_CLASSIFICATION_CONCURRENCY) {
    classificationChunks.push(validCandidates.slice(i, i + MAX_CLASSIFICATION_CONCURRENCY))
  }

  const results: DiscoveredAsset[] = []
  for (const chunk of classificationChunks) {
      const classificationPromises = chunk.map((candidate) =>
        classifyImage(candidate.url, openAiKey, openAiModel, {
          altText: candidate.altText,
          ogContext: candidate.ogContext,
          sourcePage: candidate.sourcePage,
          isSiteLogo: candidate.isSiteLogo,
        })
          .then((classification) => ({ candidate, classification }))
          .catch(() => ({ candidate, classification: null as any })),
      )
    const classificationResults = await Promise.all(classificationPromises)
    for (const { candidate, classification } of classificationResults) {
      if (!classification) {
        console.log(`[discovery] rejected by classifier: ${candidate.url}`)
        continue
      }
      console.log(`[discovery] classified: ${candidate.url} -> ${classification.category} (${classification.confidence}%)`)

      results.push({
        id: `disc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        sourceUrl: candidate.url,
        previewUrl: candidate.url,
        category: classification.category,
        confidence: classification.confidence,
        qualityScore: classification.confidence,
        relevanceScore: classification.confidence,
        selected: classification.recommended,
        recommended: classification.recommended,
        rejected: false,
        sourcePage: candidate.sourcePage,
        altText: candidate.altText,
        ogContext: candidate.ogContext,
        isSiteLogo: candidate.isSiteLogo,
      })
    }
  }

  const discoveryMode = 'STATIC_ONLY'
  console.log(`[discovery] mode=${discoveryMode} staticCandidates=${uniqueCandidates.length} validated=${validCandidates.length} classified=${results.length} final=${results.length}`)

  return results
}

/** The bytes of one image (same safety gate as discovery: validated redirects, size cap). Null when it cannot be had. */
export async function downloadImage(url: string, deadlineAt?: number): Promise<{ body: Buffer; contentType: string } | null> {
  const timeout = remainingBudgetMs(deadlineAt)
  if (timeout <= 0) return null
  try {
    const response = await requestWithValidatedRedirects(
      url,
      (target, config) =>
        axios.get(target, {
          ...config,
          headers: IMAGE_HEADERS,
          responseType: 'arraybuffer',
          maxContentLength: MAX_IMAGE_BYTES,
          validateStatus: (s: number) => s >= 200 && s < 300,
        }),
      REDIRECT_LIMIT,
      Math.min(timeout, 10_000),
    )
    const contentType = String(response.headers['content-type'] || '').split(';')[0].trim().toLowerCase()
    if (!/^image\/(jpeg|png|webp|gif)$/.test(contentType)) return null
    return { body: Buffer.from(response.data as ArrayBuffer), contentType }
  } catch {
    return null
  }
}
