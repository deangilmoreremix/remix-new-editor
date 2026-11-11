/**
 * Types for the shared Remotion design registry.
 *
 * A "design" is a self-contained, animated overlay component (an animated
 * headline, a logo reveal, a lower third, a promo CTA, a visual effect…) that
 * is registered once and can then be offered to the customer as a chip in
 * Simple Mode step 4.
 *
 * The registry is deliberately SEPARATE from the preview layout presets
 * (`preview/presets.ts`): layouts are hand-built compositions of the built-in
 * text/image layers, while designs are third-party components with their own
 * source attribution, their own media requirements and their own export
 * capability. A design is applied as a single `'design'` layer on top of the
 * current preview settings.
 */

import type { ComponentType } from 'react'
import type { PreviewAnimationId, PreviewAspectRatio } from '../preview/types'

/** Broad family a design belongs to; used to group the chips in the UI. */
export type RemotionDesignCategory =
  | 'animated-headline'
  | 'logo-reveal'
  | 'lower-third'
  | 'promo-cta'
  | 'visual-effect'
  | 'other'

/** Customer-facing brand field that feeds a design's text slot. */
export type RemotionDesignTextField =
  | 'businessName'
  | 'headline'
  | 'offer'
  | 'cta'
  | 'phone'
  | 'website'

/** Brand media a design can consume. */
export type RemotionDesignMediaRole = 'logo' | 'product' | 'service'

/** Brand colour role a design colour is fed from. */
export type RemotionDesignColorRole = 'primary' | 'accent' | 'text'

/**
 * Where the design came from. Every registered design must name its upstream
 * repository and licence so the attribution travels with the template.
 */
export interface RemotionDesignSource {
  /** Repository name, e.g. `remotion-dev/template-video`. */
  repository: string
  /** Absolute URL of the repository. */
  repositoryUrl: string
  /** Path of the template inside the repository. */
  sourcePath: string
  /** SPDX-ish licence identifier, e.g. `MIT`. */
  license: string
  /** Human-readable credit line shown in the UI and in the export metadata. */
  attribution: string
}

/** One editable text slot of a design. */
export interface RemotionDesignTextSlot {
  /** Stable key for the slot; the `textSlots` map is keyed by it. */
  key: string
  /** Brand field whose value feeds the slot. */
  field: RemotionDesignTextField
  /** Label shown to the customer in the editor. */
  label?: string
  /**
   * The primary slot is the one the customer edits directly on the layer
   * (`layer.text`). Exactly one slot should be primary.
   */
  primary?: boolean
  /**
   * OPTIONAL — Phase 2. Maximum number of characters the customer may type
   * into this slot. The inspector applies it to the field's `maxLength`.
   */
  maxLength?: number
}

/** Binds a brand colour role to a colour the design paints with. */
export interface RemotionDesignColorBinding {
  role: RemotionDesignColorRole
  /** Label shown to the customer. */
  label?: string
}

/** A piece of brand media the design can use. */
export interface RemotionDesignMediaBinding {
  role: RemotionDesignMediaRole
  /** Label shown to the customer. */
  label?: string
  /** Required media must exist for the design to make sense. */
  required?: boolean
}

/** The design's own animation timing (the layer entrance is separate). */
export interface RemotionDesignAnimation {
  /** How long the design's own animation runs, in frames. */
  durationInFrames: number
  /** Delay before the design's animation starts, in frames. */
  delayInFrames: number
  /** Human-readable easing/spring description, e.g. `spring(damping: 200)`. */
  easing: string
}

/** Default placement of the design layer in normalized center coordinates. */
export interface RemotionDesignPlacement {
  /** Center x as a 0..1 fraction of the composition width. */
  x: number
  /** Center y as a 0..1 fraction of the composition height. */
  y: number
  /** Size as a 0..1 fraction of the composition (both axes). */
  scale: number
  /** Default layer opacity, 0..1. */
  opacity: number
  /** Entrance animation applied to the layer itself. */
  animation?: PreviewAnimationId
}

/** Whether the design can be previewed and exported in the browser. */
export interface RemotionDesignCapabilities {
  /** Renders inside the in-browser preview player. */
  preview: boolean
  /** Can be baked into the final video by the in-browser Remotion web renderer. */
  browserExport: boolean
  /** Free-form note, e.g. why browser export is unavailable. */
  notes?: string
}

/** The brand colours handed to a design component. */
export interface RemotionDesignColors {
  primary: string
  accent: string
  text: string
  /** Dim scrim opacity (0..1) the composition applies behind overlays. */
  backgroundDim: number
}

/** Props every registered design component receives. */
export interface RemotionDesignComponentProps {
  /**
   * The primary text slot. `layer.text` overrides it when the customer typed
   * something; otherwise it is the resolved brand value.
   */
  text: string
  /** Every text slot of the design, keyed by `RemotionDesignTextSlot.key`. */
  textSlots: Record<string, string>
  /** The customer's brand colours. */
  colors: RemotionDesignColors
  /** Resolved media URLs, keyed by `RemotionDesignMediaRole`. */
  media: Record<string, string | null>
  /** The pixel box the design renders into. */
  box: { leftPx: number; topPx: number; widthPx: number; heightPx: number }
  /** Composition width in px. */
  width: number
  /** Composition height in px. */
  height: number
  /** Current composition frame. */
  frame: number
  /** Composition fps. */
  fps: number
  /** The layer's own opacity (0..1). */
  opacity: number
  /** The layer's colour override, or the brand text colour. */
  color: string
  /** Optional font family stack chosen by the customer. */
  fontFamily?: string
}

/** The overlay component a design renders. */
export type RemotionDesignComponent = ComponentType<RemotionDesignComponentProps>

/** A registered Remotion design. */
export interface RemotionDesignTemplate {
  /** Unique, stable id (used in the persisted settings). */
  id: string
  /** Customer-facing name shown on the chip. */
  name: string
  /** One-line description shown under the chip row. */
  description: string
  /** Broad family of the design. */
  category: RemotionDesignCategory
  /** Upstream attribution. */
  source: RemotionDesignSource
  /** The overlay component that renders the design. */
  component: RemotionDesignComponent
  /** Default props applied to the component before the resolved props. */
  defaultProps?: Partial<RemotionDesignComponentProps> & Record<string, unknown>
  /** The design's editable text slots. */
  textSlots?: RemotionDesignTextSlot[]
  /** Which brand colour feeds which design colour. */
  colors?: RemotionDesignColorBinding[]
  /** The brand media the design can use. */
  media?: RemotionDesignMediaBinding[]
  /** The design's own animation timing. */
  animation?: RemotionDesignAnimation
  /** Default placement of the design layer. */
  placement?: RemotionDesignPlacement
  /** Aspect ratios the design supports (defaults to all of them). */
  aspectRatios?: PreviewAspectRatio[]
  /** Media roles that must be present for the design to render properly. */
  requiredMedia?: RemotionDesignMediaRole[]
  /** Preview/export capability. */
  capabilities: RemotionDesignCapabilities
  /**
   * Whether the design can be previewed at all.
   *
   * Defaults to true; set it to false (with a reason) for a design that can
   * be exported but not previewed in the customer-facing player.
   */
  previewCompatible?: boolean
  /** Why the design is not preview compatible, when it is not. */
  previewCompatibleReason?: string
}

/** Result of a support check. */
export interface RemotionDesignSupportCheck {
  supported: boolean
  /** Why the design is not supported for the requested context. */
  reason?: string
}

/** Snapshot of the registry contents. */
export interface RemotionDesignTemplateRegistry {
  templates: RemotionDesignTemplate[]
}
