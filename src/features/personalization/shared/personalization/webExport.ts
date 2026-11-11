/**
 * Browser export engine for the SmartVideo GO branded (overlay-only) render.
 *
 * The final branded video is produced IN THE BROWSER by
 * `@remotion/web-renderer` — never on a server. That means:
 *
 *   - no render worker, no API route, no headless browser, no storage upload
 *   - the finished file is handed straight to the user as a download
 *   - nothing here ever calls MuAPI, OpenAI or any other network service
 *
 * Capability detection runs BEFORE any frame is rendered, so an unsupported
 * browser/codec produces an explicit, actionable error instead of a hung
 * progress bar.
 *
 * The renderer itself is imported dynamically so the Next.js build keeps it out
 * of the main bundle: the provider `await import()`s this module inside the
 * branded-render branch only. The type-only imports below are erased at
 * runtime and never pull the package into a bundle.
 */

import type {
  CanRenderMediaOnWebOptions,
  CanRenderMediaOnWebResult,
  WebRendererAudioCodec,
  WebRendererContainer,
  WebRendererVideoCodec,
} from '@remotion/web-renderer'
import type React from 'react'
import type { PreviewInputProps } from './preview/types'
import { PersonalizationComposition } from './preview/PersonalizationComposition'
import {
  PERSONALIZATION_COMPOSITION_ID,
  WEB_RENDER_EXTENSION,
  WEB_RENDER_MIME_TYPE,
  chooseWebExportProfile,
  webRenderUnsupportedMessage,
  type WebExportAudioSupport,
  type WebExportPlan,
  type WebRenderCodecSupport,
} from './finalOutput'

/** Video codecs the export engine can ask the renderer for. */
export type WebExportVideoCodec = 'h264' | 'vp9' | 'vp8'

/** Audio codecs the export engine can ask the renderer for. */
export type WebExportAudioCodec = 'aac' | 'opus' | 'vorbis'

/** Failure classes the caller must be able to act on differently. */
export type WebExportFailureReason =
  | 'unsupported-browser'
  | 'unsupported-codec'
  | 'render-failed'
  | 'cancelled'

export interface WebExportOptions {
  /** The approved preview props — exactly what the preview rendered. */
  inputProps: PreviewInputProps
  /** Force a video codec. Rejected when the browser cannot encode it. */
  videoCodec?: WebExportVideoCodec | null
  /** Force an audio codec. Falls back when the container cannot carry it. */
  audioCodec?: WebExportAudioCodec | null
  /** Real render progress, 0..1. */
  onProgress?: (progress: number) => void
  /** Aborting cancels the render and releases the renderer. */
  signal?: AbortSignal
}

export interface WebExportSuccess {
  ok: true
  blob: Blob
  mimeType: string
  extension: string
  /** Non-fatal notes, e.g. audio dropped because no audio codec is encodable. */
  warning: string | null
}

export interface WebExportFailure {
  ok: false
  error: string
  reason: WebExportFailureReason
}

export type WebExportResult = WebExportSuccess | WebExportFailure

/** Progress payload shape emitted by the renderer. */
interface RendererProgress {
  progress: number
}

/** Blob-producing result of a successful render. */
interface RendererResult {
  getBlob: () => Promise<Blob>
}

/**
 * The exact slice of the installed `@remotion/web-renderer` API this engine
 * uses. Declared locally (instead of importing the package's own generic option
 * types) because those generics are shaped for schema-driven compositions and
 * reject a typed prop object without an index signature.
 */
type LoadedWebRenderer = {
  canRenderMediaOnWeb: (
    options: CanRenderMediaOnWebOptions,
  ) => Promise<CanRenderMediaOnWebResult>
  getEncodableVideoCodecs: (
    container: WebRendererContainer,
  ) => Promise<WebRendererVideoCodec[]>
  getEncodableAudioCodecs: (
    container: WebRendererContainer,
  ) => Promise<WebRendererAudioCodec[]>
  renderMediaOnWeb: (options: {
    composition: {
      id: string
      component: React.ComponentType<PreviewInputProps>
      width: number
      height: number
      fps: number
      durationInFrames: number
      defaultProps: PreviewInputProps
    }
    inputProps: PreviewInputProps
    container: WebRendererContainer
    videoCodec: WebRendererVideoCodec
    audioCodec: WebRendererAudioCodec | null
    muted: boolean
    signal: AbortSignal
    onProgress: (progress: RendererProgress) => void
  }) => Promise<RendererResult>
}

/**
 * Aborting must reach the renderer even when the caller passed no signal, so
 * the UI can always cancel through `cancelActiveExport()`.
 */
let activeController: AbortController | null = null

/** Cancel the in-flight export, if any. Returns true when one was running. */
export function cancelActiveExport(): boolean {
  if (!activeController) return false
  activeController.abort()
  return true
}

/** True while an export is running. */
export function isExportActive(): boolean {
  return activeController !== null
}

/** Clamp a renderer progress value into 0..1. */
export function clampProgress(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0
  if (value <= 0) return 0
  if (value >= 1) return 1
  return value
}

/**
 * Map the renderer's capability issues to one of our failure reasons. Codec and
 * container problems are "unsupported-codec"; a missing WebCodecs/WebGL stack
 * is "unsupported-browser"; anything else is a plain render failure.
 */
export function webExportFailureReason(
  issues: readonly { type: string }[],
): WebExportFailureReason {
  const types = new Set(issues.map((issue) => issue.type))
  if (types.has('webcodecs-unavailable') || types.has('webgl-unsupported')) {
    return 'unsupported-browser'
  }
  if (
    types.has('video-codec-unsupported') ||
    types.has('audio-codec-unsupported') ||
    types.has('container-codec-mismatch')
  ) {
    return 'unsupported-codec'
  }
  return 'render-failed'
}

/** h264 needs even dimensions; rounding also guards odd custom compositions. */
function evenDimension(value: number): number {
  const rounded = Math.max(2, Math.round(value))
  return rounded % 2 === 0 ? rounded : rounded + 1
}

/** Loads the renderer only when an export is actually requested. */
async function loadWebRenderer(): Promise<LoadedWebRenderer> {
  return (await import('@remotion/web-renderer')) as unknown as LoadedWebRenderer
}

/**
 * Which video/audio codecs this browser can actually encode, per container.
 * A failing probe is treated as "cannot encode", never as a guess.
 */
async function detectCodecSupport(renderer: LoadedWebRenderer): Promise<{
  video: WebRenderCodecSupport
  audio: WebExportAudioSupport
}> {
  const empty = [] as string[]
  const [mp4Video, webmVideo, mp4Audio, webmAudio] = await Promise.all([
    renderer.getEncodableVideoCodecs('mp4').catch(() => empty),
    renderer.getEncodableVideoCodecs('webm').catch(() => empty),
    renderer.getEncodableAudioCodecs('mp4').catch(() => empty),
    renderer.getEncodableAudioCodecs('webm').catch(() => empty),
  ])
  return {
    video: {
      h264: mp4Video.includes('h264'),
      vp9: webmVideo.includes('vp9'),
      vp8: webmVideo.includes('vp8'),
    },
    audio: { mp4: mp4Audio, webm: webmAudio },
  }
}

/**
 * Export the approved personalization as a real video file, entirely in the
 * browser. Never throws: every failure comes back as a classified result.
 */
export async function exportPersonalizedVideo(
  options: WebExportOptions,
): Promise<WebExportResult> {
  const { inputProps, onProgress, signal } = options

  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return {
      ok: false,
      reason: 'unsupported-browser',
      error: 'The branded video is rendered in your browser, which is not available right now.',
    }
  }
  if (signal?.aborted) {
    return { ok: false, reason: 'cancelled', error: 'Render cancelled before it started.' }
  }

  const settings = inputProps.settings
  const width = evenDimension(settings?.width ?? 0)
  const height = evenDimension(settings?.height ?? 0)
  const fps = settings?.fps && settings.fps > 0 ? settings.fps : 30
  const durationInFrames = Math.max(1, Math.round(settings?.durationInFrames ?? 1))

  let renderer: LoadedWebRenderer
  try {
    renderer = await loadWebRenderer()
  } catch (error) {
    return {
      ok: false,
      reason: 'unsupported-browser',
      error: `Could not load the in-browser video renderer: ${
        error instanceof Error ? error.message : String(error)
      }`,
    }
  }

  // ── Capability detection, BEFORE anything is rendered ────────────────────
  let codecSupport: Awaited<ReturnType<typeof detectCodecSupport>>
  try {
    codecSupport = await detectCodecSupport(renderer)
  } catch (error) {
    return {
      ok: false,
      reason: 'unsupported-browser',
      error: `This browser could not report its video encoding support: ${
        error instanceof Error ? error.message : String(error)
      }`,
    }
  }

  const plan = chooseWebExportProfile({
    video: codecSupport.video,
    audio: codecSupport.audio,
    requestedVideoCodec: options.videoCodec ?? null,
    requestedAudioCodec: options.audioCodec ?? null,
  })
  if (plan.error) {
    return { ok: false, reason: plan.errorReason, error: plan.error }
  }

  let capability: CanRenderMediaOnWebResult
  try {
    capability = await renderer.canRenderMediaOnWeb({
      container: plan.profile.container,
      videoCodec: plan.profile.videoCodec,
      audioCodec: plan.audioCodec,
      width,
      height,
      muted: plan.muted,
    })
  } catch (error) {
    return {
      ok: false,
      reason: 'unsupported-browser',
      error: `This browser could not be checked for video encoding support: ${
        error instanceof Error ? error.message : String(error)
      }`,
    }
  }

  if (!capability.canRender) {
    const reason = webExportFailureReason(capability.issues)
    const details = capability.issues
      .filter((issue) => issue.severity === 'error')
      .map((issue) => issue.message)
      .join(' ')
    const fallback =
      reason === 'unsupported-browser'
        ? webRenderUnsupportedMessage(plan.profile)
        : 'The in-browser render could not be started.'
    return { ok: false, reason, error: details || fallback }
  }

  // ── Render ───────────────────────────────────────────────────────────────
  const controller = new AbortController()
  activeController = controller
  const forwardAbort = () => controller.abort()
  if (signal) {
    if (signal.aborted) {
      activeController = null
      return { ok: false, reason: 'cancelled', error: 'Render cancelled.' }
    }
    signal.addEventListener('abort', forwardAbort, { once: true })
  }

  try {
    const result = await renderer.renderMediaOnWeb({
      composition: {
        id: PERSONALIZATION_COMPOSITION_ID,
        component: PersonalizationComposition,
        width,
        height,
        fps,
        durationInFrames,
        defaultProps: inputProps,
      },
      inputProps,
      container: plan.profile.container,
      videoCodec: plan.profile.videoCodec,
      audioCodec: plan.audioCodec,
      muted: plan.muted,
      signal: controller.signal,
      onProgress: (progress) => {
        onProgress?.(clampProgress(progress.progress))
      },
    })
    const blob = await result.getBlob()
    return {
      ok: true,
      blob,
      mimeType: WEB_RENDER_MIME_TYPE[plan.profile.container],
      extension: WEB_RENDER_EXTENSION[plan.profile.container],
      warning: plan.warning,
    }
  } catch (error) {
    if (controller.signal.aborted) {
      return { ok: false, reason: 'cancelled', error: 'Render cancelled.' }
    }
    return {
      ok: false,
      reason: 'render-failed',
      error: error instanceof Error ? error.message : 'The in-browser render failed.',
    }
  } finally {
    if (signal) signal.removeEventListener('abort', forwardAbort)
    if (activeController === controller) activeController = null
  }
}

/** Hand the finished file to the user as a direct download. */
export function downloadWebExportBlob(blob: Blob, fileName: string): void {
  if (typeof document === 'undefined') return
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  link.rel = 'noopener'
  document.body.appendChild(link)
  link.click()
  link.remove()
  // The download owns the blob once the click has been dispatched; the URL is
  // only kept around long enough for slow browsers to pick it up.
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

export type { WebExportPlan }
