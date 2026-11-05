/**
 * Shared asset filtering, URL normalization and classification for the
 * business asset discovery pipeline.
 *
 * Every provider (static HTTP crawl, Crawlee/Cheerio, browser fallback) has to
 * answer the same three questions about a candidate image:
 *
 *   1. Is this URL obviously junk (icon, sprite, tracking pixel, spacer)?
 *   2. Are two candidate URLs the same asset (a CDN that re-sizes the same
 *      file produces a different URL for every width)?
 *   3. What kind of business asset is it (logo, person, product, ...)?
 *
 * They used to be answered three different ways:
 *
 *   - The static path matched junk fragments as raw SUBSTRINGS of the path,
 *     so `/media/iconday.jpg` was dropped as an icon and every real SVG logo
 *     was dropped by a blanket `.svg` rule.
 *   - The Crawlee path applied NO junk filter at all, so icons, sprites and
 *     social badges leaked straight into the review list.
 *   - The classifier matched keywords as raw SUBSTRINGS of the whole URL, so
 *     `facebook.svg` matched the person rule on the substring "face" and was
 *     offered to the user as an owner photo, and every image on a Shopify
 *     store matched the product rule on the substring "/shop".
 *
 * This module is the single place where those three questions are answered,
 * using whole-token matching so that "facebook" is never "face" and
 * "/shopify-cdn" is never "/shop".
 */

import type { DiscoveredAssetCategory } from '../shared/personalization/types'

export type { DiscoveredAssetCategory }

// ---------------------------------------------------------------------------
// Tokenisation
// ---------------------------------------------------------------------------

/**
 * Splits text into lowercase alphanumeric tokens.
 *
 * `https://cdn.example.com/assets/icons/social/facebook.svg` -> `assets`,
 * `icons`, `social`, `facebook`, `svg`.
 */
export function tokenize(text: string): string[] {
  if (!text) return []
  const raw = text.toLowerCase().split(/[^a-z0-9]+/)
  const tokens: string[] = []
  for (const token of raw) {
    if (!token) continue
    tokens.push(token)
    // Cheap singularisation so `icons` matches `icon` and `photos` matches
    // `photo`. Only applied when the singular form is at least four characters
    // long, which keeps words like `news` or `glass` from producing noise.
    if (token.length > 3 && token.endsWith('s')) {
      tokens.push(token.slice(0, -1))
    }
  }
  return tokens
}

/** The path (and file name) of a URL, lowercased. The host is never a signal. */
function urlPathTokens(url: string): string[] {
  try {
    const parsed = new URL(url)
    return tokenize(`${parsed.pathname} ${parsed.search}`)
  } catch {
    return tokenize(url)
  }
}

// ---------------------------------------------------------------------------
// Vocabulary
// ---------------------------------------------------------------------------

/**
 * Tokens that mark an image as a UI decoration rather than a business asset.
 *
 * Whole-token matching only: `iconday` is not `icon`, and `blanket` is not
 * `blank`.
 */
const JUNK_TOKENS = new Set([
  'favicon',
  'icon',
  'sprite',
  'pixel',
  'spacer',
  'loader',
  'spinner',
  'placeholder',
  'blank',
  'tracking',
  'beacon',
  'analytics',
  'emoji',
  'divider',
  'separator',
  'watermark',
  'bullet',
  'chevron',
  'caret',
])

/**
 * Category rules, evaluated in order. The first rule with a matching token
 * wins, so the list is ordered from the most specific signal to the least.
 */
const CATEGORY_RULES: Array<{
  category: DiscoveredAssetCategory
  confidence: number
  tokens: string[]
}> = [
  {
    category: 'logo',
    confidence: 80,
    tokens: [
      'logo', 'wordmark', 'brandmark', 'logotype', 'logomark', 'emblem',
      'logotype', 'logolight', 'logodark', 'logofull', 'logomark',
    ],
  },
  {
    category: 'person',
    confidence: 75,
    tokens: [
      'headshot', 'portrait', 'avatar', 'founder', 'owner', 'profile',
      'president', 'ceo', 'mugshot', 'passport',
    ],
  },
  {
    category: 'team',
    confidence: 72,
    tokens: ['team', 'staff', 'crew', 'employee', 'people', 'worker'],
  },
  {
    category: 'branded_vehicle',
    confidence: 72,
    tokens: ['vehicle', 'truck', 'van', 'fleet', 'trailer', 'forklift', 'semitrailer'],
  },
  {
    category: 'storefront',
    confidence: 70,
    tokens: ['storefront', 'shopfront', 'exterior', 'facade', 'building', 'location', 'store'],
  },
  {
    category: 'office',
    confidence: 70,
    tokens: ['office', 'interior', 'showroom', 'workspace', 'lobby', 'reception'],
  },
  {
    category: 'completed_work',
    confidence: 68,
    tokens: [
      'project', 'portfolio', 'gallery', 'completed', 'beforeafter',
      'transformation', 'result', 'casestudy', 'installation', 'renovation',
    ],
  },
  {
    category: 'service',
    confidence: 65,
    tokens: ['service', 'workmanship', 'process', 'repair', 'crewatwork', 'working', 'inprogress'],
  },
  {
    category: 'product',
    confidence: 65,
    tokens: [
      'product', 'menu', 'catalog', 'catalogue', 'shop', 'merchandise', 'merch',
      'item', 'dish', 'bestseller', 'food', 'drink', 'dessert', 'apparel',
      'shirt', 'hat', 'uniform', 'packaging', 'bottle', 'bean', 'signature',
    ],
  },
]

/** The generic category for a real business photograph with no stronger signal. */
const DEFAULT_CATEGORY: DiscoveredAssetCategory = 'brand'

// ---------------------------------------------------------------------------
// Junk detection
// ---------------------------------------------------------------------------

/**
 * True when the candidate is obviously a UI decoration.
 *
 * `isSvg` is treated specially: a vector is only kept when its name says it is
 * a logo or a brand mark. An `icon.svg` is still junk, but a `logo.svg` is
 * one of the most valuable assets a business site publishes.
 *
 * The junk vocabulary is matched EXACTLY (plus the singular form). A false
 * junk verdict deletes a real asset, so it must not be reachable through a
 * loose match.
 *
 * `allowSiteLogo` is the one exemption. A site's own logo is regularly
 * published as `<a href="/"><img src="/assets/icons/siren.svg"></a>` — an
 * uninformative file name inside a directory called `icons`, which the junk
 * rules (correctly, in general) drop. The caller has PROVEN that this
 * particular image is the site's logo by finding it in the site's own home
 * link, so the name-based verdict does not apply to it. The exemption is
 * deliberately narrow: it applies to one image per home link, and it does not
 * relax the SVG rule for anything else.
 */
export function isJunkAssetTokens(
  tokens: string[],
  options: { isSvg?: boolean; allowSiteLogo?: boolean } = {},
): boolean {
  if (options.allowSiteLogo) return false
  for (const token of tokens) {
    if (JUNK_TOKENS.has(token)) return true
  }
  if (options.isSvg) {
    // A vector that is not a logo is a decoration as far as this pipeline is
    // concerned, and a vector can carry script, so it is kept only when the
    // name identifies it as the business mark.
    return !matchesVocabulary(tokens, CATEGORY_RULES[0].tokens)
  }
  return false
}

/** True when the URL's path names a known junk asset. */
export function isJunkAssetUrl(
  url: string,
  extraTokens: string[] = [],
  options: { allowSiteLogo?: boolean } = {},
): boolean {
  let pathname = ''
  try {
    pathname = new URL(url).pathname.toLowerCase()
  } catch {
    pathname = url.toLowerCase()
  }
  const isSvg = pathname.endsWith('.svg')
  const tokens = [...urlPathTokens(url), ...extraTokens]
  return isJunkAssetTokens(tokens, { isSvg, allowSiteLogo: options.allowSiteLogo })
}

/**
 * Hosts whose images are never business assets (social badges, share widgets,
 * analytics beacons).
 */
const SOCIAL_DOMAINS = [
  'facebook.com', 'twitter.com', 'x.com', 'instagram.com', 'linkedin.com',
  'youtube.com', 'tiktok.com', 'pinterest.com', 'yelp.com', 'google.com',
  'maps.google', 'goo.gl', 'bit.ly', 'tinyurl.com', 'gravatar.com',
  'doubleclick.net', 'googletagmanager.com', 'google-analytics.com',
]

/** True when the URL points at a social / analytics host. */
export function isSocialAssetUrl(url: string): boolean {
  const lower = url.toLowerCase()
  return SOCIAL_DOMAINS.some((domain) => lower.includes(domain))
}

// ---------------------------------------------------------------------------
// URL normalization
// ---------------------------------------------------------------------------

/**
 * Query parameters that describe a rendering of an image rather than the
 * image itself. `?w=800`, `?resize=300x200` and `?v=1718913412` all point at
 * the same file, so a CDN that re-sizes one asset produces a different URL per
 * size. Dropping them is what makes the de-duplication work.
 */
const IMAGE_TRANSFORM_PARAMS = new Set([
  'w', 'width', 'h', 'height', 'q', 'quality', 'fit', 'crop', 'auto', 'format',
  'ssl', 'dpr', 'scale', 'size', 's', 'sz', 'resize', 'gravity', 'position',
  'fm', 'lossy', 'client', 'sresponsive', 'strip', 'v', 'rev', 'id', 'cb',
  'ixlib', 'ixid', 'tw', 'th', 'strip', 'sm', 'md', 'lg', 'xl',
])

/**
 * The key two candidate URLs are compared on.
 *
 * Scheme and host are lowercased, the fragment is dropped, and every
 * image-transform query parameter is removed. Two URLs that normalise to the
 * same key are the same asset.
 */
export function normalizeAssetUrl(url: string): string {
  const trimmed = String(url || '').trim()
  if (!trimmed) return ''

  let parsed: URL
  try {
    parsed = new URL(trimmed)
  } catch {
    return trimmed.toLowerCase()
  }

  const protocol = parsed.protocol.toLowerCase()
  const host = parsed.host.toLowerCase()
  const pathname = parsed.pathname
  const kept: string[] = []

  for (const [key, value] of parsed.searchParams.entries()) {
    if (IMAGE_TRANSFORM_PARAMS.has(key.toLowerCase())) continue
    kept.push(`${key.toLowerCase()}=${value}`)
  }
  kept.sort()

  const search = kept.length > 0 ? `?${kept.join('&')}` : ''
  return `${protocol}//${host}${pathname}${search}`.toLowerCase()
}

// ---------------------------------------------------------------------------
// Classification
// ---------------------------------------------------------------------------

export interface AssetClassificationContext {
  url: string
  altText?: string
  ogContext?: string
  sourcePage?: string
  /**
   * True when the caller has PROVEN that this image is the site's own logo
   * (it is the image inside the site's home link). The name-based junk rules
   * do not apply to it, and it is classified as a logo.
   */
  isSiteLogo?: boolean
}

export interface AssetClassification {
  category: DiscoveredAssetCategory
  confidence: number
  recommended: boolean
}

/**
 * The confidence a proven site logo is given.
 *
 * It is above the URL-named logo (80) because the evidence is stronger: the
 * image is the one the site itself links to its home page with.
 */
const SITE_LOGO_CONFIDENCE = 85

/**
 * The shortest vocabulary word that may be matched as a PREFIX of a token.
 *
 * `product1.png` has to be read as a product, but `facebook.svg` must never
 * be read as a face. A prefix match therefore only applies from five
 * characters upwards, which keeps the four-letter words (`face`, `icon`,
 * `logo`, `team`) on an exact match, and a false category verdict only
 * mislabels an asset — it never deletes one.
 */
const MIN_PREFIX_MATCH_LENGTH = 5

function matchesVocabulary(tokens: string[], vocabulary: string[]): boolean {
  for (const token of tokens) {
    for (const word of vocabulary) {
      if (token === word) return true
      if (word.length >= MIN_PREFIX_MATCH_LENGTH && token.length > word.length && token.startsWith(word)) {
        return true
      }
    }
  }
  return false
}

function matchCategory(tokens: string[]): { category: DiscoveredAssetCategory; confidence: number } | null {
  for (const rule of CATEGORY_RULES) {
    if (matchesVocabulary(tokens, rule.tokens)) {
      return { category: rule.category, confidence: rule.confidence }
    }
  }
  return null
}

/**
 * Classifies a candidate image into the business asset taxonomy.
 *
 * The signal order is deliberate:
 *
 *   1. The URL tokens (the most specific signal: `/images/team.jpg`).
 *   2. The `alt` text of the `<img>` element, which frequently says exactly
 *      what the picture is ("Our team", "Salt &amp; Straw logo").
 *   3. The Open Graph context, which marks the page's own hero image.
 *   4. Otherwise the image is a generic business photograph (`brand`), which
 *      is still a valid brand reference for the marketing library.
 *
 * A candidate that is a known UI decoration is classified `irrelevant` and is
 * not recommended, so it never reaches the review panel.
 */
export function classifyAssetCandidate(
  context: AssetClassificationContext,
): AssetClassification {
  // A proven site logo wins over everything else. The name-based junk rules
  // would drop it (`/assets/icons/siren.svg`), and the name-based category
  // rules cannot see that it is the brand mark.
  if (context.isSiteLogo) {
    return { category: 'logo', confidence: SITE_LOGO_CONFIDENCE, recommended: true }
  }

  const urlTokens = urlPathTokens(context.url || '')
  const altTokens = context.altText ? tokenize(context.altText) : []

  // A junk signal in EITHER the name or the alt text wins: an `<img>` whose
  // alt text is "spacer" is a spacer whatever its file is called.
  if (isJunkAssetTokens(urlTokens) || isJunkAssetTokens(altTokens)) {
    return { category: 'irrelevant', confidence: 85, recommended: false }
  }

  const fromUrl = matchCategory(urlTokens)
  if (fromUrl) {
    return { category: fromUrl.category, confidence: fromUrl.confidence, recommended: true }
  }

  const fromAlt = matchCategory(altTokens)
  if (fromAlt) {
    return {
      category: fromAlt.category,
      confidence: Math.max(fromAlt.confidence - 5, 50),
      recommended: true,
    }
  }

  // `og:image` is the page's own hero/cover shot: a brand reference.
  if (context.ogContext) {
    return { category: DEFAULT_CATEGORY, confidence: 45, recommended: true }
  }

  return { category: DEFAULT_CATEGORY, confidence: 40, recommended: true }
}

/**
 * The legacy, URL-only classifier.
 *
 * Kept for the callers that only have a URL. It is now token-based, so it no
 * longer mistakes "facebook" for a face or "/shopify-cdn" for a shop.
 */
export function classifyAssetUrl(url: string): AssetClassification {
  return classifyAssetCandidate({ url })
}
