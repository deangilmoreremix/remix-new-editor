/**
 * Pure, network-free signals read from an already-fetched HTML page.
 *
 * Ideas adapted from the Scrapling scraping library (BSD-3), re-implemented
 * in TypeScript on top of Cheerio so they run inside the existing Node /
 * Netlify discovery pipeline at no extra cost:
 *
 *   - extractEmbeddedImageUrls: site builders (Next.js, Nuxt, Wix,
 *     Squarespace, Shopify, Gatsby) ship their page content as JSON inside
 *     the HTML. Reading it recovers the images of a JS-rendered site without
 *     launching a browser.
 *   - extractImageContext: the words AROUND an image (figcaption, nearest
 *     heading, section id/class) classify it when its file name is a CDN hash.
 *   - elementStructureKey + propagateSimilarCategories: Scrapling's
 *     "find similar elements". Images that sit in the same repeated structure
 *     (a product grid, a team list, a gallery) are the same kind of asset.
 *   - extractBrandColors: theme-color meta, CSS brand variables and the most
 *     used non-neutral colours give the template a brand palette.
 *   - looksJsRendered: detects an empty JS shell, so the caller can escalate
 *     to the (existing) browser layer only when it is worth it.
 *   - htmlToMarkdown: clean page text for AI copy generation.
 *
 * Nothing here performs a request. Every function is bounded (input caps,
 * output caps) so a hostile page cannot make it run away.
 */

import * as cheerio from 'cheerio'
import type { CheerioAPI } from 'cheerio'
import type { DiscoveredAssetCategory } from '../shared/personalization/types'

// ---------------------------------------------------------------------------
// Shared limits
// ---------------------------------------------------------------------------

/** Largest inline script / JSON blob that is inspected. */
const MAX_SCRIPT_CHARS = 2_000_000
/** Largest number of embedded image URLs returned for one page. */
const MAX_EMBEDDED_IMAGES = 40
/** Deepest JSON nesting walked. */
const MAX_JSON_DEPTH = 40
/** Most JSON nodes visited for one blob. */
const MAX_JSON_NODES = 50_000

const IMAGE_EXTENSION = /\.(?:jpe?g|png|webp|avif|gif|svg)(?:$|[?#])/i

/** Image CDNs whose URLs often carry no file extension. */
const IMAGE_CDN_HOSTS = [
  'static.wixstatic.com',
  'images.squarespace-cdn.com',
  'static1.squarespace.com',
  'cdn.shopify.com',
  'images.ctfassets.net',
  'cdn.sanity.io',
  'images.prismic.io',
  'res.cloudinary.com',
  'images.unsplash.com',
  'img1.wsimg.com',
  'lirp.cdn-website.com',
  'irp.cdn-website.com',
]

function isImageLikeUrl(value: string): boolean {
  if (!value || value.length > 2048) return false
  if (value.startsWith('data:')) return false
  if (IMAGE_EXTENSION.test(value)) return true
  try {
    const host = new URL(value, 'https://x.invalid/').hostname
    return IMAGE_CDN_HOSTS.some((cdn) => host === cdn || host.endsWith(`.${cdn}`))
  } catch {
    return false
  }
}

function resolveUrl(raw: string, baseUrl: string): string | null {
  const value = raw.trim()
  if (!value) return null
  // Absolute, protocol-relative or root-relative only: a bare word in a JSON
  // blob ("hero.jpg") is too ambiguous to resolve against the page.
  if (!/^(?:https?:)?\/\//i.test(value) && !value.startsWith('/')) return null
  try {
    const url = new URL(value, baseUrl)
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null
    return url.toString()
  } catch {
    return null
  }
}

/** Undoes the escaping a URL picks up inside a JS / JSON string literal. */
function unescapeScriptUrl(value: string): string {
  return value
    .replace(/\\u002[fF]/g, '/')
    .replace(/\\u0026/g, '&')
    .replace(/\\\//g, '/')
}

// ---------------------------------------------------------------------------
// 1. Images embedded in framework / site-builder data
// ---------------------------------------------------------------------------

export interface EmbeddedImage {
  url: string
  /**
   * Words describing the image taken from the data around it: the JSON key
   * path (`teamMembers.photo`) and sibling `alt` / `title` / `name` values.
   */
  context?: string
}

/** Script elements whose body is framework page data. */
const JSON_DATA_SELECTORS = [
  'script#__NEXT_DATA__',
  'script#__NUXT_DATA__',
  'script#wix-warmup-data',
  'script#wix-viewer-model',
  'script[type="application/json"]',
  'script[data-json]',
]

const CONTEXT_SIBLING_KEYS = ['alt', 'alttext', 'title', 'name', 'caption', 'description', 'label']

/** Key names that describe the role of the image they hold. */
const IGNORED_PATH_KEYS = new Set([
  'props', 'pageprops', 'data', 'items', 'nodes', 'edges', 'node', 'src', 'url', 'uri', 'href',
  'image', 'images', 'media', 'asset', 'file', 'fields', 'attributes', 'value', 'content',
])

function describeKeyPath(path: string[]): string {
  return path
    .filter((key) => !/^\d+$/.test(key) && !IGNORED_PATH_KEYS.has(key.toLowerCase()))
    .slice(-3)
    .join(' ')
}

function walkJson(root: unknown, onUrl: (url: string, context: string) => void): void {
  let visited = 0
  const visit = (node: unknown, path: string[], depth: number, siblingContext: string) => {
    if (visited++ > MAX_JSON_NODES || depth > MAX_JSON_DEPTH) return
    if (typeof node === 'string') {
      if (isImageLikeUrl(node)) {
        onUrl(node, [describeKeyPath(path), siblingContext].filter(Boolean).join(' ').trim())
      }
      return
    }
    if (Array.isArray(node)) {
      node.forEach((child, index) => visit(child, [...path, String(index)], depth + 1, siblingContext))
      return
    }
    if (node && typeof node === 'object') {
      const record = node as Record<string, unknown>
      const words: string[] = []
      for (const [key, value] of Object.entries(record)) {
        if (typeof value === 'string' && CONTEXT_SIBLING_KEYS.includes(key.toLowerCase()) && !isImageLikeUrl(value)) {
          words.push(value.slice(0, 80))
        }
      }
      // A nested object with no describing words of its own ({ photo: { url } })
      // inherits its parent's ("Jane Doe").
      const context = words.length ? words.join(' ') : siblingContext
      for (const [key, value] of Object.entries(record)) {
        visit(value, [...path, key], depth + 1, context)
      }
    }
  }
  visit(root, [], 0, '')
}

/** Absolute (or escaped) image URLs anywhere in a script body. */
const SCRIPT_URL_PATTERN =
  /https?:(?:\\?\/|\\u002[fF]){2}[^\s"'<>`()]+/g

/**
 * Image URLs recovered from the framework data a page embeds.
 *
 * Covers Next.js (`__NEXT_DATA__`), Nuxt, Wix warm-up data, generic
 * `application/json` blobs, and — for builders that assign their state in a
 * plain `<script>` (`window.__INITIAL_STATE__ = {...}`, Squarespace
 * `Static.SQUARESPACE_CONTEXT`, Shopify, Gatsby) — absolute image URLs found
 * in inline script text.
 */
export function extractEmbeddedImageUrls(
  html: string,
  baseUrl: string,
  limit = MAX_EMBEDDED_IMAGES,
): EmbeddedImage[] {
  if (!html) return []
  const $ = cheerio.load(html)
  const out: EmbeddedImage[] = []
  const seen = new Set<string>()

  const push = (raw: string, context?: string) => {
    if (out.length >= limit) return
    const url = resolveUrl(unescapeScriptUrl(raw), baseUrl)
    if (!url || seen.has(url) || !isImageLikeUrl(url)) return
    seen.add(url)
    out.push(context ? { url, context: context.slice(0, 160) } : { url })
  }

  const jsonScripts = new Set<unknown>()
  for (const selector of JSON_DATA_SELECTORS) {
    $(selector).each((_i, element) => {
      jsonScripts.add(element)
      const text = $(element).html() || ''
      if (!text || text.length > MAX_SCRIPT_CHARS) return
      try {
        walkJson(JSON.parse(text), (url, context) => push(url, context))
      } catch {
        // Not valid JSON (Nuxt's devalue format, for one): fall back to the
        // plain-text scan below.
        jsonScripts.delete(element)
      }
    })
  }

  $('script:not([src])').each((_i, element) => {
    if (out.length >= limit || jsonScripts.has(element)) return
    const type = ($(element).attr('type') || '').toLowerCase()
    if (type === 'application/ld+json') return // read by the JSON-LD extractors
    const text = $(element).html() || ''
    if (!text || text.length > MAX_SCRIPT_CHARS) return
    const matches = text.match(SCRIPT_URL_PATTERN) || []
    for (const match of matches) {
      // Trailing escape / punctuation from the surrounding literal.
      push(match.replace(/[\\,;]+$/, ''))
      if (out.length >= limit) break
    }
  })

  return out
}

// ---------------------------------------------------------------------------
// 2. Context around an <img>
// ---------------------------------------------------------------------------

const MAX_CONTEXT_ANCESTORS = 6
const MAX_CONTEXT_CHARS = 240

/**
 * Words that describe an image from its surroundings: its `title` /
 * `aria-label`, a wrapping `<figure>`'s caption, a wrapping link's title,
 * the nearest heading in its section, and the id / class names of its
 * ancestors (`team-grid`, `our-work`, `product-card`).
 */
/**
 * The <figcaption> text of a <figure>, memoised per figure (including "no
 * caption"): a gallery inside one shared <figure> would otherwise search the
 * whole figure once per image.
 */
const CAPTION_CACHE = new WeakMap<object, string>()
function captionOf($: CheerioAPI, figure: ReturnType<CheerioAPI>): string {
  const node = figure.get(0) as object | undefined
  if (!node) return ''
  const cached = CAPTION_CACHE.get(node)
  if (cached !== undefined) return cached
  const caption = figure.find('figcaption').first().text()
  CAPTION_CACHE.set(node, caption)
  return caption
}

/**
 * First heading text inside an ancestor, memoised per node (including "no
 * heading"). Every image of a large gallery shares the same ancestors, and
 * searching the shared container once per image was quadratic: 2,000 images
 * in one heading-less container took ~30 s.
 */
const HEADING_CACHE = new WeakMap<object, string>()
function headingWithin($: CheerioAPI, ancestor: ReturnType<CheerioAPI>): string {
  const node = ancestor.get(0) as object | undefined
  if (!node) return ''
  const cached = HEADING_CACHE.get(node)
  if (cached !== undefined) return cached
  const heading = ancestor.find('h1, h2, h3, h4').first().text()
  HEADING_CACHE.set(node, heading)
  return heading
}

export function extractImageContext($: CheerioAPI, element: any): string {
  const words: string[] = []
  const $el = $(element)

  const attrs = ['title', 'aria-label', 'data-alt', 'data-caption']
  for (const attr of attrs) {
    const value = $el.attr(attr)
    if (value) words.push(value)
  }

  const caption = captionOf($, $el.closest('figure'))
  if (caption) words.push(caption)

  const link = $el.closest('a')
  if (link.length) {
    const label = link.attr('title') || link.attr('aria-label')
    if (label) words.push(label)
  }

  let current = $el.parent()
  let headingFound = false
  for (let depth = 0; depth < MAX_CONTEXT_ANCESTORS && current.length; depth++) {
    const tag = (current.get(0) as any)?.tagName || ''
    if (tag === 'body' || tag === 'html') break
    const id = current.attr('id')
    const className = current.attr('class')
    if (id) words.push(id)
    if (className) words.push(className)
    if (!headingFound) {
      const heading = headingWithin($, current)
      if (heading && heading.length <= 120) {
        words.push(heading)
        headingFound = true
      }
    }
    current = current.parent()
  }

  return words
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_CONTEXT_CHARS)
}

// ---------------------------------------------------------------------------
// 3. Find similar elements
// ---------------------------------------------------------------------------

const STRUCTURE_DEPTH = 3

function stableClassNames(className: string | undefined): string {
  if (!className) return ''
  return className
    .split(/\s+/)
    .filter(Boolean)
    // Drop generated/stateful classes: hashes, numbers, active/selected states.
    .filter((name) => !/\d{2,}|^(?:is|has)-|active|selected|current|hover|loaded|lazy/i.test(name))
    .sort()
    .slice(0, 4)
    .join('.')
}

/**
 * A signature of an element's position in the page structure:
 * its own tag and the tag + stable class names of its nearest ancestors.
 * Images with the same signature on the same page are repeated items of one
 * list (cards of a grid, members of a team, slides of a gallery).
 */
export function elementStructureKey($: CheerioAPI, element: any): string {
  const parts: string[] = []
  let current = $(element)
  let top: object | null = null
  for (let depth = 0; depth <= STRUCTURE_DEPTH && current.length; depth++) {
    const node = current.get(0) as any
    const tag = node?.tagName || ''
    if (!tag || tag === 'body' || tag === 'html') break
    parts.push(`${tag}${depth === 0 ? '' : `.${stableClassNames(current.attr('class'))}`}`)
    top = node
    current = current.parent()
  }
  // The identity of the repeated-list container keeps two separate lists with
  // the same markup (a product grid and a team grid built from the same card
  // component, even inside one section) in different groups; items of ONE
  // list share it. Falls back to the outermost ancestor walked.
  const container = repeatedListContainer($, element) || top
  return `${parts.reverse().join('>')}#${container ? nodeId(container) : 0}`
}

/**
 * The parent of the nearest ancestor (or the element itself) that has at
 * least one sibling with the same tag and stable classes: the grid / list that
 * holds the repeated items. Null when nothing within STRUCTURE_DEPTH repeats.
 */
function repeatedListContainer($: CheerioAPI, element: any): object | null {
  let current = $(element)
  for (let depth = 0; depth <= STRUCTURE_DEPTH && current.length; depth++) {
    const node = current.get(0) as any
    const tag = node?.tagName
    if (!tag || tag === 'body' || tag === 'html') return null
    const parent = current.parent()
    const parentNode = parent.get(0) as any
    if (!parentNode) return null
    const signature = `${tag}.${stableClassNames(current.attr('class'))}`
    if ((childSignatureCounts($, parentNode).get(signature) || 0) > 1) return parentNode
    current = parent
  }
  return null
}

/**
 * How many children of a node share each tag + stable-class signature,
 * computed once per node: every image of a large grid asks the same parent,
 * and recounting its children per image would be quadratic.
 */
const CHILD_SIGNATURES = new WeakMap<object, Map<string, number>>()
function childSignatureCounts($: CheerioAPI, parentNode: any): Map<string, number> {
  let counts = CHILD_SIGNATURES.get(parentNode)
  if (counts) return counts
  counts = new Map()
  for (const child of $(parentNode).children().toArray() as any[]) {
    const signature = `${child.tagName}.${stableClassNames($(child).attr('class'))}`
    counts.set(signature, (counts.get(signature) || 0) + 1)
  }
  CHILD_SIGNATURES.set(parentNode, counts)
  return counts
}

const NODE_IDS = new WeakMap<object, number>()
let nextNodeId = 1
function nodeId(node: object): number {
  let id = NODE_IDS.get(node)
  if (!id) {
    id = nextNodeId++
    NODE_IDS.set(node, id)
  }
  return id
}

export interface SimilarityItem {
  similarGroup?: string
  category: DiscoveredAssetCategory
  confidence: number
  recommended: boolean
}

/** Categories a whole repeated list can share. */
const PROPAGATING_CATEGORIES = new Set<DiscoveredAssetCategory>([
  'person', 'product', 'service', 'completed_work', 'team', 'storefront', 'office', 'branded_vehicle',
])
/** A member at or below this confidence is "unsure" and may adopt its group's category. */
const UNSURE_CONFIDENCE = 49
const PROPAGATED_CONFIDENCE = 52
const MIN_GROUP_SIZE = 2
const MAX_GROUP_SIZE = 60

/**
 * Gives the unsure members of a repeated list the category their confident
 * siblings agree on. Mutates and returns the items.
 *
 * Only a generic `brand` verdict at low confidence is ever replaced, never a
 * logo, never an irrelevant verdict and never a confident classification.
 */
export function propagateSimilarCategories<T extends SimilarityItem>(items: T[]): T[] {
  const groups = new Map<string, T[]>()
  for (const item of items) {
    if (!item.similarGroup) continue
    const list = groups.get(item.similarGroup) || []
    list.push(item)
    groups.set(item.similarGroup, list)
  }

  for (const members of groups.values()) {
    if (members.length < MIN_GROUP_SIZE || members.length > MAX_GROUP_SIZE) continue
    const votes = new Map<DiscoveredAssetCategory, number>()
    for (const member of members) {
      if (member.confidence > UNSURE_CONFIDENCE && PROPAGATING_CATEGORIES.has(member.category)) {
        votes.set(member.category, (votes.get(member.category) || 0) + 1)
      }
    }
    if (votes.size === 0) continue
    const ranked = [...votes.entries()].sort((a, b) => b[1] - a[1])
    // A split vote (two categories tied) is not a signal.
    if (ranked.length > 1 && ranked[0][1] === ranked[1][1]) continue
    const [category] = ranked[0]
    for (const member of members) {
      if (member.category === 'brand' && member.confidence <= UNSURE_CONFIDENCE) {
        member.category = category
        member.confidence = PROPAGATED_CONFIDENCE
        member.recommended = true
      }
    }
  }
  return items
}

// ---------------------------------------------------------------------------
// 4. Brand colours
// ---------------------------------------------------------------------------

export interface BrandColors {
  /** The colour most likely to be the brand's main colour, `#rrggbb`. */
  primary?: string
  /** A second brand colour clearly different in hue from `primary`. */
  accent?: string
  /** Up to six brand colours, strongest first. */
  palette: string[]
  /** Where the winning colours came from (for telemetry / debugging). */
  sources: string[]
}

const MAX_CSS_CHARS = 600_000
const MAX_PALETTE = 6

/** Framework / CMS default colours that say nothing about the brand. */
const DEFAULT_THEME_COLORS = new Set([
  '#007bff', '#0d6efd', '#0073aa', '#2271b1', '#21759b', '#337ab7', '#428bca',
  '#6c757d', '#17a2b8', '#28a745', '#dc3545', '#ffc107', '#343a40', '#f8f9fa',
  '#1877f2', '#1da1f2', '#e4405f', '#ff0000', '#0a66c2',
  '#007aff', '#007cba', '#3858e9', '#0d99ff',
])

/**
 * CSS custom properties that belong to a CMS admin bar or a UI library
 * (WordPress admin, Swiper, Bootstrap, sliders, lightboxes), not the brand.
 */
const LIBRARY_VAR_PATTERN =
  /^(?:wp-admin|wp--preset|swiper|bs-|bootstrap|plyr|toastify|slick|glide|flickity|splide|fancybox|lightbox|tw-|chakra|mdc-|mui)/

interface Rgb { r: number; g: number; b: number }

function parseColor(raw: string): string | null {
  const value = raw.trim().toLowerCase()
  let match = /^#([0-9a-f]{3,8})$/.exec(value)
  if (match) {
    let hex = match[1]
    // #rgba / #rrggbbaa: a mostly transparent colour is not a brand colour,
    // the same rule as rgba() below.
    const alpha = hex.length === 4 ? parseInt(hex[3] + hex[3], 16) : hex.length === 8 ? parseInt(hex.slice(6), 16) : 255
    if (alpha < 128) return null
    if (hex.length === 3 || hex.length === 4) hex = hex.slice(0, 3).split('').map((c) => c + c).join('')
    else if (hex.length === 8) hex = hex.slice(0, 6)
    else if (hex.length !== 6) return null
    return `#${hex}`
  }
  match = /^rgba?\(\s*(\d{1,3})[\s,]+(\d{1,3})[\s,]+(\d{1,3})(?:[\s,/]+([\d.]+%?))?\s*\)$/.exec(value)
  if (match) {
    const alpha = match[4]
    if (alpha !== undefined) {
      const a = alpha.endsWith('%') ? Number(alpha.slice(0, -1)) / 100 : Number(alpha)
      if (Number.isFinite(a) && a < 0.5) return null
    }
    const channels = [match[1], match[2], match[3]].map(Number)
    if (channels.some((c) => c > 255)) return null
    return `#${channels.map((c) => c.toString(16).padStart(2, '0')).join('')}`
  }
  return null
}

function toRgb(hex: string): Rgb {
  return {
    r: parseInt(hex.slice(1, 3), 16),
    g: parseInt(hex.slice(3, 5), 16),
    b: parseInt(hex.slice(5, 7), 16),
  }
}

function toHsl({ r, g, b }: Rgb): { h: number; s: number; l: number } {
  const rn = r / 255
  const gn = g / 255
  const bn = b / 255
  const max = Math.max(rn, gn, bn)
  const min = Math.min(rn, gn, bn)
  const l = (max + min) / 2
  if (max === min) return { h: 0, s: 0, l }
  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  let h = 0
  if (max === rn) h = (gn - bn) / d + (gn < bn ? 6 : 0)
  else if (max === gn) h = (bn - rn) / d + 2
  else h = (rn - gn) / d + 4
  return { h: h * 60, s, l }
}

/** White, black, greys and near-greys are never the brand colour. */
function isNeutral(hex: string): boolean {
  const { s, l } = toHsl(toRgb(hex))
  return s < 0.15 || l > 0.94 || l < 0.08
}

function colorDistance(a: string, b: string): number {
  const x = toRgb(a)
  const y = toRgb(b)
  return Math.sqrt((x.r - y.r) ** 2 + (x.g - y.g) ** 2 + (x.b - y.b) ** 2)
}

function hueDistance(a: string, b: string): number {
  const d = Math.abs(toHsl(toRgb(a)).h - toHsl(toRgb(b)).h)
  return Math.min(d, 360 - d)
}

const COLOR_VALUE = /#[0-9a-fA-F]{3,8}\b|rgba?\([^)]{5,40}\)/g
/**
 * A CSS custom property declaration. Every quantifier is bounded and the
 * lookbehind lets a run of hyphens start at most one attempt, so a hostile
 * stylesheet (e.g. a comment of 500k hyphens) is scanned in linear time.
 * Whether the name is a brand colour is tested AFTER matching
 * (BRAND_VAR_NAME), not inside this pattern: the previous form, with a
 * keyword between two unbounded `[a-z0-9-]*`, backtracked quadratically.
 */
const CUSTOM_PROPERTY_PATTERN = /(?<![a-z0-9-])--([a-z0-9-]{1,80})\s{0,20}:\s{0,20}([^;}{]{1,200})/gi
const BRAND_VAR_NAME = /primary|brand|accent|secondary|theme|main|highlight|cta/
const COLOR_DECLARATION_PATTERN =
  /(?:^|[;{\s])(background(?:-color)?|color|border(?:-[a-z]+)?-color|fill|stroke)\s{0,20}:\s{0,20}([^;}{]{1,200})/gi

/**
 * The brand palette of a page.
 *
 * `extraCss` is the text of stylesheets the caller already fetched (the
 * function itself never fetches). Signals, strongest first:
 *   - `<meta name="theme-color">`, `msapplication-TileColor`, mask-icon colour
 *   - CSS custom properties named like a brand colour (`--primary`, `--brand-color`)
 *   - colours used most often in colour declarations (buttons, links, backgrounds)
 */
export function extractBrandColors(html: string, extraCss: string[] = []): BrandColors {
  const scores = new Map<string, number>()
  const sourceOf = new Map<string, { source: string; weight: number }>()
  const add = (raw: string, weight: number, source: string) => {
    const hex = parseColor(raw)
    if (!hex || isNeutral(hex)) return
    const penalised = DEFAULT_THEME_COLORS.has(hex) ? weight * 0.2 : weight
    scores.set(hex, (scores.get(hex) || 0) + penalised)
    // Report the STRONGEST signal a colour came from.
    const previous = sourceOf.get(hex)
    if (!previous || weight > previous.weight) sourceOf.set(hex, { source, weight })
  }

  const $ = cheerio.load(html || '')
  const metaColor = (selector: string) => $(selector).first().attr('content') || ''
  add(metaColor('meta[name="theme-color"]'), 12, 'theme-color')
  add(metaColor('meta[name="msapplication-TileColor"]'), 8, 'tile-color')
  add($('link[rel="mask-icon"]').first().attr('color') || '', 6, 'mask-icon')

  const cssChunks: string[] = []
  $('style').each((_i, element) => {
    cssChunks.push($(element).html() || '')
  })
  $('[style]').each((_i, element) => {
    cssChunks.push(`{${$(element).attr('style') || ''}}`)
  })
  cssChunks.push(...extraCss)
  const css = cssChunks.join('\n').slice(0, MAX_CSS_CHARS)

  for (const match of css.matchAll(CUSTOM_PROPERTY_PATTERN)) {
    const name = match[1].toLowerCase()
    if (!BRAND_VAR_NAME.test(name) || LIBRARY_VAR_PATTERN.test(name)) continue
    const values = match[2].match(COLOR_VALUE) || []
    const weight = /primary|brand|main|theme/.test(name) ? 6 : 4
    for (const value of values.slice(0, 1)) add(value, weight, `css-var:--${name}`)
  }

  for (const match of css.matchAll(COLOR_DECLARATION_PATTERN)) {
    const property = match[1].toLowerCase()
    const values = match[2].match(COLOR_VALUE) || []
    const weight = property.startsWith('background') ? 1.2 : 1
    for (const value of values.slice(0, 1)) add(value, weight, 'css-usage')
  }

  // Merge near-identical shades into the strongest of them.
  const ranked = [...scores.entries()].sort((a, b) => b[1] - a[1])
  const clusters: Array<{ hex: string; score: number }> = []
  for (const [hex, score] of ranked) {
    const near = clusters.find((cluster) => colorDistance(cluster.hex, hex) < 28)
    if (near) near.score += score
    else clusters.push({ hex, score })
  }
  clusters.sort((a, b) => b.score - a.score)

  // One stray usage is noise, not a palette.
  const significant = clusters.filter((cluster) => cluster.score >= 2)
  const palette = significant.slice(0, MAX_PALETTE).map((cluster) => cluster.hex)
  const primary = palette[0]
  const accent = primary ? palette.slice(1).find((hex) => hueDistance(hex, primary) >= 30) : undefined

  return {
    ...(primary ? { primary } : {}),
    ...(accent ? { accent } : {}),
    palette,
    sources: [primary, accent].filter(Boolean).map((hex) => sourceOf.get(hex as string)?.source || 'css-usage'),
  }
}

/**
 * Site-builder CDNs that serve a site's OWN theme stylesheet from another
 * origin (Squarespace puts every site's colours in static1.squarespace.com).
 */
const BUILDER_STYLESHEET_HOSTS = new Set(['static1.squarespace.com', 'assets.squarespace.com'])

/** Same-origin (or site-builder theme) stylesheet URLs a page links, in document order. */
export function extractStylesheetUrls(html: string, baseUrl: string, limit = 2): string[] {
  if (!html) return []
  const $ = cheerio.load(html)
  let origin: string
  try {
    origin = new URL(baseUrl).origin
  } catch {
    return []
  }
  const urls: string[] = []
  $('link[rel~="stylesheet"][href]').each((_i, element) => {
    if (urls.length >= limit) return
    const href = $(element).attr('href') || ''
    try {
      const url = new URL(href, baseUrl)
      if (url.origin !== origin && !BUILDER_STYLESHEET_HOSTS.has(url.hostname)) return
      // Skip obvious vendor bundles: they hold framework colours, not the brand's.
      if (/bootstrap|font-?awesome|wp-includes|jquery|animate|swiper|slick/i.test(url.pathname)) return
      urls.push(url.toString())
    } catch {
      // ignore malformed href
    }
  })
  return urls
}

// ---------------------------------------------------------------------------
// 5. JS-shell detection
// ---------------------------------------------------------------------------

const JS_FRAMEWORK_SIGNATURES: Array<{ name: string; pattern: RegExp }> = [
  { name: 'wix', pattern: /static\.parastorage\.com|wix-warmup-data|X-Wix-/i },
  { name: 'squarespace', pattern: /static1\.squarespace\.com|Static\.SQUARESPACE_CONTEXT/i },
  { name: 'nextjs', pattern: /id=["']__NEXT_DATA__["']|\/_next\/static\//i },
  { name: 'nuxt', pattern: /window\.__NUXT__|id=["']__nuxt["']/i },
  { name: 'gatsby', pattern: /id=["']___gatsby["']/i },
  { name: 'weebly', pattern: /editmysite\.com|weebly/i },
  { name: 'godaddy', pattern: /img1\.wsimg\.com|godaddy-website-builder/i },
]

export interface JsRenderSignal {
  /** True when the static HTML is probably an incomplete JS-rendered shell. */
  jsRendered: boolean
  /** Visible body text length (characters) of the static HTML. */
  textLength: number
  /** Number of `<img>` elements in the static HTML. */
  imageCount: number
  /** The site builders / frameworks detected. */
  frameworks: string[]
}

/**
 * Detects a page whose real content is drawn by JavaScript. Such a page is
 * worth the (expensive) browser escalation even when the free layers found a
 * few images, because what they found is only the shell.
 */
export function looksJsRendered(html: string): JsRenderSignal {
  if (!html) return { jsRendered: false, textLength: 0, imageCount: 0, frameworks: [] }
  const $ = cheerio.load(html)
  const imageCount = $('img').length
  // An empty `<div id="root">` / `#app` mount point (React, Vue, Svelte).
  // Read from the DOM, not with a regex: `<div[^>]+id=…` backtracked
  // quadratically on a page of unclosed `<div ` tags.
  const emptyMountPoint = $('div#root, div#app')
    .toArray()
    .some((element) => $(element).children().length === 0 && !$(element).text().trim())
  $('script, style, noscript, template, svg').remove()
  const textLength = $('body').text().replace(/\s+/g, ' ').trim().length
  const frameworks = JS_FRAMEWORK_SIGNATURES.filter(({ pattern }) => pattern.test(html)).map(({ name }) => name)
  if (emptyMountPoint) frameworks.push('spa-root')
  const nearlyEmpty = textLength < 400 && imageCount < 3
  const thinBuilderPage = frameworks.length > 0 && imageCount < 4
  return { jsRendered: nearlyEmpty || thinBuilderPage, textLength, imageCount, frameworks }
}

// ---------------------------------------------------------------------------
// 6. HTML -> Markdown
// ---------------------------------------------------------------------------

const MAX_MARKDOWN_CHARS = 8_000
const REMOVED_FOR_MARKDOWN =
  'script, style, noscript, template, svg, iframe, form, nav, header, footer, aside, button, select, input, ' +
  '[role="navigation"], [role="banner"], [role="contentinfo"], [aria-hidden="true"], .cookie, #cookie, ' +
  '[class*="cookie"], [id*="cookie"], [class*="popup"], [class*="modal"]'

function inlineText($: CheerioAPI, node: any): string {
  if (node.type === 'text') return (node.data || '').replace(/\s+/g, ' ')
  if (node.type !== 'tag') return ''
  const tag = node.tagName
  const children = (node.children || []).map((child: any) => inlineText($, child)).join('')
  if (tag === 'br') return '\n'
  if (tag === 'strong' || tag === 'b') return children.trim() ? `**${children.trim()}** ` : ''
  if (tag === 'em' || tag === 'i') return children.trim() ? `*${children.trim()}* ` : ''
  if (tag === 'a') {
    const href = $(node).attr('href') || ''
    const text = children.trim()
    if (!text) return ''
    return /^https?:\/\//i.test(href) ? `[${text}](${href}) ` : `${text} `
  }
  if (tag === 'img') return ''
  return children
}

/**
 * The readable content of a page as Markdown: headings, paragraphs, lists,
 * blockquotes and links, with navigation, headers, footers, scripts, forms and
 * cookie banners removed. Prefers `<main>` / `<article>` when the page has one.
 * Capped at 8,000 characters.
 */
export function htmlToMarkdown(html: string, maxChars = MAX_MARKDOWN_CHARS): string {
  if (!html) return ''
  const $ = cheerio.load(html)
  $(REMOVED_FOR_MARKDOWN)
    // `[class*="cookie"]` also matches `<html class="supports-no-cookies">`
    // (Shopify themes): never remove the document, the body, the main
    // content or anything that wraps it.
    .filter((_i, element) => {
      const tag = (element as any).tagName
      if (tag === 'html' || tag === 'body' || tag === 'main' || tag === 'article') return false
      return $(element).find('main, article').length === 0
    })
    .remove()
  const root = $('main').first().length
    ? $('main').first()
    : $('article').first().length
      ? $('article').first()
      : $('body')

  const lines: string[] = []
  const seen = new Set<string>()
  const emit = (line: string) => {
    const clean = line.replace(/[ \t]+/g, ' ').replace(/ +\n/g, '\n').trim()
    if (!clean) return
    // Repeated blocks (carousels, duplicated mobile menus) add nothing.
    if (seen.has(clean)) return
    seen.add(clean)
    lines.push(clean)
  }

  root.find('h1, h2, h3, h4, h5, h6, p, li, blockquote, dt, dd, td, th').each((_i, element) => {
    const node = element as any
    const tag = node.tagName as string
    // A <p> inside an <li> is emitted with the list item.
    if (tag !== 'li' && $(element).parents('li').length) return
    if ((tag === 'td' || tag === 'th' || tag === 'dd' || tag === 'dt') && $(element).find('p, li').length) return
    const text = inlineText($, node).trim()
    if (!text) return
    if (/^h[1-6]$/.test(tag)) emit(`${'#'.repeat(Number(tag[1]))} ${text.replace(/\*\*/g, '')}`)
    else if (tag === 'li') emit(`- ${text}`)
    else if (tag === 'blockquote') emit(`> ${text}`)
    else emit(text)
  })

  let markdown = ''
  for (const line of lines) {
    const block = line.startsWith('- ') ? `${line}\n` : `\n${line}\n`
    if (markdown.length + block.length > maxChars) {
      // Keep the part of an oversized block that fits (a page whose main text
      // is one long paragraph used to produce nothing), cut at a word.
      const room = maxChars - markdown.length
      if (room > 40) markdown += block.slice(0, room).replace(/\s+\S*$/, '')
      break
    }
    markdown += block
  }
  return markdown.replace(/\n{3,}/g, '\n\n').trim()
}
