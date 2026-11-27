/**
 * Cheap, deterministic checks on an image's pixels so the styler does not put a
 * second frame on a picture that already has one. Pure: it takes RGBA bytes (the
 * browser loader draws the image to a small canvas) and returns hints. It does
 * NOT understand content — only transparent corners and a uniform coloured ring.
 */
import type { ImageHints } from './imageStyle'

export interface PixelAnalysis extends Pick<ImageHints, 'transparentCorners' | 'alreadyFramed' | 'hasTransparency' | 'lightLogo'> {
  /** Fraction of pixels that are (mostly) transparent. */
  transparentFraction: number
}

const lumaAt = (d: ArrayLike<number>, i: number) => 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]

export function analyzeImagePixels(data: ArrayLike<number>, width: number, height: number): PixelAnalysis {
  if (!(width > 2) || !(height > 2) || data.length < width * height * 4) {
    return { transparentCorners: false, alreadyFramed: false, hasTransparency: false, lightLogo: false, transparentFraction: 0 }
  }
  const at = (x: number, y: number) => (y * width + x) * 4

  let transparent = 0
  for (let i = 3; i < width * height * 4; i += 4) if (data[i] < 24) transparent++
  const transparentFraction = transparent / (width * height)

  // corners: a small patch at each of the four corners
  const patch = Math.max(1, Math.round(Math.min(width, height) * 0.03))
  const cornerTransparent = (cx: number, cy: number) => {
    let t = 0, n = 0
    for (let y = cy; y < cy + patch; y++) for (let x = cx; x < cx + patch; x++) { n++; if (data[at(x, y) + 3] < 24) t++ }
    return t / n > 0.85
  }
  const corners = [cornerTransparent(0, 0), cornerTransparent(width - patch, 0), cornerTransparent(0, height - patch), cornerTransparent(width - patch, height - patch)]
  const transparentCorners = corners.filter(Boolean).length >= 3

  // frame: a thin, uniform, non-white ring whose colour STOPS at the ring. The band just inside
  // it is compared with the ring: a solid backdrop continues inward (ring ≈ inner band), a
  // decorative frame does not (ring ≠ inner band). Plain white margins are never a frame.
  const band = Math.max(1, Math.round(Math.min(width, height) * 0.02))
  const innerFrom = Math.max(band + 1, Math.round(Math.min(width, height) * 0.05))
  const innerTo = Math.max(innerFrom + 1, Math.round(Math.min(width, height) * 0.09))
  const ring: number[] = []
  const inner: number[] = []
  for (let y = 0; y < height; y += 1) for (let x = 0; x < width; x += 1) {
    const o = at(x, y)
    if (data[o + 3] < 200) continue
    const d = Math.min(x, y, width - 1 - x, height - 1 - y) // distance to the nearest edge
    if (d < band) ring.push(lumaAt(data, o))
    else if (d >= innerFrom && d < innerTo) inner.push(lumaAt(data, o))
  }
  let alreadyFramed = false
  if (ring.length > 20 && inner.length > 20) {
    const mean = (a: number[]) => a.reduce((s, v) => s + v, 0) / a.length
    const rm = mean(ring)
    const rstd = Math.sqrt(ring.reduce((s, v) => s + (v - rm) ** 2, 0) / ring.length)
    const im = mean(inner)
    alreadyFramed = rstd < 6 && rm < 235 && Math.abs(rm - im) > 40
  }
  // A LIGHT logo: a cut-out (it has transparency) whose visible pixels are mostly very light. An opaque picture is never
  // called light, because its white background would dominate the average.
  const hasTransparency = transparentFraction > 0.02
  let lightLogo = false
  if (hasTransparency) {
    let sum = 0, n = 0
    for (let i = 0; i + 3 < width * height * 4; i += 4) if (data[i + 3] > 128) { sum += lumaAt(data, i); n++ }
    lightLogo = n > 20 && sum / n >= 190
  }
  return { transparentCorners, alreadyFramed, hasTransparency, lightLogo, transparentFraction }
}

export interface ContentBox {
  /** All four are fractions of the full image (0..1). */
  x: number
  y: number
  w: number
  h: number
}

/**
 * Bounding box of the visible (non-transparent) pixels, grown by a small margin, or null when trimming is not
 * worthwhile or not safe: no transparency to trim, nothing visible, content spanning nearly the whole image
 * (< `minRemoved` of the area would be removed), or content so small it is probably noise.
 * Pure: takes RGBA bytes. It never looks at colour, only alpha.
 */
export function transparentContentBox(
  data: ArrayLike<number>,
  width: number,
  height: number,
  opts: { alphaThreshold?: number; marginPct?: number; minRemoved?: number; minContent?: number } = {},
): ContentBox | null {
  const alphaThreshold = opts.alphaThreshold ?? 12
  const marginPct = opts.marginPct ?? 0.04
  const minRemoved = opts.minRemoved ?? 0.1
  const minContent = opts.minContent ?? 0.08
  if (!(width > 2) || !(height > 2) || data.length < width * height * 4) return null
  let minX = width, minY = height, maxX = -1, maxY = -1
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] > alphaThreshold) {
        if (x < minX) minX = x
        if (x > maxX) maxX = x
        if (y < minY) minY = y
        if (y > maxY) maxY = y
      }
    }
  }
  if (maxX < 0) return null // fully transparent
  const cw = maxX - minX + 1
  const ch = maxY - minY + 1
  if (cw / width < minContent || ch / height < minContent) return null // probably a speck of noise
  const mx = Math.round(Math.max(cw, ch) * marginPct)
  const x0 = Math.max(0, minX - mx)
  const y0 = Math.max(0, minY - mx)
  const x1 = Math.min(width, maxX + 1 + mx)
  const y1 = Math.min(height, maxY + 1 + mx)
  const area = ((x1 - x0) * (y1 - y0)) / (width * height)
  if (1 - area < minRemoved) return null
  return { x: x0 / width, y: y0 / height, w: (x1 - x0) / width, h: (y1 - y0) / height }
}
