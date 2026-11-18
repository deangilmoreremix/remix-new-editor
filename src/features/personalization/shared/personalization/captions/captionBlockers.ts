/**
 * The areas of the frame that the layers cover, for keeping captions clear of them: each visible layer that is on screen while a caption is,
 * as a fraction of the frame. Uses the same box estimate as the editor (`layerBoxMetrics`). Pure; identical in remix-new-editor and OpenHiggsBolt.
 */
import { layerBoxMetrics } from '../guided/overlayGeometry'
import { resolveLayerText } from '../preview/layerContent'
import type { PreviewInputProps, PreviewLayer } from '../preview/types'
import type { Rect } from './captionClearance'

/** A stretch of frames in which a caption is on screen. */
export interface FrameWindow { startFrame: number; endFrame: number }

export function layerBlockers(layers: readonly PreviewLayer[], brand: PreviewInputProps['brand'], compW: number, compH: number, windows: readonly FrameWindow[] = []): Rect[] {
  if (!(compW > 0) || !(compH > 0)) return []
  const out: Rect[] = []
  for (const layer of layers) {
    if (!layer.visible || layer.kind === 'design' || layer.kind === 'endCard' || !(layer.opacity > 0)) continue
    // Only when the layer and a caption are on screen at the same time.
    const last = layer.endFrame ?? Number.POSITIVE_INFINITY
    if (windows.length && !windows.some((w) => layer.startFrame <= w.endFrame && w.startFrame <= last)) continue
    const m = layerBoxMetrics(layer, compW, compH, resolveLayerText(layer, brand))
    if (!(m.widthPx > 0) || !(m.heightPx > 0)) continue
    out.push({ left: m.leftPx / compW, top: m.topPx / compH, right: (m.leftPx + m.widthPx) / compW, bottom: (m.topPx + m.heightPx) / compH })
  }
  return out
}
