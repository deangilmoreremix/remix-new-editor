/**
 * One image operation (reframe to an aspect and/or limit the size, then encode), written against small injected dependencies so the SAME code runs
 * in a Web Worker (OffscreenCanvas, off the main thread) and, as a fallback, on the main thread.
 */
import { computeReframe, limitResolution, type FitMode } from './mediaPrep'
import type { AspectKey } from './platformConfig'

export interface ImageOpParams {
  aspect?: AspectKey
  mode?: FitMode
  focus?: { x: number; y: number }
  /** Longest edge in pixels; never upscales. */
  longEdge?: number
  mime?: 'image/jpeg' | 'image/png' | 'image/webp'
  quality?: number
  background?: string
}

export interface ProcessedImage { blob: Blob; width: number; height: number }

export interface ImageDeps {
  decode: (b: Blob) => Promise<{ width: number; height: number; close?: () => void }>
  canvas: (w: number, h: number) => any
  encode: (canvas: any, mime: string, quality: number) => Promise<Blob>
}

export async function processImage(blob: Blob, p: ImageOpParams, deps: ImageDeps): Promise<ProcessedImage> {
  const img = await deps.decode(blob)
  try {
    let out: { w: number; h: number }
    let src = { sx: 0, sy: 0, sw: img.width, sh: img.height }
    let dst = { dx: 0, dy: 0, dw: 0, dh: 0 }
    if (p.aspect) {
      const r = computeReframe(img.width, img.height, p.aspect, p.mode ?? 'fit', p.focus, p.longEdge)
      out = r.out; src = { sx: r.sx, sy: r.sy, sw: r.sw, sh: r.sh }; dst = { dx: r.dx, dy: r.dy, dw: r.dw, dh: r.dh }
    } else {
      out = p.longEdge ? limitResolution(img.width, img.height, p.longEdge) : { w: img.width, h: img.height }
      dst = { dx: 0, dy: 0, dw: out.w, dh: out.h }
    }
    const canvas = deps.canvas(out.w, out.h)
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Canvas is not available here.')
    // JPEG has no transparency: paint a background first so transparent areas don't turn black.
    ctx.fillStyle = p.background ?? (p.mime === 'image/png' ? 'rgba(0,0,0,0)' : '#000')
    if ((p.mime ?? 'image/jpeg') !== 'image/png' || p.aspect) ctx.fillRect(0, 0, out.w, out.h)
    ctx.drawImage(img, src.sx, src.sy, src.sw, src.sh, dst.dx, dst.dy, dst.dw, dst.dh)
    const blobOut = await deps.encode(canvas, p.mime ?? 'image/jpeg', p.quality ?? 0.85)
    return { blob: blobOut, width: out.w, height: out.h }
  } finally {
    img.close?.()
  }
}

/** Browser dependencies: OffscreenCanvas when present (always in a worker), otherwise a DOM canvas. */
export function browserImageDeps(): ImageDeps {
  const g = globalThis as any
  return {
    decode: (b) => g.createImageBitmap(b),
    canvas: (w, h) => (typeof g.OffscreenCanvas === 'function' ? new g.OffscreenCanvas(w, h) : Object.assign(g.document.createElement('canvas'), { width: w, height: h })),
    encode: (c, mime, quality) =>
      typeof c.convertToBlob === 'function'
        ? c.convertToBlob({ type: mime, quality })
        : new Promise<Blob>((res, rej) => c.toBlob((b: Blob | null) => (b ? res(b) : rej(new Error('Could not encode the image.'))), mime, quality)),
  }
}

// ---- worker message protocol (kept here so the worker file and the client share it) ----
export interface WorkerRequest { id: number; blob: Blob; params: ImageOpParams }
export type WorkerReply = { id: number; type: 'done'; blob: Blob; width: number; height: number } | { id: number; type: 'error'; message: string }

/** What the worker does for one message. Never throws: errors become a reply. */
export async function handleWorkerRequest(req: WorkerRequest, deps: ImageDeps = browserImageDeps()): Promise<WorkerReply> {
  try {
    const out = await processImage(req.blob, req.params, deps)
    return { id: req.id, type: 'done', blob: out.blob, width: out.width, height: out.height }
  } catch (e: any) {
    return { id: req.id, type: 'error', message: String(e?.message ?? e).slice(0, 300) }
  }
}
