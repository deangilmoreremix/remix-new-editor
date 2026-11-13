/**
 * Footage effects (Stage 5): colour look, camera motion and fades for the source footage (the full-frame video or the
 * presenter's picture). Pure functions of the stored settings and the frame number: no React, no Remotion, no clock.
 *
 * Only effects that Remotion's web renderer is PROVEN to draw are used (measured in a real export, see
 * scripts/stage5-effects-check): CSS filter functions, `mix-blend-mode: multiply`, radial gradients and transforms.
 * SVG `filter: url(#id)` is NOT drawn by the web renderer (nor is a zero-blur spread / inset box-shadow), so nothing here relies on them.
 *
 * `predictLookRgb` implements the same colour maths as the browser's filter functions, so a test can compare a real
 * exported pixel with the number this module predicts.
 */

export interface FootageLook {
  enabled: boolean
  /** 1 = unchanged. */
  brightness: number
  contrast: number
  saturation: number
  /** Degrees. */
  hue: number
  /** -1 (cool) .. 1 (warm). */
  temperature: number
  grayscale: number
  sepia: number
  /** Blur strength per 1000 px of frame width (resolution independent). */
  blur: number
  /** 0..1 edge darkening. */
  vignette: number
}

export type MotionEase = 'linear' | 'ease-in-out'

export interface FootageMotion {
  enabled: boolean
  /** Zoom from/to (1 = no zoom). */
  zoom: { from: number; to: number }
  /** Drift as a fraction of the frame size, positive = the picture moves right / down. */
  pan: { x: { from: number; to: number }; y: { from: number; to: number } }
  ease: MotionEase
}

export interface FootageFade {
  inFrames: number
  outFrames: number
}

export interface FootageEffects {
  look?: FootageLook
  motion?: FootageMotion
  fade?: FootageFade
}

const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n))
const round = (n: number, d = 3) => Math.round(n * 10 ** d) / 10 ** d
const num = (v: unknown, fallback: number, lo: number, hi: number, d = 3) => round(clamp(finite(v) ? v : fallback, lo, hi), d)

export const IDENTITY_LOOK: FootageLook = { enabled: true, brightness: 1, contrast: 1, saturation: 1, hue: 0, temperature: 0, grayscale: 0, sepia: 0, blur: 0, vignette: 0 }
export const DEFAULT_MOTION: FootageMotion = { enabled: true, zoom: { from: 1, to: 1.15 }, pan: { x: { from: 0, to: 0 }, y: { from: 0, to: 0 } }, ease: 'ease-in-out' }

export const MAX_ZOOM = 3
export const MAX_PAN = 0.3

export function normalizeLook(raw: unknown): FootageLook | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined
  const r = raw as Record<string, unknown>
  return {
    enabled: r.enabled !== false,
    brightness: num(r.brightness, 1, 0.3, 2),
    contrast: num(r.contrast, 1, 0.3, 2),
    saturation: num(r.saturation, 1, 0, 3),
    hue: num(r.hue, 0, -180, 180, 1),
    temperature: num(r.temperature, 0, -1, 1),
    grayscale: num(r.grayscale, 0, 0, 1),
    sepia: num(r.sepia, 0, 0, 1),
    blur: num(r.blur, 0, 0, 30, 1),
    vignette: num(r.vignette, 0, 0, 1),
  }
}

export function normalizeMotion(raw: unknown): FootageMotion | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined
  const r = raw as Record<string, any>
  const p = (a: any, lo: number, hi: number) => ({ from: num(a?.from, 0, lo, hi), to: num(a?.to, 0, lo, hi) })
  return {
    enabled: r.enabled !== false,
    zoom: { from: num(r.zoom?.from, 1, 1, MAX_ZOOM), to: num(r.zoom?.to, 1, 1, MAX_ZOOM) },
    pan: { x: p(r.pan?.x, -MAX_PAN, MAX_PAN), y: p(r.pan?.y, -MAX_PAN, MAX_PAN) },
    ease: r.ease === 'linear' ? 'linear' : 'ease-in-out',
  }
}

export function normalizeFade(raw: unknown): FootageFade | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined
  const r = raw as Record<string, unknown>
  const f = { inFrames: Math.round(num(r.inFrames, 0, 0, 900, 0)), outFrames: Math.round(num(r.outFrames, 0, 0, 900, 0)) }
  return f.inFrames === 0 && f.outFrames === 0 ? undefined : f
}

export function normalizeFootageEffects(raw: unknown): FootageEffects | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined
  const r = raw as Record<string, unknown>
  const out: FootageEffects = {}
  const look = normalizeLook(r.look); if (look) out.look = look
  const motion = normalizeMotion(r.motion); if (motion) out.motion = motion
  const fade = normalizeFade(r.fade); if (fade) out.fade = fade
  return out.look || out.motion || out.fade ? out : undefined
}

// ── colour look ──────────────────────────────────────────────────────────────────────────────────────────────────

/** Whether a look changes any pixel. */
export function lookIsActive(look: FootageLook | undefined): look is FootageLook {
  if (!look || !look.enabled) return false
  return look.brightness !== 1 || look.contrast !== 1 || look.saturation !== 1 || look.hue !== 0 || look.temperature !== 0
    || look.grayscale !== 0 || look.sepia !== 0 || look.blur !== 0 || look.vignette !== 0
}

/** The CSS `filter` value, in the fixed order brightness → contrast → saturate → hue-rotate → sepia → grayscale → blur. */
export function lookFilterCss(look: FootageLook | undefined, compW: number): string | undefined {
  if (!lookIsActive(look)) return undefined
  const parts: string[] = []
  if (look.brightness !== 1) parts.push(`brightness(${look.brightness})`)
  if (look.contrast !== 1) parts.push(`contrast(${look.contrast})`)
  if (look.saturation !== 1) parts.push(`saturate(${look.saturation})`)
  if (look.hue !== 0) parts.push(`hue-rotate(${look.hue}deg)`)
  if (look.sepia !== 0) parts.push(`sepia(${look.sepia})`)
  if (look.grayscale !== 0) parts.push(`grayscale(${look.grayscale})`)
  if (look.blur !== 0) parts.push(`blur(${round((look.blur * compW) / 1000, 2)}px)`)
  return parts.length ? parts.join(' ') : undefined
}

/** Per-channel gains (<= 1) of the temperature overlay, applied with `mix-blend-mode: multiply`. */
export function temperatureGains(t: number): [number, number, number] {
  const w = clamp(t, 0, 1), c = clamp(-t, 0, 1)
  return [round(1 - 0.28 * c, 3), round(1 - 0.1 * w - 0.06 * c, 3), round(1 - 0.38 * w, 3)]
}

export function temperatureOverlayColor(t: number): string | undefined {
  if (!t) return undefined
  const [r, g, b] = temperatureGains(t)
  return `rgb(${Math.round(255 * r)}, ${Math.round(255 * g)}, ${Math.round(255 * b)})`
}

/** Radial darkening towards the edges; transparent in the middle. */
export function vignetteBackground(v: number): string | undefined {
  if (!(v > 0)) return undefined
  const strength = clamp(v, 0, 1)
  return `radial-gradient(ellipse at center, rgba(0,0,0,0) ${Math.round(62 - 22 * strength)}%, rgba(0,0,0,${round(0.9 * strength, 3)}) 100%)`
}

// The colour maths of the CSS filter functions (Filter Effects Module Level 1), on 0..255 RGB.
const clamp255 = (v: number) => clamp(v, 0, 255)
type Rgb = [number, number, number]
const mat = (c: Rgb, m: number[]): Rgb => [clamp255(m[0] * c[0] + m[1] * c[1] + m[2] * c[2]), clamp255(m[3] * c[0] + m[4] * c[1] + m[5] * c[2]), clamp255(m[6] * c[0] + m[7] * c[1] + m[8] * c[2])]
const saturateM = (s: number) => [0.213 + 0.787 * s, 0.715 - 0.715 * s, 0.072 - 0.072 * s, 0.213 - 0.213 * s, 0.715 + 0.285 * s, 0.072 - 0.072 * s, 0.213 - 0.213 * s, 0.715 - 0.715 * s, 0.072 + 0.928 * s]
const hueM = (deg: number) => { const a = (deg * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a); return [0.213 + c * 0.787 - s * 0.213, 0.715 - c * 0.715 - s * 0.715, 0.072 - c * 0.072 + s * 0.928, 0.213 - c * 0.213 + s * 0.143, 0.715 + c * 0.285 + s * 0.140, 0.072 - c * 0.072 - s * 0.283, 0.213 - c * 0.213 - s * 0.787, 0.715 - c * 0.715 + s * 0.715, 0.072 + c * 0.928 + s * 0.072] }
const sepiaM = (a: number) => [0.393 + 0.607 * (1 - a), 0.769 - 0.769 * (1 - a), 0.189 - 0.189 * (1 - a), 0.349 - 0.349 * (1 - a), 0.686 + 0.314 * (1 - a), 0.168 - 0.168 * (1 - a), 0.272 - 0.272 * (1 - a), 0.534 - 0.534 * (1 - a), 0.131 + 0.869 * (1 - a)]
const grayM = (a: number) => [0.2126 + 0.7874 * (1 - a), 0.7152 - 0.7152 * (1 - a), 0.0722 - 0.0722 * (1 - a), 0.2126 - 0.2126 * (1 - a), 0.7152 + 0.2848 * (1 - a), 0.0722 - 0.0722 * (1 - a), 0.2126 - 0.2126 * (1 - a), 0.7152 - 0.7152 * (1 - a), 0.0722 + 0.9278 * (1 - a)]

/**
 * The colour a pixel `rgb` ends up as under `look` (without blur). `edge` (0 = centre, 1 = the very corner) feeds the
 * vignette. Mirrors lookFilterCss + the temperature and vignette overlays, in the same order.
 */
export function predictLookRgb(rgb: Rgb, look: FootageLook, edge = 0): Rgb {
  let c: Rgb = [...rgb]
  if (look.brightness !== 1) c = [clamp255(c[0] * look.brightness), clamp255(c[1] * look.brightness), clamp255(c[2] * look.brightness)]
  if (look.contrast !== 1) c = c.map((v) => clamp255((v / 255 - 0.5) * look.contrast * 255 + 127.5)) as Rgb
  if (look.saturation !== 1) c = mat(c, saturateM(look.saturation))
  if (look.hue !== 0) c = mat(c, hueM(look.hue))
  if (look.sepia !== 0) c = mat(c, sepiaM(look.sepia))
  if (look.grayscale !== 0) c = mat(c, grayM(look.grayscale))
  if (look.temperature !== 0) { const g = temperatureGains(look.temperature); c = [c[0] * g[0], c[1] * g[1], c[2] * g[2]] }
  if (look.vignette > 0) {
    const s = clamp(look.vignette, 0, 1); const start = (62 - 22 * s) / 100; const t = clamp((edge - start) / (1 - start), 0, 1); const a = 0.9 * s * t
    c = [c[0] * (1 - a), c[1] * (1 - a), c[2] * (1 - a)]
  }
  return c
}

export interface LookPreset { id: string; label: string; look: Omit<FootageLook, 'enabled'> }
export const LOOK_PRESETS: readonly LookPreset[] = [
  { id: 'natural', label: 'Natural (no change)', look: { brightness: 1, contrast: 1, saturation: 1, hue: 0, temperature: 0, grayscale: 0, sepia: 0, blur: 0, vignette: 0 } },
  { id: 'warm', label: 'Warm and friendly', look: { brightness: 1.05, contrast: 1.05, saturation: 1.1, hue: 0, temperature: 0.45, grayscale: 0, sepia: 0, blur: 0, vignette: 0.15 } },
  { id: 'cool', label: 'Cool and clean', look: { brightness: 1.03, contrast: 1.08, saturation: 0.95, hue: 0, temperature: -0.5, grayscale: 0, sepia: 0, blur: 0, vignette: 0 } },
  { id: 'cinematic', label: 'Cinematic', look: { brightness: 0.95, contrast: 1.25, saturation: 0.9, hue: 0, temperature: 0.2, grayscale: 0, sepia: 0, blur: 0, vignette: 0.45 } },
  { id: 'vivid', label: 'Vivid', look: { brightness: 1.05, contrast: 1.15, saturation: 1.5, hue: 0, temperature: 0, grayscale: 0, sepia: 0, blur: 0, vignette: 0 } },
  { id: 'vintage', label: 'Vintage', look: { brightness: 1, contrast: 0.95, saturation: 0.85, hue: 0, temperature: 0.3, grayscale: 0, sepia: 0.45, blur: 0, vignette: 0.5 } },
  { id: 'mono', label: 'Black and white', look: { brightness: 1, contrast: 1.2, saturation: 1, hue: 0, temperature: 0, grayscale: 1, sepia: 0, blur: 0, vignette: 0.25 } },
]
export const lookPresetById = (id: string) => LOOK_PRESETS.find((p) => p.id === id)

// ── camera motion and fades ──────────────────────────────────────────────────────────────────────────────────────

const ease = (t: number, e: MotionEase) => { const x = clamp(t, 0, 1); return e === 'linear' ? x : x * x * (3 - 2 * x) }

export interface MotionState { scale: number; tx: number; ty: number }

/** Scale about the frame centre and a drift in px at `frame`, across the whole clip. */
export function motionAt(frame: number, motion: FootageMotion | undefined, totalFrames: number, compW: number, compH: number): MotionState {
  if (!motion || !motion.enabled) return { scale: 1, tx: 0, ty: 0 }
  const p = ease(totalFrames <= 1 ? 1 : frame / (totalFrames - 1), motion.ease)
  const lerp = (a: { from: number; to: number }) => a.from + (a.to - a.from) * p
  return { scale: lerp(motion.zoom), tx: lerp(motion.pan.x) * compW, ty: lerp(motion.pan.y) * compH }
}

export function motionIsActive(m: FootageMotion | undefined): m is FootageMotion {
  return Boolean(m && m.enabled && (m.zoom.from !== 1 || m.zoom.to !== 1 || m.pan.x.from !== 0 || m.pan.x.to !== 0 || m.pan.y.from !== 0 || m.pan.y.to !== 0))
}

/** Opacity of the black cover at `frame` (1 = fully black). Linear fade in over `inFrames`, fade out over the last `outFrames`. */
export function fadeCoverAt(frame: number, fade: FootageFade | undefined, totalFrames: number): number {
  if (!fade) return 0
  let a = 0
  if (fade.inFrames > 0) a = Math.max(a, 1 - clamp(frame / fade.inFrames, 0, 1))
  if (fade.outFrames > 0) a = Math.max(a, 1 - clamp((totalFrames - 1 - frame) / fade.outFrames, 0, 1))
  return a
}

export interface MotionPreset { id: string; label: string; motion: Omit<FootageMotion, 'enabled'> }
export const MOTION_PRESETS: readonly MotionPreset[] = [
  { id: 'push-in', label: 'Slow push-in', motion: { zoom: { from: 1, to: 1.15 }, pan: { x: { from: 0, to: 0 }, y: { from: 0, to: 0 } }, ease: 'ease-in-out' } },
  { id: 'pull-out', label: 'Slow pull-out', motion: { zoom: { from: 1.15, to: 1 }, pan: { x: { from: 0, to: 0 }, y: { from: 0, to: 0 } }, ease: 'ease-in-out' } },
  { id: 'drift-right', label: 'Drift right', motion: { zoom: { from: 1.12, to: 1.12 }, pan: { x: { from: -0.04, to: 0.04 }, y: { from: 0, to: 0 } }, ease: 'linear' } },
  { id: 'drift-left', label: 'Drift left', motion: { zoom: { from: 1.12, to: 1.12 }, pan: { x: { from: 0.04, to: -0.04 }, y: { from: 0, to: 0 } }, ease: 'linear' } },
  { id: 'punch-in', label: 'Punch in', motion: { zoom: { from: 1, to: 1.35 }, pan: { x: { from: 0, to: 0 }, y: { from: 0, to: 0 } }, ease: 'ease-in-out' } },
]
export const motionPresetById = (id: string) => MOTION_PRESETS.find((p) => p.id === id)
