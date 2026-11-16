/**
 * Export a design to an image that meets a file-size target (YouTube thumbnails must be under 2 MB).
 * `encodeWithinBytes` is separate and takes the encoder as an argument so it can be tested without a canvas.
 */
import { renderProject, type RenderAssets } from './render'
import type { DesignProject } from './model'

export type ExportFormat = 'image/png' | 'image/jpeg' | 'image/webp'
export type Encoder = (type: ExportFormat, quality?: number) => Promise<Blob | null>

export const EXPORT_QUALITIES = [0.95, 0.9, 0.85, 0.8, 0.7, 0.6, 0.5, 0.4] as const

export interface Encoded {
  blob: Blob
  type: ExportFormat
  quality?: number
}

/**
 * Smallest-loss encoding that fits `maxBytes`. PNG is tried first when asked for (lossless); if it is too
 * big, JPEG qualities are tried from best to worst. Returns null when nothing fits (the caller then scales down).
 */
export async function encodeWithinBytes(encode: Encoder, wanted: ExportFormat, maxBytes: number | null): Promise<Encoded | null> {
  if (wanted === 'image/png') {
    const png = await encode('image/png')
    if (png && (maxBytes === null || png.size <= maxBytes)) return { blob: png, type: 'image/png' }
    if (maxBytes === null) return null
  }
  const lossy: ExportFormat = wanted === 'image/webp' ? 'image/webp' : 'image/jpeg'
  for (const q of EXPORT_QUALITIES) {
    const blob = await encode(lossy, q)
    if (blob && (maxBytes === null || blob.size <= maxBytes)) return { blob, type: lossy, quality: q }
  }
  return null
}

export interface ExportOptions {
  format: ExportFormat
  /** File-size target in bytes (null = no target). */
  maxBytes: number | null
  /** Output width in pixels (height follows the aspect ratio); defaults to the project size. */
  width?: number
}

export interface ExportResult extends Encoded {
  width: number
  height: number
  dataUrl: string
  /** True when the picture had to be made smaller to fit the size target. */
  scaledDown: boolean
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}

/** Render the project at the requested width and encode it; shrinks by 15% steps (down to 40%) if the size target is missed. */
export async function exportProject(p: DesignProject, assets: RenderAssets, opts: ExportOptions): Promise<ExportResult> {
  const targetW = Math.max(16, Math.round(opts.width ?? p.width))
  let scale = targetW / p.width
  let scaledDown = false
  for (let attempt = 0; attempt < 8; attempt++) {
    const w = Math.max(16, Math.round(p.width * scale))
    const h = Math.max(16, Math.round(p.height * scale))
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Drawing is not supported in this browser.')
    ctx.scale(w / p.width, h / p.height)
    renderProject(ctx, p, assets)
    const encoded = await encodeWithinBytes((type, q) => new Promise((res) => canvas.toBlob(res, type, q)), opts.format, opts.maxBytes)
    if (encoded) return { ...encoded, width: w, height: h, dataUrl: await blobToDataUrl(encoded.blob), scaledDown }
    scale *= 0.85
    scaledDown = true
    if (scale < targetW / p.width * 0.4) break
  }
  throw new Error('The thumbnail could not be made small enough. Try a smaller size or fewer effects.')
}
