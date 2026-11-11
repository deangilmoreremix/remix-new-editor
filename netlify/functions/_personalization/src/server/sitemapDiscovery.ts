/**
 * Sitemap discovery for personalization asset crawler.
 *
 * Discovers high-value personalization pages and image assets from:
 * - /sitemap.xml
 * - /sitemap_index.xml
 * - /sitemap-index.xml
 * - robots.txt sitemap declarations
 *
 * Every fetch goes through the centralized destination gate
 * (`src/lib/networkSafety.ts`): protocol allowlist, hostname literal checks
 * for every private / metadata / link-local form, DNS resolution that
 * validates EVERY address the host resolves to, and a pinned connection so a
 * DNS answer cannot move between validation and connect.
 *
 * That last part matters more here than anywhere else in the pipeline: a
 * sitemap document — and, above all, a `robots.txt` that DECLARES a sitemap —
 * is content the target site chooses. Without the gate, a site could answer
 * `/robots.txt` with `Sitemap: http://169.254.169.254/latest/meta-data/` and
 * the server would happily fetch it. Redirects are validated hop by hop for
 * the same reason.
 */

import axios from 'axios'
import * as cheerio from 'cheerio'
import { sanitizeUrl } from './discoverAssets'
import {
  checkDestination,
  isRedirectStatus,
  NetworkSafetyError,
  safeRequestConfig,
  validateRedirect,
} from '../lib/networkSafety'
import {
  DISCOVERY_REQUEST_TIMEOUT_MS,
  MAX_PAGES,
} from './discoveryPolicy'

const REQUEST_TIMEOUT = DISCOVERY_REQUEST_TIMEOUT_MS
const USER_AGENT = 'SmartVideoGO-AI/1.0 (https://go.smartvid.app)'
const REDIRECT_LIMIT = 5

const PERSONALIZATION_SLUG_PATTERNS = [
  'about',
  'about-us',
  'our-story',
  'team',
  'our-team',
  'staff',
  'services',
  'products',
  'product',
  'gallery',
  'portfolio',
  'projects',
  'work',
  'contact',
  'locations',
  'store',
  'shop',
]

const EXCLUDED_PATH_FRAGMENTS = [
  'blog',
  'news',
  'press',
  'careers',
  'jobs',
  'privacy',
  'terms',
  'legal',
  'login',
  'account',
  'cart',
  'checkout',
  'search',
  'tag',
  'author',
  'category',
  'feed',
  'wp-json',
]

export interface SitemapDiscoveryResult {
  /** Personalization-relevant pages found in the sitemap(s). */
  pageUrls: string[]
  /** Image assets declared inside the sitemap (`<image:loc>`). */
  imageUrls: string[]
  /** The sitemap documents that answered. */
  sitemapsFound: string[]
  /** The sitemaps `robots.txt` declared, whether or not they answered. */
  robotsDeclared: string[]
}

function scoreUrl(url: string): number {
  const parsed = new URL(url)
  const path = parsed.pathname.toLowerCase()
  let score = 0

  for (const pattern of PERSONALIZATION_SLUG_PATTERNS) {
    if (path.includes(pattern)) {
      score += pattern.length
    }
  }

  for (const excluded of EXCLUDED_PATH_FRAGMENTS) {
    if (path.includes(excluded)) {
      return -1
    }
  }

  return score
}

function extractSitemapUrls(
  xml: string,
  _baseUrl: string,
): { urls: string[]; sitemapIndexUrls: string[]; imageUrls: string[] } {
  const urls: string[] = []
  const imageUrls: string[] = []
  const $ = cheerio.load(xml, { xmlMode: true })

  // Standard sitemap URL set
  $('url > loc').each((_i, elem) => {
    const loc = $(elem).text().trim()
    if (loc) urls.push(loc)
  })

  // Sitemap index
  const sitemapIndexUrls: string[] = []
  $('sitemap > loc').each((_i, elem) => {
    const loc = $(elem).text().trim()
    if (loc) sitemapIndexUrls.push(loc)
  })

  // `<image:image><image:loc>` — the images a site publishes in its sitemap.
  // For a shop these are the product shots, and they are real, current,
  // first-party assets rather than a guess from a file name.
  $('image > loc').each((_i, elem) => {
    const loc = $(elem).text().trim()
    if (loc) imageUrls.push(loc)
  })

  return { urls, sitemapIndexUrls, imageUrls }
}

/**
 * Fetches one document through the destination gate, validating every
 * redirect hop as a brand new destination.
 */
async function fetchSitemap(url: string, deadlineAt?: number): Promise<string | null> {
  let current = url

  for (let hop = 0; hop <= REDIRECT_LIMIT; hop += 1) {
    const timeout = deadlineAt
      ? Math.max(0, Math.min(REQUEST_TIMEOUT, deadlineAt - Date.now()))
      : REQUEST_TIMEOUT
    if (timeout <= 0) return null

    let destination
    try {
      destination = await checkDestination(current, {})
    } catch (err) {
      if (err instanceof NetworkSafetyError) return null
      return null
    }
    if (!destination.ok) return null

    let response
    try {
      response = await axios.get(current, {
        ...safeRequestConfig(destination),
        timeout,
        maxContentLength: 5 * 1024 * 1024,
        headers: { 'User-Agent': USER_AGENT },
        validateStatus: (s) => s >= 200 && s < 400,
      })
    } catch {
      return null
    }

    if (!isRedirectStatus(response.status)) {
      return Buffer.isBuffer(response.data)
        ? response.data.toString('utf-8')
        : String(response.data)
    }

    const rawLocation = response.headers?.location
    const location = Array.isArray(rawLocation) ? rawLocation[0] : rawLocation
    const next = await validateRedirect(String(location || ''), current)
    if (!next) return null
    current = next.url
  }

  return null
}

async function fetchRobotsTxt(origin: string, deadlineAt?: number): Promise<string[]> {
  const url = `${origin}/robots.txt`
  const text = await fetchSitemap(url, deadlineAt)
  if (!text) return []

  const sitemapUrls: string[] = []
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed) continue
    const lower = trimmed.toLowerCase()
    if (!lower.startsWith('sitemap:')) continue
    const candidate = trimmed.slice('sitemap:'.length).trim()
    if (!candidate) continue
    try {
      const absolute = new URL(candidate, origin).toString()
      sitemapUrls.push(absolute)
    } catch {
      // skip invalid sitemap URLs in robots.txt
    }
  }
  return sitemapUrls
}

/**
 * Discovers the sitemap(s) of a site.
 *
 * `robots.txt` is consulted whenever one of the conventional sitemap paths
 * does not answer, and the sitemaps it declares are fetched through the same
 * destination gate as everything else.
 */
export async function discoverSitemap(
  baseUrl: string,
  deadlineAt?: number,
): Promise<SitemapDiscoveryResult> {
  const empty: SitemapDiscoveryResult = {
    pageUrls: [],
    imageUrls: [],
    sitemapsFound: [],
    robotsDeclared: [],
  }

  let sanitized: string
  try {
    sanitized = sanitizeUrl(baseUrl)
  } catch {
    return empty
  }

  const parsed = new URL(sanitized)
  const origin = `${parsed.protocol}//${parsed.host}`

  const sitemapPaths = [
    '/sitemap.xml',
    '/sitemap_index.xml',
    '/sitemap-index.xml',
  ]

  const sitemapDocuments: Array<{ url: string; xml: string }> = []

  for (const path of sitemapPaths) {
    const url = `${origin}${path}`
    const xml = await fetchSitemap(url, deadlineAt)
    if (xml) {
      sitemapDocuments.push({ url, xml })
      break
    }
  }

  // Try robots.txt sitemap declarations before giving up.
  const robotsSitemapUrls = await fetchRobotsTxt(origin, deadlineAt)
  if (sitemapDocuments.length === 0) {
    for (const sitemapUrl of robotsSitemapUrls) {
      const xml = await fetchSitemap(sitemapUrl, deadlineAt)
      if (xml) {
        sitemapDocuments.push({ url: sitemapUrl, xml })
        break
      }
    }
  }

  if (sitemapDocuments.length === 0) {
    return { ...empty, robotsDeclared: robotsSitemapUrls }
  }

  const pageUrls: string[] = []
  const imageUrls: string[] = []
  const sitemapsFound = sitemapDocuments.map((document) => document.url)

  for (const document of sitemapDocuments) {
    const extracted = extractSitemapUrls(document.xml, origin)
    pageUrls.push(...extracted.urls)
    imageUrls.push(...extracted.imageUrls)

    // If this is a sitemap index, fetch child sitemaps
    if (extracted.sitemapIndexUrls.length > 0) {
      for (const indexUrl of extracted.sitemapIndexUrls.slice(0, 3)) {
        const childXml = await fetchSitemap(indexUrl, deadlineAt)
        if (!childXml) continue
        const childResult = extractSitemapUrls(childXml, origin)
        pageUrls.push(...childResult.urls)
        imageUrls.push(...childResult.imageUrls)
        sitemapsFound.push(indexUrl)
      }
    }
  }

  // Filter same-origin, dedupe, score, and limit
  const seen = new Set<string>()
  const scored = pageUrls
    .filter((url) => {
      try {
        const parsedUrl = new URL(url)
        return parsedUrl.origin === origin
      } catch {
        return false
      }
    })
    .map((url) => ({ url, score: scoreUrl(url) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_PAGES - 1)
    .map((item) => {
      const normalized = item.url.replace(/\/$/, '')
      if (seen.has(normalized)) return null
      seen.add(normalized)
      return normalized
    })
    .filter((url): url is string => url !== null)

  const seenImages = new Set<string>()
  const sameOriginImages = imageUrls.filter((url) => {
    try {
      const parsedUrl = new URL(url)
      if (parsedUrl.origin !== origin) return false
    } catch {
      return false
    }
    if (seenImages.has(url)) return false
    seenImages.add(url)
    return true
  })

  return {
    pageUrls: scored,
    imageUrls: sameOriginImages,
    sitemapsFound,
    robotsDeclared: robotsSitemapUrls,
  }
}

/**
 * The pages a sitemap points at. Kept for the callers that only need the
 * page list.
 */
export async function discoverSitemapUrls(baseUrl: string): Promise<string[]> {
  const result = await discoverSitemap(baseUrl)
  return result.pageUrls
}
