/**
 * On-device background removal for the Asset Finder, powered by BG0
 * (@bg0/browser: BiRefNet, WebGPU with a WebAssembly fallback).
 *
 * - The library (and its model download) is imported lazily on first use, so
 *   it never lands in the main bundle.
 * - Inference runs in a dedicated Worker (removeBackgroundWorker.js): WASM
 *   inference blocks for ~10 s per image, which would freeze the page. Where a
 *   Worker is unavailable (or fails to start) it falls back to the main thread.
 * - Jobs run strictly one at a time.
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

type Progress = (progress: BackgroundRemovalProgress) => void

// ── Worker path ──────────────────────────────────────────────────────────────

let worker: Worker | null = null
let workerBroken = false
let nextJobId = 0

function getWorker(): Worker | null {
  if (workerBroken || typeof Worker === 'undefined') return null
  if (!worker) {
    try {
      worker = new Worker(new URL('./removeBackgroundWorker.js', import.meta.url), { type: 'module' })
    } catch {
      workerBroken = true
      return null
    }
  }
  return worker
}

/** Thrown when the worker itself cannot run (script failed to load): retry on the main thread. */
class WorkerUnavailable extends Error {}

function runInWorker(
  w: Worker,
  blob: Blob,
  quality: BackgroundRemovalQuality,
  onProgress: Progress | undefined,
  signal: AbortSignal | undefined,
): Promise<BackgroundRemovalOutput> {
  const id = ++nextJobId
  return new Promise<BackgroundRemovalOutput>((resolve, reject) => {
    const cleanup = () => {
      w.removeEventListener('message', onMessage)
      w.removeEventListener('error', onError)
      signal?.removeEventListener('abort', onAbort)
    }
    const onAbort = () => w.postMessage({ type: 'cancel', id })
    const onMessage = ({ data }: MessageEvent) => {
      if (!data || data.id !== id) return
      if (data.type === 'progress') {
        onProgress?.({ stage: data.stage, progress: data.progress, message: data.message })
      } else if (data.type === 'done') {
        cleanup()
        // The result may already have been in flight when the caller aborted: honour the cancel.
        if (signal?.aborted) {
          reject(Object.assign(new Error('Cancelled'), { code: 'cancelled' }))
          return
        }
        resolve({ blob: data.blob, width: data.width, height: data.height, provider: data.provider, quality: data.quality, durationMs: data.durationMs })
      } else if (data.type === 'error') {
        cleanup()
        reject(Object.assign(new Error(data.message), { code: data.code }))
      }
    }
    const onError = (event: ErrorEvent) => {
      cleanup()
      // A script / module load failure: this worker is unusable from now on.
      workerBroken = true
      worker = null
      reject(new WorkerUnavailable(event.message || 'Background removal worker failed to start'))
    }
    w.addEventListener('message', onMessage)
    w.addEventListener('error', onError)
    signal?.addEventListener('abort', onAbort)
    w.postMessage({ type: 'remove', id, blob, quality })
  })
}

// ── Main-thread fallback ─────────────────────────────────────────────────────

async function runOnMainThread(
  blob: Blob,
  quality: BackgroundRemovalQuality,
  onProgress: Progress | undefined,
  signal: AbortSignal | undefined,
): Promise<BackgroundRemovalOutput> {
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
}

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
    onProgress?: Progress
    signal?: AbortSignal
  } = {},
): Promise<BackgroundRemovalOutput> {
  const { signal, onProgress } = options
  // 'fast' everywhere: noticeably quicker than 'quality' (slightly softer edges). An explicit option wins.
  const quality = options.quality ?? 'fast'

  const run = async (): Promise<BackgroundRemovalOutput> => {
    if (signal?.aborted) throw new BackgroundRemovalFailure('cancelled', FRIENDLY.cancelled)
    if (!isRemovableImageType(blob.type)) throw new BackgroundRemovalFailure('unsupported-image', FRIENDLY['unsupported-image'])
    if (blob.size > BACKGROUND_REMOVAL_MAX_BYTES) throw new BackgroundRemovalFailure('image-too-large', FRIENDLY['image-too-large'])
    try {
      const w = getWorker()
      if (w) {
        try {
          return await runInWorker(w, blob, quality, onProgress, signal)
        } catch (error) {
          if (!(error instanceof WorkerUnavailable)) throw error
          // fall through to the main thread
        }
      }
      return await runOnMainThread(blob, quality, onProgress, signal)
    } catch (error) {
      throw toFailure(error)
    }
  }

  const job = tail.then(run, run)
  // Keep the chain alive whether this job succeeds or fails.
  tail = job.catch(() => undefined)
  return job
}

// A small image with a clear subject. Used only to warm the model up: a flat image could make BG0
// think a WebGPU run produced a corrupt (flat) mask and wrongly mark WebGPU as broken for this browser.
const WARMUP_PNG_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAAGAAAABgCAIAAABt+uBvAAACyklEQVR42u3cy04bMRQGYDtixRN1gZ+DS7mEi4CkDRNIQEoDbfZdFAgBxALCHVbcn8BdsO4b9CXYTheFUTTJRKU559gT/UcoQiA8zoePoxn7WD//+q2UUqHCa8fXgb/fI5ICQAACEIAABCAAAQhACAABCEAAAhCAAAQg8VicMUm/2j+wbvumnxw9cs1Nmff2dW/fyvdTP4oD5SdNL//S3T1RJv0gCPRpojNNc3AwiSP78tLx541dISZ9LwX0uU2ni8u/SO00rATQnQhQYdz8N00XpnqDfRzpW2agpY80NF2YtncYmfQNJ1DQokNCk8S0VedKt0yoFNMXq06szaBgmN4FF1BxjFenveUijxEXkIBOe/upAVp5Gz7cOrGrrCyZFACVRo1yFyVqo0x6k0sm0YiBVkeNvE7siquB8RRobcRlcrXGGp1RJu3JxZ1offtEkep9kY2gyohxO3xiV68UDUaQxCCiGUHVYeMhUJViEGX6Y3rmm6odpNjQc7OXP//5ISuZZX2+LgYgdiCCOag2bPyZgGI9qS0bfMzzDiIAAQhAAAIQgAAEIAABiOtWo3z9uo0wabOTfEQ9Kf+wuNXA3TyA+vxxR9gp+X2YgJQ/C4fBtfVw+ASbFss+vPmllNLf6fYo1j1YO4zyq7BJs2sRS88ik7QnUzXt9Ey/uyN/5ctUnd+ynm6gyl06u+2Irpij0+HdgidpxJFcXEALly4TbWHbpmAb8PyFaKJFV5mn1pHYSM5txJdcvEBzF1bAqLXlubpNE1Co1Ow5r1Frm7M8OqFSusZcL3bIXy82w1ov9k2k4vCIp+JwWqDi8KtUzWqTumY1K1OzuiFY9XxMV/U8JVb1vC5eN3/SW938pHDdfNXRyQun7z95YcLJyQtfPDgN+Gw6EWv8wLrtm67guGQcl4x1MQABCEAAAhCAEAACEIAABCAAAQhAiCj+ABiWc6Q+I5MtAAAAAElFTkSuQmCC'

let prefetchStarted = false

/**
 * Downloads and initialises the model ahead of the first real asset by running ONE tiny removal
 * through the same sequential queue (BG0 has no public warm-up call). Safe to call repeatedly: it
 * only runs once per page load, and every failure is swallowed (a real job will report its own).
 */
export function prefetchBackgroundRemovalModel(): Promise<void> {
  if (prefetchStarted) return Promise.resolve()
  prefetchStarted = true
  try {
    const binary = atob(WARMUP_PNG_BASE64)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
    return removeAssetBackground(new Blob([bytes], { type: 'image/png' }), { quality: 'fast' }).then(
      () => undefined,
      () => undefined,
    )
  } catch {
    return Promise.resolve()
  }
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
