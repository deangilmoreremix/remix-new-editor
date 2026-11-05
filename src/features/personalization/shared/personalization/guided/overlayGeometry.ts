/**
 * Pure geometry for the direct-on-video overlay editor (`OverlayEditor.tsx`).
 *
 * ── Cross-aspect mapping: stage ↔ Remotion composition ──────────────────────
 * `preview/PersonalizationComposition.tsx` positions every layer with
 * `toBox(layer, settings.width, settings.height)`. The editor stage mirrors
 * that call exactly, so what the customer drags is what renders:
 *
 *   text layers  · fontSize = round(scale * height)
 *                  width    = min(width * 0.9, fontSize * estimated chars)
 *                  left     = x * width  - width / 2
 *                  top      = max(0, y * height - fontSize / 2)
 *                  (no explicit height: content flows from `top`)
 *   image layers · width    = round(scale * width)
 *                  height   = the SAME width — image boxes are square and are
 *                             sized from the composition WIDTH, never from the
 *                             height, whatever `aspectRatio` is.
 *                  left     = x * width - width / 2
 *                  top      = max(0, y * height - width / 2)
 *
 * `settings.width`/`settings.height` change with `aspectRatio`
 * (16:9→1920x1080, 9:16→1080x1920, 1:1→1080x1080, 4:5→1080x1350), so every
 * pixel above is expressed in composition pixels. The stage element uses
 * `aspect-ratio: compW / compH` and one single factor,
 *
 *   factor = stageWidth / compW        →  stagePx = compPx * factor
 *
 * for both axes, positions, font sizes and image widths alike. There is no
 * square-composition assumption anywhere: a 9:16 logo keeps the same relative
 * size on the stage as in the render, because both use the identical
 * `toBox()` call and the identical `factor`.
 *
 * ── Safe area ───────────────────────────────────────────────────────────────
 * Every layer box must stay inside the video frame with a small inset
 * (`SAFE_AREA_MARGIN` on each side). `clampLayerToBounds()` derives the
 * clamped `x`/`y`/`scale` for a layer: the scale is first bounded to
 * [MIN_LAYER_SCALE, MAX_LAYER_SCALE], then reduced further if the resulting
 * box still cannot fit the frame (so an oversized logo shrinks instead of
 * hanging outside the video), and finally the center is moved inside the
 * inset. The same function is used when drawing (stale, out-of-bounds values
 * from older saved projects are drawn clamped) and when writing (drag, resize
 * and keyboard moves always persist in-bounds values).
 */

import { isImageLayerKind, toBox } from '../preview/presets'
import type { PreviewLayer, PreviewLayerKind } from '../preview/types'
import type { AssetLibrary, PersonalizationAsset } from '../types'

/** Inset from the frame edges a layer box may never cross (2% per side). */
export const SAFE_AREA_MARGIN = 0.02

/** Absolute scale range: a layer never shrinks below 5% or grows past 1.5x. */
export const MIN_LAYER_SCALE = 0.05
export const MAX_LAYER_SCALE = 1.5

/** Keyboard nudge steps, as fractions of the composition size. */
export const NUDGE_STEP = 0.01
export const NUDGE_STEP_LARGE = 0.05

/** Line height used by the composition's text boxes. */
export const TEXT_LINE_HEIGHT = 1.15

/** Character-width ratio shared with toBox's own width estimate. */
const APPROX_CHAR_WIDTH_RATIO = 0.55

/** Guard rail for pathological text lengths. */
const MAX_TEXT_LINES = 8

/** Composition size used when the settings carry no usable dimensions. */
const FALLBACK_COMPOSITION = { width: 1920, height: 1080 }

/** Bisection precision when searching for the largest fitting scale. */
const FIT_ITERATIONS = 20

/** Half-pixel tolerance, because toBox rounds to whole composition pixels. */
const FIT_TOLERANCE_PX = 0.5

export interface LayerBoxMetrics {
  leftPx: number
  topPx: number
  widthPx: number
  /** Vertical footprint of the box (square side for image layers). */
  heightPx: number
  /**
   * Height toBox itself anchors on when it positions the box: the font size
   * for text layers (only the first line), the square side for images. Text
   * boxes therefore hang further down than their own anchor suggests.
   */
  anchorHeightPx: number
  fontSizePx: number
  isImage: boolean
  /** Design layers have an explicit box (the video's own shape, scaled). */
  isDesign: boolean
}

export interface StageBoxPx {
  left: number
  top: number
  width: number
  /** Omitted for text layers, exactly like the composition (auto height). */
  height?: number
  fontSize: number
}

export interface ImageAssetOption {
  value: string
  label: string
}

function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  const n = typeof value === 'number' && Number.isFinite(value) ? value : fallback
  return Math.min(max, Math.max(min, n))
}

/** Mirrors the composition's `settings.width > 0 ? … : videoConfig` fallback. */
export function resolveCompositionSize(width: number, height: number): { width: number; height: number } {
  const usableWidth =
    typeof width === 'number' && Number.isFinite(width) && width > 0 ? width : FALLBACK_COMPOSITION.width
  const usableHeight =
    typeof height === 'number' && Number.isFinite(height) && height > 0 ? height : FALLBACK_COMPOSITION.height
  return { width: usableWidth, height: usableHeight }
}

/** Composition pixels → stage pixels (0 before the stage has been measured). */
export function stageScaleFactor(stageWidth: number, compW: number): number {
  if (!Number.isFinite(stageWidth) || stageWidth <= 0) return 0
  const { width } = resolveCompositionSize(compW, FALLBACK_COMPOSITION.height)
  return stageWidth / width
}

/**
 * Estimates how many lines a text layer wraps to, using the same character
 * width ratio toBox uses for its width estimate, so the estimate and the
 * rendered box stay consistent. `boxWidthPx` must be the UNROUNDED box width
 * (`min(compW * 0.9, fontSize * chars)`); rounding it first would drop a line.
 */
export function estimateTextLineCount(text: string, fontSizePx: number, boxWidthPx: number): number {
  const trimmed = typeof text === 'string' ? text.trim() : ''
  if (!trimmed || fontSizePx <= 0 || boxWidthPx <= 0) return 1
  const charsPerLine = Math.max(
    1,
    Math.floor(boxWidthPx / (fontSizePx * APPROX_CHAR_WIDTH_RATIO) + 1e-9),
  )
  return Math.min(MAX_TEXT_LINES, Math.max(1, Math.ceil(trimmed.length / charsPerLine)))
}

/**
 * Pixel box a layer occupies in composition space, derived from the very same
 * `toBox()` call the composition makes. Image layers are square
 * (`heightPx === widthPx`); text layers estimate their footprint from the
 * font size, the line height and the estimated wrap count.
 */
export function layerBoxMetrics(layer: PreviewLayer, compW: number, compH: number): LayerBoxMetrics {
  const { width, height } = resolveCompositionSize(compW, compH)
  const box = toBox(layer, width, height)
  if (layer.kind === 'design') {
    // A design owns an explicit box: the video's own shape scaled down, so
    // the design keeps the composition's proportions wherever it sits.
    const heightPx = box.heightPx ?? height
    return {
      leftPx: box.leftPx,
      topPx: box.topPx,
      widthPx: box.widthPx,
      heightPx,
      anchorHeightPx: heightPx,
      fontSizePx: 0,
      isImage: false,
      isDesign: true,
    }
  }
  if (isImageLayerKind(layer.kind)) {
    return {
      leftPx: box.leftPx,
      topPx: box.topPx,
      widthPx: box.widthPx,
      heightPx: box.widthPx,
      anchorHeightPx: box.widthPx,
      fontSizePx: 0,
      isImage: true,
      isDesign: false,
    }
  }
  // Same width estimate toBox makes, kept unrounded so the wrap count is exact.
  const chars = Math.max(4, (layer.text?.length ?? 8) * APPROX_CHAR_WIDTH_RATIO)
  const unroundedWidthPx = Math.min(width * 0.9, box.fontSizePx * chars)
  const lines = estimateTextLineCount(layer.text ?? '', box.fontSizePx, unroundedWidthPx)
  return {
    leftPx: box.leftPx,
    topPx: box.topPx,
    widthPx: box.widthPx,
    heightPx: Math.round(box.fontSizePx * TEXT_LINE_HEIGHT * lines),
    anchorHeightPx: box.fontSizePx,
    fontSizePx: box.fontSizePx,
    isImage: false,
    isDesign: false,
  }
}

function usableFrame(width: number, height: number): { w: number; h: number } {
  return {
    w: width * (1 - SAFE_AREA_MARGIN * 2),
    h: height * (1 - SAFE_AREA_MARGIN * 2),
  }
}

/** True when a box fits inside the frame's safe area. */
export function boxFitsSafeArea(metrics: LayerBoxMetrics, compW: number, compH: number): boolean {
  const { width, height } = resolveCompositionSize(compW, compH)
  const frame = usableFrame(width, height)
  return metrics.widthPx <= frame.w + FIT_TOLERANCE_PX && metrics.heightPx <= frame.h + FIT_TOLERANCE_PX
}

/** Largest scale inside [MIN_LAYER_SCALE, MAX_LAYER_SCALE] that still fits. */
export function maxScaleThatFits(layer: PreviewLayer, compW: number, compH: number): number {
  const { width, height } = resolveCompositionSize(compW, compH)
  const at = (scale: number) => layerBoxMetrics({ ...layer, scale }, width, height)
  if (boxFitsSafeArea(at(MAX_LAYER_SCALE), width, height)) return MAX_LAYER_SCALE
  if (!boxFitsSafeArea(at(MIN_LAYER_SCALE), width, height)) return MIN_LAYER_SCALE

  let low = MIN_LAYER_SCALE
  let high = MAX_LAYER_SCALE
  for (let step = 0; step < FIT_ITERATIONS; step += 1) {
    const mid = (low + high) / 2
    if (boxFitsSafeArea(at(mid), width, height)) low = mid
    else high = mid
  }
  return low
}

/** Bounds a scale to the absolute range the editor supports. */
export function clampScale(scale: number): number {
  return clampNumber(scale, MIN_LAYER_SCALE, MAX_LAYER_SCALE, MIN_LAYER_SCALE)
}

/**
 * Clamps a layer so its box stays inside the video frame's safe area:
 *   · scale  ∈ [MIN_LAYER_SCALE, MAX_LAYER_SCALE], reduced further when the box
 *     is too large for the frame at this aspect ratio;
 *   · center moved so left/right/top/bottom edges stay inside the 2% inset.
 * The vertical bounds use toBox's own anchoring (`top = y * height - anchor/2`),
 * so a wrapped text block is bounded by its real footprint, not just its first
 * line. When the box cannot fit at the minimum scale (pathological text), the
 * layer is centered rather than pushed off screen. Pure: returns a new layer.
 */
export function clampLayerToBounds(layer: PreviewLayer, compW: number, compH: number): PreviewLayer {
  const { width, height } = resolveCompositionSize(compW, compH)
  const scale = Math.min(clampScale(layer.scale), maxScaleThatFits(layer, width, height))
  const next: PreviewLayer = { ...layer, scale }
  const metrics = layerBoxMetrics(next, width, height)

  // Horizontal: left = x * width - widthPx / 2.
  const halfW = metrics.widthPx / 2 / width
  const minX = SAFE_AREA_MARGIN + halfW
  const maxX = 1 - SAFE_AREA_MARGIN - halfW

  // Vertical: top = y * height - anchorHeightPx / 2, bottom = top + heightPx.
  const anchor = metrics.anchorHeightPx / 2 / height
  const minY = SAFE_AREA_MARGIN + anchor
  const maxY = 1 - SAFE_AREA_MARGIN - (metrics.heightPx / height - anchor)

  next.x = minX <= maxX ? clampNumber(layer.x, minX, maxX, minX) : 0.5
  next.y = minY <= maxY ? clampNumber(layer.y, minY, maxY, minY) : 0.5
  return next
}

/** Drag delta (fractions of the stage/frame) applied to a layer, clamped. */
export function offsetLayer(
  layer: PreviewLayer,
  deltaX: number,
  deltaY: number,
  compW: number,
  compH: number,
): PreviewLayer {
  const dx = Number.isFinite(deltaX) ? deltaX : 0
  const dy = Number.isFinite(deltaY) ? deltaY : 0
  return clampLayerToBounds(
    { ...layer, x: clampNumber(layer.x, 0, 1, 0) + dx, y: clampNumber(layer.y, 0, 1, 0) + dy },
    compW,
    compH,
  )
}

/** Corner-handle resize: applies a new scale, clamped into the safe area. */
export function scaleLayerTo(
  layer: PreviewLayer,
  nextScale: number,
  compW: number,
  compH: number,
): PreviewLayer {
  return clampLayerToBounds({ ...layer, scale: nextScale }, compW, compH)
}

/**
 * Keyboard nudge: 1% of the frame per press (5% with Shift), applied to the
 * layer's center and clamped into the safe area.
 */
export function nudgeLayer(
  layer: PreviewLayer,
  stepX: number,
  stepY: number,
  compW: number,
  compH: number,
): PreviewLayer {
  return offsetLayer(layer, stepX, stepY, compW, compH)
}

/** Step size for the next keyboard nudge (Shift → coarse). */
export function nudgeStep(shiftKey?: boolean): number {
  return shiftKey ? NUDGE_STEP_LARGE : NUDGE_STEP
}

/** Arrow key → normalized nudge delta, or null for non-arrow keys. */
export function nudgeDeltaForKey(
  key: string,
  shiftKey?: boolean,
): { dx: number; dy: number } | null {
  const step = nudgeStep(shiftKey)
  switch (key) {
    case 'ArrowLeft':
      return { dx: -step, dy: 0 }
    case 'ArrowRight':
      return { dx: step, dy: 0 }
    case 'ArrowUp':
      return { dx: 0, dy: -step }
    case 'ArrowDown':
      return { dx: 0, dy: step }
    default:
      return null
  }
}

/**
 * Stage pixels for a layer: the safe-area-clamped composition box multiplied
 * by `stageWidth / compW`. Image layers are square; text layers grow with
 * their content (no height), exactly like the composition.
 */
export function toStageBox(layer: PreviewLayer, compW: number, compH: number, stageWidth: number): StageBoxPx {
  const { width, height } = resolveCompositionSize(compW, compH)
  const factor = stageScaleFactor(stageWidth, width)
  const bounded = clampLayerToBounds(layer, width, height)
  const box = layerBoxMetrics(bounded, width, height)
  return {
    left: box.leftPx * factor,
    top: box.topPx * factor,
    width: box.widthPx * factor,
    height: box.isImage
      ? box.widthPx * factor
      : box.isDesign
        ? box.heightPx * factor
        : undefined,
    fontSize: box.fontSizePx * factor,
  }
}

// ── Image asset picker ───────────────────────────────────────────────────────

/** Assets the image picker offers for a layer kind. */
export function assetPoolForKind(kind: PreviewLayerKind, assets?: Partial<AssetLibrary>): PersonalizationAsset[] {
  const library = assets || {}
  if (kind === 'logo') return Array.isArray(library.logos) ? library.logos : []
  if (kind === 'productImage' || kind === 'serviceImage') {
    return Array.isArray(library.products) ? library.products : []
  }
  return []
}

/** Best URL for an asset: the uploaded copy wins over the discovered one. */
export function imageAssetUrl(asset: PersonalizationAsset): string {
  return (typeof asset?.uploadedUrl === 'string' && asset.uploadedUrl) || asset?.url || ''
}

/** Label for the option that drops back to the brand fallback image. */
export function imageAssetDefaultLabel(kind: PreviewLayerKind): string {
  if (kind === 'logo') return 'Use your logo'
  if (kind === 'productImage' || kind === 'serviceImage') return 'Use your photo'
  return 'Use default'
}

/**
 * Options for the image-asset select: `assets.logos` for the logo layer,
 * `assets.products` for product/service images. Every option sets
 * `layer.imageUrl`; the extra "use your …" option (empty value) clears it so
 * the stage falls back to the brand image again.
 */
export function imageAssetOptions(
  layer: PreviewLayer,
  assets?: Partial<AssetLibrary>,
): ImageAssetOption[] {
  return assetPoolForKind(layer.kind, assets)
    .filter((asset) => Boolean(asset) && Boolean(imageAssetUrl(asset)))
    .map((asset, index) => ({
      value: imageAssetUrl(asset),
      label: (typeof asset.name === 'string' && asset.name.trim()) || `${layer.kind} ${index + 1}`,
    }))
}
