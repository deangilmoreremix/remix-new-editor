/**
 * Small pure helpers for working on caption text: casing, find and replace, nudging a line's times, and a plain transcript.
 * Generic over the line type, so they serve both caption models (milliseconds in one repo, seconds in the other).
 * No React, no network, no repo imports; identical in remix-new-editor and OpenHiggsBolt.
 */
export type Casing = 'upper' | 'title' | 'lower'

export function applyCasing(text: string, casing: Casing): string {
  const t = String(text ?? '')
  if (casing === 'upper') return t.toUpperCase()
  if (casing === 'lower') return t.toLowerCase()
  return t.replace(/\S+/gu, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

export interface FindOptions { matchCase?: boolean; wholeWord?: boolean }

/** Replaces `find` with `replace` in every line. The search is literal text. Returns the same array and 0 for an empty search. */
export function findReplace<T extends { text: string }>(items: readonly T[], find: string, replace: string, opts: FindOptions = {}): { items: T[]; count: number } {
  if (!find) return { items: items as T[], count: 0 }
  const body = escapeRe(find)
  const src = opts.wholeWord ? `(?<![\\p{L}\\p{M}\\p{N}_])${body}(?![\\p{L}\\p{M}\\p{N}_])` : body
  const re = new RegExp(src, opts.matchCase ? 'gu' : 'giu')
  let count = 0
  const out = items.map((item) => {
    let hit = false
    const text = item.text.replace(re, () => { hit = true; count++; return replace })
    return hit ? { ...item, text } : item
  })
  return { items: out, count }
}

const round3 = (n: number) => Math.round(n * 1000) / 1000

/** Moves a line's start and end (seconds) by a small amount: never below 0, never shorter than `minLen`; no floating-point drift. */
export function clampNudge(start: number, end: number, deltaStart: number, deltaEnd: number, minLen = 0.1): [number, number] {
  let s = round3(Math.max(0, start + deltaStart))
  let e = round3(end + deltaEnd)
  if (e - s < minLen - 1e-9) {
    if (deltaStart !== 0) s = Math.max(0, round3(e - minLen))
    else e = round3(s + minLen)
    // Never below zero: when the start cannot move back far enough, the end gives way instead.
    if (e - s < minLen - 1e-9) e = round3(s + minLen)
  }
  return [s, e]
}

/** The words as plain text, one line per caption, with no times. Empty when there is nothing. */
export function transcriptText(lines: readonly string[]): string {
  const kept = lines.map((l) => String(l ?? '').trim()).filter(Boolean)
  return kept.length ? kept.join('\n') + '\n' : ''
}
