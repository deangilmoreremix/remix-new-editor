/**
 * Media checks that need the browser (Stage 6): read the source video's codec / size / duration without decoding it, and
 * sample it for scene-cut detection. mediabunny is already used by the export and by background removal.
 */
import { DEFAULT_SCENE_PARAMS, detectCuts, lumaDifference, classifyVideoCodec, type CodecAdvice, type SceneParams } from '../preview/captions'

export interface VideoFacts { codec: string | null; width: number; height: number; durationSec: number; canDecode: boolean; advice: CodecAdvice }

export async function probeVideo(url: string, signal?: AbortSignal): Promise<VideoFacts> {
  const mb = await import('mediabunny')
  const res = await fetch(url, { signal })
  if (!res.ok) throw new Error(`The video could not be loaded (HTTP ${res.status}).`)
  const input = new mb.Input({ source: new mb.BlobSource(await res.blob()), formats: mb.ALL_FORMATS })
  const vt = await input.getPrimaryVideoTrack()
  if (!vt) throw new Error('This file has no video track.')
  const codecString = (await vt.getCodecParameterString().catch(() => null)) ?? vt.codec
  const canDecode = await vt.canDecode().catch(() => false)
  const advice = canDecode ? classifyVideoCodec(codecString) : { ...classifyVideoCodec(codecString), level: 'bad' as const, message: `This browser cannot decode this video (${codecString ?? 'unknown codec'}). Convert it to H.264 (MP4).` }
  return { codec: codecString, width: vt.displayWidth, height: vt.displayHeight, durationSec: await input.computeDuration(), canDecode, advice }
}

export interface SceneScan { cuts: number[]; scenes: Array<{ startSec: number; endSec: number; thumb: string | null }>; sampledFrames: number; durationSec: number }

/** Samples the video at `fps` on a 64×36 grid, finds cuts, and cuts a small thumbnail at the start of every scene. */
export async function scanScenes(
  url: string,
  opts: { fps?: number; params?: SceneParams; thumbWidth?: number; signal?: AbortSignal; onProgress?: (p: number) => void } = {},
): Promise<SceneScan> {
  const { fps = 5, params = DEFAULT_SCENE_PARAMS, thumbWidth = 120, signal, onProgress } = opts
  const mb = await import('mediabunny')
  const res = await fetch(url, { signal })
  if (!res.ok) throw new Error(`The video could not be loaded (HTTP ${res.status}).`)
  const input = new mb.Input({ source: new mb.BlobSource(await res.blob()), formats: mb.ALL_FORMATS })
  const vt = await input.getPrimaryVideoTrack()
  if (!vt) throw new Error('This file has no video track.')
  const duration = await input.computeDuration()
  const times: number[] = []
  for (let t = 0; t < duration; t += 1 / fps) times.push(Math.round(t * 1000) / 1000)
  const W = 64, H = 36
  const sink = new mb.CanvasSink(vt, { width: W, height: H, fit: 'fill' })
  const mk = (w: number, h: number) => (typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(w, h) : Object.assign(document.createElement('canvas'), { width: w, height: h }))
  const ctx = (mk(W, H) as OffscreenCanvas).getContext('2d', { willReadFrequently: true }) as OffscreenCanvasRenderingContext2D
  const lumas: Uint8Array[] = []; const kept: number[] = []
  let i = 0
  for await (const frame of sink.canvasesAtTimestamps(times)) {
    if (signal?.aborted) throw Object.assign(new Error('Cancelled'), { name: 'AbortError' })
    if (frame) {
      ctx.clearRect(0, 0, W, H); ctx.drawImage(frame.canvas as CanvasImageSource, 0, 0, W, H)
      const d = ctx.getImageData(0, 0, W, H).data; const l = new Uint8Array(W * H)
      for (let p = 0; p < l.length; p += 1) l[p] = Math.round(0.2126 * d[p * 4] + 0.7152 * d[p * 4 + 1] + 0.0722 * d[p * 4 + 2])
      lumas.push(l); kept.push(times[i])
    }
    i += 1; onProgress?.(Math.min(1, i / times.length))
  }
  const diffs: number[] = []; for (let k = 1; k < lumas.length; k += 1) diffs.push(lumaDifference(lumas[k - 1], lumas[k]))
  const cuts = detectCuts(diffs, kept.slice(0), params)
  const starts = [0, ...cuts]; const scenes: SceneScan['scenes'] = []
  const th = Math.round((thumbWidth * 9) / 16)
  const tsink = new mb.CanvasSink(vt, { width: thumbWidth, height: th, fit: 'fill' })
  for (let s = 0; s < starts.length; s += 1) {
    const startSec = starts[s]; const endSec = starts[s + 1] ?? duration
    let thumb: string | null = null
    try {
      const f = await tsink.getCanvas(Math.min(duration - 0.01, startSec + 0.05))
      if (f && typeof document !== 'undefined') { const c = document.createElement('canvas'); c.width = thumbWidth; c.height = th; c.getContext('2d')!.drawImage(f.canvas as CanvasImageSource, 0, 0); thumb = c.toDataURL('image/jpeg', 0.7) }
    } catch { thumb = null }
    scenes.push({ startSec, endSec, thumb })
  }
  return { cuts, scenes, sampledFrames: lumas.length, durationSec: duration }
}

export type TranscribeResult = { cues: Array<{ text: string; startMs: number; endMs: number }>; text: string }
