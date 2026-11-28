/** Face-aware protected zone from the browser's native FaceDetector (where it exists). Detects face POSITIONS only: no identification. */
export interface Box { x: number; y: number; w: number; h: number }
type FD = { detect: (src: CanvasImageSource) => Promise<{ boundingBox: { x: number; y: number; width: number; height: number } }[]> }

export const nativeFaceDetectorAvailable = (): boolean => typeof (globalThis as { FaceDetector?: unknown }).FaceDetector !== 'undefined'

export async function detectFaceBoxes(source: CanvasImageSource, w: number, h: number): Promise<Box[]> {
  const Ctor = (globalThis as { FaceDetector?: new (o?: object) => FD }).FaceDetector
  if (!Ctor) return []
  const faces = await new Ctor({ fastMode: true, maxDetectedFaces: 6 }).detect(source)
  return faces.map((f) => ({ x: f.boundingBox.x / w, y: f.boundingBox.y / h, w: f.boundingBox.width / w, h: f.boundingBox.height / h }))
}

/** Maps a box in source-frame fractions to composition fractions when the footage is drawn with object-fit: cover. */
export function coverMapBox(b: Box, srcW: number, srcH: number, compW: number, compH: number): Box {
  const s = Math.max(compW / srcW, compH / srcH)
  const offX = (srcW * s - compW) / 2, offY = (srcH * s - compH) / 2
  return { x: (b.x * srcW * s - offX) / compW, y: (b.y * srcH * s - offY) / compH, w: (b.w * srcW * s) / compW, h: (b.h * srcH * s) / compH }
}

/** One padded zone around every face seen in any sampled frame, clipped to the frame. Null when no face is visible in the frame. */
export function unionFaceZone(boxes: Box[], pad = 0.25): Box | null {
  if (!boxes.length) return null
  const x0 = Math.min(...boxes.map((b) => b.x)), y0 = Math.min(...boxes.map((b) => b.y))
  const x1 = Math.max(...boxes.map((b) => b.x + b.w)), y1 = Math.max(...boxes.map((b) => b.y + b.h))
  const pw = (x1 - x0) * pad, ph = (y1 - y0) * pad
  const x = Math.max(0, x0 - pw), y = Math.max(0, y0 - ph)
  const w = Math.min(1, x1 + pw) - x, h = Math.min(1, y1 + ph) - y
  return w > 0.01 && h > 0.01 ? { x, y, w, h } : null
}
