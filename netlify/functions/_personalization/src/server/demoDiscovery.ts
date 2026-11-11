/**
 * Restricted discovery pipeline behind the anonymous demo endpoint
 * `POST /api/demo/discover`.
 *
 * HARD RULES this module exists to enforce:
 *
 * 1. No paid crawling. Every byte comes from a static HTTP fetch of the
 *    caller's landing page plus that same origin's `sitemap.xml`, parsed with
 *    `cheerio`. Crawlee, the browser-discovery path, Firecrawl, OpenAI and
 *    MuAPI are never imported and never called.
 * 2. Depth 1. The landing page and its own `/sitemap.xml` are the only URLs
 *    fetched. No link is ever followed, and axios' redirect following is
 *    disabled (`maxRedirects: 0`), so a 3xx is refused rather than chased.
 * 3. Every outbound destination goes through `src/lib/networkSafety.ts`.
 *    `assertSafeUrlString` is the synchronous gate; the fetch itself is pinned
 *    to the address `checkDestination` validated, exactly like
 *    `src/server/businessDiscovery/researchProvider.ts`, so a DNS answer that
 *    flips between validation and connect cannot move the socket to a private
 *    peer. A blocked destination throws `DemoBlockedTargetError` (→ HTTP 400).
 * 4. No persistence. This module writes no discovery job, no saved project and
 *    no identity row of any kind. The only thing it writes is the shared,
 *    URL-keyed demo cache, and that cache holds nothing but the public asset
 *    list of a public website — never a caller IP, user id or token.
 */

import axios from 'axios'
import * as cheerio from 'cheerio'
import {
  assertSafeUrlString,
  checkDestination,
  NetworkSafetyError,
  safeRequestConfig,
} from '../lib/networkSafety'
import { researchBusiness } from './businessDiscovery/researchProvider'
import { createServerClient } from '../lib/supabase'

// ---------------------------------------------------------------------------
// Hard limits
// ---------------------------------------------------------------------------

/** Only the landing page plus its own sitemap.xml: no link following. */
export const DEMO_MAX_CRAWL_DEPTH = 1

/** Maximum number of assets returned to an anonymous caller. */
export const DEMO_MAX_ASSETS = 12

/** Maximum response body accepted per fetch. */
export const DEMO_MAX_BODY_BYTES = 1_000_000

/** Per-request timeout for every demo fetch. */
export const DEMO_REQUEST_TIMEOUT_MS = 15_000

/** Same cap as the personalization route for caller-supplied URLs. */
export const DEMO_MAX_WEBSITE_URL_LENGTH = 2048

/** Smallest declared `<img>` dimension accepted as a real asset. */
export const DEMO_MIN_IMAGE_DIMENSION = 100

/** How long a successful demo result is shared across instances. */
export const DEMO_CACHE_TTL_MS = 6 * 60 * 60 * 1000

/** Shared-cache RPCs (see the migration); `personalization_demo_consume_quota` lives in demoRateLimit.ts. */
export const DEMO_CACHE_GET_RPC = 'personalization_demo_discovery_cache_get'
export const DEMO_CACHE_PUT_RPC = 'personalization_demo_discovery_cache_put'

/** Table backing the cache RPCs; the route never touches it directly. */
export const DEMO_CACHE_TABLE = 'personalization_demo_discovery_cache'

/**
 * Reasons from `checkDestination` that mean the caller is never allowed to
 * reach the destination. They throw (→ HTTP 400). Everything else
 * (`dns_resolution_failed`, timeouts, connect errors, non-200) is "this site is
 * not answering right now" and degrades to "no assets found".
 */
const BLOCK_REASONS = new Set(['blocked_host', 'resolved_to_blocked_ip', 'invalid_url'])

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type DemoAssetKind = 'logo' | 'photo' | 'product' | 'brand'
export type DemoAssetSource = 'meta' | 'og' | 'jsonld' | 'img' | 'sitemap'

export interface DemoAsset {
  kind: DemoAssetKind
  url: string
  source: DemoAssetSource
}

export interface DemoDiscoveryPayload {
  url: string
  title: string | null
  description: string | null
  logo: string | null
  assets: DemoAsset[]
}

export interface DemoDiscoveryResult extends DemoDiscoveryPayload {
  ok: true
  cached: false
}

/** A thrown blocker the route must answer with HTTP 400 "not allowed". */
export class DemoBlockedTargetError extends Error {
  readonly code = 'DEMO_BLOCKED_TARGET'

  constructor(message = 'This website URL is not allowed for the demo') {
    super(message)
    this.name = 'DemoBlockedTargetError'
  }
}

/** True when an error means "the caller aimed at a destination we refuse". */
export function isDemoBlockedTargetError(err: unknown): boolean {
  if (err instanceof DemoBlockedTargetError) return true
  if (err instanceof NetworkSafetyError) return true
  if (err instanceof Error) {
    return /not allowed|private|blocked|invalid url|malformed/i.test(err.message)
  }
  return false
}

/** Structural subset of the `researchBusiness` result this module consumes. */
interface DemoResearchInput {
  canonicalUrl: string
  finalUrl: string
  reachable: boolean
  title?: string
  description?: string
  logoUrl?: string
  jsonLd: Record<string, unknown>[]
  openGraph: Record<string, string>
}

interface RawCandidate {
  kind: DemoAssetKind
  source: DemoAssetSource
  url: string
}

/** Raised when the shared cache cannot be read or written; never fatal. */
export class DemoCacheError extends Error {
  readonly code = 'DEMO_CACHE_UNAVAILABLE'

  constructor(message = 'Demo discovery cache is unavailable') {
    super(message)
    this.name = 'DemoCacheError'
  }
}

// ---------------------------------------------------------------------------
// URL helpers
// ---------------------------------------------------------------------------

const IMAGE_EXTENSIONS = [
  '.jpg',
  '.jpeg',
  '.png',
  '.webp',
  '.gif',
  '.avif',
  '.svg',
  '.bmp',
  '.ico',
  '.tif',
  '.tiff',
]

/** URL schemes a stored asset may never use. */
const NON_ASSET_EXTENSIONS = ['.html', '.htm', '.php', '.aspx', '.pdf', '.json', '.txt', '.xml']

function pathnameOf(url: string): string {
  try {
    return new URL(url).pathname.toLowerCase()
  } catch {
    return ''
  }
}

function hasImageExtension(url: string): boolean {
  const pathname = pathnameOf(url)
  return IMAGE_EXTENSIONS.some((extension) => pathname.endsWith(extension))
}

function isNonAssetUrl(url: string): boolean {
  const pathname = pathnameOf(url)
  return NON_ASSET_EXTENSIONS.some((extension) => pathname.endsWith(extension))
}

/**
 * Resolves a candidate asset against the page it came from and runs it through
 * the SSRF gate. Anything that fails is dropped, so the response can never
 * contain a URL this process would refuse to fetch.
 */
function safeAssetUrl(raw: unknown, baseUrl: string): string | null {
  if (typeof raw !== 'string') return null
  const value = raw.trim()
  if (!value || value.length > DEMO_MAX_WEBSITE_URL_LENGTH) return null

  let absolute: string
  try {
    absolute = new URL(value, baseUrl).toString()
  } catch {
    return null
  }

  try {
    return assertSafeUrlString(absolute)
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------
// Static fetching (pinned, redirect-free, body-capped)
// ---------------------------------------------------------------------------

interface DemoDestination {
  url: string
  hostname: string
  port: string
  protocol: string
  addresses: string[]
}

async function resolveDestination(url: string): Promise<DemoDestination | null> {
  let checked: Awaited<ReturnType<typeof checkDestination>>
  try {
    checked = await checkDestination(url, {})
  } catch {
    return null
  }
  if (!checked.ok) {
    const reason = checked.reason || 'blocked'
    if (BLOCK_REASONS.has(reason)) {
      throw new DemoBlockedTargetError(
        `This website URL is not allowed (${reason})`,
      )
    }
    return null
  }
  return checked as DemoDestination
}

function isSameOrigin(target: string, destination: DemoDestination): boolean {
  let parsed: URL
  try {
    parsed = new URL(target)
  } catch {
    return false
  }
  const port = parsed.port || (parsed.protocol === 'https:' ? '443' : '80')
  return (
    parsed.protocol === destination.protocol &&
    parsed.hostname.toLowerCase() === destination.hostname &&
    port === destination.port
  )
}

function bodyTextOf(data: unknown): string {
  if (typeof data === 'string') return data
  if (Buffer.isBuffer(data)) return data.toString('utf-8')
  if (data && typeof data === 'object' && typeof (data as { toString?: () => string }).toString === 'function') {
    return String(data)
  }
  return ''
}

/**
 * GETs `url` on the already-validated, pinned origin. Redirects are refused
 * rather than followed, the body is capped at 1 MB and the request times out
 * after 15 s. Blocked destinations throw; every other failure (DNS, connect,
 * timeout, non-200) resolves to `null` so the caller keeps going.
 */
async function fetchPinnedText(
  url: string,
  destination: DemoDestination,
): Promise<string | null> {
  if (!isSameOrigin(url, destination)) {
    throw new DemoBlockedTargetError(
      'This website URL is not allowed (destination changed)',
    )
  }

  let response: { status: number; data: unknown }
  try {
    response = await axios.get(url, {
      timeout: DEMO_REQUEST_TIMEOUT_MS,
      maxContentLength: DEMO_MAX_BODY_BYTES,
      headers: {
        'User-Agent': 'SmartVideoGO-AI/1.0 (https://go.smartvid.app)',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      validateStatus: (status: number) => status === 200,
      // The pin carries the validated-address lookup and the agents; it also
      // disables axios' redirect following, restated below so a future change
      // to the pin cannot silently let this route chase a 3xx.
      ...safeRequestConfig(destination),
      maxRedirects: 0,
    })
  } catch {
    return null
  }

  const body = bodyTextOf(response?.data)
  if (!body || body.length > DEMO_MAX_BODY_BYTES) return null
  return body
}

/** Builds the one sitemap URL depth 1 allows. */
function sitemapUrlFor(baseUrl: string): string | null {
  try {
    return new URL('/sitemap.xml', baseUrl).toString()
  } catch {
    return null
  }
}

const LOC_PATTERN = /<([a-z0-9_.:-]*:)?loc[^>]*>([^<]+)<\//gi

function decodeXmlEntities(value: string): string {
  return value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_match, hex: string) =>
      String.fromCodePoint(Number.parseInt(hex, 16)),
    )
    .replace(/&#(\d+);/g, (_match, dec: string) => String.fromCodePoint(Number(dec)))
    .replace(/&amp;/g, '&')
}

/** Extracts every `<loc>` (including `<image:loc>`) that names an image file. */
function sitemapImageUrls(xml: string): string[] {
  const found: string[] = []
  LOC_PATTERN.lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = LOC_PATTERN.exec(xml)) !== null && found.length < 500) {
    const value = decodeXmlEntities(match[2].trim())
    if (!value || isNonAssetUrl(value)) continue
    if (!hasImageExtension(value)) continue
    found.push(value)
  }
  return found
}

// ---------------------------------------------------------------------------
// Candidate extraction (static + structured data only)
// ---------------------------------------------------------------------------

function toPositiveInt(value: unknown): number | null {
  const parsed = Number.parseInt(String(value ?? ''), 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

/** Flattens JSON-LD arrays and `@graph` containers into a flat node list. */
function flattenJsonLd(nodes: unknown[], out: Record<string, unknown>[] = []): Record<string, unknown>[] {
  for (const node of nodes) {
    if (Array.isArray(node)) {
      flattenJsonLd(node, out)
      continue
    }
    if (!node || typeof node !== 'object') continue
    const record = node as Record<string, unknown>
    out.push(record)
    if (Array.isArray(record['@graph'])) {
      flattenJsonLd(record['@graph'], out)
    }
  }
  return out
}

function typeNamesOf(node: Record<string, unknown>): string[] {
  const raw = node['@type']
  if (typeof raw === 'string') return [raw.toLowerCase()]
  if (Array.isArray(raw)) {
    return raw.filter((item): item is string => typeof item === 'string').map((item) => item.toLowerCase())
  }
  return []
}

function isProductNode(node: Record<string, unknown>): boolean {
  const types = typeNamesOf(node)
  if (types.some((type) => type === 'product' || type === 'offer' || type === 'aggregateoffer')) return true
  return Boolean(node.offers) && Boolean(node.image)
}

/** Accepts the string / array / ImageObject shapes JSON-LD uses for images. */
function imageStringsOf(value: unknown): string[] {
  if (typeof value === 'string') return [value]
  if (Array.isArray(value)) return value.flatMap((item) => imageStringsOf(item))
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>
    if (typeof record.url === 'string') return [record.url]
    if (typeof record.contentUrl === 'string') return [record.contentUrl]
  }
  return []
}

const OG_IMAGE_KEYS = ['image', 'image:url', 'image:secure_url']

function openGraphImageCandidates(openGraph: Record<string, string>): string[] {
  const values: string[] = []
  for (const key of OG_IMAGE_KEYS) {
    const value = openGraph[key]
    if (typeof value === 'string' && value.trim() && !isNonAssetUrl(value.trim())) {
      values.push(value.trim())
    }
  }
  return values
}

/** Head-declared images other than og:image (Twitter cards, microdata, …). */
function metaImageCandidates(html: string): string[] {
  const $ = cheerio.load(html)
  const values: string[] = []
  const push = (raw: string | undefined) => {
    const value = (raw || '').trim()
    if (value && !isNonAssetUrl(value)) values.push(value)
  }

  $('meta[name^="twitter:"], meta[property^="twitter:"]').each((_i, element) => {
    const name = ($(element).attr('name') || $(element).attr('property') || '').toLowerCase()
    if (name.endsWith(':image') || name === 'twitter:image') push($(element).attr('content'))
  })
  $('meta[itemprop="image"]').each((_i, element) => push($(element).attr('content')))
  return values
}

/** `apple-touch-icon` and its precomposed spelling: the strongest logo signal in a head. */
function appleTouchIconCandidates(html: string): string[] {
  const $ = cheerio.load(html)
  const values: string[] = []
  $('link[rel~="apple-touch-icon"], link[rel~="apple-touch-icon-precomposed"]').each((_i, element) => {
    const value = ($(element).attr('href') || '').trim()
    if (value) values.push(value)
  })
  return values
}

/** True when the page declares the OpenGraph product namespace. */
function declaresProduct(html: string): boolean {
  const $ = cheerio.load(html)
  return (
    $('meta[property^="product:"], meta[property^="og:product"]').length > 0
  )
}

/** Largest entry of a `srcset`, used to prefer a full-size asset over a thumbnail. */
function largestSrcsetCandidate(srcset: string): string | null {
  const entries = srcset
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const parts = entry.split(/\s+/)
      return { url: parts[0] || '', descriptor: parts[1] || '' }
    })
    .filter((entry) => entry.url)

  if (entries.length === 0) return null

  const score = (descriptor: string): number => {
    const match = /^(\d+(?:\.\d+)?)([wx])$/.exec(descriptor)
    if (!match) return 1
    return match[2] === 'w' ? Number(match[1]) : Number(match[1]) * 100
  }

  return entries.reduce((best, entry) =>
    score(entry.descriptor) > score(best.descriptor) ? entry : best,
  ).url
}

/** Inline `<img>` sources, filtered to a sensible size. */
function imgCandidates(html: string): string[] {
  const $ = cheerio.load(html)
  const values: string[] = []

  $('img').each((_i, element) => {
    const width = toPositiveInt($(element).attr('width'))
    const height = toPositiveInt($(element).attr('height'))
    if (width !== null && width < DEMO_MIN_IMAGE_DIMENSION) return
    if (height !== null && height < DEMO_MIN_IMAGE_DIMENSION) return

    const src = ($(element).attr('src') || $(element).attr('data-src') || '').trim()
    const srcset = $(element).attr('srcset') || ''
    const fromSrcset = srcset ? largestSrcsetCandidate(srcset) : null
    if (fromSrcset) values.push(fromSrcset)
    if (src) values.push(src)
  })

  return values
}

/**
 * Builds the ordered candidate list. Order is priority: the first candidate
 * for a URL decides that asset's kind, so a JSON-LD `Product` image outranks
 * the same URL arriving as `og:image`.
 */
function collectRawCandidates(input: {
  research: DemoResearchInput
  landingHtml: string | null
  sitemapUrls: string[]
}): RawCandidate[] {
  const { research, landingHtml, sitemapUrls } = input
  const candidates: RawCandidate[] = []

  const productFromPage = landingHtml ? declaresProduct(landingHtml) : false
  const jsonLd = flattenJsonLd(Array.isArray(research.jsonLd) ? research.jsonLd : [])
  const productImages = new Set<string>()
  const jsonLdImages: string[] = []
  const jsonLdLogos: string[] = []

  for (const node of jsonLd) {
    if (isProductNode(node)) {
      for (const image of imageStringsOf(node.image)) productImages.add(image)
    }
    for (const image of imageStringsOf(node.image)) jsonLdImages.push(image)
    for (const image of imageStringsOf(node.logo)) jsonLdLogos.push(image)
  }

  // 1. JSON-LD Product / Offer images.
  for (const url of productImages) candidates.push({ kind: 'product', source: 'jsonld', url })
  // 2. og:image — the page's own hero/cover, so the logo unless the page is a
  //    product page, in which case the same image is the product shot.
  for (const url of openGraphImageCandidates(research.openGraph || {})) {
    candidates.push({ kind: productFromPage ? 'product' : 'logo', source: 'og', url })
  }
  // 3. JSON-LD logo.
  for (const url of jsonLdLogos) candidates.push({ kind: 'logo', source: 'jsonld', url })
  // 4. apple-touch-icon.
  if (landingHtml) {
    for (const url of appleTouchIconCandidates(landingHtml)) {
      candidates.push({ kind: 'logo', source: 'meta', url })
    }
  }
  // 5. Inline <img>. og:image already claimed the hero shot above, so these
  //    are the page's photos.
  if (landingHtml) {
    for (const url of imgCandidates(landingHtml)) candidates.push({ kind: 'photo', source: 'img', url })
  }
  // 6. Other head-declared images (Twitter cards, microdata).
  if (landingHtml) {
    for (const url of metaImageCandidates(landingHtml)) candidates.push({ kind: 'brand', source: 'meta', url })
  }
  // 7. Remaining JSON-LD images (Organization image, Event image, …).
  for (const url of jsonLdImages) candidates.push({ kind: 'brand', source: 'jsonld', url })
  // 8. Sitemap images: a real asset list, but with no type information.
  for (const url of sitemapUrls) candidates.push({ kind: 'photo', source: 'sitemap', url })
  // 9. Last-resort logo from the research provider.
  if (research.logoUrl) candidates.push({ kind: 'logo', source: 'og', url: research.logoUrl })

  return candidates
}

function dedupeAndCap(candidates: RawCandidate[], baseUrl: string): DemoAsset[] {
  const seen = new Set<string>()
  const assets: DemoAsset[] = []

  for (const candidate of candidates) {
    if (assets.length >= DEMO_MAX_ASSETS) break
    const url = safeAssetUrl(candidate.url, baseUrl)
    if (!url) continue
    if (seen.has(url)) continue
    seen.add(url)
    assets.push({ kind: candidate.kind, url, source: candidate.source })
  }

  return assets
}

// ---------------------------------------------------------------------------
// Pipeline
// ---------------------------------------------------------------------------

/**
 * Runs the restricted demo pipeline for one caller-supplied URL.
 *
 * Throws `DemoBlockedTargetError` for a destination the caller may never reach
 * (the route answers 400). Anything else — an unreachable host, a timeout, a
 * non-200 sitemap — degrades to fewer assets rather than an error, because the
 * caller is not at fault for a site that does not answer.
 */
export async function runDemoDiscovery(websiteUrl: string): Promise<DemoDiscoveryResult> {
  // Synchronous gate first: protocol, private/loopback/link-local/CGNAT/
  // metadata/ULA/IPv4-mapped/unspecified literals and the alternate decimal,
  // octal and hex spellings are refused before any network call happens.
  let safeUrl: string
  try {
    safeUrl = assertSafeUrlString(websiteUrl)
  } catch {
    throw new DemoBlockedTargetError('This website URL is not allowed')
  }

  // Async half of the gate plus the metadata fetch: DNS resolution that
  // validates every address the host currently resolves to, per-hop redirect
  // revalidation and connection pinning. A blocked hop rethrows as a
  // "… is not allowed" message.
  const research = (await researchBusiness(safeUrl)) as DemoResearchInput
  const baseUrl = (research.finalUrl || research.canonicalUrl || safeUrl) as string

  // Depth 1: the resolved landing page and the one sitemap on the same origin.
  // `researchBusiness` is the SSRF-gated metadata provider; this fetch is the
  // restricted asset extraction on the same validated origin.
  let landingHtml: string | null = null
  let sitemapUrls: string[] = []
  if (research.reachable) {
    const destination = await resolveDestination(baseUrl)
    if (destination) {
      landingHtml = await fetchPinnedText(baseUrl, destination)
      const sitemapUrl = sitemapUrlFor(baseUrl)
      if (sitemapUrl) {
        const sitemapXml = await fetchPinnedText(sitemapUrl, destination)
        if (sitemapXml) sitemapUrls = sitemapImageUrls(sitemapXml)
      }
    }
  }

  const assets = dedupeAndCap(
    collectRawCandidates({ research, landingHtml, sitemapUrls }),
    baseUrl,
  )

  const logoFromAssets = assets.find((asset) => asset.kind === 'logo')?.url ?? null

  return {
    ok: true,
    cached: false,
    url: baseUrl,
    title: typeof research.title === 'string' && research.title.trim() ? research.title.trim() : null,
    description:
      typeof research.description === 'string' && research.description.trim()
        ? research.description.trim()
        : null,
    logo: logoFromAssets ?? safeAssetUrl(research.logoUrl, baseUrl),
    assets,
  }
}

// ---------------------------------------------------------------------------
// Shared cache (URL-keyed, public assets only)
// ---------------------------------------------------------------------------

function cacheClient() {
  try {
    return createServerClient()
  } catch {
    throw new DemoCacheError('Supabase configuration is missing')
  }
}

/**
 * Re-validates a cached row on the way out. The cache is keyed by a public URL
 * and holds a public asset list, but a row that arrives malformed (or from a
 * future schema) must not be able to widen the response shape or smuggle a URL
 * past the SSRF gate.
 */
export function sanitizeDemoDiscoveryPayload(value: unknown): DemoDiscoveryPayload | null {
  if (!value || typeof value !== 'object') return null
  const record = value as Record<string, unknown>

  const assets: DemoAsset[] = []
  const rawAssets = Array.isArray(record.assets) ? record.assets : []
  for (const raw of rawAssets) {
    if (assets.length >= DEMO_MAX_ASSETS) break
    if (!raw || typeof raw !== 'object') continue
    const asset = raw as Record<string, unknown>
    if (typeof asset.url !== 'string') continue
    const url = safeAssetUrl(asset.url, 'https://demo.invalid/')
    if (!url || isNonAssetUrl(url)) continue
    const kind = asset.kind
    const source = asset.source
    if (kind !== 'logo' && kind !== 'photo' && kind !== 'product' && kind !== 'brand') continue
    if (source !== 'meta' && source !== 'og' && source !== 'jsonld' && source !== 'img' && source !== 'sitemap') {
      continue
    }
    assets.push({ kind, url, source })
  }

  const title = typeof record.title === 'string' ? record.title.trim() || null : null
  const description = typeof record.description === 'string' ? record.description.trim() || null : null
  const logo = typeof record.logo === 'string' ? safeAssetUrl(record.logo, 'https://demo.invalid/') : null
  const url = typeof record.url === 'string' ? safeAssetUrl(record.url, 'https://demo.invalid/') : null
  if (!url) return null

  return { url, title, description, logo, assets }
}

/** Reads a fresh cached entry for `cacheKey`, or null. */
export async function readDemoDiscoveryCache(cacheKey: string): Promise<DemoDiscoveryPayload | null> {
  const key = typeof cacheKey === 'string' ? cacheKey.trim() : ''
  if (!key) return null

  const client = cacheClient()
  let response: { data: unknown; error: unknown } | null = null
  try {
    response = (await client.rpc(DEMO_CACHE_GET_RPC, { p_url: key })) as { data: unknown; error: unknown }
  } catch {
    throw new DemoCacheError('Demo cache read failed')
  }
  if (!response || response.error) {
    throw new DemoCacheError('Demo cache read returned an error')
  }
  const row = Array.isArray(response.data) ? response.data[0] : response.data
  return sanitizeDemoDiscoveryPayload(row)
}

/** Stores `payload` under `cacheKey`. Best effort: the caller logs and continues. */
export async function writeDemoDiscoveryCache(
  cacheKey: string,
  payload: DemoDiscoveryPayload,
): Promise<void> {
  const key = typeof cacheKey === 'string' ? cacheKey.trim() : ''
  if (!key) return

  const client = cacheClient()
  let response: { error: unknown } | null = null
  try {
    response = (await client.rpc(DEMO_CACHE_PUT_RPC, {
      p_url: key,
      p_payload: payload,
      p_ttl_ms: DEMO_CACHE_TTL_MS,
    })) as { error: unknown }
  } catch {
    throw new DemoCacheError('Demo cache write failed')
  }
  if (!response || response.error) {
    throw new DemoCacheError('Demo cache write returned an error')
  }
}
