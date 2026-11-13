/**
 * Deterministic candidate-scoring placement.
 *
 * For every layer the engine is ALLOWED to move it generates a fixed list of
 * candidate positions, scores each against protected zones, the overlays
 * already placed, text fit, measured contrast over the layer's visible time,
 * the template's intended position and visual hierarchy, and keeps the best
 * valid one — but only when it is meaningfully better than where the layer
 * already is, so a good designed layout is left alone.
 *
 * Never moves: locked layers, layers the customer placed by hand
 * (`placementSource === 'manual'`), hidden layers, or roles that are not
 * auto-placeable (full-frame scenes, effects, picture-in-picture designs).
 * No randomness, no network, no detection of faces or objects.
 */
import { layerBoxMetrics } from '../../guided/overlayGeometry'
import { contractFor } from '../mediaRoles'
import type { PreviewLayer } from '../types'
import {
  inflate,
  area,
  contrastRatio,
  hexLuminance,
  intersectionArea,
  outsideSafeArea,
  regionLuminance,
  splitPanelRect,
  zoneToPx,
} from './geometry'
import type {
  LumaSample,
  PlacementInput,
  PlacementLayer,
  PlacementProposal,
  PlacementResult,
  PxRect,
} from './types'

/** A candidate must beat the current spot by this much penalty to be chosen. */
export const MOVE_THRESHOLD = 5

/**
 * Pixel box of a layer at (x, y). For an image whose natural aspect ratio is
 * known, the box is the VISIBLE area of the contained image (a wide logo in its
 * square layer box occupies only the middle band), so checks do not flag the
 * empty letterbox. Unknown aspect => the whole square (conservative).
 */
export function boxOf(
  layer: PreviewLayer,
  text: string,
  x: number,
  y: number,
  width: number,
  height: number,
  imageAspect?: number,
): PxRect {
  const m = layerBoxMetrics({ ...layer, x, y }, width, height, text || undefined)
  const box = { left: m.leftPx, top: m.topPx, width: m.widthPx, height: m.heightPx }
  if (m.isImage && imageAspect && Number.isFinite(imageAspect) && imageAspect > 0) {
    if (imageAspect >= 1) {
      const h = box.width / imageAspect
      return { left: box.left, top: box.top + (box.height - h) / 2, width: box.width, height: h }
    }
    const w = box.height * imageAspect
    return { left: box.left + (box.width - w) / 2, top: box.top, width: w, height: box.height }
  }
  return box
}

/** Seconds a layer is on screen, as [start, end]. */
export function visibleSeconds(
  layer: PreviewLayer,
  fps: number,
  durationInFrames: number,
  endCardStartFrame?: number | null,
): [number, number] {
  const start = Math.max(0, layer.startFrame + (layer.animationDelay || 0)) / fps
  // The branded end card covers the footage; overlays are judged only before it.
  const lastFrame = Math.min(layer.endFrame ?? durationInFrames, endCardStartFrame ?? Infinity)
  const end = lastFrame / fps
  return [start, Math.max(start, end)]
}

/** Samples inside a layer's visible window (all samples if none fall inside). */
export function samplesFor(samples: LumaSample[], window: [number, number]): LumaSample[] {
  const inside = samples.filter((s) => s.t >= window[0] - 1e-6 && s.t <= window[1] + 1e-6)
  return inside.length ? inside : samples
}

/** Worst contrast of `textColor` over the box across the given samples, or null when unmeasurable. */
export function worstContrast(
  box: PxRect,
  samples: LumaSample[],
  width: number,
  height: number,
  textColor: string,
): { ratio: number; t: number; spread: number } | null {
  const lt = hexLuminance(textColor)
  let worst: { ratio: number; t: number } | null = null
  const lums: number[] = []
  for (const s of samples) {
    const bg = regionLuminance(s, box, width, height)
    if (bg == null) continue
    lums.push(bg)
    const ratio = contrastRatio(lt, bg)
    if (!worst || ratio < worst.ratio) worst = { ratio, t: s.t }
  }
  if (!worst) return null
  const mean = lums.reduce((a, b) => a + b, 0) / lums.length
  const spread = Math.sqrt(lums.reduce((a, b) => a + (b - mean) ** 2, 0) / lums.length)
  return { ...worst, spread }
}

const TEXT_ORDER = ['headline', 'businessName', 'tagline', 'offer', 'cta'] as const

function priority(l: PlacementLayer): number {
  switch (l.role) {
    case 'product-image':
    case 'service-image':
      return 0
    case 'logo':
      return 1
    default: {
      const i = TEXT_ORDER.indexOf(l.layer.kind as (typeof TEXT_ORDER)[number])
      return 2 + (i < 0 ? 9 : i)
    }
  }
}

/** Smallest size a layer may be shrunk to, as a fraction of its current scale (template limits). */
export const MIN_SCALE_FACTOR = 0.8
const TEXT_SCALE_FACTORS = [1, 0.9, MIN_SCALE_FACTOR]
const IMAGE_SCALE_FACTORS = [1, 0.8, 0.65, 0.5]

type Candidate = { x: number; y: number; f: number }

function candidatesFor(l: PlacementLayer): Candidate[] {
  const base: { x: number; y: number }[] = [{ x: l.intended.x, y: l.intended.y }, { x: l.layer.x, y: l.layer.y }]
  const out = base.map((c) => ({ ...c, f: 1 }))
  if (l.role === 'logo') {
    for (const f of IMAGE_SCALE_FACTORS) for (const [x, y] of [[0.08, 0.08], [0.92, 0.08], [0.08, 0.92], [0.92, 0.92]]) out.push({ x, y, f })
  } else if (l.role === 'product-image' || l.role === 'service-image') {
    for (const f of IMAGE_SCALE_FACTORS) for (const x of [0.22, 0.5, 0.78]) for (const y of [0.35, 0.5, 0.62, 0.7]) out.push({ x, y, f })
  } else {
    const xs = Array.from(new Set([l.intended.x, 0.3, 0.5, 0.7]))
    for (const f of TEXT_SCALE_FACTORS) for (const y of [0.12, 0.18, 0.25, 0.32, 0.4, 0.48, 0.56, 0.64, 0.72, 0.8, 0.88]) for (const x of xs) out.push({ x, y, f })
  }
  // de-duplicate, keep order (deterministic)
  const seen = new Set<string>()
  return out.filter((c) => {
    const k = `${c.x.toFixed(4)},${c.y.toFixed(4)},${c.f}`
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })
}

interface Scored {
  valid: boolean
  penalty: number
  reasons: string[]
}

function scoreCandidate(
  l: PlacementLayer,
  x: number,
  y: number,
  f: number,
  input: PlacementInput,
  placed: { id: string; role: string; kind: string; box: PxRect }[],
  /** Text that has not been placed yet: a picture should not land on it (softer than a placed overlay). */
  soft: { id: string; box: PxRect }[] = [],
  panels: PxRect[] = [],
): Scored {
  const { width, height } = input
  const contract = contractFor(l.role)
  const sized = f === 1 ? l.layer : { ...l.layer, scale: l.layer.scale * f }
  const box = boxOf(sized, l.text, x, y, width, height, l.imageAspect)
  const reasons: string[] = []
  if (contract.clampToSafeArea && outsideSafeArea(box, width, height)) {
    return { valid: false, penalty: Infinity, reasons: ['outside the safe area'] }
  }
  if (l.role !== 'product-image' && l.role !== 'service-image') {
    for (const pn of panels) {
      if (intersectionArea(box, pn) / Math.max(1, area(box)) > 0.2) return { valid: false, penalty: Infinity, reasons: ['on the Split Screen picture'] }
    }
  }
  let p = 0
  const a = Math.max(1, area(box))
  // what the layer visibly occupies, shadow included
  const hit = inflate(box, l.bleedPx ?? 0)

  if (!contract.mayCoverSubject) {
    for (const z of input.zones) {
      const ov = intersectionArea(hit, zoneToPx(z, width, height))
      if (ov > 0) {
        p += 300 * (ov / a)
        reasons.push(`covers ${z.label}`)
      }
    }
  }
  for (const o of placed) {
    const ov = intersectionArea(hit, o.box)
    if (ov > 0) {
      p += 400 * (ov / Math.max(1, Math.min(a, area(o.box))))
      reasons.push('overlaps another overlay')
    }
  }
  for (const o of soft) {
    if (o.id === l.layer.id) continue
    const ov = intersectionArea(hit, o.box)
    if (ov > 0) {
      p += 250 * (ov / Math.max(1, Math.min(a, area(o.box))))
      reasons.push('covers text')
    }
  }
  if (l.text && input.samples.length) {
    const window = visibleSeconds(l.layer, input.fps, input.durationInFrames, input.endCardStartFrame)
    const wc = worstContrast(box, samplesFor(input.samples, window), width, height, l.layer.color ?? input.textColor)
    if (wc) {
      if (wc.ratio < 4.5) {
        p += (4.5 - wc.ratio) * 40
        reasons.push(`contrast ${wc.ratio.toFixed(1)}:1`)
      }
      p += wc.spread * 50
    }
  }
  p += Math.hypot(x - l.intended.x, y - l.intended.y) * 60
  p += (1 - f) * 40 // prefer the template's own size
  if (l.layer.kind === 'tagline' || l.layer.kind === 'offer') {
    const head = placed.find((o) => o.kind === 'headline')
    if (head && box.top < head.box.top) p += 80
  }
  return { valid: true, penalty: p, reasons }
}

export function recommendPlacement(input: PlacementInput): PlacementResult {
  const { width, height } = input
  const skipped: PlacementResult['skipped'] = []
  const placed: { id: string; role: string; kind: string; box: PxRect }[] = []
  const movable: PlacementLayer[] = []

  for (const l of input.layers) {
    const contract = contractFor(l.role)
    if (!l.layer.visible) { skipped.push({ layerId: l.layer.id, reason: 'hidden' }); continue }
    // an image layer with no image draws nothing: nothing to place, nothing to avoid
    if ((l.role === 'logo' || l.role === 'product-image' || l.role === 'service-image') && !(l.imageUrl ?? '').trim()) { skipped.push({ layerId: l.layer.id, reason: 'hidden' }); continue }
    const box = boxOf(l.layer, l.text, l.layer.x, l.layer.y, width, height, l.imageAspect)
    if (l.layer.locked) { skipped.push({ layerId: l.layer.id, reason: 'locked' }); placed.push({ id: l.layer.id, role: l.role, kind: l.layer.kind, box }); continue }
    if (l.layer.placementSource === 'manual') { skipped.push({ layerId: l.layer.id, reason: 'manual' }); placed.push({ id: l.layer.id, role: l.role, kind: l.layer.kind, box }); continue }
    if (!contract.autoPlaceable || l.layer.kind === 'design') { skipped.push({ layerId: l.layer.id, reason: 'not-auto-placeable' }); continue }
    movable.push(l)
  }

  // Text still to be placed is a soft obstacle for pictures (they are placed first).
  const soft = movable
    .filter((m) => m.role === 'text' && m.text)
    .map((m) => ({ id: m.layer.id, box: boxOf(m.layer, m.text, m.layer.x, m.layer.y, width, height, m.imageAspect) }))
  const panels = input.layers.filter((x) => x.layer.visible && x.presetId === 'split-screen').map((x) => splitPanelRect(x.splitSide, width, height))
  const proposals: PlacementProposal[] = []
  for (const l of [...movable].sort((a, b) => priority(a) - priority(b))) {
    const current = scoreCandidate(l, l.layer.x, l.layer.y, 1, input, placed, soft, panels)
    let best: { x: number; y: number; f: number; s: Scored } | null = null
    for (const c of candidatesFor(l)) {
      const s = scoreCandidate(l, c.x, c.y, c.f, input, placed, soft, panels)
      if (s.valid && (!best || s.penalty < best.s.penalty - 1e-9)) best = { ...c, s }
    }
    if (!best) {
      skipped.push({ layerId: l.layer.id, reason: 'no-valid-candidate' })
      placed.push({ id: l.layer.id, role: l.role, kind: l.layer.kind, box: boxOf(l.layer, l.text, l.layer.x, l.layer.y, width, height, l.imageAspect) })
      continue
    }
    // Keep a layer where it is unless the best candidate is meaningfully better.
    const keep = current.valid && current.penalty - best.s.penalty < MOVE_THRESHOLD
    const x = keep ? l.layer.x : best.x
    const y = keep ? l.layer.y : best.y
    const f = keep ? 1 : best.f
    const scale = l.layer.scale * f
    const chosen = keep ? current : best.s
    proposals.push({
      layerId: l.layer.id,
      x,
      y,
      scale,
      penalty: chosen.penalty,
      moved: Math.abs(x - l.layer.x) > 1e-3 || Math.abs(y - l.layer.y) > 1e-3 || Math.abs(scale - l.layer.scale) > 1e-6,
      reasons: chosen.reasons,
    })
    placed.push({ id: l.layer.id, role: l.role, kind: l.layer.kind, box: boxOf({ ...l.layer, scale }, l.text, x, y, width, height, l.imageAspect) })
  }

  return {
    proposals,
    skipped,
    analysis: {
      protectedZones: input.zones.length,
      frameSamples: input.samples.length,
      subjectVerified: input.zones.length > 0,
      contrastVerified: input.samples.length > 0,
    },
  }
}
