/**
 * Pure geometry for a picture drawn "cover" style into a box (the same maths the renderer uses for the
 * background). The designer shows a cropped view of the background, but an edit mask has to be made in the
 * picture's own pixels, so pointer positions are mapped back through the crop here.
 */

export interface CoverFit {
  /** Box pixels per picture pixel. */
  scale: number
  /** Where the picture's top-left corner lands in the box (negative when it is cropped). */
  dx: number
  dy: number
  /** The picture's size in box pixels. */
  drawW: number
  drawH: number
}

export function coverFit(imgW: number, imgH: number, boxW: number, boxH: number): CoverFit {
  const w = Math.max(1, imgW)
  const h = Math.max(1, imgH)
  const scale = Math.max(boxW / w, boxH / h)
  const drawW = w * scale
  const drawH = h * scale
  return { scale, dx: (boxW - drawW) / 2, dy: (boxH - drawH) / 2, drawW, drawH }
}

/** A point in the box (canvas pixels) to the matching point in the picture's own pixels, clamped to the picture. */
export function boxToImagePoint(fit: CoverFit, imgW: number, imgH: number, x: number, y: number): { x: number; y: number } {
  return {
    x: Math.min(imgW, Math.max(0, (x - fit.dx) / fit.scale)),
    y: Math.min(imgH, Math.max(0, (y - fit.dy) / fit.scale)),
  }
}

export function imageToBoxPoint(fit: CoverFit, x: number, y: number): { x: number; y: number } {
  return { x: x * fit.scale + fit.dx, y: y * fit.scale + fit.dy }
}

/** A pointer event position (client pixels) inside the on-screen element to box pixels. */
export function clientToBoxPoint(rect: { left: number; top: number; width: number; height: number }, boxW: number, boxH: number, clientX: number, clientY: number): { x: number; y: number } {
  return { x: ((clientX - rect.left) / Math.max(1, rect.width)) * boxW, y: ((clientY - rect.top) / Math.max(1, rect.height)) * boxH }
}

/** The part of the picture (in its own pixels) that is visible in the box. */
export function visibleImageRect(fit: CoverFit, imgW: number, imgH: number, boxW: number, boxH: number): { x: number; y: number; w: number; h: number } {
  const x = Math.max(0, -fit.dx / fit.scale)
  const y = Math.max(0, -fit.dy / fit.scale)
  return { x, y, w: Math.min(imgW - x, boxW / fit.scale), h: Math.min(imgH - y, boxH / fit.scale) }
}
