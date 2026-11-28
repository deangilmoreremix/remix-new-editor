/** Text checks: unresolved personalization tokens, comfortable reading time, claim detection, and fact-safe rewriting. */

const TOKEN_RE = /\{\{\s*[\w.\- ]+\s*\}\}|\[\[\s*[\w.\- ]+\s*\]\]|%[A-Z_]{3,}%|\{\s*(?:first|last)?name\s*\}|\[\s*(?:first|last)?name\s*\]|<<\s*[\w. -]+\s*>>/gi

/** Raw placeholders such as {{firstname}} that must never be published. */
export function findUnresolvedTokens(text: string | undefined | null): string[] {
  if (!text) return []
  return [...new Set(text.match(TOKEN_RE) ?? [])]
}

export function resolveTokens(text: string, values: Record<string, string | undefined>, fallbacks: Record<string, string> = {}): { text: string; unresolved: string[] } {
  const norm = (s: string) => s.replace(/[{}\[\]<>%\s]/g, '').toLowerCase().replace(/[-_.]/g, '')
  const lookup = new Map<string, string>()
  for (const [k, v] of Object.entries(values)) if (v) lookup.set(norm(k), v)
  const fb = new Map(Object.entries(fallbacks).map(([k, v]) => [norm(k), v]))
  const out = text.replace(TOKEN_RE, (m) => lookup.get(norm(m)) ?? fb.get(norm(m)) ?? m)
  return { text: out, unresolved: findUnresolvedTokens(out) }
}

/** Seconds a viewer needs to read `text` comfortably (~3 words/second plus a short settle time). */
export function readingSeconds(text: string, wordsPerSecond = 3): number {
  const words = text.trim().split(/\s+/).filter(Boolean).length
  return words ? Math.max(1.2, words / wordsPerSecond + 0.4) : 0
}

export interface FitResult { ok: boolean; warnings: string[]; lines: number; neededSeconds: number }

/** Approximate fit of text into a box at a font size for a display time. Estimates; the preview is the final word. */
export function checkTextFit(text: string, opts: { boxWidthPx: number; boxHeightPx: number; fontPx: number; seconds: number; maxLines?: number }): FitResult {
  const warnings: string[] = []
  const charsPerLine = Math.max(4, Math.floor(opts.boxWidthPx / (opts.fontPx * 0.55)))
  let lines = 0
  let cur = 0
  for (const w of text.split(/\s+/).filter(Boolean)) {
    const len = w.length
    if (cur === 0) { cur = len; lines = Math.max(1, lines || 1) }
    else if (cur + 1 + len <= charsPerLine) cur += 1 + len
    else { lines++; cur = len }
  }
  const neededSeconds = readingSeconds(text)
  const maxLines = opts.maxLines ?? Math.max(1, Math.floor(opts.boxHeightPx / (opts.fontPx * 1.25)))
  if (lines > maxLines) warnings.push(`Needs ${lines} lines but the box fits ${maxLines}. Shorten the text or enlarge the box.`)
  if (opts.seconds < neededSeconds) warnings.push(`Shown for ${opts.seconds.toFixed(1)}s but needs about ${neededSeconds.toFixed(1)}s to read.`)
  if (opts.fontPx < 18) warnings.push('Text is very small and may be hard to read on a phone.')
  return { ok: warnings.length === 0, warnings, lines, neededSeconds }
}

const CLAIM_RE = /(\$\s?\d|€\s?\d|£\s?\d|\b\d+(?:[.,]\d+)?\s?%|\b\d+\s?(?:usd|eur|gbp)\b|\bfree\b|\bguarantee[sd]?\b|\bno risk\b|\bsale\b|\bdiscount\b|\bdeal\b|\bsave\b|\boff\b|\blimited time\b|\btoday only\b|\bbest\b|#1)/i

/** True when a line states a price, offer, guarantee or superlative that must be confirmed before it goes in a video. */
export function isPromotionalClaim(text: string): boolean { return CLAIM_RE.test(text) }

const FILLER = /\b(?:really|very|just|actually|basically|simply|in order to|at this time|please note that)\b\s*/gi

const numbersOf = (s: string) => (s.match(/\d+(?:[.,]\d+)?/g) ?? []).join('|')

/**
 * Shortens user-provided offer text WITHOUT changing its meaning: it only drops filler words, trims at a word
 * boundary and keeps every number. Returns null when it cannot shorten without losing a figure.
 */
export function tightenOffer(text: string, maxChars: number): { text: string; changed: boolean } | null {
  const clean = text.replace(FILLER, '').replace(/\s{2,}/g, ' ').replace(/\s+([,.!?])/g, '$1').trim()
  if (clean.length <= maxChars) return { text: clean, changed: clean !== text.trim() }
  const cut = clean.slice(0, maxChars + 1)
  const sp = cut.lastIndexOf(' ')
  const trimmed = (sp > maxChars * 0.5 ? cut.slice(0, sp) : cut.slice(0, maxChars)).replace(/[\s,;:-]+$/, '')
  if (numbersOf(trimmed) !== numbersOf(clean)) return null
  return { text: trimmed, changed: true }
}
