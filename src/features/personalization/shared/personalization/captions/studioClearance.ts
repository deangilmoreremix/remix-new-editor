/**
 * Keeping Studio captions off other text: where the caption block is on the frame (the real Studio layout, with an estimated text width),
 * whether it covers a layer, and the nearest dragged height that does not. Pure; no React. Everything is a fraction of the frame (0..1 from
 * the top left). Identical in remix-new-editor and OpenHiggsBolt.
 */
import { layoutCaptionFrame } from './studioLayout'
import type { StudioCaptions } from './studioCaptions'

export interface Rect { left: number; top: number; right: number; bottom: number }

const GAP = 0.012
const SAFE_TOP = 0.02
const SAFE_BOTTOM = 0.98
const CHAR_EM = 0.55 // an average letter is about this many font heights wide
const round3 = (v: number) => Math.round(v * 1000) / 1000

export const rectsOverlap = (a: Rect, b: Rect): boolean => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom

/** The page with the most text: the tallest, widest block the captions will ever make. */
function longestPage(studio: StudioCaptions) {
  return studio.pages.reduce((a, p) => (p.tokens.reduce((n, t) => n + t.text.length, 0) > a.n ? { p, n: p.tokens.reduce((m, t) => m + t.text.length, 0) } : a), { p: studio.pages[0], n: -1 }).p
}

/** The area the captions cover (their longest page), at the dragged height they have, or at `positionY` when given. */
export function studioBandRect(studio: StudioCaptions, width: number, height: number, positionY?: number): Rect {
  const page = longestPage(studio)
  const style = positionY === undefined ? studio.style : { ...studio.style, positionY }
  const fontPx = (Math.max(1, studio.style.fontSize) / 100) * height
  const frame = page ? layoutCaptionFrame({ page, style, ms: page.tokens[0]?.fromMs ?? page.startMs, width, height, measure: (t) => t.length * CHAR_EM * fontPx }) : null
  if (!frame || !frame.words.length) return { left: 0.5, right: 0.5, top: 0.5, bottom: 0.5 }
  const left = Math.min(...frame.words.map((w) => w.cx - w.width / 2))
  const right = Math.max(...frame.words.map((w) => w.cx + w.width / 2))
  const top = Math.min(...frame.words.map((w) => w.cy - frame.lineH / 2))
  const bottom = Math.max(...frame.words.map((w) => w.cy + frame.lineH / 2))
  return { left: left / width, right: right / width, top: top / height, bottom: bottom / height }
}

/** The blockers the captions cover where they are now. */
export const coveredStudio = (studio: StudioCaptions, blockers: readonly Rect[], width: number, height: number): Rect[] => {
  const r = studioBandRect(studio, width, height)
  return blockers.filter((b) => rectsOverlap(r, b))
}

export interface StudioClearance {
  /** The dragged height to use: unchanged when the captions were clear, or when no clear spot exists. */
  positionY: number | undefined
  overlapped: boolean
  cleared: boolean
}

/**
 * The height nearest to the current one that leaves the captions clear of every blocker and on the frame: tried just above and just below
 * each blocker. When none exists the height is left as it is and `cleared` is false.
 */
export function clearStudioPosition(studio: StudioCaptions, blockers: readonly Rect[], width: number, height: number): StudioClearance {
  const now = studioBandRect(studio, width, height)
  const current = studio.style.positionY
  if (!blockers.some((b) => rectsOverlap(now, b))) return { positionY: current, overlapped: false, cleared: true }
  const h = now.bottom - now.top
  const centreNow = (now.top + now.bottom) / 2
  const candidates = new Set<number>()
  for (const b of blockers) {
    candidates.add(b.top - GAP - h / 2) // just above it
    candidates.add(b.bottom + GAP + h / 2) // just below it
  }
  const ok = [...candidates]
    .map(round3)
    .filter((y) => {
      const r = studioBandRect(studio, width, height, y)
      return r.top >= SAFE_TOP - 1e-6 && r.bottom <= SAFE_BOTTOM + 1e-6 && Math.abs((r.top + r.bottom) / 2 - y) < 0.01 && !blockers.some((b) => rectsOverlap(r, b))
    })
    .sort((a, b) => Math.abs(a - centreNow) - Math.abs(b - centreNow))
  if (!ok.length) return { positionY: current, overlapped: true, cleared: false }
  return { positionY: ok[0], overlapped: true, cleared: true }
}
