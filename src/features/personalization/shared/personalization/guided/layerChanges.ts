/**
 * Customer-facing names for preview layers, and the pure helpers the Step 4
 * editor uses to explain what a Quick Adjustment (layout or design click)
 * changed on the video.
 */

import { getRemotionDesignTemplate } from '../templates'
import type { RemotionDesignCategory } from '../templates/types'
import type { PersonalizationPreviewSettings, PreviewLayer, PreviewLayerKind } from '../preview/types'
import { DESIGN_SLOT_LAYER_IDS } from '../preview/types'

export const LAYER_LABELS: Record<PreviewLayerKind, string> = {
  logo: 'Logo',
  businessName: 'Business name',
  headline: 'Headline',
  offer: 'Offer',
  cta: 'Call to action',
  productImage: 'Product image',
  serviceImage: 'Service image',
  tagline: 'Tagline',
  endCard: 'End card',
  design: 'Design',
}

/** Chip-row group names for the design catalog, in display order. */
export const DESIGN_CATEGORY_LABELS: Record<RemotionDesignCategory, string> = {
  'animated-headline': 'Headlines',
  'logo-reveal': 'Logo reveals',
  'lower-third': 'Lower thirds',
  'promo-cta': 'Calls to action',
  'visual-effect': 'Effects',
  transition: 'Transitions',
  'data-visualization': 'Charts and data',
  'full-scene': 'Full scenes',
  other: 'More',
}

/** Short label for a layer: scenes are named by where they play. */
export function layerLabel(layer: Pick<PreviewLayer, 'id' | 'kind'>): string {
  if (layer.kind === 'design' && layer.id === DESIGN_SLOT_LAYER_IDS.intro) return 'Opening scene'
  if (layer.kind === 'design' && layer.id === DESIGN_SLOT_LAYER_IDS.outro) return 'Closing scene'
  return LAYER_LABELS[layer.kind] ?? layer.kind
}

/** The name a layer is shown under: designs use the design's own name. */
export function layerDisplayName(layer: PreviewLayer): string {
  if (layer.kind === 'design' && layer.designId) {
    const design = getRemotionDesignTemplate(layer.designId)
    if (design) return `${layerLabel(layer)}: ${design.name}`
  }
  return layerLabel(layer)
}

export interface LayerChanges {
  added: PreviewLayer[]
  removed: PreviewLayer[]
  /** Layers present before and after (their edits are kept). */
  kept: PreviewLayer[]
}

/** Which layers a settings change added, removed or kept, matched by id. */
export function diffLayers(prev: PreviewLayer[], next: PreviewLayer[]): LayerChanges {
  // A design layer always has the id 'design'; swapping one design for another
  // is reported as a removal plus an addition, so key designs by their id too.
  const keyOf = (layer: PreviewLayer) => (layer.kind === 'design' ? `${layer.id}:${layer.designId ?? ''}` : layer.id)
  const prevKeys = new Set(prev.map(keyOf))
  const nextKeys = new Set(next.map(keyOf))
  return {
    added: next.filter((layer) => !prevKeys.has(keyOf(layer))),
    removed: prev.filter((layer) => !nextKeys.has(keyOf(layer))),
    kept: next.filter((layer) => prevKeys.has(keyOf(layer))),
  }
}

/** One-line summary of a change, or null when nothing was added or removed. */
export function describeLayerChanges(changes: LayerChanges): string | null {
  const parts: string[] = []
  if (changes.added.length > 0) parts.push(`Added: ${changes.added.map(layerDisplayName).join(', ')}`)
  if (changes.removed.length > 0) parts.push(`Removed: ${changes.removed.map(layerDisplayName).join(', ')}`)
  if (parts.length === 0) return null
  if (changes.kept.length > 0) parts.push('your other edits were kept')
  return parts.join(' · ')
}

/** True when the layout or applied design differs between two settings. */
export function lookChanged(prev: PersonalizationPreviewSettings, next: PersonalizationPreviewSettings): boolean {
  return (
    prev.layout !== next.layout ||
    (prev.remotionDesignId ?? null) !== (next.remotionDesignId ?? null) ||
    (prev.remotionSceneIds?.intro ?? null) !== (next.remotionSceneIds?.intro ?? null) ||
    (prev.remotionSceneIds?.outro ?? null) !== (next.remotionSceneIds?.outro ?? null)
  )
}

/** Extra note when a change switched the branded end card on or off. */
export function endCardChangeNote(prev: PersonalizationPreviewSettings, next: PersonalizationPreviewSettings): string | null {
  if (prev.showEndCard && !next.showEndCard) return 'the branded end card was turned off (the closing scene plays after your video instead)'
  if (!prev.showEndCard && next.showEndCard) return 'the branded end card is back on'
  return null
}

/** First frame a layer is fully on screen: its start, delay and entrance. */
export function layerRevealFrame(layer: PreviewLayer, fps: number): number {
  const entrance = Math.round((fps > 0 ? fps : 30) / 2)
  return Math.max(0, Math.round(layer.startFrame + layer.animationDelay + entrance))
}

/** Frames → seconds rounded to tenths, for the customer-facing timing fields. */
export function framesToSeconds(frames: number, fps: number): number {
  const safeFps = fps > 0 ? fps : 30
  return Math.round((Math.max(0, frames) / safeFps) * 10) / 10
}

/** Seconds → whole frames (never negative). */
export function secondsToFrames(seconds: number, fps: number): number {
  const safeFps = fps > 0 ? fps : 30
  const value = Number.isFinite(seconds) ? seconds : 0
  return Math.max(0, Math.round(value * safeFps))
}
