/**
 * Brand Kit crawl: reads a business's home page plus a few of its own pages (About, Products/Services,
 * Reviews, Team) and boils them down to a brand profile: fonts, tone of voice, what the business offers,
 * testimonials, and more images.
 *
 * Free and static: every page goes through `fetchPageWithFinalUrl`, which validates the destination and every
 * redirect hop (SSRF guard). No browser, no paid crawler, no AI call. Only links on the SAME site are followed
 * and at most MAX_SUBPAGES of them. Nothing is invented: tone is a keyword reading of the site's own words and
 * is reported as inferred.
 */
import * as cheerio from 'cheerio'
import { fetchPageWithFinalUrl } from './discoverAssets'
import { parseBrandHtml } from './brandStaticScrape'

export const MAX_SUBPAGES = 4
const MAX_IMAGES = 40
const MAX_OFFERINGS = 12
const MAX_TESTIMONIALS = 4

export type PageKind = 'home' | 'about' | 'products' | 'services' | 'reviews' | 'team' | 'contact'

/** Path/anchor keywords → page kind, most useful first. */
const KINDS: { kind: PageKind; re: RegExp }[] = [
  { kind: 'about', re: /\b(about|our[-_ ]story|who[-_ ]we[-_ ]are|company|mission)\b/i },
  { kind: 'products', re: /\b(products?|shop|store|menu|catalog(ue)?|collections?|rooms|packages|pricing)\b/i },
  { kind: 'services', re: /\b(services?|what[-_ ]we[-_ ]do|solutions|treatments|offerings|specialt(y|ies))\b/i },
  { kind: 'reviews', re: /\b(reviews?|testimonials?|case[-_ ]stud(y|ies)|customers|results)\b/i },
  { kind: 'team', re: /\b(team|our[-_ ]people|staff|meet|crew)\b/i },
]
const SKIP_PATH = /\.(pdf|jpe?g|png|gif|webp|svg|zip|mp4|docx?|xlsx?)$|\/(cart|checkout|login|log-in|signin|sign-in|account|privacy|terms|cookie|careers?|jobs|blog|news|press|wp-admin|wp-login)\b/i

export interface SubpageLink { url: string; kind: PageKind }

const stripWww = (host: string) => host.replace(/^www\./i, '').toLowerCase()

/** Pure: the best same-site links to read next, one per kind first, at most `max`. */
export function pickSubpageLinks(html: string, baseUrl: string, max = MAX_SUBPAGES): SubpageLink[] {
  let base: URL
  try { base = new URL(baseUrl) } catch { return [] }
  const $ = cheerio.load(html)
  const best = new Map<string, { link: SubpageLink; score: number }>()
  $('a[href]').each((_i, el) => {
    const href = ($(el).attr('href') || '').trim()
    if (!href || href.startsWith('#') || /^(mailto|tel|javascript):/i.test(href)) return
    let u: URL
    try { u = new URL(href, base) } catch { return }
    if (!/^https?:$/.test(u.protocol) || stripWww(u.hostname) !== stripWww(base.hostname)) return
    u.hash = ''
    const path = u.pathname.replace(/\/+$/, '') || '/'
    if (path === '/' || path === (base.pathname.replace(/\/+$/, '') || '/') || SKIP_PATH.test(u.pathname)) return
    if (path.split('/').filter(Boolean).length > 3) return
    const label = `${path.replace(/[-_/]/g, ' ')} ${$(el).text().replace(/\s+/g, ' ').trim().slice(0, 40)}`
    const hit = KINDS.findIndex((k) => k.re.test(label))
    if (hit < 0) return
    const score = 100 - hit * 10 - Math.min(path.length, 40) / 4 + ($(el).closest('nav, header').length ? 5 : 0)
    const key = KINDS[hit].kind
    const cur = best.get(key)
    if (!cur || score > cur.score) best.set(key, { link: { url: u.href, kind: KINDS[hit].kind }, score })
  })
  return [...best.values()].sort((a, b) => b.score - a.score).slice(0, max).map((v) => v.link)
}

// ── Tone ────────────────────────────────────────────────────────────────────────────────────────────────────
const TONE_WORDS: Record<string, RegExp> = {
  friendly: /\b(welcome|friendly|family|love|happy|care|together|community|we['’]re here|neighbou?r)\b/gi,
  professional: /\b(professional|expert|certified|licensed|experience|quality|reliable|trusted|industry|solutions)\b/gi,
  premium: /\b(luxury|premium|exclusive|bespoke|artisan|crafted|handcrafted|elegant|refined|finest)\b/gi,
  playful: /\b(fun|play|enjoy|delight|awesome|amazing|wow|yummy|treat|adventure|let['’]s)\b|!/gi,
  innovative: /\b(innovative|innovation|cutting[- ]edge|next[- ]gen|ai|smart|technology|future|platform|automation)\b/gi,
  bold: /\b(bold|powerful|unleash|dominate|fearless|strong|best|no\.?\s?1|#1|number one|ultimate)\b/gi,
  calm: /\b(calm|relax|peace|gentle|natural|wellness|mindful|soothing|organic|pure)\b/gi,
}
const PERSONALITY: Record<string, string> = {
  friendly: 'warm and approachable', professional: 'credible and dependable', premium: 'refined and upscale',
  playful: 'fun and energetic', innovative: 'modern and forward-looking', bold: 'confident and direct', calm: 'calm and reassuring',
}

/** Pure: the top tones found in a body of the site's own copy (needs real signal; otherwise empty). */
export function inferTone(text: string): { toneOfVoice: string[]; brandPersonality: string[] } {
  const sample = String(text || '').slice(0, 20000)
  if (sample.length < 120) return { toneOfVoice: [], brandPersonality: [] }
  const scored = Object.entries(TONE_WORDS)
    .map(([tone, re]) => ({ tone, n: (sample.match(re) || []).length }))
    .filter((t) => t.n >= 2)
    .sort((a, b) => b.n - a.n)
    .slice(0, 3)
  return { toneOfVoice: scored.map((t) => t.tone), brandPersonality: scored.map((t) => PERSONALITY[t.tone]) }
}

// ── Page facts ──────────────────────────────────────────────────────────────────────────────────────────────
export interface PageFacts {
  url: string
  kind: PageKind
  title: string
  headings: string[]
  quotes: string[]
  text: string
  images: string[]
  fonts: string[]
}

const clean = (s: string) => s.replace(/\s+/g, ' ').trim()
const GENERIC_HEADING = /^(home|menu|about( us)?|contact( us)?|services?|products?|shop|search|cart|login|sign in|subscribe|newsletter|follow us|our (services|products|team|story)|reviews?|testimonials?|faq|footer)$/i

/** Pure: headings, testimonial quotes, copy, images and fonts of one page. */
export function extractPageFacts(html: string, pageUrl: string, kind: PageKind): PageFacts {
  const parsed = parseBrandHtml(html, pageUrl)
  const $ = cheerio.load(html)
  $('script, style, noscript, svg, template').remove()
  const headings: string[] = []
  $('h1, h2, h3').each((_i, el) => {
    const t = clean($(el).text())
    if (t.length >= 3 && t.length <= 90 && !GENERIC_HEADING.test(t) && !headings.includes(t)) headings.push(t)
  })
  const quotes: string[] = []
  $('blockquote, [class*="testimonial" i], [class*="review" i] p, [itemprop="reviewBody"]').each((_i, el) => {
    const t = clean($(el).text()).replace(/^["“”']+|["“”']+$/g, '')
    if (t.length >= 40 && t.length <= 280 && !quotes.includes(t)) quotes.push(t)
  })
  return { url: pageUrl, kind, title: parsed.title, headings: headings.slice(0, 30), quotes: quotes.slice(0, 8), text: parsed.bodyText, images: parsed.images, fonts: parsed.fonts }
}

export interface BrandProfile {
  pages: { url: string; kind: PageKind; title: string }[]
  fonts: string[]
  toneOfVoice: string[]
  brandPersonality: string[]
  aboutText: string
  offerings: string[]
  testimonials: string[]
  images: string[]
  /** Which parts were reported by the site and which were inferred. */
  inferred: string[]
}

const GENERIC_FONT = /^(serif|sans-serif|monospace|cursive|system-ui|ui-sans-serif|ui-serif|-apple-system|blinkmacsystemfont|segoe ui|helvetica( neue)?|arial|times( new roman)?|georgia|verdana|tahoma|courier( new)?|roboto|inherit)$/i

/** Pure: merge the facts of every page read into one profile. */
export function buildBrandProfile(pages: PageFacts[]): BrandProfile {
  const fonts = [...new Set(pages.flatMap((p) => p.fonts).filter((f) => f && !GENERIC_FONT.test(f)))].slice(0, 6)
  const copy = pages.map((p) => p.text).join(' ')
  const tone = inferTone(copy)
  const about = pages.find((p) => p.kind === 'about')
  const aboutText = about ? about.text.slice(0, 600) : ''
  const offerings = [...new Set(pages.filter((p) => p.kind === 'products' || p.kind === 'services').flatMap((p) => p.headings))].slice(0, MAX_OFFERINGS)
  const testimonials = [...new Set(pages.flatMap((p) => p.quotes))].slice(0, MAX_TESTIMONIALS)
  const images = [...new Set(pages.flatMap((p) => p.images))].slice(0, MAX_IMAGES)
  return {
    pages: pages.map((p) => ({ url: p.url, kind: p.kind, title: p.title })),
    fonts, ...tone, aboutText, offerings, testimonials, images,
    inferred: tone.toneOfVoice.length ? ['toneOfVoice', 'brandPersonality'] : [],
  }
}

/** Reads the home page and up to MAX_SUBPAGES of the site's own pages. Null when the home page cannot be read. */
export async function crawlBrandSite(rawUrl: string, deadlineAt: number): Promise<BrandProfile | null> {
  const home = await fetchPageWithFinalUrl(rawUrl, deadlineAt)
  if (!home) return null
  const facts: PageFacts[] = [extractPageFacts(home.html, home.finalUrl, 'home')]
  const links = pickSubpageLinks(home.html, home.finalUrl)
  const pages = await Promise.all(links.map((l) => fetchPageWithFinalUrl(l.url, deadlineAt).then((p) => (p ? { p, l } : null)).catch(() => null)))
  for (const got of pages) if (got) facts.push(extractPageFacts(got.p.html, got.p.finalUrl, got.l.kind))
  return buildBrandProfile(facts)
}
