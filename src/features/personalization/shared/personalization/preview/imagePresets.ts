/**
 * Image Overlay Styles: reusable presentation presets for business images.
 *
 * A preset defines shape, spacing, clipping, border, shadow, placement needs and an optional
 * animation, per aspect ratio. It RESOLVES to an `ImageStyle`, so every preset renders through the
 * same `StyledBusinessImage` / `PersonalizationComposition` path as the plain rounded look and is
 * identical in the gallery card, the editor, the preview and the exported MP4.
 *
 * Reuse, not duplication: picture-in-picture, Polaroid Drop, Photo Stack, Gallery Grid, Ken Burns
 * and Before & After already exist as full templates (`templates/designs/batch3h`). Where a preset
 * shares their look it lists `reusesDesign`, and the editor offers that template instead of a second
 * implementation; the layer-level presets here exist where a LAYER is needed (an image over the
 * customer's footage alongside their own text and logo).
 *
 * Defaults come from the image's explicit ROLE and the template's needs — never a filename or the
 * order images were discovered in.
 */
import type { PreviewAspectRatio } from './types'
import type { ImageHints, ImagePresetId, ImageRole, ImageStyle } from './imageStyle'
import { HEADSHOT_DEFAULT, ORIGINAL_STYLE, ROUNDED_RECT_DEFAULT, isStylableRole, type ResolvedImageStyle } from './imageStyle'
import type { OverlayMediaRole } from './mediaRoles'

export interface PresetPlacement {
  /** The preset must sit in a safe zone away from the subject. */
  needsSafeZone: boolean
  /** The preset intentionally covers part of the footage (so covering it is not a defect). */
  mayCoverSubject: boolean
  /** Fraction of the frame the preset occupies at most (crowding guard). */
  maxFrameFraction: number
  /** Needs several images (collage, split). */
  images: { min: number; max: number }
}

export interface ImagePreset {
  id: ImagePresetId
  label: string
  description: string
  /** Roles this preset suits (the selector marks others as "less suitable", never hides them). */
  roles: ImageRole[]
  placement: PresetPlacement
  /** An existing full template that already provides this look, if any. */
  reusesDesign?: { id: string; name: string }
  /** Style fields per aspect ratio, applied over the base style. */
  style: Record<PreviewAspectRatio, Partial<ImageStyle>>
}

const ALL = (s: Partial<ImageStyle>): Record<PreviewAspectRatio, Partial<ImageStyle>> => ({ '16:9': s, '9:16': s, '1:1': s, '4:5': s })

export const IMAGE_PRESETS: Readonly<Record<ImagePresetId, ImagePreset>> = Object.freeze({
  'rounded-floating-card': {
    id: 'rounded-floating-card', label: 'Rounded Floating Card',
    description: 'A rounded picture with a soft shadow — the clean everyday choice.',
    roles: ['product', 'service', 'property', 'portfolio', 'general', 'food', 'real-estate'],
    placement: { needsSafeZone: true, mayCoverSubject: false, maxFrameFraction: 0.22, images: { min: 1, max: 1 } },
    style: {
      // Corner radius is ~28 px at 1080p (radiusComp 0.028 of the shorter side) with a thin white border.
      '16:9': { shape: 'rounded-rect', radius: 0.12, fit: 'contain', shadow: 'subtle' },
      '9:16': { shape: 'rounded-rect', radius: 0.12, fit: 'contain', shadow: 'subtle' },
      '1:1': { shape: 'rounded-rect', radius: 0.12, fit: 'contain', shadow: 'subtle' },
      '4:5': { shape: 'rounded-rect', radius: 0.12, fit: 'contain', shadow: 'subtle' },
    },
  },
  'circular-portrait': {
    id: 'circular-portrait', label: 'Circular Portrait',
    description: 'A circle crop with a thin brand ring, for an identified portrait or headshot.',
    roles: ['portrait'],
    placement: { needsSafeZone: true, mayCoverSubject: false, maxFrameFraction: 0.16, images: { min: 1, max: 1 } },
    style: ALL({ shape: 'circle', fit: 'cover', cropX: 0.5, cropY: 0.35, borderWidth: 0.004, borderColor: 'brand-primary', shadow: 'subtle' }),
  },
  'product-spotlight': {
    id: 'product-spotlight', label: 'Product Spotlight',
    description: 'The whole product with a warm glow edge and a deeper shadow, so it reads as the hero. Add an optional promo badge such as “20% OFF”.',
    roles: ['product'],
    placement: { needsSafeZone: true, mayCoverSubject: false, maxFrameFraction: 0.26, images: { min: 1, max: 1 } },
    style: ALL({ shape: 'rounded-rect', radiusComp: 0.03, fit: 'contain', shadow: 'medium', spotlight: true, glow: '#ffa63d' }),
  },
  'cinematic-reveal': {
    id: 'cinematic-reveal', label: 'Cinematic Image Reveal',
    description: 'A wide rounded picture revealed by a diagonal wipe with a glowing light streak.',
    roles: ['property', 'portfolio', 'service', 'general', 'real-estate', 'food'],
    placement: { needsSafeZone: true, mayCoverSubject: false, maxFrameFraction: 0.3, images: { min: 1, max: 1 } },
    reusesDesign: undefined,
    style: ALL({ shape: 'rounded-rect', radius: 0.05, fit: 'contain', shadow: 'medium', reveal: 'diagonal' }),
  },
  'multi-image-collage': {
    id: 'multi-image-collage', label: 'Multi-Image Collage',
    description: 'Two stacked rounded tiles with thin white borders (up to four tiles).',
    roles: ['portfolio', 'property', 'product', 'general', 'food', 'real-estate'],
    placement: { needsSafeZone: true, mayCoverSubject: false, maxFrameFraction: 0.34, images: { min: 2, max: 4 } },
    reusesDesign: { id: 'rve-gallery-grid', name: 'Gallery Grid' },
    style: ALL({ shape: 'rounded-rect', radius: 0.08, fit: 'cover', shadow: 'subtle' }),
  },
  polaroid: {
    id: 'polaroid', label: 'Polaroid',
    description: 'A white photo frame with a clear tilt, a hand-drawn heart and sparkles.',
    roles: ['portfolio', 'general', 'property', 'service', 'food', 'real-estate'],
    placement: { needsSafeZone: true, mayCoverSubject: false, maxFrameFraction: 0.24, images: { min: 1, max: 1 } },
    reusesDesign: { id: 'rve-polaroid-frame', name: 'Polaroid Drop' },
    style: ALL({ shape: 'square', radius: 0, fit: 'cover', shadow: 'medium', frame: 'polaroid', tilt: -5, accent: 'heart' }),
  },
  'split-screen': {
    id: 'split-screen', label: 'Split Screen',
    description: 'The picture takes one half of the frame behind a diagonal divider with a white line; your video fills the rest.',
    roles: ['property', 'portfolio', 'service', 'product', 'general', 'food', 'real-estate'],
    placement: { needsSafeZone: false, mayCoverSubject: true, maxFrameFraction: 0.5, images: { min: 1, max: 1 } },
    reusesDesign: { id: 'rve-image-comparison-slider', name: 'Before & After' },
    style: ALL({ shape: 'square', radius: 0, fit: 'cover', shadow: 'medium' }), // side: automatic from verified zones, else right/bottom
  },
  'soft-masked': {
    id: 'soft-masked', label: 'Soft Masked Image',
    description: 'An organic blob shape with feathered edges and a soft warm glow — no hard rectangle.',
    roles: ['general', 'property', 'portfolio', 'service', 'food', 'real-estate'],
    placement: { needsSafeZone: true, mayCoverSubject: false, maxFrameFraction: 0.28, images: { min: 1, max: 1 } },
    style: ALL({ shape: 'blob', radius: 0.2, fit: 'cover', shadow: 'none', mask: 'soft', borderWidth: 0, glow: '#ffc98a' }),
  },
})

export const IMAGE_PRESET_ORDER: ImagePresetId[] = [
  'rounded-floating-card', 'circular-portrait', 'product-spotlight', 'cinematic-reveal',
  'multi-image-collage', 'polaroid', 'split-screen', 'soft-masked',
]

/** Discovery category / customer section → explicit image role. No filename, no discovery order. */
export function imageRoleFromCategory(category: string | null | undefined, section?: string | null): ImageRole {
  // The customer's explicit assignment wins.
  if (section === 'logo') return 'logo'
  if (section === 'person') return 'portrait'
  switch (category) {
    case 'person': return 'portrait'
    case 'logo': return 'logo'
    case 'product': return 'product'
    case 'service': return 'service'
    case 'completed_work': return 'portfolio'
    case 'storefront':
    case 'office': return 'property'
    default: return 'general' // team, branded_vehicle, brand, unknown
  }
}

/** The role of an image layer when the asset carries none: the layer kind says what it is for. */
export function imageRoleForLayerKind(kind: string): ImageRole {
  if (kind === 'logo') return 'logo'
  if (kind === 'serviceImage') return 'service'
  return 'product'
}

/** Default preset for a role in a given template/layout — never filename- or order-based. */
export function defaultPresetFor(role: ImageRole, layout?: string | null): ImagePresetId | null {
  switch (role) {
    case 'logo': return null
    case 'portrait': return 'circular-portrait'
    case 'product': return layout === 'product-showcase' ? 'product-spotlight' : 'rounded-floating-card'
    case 'service': return 'rounded-floating-card'
    case 'property': // storefront / office / listing: a wide rounded card
    case 'real-estate': return 'rounded-floating-card'
    case 'food': return 'rounded-floating-card' // rounded rectangle, subtle shadow
    case 'portfolio': return 'rounded-floating-card'
    default: return 'rounded-floating-card'
  }
}

/** The ImageStyle a preset produces at an aspect ratio. */
export function presetStyle(id: ImagePresetId, aspect: PreviewAspectRatio = '16:9', auto = true): ImageStyle {
  const preset = IMAGE_PRESETS[id]
  const base = id === 'circular-portrait' ? HEADSHOT_DEFAULT : id === 'polaroid' || id === 'split-screen' ? ORIGINAL_STYLE : ROUNDED_RECT_DEFAULT
  return { ...base, ...preset.style[aspect], presetId: id, auto }
}

/** Is this preset a good match for the image's role? (The selector marks, never blocks.) */
export function presetSuitsRole(id: ImagePresetId, role: ImageRole): boolean {
  return role !== 'logo' && IMAGE_PRESETS[id].roles.includes(role)
}

/** Which half a split-screen panel should take: the one overlapping the subject zones least (tie → right). */
export function splitSideFor(
  zones: { x: number; y: number; w: number; h: number }[],
  compW: number,
  compH: number,
): 'left' | 'right' | 'top' | 'bottom' {
  const portrait = compH > compW * 1.1
  const halves = portrait
    ? ({ top: { x: 0, y: 0, w: 1, h: 0.5 }, bottom: { x: 0, y: 0.5, w: 1, h: 0.5 } } as const)
    : ({ left: { x: 0, y: 0, w: 0.5, h: 1 }, right: { x: 0.5, y: 0, w: 0.5, h: 1 } } as const)
  const overlap = (a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }) => {
    const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)
    const h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y)
    return w > 0 && h > 0 ? w * h : 0
  }
  const score = (half: { x: number; y: number; w: number; h: number }) => zones.reduce((s, z) => s + overlap(half, z), 0)
  const entries = Object.entries(halves) as ['left' | 'right' | 'top' | 'bottom', { x: number; y: number; w: number; h: number }][]
  const best = entries.reduce((a, b) => (score(b[1]) < score(a[1]) - 1e-9 ? b : a))
  return best[0]
}

/** Layout of 2–4 tiles inside a square box: predictable spacing, no overlap. Fractions of the box. */
export function collageTiles(count: number, gap = 0.03): { x: number; y: number; w: number; h: number }[] {
  const n = Math.max(1, Math.min(4, Math.round(count)))
  const g = gap
  const half = (1 - g) / 2
  if (n === 1) return [{ x: 0, y: 0, w: 1, h: 1 }]
  if (n === 2) return [{ x: 0, y: 0, w: 1, h: half }, { x: 0, y: half + g, w: 1, h: half }] // two stacked tiles
  if (n === 3) return [{ x: 0, y: 0, w: half, h: 1 }, { x: half + g, y: 0, w: half, h: half }, { x: half + g, y: half + g, w: half, h: half }]
  return [
    { x: 0, y: 0, w: half, h: half }, { x: half + g, y: 0, w: half, h: half },
    { x: 0, y: half + g, w: half, h: half }, { x: half + g, y: half + g, w: half, h: half },
  ]
}

export interface ResolveLookInput {
  /** Overlay media role of the layer (product-image / service-image / logo…). */
  role: OverlayMediaRole
  /** The layer kind, used for the fallback image role when the asset carries none. */
  kind: string
  layerStyle?: ImageStyle
  /** The customer's explicit role for this picture (wins over the asset's discovery category). */
  layerRole?: ImageRole
  hints?: ImageHints
  /** A style the selected template declares (wins over defaults). */
  templateStyle?: Partial<ImageStyle>
  layout?: string | null
  aspect?: PreviewAspectRatio
}

/**
 * The look of an image layer — the ONE entry point used by the composition, the editor and the
 * placement input. Order: not stylable → none; customer style → theirs; logo → original;
 * already framed / transparent → original (no second frame); otherwise the preset chosen from the
 * image's explicit role + the template (a template-declared style overrides the preset's fields).
 */
export function resolveImageLook(input: ResolveLookInput): ResolvedImageStyle {
  const { role, kind, layerStyle, layerRole, hints = {}, templateStyle, layout, aspect = '16:9' } = input
  if (!isStylableRole(role)) return { style: null, reason: 'role keeps its own treatment' }
  if (layerStyle && layerStyle.auto !== true) return { style: layerStyle, reason: 'customer-edited' }
  if (role === 'logo' || (hints.role === 'logo' && !layerRole)) return { style: { ...ORIGINAL_STYLE }, reason: 'logo keeps its original proportions and transparency' }
  if (hints.transparentCorners || hints.alreadyFramed || hints.hasTransparency) {
    return { style: { ...ORIGINAL_STYLE }, reason: hints.alreadyFramed ? 'already framed' : 'transparent or already shaped' }
  }
  const imageRole: ImageRole = layerRole ?? hints.role ?? (hints.isHeadshot ? 'portrait' : imageRoleForLayerKind(kind))
  const id = defaultPresetFor(imageRole, layout)
  if (!id) return { style: { ...ORIGINAL_STYLE }, reason: 'no preset for this role' }
  let style = presetStyle(id, aspect)
  let reason = `${IMAGE_PRESETS[id].label} for a ${imageRole} image`
  if (templateStyle) { style = { ...style, ...templateStyle, auto: true }; reason = 'template style' }
  // A CONTAINED picture is framed around the picture itself: hold the automatic frame back until its size is known.
  if (style.fit === 'contain' && style.shape !== 'square' && !(hints.aspect && hints.aspect > 0)) {
    return { style: { ...ORIGINAL_STYLE }, reason: 'waiting for the image size' }
  }
  return { style, reason }
}

export type { ImageHints }
