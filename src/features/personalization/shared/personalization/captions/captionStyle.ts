/**
 * Pure rules for burned-in captions: which line and word to show at a time, how big and where to draw them, and how to
 * sanitise captions read back from a saved project. No browser or Remotion code here, so it is fully testable.
 */
import { isCapiteStyleId } from './capiteStyles'
import type { CaptionPosition, CaptionStyleId, PreviewCaptionCue, PreviewCaptionWord, PreviewCaptions } from '../preview/types'

export const CAPTION_STYLES: readonly { id: CaptionStyleId; label: string; hint: string }[] = Object.freeze([
  { id: 'bold', label: 'Bold', hint: 'Big, with the spoken word picked out' },
  { id: 'bar', label: 'Bar', hint: 'White text on a dark bar' },
  { id: 'clean', label: 'Clean', hint: 'Plain white text with a thin dark outline' },
])
export const CAPTION_POSITIONS: readonly { id: CaptionPosition; label: string }[] = Object.freeze([
  { id: 'bottom', label: 'Bottom' }, { id: 'middle', label: 'Middle' }, { id: 'top', label: 'Top' },
])

/** Caps that keep a saved project small and a bad file harmless. */
export const MAX_CAPTION_CUES = 300
export const MAX_WORDS_PER_CAPTION_CUE = 12
export const MAX_CAPTION_TEXT = 120

/** The cue showing at `ms` (the latest one that has started and not ended), or null. */
export function activeCueAt(cues: readonly PreviewCaptionCue[], ms: number): PreviewCaptionCue | null {
  for (let i = cues.length - 1; i >= 0; i--) {
    const c = cues[i]
    if (ms >= c.startMs) return ms < c.endMs ? c : null
  }
  return null
}

/** Index of the word being spoken at `ms` (the last one that has started), or -1 when the cue has no word times. */
export function activeWordIndex(cue: PreviewCaptionCue, ms: number): number {
  const words = cue.words
  if (!words?.length) return -1
  let idx = -1
  for (let i = 0; i < words.length; i++) if (ms >= words[i].startMs) idx = i
  return idx
}

export interface CaptionLayout {
  fontSizePx: number
  /** Widest the text may be, in px. */
  maxWidthPx: number
  /** Distance from the frame edge (bottom/top) or a centring offset, in px. */
  marginPx: number
  /** Vertical anchor: CSS-style fractions of the frame height. */
  anchor: 'bottom' | 'middle' | 'top'
}

/**
 * Size from the frame HEIGHT: a 16:9 frame and a 9:16 frame then both get readable text, and a text line never runs
 * wider than ~86% of the frame. Margins keep clear of the edges platforms crop into.
 */
export function captionLayout(style: CaptionStyleId, position: CaptionPosition, width: number, height: number): CaptionLayout {
  const w = Math.max(2, width), h = Math.max(2, height)
  const portrait = h > w
  const base = (portrait ? 0.034 : 0.05) * h
  const fontSizePx = Math.max(10, Math.round(base * (style === 'bold' ? 1.25 : 1)))
  const marginPx = Math.round(h * (position === 'middle' ? 0 : portrait ? 0.14 : 0.07))
  return { fontSizePx, maxWidthPx: Math.round(w * 0.86), marginPx, anchor: position }
}

const isStyle = (v: unknown): v is CaptionStyleId => v === 'bold' || v === 'bar' || v === 'clean' || isCapiteStyleId(v)
const isPosition = (v: unknown): v is CaptionPosition => v === 'bottom' || v === 'middle' || v === 'top'
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null)

function cleanWord(raw: unknown): PreviewCaptionWord | null {
  const r = raw as Partial<PreviewCaptionWord> | null
  const text = typeof r?.text === 'string' ? r.text.replace(/\s+/g, ' ').trim().slice(0, 40) : ''
  const s = num(r?.startMs), e = num(r?.endMs)
  if (!text || s === null || e === null) return null
  return { text, startMs: Math.max(0, s), endMs: Math.max(s, e) }
}

function cleanCue(raw: unknown): PreviewCaptionCue | null {
  const r = raw as Partial<PreviewCaptionCue> | null
  const text = typeof r?.text === 'string' ? r.text.replace(/\s+/g, ' ').trim().slice(0, MAX_CAPTION_TEXT) : ''
  const s = num(r?.startMs), e = num(r?.endMs)
  if (!text || s === null || e === null) return null
  const startMs = Math.max(0, s)
  const cue: PreviewCaptionCue = { startMs, endMs: Math.max(startMs + 1, e), text }
  if (Array.isArray(r?.words)) {
    const words = r.words.map(cleanWord).filter((w): w is PreviewCaptionWord => !!w).slice(0, MAX_WORDS_PER_CAPTION_CUE)
    if (words.length) cue.words = words
  }
  return cue
}

/** Cues read back from storage or a file: drops junk, orders them, enforces the caps. */
export function cleanCues(raw: unknown): PreviewCaptionCue[] {
  if (!Array.isArray(raw)) return []
  return raw.map(cleanCue).filter((c): c is PreviewCaptionCue => !!c).sort((a, b) => a.startMs - b.startMs).slice(0, MAX_CAPTION_CUES)
}

/** Captions from a saved project, or undefined when there is nothing valid to keep. */
export function normalizeCaptions(raw: unknown): PreviewCaptions | undefined {
  const r = raw as Partial<PreviewCaptions> | null
  if (!r || typeof r !== 'object') return undefined
  const cues = cleanCues(r.cues)
  if (!cues.length || typeof r.forUrl !== 'string' || !r.forUrl) return undefined
  return {
    enabled: r.enabled !== false,
    forUrl: r.forUrl,
    style: isStyle(r.style) ? r.style : 'bold',
    position: isPosition(r.position) ? r.position : 'bottom',
    cues,
  }
}

/**
 * The captions after a change: `null` removes them; a patch is merged over what is there (or starts them) and the
 * result is cleaned (caps, junk). Nothing valid left (no cues, no video) means no captions.
 */
export function applyCaptionsPatch(current: PreviewCaptions | undefined, patch: Partial<PreviewCaptions> | null): PreviewCaptions | undefined {
  if (patch === null) return undefined
  return normalizeCaptions({ ...(current ?? {}), ...patch })
}
