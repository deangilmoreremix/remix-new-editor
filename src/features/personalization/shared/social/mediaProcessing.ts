/**
 * Browser media processing: image reframe/compress, video frame capture, and
 * video trim/reframe/compress through mediabunny (lazy-loaded; it drives
 * WebCodecs and muxes real MP4/WebM, so WebCodecs alone is never assumed to
 * produce a playable file). Output must still be a format MuAPI accepts —
 * callers run `validateFileType` on the result.
 */
import { computeReframe, COMPRESSION_PRESETS, limitResolution, type CompressionPreset, type FitMode } from './mediaPrep'
import type { AspectKey } from './platformConfig'

export class MediaUnsupportedError extends Error { constructor(m: string) { super(m); this.name = 'MediaUnsupportedError' } }
export class MediaCancelledError extends Error { constructor() { super('Cancelled'); this.name = 'MediaCancelledError' } }

const throwIfAborted = (s?: AbortSignal) => { if (s?.aborted) throw new MediaCancelledError() }

function makeCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  return c
}
const toBlob = (c: HTMLCanvasElement, type: string, quality?: number) =>
  new Promise<Blob>((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('Could not encode the image.'))), type, quality))

async function loadImage(src: Blob | string): Promise<{ img: HTMLImageElement; release: () => void }> {
  const url = typeof src === 'string' ? src : URL.createObjectURL(src)
  const img = new Image()
  img.crossOrigin = 'anonymous'
  img.decoding = 'async'
  await new Promise<void>((res, rej) => { img.onload = () => res(); img.onerror = () => rej(new Error('The image could not be loaded.')); img.src = url })
  return { img, release: () => { if (typeof src !== 'string') URL.revokeObjectURL(url); img.src = '' } }
}

export async function reframeImage(src: Blob | string, aspect: AspectKey, mode: FitMode, opts: { focus?: { x: number; y: number }; mime?: 'image/jpeg' | 'image/png' | 'image/webp'; quality?: number; longEdge?: number; background?: string; signal?: AbortSignal } = {}): Promise<Blob> {
  const { img, release } = await loadImage(src)
  try {
    throwIfAborted(opts.signal)
    const r = computeReframe(img.naturalWidth, img.naturalHeight, aspect, mode, opts.focus, opts.longEdge)
    const c = makeCanvas(r.out.w, r.out.h)
    const ctx = c.getContext('2d')
    if (!ctx) throw new MediaUnsupportedError('Canvas is not available.')
    ctx.fillStyle = opts.background ?? '#000'
    ctx.fillRect(0, 0, c.width, c.height)
    ctx.drawImage(img, r.sx, r.sy, r.sw, r.sh, r.dx, r.dy, r.dw, r.dh)
    return await toBlob(c, opts.mime ?? 'image/jpeg', opts.quality ?? 0.9)
  } finally { release() }
}

export async function compressImage(src: Blob | string, preset: CompressionPreset, maxLongEdge = 2048, signal?: AbortSignal): Promise<{ blob: Blob; width: number; height: number }> {
  const { img, release } = await loadImage(src)
  try {
    throwIfAborted(signal)
    const { w, h } = limitResolution(img.naturalWidth, img.naturalHeight, maxLongEdge)
    const c = makeCanvas(w, h)
    c.getContext('2d')?.drawImage(img, 0, 0, w, h)
    return { blob: await toBlob(c, 'image/jpeg', COMPRESSION_PRESETS[preset].imageQuality), width: w, height: h }
  } finally { release() }
}

export interface VideoMeta { width: number; height: number; duration: number }

/** Read metadata and (optionally) capture a frame, then release the element and object URL. */
export async function probeVideo(src: Blob | string, frameAt?: number): Promise<VideoMeta & { frame?: Blob }> {
  const url = typeof src === 'string' ? src : URL.createObjectURL(src)
  const v = document.createElement('video')
  v.muted = true
  v.preload = 'auto'
  v.crossOrigin = 'anonymous'
  v.playsInline = true
  const cleanup = () => { v.removeAttribute('src'); v.load(); if (typeof src !== 'string') URL.revokeObjectURL(url) }
  try {
    await new Promise<void>((res, rej) => { v.onloadedmetadata = () => res(); v.onerror = () => rej(new Error('The video could not be read in this browser.')); v.src = url })
    const meta = { width: v.videoWidth, height: v.videoHeight, duration: v.duration }
    if (frameAt === undefined) return meta
    v.currentTime = Math.min(Math.max(0, frameAt), Math.max(0, v.duration - 0.05))
    await new Promise<void>((res, rej) => { v.onseeked = () => res(); v.onerror = () => rej(new Error('Could not seek to that frame.')) })
    const c = makeCanvas(meta.width, meta.height)
    c.getContext('2d')?.drawImage(v, 0, 0)
    return { ...meta, frame: await toBlob(c, 'image/png') }
  } finally { cleanup() }
}

export interface VideoJob {
  file: Blob
  trim?: { start: number; end: number }
  aspect?: AspectKey
  mode?: FitMode
  focus?: { x: number; y: number }
  preset?: CompressionPreset
  longEdge?: number
  onProgress?: (fraction: number) => void
  signal?: AbortSignal
}

/** Trim / reframe / compress a video to MP4 (H.264) or WebM, whichever this browser can encode. */
export async function processVideo(job: VideoJob): Promise<{ blob: Blob; mime: string; width: number; height: number }> {
  if (typeof VideoEncoder === 'undefined' || typeof VideoDecoder === 'undefined') {
    throw new MediaUnsupportedError('Video processing needs WebCodecs (Chrome, Edge or Safari 16.4+). You can still publish the original file.')
  }
  const mb = await import('mediabunny')
  const input = new mb.Input({ formats: mb.ALL_FORMATS, source: new mb.BlobSource(job.file) })
  const canMp4 = await mb.canEncodeVideo('avc')
  const canWebm = !canMp4 && (await mb.canEncodeVideo('vp9') || await mb.canEncodeVideo('vp8'))
  if (!canMp4 && !canWebm) throw new MediaUnsupportedError('This browser cannot encode H.264 or VP8/VP9 video.')
  const output = new mb.Output({ format: canMp4 ? new mb.Mp4OutputFormat() : new mb.WebMOutputFormat(), target: new mb.BufferTarget() })
  const preset = COMPRESSION_PRESETS[job.preset ?? 'balanced']
  const track = await input.getPrimaryVideoTrack()
  if (!track) throw new MediaUnsupportedError('No video track found in this file.')
  const sw = track.displayWidth, sh = track.displayHeight

  let video: Record<string, any> = { bitrate: preset.videoKbps * 1000 }
  if (job.aspect) {
    const r = computeReframe(sw, sh, job.aspect, job.mode ?? 'fit', job.focus, job.longEdge)
    video = job.mode === 'fill'
      ? { ...video, crop: { left: Math.round(r.sx), top: Math.round(r.sy), width: Math.round(r.sw), height: Math.round(r.sh) }, width: r.out.w, height: r.out.h, fit: 'fill' }
      : { ...video, width: r.out.w, height: r.out.h, fit: 'contain' }
  } else if (job.longEdge) {
    const l = limitResolution(sw, sh, job.longEdge)
    video = { ...video, width: l.w, height: l.h }
  }

  const conversion = await mb.Conversion.init({
    input,
    output,
    trim: job.trim ? { start: job.trim.start, end: job.trim.end } : undefined,
    video,
    audio: { bitrate: preset.audioKbps * 1000 },
  } as any)
  if (!conversion.isValid) throw new MediaUnsupportedError('This video could not be converted in the browser.')
  conversion.onProgress = (p: number) => job.onProgress?.(p)
  const onAbort = () => { void conversion.cancel() }
  job.signal?.addEventListener('abort', onAbort, { once: true })
  try {
    throwIfAborted(job.signal)
    await conversion.execute()
  } catch (e: any) {
    if (job.signal?.aborted || e?.name === 'ConversionCanceledError') throw new MediaCancelledError()
    throw e
  } finally {
    job.signal?.removeEventListener('abort', onAbort)
  }
  const buf = (output.target as any).buffer as ArrayBuffer | null
  if (!buf) throw new Error('Video processing produced no output.')
  const mime = canMp4 ? 'video/mp4' : 'video/webm'
  const out = job.aspect ? computeReframe(sw, sh, job.aspect, job.mode ?? 'fit', job.focus, job.longEdge).out : { w: sw, h: sh }
  return { blob: new Blob([buf], { type: mime }), mime, width: out.w, height: out.h }
}
