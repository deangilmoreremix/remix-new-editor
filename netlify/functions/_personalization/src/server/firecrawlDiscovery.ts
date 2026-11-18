/**
 * Firecrawl-backed business asset discovery provider.
 *
 * Uses the Firecrawl REST API with server-side FIRECRAWL_API_KEY.
 * Images are returned as normalized ImageCandidate references;
 * download/upload/classification remain in the existing pipeline.
 */

import type { ImageCandidate, DiscoveryResult, SocialProfileSource, SourceType } from './discoveryProvider'
import * as cheerio from 'cheerio'
import { isCrawlablePageUrl } from './pageSignals'

const FIRECRAWL_BASE_URL = 'https://api.firecrawl.dev/v2'
const FIRECRAWL_SCRAPE_LIMIT = 5

const HIGH_VALUE_PATH_PRIORITY: Array<{ patterns: RegExp[]; score: number; label: string }> = [
  { patterns: [/\/about-us?$/i, /\/our-story$/i, /\/team$/i, /\/our-team$/i, /\/staff$/i, /\/leadership$/i, /\/meet-the-team$/i], score: 90, label: 'ABOUT' },
  { patterns: [/\/services$/i, /\/our-services$/i, /\/products$/i, /\/menu$/i, /\/treatments$/i, /\/solutions$/i, /\/what-we-do$/i], score: 90, label: 'SERVICES' },
  { patterns: [/\/gallery$/i, /\/portfolio$/i, /\/projects$/i, /\/our-work$/i, /\/before-after$/i, /\/case-studies$/i], score: 95, label: 'PORTFOLIO' },
  { patterns: [/\/contact$/i, /\/locations$/i, /\/showroom$/i, /\/office$/i], score: 70, label: 'LOCATION' },
  { patterns: [/\/about/i, /\/team/i, /\/staff/i], score: 80, label: 'ABOUT' },
  { patterns: [/\/service/i, /\/product/i, /\/menu/i], score: 80, label: 'SERVICES' },
  { patterns: [/\/gallery/i, /\/portfolio/i, /\/project/i, /\/work/i], score: 85, label: 'PORTFOLIO' },
]

const LOW_VALUE_PATH_FRAGMENTS = [
  '/cart', '/checkout', '/login', '/signin', '/sign-up', '/register', '/blog', '/privacy', '/terms', '/legal', '/wp-admin', '/admin',
]

const SOCIAL_DOMAINS: Record<string, SourceType> = {
  'instagram.com': 'INSTAGRAM',
  'facebook.com': 'FACEBOOK',
  'linkedin.com': 'LINKEDIN',
  'tiktok.com': 'TIKTOK',
  'youtube.com': 'YOUTUBE',
  'x.com': 'X',
  'twitter.com': 'X',
  'pinterest.com': 'PINTEREST',
}

export class FirecrawlDiscoveryProvider {
  readonly name = 'FIRECRAWL'
  private apiKey: string

  constructor(apiKey: string) {
    if (!apiKey) {
      throw new Error('Firecrawl API key is required')
    }
    this.apiKey = apiKey
  }

  async discover(options: {
    websiteUrl: string
    maxPages: number
    maxImages: number
  }): Promise<DiscoveryResult> {
    const { websiteUrl, maxPages, maxImages } = options
    const baseUrl = new URL(websiteUrl)

    let homeHtml: string | null = null
    try {
      homeHtml = await this.scrapePage(baseUrl.toString())
    } catch (homeError) {
      throw new Error(`Firecrawl could not scrape the homepage: ${homeError instanceof Error ? homeError.message : 'unknown error'}`)
    }
    if (!homeHtml) {
      throw new Error('Firecrawl could not scrape the homepage: no content returned')
    }

    const internalUrls = extractInternalLinks(homeHtml, baseUrl.toString())
    const selectedPages = selectHighValuePages(baseUrl.toString(), internalUrls, Math.min(maxPages, FIRECRAWL_SCRAPE_LIMIT))

    const pagesToScrape = [baseUrl.toString(), ...selectedPages.map(url => url.url)]
    const pages: Array<{ url: string; html: string }> = []
    const candidates: ImageCandidate[] = []
    const seen = new Set<string>()
    const socialProfiles: SocialProfileSource[] = []
    const socialSeen = new Set<string>()

    for (const pageUrl of pagesToScrape) {
      try {
        const html = await this.scrapePage(pageUrl)
        if (!html) continue

        pages.push({ url: pageUrl, html })
        const pageCandidates = extractImageCandidatesFromHtml(html, pageUrl, maxImages - candidates.length)
        for (const candidate of pageCandidates) {
          if (seen.has(candidate.url)) continue
          seen.add(candidate.url)
          candidates.push({
            ...candidate,
            sourceType: 'FIRECRAWL',
            sourcePageType: candidate.sourcePageType || guessPageType(pageUrl),
          })
        }

        const pageSocialProfiles = extractSocialProfiles(html, pageUrl)
        for (const profile of pageSocialProfiles) {
          const key = `${profile.socialProfileUrl}`
          if (socialSeen.has(key)) continue
          socialSeen.add(key)
          socialProfiles.push(profile)
        }
      } catch (pageError) {
        console.log(`[firecrawl] failed to scrape ${pageUrl}: ${pageError instanceof Error ? pageError.message : 'unknown error'}`)
        continue
      }
    }

    if (pages.length === 0) {
      throw new Error('Firecrawl returned no usable pages')
    }

    return {
      candidates,
      provider: this.name,
      pagesCrawled: pages.length,
      rawCandidates: candidates.length,
      socialProfiles,
    }
  }

  private async scrapePage(pageUrl: string): Promise<string | null> {
    const canonicalUrl = canonicalizePageUrl(pageUrl)
    try {
      const response = await this.requestWithRetry('/scrape', {
        url: canonicalUrl,
        formats: ['html', 'markdown'],
        onlyMainContent: false,
      }) as { html?: string; markdown?: string; data?: Array<{ html?: string; markdown?: string }> } | null

      const html = response?.html || response?.markdown || (Array.isArray(response?.data) && response.data[0]?.html) || null
      return html as string | null
    } catch (error) {
      throw new Error(`Firecrawl could not scrape ${canonicalUrl}: ${error instanceof Error ? error.message : 'unknown error'}`)
    }
  }

  private async requestWithRetry(path: string, body: Record<string, unknown>, method = 'POST', attempts = 2): Promise<unknown> {
    const url = `${FIRECRAWL_BASE_URL}${path}`
    const lastError = new Error('Firecrawl request failed')

    for (let attempt = 1; attempt <= attempts; attempt++) {
      try {
        const response = await fetch(url, {
          method,
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.apiKey}`,
          },
          body: method === 'POST' ? JSON.stringify(body) : undefined,
        })

        if (!response.ok) {
          const text = await response.text().catch(() => '')
          lastError.message = `Firecrawl error ${response.status}: ${text || response.statusText}`
          continue
        }

        return await response.json()
      } catch (err) {
        lastError.message = err instanceof Error ? err.message : 'Firecrawl request failed'
      }
    }

    throw lastError
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractHtmlFromFirecrawlPage(page: any): string | null {
  const html = typeof page?.html === 'string' ? page.html : null
  const markdown = typeof page?.markdown === 'string' ? page.markdown : null
  const content = typeof page?.content === 'string' ? page.content : null
  return html || markdown || content || null
}

function extractImageCandidatesFromHtml(html: string, pageUrl: string, maxImages: number): ImageCandidate[] {
  const $ = cheerio.load(html)
  const candidates: ImageCandidate[] = []
  const seen = new Set<string>()

  const add = (rawUrl: string, extra?: Partial<ImageCandidate>) => {
    if (!rawUrl || rawUrl.startsWith('data:')) return
    let absolute: string
    try {
      absolute = new URL(rawUrl, pageUrl).toString()
    } catch {
      return
    }
    const canonical = canonicalizePageUrl(absolute)
    if (seen.has(canonical)) return
    if (isLikelyJunk(canonical)) return
    seen.add(canonical)
    candidates.push({
      url: canonical,
      sourcePage: pageUrl,
      ...extra,
    })
    if (candidates.length >= maxImages) throw new Error('MAX_IMAGES_REACHED')
  }

  try {
    $('img').each((_i, elem) => {
      const src = $(elem).attr('src') || ''
      const srcset = $(elem).attr('srcset') || ''
      const alt = $(elem).attr('alt') || undefined
      const parentAnchor = $(elem).closest('a[href]')
      const linkTarget = parentAnchor.attr('href') || undefined
      const nearbyText = getNearbyTextCheerio($, elem)

      const extra: Partial<ImageCandidate> = {
        altText: alt,
        ogContext: nearbyText || undefined,
      }
      if (linkTarget) {
        try {
          extra.linkTarget = new URL(linkTarget, pageUrl).toString()
        } catch {
          // ignore
        }
      }

      if (src) add(src, extra)
      if (srcset) {
        for (const entry of srcset.split(',').map((s: string) => s.trim().split(/\s+/)[0]).filter(Boolean)) {
          add(entry, extra)
        }
      }
    })

    $('source[srcset]').each((_i, elem) => {
      const srcset = $(elem).attr('srcset') || ''
      for (const entry of srcset.split(',').map((s: string) => s.trim().split(/\s+/)[0]).filter(Boolean)) {
        add(entry)
      }
    })

    const ogImage = $('meta[property="og:image"]').attr('content')
    if (ogImage) add(ogImage)
    const twitterImage = $('meta[name="twitter:image"]').attr('content')
    if (twitterImage) add(twitterImage)
  } catch {
    // ignore extraction errors
  }

  return candidates
}

function getNearbyTextCheerio($: ReturnType<typeof cheerio.load>, elem: import('domhandler').Element): string | null {
  const maxLength = 120
  const text = $(elem).text() || ''
  const trimmed = text.trim().replace(/\s+/g, ' ')
  if (trimmed.length === 0) return null
  if (trimmed.length <= maxLength) return trimmed
  return trimmed.slice(0, maxLength)
}

function extractSocialProfiles(html: string, pageUrl: string): SocialProfileSource[] {
  const $ = cheerio.load(html)
  const profiles: SocialProfileSource[] = []
  const seen = new Set<string>()

  const add = (href: string, sourceType: SourceType) => {
    if (!href) return
    let absolute: string
    try {
      absolute = new URL(href, pageUrl).toString()
    } catch {
      return
    }
    const normalized = normalizeSocialUrl(absolute, sourceType)
    if (!normalized || seen.has(normalized)) return
    seen.add(normalized)
    profiles.push({
      sourceType,
      sourcePageUrl: pageUrl,
      socialProfileUrl: normalized,
    })
  }

  try {
    $('a[href]').each((_i, elem) => {
      const href = $(elem).attr('href') || ''
      const lower = href.toLowerCase()
      for (const [domain, sourceType] of Object.entries(SOCIAL_DOMAINS)) {
        if (lower.includes(domain)) {
          add(href, sourceType)
          break
        }
      }
    })
  } catch {
    // ignore extraction errors
  }

  return profiles
}

function normalizeSocialUrl(url: string, sourceType: SourceType): string | null {
  try {
    const parsed = new URL(url)
    const hostname = parsed.hostname.toLowerCase()

    switch (sourceType) {
      case 'INSTAGRAM':
        return hostname.includes('instagram.com') ? url : null
      case 'FACEBOOK':
        return hostname.includes('facebook.com') ? url : null
      case 'LINKEDIN':
        return hostname.includes('linkedin.com') ? url : null
      case 'TIKTOK':
        return hostname.includes('tiktok.com') ? url : null
      case 'YOUTUBE':
        return hostname.includes('youtube.com') || hostname.includes('youtu.be') ? url : null
      case 'X':
        return hostname.includes('x.com') || hostname.includes('twitter.com') ? url.replace('twitter.com', 'x.com') : null
      case 'PINTEREST':
        return hostname.includes('pinterest.com') ? url : null
      default:
        return url
    }
  } catch {
    return null
  }
}

function isLikelyJunk(url: string): boolean {
  const lower = url.toLowerCase()
  const path = new URL(url).pathname.toLowerCase()

  const junkFragments = [
    'favicon', 'icon', 'sprite', 'pixel', 'tracking', 'analytics', 'beacon',
    '1x1', 'spacer', 'loader', 'spinner', 'placeholder', 'blank',
  ]
  if (junkFragments.some((frag) => path.includes(frag))) return true

  const socialDomains = [
    'facebook.com', 'twitter.com', 'x.com', 'instagram.com', 'linkedin.com',
    'youtube.com', 'tiktok.com', 'pinterest.com', 'yelp.com', 'google.com',
    'maps.google', 'goo.gl', 'bit.ly', 'tinyurl.com',
  ]
  if (socialDomains.some((d) => lower.includes(d))) return true

  return false
}

function canonicalizePageUrl(raw: string): string {
  try {
    const url = new URL(raw)
    url.hash = ''
    if (url.pathname.endsWith('/')) url.pathname = url.pathname.slice(0, -1)
    return url.toString().toLowerCase()
  } catch {
    return raw
  }
}

function extractInternalLinks(html: string, baseUrl: string): string[] {
  const $ = cheerio.load(html)
  const seen = new Set<string>()
  const results: string[] = []

  $('a[href]').each((_i, elem) => {
    const href = $(elem).attr('href') || ''
    let absolute: string
    try {
      absolute = new URL(href, baseUrl).toString()
    } catch {
      return
    }

    const canonical = canonicalizePageUrl(absolute)
    if (seen.has(canonical)) return
    seen.add(canonical)

    const host = new URL(canonical).host
    if (host !== new URL(baseUrl).host) return
    if (LOW_VALUE_PATH_FRAGMENTS.some((frag) => canonical.toLowerCase().includes(frag))) return
    if (!isCrawlablePageUrl(canonical)) return

    results.push(canonical)
  })

  return results
}

function scorePageUrl(url: string): { score: number; label: string } {
  const path = new URL(url).pathname.toLowerCase()
  const exactMatch = HIGH_VALUE_PATH_PRIORITY.find((group) => group.patterns.some((pattern) => pattern.test(path)))
  if (exactMatch) return { score: exactMatch.score, label: exactMatch.label }

  const partialMatch = HIGH_VALUE_PATH_PRIORITY.find((group) => group.patterns.some((pattern) => pattern.test(path)))
  if (partialMatch) return { score: partialMatch.score - 10, label: partialMatch.label }

  if (path === '/' || path === '') return { score: 100, label: 'HOME' }
  return { score: 20, label: 'OTHER' }
}

function selectHighValuePages(baseUrl: string, urls: string[], maxPages: number): Array<{ url: string; score: number; label: string }> {
  const scored = urls
    .map((url) => ({ url, ...scorePageUrl(url) }))
    .filter((item) => item.score >= 70)
    .sort((a, b) => b.score - a.score || a.url.localeCompare(b.url))

  const seen = new Set<string>()
  const selected: Array<{ url: string; score: number; label: string }> = []

  for (const item of scored) {
    if (selected.length >= maxPages) break
    const canonical = canonicalizePageUrl(item.url)
    if (seen.has(canonical)) continue
    seen.add(canonical)
    selected.push({ ...item, url: canonical })
  }

  return selected
}

function guessPageType(url: string): string {
  const { score, label } = scorePageUrl(url)
  return label
}

