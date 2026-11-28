import { grabFramePixels } from '../localAI/engine'
import type { LumaFrame } from './sceneDetect'
import { sharpnessScore } from './imageIntel'

export interface VideoProbe { width: number; height: number; duration: number }

/** Reads size and duration from the file's own metadata. Returns null when the browser cannot play the codec. */
export function probeVideo(url: string, timeoutMs = 8000): Promise<VideoProbe | null> {
  return new Promise((resolve) => {
    const v = document.createElement('video')
    v.preload = 'metadata'; v.muted = true; v.crossOrigin = 'anonymous'
    const done = (r: VideoProbe | null) => { clearTimeout(timer); v.removeAttribute('src'); v.load(); resolve(r) }
    const timer = setTimeout(() => done(null), timeoutMs)
    v.onloadedmetadata = () => done(v.videoWidth && Number.isFinite(v.duration) ? { width: v.videoWidth, height: v.videoHeight, duration: v.duration } : null)
    v.onerror = () => done(null)
    v.src = url
  })
}

const GRID_W = 32, GRID_H = 18

function toLumaGrid(f: { width: number; height: number; data: Uint8ClampedArray }): Uint8Array {
  const out = new Uint8Array(GRID_W * GRID_H)
  const cnt = new Uint16Array(GRID_W * GRID_H)
  const acc = new Float32Array(GRID_W * GRID_H)
  for (let y = 0; y < f.height; y++) for (let x = 0; x < f.width; x++) {
    const gi = Math.min(GRID_H - 1, Math.floor((y * GRID_H) / f.height)) * GRID_W + Math.min(GRID_W - 1, Math.floor((x * GRID_W) / f.width))
    const i = (y * f.width + x) * 4
    acc[gi]! += 0.299 * f.data[i]! + 0.587 * f.data[i + 1]! + 0.114 * f.data[i + 2]!
    cnt[gi]!++
  }
  for (let i = 0; i < out.length; i++) out[i] = cnt[i] ? Math.round(acc[i]! / cnt[i]!) : 0
  return out
}

export interface VideoSample { lumaFrames: LumaFrame[]; sharpness: number[]; meanBrightness: number }

/** Samples up to `count` frames evenly across the video (cancellable). Fully local; no model, no upload. */
export async function sampleVideo(url: string, duration: number, opts: { count?: number; signal?: AbortSignal; onProgress?: (done: number, total: number) => void } = {}): Promise<VideoSample> {
  const count = Math.max(3, Math.min(opts.count ?? 24, 60))
  const lumaFrames: LumaFrame[] = []
  const sharpness: number[] = []
  let bright = 0
  for (let i = 0; i < count; i++) {
    if (opts.signal?.aborted) throw Object.assign(new Error('Cancelled'), { name: 'AbortError' })
    const t = Math.min(duration - 0.05, (duration * (i + 0.5)) / count)
    try {
      const f = await grabFramePixels(url, Math.max(0, t), { maxSize: 160, signal: opts.signal })
      const luma = toLumaGrid(f)
      lumaFrames.push({ t, luma })
      bright += luma.reduce((s, v) => s + v, 0) / luma.length
      sharpness.push(sharpnessScore({ data: f.data, width: f.width, height: f.height }))
    } catch (e) {
      if ((e as { name?: string })?.name === 'AbortError') throw e
    }
    opts.onProgress?.(i + 1, count)
  }
  return { lumaFrames, sharpness, meanBrightness: lumaFrames.length ? bright / lumaFrames.length : 0 }
}
