/**
 * Snapping for dragging a layer on the video. Pure geometry in normalized frame coordinates (0..1),
 * so it is independent of the stage size and unit-tested.
 *
 * A moving box snaps when its left / center / right edge (or top / center / bottom) comes within
 * `threshold` of a target: the frame center, the thirds, the safe-area edges, or an edge or the center
 * of another visible layer. Each axis snaps on its own, to whichever alignment is nearest.
 */
import { layerBoxMetrics } from '../overlayGeometry'
import type { PreviewLayer } from '../../preview/types'

/** A box by its center and size, normalized to the frame. */
export interface SnapBox { cx: number; cy: number; w: number; h: number }

export interface SnapTargets { xs: number[]; ys: number[] }

export interface SnapResult {
  /** Normalized shift to apply to the dragged layer. */
  dx: number
  dy: number
  /** Normalized positions of the lines to draw (where it snapped). */
  guidesX: number[]
  guidesY: number[]
}

/** How close (fraction of the frame) an edge has to get before it snaps. */
export const SNAP_THRESHOLD = 0.008

/** Normalized box of a layer as drawn (the same geometry the render and the quality check use). */
export function layerSnapBox(layer: PreviewLayer, resolvedText: string | undefined, compW: number, compH: number): SnapBox {
  const m = layerBoxMetrics(layer, compW, compH, resolvedText)
  const w = m.widthPx / compW
  const h = m.heightPx / compH
  return { cx: m.leftPx / compW + w / 2, cy: m.topPx / compH + h / 2, w, h }
}

const uniqueSorted = (values: number[]) => [...new Set(values.map((v) => Math.round(v * 1e5) / 1e5))].sort((a, b) => a - b)

/** Targets for one drag: frame guides plus the edges and centers of the other layers. */
export function snapTargets(others: readonly SnapBox[], safeMargin: number): SnapTargets {
  const xs = [safeMargin, 1 / 3, 0.5, 2 / 3, 1 - safeMargin]
  const ys = [safeMargin, 1 / 3, 0.5, 2 / 3, 1 - safeMargin]
  for (const o of others) {
    xs.push(o.cx - o.w / 2, o.cx, o.cx + o.w / 2)
    ys.push(o.cy - o.h / 2, o.cy, o.cy + o.h / 2)
  }
  return { xs: uniqueSorted(xs), ys: uniqueSorted(ys) }
}

/** The smallest correction that lines one of `candidates` up with one of `targets`, within `threshold`. */
function snapAxis(candidates: number[], targets: number[], threshold: number): { delta: number; guide: number } | null {
  let best: { delta: number; guide: number } | null = null
  for (const c of candidates) {
    for (const t of targets) {
      const d = t - c
      if (Math.abs(d) <= threshold && (!best || Math.abs(d) < Math.abs(best.delta))) best = { delta: d, guide: t }
    }
  }
  return best
}

export function snapMove(box: SnapBox, targets: SnapTargets, threshold: number = SNAP_THRESHOLD): SnapResult {
  const x = snapAxis([box.cx - box.w / 2, box.cx, box.cx + box.w / 2], targets.xs, threshold)
  const y = snapAxis([box.cy - box.h / 2, box.cy, box.cy + box.h / 2], targets.ys, threshold)
  return { dx: x?.delta ?? 0, dy: y?.delta ?? 0, guidesX: x ? [x.guide] : [], guidesY: y ? [y.guide] : [] }
}
