/**
 * Pure math for presenter masks. A mask is a low-resolution alpha map (0 = background, 255 = presenter)
 * measured from one video frame. Nothing here touches the DOM, so all of it is unit-tested.
 */
export interface Mask {
  w: number
  h: number
  data: Uint8ClampedArray
}

/** Blends the previous frame's mask into this one so edges do not flicker. keep = how much of the past to keep (0..1). */
export function smoothMask(prev: Mask | null, cur: Mask, keep: number): Mask {
  if (!prev || prev.w !== cur.w || prev.h !== cur.h || keep <= 0) return cur
  const k = Math.min(0.9, keep)
  const out = new Uint8ClampedArray(cur.data.length)
  for (let i = 0; i < out.length; i++) out[i] = prev.data[i] * k + cur.data[i] * (1 - k)
  return { w: cur.w, h: cur.h, data: out }
}

/** Linear blend between two masks of the same size (t = 0 gives a, t = 1 gives b). */
export function lerpMask(a: Mask, b: Mask, t: number): Mask {
  if (a.w !== b.w || a.h !== b.h || t <= 0) return a
  if (t >= 1) return b
  const out = new Uint8ClampedArray(a.data.length)
  for (let i = 0; i < out.length; i++) out[i] = a.data[i] + (b.data[i] - a.data[i]) * t
  return { w: a.w, h: a.h, data: out }
}

/** Which two stored masks surround a time, and how far between them. Masks are stored at `maskFps`. */
export function maskIndexAt(timeSec: number, maskFps: number, count: number): { i0: number; i1: number; t: number } {
  if (count <= 0) return { i0: 0, i1: 0, t: 0 }
  const pos = Math.max(0, timeSec * maskFps)
  const i0 = Math.min(count - 1, Math.floor(pos))
  const i1 = Math.min(count - 1, i0 + 1)
  return { i0, i1, t: i1 === i0 ? 0 : Math.min(1, pos - i0) }
}

const smoothstep = (lo: number, hi: number, x: number): number => {
  if (hi <= lo) return x >= lo ? 1 : 0
  const t = Math.min(1, Math.max(0, (x - lo) / (hi - lo)))
  return t * t * (3 - 2 * t)
}

function boxBlur(src: Uint8ClampedArray, w: number, h: number, radius: number): Uint8ClampedArray {
  if (radius < 1) return src
  const tmp = new Float32Array(src.length)
  const out = new Uint8ClampedArray(src.length)
  const span = radius * 2 + 1
  for (let y = 0; y < h; y++) {
    let acc = 0
    const row = y * w
    for (let x = -radius; x <= radius; x++) acc += src[row + Math.min(w - 1, Math.max(0, x))]
    for (let x = 0; x < w; x++) {
      tmp[row + x] = acc / span
      acc += src[row + Math.min(w - 1, x + radius + 1)] - src[row + Math.max(0, x - radius)]
    }
  }
  for (let x = 0; x < w; x++) {
    let acc = 0
    for (let y = -radius; y <= radius; y++) acc += tmp[Math.min(h - 1, Math.max(0, y)) * w + x]
    for (let y = 0; y < h; y++) {
      out[y * w + x] = acc / span
      acc += tmp[Math.min(h - 1, y + radius + 1) * w + x] - tmp[Math.max(0, y - radius) * w + x]
    }
  }
  return out
}

/**
 * Edge refinement. `shift` > 0 pulls the edge inward (removes a halo), < 0 pushes it outward (recovers hair).
 * `feather` softens the transition. With both at 0 the mask is returned untouched.
 */
export function refineMask(mask: Mask, opts: { feather: number; shift: number }): Mask {
  const feather = Math.min(1, Math.max(0, opts.feather))
  const shift = Math.min(1, Math.max(-1, opts.shift))
  if (feather === 0 && shift === 0) return mask
  const blurred = boxBlur(mask.data, mask.w, mask.h, Math.round(feather * 3))
  const center = 0.5 + shift * 0.3
  const half = 0.1 + feather * 0.3
  const out = new Uint8ClampedArray(blurred.length)
  for (let i = 0; i < out.length; i++) out[i] = smoothstep(center - half, center + half, blurred[i] / 255) * 255
  return { w: mask.w, h: mask.h, data: out }
}

/** Where `object-fit: cover` draws a source of size (sw, sh) inside a box of size (dw, dh). */
export function coverRect(sw: number, sh: number, dw: number, dh: number): { x: number; y: number; w: number; h: number } {
  if (sw <= 0 || sh <= 0) return { x: 0, y: 0, w: dw, h: dh }
  const scale = Math.max(dw / sw, dh / sh)
  const w = sw * scale
  const h = sh * scale
  return { x: (dw - w) / 2, y: (dh - h) / 2, w, h }
}

/** Where `object-fit: contain` draws a source of size (sw, sh) inside a box of size (dw, dh): the whole picture, centered. */
export function containRect(sw: number, sh: number, dw: number, dh: number): { x: number; y: number; w: number; h: number } {
  if (sw <= 0 || sh <= 0) return { x: 0, y: 0, w: dw, h: dh }
  const scale = Math.min(dw / sw, dh / sh)
  const w = sw * scale
  const h = sh * scale
  return { x: (dw - w) / 2, y: (dh - h) / 2, w, h }
}

/** Largest (w, h) that keeps aspect and fits within `maxSide` on the long side. */
export function fitWithin(w: number, h: number, maxSide: number): { w: number; h: number } {
  const longSide = Math.max(w, h)
  if (longSide <= maxSide) return { w, h }
  const s = maxSide / longSide
  return { w: Math.max(1, Math.round(w * s)), h: Math.max(1, Math.round(h * s)) }
}
