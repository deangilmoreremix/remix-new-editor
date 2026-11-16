/**
 * Contact, social and structured-data extraction from one fetched page.
 * Reads only what is literally on the page (or decodable from it) — never guesses. Each value is
 * returned with its source URL, method and a confidence that reflects how reliable the method is.
 */
import * as cheerio from 'cheerio'
import type { Evidence, SocialNetwork } from './types'

export interface PageExtraction {
  emails: Evidence[]
  phones: Evidence[]
  addresses: Evidence[]
  contactNames: Evidence[]
  socials: Partial<Record<SocialNetwork, Evidence>>
  jsonLd: Array<Record<string, unknown>>
  openGraph: Record<string, string>
}

const EMAIL_RE = /[a-z0-9._%+-]+@[a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,}/gi
const JUNK_EMAIL = /(@(example|domain|email|test|yourdomain|sentry|wixpress|sentry-next)\.|\.(png|jpe?g|gif|webp|svg|css|js)$|^(user|name|you|your|email|test)@|u003e)/i
const PHONE_RE = /(?:\+?1[\s.\-]?)?\(?\b[2-9]\d{2}\)?[\s.\-]?\d{3}[\s.\-]?\d{4}\b/g

export function decodeCloudflareEmail(hex: string): string | null {
  if (!/^[0-9a-f]{6,}$/i.test(hex) || hex.length % 2) return null
  const key = parseInt(hex.slice(0, 2), 16)
  let out = ''
  for (let i = 2; i < hex.length; i += 2) out += String.fromCharCode(parseInt(hex.slice(i, i + 2), 16) ^ key)
  return out
}

/** "name [at] site [dot] com", "name(at)site(dot)com" → "name@site.com". Brackets/parens required. */
export function decodeTextObfuscation(text: string): string[] {
  const t = text
    .replace(/\s*[\[\(\{]\s*at\s*[\]\)\}]\s*/gi, '@')
    .replace(/\s*[\[\(\{]\s*dot\s*[\]\)\}]\s*/gi, '.')
  return [...t.matchAll(EMAIL_RE)].map((m) => m[0])
}

const normEmail = (e: string) => e.trim().toLowerCase().replace(/^mailto:/i, '').split('?')[0]
export const normPhone = (p: string): string => {
  const d = p.replace(/\D/g, '')
  return d.length === 11 && d.startsWith('1') ? d.slice(1) : d
}
const validPhone = (digits: string) => digits.length === 10 || (digits.length >= 11 && digits.length <= 15)

const SOCIAL_HOSTS: Array<[SocialNetwork, RegExp]> = [
  ['facebook', /(^|\.)facebook\.com$|(^|\.)fb\.com$/], ['instagram', /(^|\.)instagram\.com$/],
  ['linkedin', /(^|\.)linkedin\.com$/], ['youtube', /(^|\.)youtube\.com$|(^|\.)youtu\.be$/],
  ['tiktok', /(^|\.)tiktok\.com$/], ['x', /(^|\.)twitter\.com$|(^|\.)x\.com$/], ['pinterest', /(^|\.)pinterest\.[a-z.]+$/],
]
const SHARE_PATH = /(\/(sharer|share|intent|dialog|plugins|tr|login|signup|hashtag|explore|watch|embed|policy|help|about|legal)(\/|\.php|$)|[?&]u=)/i

export function classifySocialUrl(raw: string): { network: SocialNetwork; url: string } | null {
  let u: URL
  try { u = new URL(raw) } catch { return null }
  if (!/^https?:$/.test(u.protocol)) return null
  for (const [network, re] of SOCIAL_HOSTS) {
    if (!re.test(u.hostname.toLowerCase())) continue
    if (SHARE_PATH.test(u.pathname + u.search)) return null
    const segs = u.pathname.split('/').filter(Boolean)
    if (!segs.length) return null // bare homepage is not a business profile
    u.hash = ''
    // The query string is dropped (tracking noise) except where it IS the identity: facebook.com/profile.php?id=…
    const id = /\/profile\.php$/i.test(u.pathname) ? u.searchParams.get('id') : null
    const keep = id && /^\d{5,30}$/.test(id) ? `?id=${id}` : ''
    return { network, url: `${u.protocol}//${u.hostname.replace(/^m\./, 'www.')}${u.pathname.replace(/\/$/, '')}${keep}` }
  }
  return null
}

function flattenJsonLd(node: unknown, out: Array<Record<string, unknown>>) {
  if (Array.isArray(node)) return node.forEach((n) => flattenJsonLd(n, out))
  if (node && typeof node === 'object') {
    const o = node as Record<string, unknown>
    out.push(o)
    if (o['@graph']) flattenJsonLd(o['@graph'], out)
  }
}

const typeOf = (o: Record<string, unknown>): string[] => ([] as unknown[]).concat(o['@type'] ?? []).map(String)
const asArray = <T,>(v: T | T[] | undefined | null): T[] => (v == null ? [] : Array.isArray(v) ? v : [v])

function addressString(a: unknown): string | null {
  if (typeof a === 'string') return a.trim() || null
  if (a && typeof a === 'object') {
    const o = a as Record<string, unknown>
    const parts = [o.streetAddress, o.addressLocality, o.addressRegion, o.postalCode].filter((x) => typeof x === 'string' && x).map(String)
    return parts.length >= 2 ? parts.join(', ') : null
  }
  return null
}

export function extractFromHtml(html: string, pageUrl: string): PageExtraction {
  const $ = cheerio.load(html)
  const emails = new Map<string, Evidence>(), phones = new Map<string, Evidence>()
  const addresses = new Map<string, Evidence>(), names = new Map<string, Evidence>()
  const socials: PageExtraction['socials'] = {}
  const put = <T,>(map: Map<string, Evidence<T>>, key: string, ev: Evidence<T>) => {
    const cur = map.get(key); if (!cur || ev.confidence > cur.confidence) map.set(key, ev)
  }
  const addEmail = (raw: string, method: Evidence['method'], confidence: number) => {
    const e = normEmail(raw)
    if (!/^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/.test(e) || JUNK_EMAIL.test(e)) return
    put(emails, e, { value: e, sourceUrl: pageUrl, confidence, method })
  }
  const addPhone = (raw: string, method: Evidence['method'], confidence: number) => {
    const d = normPhone(raw)
    if (!validPhone(d)) return
    put(phones, d, { value: raw.replace(/^tel:/i, '').trim(), sourceUrl: pageUrl, confidence, method })
  }
  const addSocial = (raw: string, method: Evidence['method'], confidence: number) => {
    const c = classifySocialUrl(raw)
    if (!c) return
    const cur = socials[c.network]
    if (!cur || confidence > cur.confidence) socials[c.network] = { value: c.url, sourceUrl: pageUrl, confidence, method }
  }

  // JSON-LD
  const jsonLd: Array<Record<string, unknown>> = []
  $('script[type="application/ld+json"]').each((_, el) => {
    try { flattenJsonLd(JSON.parse($(el).contents().text()), jsonLd) } catch { /* malformed block: skip */ }
  })
  for (const node of jsonLd) {
    const types = typeOf(node)
    // schema.org has hundreds of LocalBusiness subtypes (Plumber, Electrician, RoofingContractor, ...).
    // Rather than enumerate them, accept any node that carries business-contact fields, minus types
    // that describe something else (people, content, events, products).
    const notBusiness = types.some((t) => /^(Person|Product|Event|Article|BlogPosting|NewsArticle|WebSite|WebPage|BreadcrumbList|ImageObject|VideoObject|Review|Offer|FAQPage|ListItem|SearchAction)$/i.test(t))
    const isOrg = !notBusiness && (
      types.some((t) => /Organization|Business|Store|Restaurant|Service|Professional|Dentist|Physician|Attorney|Repair|Salon|Gym|Hotel|Plumber|Electrician|Contractor|Clinic|Spa/i.test(t))
      || ['telephone', 'email', 'address'].some((k) => node[k] != null))
    if (isOrg) {
      for (const e of asArray(node.email as string)) if (typeof e === 'string') addEmail(e, 'json-ld', 0.9)
      for (const t of asArray(node.telephone as string)) if (typeof t === 'string') addPhone(t, 'json-ld', 0.9)
      for (const a of asArray(node.address)) { const s = addressString(a); if (s) put(addresses, s.toLowerCase(), { value: s, sourceUrl: pageUrl, confidence: 0.9, method: 'json-ld' }) }
      for (const s of asArray(node.sameAs as string)) if (typeof s === 'string') addSocial(s, 'sameAs', 0.9)
      for (const key of ['founder', 'employee', 'member', 'contactPoint']) for (const p of asArray(node[key] as any)) {
        if (p && typeof p === 'object' && typeof (p as any).name === 'string' && (typeOf(p as any).includes('Person') || key !== 'contactPoint')) {
          const nm = String((p as any).name).trim()
          if (nm) put(names, nm.toLowerCase(), { value: nm, sourceUrl: pageUrl, confidence: 0.85, method: 'json-ld' })
        }
        if (key === 'contactPoint' && p && typeof p === 'object') {
          const cp = p as Record<string, unknown>
          if (typeof cp.email === 'string') addEmail(cp.email, 'json-ld', 0.9)
          if (typeof cp.telephone === 'string') addPhone(cp.telephone, 'json-ld', 0.9)
        }
      }
    }
    if (types.includes('Person') && typeof node.name === 'string' && typeof node.jobTitle === 'string') {
      put(names, node.name.toLowerCase(), { value: node.name, sourceUrl: pageUrl, confidence: 0.75, method: 'json-ld' })
    }
  }

  // Microdata
  $('[itemscope]').each((_, el) => {
    const $el = $(el), type = ($el.attr('itemtype') ?? '')
    if (/PostalAddress/i.test(type)) {
      const parts = ['streetAddress', 'addressLocality', 'addressRegion', 'postalCode'].map((p) => $el.find(`[itemprop="${p}"]`).first().text().trim()).filter(Boolean)
      if (parts.length >= 2) put(addresses, parts.join(', ').toLowerCase(), { value: parts.join(', '), sourceUrl: pageUrl, confidence: 0.8, method: 'microdata' })
    }
    $el.find('[itemprop="telephone"]').each((__, t) => addPhone($(t).attr('content') ?? $(t).text(), 'microdata', 0.8))
    $el.find('[itemprop="email"]').each((__, t) => addEmail($(t).attr('content') ?? $(t).text(), 'microdata', 0.8))
  })

  // Anchors: mailto / tel / social
  $('a[href]').each((_, a) => {
    const href = ($(a).attr('href') ?? '').trim()
    if (/^mailto:/i.test(href)) addEmail(href, 'mailto', 0.95)
    else if (/^tel:/i.test(href)) addPhone(decodeURIComponent(href), 'tel', 0.95)
    else if (/^https?:|^\/\//i.test(href)) {
      const inChrome = $(a).closest('footer, header, nav, [class*="social"], [class*="footer"]').length > 0
      addSocial(href.startsWith('//') ? `https:${href}` : href, 'footer-link', inChrome ? 0.85 : 0.7)
    }
  })

  // Cloudflare-protected emails
  $('[data-cfemail]').each((_, el) => { const d = decodeCloudflareEmail($(el).attr('data-cfemail') ?? ''); if (d) addEmail(d, 'obfuscated-decoded', 0.8) })
  $('a[href*="/cdn-cgi/l/email-protection#"]').each((_, el) => {
    const d = decodeCloudflareEmail(($(el).attr('href') ?? '').split('#')[1] ?? ''); if (d) addEmail(d, 'obfuscated-decoded', 0.8)
  })

  // Visible text (scripts/styles removed). Footer / address / contact blocks rank higher.
  $('script, style, noscript, template').remove()
  const fullText = ($('body').length ? $('body').text() : $.root().text()).replace(/\s+/g, ' ')
  const contextual = $('footer, address, [class*="contact"], [id*="contact"], [class*="footer"]').text()
  const ctxText = contextual.replace(/\s+/g, ' ')
  for (const m of fullText.matchAll(EMAIL_RE)) addEmail(m[0], 'page-text', ctxText.includes(m[0]) ? 0.8 : 0.65)
  for (const e of decodeTextObfuscation(fullText)) addEmail(e, 'obfuscated-decoded', 0.7)
  for (const m of fullText.matchAll(PHONE_RE)) addPhone(m[0], 'page-text', ctxText.includes(m[0]) ? 0.7 : 0.55)
  $('address').each((_, el) => {
    const t = $(el).text().replace(/\s+/g, ' ').trim()
    if (/\d{1,6}\s+\S+.*\b[A-Z]{2}\b\s*\d{5}/.test(t)) put(addresses, t.toLowerCase(), { value: t, sourceUrl: pageUrl, confidence: 0.7, method: 'page-text' })
  })

  // OpenGraph (site-level facts only; used for corroboration, never as contact data)
  const openGraph: Record<string, string> = {}
  $('meta[property^="og:"]').each((_, m) => { const k = $(m).attr('property'); const v = $(m).attr('content'); if (k && v) openGraph[k] = v })

  return { emails: [...emails.values()], phones: [...phones.values()], addresses: [...addresses.values()], contactNames: [...names.values()], socials, jsonLd, openGraph }
}

/** Merge evidence across pages: same value → keep the best, +0.05 per extra distinct source page (cap .99). */
export function mergeEvidence(lists: Evidence[][], key: (v: string) => string = (v) => v.toLowerCase()): Evidence[] {
  const by = new Map<string, { best: Evidence; sources: Set<string> }>()
  for (const ev of lists.flat()) {
    const k = key(ev.value)
    const cur = by.get(k)
    if (!cur) by.set(k, { best: ev, sources: new Set([ev.sourceUrl]) })
    else { cur.sources.add(ev.sourceUrl); if (ev.confidence > cur.best.confidence) cur.best = ev }
  }
  return [...by.values()]
    .map(({ best, sources }) => ({ ...best, confidence: Math.min(0.99, Math.round((best.confidence + 0.05 * (sources.size - 1)) * 100) / 100) }))
    .sort((a, b) => b.confidence - a.confidence)
}
