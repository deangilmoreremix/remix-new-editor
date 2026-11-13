/**
 * Measures real frames of the customer's footage in the browser (canvas only —
 * no network service, no detection model). It yields luminance grids the
 * placement engine uses for contrast checks.
 *
 * Honest failure: if the video cannot be read (cross-origin without CORS,
 * codec, timeout) the sampler returns `null`, and the quality check reports
 * "readability not verified" instead of guessing.
 */
import type { LumaSample } from './types'

/** sRGB luma (Rec. 709 weights) of an RGBA buffer, as a cols×rows grid in 0..1. */
export function lumaGridFromRGBA(data: ArrayLike<number>, cols: number, rows: number): number[] {
  const out: number[] = []
  for (let i = 0; i < cols * rows; i++) {
    const o = i * 4
    out.push((0.2126 * data[o] + 0.7152 * data[o + 1] + 0.0722 * data[o + 2]) / 255)
  }
  return out
}

/**
 * Representative times across a clip: the start, ten evenly spaced points and
 * the last moment. Deterministic.
 */
export function baseSampleTimes(durationSec: number): number[] {
  if (!Number.isFinite(durationSec) || durationSec <= 0) return [0]
  const times = [0]
  for (let i = 1; i <= 10; i++) times.push((durationSec * i) / 11)
  times.push(Math.max(0, durationSec - 0.1))
  return times.map((t) => Math.round(t * 1000) / 1000)
}

/** Mean absolute luma difference between two same-size grids (0..1). */
export function lumaDifference(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length)
  if (!n) return 0
  let sum = 0
  for (let i = 0; i < n; i++) sum += Math.abs(a[i] - b[i])
  return sum / n
}

/**
 * Midpoints to measure additionally where two neighbouring samples differ a
 * lot — a probable scene boundary or a fast camera move — so a change between
 * samples is not missed. One refinement pass, deterministic.
 */
export function refinementTimes(samples: LumaSample[], threshold = 0.18): number[] {
  const out: number[] = []
  for (let i = 1; i < samples.length; i++) {
    if (lumaDifference(samples[i - 1].luma, samples[i].luma) > threshold) {
      out.push(Math.round(((samples[i - 1].t + samples[i].t) / 2) * 1000) / 1000)
    }
  }
  return out
}

function seek(video: HTMLVideoElement, t: number, timeoutMs: number): Promise<boolean> {
  return new Promise((resolve) => {
    const done = (ok: boolean) => {
      video.removeEventListener('seeked', onSeeked)
      clearTimeout(timer)
      resolve(ok)
    }
    const onSeeked = () => done(true)
    const timer = setTimeout(() => done(false), timeoutMs)
    video.addEventListener('seeked', onSeeked)
    video.currentTime = t
  })
}

/**
 * Samples frames of `url` at `times` (seconds) into cols×rows luma grids.
 * Returns null when the footage cannot be read in this browser.
 */
export async function sampleFrames(
  url: string,
  options: { times?: number[]; cols?: number; rows?: number; timeoutMs?: number; refine?: boolean } = {},
): Promise<{ samples: LumaSample[]; durationSec: number } | null> {
  if (typeof document === 'undefined' || !url) return null
  const cols = options.cols ?? 32
  const rows = options.rows ?? 18
  const timeoutMs = options.timeoutMs ?? 6000
  const video = document.createElement('video')
  video.crossOrigin = 'anonymous'
  video.muted = true
  video.preload = 'auto'
  video.playsInline = true
  video.src = url
  try {
    const ready = await new Promise<boolean>((resolve) => {
      const timer = setTimeout(() => resolve(false), timeoutMs)
      video.addEventListener('loadeddata', () => { clearTimeout(timer); resolve(true) }, { once: true })
      video.addEventListener('error', () => { clearTimeout(timer); resolve(false) }, { once: true })
    })
    if (!ready) return null
    const durationSec = Number.isFinite(video.duration) ? video.duration : 0
    const canvas = document.createElement('canvas')
    canvas.width = cols
    canvas.height = rows
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) return null
    const grab = async (t: number): Promise<LumaSample | null> => {
      if (!(await seek(video, Math.min(t, Math.max(0, durationSec - 0.05)), timeoutMs))) return null
      ctx.drawImage(video, 0, 0, cols, rows)
      const { data } = ctx.getImageData(0, 0, cols, rows) // throws if the canvas is tainted
      return { t, cols, rows, luma: lumaGridFromRGBA(data, cols, rows) }
    }
    const samples: LumaSample[] = []
    for (const t of options.times ?? baseSampleTimes(durationSec)) {
      const s = await grab(t)
      if (s) samples.push(s)
    }
    if (options.refine !== false && samples.length > 1) {
      for (const t of refinementTimes(samples)) {
        const s = await grab(t)
        if (s) samples.push(s)
      }
      samples.sort((a, b) => a.t - b.t)
    }
    return samples.length ? { samples, durationSec } : null
  } catch {
    return null // tainted canvas, decode error…
  } finally {
    video.removeAttribute('src')
    video.load()
  }
}

/** Natural width/height of each image URL; URLs that cannot be loaded are omitted. */
export async function measureImageAspects(urls: string[], timeoutMs = 4000): Promise<Record<string, number>> {
  if (typeof Image === 'undefined') return {}
  const out: Record<string, number> = {}
  await Promise.all(
    Array.from(new Set(urls.filter(Boolean))).map(
      (url) =>
        new Promise<void>((resolve) => {
          const img = new Image()
          const timer = setTimeout(resolve, timeoutMs)
          img.onload = () => {
            clearTimeout(timer)
            if (img.naturalWidth > 0 && img.naturalHeight > 0) out[url] = img.naturalWidth / img.naturalHeight
            resolve()
          }
          img.onerror = () => { clearTimeout(timer); resolve() }
          img.src = url
        }),
    ),
  )
  return out
}
