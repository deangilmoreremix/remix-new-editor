/**
 * Branding-asset extraction for a business website.
 *
 * Pure, offline helpers: they take HTML plus the URL the HTML was served from
 * and return structured evidence. No network access, no browser, no paid
 * provider, no model call — so they are directly unit-testable against inline
 * HTML fixtures.
 *
 * This module used to also host the video-marketing detector. The detector
 * that ships in `researchProvider.ts` (`detectVideoMarketing`) superseded it:
 * the two disagreed on whether a bare channel link proves video presence, and
 * keeping both invited drift, so the superseded copy was removed. Video
 * presence is reported by the research provider as `hasPromoVideo: true |
 * 'unknown'` — an unverified absence is never stated as "no videos".
 */

import * as cheerio from 'cheerio'

/** Branding assets discovered on a page. */
export interface BrandingAssets {
  /** Best single guess at the brand logo, if one was found. */
  logoUrl?: string
  /** Every usable branding image, including the logo. */
  imageUrls: string[]
  /** Number of usable branding assets. */
  count: number
}

/**
 * Heuristic for "this image is probably the logo": the file name, alt text
 * or class name mentions the logo, the brand or the business name.
 */
const LOGO_HINT = /(^|[\W_])(logo|brand|name)([\W_]|$)/i

/**
 * Parses a URL reference against the page URL. Returns undefined for values
 * that must never become absolute asset URLs (`data:`, `javascript:`, …) and
 * for values that cannot be resolved.
 */
function parseReference(raw: string | undefined, baseUrl: string): URL | undefined {
  const value = (raw || '').trim()
  if (!value) return undefined
  if (/^(data|javascript|blob|mailto|tel|about):/i.test(value)) return undefined
  try {
    return new URL(value, baseUrl)
  } catch {
    return undefined
  }
}

/** Resolves a candidate asset URL to an absolute http(s) URL. */
function resolveAssetUrl(raw: string | undefined, baseUrl: string): string | undefined {
  const url = parseReference(raw, baseUrl)
  if (!url) return undefined
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return undefined
  return url.toString()
}

/** Collects the `url` / `contentUrl` of a JSON-LD image-ish value. */
function collectJsonLdAssetUrls(value: unknown, out: string[]): void {
  if (typeof value === 'string') {
    if (value.trim()) out.push(value.trim())
    return
  }
  if (Array.isArray(value)) {
    for (const item of value) collectJsonLdAssetUrls(item, out)
    return
  }
  if (!value || typeof value !== 'object') return
  const record = value as Record<string, unknown>
  for (const key of ['url', 'contentUrl', '@id']) {
    const candidate = record[key]
    if (typeof candidate === 'string' && candidate.trim()) {
      out.push(candidate.trim())
      break
    }
  }
}

/** Parses every JSON-LD block, tolerating invalid JSON in any single block. */
function parseJsonLdBlocks($: cheerio.CheerioAPI): Record<string, unknown>[] {
  const blocks: Record<string, unknown>[] = []
  $('script[type="application/ld+json"]').each((_i, elem) => {
    try {
      const parsed = JSON.parse($(elem).text() || '')
      if (Array.isArray(parsed)) {
        blocks.push(...(parsed as Record<string, unknown>[]))
      } else if (parsed && typeof parsed === 'object') {
        blocks.push(parsed as Record<string, unknown>)
      }
    } catch {
      // A malformed JSON-LD block says nothing about the page's assets.
    }
  })
  return blocks
}

/**
 * Finds usable branding assets on a page: social preview images, structured
 * data logos, touch icons, favicons and logo-looking `<img>` elements.
 *
 * Every asset is returned as an absolute URL resolved against `finalUrl`;
 * unusable references (`data:`, `javascript:`, unresolvable) are dropped.
 */
export function detectBrandingAssets(html: string, finalUrl: string): BrandingAssets {
  const $ = cheerio.load(html || '')
  const imageUrls: string[] = []
  const seen = new Set<string>()
  const logoCandidates: Array<{ url: string; priority: number }> = []

  const addAsset = (raw: string | undefined, priority: number): string | undefined => {
    const url = resolveAssetUrl(raw, finalUrl)
    if (!url) return undefined
    if (!seen.has(url)) {
      seen.add(url)
      imageUrls.push(url)
    }
    logoCandidates.push({ url, priority })
    return url
  }

  // Priority order for the single "best logo" slot: the social preview image
  // first (it matches the logo the site itself advertises), then structured
  // data, then icon rels, then logo-looking images.
  $('meta').each((_i, elem) => {
    const key = ($(elem).attr('property') || $(elem).attr('name') || '').toLowerCase()
    if (key === 'og:image' || key === 'og:image:url' || key === 'og:image:secure_url') {
      addAsset($(elem).attr('content'), 0)
    } else if (key === 'og:logo') {
      addAsset($(elem).attr('content'), 5)
    }
  })

  const jsonLdBlocks = parseJsonLdBlocks($)
  for (const block of jsonLdBlocks) {
    const logoUrls: string[] = []
    collectJsonLdAssetUrls(block.logo, logoUrls)
    for (const candidate of logoUrls) addAsset(candidate, 1)
    const imageUrlsFromLd: string[] = []
    collectJsonLdAssetUrls(block.image, imageUrlsFromLd)
    for (const candidate of imageUrlsFromLd) addAsset(candidate, 2)
  }

  $('link[rel]').each((_i, elem) => {
    const rel = ($(elem).attr('rel') || '').toLowerCase()
    const href = $(elem).attr('href')
    if (!href) return
    if (rel.includes('apple-touch-icon')) addAsset(href, 3)
    else if (rel.includes('icon')) addAsset(href, 4)
  })

  $('img').each((_i, elem) => {
    const src = $(elem).attr('src') || $(elem).attr('data-src') || ''
    const alt = $(elem).attr('alt') || ''
    const className = $(elem).attr('class') || ''
    const haystack = `${src} ${alt} ${className}`.toLowerCase()
    if (!LOGO_HINT.test(haystack)) return
    addAsset(src, 6)
  })

  const logoUrl = logoCandidates
    .slice()
    .sort((a, b) => a.priority - b.priority)[0]?.url

  return {
    logoUrl,
    imageUrls,
    count: imageUrls.length,
  }
}
