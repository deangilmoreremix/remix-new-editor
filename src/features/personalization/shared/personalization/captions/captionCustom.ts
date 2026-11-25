/**
 * The caption style fields of the customizer (font, weight, casing, vertical offset) as pure rules: how a saved or pasted value is made safe, and
 * how each one becomes a CSS value or an .ass value. No React, no repo imports besides the font list; identical in remix-new-editor and OpenHiggsBolt.
 */
import { CAPTION_WEIGHTS, isCaptionWeight, normalizeCaptionFont, type CaptionWeight } from './capiteFonts'

export type CaptionCasing = 'upper' | 'title' | 'original'
export const CAPTION_CASINGS: readonly CaptionCasing[] = ['upper', 'title', 'original']
export const isCaptionCasing = (v: unknown): v is CaptionCasing => typeof v === 'string' && (CAPTION_CASINGS as readonly string[]).includes(v)

/** How far a caption can be moved from its place, as a fraction of the frame height (positive = up). */
export const MAX_CAPTION_OFFSET = 0.4

export interface CaptionCustom {
  /** One of Capite's 16 fonts (canonical name). Absent = the look's own font. */
  fontFamily?: string
  weight?: CaptionWeight
  casing?: CaptionCasing
  /** Fraction of the frame height, -0.4..0.4, positive = up. Absent = the look's place. */
  offsetY?: number
  /** Keep the captions off other text when they are moved. On unless this is false (only `false` is stored). */
  keepClear?: false
}

const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)

/** The valid parts of a raw value; everything else is dropped, and an offset of 0 is "not moved". */
export function normalizeCustom(raw: unknown): CaptionCustom {
  const r = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {}
  const out: CaptionCustom = {}
  const font = normalizeCaptionFont(r.fontFamily)
  if (font) out.fontFamily = font
  if (isCaptionWeight(r.weight)) out.weight = r.weight
  if (isCaptionCasing(r.casing)) out.casing = r.casing
  if (r.keepClear === false) out.keepClear = false
  if (finite(r.offsetY)) {
    const o = Math.round(Math.min(MAX_CAPTION_OFFSET, Math.max(-MAX_CAPTION_OFFSET, r.offsetY)) * 1000) / 1000
    if (o !== 0) out.offsetY = o
  }
  return out
}

/** The casing to draw: the chosen one, else the look's own (upper-case or as written). */
export const resolveCasing = (casing: CaptionCasing | undefined, uppercase: boolean): CaptionCasing => casing ?? (uppercase ? 'upper' : 'original')
export const textTransformOf = (c: CaptionCasing): 'uppercase' | 'capitalize' | 'none' => (c === 'upper' ? 'uppercase' : c === 'title' ? 'capitalize' : 'none')
/** The .ass casing option for a casing. */
export const assCasingOf = (c: CaptionCasing): 'uppercase' | 'title' | 'original' => (c === 'upper' ? 'uppercase' : c === 'title' ? 'title' : 'original')

/** The CSS font weight: the chosen one, else the look's own (bold or medium). */
export const resolveWeight = (weight: CaptionWeight | undefined, bold: boolean): number => (weight ? CAPTION_WEIGHTS[weight] : bold ? 800 : 500)
/** The .ass has only a bold flag: bold from 700 up. */
export const assBoldOf = (weightValue: number): boolean => weightValue >= 700

/** The height of a caption from the bottom in percent, moved by an offset (positive = up), kept on the frame. */
export const offsetPositionPct = (basePct: number, offsetY: number | undefined): number => Math.min(99, Math.max(1, basePct + (offsetY ?? 0) * 100))

/** How opaque the chosen background colour is behind the caption (a little see-through, like Capite's backgrounds). */
export const CUSTOM_BACKGROUND_OPACITY = 0.75
