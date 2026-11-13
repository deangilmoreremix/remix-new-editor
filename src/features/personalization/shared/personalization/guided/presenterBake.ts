/**
 * Bakes "processed footage" for the presenter (Stage 3): decodes the source video in the browser, segments the
 * person in every frame, and writes a transparent WebM (VP9 + alpha, audio kept). The result is cached by content
 * key (presenterMatteStore) and reused by the preview and the export, so a render never runs a model.
 *
 * The heavy parts (decode/encode, the segmentation models) are injected, so the pipeline logic is testable
 * without a browser and the real engines are only loaded when a bake actually runs.
 */
import {
  DEFAULT_BAKE,
  hardenMask,
  maskBounds,
  maskCoverage,
  medianBounds,
  matteKey,
  matteQuality,
  smoothMask,
  type BakeOptions,
  type PersonBounds,
  type PresenterMatte,
} from '../preview/presenter'
import { ensureMatteUrl, getDefaultStore, saveMatte, type BlobStore } from './presenterMatteStore'

export interface SegmentEngine {
  /** One byte per pixel of the input frame: 0 = background … 255 = person. */
  segment(frame: { width: number; height: number; data: Uint8ClampedArray }): Uint8Array | Promise<Uint8Array>
  close(): void
}

export interface BakeProgress {
  stage: 'prepare' | 'process' | 'save'
  progress: number
  frame?: number
  frames?: number
  etaSec?: number | null
}

export interface BakeDeps {
  matteVideo(src: string, opts: Record<string, any>): Promise<Blob>
  createEngine(engine: BakeOptions['engine'], hooks: { onProgress?: (p: BakeProgress) => void; signal?: AbortSignal }): Promise<SegmentEngine>
  now(): string
}

export interface BakeResult {
  matte: PresenterMatte
  url: string
  /** True when processed footage for this exact video + settings already existed and was reused. */
  reused: boolean
  meanCoverage: number
  frames: number
}

export class BakeError extends Error {
  constructor(message: string, readonly code: 'NO_PERSON' | 'ALL_PERSON' | 'EMPTY' | 'ENGINE' | 'ABORTED') {
    super(message)
    this.name = 'BakeError'
  }
}

const abortError = () => new BakeError('Cancelled', 'ABORTED')

/** The real engines. Loaded on demand so the editor does not pay for them until someone removes a background. */
export const defaultBakeDeps: BakeDeps = {
  matteVideo: async (src, opts) => (await import('../../../../../lib/editor/ml/videoMatte.js')).matteVideo(src, opts),
  createEngine: async (engine, { onProgress }) => {
    if (engine === 'mediapipe') {
      const mod = await import('../../../../../lib/editor/ml/mediapipeSegmenter.js')
      const seg = await mod.createMediaPipeSegmenter({ delegate: 'CPU' })
      return { segment: (f) => seg.segment(f as unknown as ImageData), close: () => seg.close() }
    }
    const bg = await import('../../../../../lib/editor/remotion/bgRemoval.js')
    await bg.prepareModel({ onProgress: (p: number) => onProgress?.({ stage: 'prepare', progress: p }) })
    return {
      segment: (f) => bg.maskFor(f as unknown as ImageData),
      close: () => bg.cancelBackgroundRemoval(),
    }
  },
  now: () => new Date().toISOString(),
}

/** Re-use check: has this video + these settings already been processed in this browser? */
export async function findExistingMatte(
  sourceUrl: string,
  options: Partial<BakeOptions> = {},
  store: BlobStore = getDefaultStore(),
): Promise<PresenterMatte | null> {
  const opts = { ...DEFAULT_BAKE, ...options }
  const key = matteKey(sourceUrl, undefined, opts)
  const rec = await store.get(key).catch(() => undefined)
  if (!rec) return null
  return { key, engine: opts.engine, sourceUrl, createdAt: rec.createdAt, ...(rec.bounds ? { bounds: rec.bounds } : {}), ...(rec.videoAspect ? { videoAspect: rec.videoAspect } : {}) }
}

export async function bakePresenterMatte(
  sourceUrl: string,
  options: Partial<BakeOptions> = {},
  hooks: { onProgress?: (p: BakeProgress) => void; signal?: AbortSignal; force?: boolean } = {},
  store: BlobStore = getDefaultStore(),
  deps: BakeDeps = defaultBakeDeps,
): Promise<BakeResult> {
  const opts: BakeOptions = { ...DEFAULT_BAKE, ...options }
  const { onProgress, signal } = hooks
  if (signal?.aborted) throw abortError()
  const key = matteKey(sourceUrl, undefined, opts)

  if (!hooks.force) {
    const existing = await findExistingMatte(sourceUrl, opts, store)
    if (existing) {
      const url = await ensureMatteUrl(existing, store)
      if (url) {
        onProgress?.({ stage: 'save', progress: 1 })
        return { matte: existing, url, reused: true, meanCoverage: NaN, frames: 0 }
      }
    }
  }

  onProgress?.({ stage: 'prepare', progress: 0 })
  let engine: SegmentEngine
  try {
    engine = await deps.createEngine(opts.engine, { onProgress, signal })
  } catch (err) {
    throw new BakeError(`The ${opts.engine === 'mediapipe' ? 'MediaPipe' : 'MODNet'} segmenter could not start: ${(err as Error)?.message ?? err}`, 'ENGINE')
  }

  const coverages: number[] = []
  const boundsList: PersonBounds[] = []
  let videoAspect = 0
  let previous: Uint8Array | null = null
  let blob: Blob
  try {
    blob = await deps.matteVideo(sourceUrl, {
      maxSize: opts.maxSize,
      signal,
      onProgress: (p: BakeProgress) => onProgress?.({ ...p, stage: 'process' }),
      matteFor: async (img: { width: number; height: number; data: Uint8ClampedArray }) => {
        if (signal?.aborted) throw abortError()
        const raw = await engine.segment(img)
        const smoothed = smoothMask(previous, raw, opts.smooth)
        previous = smoothed
        const out = hardenMask(smoothed, opts.edge)
        coverages.push(maskCoverage(out))
        if (!videoAspect) videoAspect = img.width / img.height
        if (coverages.length % 4 === 1) {
          const b = maskBounds(out, img.width, img.height)
          if (b) boundsList.push(b)
        }
        return out
      },
    })
  } catch (err) {
    if ((err as Error)?.name === 'AbortError' || signal?.aborted) throw abortError()
    throw err
  } finally {
    engine.close()
  }

  const quality = matteQuality(coverages)
  if (!quality.ok) {
    throw new BakeError(quality.reason ?? 'The processed footage is not usable.', coverages.length === 0 ? 'EMPTY' : quality.meanCoverage < 0.5 ? 'NO_PERSON' : 'ALL_PERSON')
  }
  const bounds = medianBounds(boundsList)
  onProgress?.({ stage: 'save', progress: 0 })
  const createdAt = deps.now()
  const url = await saveMatte(key, { blob, sourceUrl, engine: opts.engine, createdAt, ...(bounds ? { bounds } : {}), ...(videoAspect ? { videoAspect } : {}) }, store)
  onProgress?.({ stage: 'save', progress: 1 })
  return {
    matte: { key, engine: opts.engine, sourceUrl, createdAt, ...(bounds ? { bounds } : {}), ...(videoAspect ? { videoAspect } : {}) },
    url,
    reused: false,
    meanCoverage: quality.meanCoverage,
    frames: coverages.length,
  }
}
