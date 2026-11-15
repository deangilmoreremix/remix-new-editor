/**
 * Thin, typed adapter over the Timeline Editor's free in-browser AI (`src/lib/editor/ml`, `src/lib/editor/remotion`).
 * Everything runs on the viewer's own device through Transformers.js: no paid API, no server. Model weights download
 * once from the Hugging Face hub and are then cached by the browser.
 *
 * The editor modules are plain JS and heavy, so they are imported lazily here: nothing in this file lands in the main
 * bundle until a tool is actually used. Tests mock this whole module.
 */

export type ModelKey = 'detr' | 'upscale' | 'whisper'

export interface ModelInfo {
  key: ModelKey
  label: string
  /** What it does for the customer, one line. */
  feature: string
  /** Approximate first-download size. */
  sizeMB: number
  license: string
}

/**
 * What the notice shows before anything downloads. `detr` and `upscale` come from the editor's own registry (its
 * licences are vetted there: only commercially usable ones); Whisper is not in that registry, so it is described here
 * and matches `WHISPER_MODELS` in `remotion/transcribe.js`.
 */
export const WHISPER_MODEL_ID = 'onnx-community/whisper-tiny_timestamped'
const WHISPER_INFO: ModelInfo = {
  key: 'whisper', label: 'Speech to text (Whisper tiny)', feature: 'Writes captions from the video’s own sound', sizeMB: 40, license: 'MIT',
}

export interface Detection { label: string; score: number; box: { xmin: number; ymin: number; xmax: number; ymax: number } }
export interface FrameImage { width: number; height: number; data: Uint8ClampedArray }
export interface CaptionLine { text: string; startMs: number; endMs: number }
export interface Progress { stage?: string; progress?: number; message?: string }

type AnyModule = Record<string, any>

// The editor modules are untyped JS; the loaders keep that in one place.
// @ts-ignore -- untyped JS module
const loadClient = (): Promise<AnyModule> => import('../../../../../lib/editor/ml/mlClient.js')
// @ts-ignore -- untyped JS module
const loadRegistry = (): Promise<AnyModule> => import('../../../../../lib/editor/ml/modelRegistry.js')
// @ts-ignore -- untyped JS module
const loadFrames = (): Promise<AnyModule> => import('../../../../../lib/editor/ml/frameGrab.js')
// @ts-ignore -- untyped JS module
const loadLocalAI = (): Promise<AnyModule> => import('../../../../../lib/editor/ml/localAI.js')
// @ts-ignore -- untyped JS module
const loadTranscribe = (): Promise<AnyModule> => import('../../../../../lib/editor/remotion/transcribe.js')

export async function modelInfo(key: ModelKey): Promise<ModelInfo> {
  if (key === 'whisper') return WHISPER_INFO
  const reg = await loadRegistry()
  const m = reg.LOCAL_MODELS?.[key]
  return { key, label: m.label, feature: m.feature, sizeMB: m.sizeMB, license: m.license }
}

/** Whether the model is already in this browser's cache (then there is nothing to download). */
export async function isModelCached(key: ModelKey): Promise<boolean> {
  if (key === 'whisper') {
    try {
      if (typeof caches === 'undefined') return false
      const cache = await caches.open('transformers-cache')
      return (await cache.keys()).some((r) => r.url.includes(`/${WHISPER_MODEL_ID}/`))
    } catch { return false }
  }
  const { isModelCached: cached } = await loadClient()
  return Boolean(await cached(key))
}

/** Downloads the model without running it, with progress, so the notice can show real numbers. */
export async function preloadModel(key: ModelKey, opts: { onProgress?: (p: Progress) => void; signal?: AbortSignal } = {}): Promise<void> {
  if (key === 'whisper') return // loaded by the transcribe worker on first use; its own progress is reported there
  const { preloadModel: preload } = await loadClient()
  await preload(key, opts)
}

/** Stops any running local inference (the only way to cancel one) and frees the worker. */
export async function cancelLocalAI(): Promise<void> {
  const { terminateLocalAI } = await loadClient()
  terminateLocalAI()
}

/** One frame of a video, or an image, as raw pixels plus its size. */
export async function grabFramePixels(src: string, sec: number, opts: { maxSize?: number; image?: boolean; signal?: AbortSignal } = {}): Promise<FrameImage> {
  const { grabFrame, canvasImageData } = await loadFrames()
  const canvas = await grabFrame(src, sec, opts)
  const img = canvasImageData(canvas)
  return { width: img.width, height: img.height, data: new Uint8ClampedArray(img.data) }
}

export async function detectObjects(frame: FrameImage, opts: { threshold?: number; signal?: AbortSignal } = {}): Promise<Detection[]> {
  const { runLocalTask } = await loadClient()
  const data = new Uint8ClampedArray(frame.data)
  const out = await runLocalTask('detr.detect', { image: { width: frame.width, height: frame.height, data }, threshold: opts.threshold ?? 0.6 }, { transfer: [data.buffer], signal: opts.signal })
  return (out as Detection[]).filter((d) => d && d.box)
}

/** 2x sharper copy of an image (tiled, so it works on larger pictures). */
export async function upscaleImage(src: string, opts: { onProgress?: (p: Progress) => void; signal?: AbortSignal } = {}): Promise<Blob> {
  const { upscaleImage: up } = await loadLocalAI()
  return up(src, { maxInput: 1024, tile: 256, ...opts })
}

/** Speech to text for a video's audio. Cut into word-level captions (milliseconds from the start). */
export async function transcribeVideo(src: string, opts: { onProgress?: (p: Progress) => void; signal?: AbortSignal } = {}): Promise<{ text: string; captions: CaptionLine[] }> {
  const { transcribeInBrowser } = await loadTranscribe()
  const out = await transcribeInBrowser(src, { model: WHISPER_MODEL_ID, ...opts })
  return { text: String(out.text || ''), captions: (out.captions as CaptionLine[]) ?? [] }
}
