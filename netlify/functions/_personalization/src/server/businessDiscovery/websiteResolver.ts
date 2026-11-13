/**
 * Free website resolver for discovered businesses.
 *
 * Many OpenStreetMap listings carry only a Facebook/Instagram page (or no web
 * address at all). Asset discovery needs the business's OWN website, so this
 * module finds it without any paid API:
 *
 *   1. The business email's domain (info@joespizza.com → joespizza.com),
 *      unless it is a free-mail / ISP domain.
 *   2. Domains guessed from the business name (joespizza.com,
 *      joes-pizza.com, joespizzaaustin.com, joespizza.net).
 *
 * Every candidate is fetched through the SSRF-safe fetcher
 * (`fetchWithValidatedRedirects`) and only ACCEPTED when the page verifiably
 * belongs to the business (phone number on the page, or name + location
 * match). Parked/for-sale domains and redirects to social or directory pages
 * are rejected. An unverified guess is never returned.
 */

import * as cheerio from 'cheerio'
import { isOwnedWebsite } from '../../shared/personalization/websiteClassification'
import { fetchWithValidatedRedirects } from './researchProvider'
import { createStageDeadline, withDeadline } from './deadline'

export interface WebsiteResolveInput {
  name: string
  city?: string
  region?: string
  postalCode?: string
  phone?: string
  email?: string
}

export interface WebsiteResolveResult {
  website: string
  confidence: 'high' | 'medium'
  evidence: string[]
}

export type CandidateSource = 'email_domain' | 'name_guess'

export interface WebsiteCandidate {
  url: string
  source: CandidateSource
}

/** Overall budget for one resolve call. */
export const RESOLVE_DEADLINE_MS = 10_000
/** Per-candidate fetch timeout. */
const CANDIDATE_TIMEOUT_MS = 4_000
const MAX_CANDIDATES = 6
const CONCURRENCY = 3

/** Free-mail and ISP domains: an address there says nothing about a website. */
const FREE_MAIL_DOMAINS = new Set([
  'gmail.com', 'googlemail.com', 'yahoo.com', 'ymail.com', 'rocketmail.com',
  'hotmail.com', 'outlook.com', 'live.com', 'msn.com', 'aol.com', 'icloud.com',
  'me.com', 'mac.com', 'proton.me', 'protonmail.com', 'gmx.com', 'gmx.net',
  'mail.com', 'zoho.com', 'yandex.com', 'comcast.net', 'att.net',
  'sbcglobal.net', 'verizon.net', 'bellsouth.net', 'cox.net', 'charter.net',
  'earthlink.net', 'optonline.net', 'frontier.com', 'windstream.net',
  'rogers.com', 'shaw.ca', 'sympatico.ca', 'btinternet.com', 'sky.com',
  'qq.com', '163.com', 'web.de', 'orange.fr', 'free.fr',
])

/** Words that never make it into a guessed domain. */
const STOP_WORDS = new Set([
  'the', 'and', 'of', 'llc', 'inc', 'co', 'corp', 'ltd', 'company', 'pllc', 'pc',
])

/** Markers of parked, for-sale or placeholder pages. */
const PARKED_PATTERNS: RegExp[] = [
  /domain (name )?(is |may be )?for sale/i,
  /buy this domain/i,
  /this domain (has been|is) (registered|parked)/i,
  /domain parking/i,
  /parked (free|domain)/i,
  /\b(sedo|afternic|dan\.com|hugedomains|bodis|parkingcrew|above\.com|undeveloped\.com)\b/i,
  /godaddy\.com\/(domainsearch|forsale)/i,
  /future home of/i,
  /coming soon/i,
  /website is under construction/i,
  /account (has been )?suspended/i,
]

/** Lowercased, accent-stripped words of the business name. */
export function nameTokens(name: string): string[] {
  return (name || '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/['’`]/g, '')
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
}

function significantTokens(name: string): string[] {
  return nameTokens(name).filter((token) => !STOP_WORDS.has(token))
}

/** Domain of a business email, unless it is a free-mail / ISP address. */
export function emailDomain(email: string | undefined): string | null {
  if (!email) return null
  const match = email.trim().toLowerCase().match(/@([a-z0-9.-]+\.[a-z]{2,})$/)
  if (!match) return null
  const domain = match[1].replace(/^www\./, '')
  return FREE_MAIL_DOMAINS.has(domain) ? null : domain
}

/** Ordered website candidates: email domain first, then name-based guesses. */
export function candidateDomains(input: WebsiteResolveInput): WebsiteCandidate[] {
  const out: WebsiteCandidate[] = []
  const seen = new Set<string>()
  const push = (host: string, source: CandidateSource) => {
    const clean = host.toLowerCase()
    if (!clean || seen.has(clean) || clean.length > 63 + 4) return
    seen.add(clean)
    out.push({ url: `https://${clean}`, source })
  }

  const fromEmail = emailDomain(input.email)
  if (fromEmail) push(fromEmail, 'email_domain')

  const tokens = significantTokens(input.name)
  // A one-letter or empty name gives guesses that match unrelated sites.
  const joined = tokens.join('')
  if (joined.length >= 4) {
    push(`${joined}.com`, 'name_guess')
    if (tokens.length > 1) push(`${tokens.join('-')}.com`, 'name_guess')
    const cityToken = significantTokens(input.city || '').join('')
    if (cityToken) push(`${joined}${cityToken}.com`, 'name_guess')
    push(`${joined}.net`, 'name_guess')
    // Keep "the" when the business is branded with it (thecoffeehouse.com).
    const withThe = nameTokens(input.name)
    if (withThe[0] === 'the' && tokens.length > 0) push(`the${joined}.com`, 'name_guess')
  }

  return out.slice(0, MAX_CANDIDATES)
}

export function isParkedPage(html: string): boolean {
  const sample = html.slice(0, 200_000)
  return PARKED_PATTERNS.some((pattern) => pattern.test(sample))
}

function lastTenDigits(value: string | undefined): string | null {
  if (!value) return null
  const digits = value.replace(/\D/g, '')
  return digits.length >= 7 ? digits.slice(-10) : null
}

export interface PageMatch {
  confidence: 'high' | 'medium'
  evidence: string[]
}

/**
 * Decides whether a fetched page belongs to the business.
 *
 *  - phone digits on the page                         → high
 *  - email-domain candidate + a name word on the page → high
 *  - name in <title>/og:site_name + city/region/postcode on the page → medium
 *
 * Anything weaker is rejected.
 */
export function verifyPageMatchesBusiness(
  html: string,
  input: WebsiteResolveInput,
  source: CandidateSource,
): PageMatch | null {
  const $ = cheerio.load(html)
  const title = $('title').first().text()
  const siteName = $('meta[property="og:site_name"]').attr('content') || ''
  $('script, style, noscript').remove()
  const bodyText = $('body').text() || $.root().text()
  const hrefs = $('a[href^="tel:"]').map((_, el) => $(el).attr('href') || '').get().join(' ')
  const pageText = `${title} ${siteName} ${bodyText}`.toLowerCase()
  const pageDigits = `${pageText} ${hrefs}`.replace(/\D/g, '')

  const evidence: string[] = []
  const phone = lastTenDigits(input.phone)
  if (phone && pageDigits.includes(phone)) {
    evidence.push('phone number found on page')
    return { confidence: 'high', evidence }
  }

  const tokens = significantTokens(input.name)
  if (tokens.length === 0) return null
  const pageWords = new Set(nameTokens(pageText))
  const headerWords = new Set(nameTokens(`${title} ${siteName}`))

  if (source === 'email_domain' && tokens.some((token) => pageWords.has(token))) {
    evidence.push('domain matches business email', 'business name found on page')
    return { confidence: 'high', evidence }
  }

  const nameInHeader = tokens.every((token) => headerWords.has(token))
  if (!nameInHeader) return null

  const locationHints = [input.city, input.region, input.postalCode]
    .map((value) => (value || '').trim().toLowerCase())
    .filter((value) => value.length >= 2)
  const location = locationHints.find((hint) => pageText.includes(hint))
  if (!location) return null

  evidence.push('business name in page title', `location "${location}" found on page`)
  return { confidence: 'medium', evidence }
}

export interface ResolverDeps {
  fetchPage?: (
    url: string,
    options: { timeoutMs: number; signal: AbortSignal },
  ) => Promise<{ html: string; finalUrl: string; contentType: string }>
}

async function defaultFetchPage(
  url: string,
  options: { timeoutMs: number; signal: AbortSignal },
): Promise<{ html: string; finalUrl: string; contentType: string }> {
  const { response, finalUrl } = await fetchWithValidatedRedirects(url, options)
  const contentType = String(response.headers?.['content-type'] || '')
  const html = typeof response.data === 'string' ? response.data : ''
  return { html, finalUrl, contentType }
}

async function checkCandidate(
  candidate: WebsiteCandidate,
  input: WebsiteResolveInput,
  fetchPage: NonNullable<ResolverDeps['fetchPage']>,
  signal: AbortSignal,
): Promise<WebsiteResolveResult | null> {
  try {
    const { html, finalUrl, contentType } = await fetchPage(candidate.url, {
      timeoutMs: CANDIDATE_TIMEOUT_MS,
      signal,
    })
    if (contentType && !/html/i.test(contentType)) return null
    if (!html) return null
    // A redirect to a Facebook page or a marketplace listing is not a website.
    if (!isOwnedWebsite(finalUrl)) return null
    if (isParkedPage(html)) return null
    const match = verifyPageMatchesBusiness(html, input, candidate.source)
    if (!match) return null
    let website = finalUrl
    try {
      const parsed = new URL(finalUrl)
      website = `${parsed.protocol}//${parsed.host}${parsed.pathname === '/' ? '' : parsed.pathname}`
    } catch {
      // keep finalUrl as-is
    }
    return { website, confidence: match.confidence, evidence: match.evidence }
  } catch {
    // Unresolvable domain, timeout, blocked target: just not this candidate.
    return null
  }
}

/**
 * Finds and verifies the business's own website. Resolves `null` when no
 * candidate can be verified within the budget.
 */
export async function resolveBusinessWebsite(
  input: WebsiteResolveInput,
  options: { deadlineMs?: number } & ResolverDeps = {},
): Promise<WebsiteResolveResult | null> {
  const candidates = candidateDomains(input)
  if (candidates.length === 0) return null

  const fetchPage = options.fetchPage ?? defaultFetchPage
  const deadline = createStageDeadline('website-resolve', options.deadlineMs ?? RESOLVE_DEADLINE_MS)
  const results: Array<WebsiteResolveResult | null> = new Array(candidates.length).fill(null)

  const work = (async () => {
    let next = 0
    const worker = async () => {
      while (next < candidates.length && !deadline.expired()) {
        const index = next++
        results[index] = await checkCandidate(candidates[index], input, fetchPage, deadline.signal)
        // Earlier-ranked candidates win, so stop once a higher-priority hit exists.
        if (results.slice(0, index + 1).some(Boolean)) {
          next = candidates.length
        }
      }
    }
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, candidates.length) }, worker))
  })()

  try {
    await withDeadline(work, deadline)
  } catch {
    // Budget spent: fall through with whatever was verified so far.
  }

  // Prefer the highest-ranked candidate; among those, high confidence first.
  const verified = results.filter((r): r is WebsiteResolveResult => r !== null)
  return verified.find((r) => r.confidence === 'high') ?? verified[0] ?? null
}
