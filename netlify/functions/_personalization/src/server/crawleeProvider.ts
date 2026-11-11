/**
 * Crawlee-based free HTTP discovery provider.
 *
 * Uses CheerioCrawler for inexpensive HTTP-only crawling.
 * No browser, no Playwright, no Puppeteer.
 *
 * This is a FREE fallback layer, NOT a replacement for the existing
 * static crawler. It runs only when static discovery is insufficient.
 *
 * Three things this layer had to be fixed for:
 *
 * 1. The request handler dereferenced `$` unconditionally. When a request
 *    timed out or failed, Crawlee calls the handler without a parsed body,
 *    `$` was `undefined` and the handler threw. Crawlee then retried the
 *    request three more times, so one slow page cost four timeouts.
 * 2. It applied NO junk filtering, so icons, sprites, tracking pixels and
 *    social badges reached the review panel (the static path filtered them).
 * 3. It followed redirects with the HTTP client's own defaults, which means a
 *    public URL that answers `302 Location: http://169.254.169.254/` was
 *    fetched. The client is now pinned to never follow a redirect, and every
 *    URL Crawlee is about to request goes through the shared destination
 *    gate.
 */

import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { CheerioCrawler } from '@crawlee/cheerio'
import { Configuration, GotScrapingHttpClient } from '@crawlee/core'
import * as cheerio from 'cheerio'
import { sanitizeUrl } from './discoverAssets'
import { isJunkAssetUrl, isSocialAssetUrl, normalizeAssetUrl, tokenize } from './discoveryAssetFilter'
import { collectSiteLogoImages } from './discoverySiteLogo'
import { checkDestination } from '../lib/networkSafety'
import {
  DISCOVERY_REQUEST_TIMEOUT_MS,
  MAX_PAGES,
  MAX_RAW_CANDIDATES,
  MAX_REQUEST_RETRIES,
} from './discoveryPolicy'
import type { ImageCandidate, DiscoveryResult } from './discoveryProvider'

const REQUEST_TIMEOUT = DISCOVERY_REQUEST_TIMEOUT_MS
const USER_AGENT = 'SmartVideoGO-AI/1.0 (https://go.smartvid.app)'

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

function scoreUrl(url: string): number {
  const parsed = new URL(url)
  const path = parsed.pathname.toLowerCase()
  let score = 0
  for (const pattern of PERSONALIZATION_SLUG_PATTERNS) {
    if (path.includes(pattern)) {
      score += pattern.length
    }
  }
  return score
}

function isExcluded(url: string): boolean {
  const parsed = new URL(url)
  const path = parsed.pathname.toLowerCase()
  return EXCLUDED_PATH_FRAGMENTS.some((frag) => path.includes(frag))
}

/**
 * An HTTP client that never follows a redirect.
 *
 * Crawlee's default client follows redirects, so a public URL that answered
 * with a `Location` header could move the request to a destination this
 * process has never validated. Pinning `followRedirect: false` makes a 3xx a
 * response (which carries no assets) instead of a new request, which closes
 * the redirect hop that the static path already closes explicitly.
 */
class NoRedirectHttpClient extends GotScrapingHttpClient {
  async sendRequest<TResponseType extends 'json' | 'text' | 'buffer'>(
    request: any,
  ): Promise<any> {
    return super.sendRequest({ ...request, followRedirect: false, maxRedirects: 0 })
  }

  async stream(request: any, handleRedirect?: any): Promise<any> {
    return super.stream({ ...request, followRedirect: false, maxRedirects: 0 }, handleRedirect)
  }
}

function extractImagesFromHtml(baseUrl: string, html: string, pageUrl: string): ImageCandidate[] {
  const $ = cheerio.load(html)
  const candidates: ImageCandidate[] = []
  const seen = new Set<string>()

  // The images the site links to its own home page with are its logo. The
  // name-based junk rules would drop them (`/assets/icons/siren.svg`), so
  // they are exempted from the junk filter and classified as the logo.
  const siteLogoImages = collectSiteLogoImages($, baseUrl)

  const add = (rawUrl: string, altText?: string, ogContext?: string, element?: any) => {
    if (!rawUrl || rawUrl.startsWith('data:')) return
    let absolute: string
    try {
      // A relative URL on a sub-page is relative to THAT page, not to the
      // site root. Resolving it against the root produced URLs that do not
      // exist, which is exactly the kind of broken candidate the validation
      // step has to reject.
      absolute = new URL(rawUrl, pageUrl).toString()
    } catch {
      return
    }
    const isSiteLogo = element ? siteLogoImages.has(element) : false
    // The same junk rules as the static path, so the two layers cannot
    // disagree about what an asset is.
    if (!isSiteLogo && isSocialAssetUrl(absolute)) return
    if (!isSiteLogo && isJunkAssetUrl(absolute, altText ? tokenize(altText) : [])) return
    const key = normalizeAssetUrl(absolute)
    if (!key || seen.has(key)) return
    seen.add(key)
    candidates.push({ url: absolute, sourcePage: pageUrl, altText, ogContext, isSiteLogo })
  }

  $('img[src]').each((_i, elem) => {
    add($(elem).attr('src') || '', $(elem).attr('alt') || undefined, undefined, elem)
  })

  $('img[srcset]').each((_i, elem) => {
    const srcset = $(elem).attr('srcset') || ''
    const entries = srcset.split(',').map((s) => s.trim().split(/\s+/)[0]).filter(Boolean)
    for (const entry of entries) {
      add(entry, $(elem).attr('alt') || undefined, undefined, elem)
    }
  })

  $('picture source[srcset]').each((_i, elem) => {
    const srcset = $(elem).attr('srcset') || ''
    const entries = srcset.split(',').map((s) => s.trim().split(/\s+/)[0]).filter(Boolean)
    for (const entry of entries) {
      add(entry)
    }
  })

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

/**
 * Crawls a site over plain HTTP.
 *
 * `seedUrls` are the pages the sitemap pointed at. They are crawled first and
 * they are the reason the sitemap is worth fetching at all: before, the
 * sitemap URLs were discovered and then thrown away, so the crawl only ever
 * saw the pages the home page happened to link to.
 */
export async function discoverWithCrawlee(
  baseUrl: string,
  options: { seedUrls?: string[]; deadlineAt?: number } = {},
): Promise<DiscoveryResult> {
  const sanitized = sanitizeUrl(baseUrl)
  const origin = new URL(sanitized).origin
  const { seedUrls = [], deadlineAt } = options

  const allCandidates: ImageCandidate[] = []
  const seenUrls = new Set<string>()
  let pagesCrawled = 0

  const deadlineReached = () => Boolean(deadlineAt && Date.now() >= deadlineAt)

  /**
   * Milliseconds the run may still spend on ONE request.
   *
   * The crawler used to use the fixed per-request timeout, so a request that
   * started one millisecond before the deadline still ran for the whole
   * timeout: the synchronous phase of a discovery request overran its budget
   * by seconds (measured: 20.7s against a 12s budget on a slow site). Every
   * request is now clamped to the time that is actually left, and a request
   * that cannot finish inside the budget is never started.
   */
  const remainingBudgetMs = (): number => {
    if (!deadlineAt) return REQUEST_TIMEOUT
    const remaining = deadlineAt - Date.now()
    if (remaining <= 0) return 0
    return Math.min(REQUEST_TIMEOUT, remaining)
  }

  const addCandidate = (candidate: ImageCandidate) => {
    if (allCandidates.length >= MAX_RAW_CANDIDATES) return
    const key = normalizeAssetUrl(candidate.url)
    if (!key || seenUrls.has(key)) return
    seenUrls.add(key)
    allCandidates.push(candidate)
  }

  // Crawlee persists its request queue under `./storage` by default. On
  // Netlify the working directory is the read-only `/var/task`, so the crawl
  // died with `ENOENT: mkdir '/var/task/storage'`. A single crawl never needs
  // its queue to outlive the process: keep storage in memory, and point any
  // directory Crawlee still resolves at the writable temp directory.
  const crawleeConfig = new Configuration({
    persistStorage: false,
    storageClientOptions: { localDataDirectory: join(tmpdir(), 'crawlee-storage') },
  })

  const crawler = new CheerioCrawler({
    maxRequestsPerCrawl: MAX_PAGES,
    maxConcurrency: 2,
    maxRequestRetries: MAX_REQUEST_RETRIES,
    requestHandlerTimeoutSecs: REQUEST_TIMEOUT / 1000,
    ignoreHttpErrorStatusCodes: [404, 403],
    httpClient: new NoRedirectHttpClient(),
    preNavigationHooks: [
      async ({ request }, gotOptions) => {
        const budgetMs = remainingBudgetMs()
        if (budgetMs <= 0) {
          throw new Error('Discovery deadline reached')
        }
        if (isExcluded(request.url)) {
          throw new Error('Excluded by personalization policy')
        }
        try {
          const parsed = new URL(request.url)
          if (parsed.origin !== origin) {
            throw new Error('Excluded by personalization policy')
          }
        } catch (err) {
          if (err instanceof Error && err.message === 'Excluded by personalization policy') {
            throw err
          }
          // allow if URL parsing fails (shouldn't happen)
        }

        // The full destination gate (protocol, private / metadata literals,
        // and every address the host resolves to) runs before the request.
        const destination = await checkDestination(request.url, {})
        if (!destination.ok) {
          throw new Error(`Destination refused (${destination.reason})`)
        }

        // The request itself is bounded by the time the run has left, not by
        // the fixed per-request timeout. Without this a single slow page
        // could push the whole discovery request past its budget.
        gotOptions.timeout = { request: budgetMs }
        gotOptions.headers = {
          ...(gotOptions.headers || {}),
          'User-Agent': USER_AGENT,
        }
      },
    ],
    async requestHandler({ request, enqueueLinks, $, log }) {
      // A failed or timed-out request reaches the handler without a parsed
      // body. Dereferencing `$` there used to throw and made Crawlee retry
      // the same dead page three more times.
      if (!$) {
        log.debug(`[crawlee] no parsed body for ${request.url}; skipping`)
        return
      }
      if (deadlineReached()) return

      pagesCrawled++
      const html = $.html()
      const candidates = extractImagesFromHtml(sanitized, html, request.url)
      for (const candidate of candidates) {
        addCandidate(candidate)
      }

      // Enqueue only high-value personalization links
      const outgoing = request.loadedUrl
      if (outgoing) {
        try {
          const $links = cheerio.load(html)
          const base = new URL(outgoing)
          const links: string[] = []

          $links('a[href]').each((_i, elem) => {
            const href = $links(elem).attr('href') || ''
            try {
              const absolute = new URL(href, base).toString()
              if (new URL(absolute).origin !== origin) return
              if (isExcluded(absolute)) return
              if (scoreUrl(absolute) <= 0) return
              links.push(absolute)
            } catch {
              // skip
            }
          })

          const uniqueLinks = Array.from(new Set(links))
          await enqueueLinks({
            urls: uniqueLinks.slice(0, MAX_PAGES - 1),
            strategy: 'all',
          })
        } catch {
          // skip enqueue on parse errors
        }
      }
    },
  }, crawleeConfig)

  // The sitemap pages are crawled first: they are the pages a business
  // points a crawler at on purpose.
  const sameOriginSeeds = seedUrls.filter((url) => {
    try {
      return new URL(url).origin === origin
    } catch {
      return false
    }
  })
  const startUrls = [sanitized, ...sameOriginSeeds].slice(0, MAX_PAGES)

  // The run budget is already gone: there is nothing to crawl, and starting
  // the crawler would only burn the time that is left.
  if (remainingBudgetMs() <= 0) {
    return {
      candidates: allCandidates,
      provider: 'CRAWLEE_CHEERIO',
      pagesCrawled,
      rawCandidates: allCandidates.length,
      socialProfiles: [],
    }
  }

  await crawler.run(startUrls)

  return {
    candidates: allCandidates,
    provider: 'CRAWLEE_CHEERIO',
    pagesCrawled,
    rawCandidates: allCandidates.length,
    socialProfiles: [],
  }
}
