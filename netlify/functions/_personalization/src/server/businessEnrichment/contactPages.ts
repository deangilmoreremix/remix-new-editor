/**
 * Contact/about page discovery. Technique reimplemented from Scrapling's LinkExtractor rules
 * (allow/deny patterns, ignored extensions, same-domain, canonicalisation) applied to scoring
 * likely contact pages. Pure: takes anchors, returns ranked same-site URLs.
 */
import { canonicalizePageUrl, isCrawlablePageUrl } from '../pageSignals'

export interface Anchor { href: string; text: string }

const POSITIVE: Array<[RegExp, number]> = [
  [/(^|[\/\-_])contact(-?us)?([\/\-_.]|$)/i, 10],
  [/(^|[\/\-_])(get-?in-?touch|reach-?us|connect)([\/\-_.]|$)/i, 8],
  [/(^|[\/\-_])(about(-?us)?|our-?story|who-?we-?are)([\/\-_.]|$)/i, 6],
  [/(^|[\/\-_])(team|staff|meet|owners?|people|our-?team)([\/\-_.]|$)/i, 6],
  [/(^|[\/\-_])(locations?|find-?us|visit|directions|hours)([\/\-_.]|$)/i, 5],
  [/(^|[\/\-_])(book|appointments?|schedule|quote|estimate)([\/\-_.]|$)/i, 3],
]
const TEXT_POSITIVE: Array<[RegExp, number]> = [
  [/\bcontact\b/i, 8], [/\bget in touch\b|\breach us\b/i, 6], [/\babout\b/i, 4], [/\bteam\b|\bstaff\b|\bmeet\b/i, 4], [/\blocations?\b|\bfind us\b/i, 3],
]
const NEGATIVE = /(\/(blog|news|posts?|tag|category|author|cart|checkout|login|signin|account|wp-admin|privacy|terms|careers?|jobs|press|shop|store|product|faq)\b)/i

export function scoreContactLink(url: string, text: string): number {
  let path = ''
  try { path = new URL(url).pathname } catch { return 0 }
  if (NEGATIVE.test(path)) return 0
  let score = 0
  for (const [re, w] of POSITIVE) if (re.test(path)) score = Math.max(score, w)
  for (const [re, w] of TEXT_POSITIVE) if (re.test(text)) score += w * 0.5
  return score
}

/** Same-site (incl. www) candidate pages ranked by contact-likelihood; deduped, capped. */
export function pickContactPages(anchors: Anchor[], baseUrl: string, max = 4): string[] {
  let base: URL
  try { base = new URL(baseUrl) } catch { return [] }
  const host = (h: string) => h.replace(/^www\./, '')
  const best = new Map<string, number>()
  for (const a of anchors) {
    let abs: string
    try { abs = canonicalizePageUrl(new URL(a.href, base).toString()) } catch { continue }
    if (!isCrawlablePageUrl(abs)) continue
    const u = new URL(abs)
    if (host(u.hostname) !== host(base.hostname)) continue
    if (u.pathname === '/' || u.pathname === base.pathname) continue
    const s = scoreContactLink(abs, a.text)
    if (s <= 0) continue
    best.set(abs, Math.max(best.get(abs) ?? 0, s))
  }
  return [...best.entries()].sort((x, y) => y[1] - x[1]).slice(0, max).map(([u]) => u)
}
