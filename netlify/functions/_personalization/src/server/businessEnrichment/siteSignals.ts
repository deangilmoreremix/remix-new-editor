/**
 * What a business's own pages reveal about HOW it does business online: does it take leads through a form,
 * offer online booking, already use video, and is the site in decent shape. Everything is read from the HTML
 * we already fetched for contact enrichment (no extra requests) and carries the page it came from.
 *
 * These are observations, never verdicts: "no video found on the pages we read" is NOT "has no video", and a
 * missing meta tag is a signal, not proof the site is bad.
 */
import * as cheerio from 'cheerio'

export interface SiteSignals {
  /** A real <form> with a text/email field and a way to send it, on a page we read. */
  contactForm?: { sourceUrl: string }
  /** A link to a known booking/ordering service or an on-site "book/schedule/reserve" link. */
  booking?: { sourceUrl: string; href: string; provider?: string }
  /** Video the business itself embeds: YouTube/Vimeo/Wistia iframes, a <video> tag, or an og:video. */
  video?: { sourceUrl: string; kinds: Array<'youtube' | 'vimeo' | 'wistia' | 'video-tag' | 'og-video'> }
  /** The rating the business's OWN page publishes (JSON-LD aggregateRating on a business). Never a third-party review site. */
  rating?: { value: number; count: number; best: number; sourceUrl: string }
  /** Technical quality hints from the homepage. */
  quality?: {
    sourceUrl: string
    https: boolean
    mobileViewport: boolean
    hasTitle: boolean
    hasMetaDescription: boolean
    hasStructuredData: boolean
    /** Latest "© 2019"-style year found in the footer text, if any. */
    copyrightYear?: number
    /** True when the footer copyright year is 3+ years old. Heuristic only. */
    looksOutdated: boolean
  }
}

const BOOKING_HOSTS: Array<[RegExp, string]> = [
  [/(^|\.)calendly\.com$/, 'Calendly'], [/(^|\.)square\.site$|(^|\.)squareup\.com$/, 'Square'], [/(^|\.)opentable\.com$/, 'OpenTable'],
  [/(^|\.)resy\.com$/, 'Resy'], [/(^|\.)vagaro\.com$/, 'Vagaro'], [/(^|\.)fresha\.com$/, 'Fresha'], [/(^|\.)booksy\.com$/, 'Booksy'],
  [/(^|\.)mindbodyonline\.com$/, 'Mindbody'], [/(^|\.)acuityscheduling\.com$/, 'Acuity'], [/(^|\.)setmore\.com$/, 'Setmore'],
  [/(^|\.)tock\.com$/, 'Tock'], [/(^|\.)toasttab\.com$/, 'Toast'], [/(^|\.)zocdoc\.com$/, 'Zocdoc'], [/(^|\.)glossgenius\.com$/, 'GlossGenius'],
]
const BOOKING_TEXT = /\b(book (now|online|an? appointment|a table)|schedule( an? (appointment|visit|service))?|reserve( a table)?|request an? (quote|estimate|appointment))\b/i
const NOT_A_BUSINESS_TYPE = /^(Product|Recipe|Book|Movie|Course|SoftwareApplication|MobileApplication|Event|CreativeWork|Article|Review|Game|MusicRecording|Offer)$/i

function typesOf(node: Record<string, unknown>): string[] {
  const t = node['@type']
  return (Array.isArray(t) ? t : [t]).filter((x): x is string => typeof x === 'string')
}

/** Finds an aggregateRating attached to a business-like JSON-LD node. Pure; ignores malformed JSON. */
export function extractRating(jsonLdBlocks: string[], pageUrl: string): SiteSignals['rating'] | undefined {
  const visit = (node: unknown, depth: number): SiteSignals['rating'] | undefined => {
    if (!node || typeof node !== 'object' || depth > 6) return undefined
    if (Array.isArray(node)) { for (const n of node) { const r = visit(n, depth + 1); if (r) return r } return undefined }
    const obj = node as Record<string, unknown>
    const types = typesOf(obj)
    const agg = obj.aggregateRating
    if (agg && typeof agg === 'object' && !types.some((t) => NOT_A_BUSINESS_TYPE.test(t))) {
      const a = agg as Record<string, unknown>
      const value = Number(a.ratingValue)
      const best = a.bestRating === undefined ? 5 : Number(a.bestRating)
      const count = Number(a.reviewCount ?? a.ratingCount)
      if (Number.isFinite(value) && Number.isFinite(best) && best > 0 && value > 0 && value <= best && Number.isInteger(count) && count >= 1) {
        return { value: Math.round(value * 10) / 10, count, best, sourceUrl: pageUrl }
      }
    }
    for (const v of Object.values(obj)) { const r = visit(v, depth + 1); if (r) return r }
    return undefined
  }
  for (const block of jsonLdBlocks) {
    try { const r = visit(JSON.parse(block), 0); if (r) return r } catch { /* malformed JSON-LD is ignored */ }
  }
  return undefined
}

const BOOKING_PATH = /\/(book(ing)?(-online|-now|-appointment|-a-table)?|appointments?|schedule(-online)?|reservations?|reserve|request-(a-)?(quote|estimate))(\/|$|\?)/i

export function extractSiteSignals(html: string, pageUrl: string, opts: { isHomepage?: boolean; nowYear?: number } = {}): SiteSignals {
  const $ = cheerio.load(html)
  const out: SiteSignals = {}

  // Contact form: a form that can collect a message (email or textarea or tel) and is not just search/login/newsletter-only.
  $('form').each((_, form) => {
    if (out.contactForm) return
    const $f = $(form)
    const role = `${$f.attr('role') ?? ''} ${$f.attr('class') ?? ''} ${$f.attr('id') ?? ''} ${$f.attr('action') ?? ''}`.toLowerCase()
    if (/search|login|signin|sign-in|subscribe|newsletter|checkout|cart/.test(role)) return
    const hasMessage = $f.find('textarea').length > 0
    const hasPerson = $f.find('input[type="email"], input[type="tel"], input[name*="email" i], input[name*="phone" i]').length > 0
    if (hasMessage || (hasPerson && $f.find('input[type="text"], input:not([type])').length > 0)) out.contactForm = { sourceUrl: pageUrl }
  })

  // Booking: known provider link, or an on-site booking-looking link.
  $('a[href]').each((_, a) => {
    if (out.booking) return
    const href = ($(a).attr('href') ?? '').trim()
    let abs: URL
    try { abs = new URL(href, pageUrl) } catch { return }
    if (!/^https?:$/.test(abs.protocol)) return
    const provider = BOOKING_HOSTS.find(([re]) => re.test(abs.hostname.toLowerCase()))?.[1]
    const text = $(a).text().replace(/\s+/g, ' ').trim()
    if (provider || BOOKING_PATH.test(abs.pathname) || (BOOKING_TEXT.test(text) && text.length < 40)) {
      out.booking = { sourceUrl: pageUrl, href: abs.toString(), ...(provider ? { provider } : {}) }
    }
  })

  // The rating the business itself publishes.
  const rating = extractRating($('script[type="application/ld+json"]').map((_, el) => $(el).contents().text()).get(), pageUrl)
  if (rating) out.rating = rating

  // The business's own video.
  const kinds = new Set<NonNullable<SiteSignals['video']>['kinds'][number]>()
  $('iframe[src], iframe[data-src]').each((_, f) => {
    const src = ($(f).attr('src') ?? $(f).attr('data-src') ?? '').toLowerCase()
    if (/youtube(-nocookie)?\.com\/embed|youtu\.be/.test(src)) kinds.add('youtube')
    else if (/player\.vimeo\.com/.test(src)) kinds.add('vimeo')
    else if (/fast\.wistia\.(net|com)|wistia\.net\/embed/.test(src)) kinds.add('wistia')
  })
  if ($('video').length > 0) kinds.add('video-tag')
  if ($('meta[property="og:video"], meta[property="og:video:url"]').length > 0) kinds.add('og-video')
  if (kinds.size) out.video = { sourceUrl: pageUrl, kinds: [...kinds] }

  // Homepage quality hints.
  if (opts.isHomepage) {
    const text = $('footer').text() || $('body').text()
    const years = [...text.matchAll(/(?:©|&copy;|copyright)\s*(?:\d{4}\s*[-–]\s*)?(\d{4})/gi)].map((m) => Number(m[1])).filter((y) => y >= 1995 && y <= 2100)
    const copyrightYear = years.length ? Math.max(...years) : undefined
    const nowYear = opts.nowYear ?? new Date().getFullYear()
    out.quality = {
      sourceUrl: pageUrl,
      https: /^https:/i.test(pageUrl),
      mobileViewport: $('meta[name="viewport"]').length > 0,
      hasTitle: ($('title').first().text().trim().length > 0),
      hasMetaDescription: (($('meta[name="description"]').attr('content') ?? '').trim().length > 0),
      hasStructuredData: $('script[type="application/ld+json"]').length > 0,
      ...(copyrightYear ? { copyrightYear } : {}),
      looksOutdated: copyrightYear ? nowYear - copyrightYear >= 3 : false,
    }
  }
  return out
}

/** Merge per-page signals: first hit wins for form/booking, video kinds are unioned, quality comes from the homepage. */
export function mergeSiteSignals(list: SiteSignals[]): SiteSignals {
  const out: SiteSignals = {}
  for (const s of list) {
    if (s.contactForm && !out.contactForm) out.contactForm = s.contactForm
    if (s.booking && !out.booking) out.booking = s.booking
    if (s.rating && !out.rating) out.rating = s.rating
    if (s.quality && !out.quality) out.quality = s.quality
    if (s.video) {
      out.video = out.video
        ? { sourceUrl: out.video.sourceUrl, kinds: [...new Set([...out.video.kinds, ...s.video.kinds])] }
        : { ...s.video, kinds: [...s.video.kinds] }
    }
  }
  return out
}
