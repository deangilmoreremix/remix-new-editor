/**
 * Helpers for the thumbnail editor's drawing tools. Strokes are stored in the
 * image's own pixel coordinates so the result does not depend on how large the
 * preview is on screen.
 */
export interface Stroke {
  points: { x: number; y: number }[]
  size: number
  erase: boolean
}

function trace(ctx: CanvasRenderingContext2D, stroke: Stroke) {
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.lineWidth = stroke.size
  ctx.beginPath()
  stroke.points.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)))
  if (stroke.points.length === 1) ctx.lineTo(stroke.points[0].x + 0.01, stroke.points[0].y)
  ctx.stroke()
}

/** Paint the strokes on a canvas (overlay in mask mode: translucent cyan; markup: solid red). */
export function drawStrokes(ctx: CanvasRenderingContext2D, strokes: Stroke[], color: string) {
  for (const s of strokes) {
    ctx.save()
    ctx.globalCompositeOperation = s.erase ? 'destination-out' : 'source-over'
    ctx.strokeStyle = color
    trace(ctx, s)
    ctx.restore()
  }
}

/**
 * OpenAI mask: an opaque image where the painted region is transparent
 * ("repaint here"); everything else stays opaque ("keep").
 */
export function strokesToMaskPng(width: number, height: number, strokes: Stroke[]): string {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Drawing is not supported in this browser.')
  ctx.fillStyle = '#000'
  ctx.fillRect(0, 0, width, height)
  for (const s of strokes) {
    ctx.save()
    // Painting makes pixels transparent; the eraser puts the opaque "keep" layer back.
    ctx.globalCompositeOperation = s.erase ? 'source-over' : 'destination-out'
    ctx.strokeStyle = '#000'
    trace(ctx, s)
    ctx.restore()
  }
  return canvas.toDataURL('image/png')
}

/** The image with the user's markup drawn on it, as a PNG data URL. */
export function composeMarkup(img: HTMLImageElement, strokes: Stroke[]): string {
  const canvas = document.createElement('canvas')
  canvas.width = img.naturalWidth
  canvas.height = img.naturalHeight
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Drawing is not supported in this browser.')
  ctx.drawImage(img, 0, 0)
  // Strokes go on their own transparent layer first, so the eraser removes only markup (never the picture).
  const overlay = document.createElement('canvas')
  overlay.width = img.naturalWidth
  overlay.height = img.naturalHeight
  const octx = overlay.getContext('2d')
  if (!octx) throw new Error('Drawing is not supported in this browser.')
  drawStrokes(octx, strokes, '#ff2d2d')
  ctx.drawImage(overlay, 0, 0)
  return canvas.toDataURL('image/png')
}

export const MARKUP_INSTRUCTION =
  'The image has red markup drawn on it that shows the edits to make. Apply those edits, then remove all of the red markup completely and keep everything else exactly as it is.'
