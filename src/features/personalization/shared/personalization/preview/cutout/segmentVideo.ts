import { fitWithin, smoothMask, type Mask } from './maskMath'
import type { FrameSource } from './frameSource'
import type { Segmenter } from './segmenter'

export const MASK_MAX_SIDE = 384
export const MASK_FPS = 15
/** Longer clips are refused with a clear message instead of freezing the tab for minutes. */
export const MAX_SEGMENT_SECONDS = 60
const TEMPORAL_KEEP = 0.35

export interface SegmentResult {
  masks: Mask[]
  fps: number
  width: number
  height: number
}

export interface SegmentOptions {
  signal?: AbortSignal
  onProgress?: (fraction: number) => void
  maskFps?: number
  maxSide?: number
  /** Test hook: how to make a scratch canvas. */
  createCanvas?: (w: number, h: number) => HTMLCanvasElement
}

export class SegmentationCancelled extends Error {
  constructor() {
    super('Background removal was cancelled.')
    this.name = 'SegmentationCancelled'
  }
}

const yieldToUi = () => new Promise<void>((resolve) => setTimeout(resolve, 0))

/** Measures a presenter mask for every sampled frame of the clip, smoothing across frames. Yields to the UI between frames. */
export async function segmentVideo(frames: FrameSource, segmenter: Segmenter, options: SegmentOptions = {}): Promise<SegmentResult> {
  const maskFps = options.maskFps ?? MASK_FPS
  if (!(frames.duration > 0) || !(frames.width > 0) || !(frames.height > 0)) throw new Error('The video has no readable frames.')
  if (frames.duration > MAX_SEGMENT_SECONDS) {
    throw new Error(`Background removal supports clips up to ${MAX_SEGMENT_SECONDS} seconds. Trim the video and try again.`)
  }
  const size = fitWithin(frames.width, frames.height, options.maxSide ?? MASK_MAX_SIDE)
  const make = options.createCanvas ?? ((w: number, h: number) => {
    const c = document.createElement('canvas')
    c.width = w
    c.height = h
    return c
  })
  const canvas = make(size.w, size.h)
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) throw new Error('Your browser could not create a drawing surface for background removal.')

  const count = Math.max(1, Math.ceil(frames.duration * maskFps))
  const masks: Mask[] = []
  let prev: Mask | null = null
  for (let i = 0; i < count; i++) {
    if (options.signal?.aborted) throw new SegmentationCancelled()
    await frames.draw(ctx, i / maskFps, 0, 0, size.w, size.h)
    const raw = segmenter.segment(canvas)
    const mask = smoothMask(prev, raw, TEMPORAL_KEEP)
    masks.push(mask)
    prev = mask
    options.onProgress?.((i + 1) / count)
    await yieldToUi()
  }
  return { masks, fps: maskFps, width: size.w, height: size.h }
}
