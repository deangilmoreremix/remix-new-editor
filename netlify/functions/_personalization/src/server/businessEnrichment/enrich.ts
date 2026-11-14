/**
 * Business website enrichment orchestrator.
 *
 * Techniques reimplemented in TypeScript, inspired by Scrapling (not the Scrapling library):
 * robots.txt compliance, adaptive per-domain throttling, retry/backoff + circuit breaker,
 * sitemap crawling, contact-page discovery, structured-data + contact extraction, JS-shell
 * escalation to an injected renderer. Runs on the existing stack: SSRF-safe fetch (every hop
 * re-validated), Cheerio parsing, optional Playwright rendering.
 */
import * as cheerio from 'cheerio'
import { looksJsRendered } from '../pageSignals'
import { fetchWithValidatedRedirects } from '../businessDiscovery/researchProvider'
import { robotsFromResponse, type RobotsRules } from './robots'
import { DomainThrottle, parseRetryAfter } from './throttle'
import { CircuitBreaker, withRetry } from './retry'
import { extractFromHtml, mergeEvidence, normPhone, type PageExtraction } from './extract'
import { pickContactPages, scoreContactLink, type Anchor } from './contactPages'
import { crawlSitemaps } from './sitemap'
import type { BusinessEnrichment, Evidence, SocialNetwork } from './types'

export interface FetchedPage { status: number; body: string; finalUrl: string; contentType?: string; retryAfterMs?: number }

export interface EnrichDeps {
  fetchPage?: (url: string, signal?: AbortSignal) => Promise<FetchedPage>
  fetchBytes?: (url: string, signal?: AbortSignal) => Promise<Buffer | null>
  /** Optional JS renderer (Playwright). Only used when a page looks like an empty JS shell. */
  renderPage?: (url: string, signal?: AbortSignal) => Promise<string | null>
  throttle?: DomainThrottle
  breaker?: CircuitBreaker
  maxPages?: number
  signal?: AbortSignal
  userAgent?: string
  sleep?: (ms: number) => Promise<void>
}

export const ENRICH_USER_AGENT = 'OpenHiggsBoltBot/1.0 (+business-contact-lookup; respects robots.txt)'

/** Default page fetch: the existing SSRF-safe fetch, status/Retry-After surfaced instead of thrown. */
export async function safeFetchPage(url: string, signal?: AbortSignal): Promise<FetchedPage> {
  try {
    const { response, finalUrl } = await fetchWithValidatedRedirects(url, {
      timeoutMs: 8000, maxBytes: 1_500_000, signal,
      headers: { 'User-Agent': ENRICH_USER_AGENT, Accept: 'text/html,application/xhtml+xml,text/plain,application/xml;q=0.9,*/*;q=0.5' },
    })
    return { status: response.status, body: typeof response.data === 'string' ? response.data : String(response.data ?? ''), finalUrl, contentType: String(response.headers?.['content-type'] ?? '') }
  } catch (err) {
    const r = (err as { response?: { status?: number; headers?: Record<string, string> } })?.response
    if (r?.status) return { status: r.status, body: '', finalUrl: url, retryAfterMs: parseRetryAfter(r.headers?.['retry-after']) ?? undefined }
    throw err
  }
}

async function safeFetchBytes(url: string, signal?: AbortSignal): Promise<Buffer | null> {
  try {
    const { response } = await fetchWithValidatedRedirects(url, { timeoutMs: 8000, maxBytes: 3_000_000, signal, headers: { 'User-Agent': ENRICH_USER_AGENT }, responseType: 'arraybuffer' })
    const d = response.data as unknown
    return Buffer.isBuffer(d) ? d : Buffer.from(typeof d === 'string' ? d : '')
  } catch { return null }
}

const host = (u: string) => { try { return new URL(u).hostname.replace(/^www\./, '').toLowerCase() } catch { return '' } }

export async function enrichBusinessWebsite(website: string, deps: EnrichDeps = {}): Promise<BusinessEnrichment> {
  const out: BusinessEnrichment = {
    website, emails: [], phones: [], addresses: [], contactNames: [], socials: {},
    pagesVisited: [], pagesSkipped: [], robots: { checked: false, status: 'unavailable' }, jsRendered: false, notes: [],
  }
  let base: URL
  try { base = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(website) ? website : `https://${website}`) } catch { out.notes.push('invalid website URL'); return out }
  if (!/^https?:$/.test(base.protocol)) { out.notes.push('unsupported URL scheme'); return out }

  const fetchPage = deps.fetchPage ?? safeFetchPage
  const fetchBytes = deps.fetchBytes ?? safeFetchBytes
  const throttle = deps.throttle ?? new DomainThrottle({ ...(deps.sleep ? { sleep: deps.sleep } : {}) })
  const breaker = deps.breaker ?? new CircuitBreaker()
  const maxPages = deps.maxPages ?? 5
  const domain = host(base.toString())
  const origin = base.origin

  const get = async (url: string): Promise<FetchedPage | null> => {
    if (breaker.isOpen(domain)) { out.pagesSkipped.push({ url, reason: 'blocked' }); return null }
    try {
      const page = await withRetry(async () => {
        const p = await throttle.run(domain, () => fetchPage(url, deps.signal), deps.signal)
        if (p.status === 429 || p.status >= 500) { const e = new Error(`HTTP ${p.status}`) as Error & { response: { status: number } }; e.response = { status: p.status }; throw e }
        return p
      }, { signal: deps.signal, ...(deps.sleep ? { sleep: deps.sleep } : {}) })
      breaker.success(domain)
      return page
    } catch {
      if (!deps.signal?.aborted) breaker.failure(domain) // a deadline abort is not the site's fault
      out.pagesSkipped.push({ url, reason: 'error' })
      return null
    }
  }

  // 1) robots.txt (fail-closed on 5xx/network, open on 4xx)
  let rules: RobotsRules
  try {
    const r = await throttle.run(domain, () => fetchPage(`${origin}/robots.txt`, deps.signal), deps.signal)
    rules = robotsFromResponse(r.status, r.body, deps.userAgent ?? 'OpenHiggsBoltBot')
  } catch { rules = robotsFromResponse(null, '') }
  out.robots = { checked: true, status: rules.status }
  throttle.setFloor(domain, rules.crawlDelaySec)
  if (rules.status === 'disallow-all') { out.notes.push('robots.txt disallows crawling (or could not be read); no pages were fetched'); return out }

  const allowed = (url: string) => { try { const u = new URL(url); return rules.isAllowed(u.pathname + u.search) } catch { return false } }
  const extractions: PageExtraction[] = []
  const visited = new Set<string>()

  const visit = async (url: string): Promise<{ html: string; anchors: Anchor[]; finalUrl: string } | null> => {
    if (visited.has(url)) return null
    if (visited.size >= maxPages) { out.pagesSkipped.push({ url, reason: 'cap' }); return null }
    if (!allowed(url)) { out.pagesSkipped.push({ url, reason: 'robots' }); return null }
    visited.add(url)
    const page = await get(url)
    if (!page || page.status >= 400) { if (page) out.pagesSkipped.push({ url, reason: 'error' }); return null }
    let html = page.body
    if (/pdf|image|video|octet/i.test(page.contentType ?? '')) return null
    if (deps.renderPage && looksJsRendered(html).jsRendered) {
      try { const rendered = await deps.renderPage(page.finalUrl, deps.signal); if (rendered) { html = rendered; out.jsRendered = true } } catch { out.notes.push(`JS rendering failed for ${url}`) }
    }
    out.pagesVisited.push(page.finalUrl)
    extractions.push(extractFromHtml(html, page.finalUrl))
    const $ = cheerio.load(html)
    const anchors: Anchor[] = $('a[href]').toArray().map((a) => ({ href: $(a).attr('href') ?? '', text: $(a).text().replace(/\s+/g, ' ').trim() }))
    return { html, anchors, finalUrl: page.finalUrl }
  }

  // 2) homepage
  const home = await visit(base.toString())
  if (!home) {
    if (out.pagesSkipped.some((p) => p.reason === 'robots')) out.notes.push('robots.txt disallows the homepage; no pages were fetched')
    else if (!out.pagesVisited.length) out.notes.push('homepage could not be fetched')
    return finish(out, extractions)
  }

  // 3) candidate pages: homepage link scoring + sitemap URLs scored by the same rules
  // Links resolve against where the homepage actually ended up — but only while that is the same site, because
  // robots.txt, throttling and the same-site filter above were all established for this host.
  const linkBase = home.finalUrl && host(home.finalUrl) === domain ? home.finalUrl : base.toString()
  const linked = pickContactPages(home.anchors, linkBase, maxPages)
  for (const url of linked) if (!allowed(url)) out.pagesSkipped.push({ url, reason: 'robots' })
  const fromLinks = linked.filter(allowed)
  let fromSitemap: string[] = []
  if (fromLinks.length < 2) {
    try {
      const roots = [...new Set([...rules.sitemaps, `${origin}/sitemap.xml`])].slice(0, 3)
      const { urls } = await crawlSitemaps(roots, { fetchBytes: (u) => fetchBytes(u, deps.signal), sameSite: (u) => host(u) === domain, maxSitemaps: 4, maxUrls: 300 })
      fromSitemap = urls.filter(allowed).map((u) => [u, scoreContactLink(u, '')] as const).filter(([, s]) => s > 0).sort((a, b) => b[1] - a[1]).map(([u]) => u).slice(0, maxPages)
    } catch { out.notes.push('sitemap could not be read') }
  }
  for (const url of [...new Set([...fromLinks, ...fromSitemap])]) {
    if (visited.size >= maxPages) { out.pagesSkipped.push({ url, reason: 'cap' }); continue }
    await visit(url)
  }
  return finish(out, extractions)
}

function finish(out: BusinessEnrichment, ex: PageExtraction[]): BusinessEnrichment {
  out.emails = mergeEvidence(ex.map((e) => e.emails))
  out.phones = mergeEvidence(ex.map((e) => e.phones), (v) => normPhone(v))
  out.addresses = mergeEvidence(ex.map((e) => e.addresses))
  out.contactNames = mergeEvidence(ex.map((e) => e.contactNames))
  for (const net of ['facebook', 'instagram', 'linkedin', 'youtube', 'tiktok', 'x', 'pinterest'] as SocialNetwork[]) {
    const best = mergeEvidence(ex.map((e) => (e.socials[net] ? [e.socials[net] as Evidence] : [])))[0]
    if (best) out.socials[net] = best
  }
  return out
}
