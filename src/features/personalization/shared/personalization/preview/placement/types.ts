/**
 * Scene-aware placement: shared types.
 *
 * Nothing here detects faces or objects. The engine reasons over three kinds of
 * facts it is GIVEN: protected zones (template-declared or customer-marked
 * regions), luminance samples (measured from real frames in the browser), and
 * the layers' own boxes. Anything it cannot know it reports as "unverified".
 */
import type { OverlayMediaRole } from '../mediaRoles'
import type { NormRect, PreviewLayer, ProtectedZone } from '../types'

export type { NormRect, ProtectedZone }

/** A grid of measured luminance (0..1, sRGB luma) for one frame of the footage. */
export interface LumaSample {
  /** Time in seconds. */
  t: number
  cols: number
  rows: number
  /** Row-major, `cols * rows` values. */
  luma: number[]
}

export interface PxRect {
  left: number
  top: number
  width: number
  height: number
}

/** One layer as the engine sees it. */
export interface PlacementLayer {
  layer: PreviewLayer
  role: OverlayMediaRole
  /** The text actually drawn (brand fallback resolved). Empty for images. */
  text: string
  /** Where the layout's template puts this layer by default (design intent). */
  intended: { x: number; y: number; scale: number }
  /** Resolved image URL for image layers ('' / undefined = none resolved). */
  imageUrl?: string
  /** Natural width/height of the image, when measured. Lets checks use the VISIBLE area of a contained image. */
  imageAspect?: number
  /** Extra space the styled image's shadow occupies around its frame, in composition px. */
  bleedPx?: number
  /** The image presentation preset in effect (collage, split screen, polaroid…). */
  presetId?: string
  /** For a split-screen panel: the side it takes. */
  splitSide?: 'left' | 'right' | 'top' | 'bottom'
  /** For design layers: false when the design is not registered / not supported here. */
  designSupported?: boolean
}

export interface PlacementInput {
  width: number
  height: number
  fps: number
  durationInFrames: number
  layers: PlacementLayer[]
  zones: ProtectedZone[]
  samples: LumaSample[]
  /** Default text color (hex) used when a layer has none. */
  textColor: string
  /** First frame of the branded end card, or null when there is none. Overlays are judged only before it. */
  endCardStartFrame?: number | null
  /** Facts about the selected source video, when known. */
  source?: {
    rights: 'verified-owned' | 'licensed' | 'third-party-reference' | 'unverified'
    rightsNote: string
    bakedStatus: 'known' | 'unknown'
  }
}

export interface PlacementProposal {
  layerId: string
  x: number
  y: number
  scale: number
  /** Penalty of the chosen candidate (lower is better). */
  penalty: number
  /** Whether it differs from the layer's current position. */
  moved: boolean
  reasons: string[]
}

export interface PlacementResult {
  proposals: PlacementProposal[]
  /** Layers the engine did not touch, with the reason (locked, hand-placed, role, no valid spot). */
  skipped: { layerId: string; reason: 'locked' | 'manual' | 'not-auto-placeable' | 'no-valid-candidate' | 'hidden' }[]
  /** What the engine could and could not verify. */
  analysis: {
    protectedZones: number
    frameSamples: number
    subjectVerified: boolean
    contrastVerified: boolean
  }
}

export type QualityStatus = 'ready' | 'needs-adjustment' | 'review-required'
export type QualitySeverity = 'critical' | 'adjust' | 'review'

export type QualityIssueCode =
  | 'missing-media'
  | 'unsupported-design'
  | 'off-frame'
  | 'overlay-collision'
  | 'text-over-subject'
  | 'media-over-subject'
  | 'low-contrast'
  | 'text-overflow'
  | 'duplicate-text'
  | 'subject-unknown'
  | 'contrast-unverified'
  | 'split-covers-footage'
  | 'overlay-crowded'
  | 'baked-in-unknown'
  | 'rights-unverified'

export interface QualityIssue {
  code: QualityIssueCode
  severity: QualitySeverity
  layerId?: string
  /** Seconds the problem is visible (start/end). */
  tStart?: number
  tEnd?: number
  message: string
  /** True when an automatic recommendation could fix it. */
  fixable: boolean
}

export interface QualityReport {
  status: QualityStatus
  issues: QualityIssue[]
  /** Only confirmed critical rendering failures block export. */
  blocksExport: boolean
  /** Honest scope notes (never errors). */
  notes: string[]
  analysis: PlacementResult['analysis']
}
