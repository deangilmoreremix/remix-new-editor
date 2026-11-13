/**
 * Overlay media-role contract.
 *
 * Every drawn element has ONE explicit role. The role (not the order in which
 * layers happen to be listed, and not the asset it carries) decides its box
 * shape, `object-fit`, clipping, safe-area handling, stacking and whether the
 * placement engine may move it. Pure data + helpers: no provider, registry or
 * React imports, so the template gallery, the composition, the editor and the
 * placement engine all consume the same table.
 *
 * Roles
 *  - background-video        the source footage itself
 *  - full-frame-replacement  covers the footage edge to edge (end card, full scenes, Ken Burns…)
 *  - picture-in-picture      a framed media window floating over the footage — ONLY
 *                            for designs that declare it (see PICTURE_IN_PICTURE_DESIGN_IDS)
 *  - product-image           the customer's product photo (a layout layer, never PiP)
 *  - service-image           the customer's service photo (a layout layer, never PiP)
 *  - logo                    the customer's logo, never stretched or cropped
 *  - text                    business name / headline / tagline / offer / CTA
 *  - caption                 dialogue captions
 *  - decorative              effects and ornaments (stars, particles, transitions, charts)
 */
import type { PreviewLayer, PreviewLayerKind } from './types'

export type OverlayMediaRole =
  | 'background-video'
  | 'full-frame-replacement'
  | 'picture-in-picture'
  | 'product-image'
  | 'service-image'
  | 'logo'
  | 'text'
  | 'caption'
  | 'decorative'

export interface MediaRoleContract {
  role: OverlayMediaRole
  label: string
  /** How media inside the box is fitted. `none` for text and effects. */
  objectFit: 'cover' | 'contain' | 'none'
  /** The media's own aspect ratio is never altered (no stretching). */
  preserveAspectRatio: boolean
  /** Shape of the layer's box. */
  boxShape: 'frame' | 'square' | 'text' | 'design'
  /** What clips the content: the whole frame, the layer box, or nothing. */
  clip: 'frame' | 'box' | 'none'
  /** Boxes of this role are kept inside the 2 % safe area. */
  clampToSafeArea: boolean
  /** Stacking order: a higher number is drawn above a lower one. */
  stackOrder: number
  /** The customer may drag the layer. */
  userMovable: boolean
  /** The customer may resize the layer. */
  userResizable: boolean
  /** The placement engine may reposition it (never when locked or hand-placed). */
  autoPlaceable: boolean
  /** The role is designed to cover footage, so covering the subject is not a defect. */
  mayCoverSubject: boolean
}

export const MEDIA_ROLE_CONTRACTS: Readonly<Record<OverlayMediaRole, MediaRoleContract>> = Object.freeze({
  'background-video': {
    role: 'background-video', label: 'Background video',
    objectFit: 'cover', preserveAspectRatio: true, boxShape: 'frame', clip: 'frame',
    clampToSafeArea: false, stackOrder: 0, userMovable: false, userResizable: false,
    autoPlaceable: false, mayCoverSubject: true,
  },
  decorative: {
    role: 'decorative', label: 'Effect / decoration',
    objectFit: 'none', preserveAspectRatio: true, boxShape: 'design', clip: 'frame',
    // Effects use the whole frame and may move through it on purpose.
    clampToSafeArea: false, stackOrder: 20, userMovable: false, userResizable: false,
    autoPlaceable: false, mayCoverSubject: true,
  },
  'full-frame-replacement': {
    role: 'full-frame-replacement', label: 'Full-frame scene',
    objectFit: 'cover', preserveAspectRatio: true, boxShape: 'frame', clip: 'frame',
    clampToSafeArea: false, stackOrder: 10, userMovable: false, userResizable: false,
    autoPlaceable: false, mayCoverSubject: true,
  },
  'picture-in-picture': {
    role: 'picture-in-picture', label: 'Picture-in-picture',
    objectFit: 'cover', preserveAspectRatio: true, boxShape: 'design', clip: 'box',
    clampToSafeArea: false, stackOrder: 30, userMovable: true, userResizable: true,
    autoPlaceable: false, mayCoverSubject: true,
  },
  'product-image': {
    role: 'product-image', label: 'Product image',
    objectFit: 'contain', preserveAspectRatio: true, boxShape: 'square', clip: 'box',
    clampToSafeArea: true, stackOrder: 40, userMovable: true, userResizable: true,
    autoPlaceable: true, mayCoverSubject: false,
  },
  'service-image': {
    role: 'service-image', label: 'Service image',
    objectFit: 'contain', preserveAspectRatio: true, boxShape: 'square', clip: 'box',
    clampToSafeArea: true, stackOrder: 40, userMovable: true, userResizable: true,
    autoPlaceable: true, mayCoverSubject: false,
  },
  logo: {
    role: 'logo', label: 'Logo',
    objectFit: 'contain', preserveAspectRatio: true, boxShape: 'square', clip: 'box',
    clampToSafeArea: true, stackOrder: 50, userMovable: true, userResizable: true,
    autoPlaceable: true, mayCoverSubject: false,
  },
  text: {
    role: 'text', label: 'Text',
    objectFit: 'none', preserveAspectRatio: true, boxShape: 'text', clip: 'none',
    clampToSafeArea: true, stackOrder: 60, userMovable: true, userResizable: true,
    autoPlaceable: true, mayCoverSubject: false,
  },
  caption: {
    role: 'caption', label: 'Caption',
    objectFit: 'none', preserveAspectRatio: true, boxShape: 'text', clip: 'none',
    clampToSafeArea: true, stackOrder: 65, userMovable: true, userResizable: true,
    autoPlaceable: true, mayCoverSubject: false,
  },
})

/**
 * Designs that are an intentional picture-in-picture / framed floating photo.
 * Membership is explicit: a role is never inferred from the asset a layer
 * carries or from how many media slots a design has.
 */
export const PICTURE_IN_PICTURE_DESIGN_IDS: ReadonlySet<string> = new Set([
  'rve-picture-in-picture',
  'rve-polaroid-frame',
])

/** Designs that replace the footage edge to edge with their own media/scene. */
export const FULL_FRAME_DESIGN_IDS: ReadonlySet<string> = new Set([
  'rve-ken-burns',
  'rve-image-zoom-reveal',
  'rve-gallery-grid',
  'rve-masonry-gallery',
  'rve-image-carousel',
  'rve-rotating-carousel',
  'rve-photo-stack',
  'rve-image-comparison-slider',
])

/** The minimal design facts the role resolver needs (no registry import). */
export interface DesignRoleFacts {
  id: string
  category?: string
}

const TEXT_KINDS: ReadonlySet<PreviewLayerKind> = new Set<PreviewLayerKind>([
  'businessName', 'headline', 'tagline', 'offer', 'cta',
])

/**
 * The role of a layer. Image layers keep their own role (a product photo is a
 * product image, never a picture-in-picture); only a design can be PiP, and
 * only when it is listed in PICTURE_IN_PICTURE_DESIGN_IDS.
 */
export function roleForLayer(
  layer: Pick<PreviewLayer, 'kind'> & { designId?: string },
  design?: DesignRoleFacts | null,
): OverlayMediaRole {
  const kind = layer.kind
  if (kind === 'logo') return 'logo'
  if (kind === 'productImage') return 'product-image'
  if (kind === 'serviceImage') return 'service-image'
  if (kind === 'endCard') return 'full-frame-replacement'
  if (TEXT_KINDS.has(kind)) return 'text'
  if (kind === 'design') return roleForDesign(design ?? (layer.designId ? { id: layer.designId } : null))
  return 'decorative'
}

export function roleForDesign(design: DesignRoleFacts | null | undefined): OverlayMediaRole {
  if (!design) return 'decorative'
  if (PICTURE_IN_PICTURE_DESIGN_IDS.has(design.id)) return 'picture-in-picture'
  if (FULL_FRAME_DESIGN_IDS.has(design.id)) return 'full-frame-replacement'
  switch (design.category) {
    case 'logo-reveal':
      return 'logo'
    case 'animated-headline':
    case 'lower-third':
    case 'promo-cta':
      return 'text'
    case 'full-scene':
      return 'full-frame-replacement'
    default:
      return 'decorative'
  }
}

export function contractFor(role: OverlayMediaRole): MediaRoleContract {
  return MEDIA_ROLE_CONTRACTS[role]
}

/**
 * CSS z-index for a layer: the role's stack order decides, the layer's list
 * position only orders layers of the same role.
 */
export function layerZIndex(role: OverlayMediaRole, indexInLayers: number): number {
  return MEDIA_ROLE_CONTRACTS[role].stackOrder * 100 + Math.min(99, Math.max(0, indexInLayers))
}
