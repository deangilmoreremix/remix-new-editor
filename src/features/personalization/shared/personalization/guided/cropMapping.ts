/**
 * Maps between react-easy-crop's "visible area" and the crop model the Remotion
 * composition renders (`ImageStyle.cropX / cropY / zoom`, see `imageMediaStyle`).
 *
 * Render model (cover fit): the picture is scaled to cover its frame, positioned by
 * `object-position: cropX% cropY%`, then `transform: scale(zoom)` about that same
 * focus point (`transform-origin: cropX% cropY%`). With W = the covered image width
 * and F = the frame width, the visible width as a fraction of the IMAGE is
 *
 *     w = F / (zoom · W) = min(1, f/a) / zoom        (f = frame aspect, a = image aspect)
 *     h =                  min(1, a/f) / zoom
 *
 * and the visible region's left/top edges are
 *
 *     x0 = cropX · (1 − w)        y0 = cropY · (1 − h)
 *
 * so, given what react-easy-crop reports (x0, y0, w, h as fractions of the image),
 * the focus is  cropX = x0 / (1 − w),  cropY = y0 / (1 − h)  (0.5 when nothing can
 * move because the picture exactly fills the frame on that axis).
 *
 * Pure (no React): the dialog, the tests and any future surface share one mapping, so
 * what the customer frames in the dialog is exactly what the preview and export draw.
 */
import { clampImageZoom } from '../preview/layerTransform'

/** A visible region as FRACTIONS (0..1) of the source image; (x, y) is its top-left corner. */
export interface VisibleArea {
  x: number
  y: number
  width: number
  height: number
}

export interface CropFocus {
  cropX: number
  cropY: number
}

const EPS = 1e-6
const clamp01 = (n: number) => Math.min(1, Math.max(0, n))

/** react-easy-crop reports percentages (0..100); the model uses fractions. */
export function percentToFraction(area: { x: number; y: number; width: number; height: number }): VisibleArea {
  return { x: area.x / 100, y: area.y / 100, width: area.width / 100, height: area.height / 100 }
}

export function fractionToPercent(area: VisibleArea): { x: number; y: number; width: number; height: number } {
  return { x: area.x * 100, y: area.y * 100, width: area.width * 100, height: area.height * 100 }
}

/** Visible fractions of the image at a given zoom, for a frame of aspect `frameAspect` showing an image of aspect `imageAspect`. */
export function visibleFractions(zoom: number, imageAspect: number, frameAspect: number): { w: number; h: number } {
  const z = clampImageZoom(zoom)
  const a = Number.isFinite(imageAspect) && imageAspect > 0 ? imageAspect : 1
  const f = Number.isFinite(frameAspect) && frameAspect > 0 ? frameAspect : 1
  return { w: Math.min(1, f / a) / z, h: Math.min(1, a / f) / z }
}

/** The crop focus that makes the renderer show `area`. */
export function areaToFocus(area: VisibleArea): CropFocus {
  const w = clamp01(area.width)
  const h = clamp01(area.height)
  return {
    cropX: 1 - w <= EPS ? 0.5 : clamp01(area.x / (1 - w)),
    cropY: 1 - h <= EPS ? 0.5 : clamp01(area.y / (1 - h)),
  }
}

/** The region the renderer shows for a focus + zoom (inverse of `areaToFocus`). */
export function focusToArea(
  focus: CropFocus,
  zoom: number,
  imageAspect: number,
  frameAspect: number,
): VisibleArea {
  const { w, h } = visibleFractions(zoom, imageAspect, frameAspect)
  return { x: clamp01(focus.cropX) * (1 - w), y: clamp01(focus.cropY) * (1 - h), width: w, height: h }
}

/** What the dialog writes back to the layer's image style. */
export function areaToStyleCrop(area: VisibleArea, zoom: number): CropFocus & { zoom: number; fit: 'cover' } {
  return { ...areaToFocus(area), zoom: clampImageZoom(zoom), fit: 'cover' }
}
