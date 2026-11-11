/**
 * Shared types for the Personalization Modal's free Remotion preview.
 * Normalized coordinates (0..1 fractions of composition width/height) are used
 * so saved placements correspond to the actual video resolution.
 */

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
  kind: 'demo' | 'uploaded' | 'saved' | 'source' | 'motion-template'
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
  primary: '#29d3f2',
  accent: '#28c98b',
  text: '#ffffff',
  backgroundDim: 0.18,
}

export const PREVIEW_ASPECT_RATIOS: PreviewAspectRatio[] = ['16:9', '9:16', '1:1', '4:5']
