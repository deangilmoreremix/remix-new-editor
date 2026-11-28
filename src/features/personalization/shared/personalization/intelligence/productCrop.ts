/** Turns object detections into a product crop. Pure; detection itself is the existing on-device detector. */
export interface Detection { label: string; score: number; box: { xmin: number; ymin: number; xmax: number; ymax: number } }
export interface PixelRect { x: number; y: number; w: number; h: number }

const PERSON = /person|people|man|woman|face/i

/**
 * Picks the most likely product (highest score x area, people excluded) and pads it. Returns null when nothing usable
 * was found or the box already covers nearly the whole picture (nothing to crop).
 */
export function productCropFromDetections(dets: Detection[], width: number, height: number, pad = 0.08): PixelRect | null {
  const usable = dets.filter((d) => d.score >= 0.4 && !PERSON.test(d.label) && d.box.xmax > d.box.xmin && d.box.ymax > d.box.ymin)
  if (!usable.length) return null
  const area = (d: Detection) => (d.box.xmax - d.box.xmin) * (d.box.ymax - d.box.ymin)
  const best = [...usable].sort((a, b) => b.score * area(b) - a.score * area(a))[0]!
  const bw = best.box.xmax - best.box.xmin, bh = best.box.ymax - best.box.ymin
  const x = Math.max(0, Math.floor(best.box.xmin - bw * pad)), y = Math.max(0, Math.floor(best.box.ymin - bh * pad))
  const w = Math.min(width - x, Math.ceil(bw * (1 + 2 * pad))), h = Math.min(height - y, Math.ceil(bh * (1 + 2 * pad)))
  if (w < 32 || h < 32) return null
  if ((w * h) / (width * height) > 0.92) return null
  return { x, y, w, h }
}
