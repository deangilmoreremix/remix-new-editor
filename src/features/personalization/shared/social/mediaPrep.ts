/** Pure geometry/size math for reframing, trimming and compression. */
import { ASPECTS, type AspectKey } from './platformConfig'

export type FitMode = 'fit' | 'fill'

export interface Reframe {
  /** Output canvas size. */
  out: { w: number; h: number }
  /** Source rectangle to read. */
  sx: number; sy: number; sw: number; sh: number
  /** Destination rectangle to draw into. */
  dx: number; dy: number; dw: number; dh: number
}

/**
 * Compute draw rects to reframe a source into an aspect.
 * - fit: whole source visible, letterboxed (never crops).
 * - fill: output fully covered, cropping the overflow.
 * `focus` (0..1, default centred) repositions the crop window for 'fill'.
 */
export function computeReframe(srcW: number, srcH: number, aspect: AspectKey, mode: FitMode, focus = { x: 0.5, y: 0.5 }, longEdge?: number): Reframe {
  if (!(srcW > 0 && srcH > 0)) throw new Error('Source size must be positive.')
  const a = ASPECTS[aspect]
  const base = a.size
  const scale = longEdge ? longEdge / Math.max(base.w, base.h) : 1
  const out = { w: even(base.w * scale), h: even(base.h * scale) }
  const clamp = (v: number) => Math.min(1, Math.max(0, v))
  if (mode === 'fit') {
    const k = Math.min(out.w / srcW, out.h / srcH)
    const dw = srcW * k, dh = srcH * k
    return { out, sx: 0, sy: 0, sw: srcW, sh: srcH, dx: (out.w - dw) / 2, dy: (out.h - dh) / 2, dw, dh }
  }
  const k = Math.max(out.w / srcW, out.h / srcH)
  const sw = out.w / k, sh = out.h / k
  return { out, sx: (srcW - sw) * clamp(focus.x), sy: (srcH - sh) * clamp(focus.y), sw, sh, dx: 0, dy: 0, dw: out.w, dh: out.h }
}

/** Video encoders need even dimensions. */
export const even = (n: number) => Math.max(2, Math.round(n / 2) * 2)

export interface TrimRange { start: number; end: number }

export function clampTrim(range: TrimRange, duration: number, minLength = 0.5): TrimRange {
  let start = Math.min(Math.max(0, range.start), Math.max(0, duration - minLength))
  const end = Math.min(Math.max(range.end, start + minLength), duration)
  if (end - start < minLength) start = Math.max(0, end - minLength)
  return { start, end }
}

export const TRIM_PRESETS: { id: string; label: string; seconds: number }[] = [
  { id: '15', label: '15s', seconds: 15 }, { id: '30', label: '30s', seconds: 30 }, { id: '60', label: '60s (Reels/Shorts)', seconds: 60 }, { id: '90', label: '90s', seconds: 90 },
]

export function presetTrim(preset: number, duration: number, from = 0): TrimRange {
  return clampTrim({ start: from, end: from + preset }, duration)
}

export const COMPRESSION_PRESETS = {
  high: { label: 'High quality', videoKbps: 8000, audioKbps: 192, imageQuality: 0.92 },
  balanced: { label: 'Balanced', videoKbps: 4000, audioKbps: 128, imageQuality: 0.82 },
  small: { label: 'Small file', videoKbps: 1800, audioKbps: 96, imageQuality: 0.7 },
} as const
export type CompressionPreset = keyof typeof COMPRESSION_PRESETS

/** Rough output size estimate (bytes): bitrate × duration. An estimate, not a promise. */
export function estimateVideoBytes(preset: CompressionPreset, seconds: number): number {
  const p = COMPRESSION_PRESETS[preset]
  return Math.round(((p.videoKbps + p.audioKbps) * 1000 / 8) * seconds)
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 ** 2) return `${(n / 1024).toFixed(1)} KB`
  if (n < 1024 ** 3) return `${(n / 1024 ** 2).toFixed(1)} MB`
  return `${(n / 1024 ** 3).toFixed(2)} GB`
}

/** Scale (w,h) down so the long edge ≤ max; never upscales. */
export function limitResolution(w: number, h: number, maxLongEdge: number): { w: number; h: number } {
  const k = Math.min(1, maxLongEdge / Math.max(w, h))
  return { w: even(w * k), h: even(h * k) }
}
