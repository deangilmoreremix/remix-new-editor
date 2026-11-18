import { lerpMask, maskIndexAt, type Mask } from './maskMath'
import { sharedFrameSource } from './frameSource'
import { createMediaPipeSegmenter, type Segmenter } from './segmenter'
import { SegmentationCancelled, segmentVideo, type SegmentOptions, type SegmentResult } from './segmentVideo'
import { toPlayablePreviewMediaUrl } from '../remoteMedia'

/**
 * Measured presenter masks, kept in memory per video URL. They are measured once and then reused by every
 * preview and by the export (which runs in this same page). They are NEVER saved with the project: a mask set
 * is tens of MB, far beyond the project size limit, and re-measuring is cheap.
 */
export type CutoutState = 'idle' | 'processing' | 'ready' | 'error'

export interface CutoutStatus {
  state: CutoutState
  progress: number
  error?: string
}

interface Entry extends CutoutStatus {
  result: SegmentResult | null
  controller: AbortController | null
  promise: Promise<void> | null
}

const IDLE: CutoutStatus = { state: 'idle', progress: 0 }
const entries = new Map<string, Entry>()
const listeners = new Set<() => void>()
let version = 0

function notify() {
  version++
  listeners.forEach((l) => l())
}

export function subscribeMasks(listener: () => void): () => void {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

/** Changes whenever any status or mask set changes (for useSyncExternalStore). */
export function masksVersion(): number {
  return version
}

export function getCutoutStatus(url: string | null | undefined): CutoutStatus {
  const e = url ? entries.get(url) : undefined
  return e ? { state: e.state, progress: e.progress, error: e.error } : IDLE
}

export function hasMasks(url: string | null | undefined): boolean {
  return Boolean(url && entries.get(url)?.result)
}

/** The mask for a moment in the clip, blended between the two nearest measured frames. Null until measured. */
export function getMaskAt(url: string | null | undefined, timeSec: number): { mask: Mask; width: number; height: number } | null {
  const e = url ? entries.get(url) : undefined
  const r = e?.result
  if (!r || r.masks.length === 0) return null
  const { i0, i1, t } = maskIndexAt(timeSec, r.fps, r.masks.length)
  return { mask: lerpMask(r.masks[i0], r.masks[i1], t), width: r.width, height: r.height }
}

export interface EnsureOptions {
  signal?: AbortSignal
  /** Test hooks. */
  segmenterFactory?: () => Promise<Segmenter>
  frameSourceFactory?: (src: string) => ReturnType<typeof sharedFrameSource>
  createCanvas?: SegmentOptions['createCanvas']
}

/** Measures the masks for a video once. Concurrent callers share one run; callers after it finishes get the cached result. */
export function ensureMasks(url: string, options: EnsureOptions = {}): Promise<void> {
  const existing = entries.get(url)
  if (existing?.result) return Promise.resolve()
  if (existing?.promise) return existing.promise

  const controller = new AbortController()
  const entry: Entry = { state: 'processing', progress: 0, result: null, controller, promise: null }
  entries.set(url, entry)
  options.signal?.addEventListener('abort', () => controller.abort(), { once: true })

  entry.promise = (async () => {
    let segmenter: Segmenter | null = null
    try {
      notify()
      segmenter = await (options.segmenterFactory ?? createMediaPipeSegmenter)()
      const frames = await (options.frameSourceFactory ?? sharedFrameSource)(toPlayablePreviewMediaUrl(url))
      const result = await segmentVideo(frames, segmenter, {
        signal: controller.signal,
        createCanvas: options.createCanvas,
        onProgress: (p) => { entry.progress = p; notify() },
      })
      entry.result = result
      entry.state = 'ready'
      entry.progress = 1
    } catch (error) {
      if (error instanceof SegmentationCancelled || controller.signal.aborted) {
        entries.delete(url)
      } else {
        entry.state = 'error'
        entry.error = error instanceof Error ? error.message : 'Background removal failed.'
      }
      throw error
    } finally {
      segmenter?.close()
      entry.controller = null
      entry.promise = null
      notify()
    }
  })()
  // Callers that do not await still must not trigger an unhandled rejection.
  entry.promise.catch(() => undefined)
  return entry.promise
}

/** Stops a measurement in progress. */
export function cancelMasks(url: string | null | undefined): void {
  if (url) entries.get(url)?.controller?.abort()
}

/** Forgets the masks for one URL (or all), releasing their memory. */
export function clearMasks(url?: string): void {
  if (url) entries.get(url)?.controller?.abort()
  if (url) entries.delete(url)
  else {
    entries.forEach((e) => e.controller?.abort())
    entries.clear()
  }
  notify()
}
