/**
 * Text-layer effects and motion (Stage 5): shadow, glow and outline for text, an EXIT animation, and the three new entrance
 * animations. Pure, and limited to what Remotion's web renderer is measured to draw: `text-shadow`, `-webkit-text-stroke`,
 * opacity, transform and CSS `blur()` (SVG `url(#id)` filters and zero-blur spread box-shadows are NOT drawn by the web renderer, so neither is used).
 */

/** The layer kinds drawn as text (the only ones text effects apply to). */
export const TEXT_LAYER_KINDS = ['businessName', 'headline', 'offer', 'cta', 'tagline'] as const

export interface LayerEffect {
  /** 0..1 soft dark shadow for legibility over busy footage. */
  shadow: number
  glow: { color: string; strength: number } | null
  outline: { color: string; width: number } | null
}

export type LayerExitId = 'none' | 'fade' | 'slide-up' | 'slide-down' | 'zoom-out'
export interface LayerExit { animation: LayerExitId; frames: number }

const EXITS: readonly LayerExitId[] = ['none', 'fade', 'slide-up', 'slide-down', 'zoom-out']
const HEX = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/
const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n))
const round = (n: number, d = 3) => Math.round(n * 10 ** d) / 10 ** d

export const MAX_OUTLINE = 0.08

export function normalizeLayerEffect(raw: unknown): LayerEffect | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined
  const r = raw as Record<string, any>
  const shadow = round(clamp(finite(r.shadow) ? r.shadow : 0, 0, 1))
  const glow = r.glow && typeof r.glow === 'object' && HEX.test(String(r.glow.color)) && finite(r.glow.strength) && r.glow.strength > 0
    ? { color: String(r.glow.color), strength: round(clamp(r.glow.strength, 0, 1)) } : null
  const outline = r.outline && typeof r.outline === 'object' && HEX.test(String(r.outline.color)) && finite(r.outline.width) && r.outline.width > 0
    ? { color: String(r.outline.color), width: round(clamp(r.outline.width, 0, MAX_OUTLINE)) } : null
  return shadow === 0 && !glow && !outline ? undefined : { shadow, glow, outline }
}

export function normalizeLayerExit(raw: unknown): LayerExit | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined
  const r = raw as Record<string, any>
  if (!EXITS.includes(r.animation) || r.animation === 'none') return undefined
  return { animation: r.animation, frames: Math.round(clamp(finite(r.frames) ? r.frames : 15, 2, 120)) }
}

/** Style for a text layer's effect. `fontPx` makes the sizes follow the text size, so every frame size looks the same. */
export function textEffectStyle(effect: LayerEffect | undefined, fontPx: number): { textShadow?: string; WebkitTextStroke?: string } {
  if (!effect) return {}
  const shadows: string[] = []
  if (effect.glow) {
    const blur = round(fontPx * (0.12 + 0.28 * effect.glow.strength), 2)
    shadows.push(`0 0 ${blur}px ${effect.glow.color}`, `0 0 ${round(blur * 2, 2)}px ${effect.glow.color}`)
  }
  if (effect.shadow > 0) {
    shadows.push(`0 ${round(fontPx * 0.05, 2)}px ${round(fontPx * 0.16, 2)}px rgba(0,0,0,${round(0.35 + 0.55 * effect.shadow, 2)})`)
  }
  const out: { textShadow?: string; WebkitTextStroke?: string } = {}
  if (shadows.length) out.textShadow = shadows.join(', ')
  if (effect.outline) out.WebkitTextStroke = `${round(fontPx * effect.outline.width, 2)}px ${effect.outline.color}`
  return out
}

export interface MotionFactors { opacity: number; scale: number; translateX: number; translateY: number }
export const NO_EXIT: MotionFactors = { opacity: 1, scale: 1, translateX: 0, translateY: 0 }

/**
 * The exit at `frame`: during the last `exit.frames` frames before `endFrame` (the layer is gone from `endFrame` on).
 * A layer with no end frame never exits (it stays to the end of the video).
 */
export function exitFactorsAt(exit: LayerExit | undefined, frame: number, endFrame: number | undefined): MotionFactors {
  if (!exit || exit.animation === 'none' || endFrame === undefined) return NO_EXIT
  const start = endFrame - exit.frames
  if (frame <= start) return NO_EXIT
  const t = clamp((frame - start) / exit.frames, 0, 1)
  const e = t * t * (3 - 2 * t)
  switch (exit.animation) {
    case 'fade': return { ...NO_EXIT, opacity: 1 - e }
    case 'slide-up': return { opacity: 1 - e, scale: 1, translateX: 0, translateY: -e * 40 }
    case 'slide-down': return { opacity: 1 - e, scale: 1, translateX: 0, translateY: e * 40 }
    case 'zoom-out': return { opacity: 1 - e, scale: 1 - 0.25 * e, translateX: 0, translateY: 0 }
  }
}

/** Entrance animations added in Stage 5 (the original nine live in the composition). */
export const NEW_ENTRANCES = ['blur-in', 'zoom-in', 'bounce'] as const
export type NewEntranceId = (typeof NEW_ENTRANCES)[number]

export interface EntranceExtras { blurPx: number }

/** Pure entrance maths for the new animations from the eased (0..1) progress and a spring progress (0..~1.2). */
export function newEntranceFactors(id: NewEntranceId, eased: number, spring: number): MotionFactors & EntranceExtras {
  switch (id) {
    case 'blur-in': return { opacity: eased, scale: 1, translateX: 0, translateY: 0, blurPx: (1 - eased) * 14 }
    case 'zoom-in': return { opacity: eased, scale: 1 + 0.4 * (1 - eased), translateX: 0, translateY: 0, blurPx: 0 }
    case 'bounce': return { opacity: Math.min(1, eased * 2), scale: 1, translateX: 0, translateY: (spring - 1) * 90, blurPx: 0 }
  }
}
