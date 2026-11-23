/**
 * Captions made in the Caption Studio, as the personalization editor stores and draws them. The Studio hands over ready-made PAGES
 * (words grouped the way it shows them, with times) and a plain STYLE; this file validates them when they are read back from a saved
 * project, and turns them into caption cues for the list and the SRT/VTT downloads. No browser code, no Remotion: fully testable.
 */
import type { CaptionPage } from './studioLayout'
import { WEIGHTS, type WeightName } from './studioFonts'
import type { CaptionStyleId, PreviewCaptionCue, PreviewCaptionWord } from '../preview/types'

export interface StudioCaptionStyle {
  /** The Studio look this came from (for reopening it), e.g. `capite-hormozi` or `tiktok`. */
  preset?: string
  fontFamily: string
  /** Font height as a percentage of the frame height. */
  fontSize: number
  position: 'top' | 'middle' | 'bottom'
  /** Dragged vertical centre of the captions, 0..1 of the frame height. Wins over `position`. */
  positionY?: number
  color: string
  highlightColor: string
  strokeColor: string
  backgroundColor: string
  /** One of the five weights; absent = the look's own (bold 800, otherwise 500). */
  weight?: WeightName
  bold: boolean
  italic: boolean
  uppercase: boolean
  stroke: boolean
  background: boolean
  highlightActive: boolean
  combineMs: number
  animation: 'highlight' | 'scale' | 'pop' | 'bounce' | 'glow' | 'box' | 'karaoke'
}

export interface StudioCaptions { pages: CaptionPage[]; style: StudioCaptionStyle }

/** Caps that keep a saved project small and a bad file harmless. */
export const MAX_STUDIO_PAGES = 1200
export const MAX_TOKENS_PER_PAGE = 24
export const MAX_STUDIO_TOKEN_TEXT = 40

const ANIMATIONS: ReadonlySet<string> = new Set(['highlight', 'scale', 'pop', 'bounce', 'glow', 'box', 'karaoke'])
const COLOR = /^(#[0-9a-f]{3,8}|rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*(,\s*(0|1|0?\.\d+)\s*)?\))$/i
const FONT_NAME = /^[A-Za-z0-9 .'-]{1,60}$/

const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null)
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))
const color = (v: unknown, fallback: string) => (typeof v === 'string' && COLOR.test(v.trim()) ? v.trim() : fallback)
const flag = (v: unknown, fallback: boolean) => (typeof v === 'boolean' ? v : fallback)

function cleanStyle(raw: unknown): StudioCaptionStyle {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const posY = num(r.positionY)
  const position = r.position === 'top' || r.position === 'middle' || r.position === 'bottom' ? r.position : 'bottom'
  return {
    ...(typeof r.preset === 'string' && /^[\w-]{1,40}$/.test(r.preset) ? { preset: r.preset } : {}),
    fontFamily: typeof r.fontFamily === 'string' && FONT_NAME.test(r.fontFamily.trim()) ? r.fontFamily.trim() : 'Inter',
    fontSize: clamp(num(r.fontSize) ?? 6, 1, 20),
    position,
    ...(posY !== null ? { positionY: clamp(posY, 0, 1) } : {}),
    color: color(r.color, '#FFFFFF'),
    highlightColor: color(r.highlightColor, '#FFE14D'),
    strokeColor: color(r.strokeColor, '#000000'),
    backgroundColor: color(r.backgroundColor, 'rgba(0,0,0,0.6)'),
    ...(typeof r.weight === 'string' && Object.prototype.hasOwnProperty.call(WEIGHTS, r.weight) ? { weight: r.weight as WeightName } : {}),
    bold: flag(r.bold, true), italic: flag(r.italic, false), uppercase: flag(r.uppercase, false),
    stroke: flag(r.stroke, true), background: flag(r.background, false), highlightActive: flag(r.highlightActive, true),
    combineMs: clamp(num(r.combineMs) ?? 900, 100, 6000),
    animation: typeof r.animation === 'string' && ANIMATIONS.has(r.animation) ? (r.animation as StudioCaptionStyle['animation']) : 'highlight',
  }
}

function cleanPage(raw: unknown): CaptionPage | null {
  const r = raw as { startMs?: unknown; durationMs?: unknown; tokens?: unknown } | null
  const start = num(r?.startMs), dur = num(r?.durationMs)
  if (start === null || dur === null || !Array.isArray(r?.tokens)) return null
  const tokens = r.tokens.map((t: { text?: unknown; fromMs?: unknown; toMs?: unknown }) => {
    const text = typeof t?.text === 'string' ? t.text.replace(/\s+/g, ' ').slice(0, MAX_STUDIO_TOKEN_TEXT) : ''
    const from = num(t?.fromMs), to = num(t?.toMs)
    return text.trim() && from !== null && to !== null ? { text, fromMs: Math.max(0, from), toMs: Math.max(from, to) } : null
  }).filter((t): t is { text: string; fromMs: number; toMs: number } => !!t).slice(0, MAX_TOKENS_PER_PAGE)
  return tokens.length ? { startMs: Math.max(0, start), durationMs: Math.max(1, dur), tokens } : null
}

/** Studio captions read back from storage or the Studio: undefined when there is nothing valid. */
export function cleanStudioCaptions(raw: unknown): StudioCaptions | undefined {
  const r = raw as { pages?: unknown; style?: unknown } | null
  if (!r || typeof r !== 'object' || !Array.isArray(r.pages)) return undefined
  const pages = r.pages.map(cleanPage).filter((p): p is CaptionPage => !!p).sort((a, b) => a.startMs - b.startMs).slice(0, MAX_STUDIO_PAGES)
  return pages.length ? { pages, style: cleanStyle(r.style) } : undefined
}

/** Cues (a line of up to 8 words each) for the list, SRT and VTT, and as the fallback when the Studio data is dropped. */
export function studioToCues(studio: StudioCaptions, perCue = 8): PreviewCaptionCue[] {
  const cues: PreviewCaptionCue[] = []
  studio.pages.forEach((p) => {
    for (let i = 0; i < p.tokens.length; i += perCue) {
      const chunk = p.tokens.slice(i, i + perCue)
      const words: PreviewCaptionWord[] = chunk.map((t) => ({ text: t.text.trim(), startMs: t.fromMs, endMs: t.toMs }))
      cues.push({ startMs: chunk[0].fromMs, endMs: Math.max(chunk[chunk.length - 1].toMs, chunk[0].fromMs + 1), text: words.map((w) => w.text).join(' '), words })
    }
  })
  return cues
}

/** The built-in look closest to a Studio look, for when the Studio data is dropped (an edit made outside the Studio). */
export function studioFallbackStyle(style: StudioCaptionStyle): CaptionStyleId {
  const p = style.preset || ''
  if (p.startsWith('capite-')) return p.slice(7) as CaptionStyleId
  if (style.background) return 'bar'
  return style.stroke ? 'bold' : 'clean'
}

/** The captions at a dragged height (0..1 of the frame from the top), or back in their place with `undefined`. */
export function withPositionY(studio: StudioCaptions, positionY: number | undefined): StudioCaptions {
  const { positionY: _was, ...rest } = studio.style
  return { ...studio, style: positionY === undefined ? rest : { ...rest, positionY: clamp(positionY, 0, 1) } }
}
