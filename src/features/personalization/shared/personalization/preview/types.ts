/**
 * Shared types for the Personalization Modal's free Remotion preview.
 * Normalized coordinates (0..1 fractions of composition width/height) are used
 * so saved placements correspond to the actual video resolution.
 */

import type { ImageHints, ImageRole, ImageStyle } from './imageStyle'

export type PreviewLayoutId =
  | 'business-introduction'
  | 'product-showcase'
  | 'service-promotion'
  | 'special-offer'
  | 'branded-ending'

export type PreviewLayerKind =
  | 'logo' | 'businessName' | 'headline' | 'offer' | 'cta'
  | 'productImage' | 'serviceImage' | 'tagline' | 'endCard'
  /** A registered Remotion design rendered by its own component. */
  | 'design'

export type PreviewAnimationId =
  | 'none' | 'fade' | 'slide-up' | 'slide-down' | 'slide-left'
  | 'pop' | 'logo-reveal' | 'lower-third' | 'cta-pulse'

export type PreviewPositionId =
  | 'top-left' | 'top-center' | 'top-right' | 'center'
  | 'lower-third' | 'bottom-left' | 'bottom-center' | 'bottom-right'

export type PreviewAspectRatio = '16:9' | '9:16' | '1:1' | '4:5'

export interface PreviewLayer {
  /** Stable id: the layer kind, optionally suffixed (e.g. 'headline-2'). */
  id: string
  kind: PreviewLayerKind
  visible: boolean
  /** Left edge of the layer box as a 0..1 fraction of composition width. */
  x: number
  /** Top edge of the layer box as a 0..1 fraction of composition height. */
  y: number
  /** Multiplier on the kind's default size (1 = default at composition height). */
  scale: number
  animation: PreviewAnimationId
  /** Animation delay in frames. */
  animationDelay: number
  /** First frame the layer is visible at (0 = from start). */
  startFrame: number
  /** Last frame the layer is visible at; undefined = composition end. */
  endFrame?: number
  /** 0..1 layer opacity. */
  opacity: number
  /** Text content for text-bearing layers. */
  text?: string
  /** Accent/text color (hex). Falls back to brandColors.text. */
  color?: string
  /** Optional font family stack for text layers. */
  fontFamily?: string
  /** Anchor image URL for image layers (resolved by the caller). */
  imageUrl?: string
  /**
   * Id of the registered Remotion design this layer renders.
   *
   * Only set on `design` layers. Optional so projects saved before the design
   * registry existed still restore.
   */
  designId?: string
  /**
   * Per-slot text overrides for a `design` layer, keyed by
   * `RemotionDesignTextSlot.key`.
   *
   * The PRIMARY slot is NOT stored here: it keeps using `layer.text`.
   * Only the secondary slots appear in this map, so a design that declares
   * no primary slot stores every slot here.
   *
   * Absent => the slot falls back to its brand field.
   */
  textSlotOverrides?: Record<string, string>
  /**
   * The customer locked this layer: placement and reflow never move it, and
   * the editor will not drag it until it is unlocked.
   */
  locked?: boolean
  /**
   * How an image layer is drawn (shape, corner radius, border, shadow, fit, crop,
   * exit). Absent or `auto` = the system chooses from the role and what is known
   * about the image; a customer edit makes it theirs. Overlay-only: the original
   * file is never modified.
   */
  imageStyle?: ImageStyle
  /** Extra pictures for the multi-image presets (collage), customer-picked from the library (≤ 4 with the main one). */
  imageUrls?: string[]
  /** The customer's explicit role for this picture (food, real estate, portrait…); wins over the discovery category. */
  imageRole?: ImageRole
  /**
   * Who decided the layer's current position: `manual` = the customer (drag,
   * resize or a position preset) — the placement engine never moves it on its
   * own; `recommended` = the placement engine. Absent = the template default.
   */
  placementSource?: 'manual' | 'recommended'
  /**
   * Clockwise rotation in degrees about the layer box centre, -180..180.
   * Absent = 0. Rendered by the shared composition, so preview and export match.
   */
  rotation?: number
  /**
   * Layers that share a `groupId` move together in the editor. Purely an
   * editing relationship: every member still renders as its own layer.
   */
  groupId?: string
}

/**
 * Reposition/zoom of the source footage (e.g. the presenter) inside the frame.
 * `x`/`y` are the focal point as 0..1 fractions (0.5 = centred); `zoom` >= 1
 * scales the footage about that point. Absent = the footage fills the frame.
 */
export interface SourceTransform {
  x: number
  y: number
  zoom: number
}

/** A rectangle in normalized frame coordinates; (x, y) is the TOP-LEFT corner. */
export interface NormRect {
  x: number
  y: number
  w: number
  h: number
}

/** A region overlays must not cover (the footage's subject, a baked-in graphic…). */
export interface ProtectedZone extends NormRect {
  id: string
  label: string
  /** `template` = declared by the template/source, `user` = marked by the customer. */
  source: 'template' | 'user'
}

export interface PreviewBrandColors {
  primary: string
  accent: string
  text: string
  /** Dim overlay opacity 0..1 behind overlays for legibility. */
  backgroundDim: number
}

export interface PreviewVideoRef {
  url: string
  poster: string | null
  title: string
  kind: 'demo' | 'uploaded' | 'saved' | 'source' | 'motion-template' | 'recast'
  demoId?: string
  /** For `kind: 'motion-template'`: the canonical component name of the selected
   *  Motion Studio shot, used to resolve the recipe in `/studio/motion-studio`
   *  (e.g. "CrashImpactReal"). */
  templateId?: string
  /** For `kind: 'motion-template'`: the card slug (e.g. "crash-zoom-punch")
   *  distinguishing a multi-style card from its sibling style. */
  templateSlug?: string
  /** For `kind: 'motion-template'`: source repository tag — always
   *  `"motion-studio"` for catalog-derived templates; the studio handoff uses
   *  this to locate the matching recipe. */
  sourceRepo?: string
  /** For `kind: 'recast'`: the video shown before the recast, so "Use
   *  original video" goes back to this project's own footage. Saved and
   *  restored with the preview, so it never comes from another project. */
  beforeRecast?: PreviewVideoRef | null
  /** Sound played under this video when it has none of its own: a Full Body
   *  Recast comes back silent, so "Keep the original video's sound" plays
   *  the performance clip's sound with it. A chosen audio track wins. */
  audioUrl?: string | null
}

/** Optional customer audio track applied to the personalized preview. */
export interface PreviewAudioSelection {
  url: string
  name: string
}

export interface PersonalizationPreviewSettings {
  layout: PreviewLayoutId
  layers: PreviewLayer[]
  brandColors: PreviewBrandColors
  aspectRatio: PreviewAspectRatio
  fps: number
  durationInFrames: number
  showEndCard: boolean
  /** Composition width in px. */
  width: number
  /** Composition height in px. */
  height: number
  /** Customer-selected audio track, or null when none is chosen. */
  audio: PreviewAudioSelection | null
  /**
   * Id of the Remotion design currently applied to the preview, or null.
   *
   * Optional so projects saved before the design registry existed still
   * restore; the normalizer falls back to `null`.
   */
  remotionDesignId?: string | null
  /**
   * Regions of the footage the overlays must not cover. Optional so projects
   * saved before placement checks existed still restore.
   */
  protectedZones?: ProtectedZone[]
  /**
   * What is known about each assigned image, keyed by URL (measured aspect ratio,
   * transparent corners, an existing frame). Lets every surface — gallery card,
   * editor, preview and export — style the same image the same way.
   */
  imageHints?: Record<string, ImageHints>
  /** Reposition/zoom of the source footage (presenter). Absent = fills the frame. */
  sourceTransform?: SourceTransform
  /**
   * User-defined personalization fields. Text layers may reference them as
   * `{{key}}`; any other `{{token}}` is left untouched.
   */
  customFields?: Record<string, string>
}

/** Everything the composition needs to render one frame-accurate scene. */
export interface PreviewInputProps {
  /** Background source media (video URL, or image URL for image sources). */
  videoUrl: string | null
  posterUrl: string | null
  isImageSource: boolean
  settings: PersonalizationPreviewSettings
  brand: {
    businessName: string
    headline: string
    offer: string
    cta: string
    phone: string
    website: string
    logoUrl: string | null
    productUrl: string | null
    serviceUrl: string | null
  }
  /** Durable audio track to mix into the composition, or null. */
  audioUrl: string | null
}

export const DEFAULT_PREVIEW_FPS = 30

export const DEFAULT_PREVIEW_BRAND_COLORS: PreviewBrandColors = {
  primary: '#d9ff00',
  accent: '#22c55e',
  text: '#ffffff',
  backgroundDim: 0.18,
}

export const PREVIEW_ASPECT_RATIOS: PreviewAspectRatio[] = ['16:9', '9:16', '1:1', '4:5']
