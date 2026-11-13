/**
 * Automatic image styling for business images (products, services, portraits).
 *
 * Styling is an OVERLAY-LAYER concern: the discovered/uploaded file is never
 * modified. A layer carries an optional `imageStyle`; when it is absent or
 * `auto`, `resolveImageStyle` picks a professional default from the layer's
 * media role and what is known about the image. Pure data + helpers (no React,
 * no Remotion), shared by the composition, the editor and the tests, so every
 * surface computes identical geometry.
 *
 * Rules
 *  - product / service image  -> rounded rectangle, CONTAIN fit (the subject is
 *    never cropped to get rounded corners), subtle shadow
 *  - explicit headshot/portrait only -> circle, cover fit with a crop focus. A
 *    photo that merely contains a person is NOT circular.
 *  - logo -> original proportions and transparency: no clip, no fill, no shadow
 *  - already-framed / transparent-corner images -> no second frame
 *  - picture-in-picture, full-frame and design roles -> never styled here
 *  - a template may declare its own style, which wins over the defaults
 *  - once the customer edits a style it is theirs (`auto` is cleared) and is
 *    never replaced automatically
 */
import { clampImageZoom } from './layerTransform'
import type { OverlayMediaRole } from './mediaRoles'

/** The explicit purpose of an assigned business image (never inferred from a filename or discovery order). */
export type ImageRole = 'product' | 'service' | 'portrait' | 'property' | 'portfolio' | 'logo' | 'general' | 'food' | 'real-estate'

export const IMAGE_ROLES = ['product', 'service', 'portrait', 'property', 'portfolio', 'logo', 'general', 'food', 'real-estate'] as const

export type ImagePresetId =
  | 'rounded-floating-card'
  | 'circular-portrait'
  | 'product-spotlight'
  | 'cinematic-reveal'
  | 'multi-image-collage'
  | 'polaroid'
  | 'split-screen'
  | 'soft-masked'

export type ImageShape = 'rounded-rect' | 'circle' | 'pill' | 'square' | 'custom' | 'blob'
export type ImageShadow = 'none' | 'subtle' | 'medium'
export type ImageFit = 'contain' | 'cover'

export interface ImageStyle {
  shape: ImageShape
  /** Corner radius as a fraction of the frame's SHORTER side (0..0.5). rounded-rect only. */
  radius: number
  /**
   * Corner radius as a fraction of the COMPOSITION'S shorter side (0.028 ≈ 30 px at 1080 p). When set it wins
   * over `radius`, so card corners look the same size whatever the picture's size.
   */
  radiusComp?: number
  /** A warm rim glow around the frame (hex colour). */
  glow?: string
  /** A promo callout pill on the frame's corner, e.g. "20% OFF". */
  badge?: string
  /** A hand-drawn accent on a Polaroid. */
  accent?: 'none' | 'heart'
  /** Per-corner radii (tl, tr, br, bl) as fractions of the shorter side; `custom` only. */
  customRadii?: [number, number, number, number]
  fit: ImageFit
  /** Crop focus 0..1 (0.5 = centre); matters for `cover`. */
  cropX: number
  cropY: number
  /** Zoom 1..4 about the crop focus; applies only when the picture fills its shape (`cover`). Absent = 1. */
  zoom?: number
  /** Border width as a fraction of the COMPOSITION height (0 = none). */
  borderWidth: number
  /** `brand-primary`, `brand-accent`, or a hex colour. */
  borderColor: string
  shadow: ImageShadow
  /** Background fill behind a contained image (hex), or null for none. */
  fill: string | null
  /** How the image leaves when the layer has an end frame (entrances use the layer's own animation). */
  exit?: 'none' | 'fade' | 'shrink'
  /** The presentation preset this look came from (the customer can still override every field). */
  presetId?: ImagePresetId
  /** Soft radial glow behind the image (Product Spotlight). */
  spotlight?: boolean
  /** A physical frame drawn around the picture. */
  frame?: 'none' | 'polaroid'
  /** Feathered edges instead of a hard clip (Soft Masked Image). */
  mask?: 'none' | 'soft'
  /** Entrance: a wipe + slow scale instead of the layer's own animation (Cinematic Image Reveal). */
  reveal?: 'none' | 'wipe' | 'diagonal'
  /** Tilt in degrees (Polaroid). */
  tilt?: number
  /** Which half of the frame a split-screen panel takes. */
  splitSide?: 'left' | 'right' | 'top' | 'bottom'
  /** The split side was chosen by the system from verified subject zones (re-chosen when they change). */
  splitSideAuto?: boolean
  /** Chosen by the system; cleared by any customer edit. */
  auto?: boolean
}

export const EXIT_FRAMES = 10

export const REVEAL_FRAMES = 24

/**
 * Cinematic reveal: a left-to-right wipe with a slow settle from 106 % to 100 % scale, driven
 * purely by the frame number so the preview and the exported MP4 are identical.
 * `progress` 0 → hidden, 1 → fully shown.
 */
export function revealFactors(style: Pick<ImageStyle, 'reveal'>, frame: number, startFrame: number): { progress: number; scale: number } {
  if (style.reveal !== 'wipe' && style.reveal !== 'diagonal') return { progress: 1, scale: 1 }
  const t = clamp((frame - startFrame) / REVEAL_FRAMES, 0, 1)
  const eased = 1 - Math.pow(1 - t, 3)
  return { progress: eased, scale: 1.06 - 0.06 * eased }
}

/** Opacity and scale multipliers for the exit animation at `frame` (1/1 when not exiting). */
export function exitFactors(style: Pick<ImageStyle, 'exit'>, frame: number, endFrame: number | undefined): { opacity: number; scale: number } {
  if (!style.exit || style.exit === 'none' || endFrame === undefined) return { opacity: 1, scale: 1 }
  const p = clamp((frame - (endFrame - EXIT_FRAMES)) / EXIT_FRAMES, 0, 1)
  return style.exit === 'fade' ? { opacity: 1 - p, scale: 1 } : { opacity: 1 - p, scale: 1 - 0.15 * p }
}

/** What is known about an image (measured in the browser or carried by its asset). */
export interface ImageHints {
  /** Natural width / height. */
  aspect?: number
  /** Four transparent corners (cut-out PNG, already-rounded asset). */
  transparentCorners?: boolean
  /** A decorative frame/border is already part of the picture. */
  alreadyFramed?: boolean
  /** Has any transparency (asset flag). */
  hasTransparency?: boolean
  /** The asset was explicitly identified as a portrait/headshot. */
  isHeadshot?: boolean
  /** The explicit role of this image (from the customer's assignment or the discovery category). */
  role?: ImageRole
}

export const ROUNDED_RECT_DEFAULT: ImageStyle = Object.freeze({
  shape: 'rounded-rect', radius: 0.12, radiusComp: 0.028, fit: 'contain', cropX: 0.5, cropY: 0.5,
  borderWidth: 0.003, borderColor: '#ffffff', shadow: 'subtle', fill: null, auto: true,
}) as ImageStyle

export const HEADSHOT_DEFAULT: ImageStyle = Object.freeze({
  shape: 'circle', radius: 0.5, fit: 'cover', cropX: 0.5, cropY: 0.35,
  borderWidth: 0.004, borderColor: '#ffffff', shadow: 'subtle', fill: null, auto: true,
}) as ImageStyle

/** The unstyled look: original proportions, no clip, no frame, no shadow. */
export const ORIGINAL_STYLE: ImageStyle = Object.freeze({
  shape: 'square', radius: 0, fit: 'contain', cropX: 0.5, cropY: 0.5,
  borderWidth: 0, borderColor: 'brand-primary', shadow: 'none', fill: null, auto: true,
}) as ImageStyle

const SHAPES: ImageShape[] = ['rounded-rect', 'circle', 'pill', 'square', 'custom']
const SHADOWS: ImageShadow[] = ['none', 'subtle', 'medium']
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
const num = (v: unknown, fallback: number) => (typeof v === 'number' && Number.isFinite(v) ? v : fallback)

/** Roles whose images are styled by this module. Everything else keeps its own treatment. */
export function isStylableRole(role: OverlayMediaRole): boolean {
  return role === 'product-image' || role === 'service-image' || role === 'logo'
}

/** Validates/clamps a stored or customer-edited style. Unknown input falls back to `base`. */
export function normalizeImageStyle(raw: unknown, base: ImageStyle = ROUNDED_RECT_DEFAULT): ImageStyle | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const r = raw as Record<string, unknown>
  const style: ImageStyle = {
    shape: SHAPES.includes(r.shape as ImageShape) ? (r.shape as ImageShape) : base.shape,
    radius: clamp(num(r.radius, base.radius), 0, 0.5),
    radiusComp: r.radiusComp === undefined ? undefined : clamp(num(r.radiusComp, base.radiusComp ?? 0), 0, 0.08),
    fit: r.fit === 'cover' ? 'cover' : r.fit === 'contain' ? 'contain' : base.fit,
    cropX: clamp(num(r.cropX, base.cropX), 0, 1),
    cropY: clamp(num(r.cropY, base.cropY), 0, 1),
    borderWidth: clamp(num(r.borderWidth, base.borderWidth), 0, 0.03),
    borderColor: typeof r.borderColor === 'string' && r.borderColor.trim() ? r.borderColor.trim() : base.borderColor,
    shadow: SHADOWS.includes(r.shadow as ImageShadow) ? (r.shadow as ImageShadow) : base.shadow,
    fill: typeof r.fill === 'string' && /^#[0-9a-f]{3,8}$/i.test(r.fill.trim()) ? r.fill.trim() : null,
  }
  if (style.radiusComp === undefined) delete style.radiusComp
  const zoom = clampImageZoom(r.zoom)
  if (zoom > 1) style.zoom = zoom
  if (Array.isArray(r.customRadii) && r.customRadii.length === 4) {
    style.customRadii = r.customRadii.map((v) => clamp(num(v, 0), 0, 0.5)) as [number, number, number, number]
  }
  const PRESETS: ImagePresetId[] = ['rounded-floating-card', 'circular-portrait', 'product-spotlight', 'cinematic-reveal', 'multi-image-collage', 'polaroid', 'split-screen', 'soft-masked']
  if (PRESETS.includes(r.presetId as ImagePresetId)) style.presetId = r.presetId as ImagePresetId
  if (r.spotlight === true) style.spotlight = true
  if (r.frame === 'polaroid') style.frame = 'polaroid'
  if (r.mask === 'soft') style.mask = 'soft'
  if (r.reveal === 'wipe' || r.reveal === 'diagonal') style.reveal = r.reveal
  if (typeof r.tilt === 'number' && Number.isFinite(r.tilt)) style.tilt = clamp(r.tilt, -15, 15)
  if (r.splitSide === 'left' || r.splitSide === 'right' || r.splitSide === 'top' || r.splitSide === 'bottom') style.splitSide = r.splitSide
  if (typeof r.glow === 'string' && /^#[0-9a-f]{3,8}$/i.test(r.glow.trim())) style.glow = r.glow.trim()
  if (typeof r.badge === 'string' && r.badge.trim()) style.badge = r.badge.trim().slice(0, 24)
  if (r.accent === 'heart') style.accent = 'heart'
  if (r.splitSideAuto === true) style.splitSideAuto = true
  if (r.exit === 'fade' || r.exit === 'shrink' || r.exit === 'none') style.exit = r.exit
  if (r.auto === true) style.auto = true
  return style
}

export interface ResolveInput {
  role: OverlayMediaRole
  /** The layer's stored style, if any. */
  layerStyle?: ImageStyle
  hints?: ImageHints
  /** A style the selected template declares for this role (wins over defaults). */
  templateStyle?: Partial<ImageStyle>
}

export interface ResolvedImageStyle {
  /** null = this image is not styled here (PiP, full-frame, design…). */
  style: ImageStyle | null
  /** Why this look was chosen (for the editor and the tests). */
  reason: string
}

export function resolveImageStyle(input: ResolveInput): ResolvedImageStyle {
  const { role, layerStyle, hints = {}, templateStyle } = input
  if (!isStylableRole(role)) return { style: null, reason: 'role keeps its own treatment' }

  // The customer's own edit always wins and is never replaced automatically.
  if (layerStyle && layerStyle.auto !== true) return { style: layerStyle, reason: 'customer-edited' }

  if (role === 'logo') return { style: { ...ORIGINAL_STYLE }, reason: 'logo keeps its original proportions and transparency' }

  // A template's own declaration wins over the generic defaults.
  if (templateStyle) {
    const base = hints.isHeadshot ? HEADSHOT_DEFAULT : ROUNDED_RECT_DEFAULT
    const styled = { ...base, ...templateStyle, auto: true }
    return withKnownSize(styled, hints, 'template style')
  }

  // Already shaped / framed: never put a second frame on it.
  if (hints.transparentCorners || hints.alreadyFramed || hints.hasTransparency) {
    return { style: { ...ORIGINAL_STYLE }, reason: hints.alreadyFramed ? 'already framed' : 'transparent or already shaped' }
  }

  if (hints.isHeadshot) return withKnownSize({ ...HEADSHOT_DEFAULT }, hints, 'explicit headshot/portrait')
  return withKnownSize({ ...ROUNDED_RECT_DEFAULT }, hints, 'product/service default')
}

/**
 * A CONTAINED picture is framed around the picture itself, which needs its size.
 * Until the size is known the automatic frame is held back (the image shows
 * unstyled) rather than framing an empty square with a shadow.
 */
function withKnownSize(style: ImageStyle, hints: ImageHints, reason: string): ResolvedImageStyle {
  if (style.fit === 'contain' && style.shape !== 'square' && !(hints.aspect && hints.aspect > 0)) {
    return { style: { ...ORIGINAL_STYLE }, reason: 'waiting for the image size' }
  }
  return { style, reason }
}

export interface FramePx { left: number; top: number; width: number; height: number }

/**
 * The visible frame inside a layer box of `boxW`×`boxH`.
 *  - contain: the fitted image rectangle (so rounded corners hug the picture,
 *    nothing is cropped); the whole box when the aspect is unknown
 *  - cover: the whole box, except `circle`, which is the centred square
 */
export function frameRect(style: ImageStyle, boxW: number, boxH: number, aspect?: number): FramePx {
  if (style.shape === 'circle') {
    const side = Math.min(boxW, boxH)
    return { left: (boxW - side) / 2, top: (boxH - side) / 2, width: side, height: side }
  }
  if (style.fit === 'contain' && aspect && Number.isFinite(aspect) && aspect > 0) {
    const boxAspect = boxW / boxH
    if (aspect >= boxAspect) {
      const h = boxW / aspect
      return { left: 0, top: (boxH - h) / 2, width: boxW, height: h }
    }
    const w = boxH * aspect
    return { left: (boxW - w) / 2, top: 0, width: w, height: boxH }
  }
  return { left: 0, top: 0, width: boxW, height: boxH }
}

/** CSS border-radius for a frame; radii scale with the frame (itself scaled by the composition). */
export function borderRadiusCss(
  style: ImageStyle,
  frame: Pick<FramePx, 'width' | 'height'>,
  /** The composition's SHORTER side in composition px, and the surface scale factor (for `radiusComp`). */
  comp?: { short: number; factor?: number },
): string {
  const short = Math.min(frame.width, frame.height)
  switch (style.shape) {
    case 'circle': return '50%'
    case 'pill': return `${short / 2}px`
    case 'square': return '0'
    case 'blob': return '58% 42% 61% 39% / 47% 55% 45% 53%'
    case 'custom': {
      const r = style.customRadii ?? [style.radius, style.radius, style.radius, style.radius]
      return r.map((f) => `${Math.round(f * short * 100) / 100}px`).join(' ')
    }
    default: {
      if (style.radiusComp !== undefined && comp) {
        const px = Math.min(style.radiusComp * comp.short * (comp.factor ?? 1), short / 2)
        return `${Math.round(px * 100) / 100}px`
      }
      return `${Math.round(clamp(style.radius, 0, 0.5) * short * 100) / 100}px`
    }
  }
}

/** Border thickness in px for a composition of height `compH` (times the surface's scale factor). */
export function borderPx(style: ImageStyle, compH: number, factor = 1): number {
  return Math.round(style.borderWidth * compH * factor * 100) / 100
}

export function resolveBorderColor(ref: string, brand: { primary: string; accent: string }): string {
  if (ref === 'brand-primary') return brand.primary
  if (ref === 'brand-accent') return brand.accent
  return ref
}

const SHADOWS_SPEC: Record<Exclude<ImageShadow, 'none'>, { y: number; blur: number; alpha: number }> = {
  subtle: { y: 0.006, blur: 0.018, alpha: 0.28 },
  medium: { y: 0.012, blur: 0.036, alpha: 0.38 },
}

/** CSS box-shadow for the OUTER wrapper (never on the clipped element): the drop shadow plus an optional warm rim glow. */
export function shadowCss(style: ImageStyle, compH: number, factor = 1): string | undefined {
  const px = (f: number) => Math.round(f * compH * factor * 100) / 100
  const parts: string[] = []
  if (style.shadow !== 'none') {
    const s = SHADOWS_SPEC[style.shadow]
    parts.push(`0 ${px(s.y)}px ${px(s.blur)}px rgba(0,0,0,${s.alpha})`)
  }
  if (style.glow) parts.push(`0 0 ${px(0.04)}px ${px(0.008)}px ${hexToRgba(style.glow, 0.8)}`)
  return parts.length ? parts.join(', ') : undefined
}

export function hexToRgba(hex: string, alpha: number): string {
  let h = hex.replace('#', '')
  if (h.length === 3) h = h.split('').map((c) => c + c).join('')
  const n = parseInt(h.slice(0, 6), 16)
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`
}

/** Extra space around the frame the shadow occupies, in px (for collision margins). */
export function shadowBleedPx(style: ImageStyle, compH: number): number {
  const drop = style.shadow === 'none' ? 0 : Math.ceil((SHADOWS_SPEC[style.shadow].y + SHADOWS_SPEC[style.shadow].blur) * compH)
  const glow = style.glow ? Math.ceil(0.05 * compH) : 0
  return Math.max(drop, glow)
}

/** CSS object-position from the crop focus. */
export function objectPosition(style: ImageStyle): string {
  return `${Math.round(style.cropX * 100)}% ${Math.round(style.cropY * 100)}%`
}

/**
 * Crop focus + zoom for the <img>. Zoom is applied only when the picture fills
 * its shape (`cover`, or `forceCover` for tiles/split panels that always do),
 * because only then does the shape's clip hide the overflow.
 */
export function imageMediaStyle(
  style: ImageStyle,
  forceCover = false,
): { objectPosition: string; transform?: string; transformOrigin?: string } {
  const pos = objectPosition(style)
  const zoom = clampImageZoom(style.zoom)
  if (zoom <= 1 || (!forceCover && style.fit !== 'cover')) return { objectPosition: pos }
  return { objectPosition: pos, transform: `scale(${zoom})`, transformOrigin: pos }
}
