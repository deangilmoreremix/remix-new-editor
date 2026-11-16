/**
 * What a layer actually draws: its own text/image, or the brand value it falls
 * back to. Pure (no React, no Remotion) so the composition, the editor-facing
 * checks and the placement engine all resolve content identically.
 */
import type { PreviewInputProps, PreviewLayer } from './types'

/** The layer's own text, or null when it has none (unset or cleared). */
export function ownText(layer: PreviewLayer): string | null {
  return typeof layer.text === 'string' && layer.text.trim() ? layer.text : null
}

export function resolveLayerText(layer: PreviewLayer, brand: PreviewInputProps['brand']): string {
  switch (layer.kind) {
    // Cleared text falls back like unset text, matching the editor.
    case 'businessName':
      return ownText(layer) ?? brand.businessName
    case 'headline':
      return ownText(layer) ?? brand.headline
    case 'tagline':
      return ownText(layer) ?? brand.headline
    case 'offer':
      return ownText(layer) ?? brand.offer
    case 'cta':
      return ownText(layer) ?? brand.cta
    default:
      return ownText(layer) ?? ''
  }
}

export function resolveLayerImageUrl(
  layer: PreviewLayer,
  brand: PreviewInputProps['brand'],
): string {
  if (layer.imageUrl) return layer.imageUrl
  if (layer.kind === 'serviceImage') return brand.serviceUrl ?? brand.productUrl ?? ''
  if (layer.kind === 'productImage') return brand.productUrl ?? brand.serviceUrl ?? ''
  if (layer.kind === 'logo') return brand.logoUrl ?? ''
  return ''
}

