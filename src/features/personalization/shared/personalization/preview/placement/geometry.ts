import type { LumaSample, NormRect, PxRect } from './types'

export const SAFE_MARGIN = 0.02

export function area(r: PxRect): number {
  return Math.max(0, r.width) * Math.max(0, r.height)
}

export function intersectionArea(a: PxRect, b: PxRect): number {
  const w = Math.min(a.left + a.width, b.left + b.width) - Math.max(a.left, b.left)
  const h = Math.min(a.top + a.height, b.top + b.height) - Math.max(a.top, b.top)
  return w > 0 && h > 0 ? w * h : 0
}

export function zoneToPx(z: NormRect, width: number, height: number): PxRect {
  return { left: z.x * width, top: z.y * height, width: z.w * width, height: z.h * height }
}

/** True when the rect leaves the frame's safe area. */
export function outsideSafeArea(r: PxRect, width: number, height: number): boolean {
  const mx = width * SAFE_MARGIN - 1
  const my = height * SAFE_MARGIN - 1
  return r.left < mx || r.top < my || r.left + r.width > width - mx || r.top + r.height > height - my
}

/** WCAG relative luminance of an sRGB hex color (#rgb or #rrggbb). Unknown => 1 (white). */
export function hexLuminance(hex: string | undefined): number {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec((hex ?? '').trim())
  if (!m) return 1
  let h = m[1]
  if (h.length === 3) h = h.split('').map((c) => c + c).join('')
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255)
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
}

/** Mean relative luminance of the sample cells a rect covers, per sample. */
export function regionLuminance(
  sample: LumaSample,
  rect: PxRect,
  width: number,
  height: number,
): number | null {
  const c0 = Math.max(0, Math.floor((rect.left / width) * sample.cols))
  const c1 = Math.min(sample.cols - 1, Math.ceil(((rect.left + rect.width) / width) * sample.cols) - 1)
  const r0 = Math.max(0, Math.floor((rect.top / height) * sample.rows))
  const r1 = Math.min(sample.rows - 1, Math.ceil(((rect.top + rect.height) / height) * sample.rows) - 1)
  if (c1 < c0 || r1 < r0) return null
  let sum = 0
  let n = 0
  for (let r = r0; r <= r1; r++) {
    for (let c = c0; c <= c1; c++) {
      const v = sample.luma[r * sample.cols + c]
      if (typeof v === 'number') {
        // sRGB luma -> approximate relative luminance
        sum += v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
        n++
      }
    }
  }
  return n ? sum / n : null
}

/** WCAG contrast ratio between two relative luminances. */
export function contrastRatio(a: number, b: number): number {
  const hi = Math.max(a, b)
  const lo = Math.min(a, b)
  return (hi + 0.05) / (lo + 0.05)
}

/** A rect grown by `px` on every side (a shadow's footprint). */
/** The half of the frame a Split Screen panel takes (before its diagonal lean). */
export function splitPanelRect(side: 'left' | 'right' | 'top' | 'bottom' | undefined, width: number, height: number): PxRect {
  const horizontal = side === 'left' || side === 'right'
  return {
    left: side === 'right' ? width / 2 : 0, top: side === 'bottom' ? height / 2 : 0,
    width: horizontal ? width / 2 : width, height: horizontal ? height : height / 2,
  }
}

export function inflate(r: PxRect, px: number): PxRect {
  return px > 0 ? { left: r.left - px, top: r.top - px, width: r.width + 2 * px, height: r.height + 2 * px } : r
}
