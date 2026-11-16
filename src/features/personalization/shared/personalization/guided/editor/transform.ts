/**
 * Resize and rotate math for the editor's handles. Pure geometry in composition pixels (y down, angles clockwise in
 * degrees like CSS `rotate()`), so it is unit-tested apart from the DOM.
 *
 * A layer has a single size value, so every resize handle keeps the aspect ratio: corners scale along the diagonal, edge
 * handles along their axis. In both cases the opposite corner (or opposite edge midpoint) stays where it is.
 */
import { normalizeAngle } from '../../preview/rotation'

export type HandleId = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w'

export interface HandleDef {
  id: HandleId
  /** Direction from the box center to the handle, in the box's own (unrotated) axes: -1, 0 or 1. */
  hx: -1 | 0 | 1
  hy: -1 | 0 | 1
  /** Position on the box edge, in percent. */
  left: number
  top: number
  kind: 'corner' | 'edge'
  label: string
}

export const HANDLES: readonly HandleDef[] = [
  { id: 'nw', hx: -1, hy: -1, left: 0, top: 0, kind: 'corner', label: 'top left' },
  { id: 'n', hx: 0, hy: -1, left: 50, top: 0, kind: 'edge', label: 'top' },
  { id: 'ne', hx: 1, hy: -1, left: 100, top: 0, kind: 'corner', label: 'top right' },
  { id: 'e', hx: 1, hy: 0, left: 100, top: 50, kind: 'edge', label: 'right' },
  { id: 'se', hx: 1, hy: 1, left: 100, top: 100, kind: 'corner', label: 'bottom right' },
  { id: 's', hx: 0, hy: 1, left: 50, top: 100, kind: 'edge', label: 'bottom' },
  { id: 'sw', hx: -1, hy: 1, left: 0, top: 100, kind: 'corner', label: 'bottom left' },
  { id: 'w', hx: -1, hy: 0, left: 0, top: 50, kind: 'edge', label: 'left' },
]

export const handleById = (id: HandleId): HandleDef => HANDLES.find((h) => h.id === id)!

export interface Pt { x: number; y: number }

/** A layer's drawn box: its center, size and rotation. */
export interface TransformBox { cx: number; cy: number; w: number; h: number; rotation: number }

const toRad = (deg: number) => (deg * Math.PI) / 180
const toDeg = (rad: number) => (rad * 180) / Math.PI

/** Rotates a vector by `deg` clockwise (y down). */
export function rotateVec(v: Pt, deg: number): Pt {
  const r = toRad(deg)
  const c = Math.cos(r)
  const s = Math.sin(r)
  return { x: v.x * c - v.y * s, y: v.x * s + v.y * c }
}

/** A handle's position in the frame (where it is drawn once the box is rotated). */
export function handlePoint(box: TransformBox, handle: HandleId): Pt {
  const d = handleById(handle)
  const o = rotateVec({ x: (d.hx * box.w) / 2, y: (d.hy * box.h) / 2 }, box.rotation)
  return { x: box.cx + o.x, y: box.cy + o.y }
}

/** The point that must not move while `handle` is dragged: the opposite corner, or the opposite edge's midpoint. */
export function anchorPoint(box: TransformBox, handle: HandleId): Pt {
  const d = handleById(handle)
  const o = rotateVec({ x: (-d.hx * box.w) / 2, y: (-d.hy * box.h) / 2 }, box.rotation)
  return { x: box.cx + o.x, y: box.cy + o.y }
}

export interface ResizeResult {
  /** Multiply the layer's size by this. */
  factor: number
  /** Where the box center ends up so that the anchor stays put. */
  cx: number
  cy: number
}

/**
 * Resizing by dragging `handle` to `pointer`. The pointer is projected onto the line from the anchor through the
 * handle (in the box's own axes), which gives the uniform scale factor; the factor is limited to
 * [minFactor, maxFactor] (the caller derives these from the layer's scale limits).
 */
export function resizeFromHandle(
  box: TransformBox,
  handle: HandleId,
  pointer: Pt,
  limits: { minFactor?: number; maxFactor?: number } = {},
): ResizeResult {
  const d = handleById(handle)
  const anchor = anchorPoint(box, handle)
  // pointer relative to the anchor, in the box's own axes
  const v = rotateVec({ x: pointer.x - anchor.x, y: pointer.y - anchor.y }, -box.rotation)
  // anchor -> handle in the box's own axes
  const dx = d.hx * box.w
  const dy = d.hy * box.h
  const dd = dx * dx + dy * dy
  let factor = dd > 0 ? (v.x * dx + v.y * dy) / dd : 1
  if (!Number.isFinite(factor)) factor = 1
  const lo = Math.max(1e-3, limits.minFactor ?? 0.05)
  const hi = Math.max(lo, limits.maxFactor ?? 20)
  factor = Math.min(hi, Math.max(lo, factor))
  const center = rotateVec({ x: (d.hx * box.w * factor) / 2, y: (d.hy * box.h * factor) / 2 }, box.rotation)
  return { factor, cx: anchor.x + center.x, cy: anchor.y + center.y }
}

/** Rounds an angle to the nearest multiple of `step` degrees. */
export const snapAngle = (deg: number, step = 15): number => {
  const v = Math.round(deg / step) * step
  return v === 0 ? 0 : v // never -0
}

/**
 * The rotation that points the top-center rotation handle at `pointer`. With `snap` the result is a multiple of 15
 * degrees. Pointing at the box center itself leaves the rotation unchanged.
 */
export function rotationFromPointer(center: Pt, pointer: Pt, options: { snap?: boolean; current?: number } = {}): number {
  const dx = pointer.x - center.x
  const dy = pointer.y - center.y
  if (Math.hypot(dx, dy) < 1e-6) return normalizeAngle(options.current ?? 0)
  // the handle sits straight up (-90 degrees) when the layer is not rotated
  const deg = toDeg(Math.atan2(dy, dx)) + 90
  return normalizeAngle(options.snap ? snapAngle(deg) : deg)
}

/** CSS resize cursor for a handle once the box is rotated (the handle direction is turned and snapped to 45 degrees). */
export function cursorForHandle(handle: HandleId, rotation: number): string {
  const d = handleById(handle)
  const angle = toDeg(Math.atan2(d.hy, d.hx)) + rotation // direction of the handle in the frame, degrees
  const idx = ((Math.round(angle / 45) % 8) + 8) % 8 // 0 = pointing right
  // right/left -> ew, down-right/up-left -> nwse, down/up -> ns, down-left/up-right -> nesw
  return ['ew-resize', 'nwse-resize', 'ns-resize', 'nesw-resize'][idx % 4]
}
