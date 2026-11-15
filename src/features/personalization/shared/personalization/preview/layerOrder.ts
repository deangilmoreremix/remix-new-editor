/**
 * Layer stacking order. The order of `settings.layers` IS the stacking order of the video (a layer later
 * in the list is drawn above earlier ones, within its media role), so reordering the list restacks the video.
 * Pure helpers so the editor's drag-to-reorder and its bring-forward / send-back buttons are unit-tested.
 */
import type { PreviewLayer } from './types'

export type LayerMove = 'forward' | 'backward' | 'front' | 'back'

/** `layers` in the order given by `orderedIds`; unknown ids are ignored and layers not listed keep their relative order at the end. */
export function reorderLayers<T extends Pick<PreviewLayer, 'id'>>(layers: readonly T[], orderedIds: readonly string[]): T[] {
  const byId = new Map(layers.map((l) => [l.id, l]))
  const seen = new Set<string>()
  const out: T[] = []
  for (const id of orderedIds) {
    const l = byId.get(id)
    if (l && !seen.has(id)) { out.push(l); seen.add(id) }
  }
  for (const l of layers) if (!seen.has(l.id)) out.push(l)
  return out
}

/** Moves one layer up or down the stack. Moving past either end is a no-op (the same array order is returned). */
export function moveLayer<T extends Pick<PreviewLayer, 'id'>>(layers: readonly T[], id: string, move: LayerMove): T[] {
  const i = layers.findIndex((l) => l.id === id)
  if (i < 0) return [...layers]
  const target = move === 'front' ? layers.length - 1 : move === 'back' ? 0 : move === 'forward' ? Math.min(layers.length - 1, i + 1) : Math.max(0, i - 1)
  if (target === i) return [...layers]
  const next = [...layers]
  const [item] = next.splice(i, 1)
  next.splice(target, 0, item)
  return next
}

/** Whether `move` would change anything (for disabling buttons). */
export function canMoveLayer(layers: readonly Pick<PreviewLayer, 'id'>[], id: string, move: LayerMove): boolean {
  const i = layers.findIndex((l) => l.id === id)
  if (i < 0) return false
  return move === 'front' || move === 'forward' ? i < layers.length - 1 : i > 0
}
