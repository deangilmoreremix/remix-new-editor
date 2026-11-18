/**
 * Keeping the captions off other text: where the caption band is on the frame, whether it covers a layer, and the nearest vertical offset that
 * does not. Pure; no React. Identical in remix-new-editor and OpenHiggsBolt. Everything is a fraction of the frame (0..1, from the top left).
 * The band is an estimate (a line of text is as wide as its letters, at about 0.55 em each), good enough to warn and to nudge, not a pixel check.
 */
import { MAX_CAPTION_OFFSET } from './captionCustom'

export interface Rect { left: number; top: number; right: number; bottom: number }

export interface CaptionBand {
  position: 'top' | 'middle' | 'bottom'
  /** Vertical offset from the place, as a fraction of the frame height (positive = up). */
  offsetY?: number
  /** The caption's font size as a fraction of the frame height. */
  size: number
  /** How far the top or bottom place is from the frame edge, as a fraction of the height. */
  edge: number
  /** Frame width / height. */
  aspect: number
  /** Letters in the longest caption line of text. */
  chars: number
  /** A box is drawn behind the text (adds padding). */
  box?: boolean
}

const SAFE_TOP = 0.02
const SAFE_BOTTOM = 0.98
const GAP = 0.012
const round3 = (v: number) => Math.round(v * 1000) / 1000

/** The area the caption covers at its current offset. */
export function captionRect(b: CaptionBand): Rect {
  const size = Math.max(0.005, b.size)
  const perLine = Math.max(8, Math.floor((0.86 * b.aspect) / (0.55 * size)))
  const chars = Math.max(1, b.chars)
  const lines = Math.min(2, Math.max(1, Math.ceil(chars / perLine)))
  const h = lines * size * 1.2 + (b.box ? size * 0.5 : 0) + size * 0.1
  const w = Math.min(0.86, (Math.min(chars, perLine) * 0.55 * size) / b.aspect + (b.box ? (size * 1.2) / b.aspect : 0))
  const centre = (b.position === 'top' ? b.edge + h / 2 : b.position === 'middle' ? 0.5 : 1 - b.edge - h / 2) - (b.offsetY ?? 0)
  return { left: 0.5 - w / 2, right: 0.5 + w / 2, top: centre - h / 2, bottom: centre + h / 2 }
}

export const rectsOverlap = (a: Rect, b: Rect): boolean => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom

/** The blockers the caption band covers at the given offset. */
export const coveredBy = (band: CaptionBand, blockers: readonly Rect[]): Rect[] => {
  const r = captionRect(band)
  return blockers.filter((x) => rectsOverlap(r, x))
}

export interface Clearance {
  /** The offset to use: unchanged when the band was clear, or when no clear spot exists. */
  offsetY: number | undefined
  /** The band covered something at the offset it was given. */
  overlapped: boolean
  /** The returned offset leaves the band clear of every blocker. */
  cleared: boolean
}

/**
 * The offset nearest to the current one that leaves the caption clear of every blocker and on the frame: tried just above and just below each
 * blocker. When none exists the offset is left as it is and `cleared` is false.
 */
export function clearCaptionOffset(band: CaptionBand, blockers: readonly Rect[]): Clearance {
  const current = band.offsetY ?? 0
  const clearAt = (offset: number) => {
    const r = captionRect({ ...band, offsetY: offset })
    return r.top >= SAFE_TOP && r.bottom <= SAFE_BOTTOM && !blockers.some((x) => rectsOverlap(r, x))
  }
  if (coveredBy(band, blockers).length === 0) return { offsetY: band.offsetY, overlapped: false, cleared: true }
  const h = (() => { const r = captionRect({ ...band, offsetY: 0 }); return r.bottom - r.top })()
  const at0 = captionRect({ ...band, offsetY: 0 })
  const centre0 = (at0.top + at0.bottom) / 2
  const candidates = new Set<number>([0])
  for (const x of blockers) {
    candidates.add(centre0 - (x.top - GAP - h / 2)) // just above it
    candidates.add(centre0 - (x.bottom + GAP + h / 2)) // just below it
  }
  const ok = [...candidates]
    .map(round3)
    .filter((o) => Math.abs(o) <= MAX_CAPTION_OFFSET && clearAt(o))
    .sort((a, b) => Math.abs(a - current) - Math.abs(b - current))
  if (!ok.length) return { offsetY: band.offsetY, overlapped: true, cleared: false }
  const best = ok[0]
  return { offsetY: Math.abs(best) < 0.005 ? undefined : best, overlapped: true, cleared: true }
}
