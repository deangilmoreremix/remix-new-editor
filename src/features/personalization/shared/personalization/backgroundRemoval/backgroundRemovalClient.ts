/**
 * On-device background removal for the Asset Finder, powered by BG0
 * (@bg0/browser: BiRefNet, WebGPU with a WebAssembly fallback).
 *
 * - The library (and its model download) is imported lazily on first use, so
 *   it never lands in the main bundle.
 * - BG0 needs a DOM (canvas, localStorage), so it cannot run inside a Worker;
 *   WebGPU inference is async, and jobs run strictly one at a time.
 * - Nothing leaves the device. The result is a transparent PNG Blob.
 */

export type BackgroundRemovalQuality = 'fast' | 'quality'

export interface BackgroundRemovalProgress {
  stage: 'preparing' | 'downloading' | 'processing' | 'finishing'
  /** 0..1 */
  progress: number
  message: string
}

export interface BackgroundRemovalOutput {
  blob: Blob
  width: number
  height: number
  provider: 'webgpu' | 'wasm'
  quality: BackgroundRemovalQuality
  durationMs: number
}

export type BackgroundRemovalFailureCode =
  | 'unsupported-image'
  | 'image-too-large'
  | 'decode-failed'
  | 'model-load-failed'
  | 'out-of-memory'
  | 'inference-failed'
  | 'cancelled'
  | 'unknown'

export class BackgroundRemovalFailure extends Error {
  readonly code: BackgroundRemovalFailureCode
  /** True when retrying in the same page is unlikely to help (reload first). */
  readonly needsReload: boolean
  constructor(code: BackgroundRemovalFailureCode, message: string) {
    super(message)
    this.name = 'BackgroundRemovalFailure'
    this.code = code
    this.needsReload = code === 'model-load-failed'
  }
}

/** One-time model download BG0 performs (birefnet-lite-512 ONNX), in MB. */
export const BACKGROUND_REMOVAL_MODEL_MB = 192
/** BG0's documented input ceiling. */
export const BACKGROUND_REMOVAL_MAX_BYTES = 40 * 1024 * 1024
export const BACKGROUND_REMOVAL_TYPES = ['image/png', 'image/jpeg', 'image/webp'] as const

const FRIENDLY: Record<string, string> = {
  'unsupported-image': 'Only PNG, JPG and WebP images can have their background removed.',
  'image-too-large': 'This image is over 40 MB, so its background was not removed.',
  'decode-failed': 'This image could not be opened.',
  'model-load-failed': 'The background-removal model could not be loaded. Check your connection, reload the page and try again.',
  'out-of-memory': 'This device ran out of memory removing the background.',
  'inference-failed': 'Background removal failed for this image.',
  cancelled: 'Background removal was cancelled.',
}

export function isRemovableImageType(type: string | undefined | null): boolean {
  return Boolean(type) && (BACKGROUND_REMOVAL_TYPES as readonly string[]).includes(type as string)
}

/** Phones and tablets: download is large and memory is tight. */
export function isConstrainedDevice(): boolean {
  if (typeof navigator === 'undefined') return false
  const nav = navigator as Navigator & {
    connection?: { saveData?: boolean; effectiveType?: string; type?: string }
    userAgentData?: { mobile?: boolean }
  }
  const mobile =
    nav.userAgentData?.mobile === true ||
    /Android|iPhone|iPad|iPod|Mobile/i.test(nav.userAgent || '')
  const conn = nav.connection
  const slow = Boolean(conn?.saveData) || conn?.type === 'cellular' || /^(slow-2g|2g|3g)$/.test(conn?.effectiveType || '')
  return mobile || slow
}

function toFailure(error: unknown): BackgroundRemovalFailure {
  if (error instanceof BackgroundRemovalFailure) return error
  const err = error as { code?: string; name?: string; message?: string } | undefined
  if (err?.name === 'AbortError') return new BackgroundRemovalFailure('cancelled', FRIENDLY.cancelled)
  const code = (err?.code && err.code in FRIENDLY ? err.code : 'unknown') as BackgroundRemovalFailureCode
  return new BackgroundRemovalFailure(code, FRIENDLY[code] || err?.message || 'Background removal failed.')
}

// Strictly sequential: each job starts after the previous one settles.
let tail: Promise<unknown> = Promise.resolve()

/**
 * Removes the background from `blob` and resolves with a transparent PNG.
 * Jobs queue and run one at a time. Aborting `signal` rejects with a
 * `cancelled` failure (a queued job never starts; a running one is aborted
 * inside BG0).
 */
export function removeAssetBackground(
  blob: Blob,
  options: {
    quality?: BackgroundRemovalQuality
    onProgress?: (progress: BackgroundRemovalProgress) => void
    signal?: AbortSignal
  } = {},
): Promise<BackgroundRemovalOutput> {
  const { signal, onProgress } = options
  const quality = options.quality ?? (isConstrainedDevice() ? 'fast' : 'quality')

  const run = async (): Promise<BackgroundRemovalOutput> => {
    if (signal?.aborted) throw new BackgroundRemovalFailure('cancelled', FRIENDLY.cancelled)
    if (!isRemovableImageType(blob.type)) throw new BackgroundRemovalFailure('unsupported-image', FRIENDLY['unsupported-image'])
    if (blob.size > BACKGROUND_REMOVAL_MAX_BYTES) throw new BackgroundRemovalFailure('image-too-large', FRIENDLY['image-too-large'])
    try {
      const { removeBackground } = await import('@bg0/browser')
      const result = await removeBackground(blob, { quality, signal, onProgress })
      return {
        blob: result.blob,
        width: result.width,
        height: result.height,
        provider: result.provider,
        quality: result.quality,
        durationMs: result.durationMs,
      }
    } catch (error) {
      throw toFailure(error)
    }
  }

  const job = tail.then(run, run)
  // Keep the chain alive whether this job succeeds or fails.
  tail = job.catch(() => undefined)
  return job
}

/** Whether BG0 can run here at all (WebAssembly is its floor). */
export async function canRemoveBackgrounds(): Promise<boolean> {
  try {
    const { getBrowserCapabilities } = await import('@bg0/browser')
    const caps = getBrowserCapabilities()
    return caps.webgpu || caps.wasm
  } catch {
    return false
  }
}

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error ?? new Error('Could not read image'))
    reader.readAsDataURL(blob)
  })
}
