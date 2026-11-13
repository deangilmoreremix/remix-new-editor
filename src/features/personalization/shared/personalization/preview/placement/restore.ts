import { recommendPlacement } from './engine'
import type { PlacementInput, PlacementResult } from './types'

/**
 * "Restore Recommended Placement": every layer the engine may move goes back to
 * the template's intended position (hand placement discarded — this is an
 * explicit customer action) and is then run through the placement engine, so
 * the result is the template design adjusted only where the footage needs it.
 * Locked layers and layers whose role is not auto-placeable are never touched.
 */
export function recommendRestoredPlacement(input: PlacementInput): PlacementResult {
  return recommendPlacement({
    ...input,
    layers: input.layers.map((l) => {
      if (l.layer.locked) return l
      const { placementSource: _drop, ...rest } = l.layer
      void _drop
      return { ...l, layer: { ...rest, x: l.intended.x, y: l.intended.y, scale: l.intended.scale } }
    }),
  })
}
