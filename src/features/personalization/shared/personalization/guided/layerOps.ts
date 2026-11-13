/**
 * Pure layer operations for the overlay editor (Stage 1): duplicate, z-order,
 * group/ungroup, group-aware move, alignment and snapping with guides.
 *
 * Every function takes and returns plain preview settings, so the editor, the
 * undo history (which snapshots settings) and the tests all share one code
 * path. Geometry comes from `overlayGeometry`, i.e. the same `toBox()` the
 * Remotion composition uses, so what is aligned/snapped on the stage is what
 * renders in the preview and the export.
 *
 * Stacking: the composition stacks layers by media role and then by array
 * position, so "forward/backward" reorders the array (within a role this is
 * exactly visual z-order).
 */
import { normalizeRotation } from '../preview/layerTransform'
import type { PersonalizationPreviewSettings, PreviewLayer } from '../preview/types'
import {
  SAFE_AREA_MARGIN,
  clampLayerToBounds,
  layerBoxMetrics,
  offsetLayer,
  resolveCompositionSize,
} from './overlayGeometry'

/** A rectangle in normalized frame coordinates; (x, y) is the TOP-LEFT corner. */
export interface LayerRect {
  x: number
  y: number
  w: number
  h: number
}

const round = (n: number) => Math.round(n * 10000) / 10000
const DUPLICATE_OFFSET = 0.03

/** The layer's drawn box as a normalized rectangle (unrotated, like the safe-area clamp). */
export function layerRect(layer: PreviewLayer, compW: number, compH: number): LayerRect {
  const { width, height } = resolveCompositionSize(compW, compH)
  const m = layerBoxMetrics(layer, width, height)
  return { x: m.leftPx / width, y: m.topPx / height, w: m.widthPx / width, h: m.heightPx / height }
}

export function unionRect(rects: LayerRect[]): LayerRect | null {
  if (rects.length === 0) return null
  const x0 = Math.min(...rects.map((r) => r.x))
  const y0 = Math.min(...rects.map((r) => r.y))
  const x1 = Math.max(...rects.map((r) => r.x + r.w))
  const y1 = Math.max(...rects.map((r) => r.y + r.h))
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }
}

function uniqueId(base: string, taken: Set<string>): string {
  const stem = base.replace(/-\d+$/, '')
  let n = 2
  while (taken.has(`${stem}-${n}`)) n += 1
  return `${stem}-${n}`
}

// ── Duplicate ───────────────────────────────────────────────────────────────

/**
 * Copies a layer just above the original, nudged so the copy is visible. The
 * copy is never locked and never joins the original's group. Full-frame
 * `design` layers are not duplicable (two stacked designs would only cover each
 * other), so `null` is returned for them.
 */
export function duplicateLayer(
  settings: PersonalizationPreviewSettings,
  layerId: string,
  compW: number,
  compH: number,
): { settings: PersonalizationPreviewSettings; newId: string } | null {
  const index = settings.layers.findIndex((l) => l.id === layerId)
  if (index < 0) return null
  const source = settings.layers[index]
  if (source.kind === 'design') return null
  const newId = uniqueId(source.id, new Set(settings.layers.map((l) => l.id)))
  const copy: PreviewLayer = {
    ...source,
    id: newId,
    locked: undefined,
    groupId: undefined,
    placementSource: 'manual',
    imageUrls: source.imageUrls ? [...source.imageUrls] : undefined,
    textSlotOverrides: source.textSlotOverrides ? { ...source.textSlotOverrides } : undefined,
  }
  delete copy.locked
  delete copy.groupId
  if (copy.imageUrls === undefined) delete copy.imageUrls
  if (copy.textSlotOverrides === undefined) delete copy.textSlotOverrides
  const moved = offsetLayer(copy, DUPLICATE_OFFSET, DUPLICATE_OFFSET, compW, compH)
  const layers = [...settings.layers]
  layers.splice(index + 1, 0, { ...moved, x: round(moved.x), y: round(moved.y) })
  return { settings: { ...settings, layers }, newId }
}

// ── Z-order ─────────────────────────────────────────────────────────────────

export type ReorderMode = 'forward' | 'backward' | 'front' | 'back'

/** Moves one layer in the stack; a no-op (same object returned) when it cannot move. */
export function reorderLayer(
  settings: PersonalizationPreviewSettings,
  layerId: string,
  mode: ReorderMode,
): PersonalizationPreviewSettings {
  const from = settings.layers.findIndex((l) => l.id === layerId)
  if (from < 0) return settings
  const last = settings.layers.length - 1
  const to =
    mode === 'forward' ? Math.min(last, from + 1)
    : mode === 'backward' ? Math.max(0, from - 1)
    : mode === 'front' ? last
    : 0
  if (to === from) return settings
  const layers = [...settings.layers]
  const [moved] = layers.splice(from, 1)
  layers.splice(to, 0, moved)
  return { ...settings, layers }
}

// ── Group / ungroup ─────────────────────────────────────────────────────────

/** Ids of every layer in the same group as `layerId` (just itself when ungrouped). */
export function groupMemberIds(layers: PreviewLayer[], layerId: string): string[] {
  const layer = layers.find((l) => l.id === layerId)
  if (!layer) return []
  if (!layer.groupId) return [layer.id]
  return layers.filter((l) => l.groupId === layer.groupId).map((l) => l.id)
}

/**
 * Puts the given layers in one new group. Needs at least two existing,
 * non-design layers; joining replaces any previous group membership, and a
 * group left with a single member is dissolved so no orphan groups remain.
 */
export function groupLayers(
  settings: PersonalizationPreviewSettings,
  layerIds: string[],
): { settings: PersonalizationPreviewSettings; groupId: string } | null {
  const wanted = new Set(layerIds)
  const members = settings.layers.filter((l) => wanted.has(l.id) && l.kind !== 'design')
  if (members.length < 2) return null
  const taken = new Set(settings.layers.map((l) => l.groupId).filter((g): g is string => !!g))
  let n = 1
  while (taken.has(`group-${n}`)) n += 1
  const groupId = `group-${n}`
  const memberIds = new Set(members.map((l) => l.id))
  const layers = settings.layers.map((l) => (memberIds.has(l.id) ? { ...l, groupId } : l))
  return { settings: dissolveSingletonGroups({ ...settings, layers }), groupId }
}

/** Removes the given layers (and their whole group) from grouping. */
export function ungroupLayers(
  settings: PersonalizationPreviewSettings,
  layerIds: string[],
): PersonalizationPreviewSettings {
  const groups = new Set(
    settings.layers.filter((l) => layerIds.includes(l.id) && l.groupId).map((l) => l.groupId as string),
  )
  if (groups.size === 0) return settings
  const layers = settings.layers.map((l) => {
    if (!l.groupId || !groups.has(l.groupId)) return l
    const { groupId: _dropped, ...rest } = l
    return rest as PreviewLayer
  })
  return { ...settings, layers }
}

function dissolveSingletonGroups(settings: PersonalizationPreviewSettings): PersonalizationPreviewSettings {
  const counts = new Map<string, number>()
  for (const l of settings.layers) if (l.groupId) counts.set(l.groupId, (counts.get(l.groupId) ?? 0) + 1)
  if (![...counts.values()].some((c) => c < 2)) return settings
  const layers = settings.layers.map((l) => {
    if (!l.groupId || (counts.get(l.groupId) ?? 0) >= 2) return l
    const { groupId: _dropped, ...rest } = l
    return rest as PreviewLayer
  })
  return { ...settings, layers }
}

// ── Move (group-aware) ──────────────────────────────────────────────────────

/**
 * Moves the layers by the same normalized delta without deforming the
 * selection: the delta is reduced to what every unlocked member can take while
 * staying inside the safe area. Locked layers stay where they are.
 */
export function moveLayers(
  settings: PersonalizationPreviewSettings,
  layerIds: string[],
  dx: number,
  dy: number,
  compW: number,
  compH: number,
): PersonalizationPreviewSettings {
  const ids = new Set(layerIds)
  const movable = settings.layers.filter((l) => ids.has(l.id) && !l.locked)
  if (movable.length === 0) return settings
  const origins = movable.map((l) => clampLayerToBounds(l, compW, compH))
  const results = origins.map((o) => offsetLayer(o, dx, dy, compW, compH))
  const pickDelta = (want: number, actual: number[]): number => {
    if (want === 0) return 0
    const sameDir = actual.map((a) => (Math.sign(a) === Math.sign(want) ? a : 0))
    return sameDir.reduce((best, a) => (Math.abs(a) < Math.abs(best) ? a : best), sameDir[0])
  }
  const fx = pickDelta(dx, results.map((r, i) => r.x - origins[i].x))
  const fy = pickDelta(dy, results.map((r, i) => r.y - origins[i].y))
  const byId = new Map(movable.map((l, i) => [l.id, origins[i]]))
  const layers = settings.layers.map((l) => {
    const o = byId.get(l.id)
    if (!o) return l
    return { ...l, x: round(o.x + fx), y: round(o.y + fy), placementSource: 'manual' as const }
  })
  return { ...settings, layers }
}

// ── Align ───────────────────────────────────────────────────────────────────

export type AlignMode = 'left' | 'hcenter' | 'right' | 'top' | 'vcenter' | 'bottom'

/**
 * Aligns the selection. One layer aligns to the frame's safe area; two or more
 * align to the selection's own bounding box. Locked layers are not moved.
 */
export function alignLayers(
  settings: PersonalizationPreviewSettings,
  layerIds: string[],
  mode: AlignMode,
  compW: number,
  compH: number,
): PersonalizationPreviewSettings {
  const ids = new Set(layerIds)
  const selected = settings.layers.filter((l) => ids.has(l.id))
  if (selected.length === 0) return settings
  const rects = new Map(selected.map((l) => [l.id, layerRect(clampLayerToBounds(l, compW, compH), compW, compH)]))
  const target: LayerRect =
    selected.length === 1
      ? { x: SAFE_AREA_MARGIN, y: SAFE_AREA_MARGIN, w: 1 - 2 * SAFE_AREA_MARGIN, h: 1 - 2 * SAFE_AREA_MARGIN }
      : (unionRect([...rects.values()]) as LayerRect)
  const shiftFor = (r: LayerRect): { dx: number; dy: number } => {
    switch (mode) {
      case 'left': return { dx: target.x - r.x, dy: 0 }
      case 'hcenter': return { dx: target.x + target.w / 2 - (r.x + r.w / 2), dy: 0 }
      case 'right': return { dx: target.x + target.w - (r.x + r.w), dy: 0 }
      case 'top': return { dx: 0, dy: target.y - r.y }
      case 'vcenter': return { dx: 0, dy: target.y + target.h / 2 - (r.y + r.h / 2) }
      default: return { dx: 0, dy: target.y + target.h - (r.y + r.h) }
    }
  }
  const layers = settings.layers.map((l) => {
    const r = rects.get(l.id)
    if (!r || l.locked) return l
    const { dx, dy } = shiftFor(r)
    const next = offsetLayer(l, dx, dy, compW, compH)
    return { ...l, x: round(next.x), y: round(next.y), placementSource: 'manual' as const }
  })
  return { ...settings, layers }
}

// ── Snap ────────────────────────────────────────────────────────────────────

export interface SnapGuide {
  axis: 'x' | 'y'
  /** Position of the guide line as a 0..1 fraction of the frame. */
  at: number
  kind: 'frame' | 'layer' | 'grid'
}

export interface SnapResult {
  dx: number
  dy: number
  guides: SnapGuide[]
}

export interface SnapOptions {
  /** Distance (fraction of the frame) within which an edge/centre snaps. */
  threshold?: number
  /** Grid step as a fraction of the frame (e.g. 0.05); null/undefined = no grid. */
  grid?: number | null
}

export const DEFAULT_SNAP_THRESHOLD = 0.012

/**
 * Finds the smallest shift that makes the moving rectangle's left/centre/right
 * (and top/middle/bottom) line up with a frame line (safe-area edges, centre),
 * another layer's edge/centre, or — when enabled — the grid. Returns the extra
 * shift to apply and the guide lines to draw. Pure and deterministic.
 */
export function computeSnap(moving: LayerRect, others: LayerRect[], options: SnapOptions = {}): SnapResult {
  const threshold = options.threshold ?? DEFAULT_SNAP_THRESHOLD
  const grid = options.grid && options.grid > 0 ? options.grid : null
  const xs: { at: number; kind: SnapGuide['kind'] }[] = [
    { at: SAFE_AREA_MARGIN, kind: 'frame' },
    { at: 0.5, kind: 'frame' },
    { at: 1 - SAFE_AREA_MARGIN, kind: 'frame' },
  ]
  const ys = [...xs]
  for (const o of others) {
    xs.push({ at: o.x, kind: 'layer' }, { at: o.x + o.w / 2, kind: 'layer' }, { at: o.x + o.w, kind: 'layer' })
    ys.push({ at: o.y, kind: 'layer' }, { at: o.y + o.h / 2, kind: 'layer' }, { at: o.y + o.h, kind: 'layer' })
  }
  const best = (points: number[], targets: { at: number; kind: SnapGuide['kind'] }[], gridStep: number | null) => {
    let found: { shift: number; at: number; kind: SnapGuide['kind'] } | null = null
    for (const p of points) {
      for (const t of targets) {
        const shift = t.at - p
        if (Math.abs(shift) <= threshold && (!found || Math.abs(shift) < Math.abs(found.shift))) {
          found = { shift, at: t.at, kind: t.kind }
        }
      }
      if (gridStep) {
        const at = Math.round(p / gridStep) * gridStep
        const shift = at - p
        if (Math.abs(shift) <= threshold && (!found || Math.abs(shift) < Math.abs(found.shift))) {
          found = { shift, at, kind: 'grid' }
        }
      }
    }
    return found
  }
  const bx = best([moving.x, moving.x + moving.w / 2, moving.x + moving.w], xs, grid)
  const by = best([moving.y, moving.y + moving.h / 2, moving.y + moving.h], ys, grid)
  const guides: SnapGuide[] = []
  if (bx) guides.push({ axis: 'x', at: round(bx.at), kind: bx.kind })
  if (by) guides.push({ axis: 'y', at: round(by.at), kind: by.kind })
  return { dx: bx ? bx.shift : 0, dy: by ? by.shift : 0, guides }
}

// ── Rotate ──────────────────────────────────────────────────────────────────

/**
 * Sets a layer's rotation (degrees, wrapped into (-180, 180]; 0 clears it). Locked and
 * full-frame `design` layers are never rotated. Returns the same object when nothing
 * changes, so callers and undo history do not record no-op edits.
 */
export function setLayerRotation(
  settings: PersonalizationPreviewSettings,
  layerId: string,
  degrees: number,
): PersonalizationPreviewSettings {
  const next = normalizeRotation(degrees)
  let changed = false
  const layers = settings.layers.map((l) => {
    if (l.id !== layerId || l.locked || l.kind === 'design') return l
    if (l.rotation === next) return l
    changed = true
    const { rotation: _old, ...rest } = l
    return (next === undefined ? rest : { ...rest, rotation: next, placementSource: 'manual' as const }) as PreviewLayer
  })
  return changed ? { ...settings, layers } : settings
}

/** Snaps an angle to the nearest `step` degrees (used by the on-canvas rotate handle with Shift). */
export function snapAngle(degrees: number, step = 15): number {
  if (!Number.isFinite(degrees) || !Number.isFinite(step) || step <= 0) return 0
  return Math.round(degrees / step) * step
}
