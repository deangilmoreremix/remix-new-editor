import type { PersonalizationPreviewSettings, PreviewAspectRatio } from './types'

/** What a video file reports about itself. */
export interface ClipMetadata {
  durationSeconds: number
  width: number
  height: number
}

const RATIOS: Array<[PreviewAspectRatio, number]> = [['16:9', 16 / 9], ['9:16', 9 / 16], ['1:1', 1], ['4:5', 4 / 5]]

/** The preview frame shape closest to a clip's own shape. */
export function closestAspectRatio(width: number, height: number): PreviewAspectRatio {
  const ratio = width / height
  return RATIOS.reduce((best, candidate) => (Math.abs(candidate[1] - ratio) < Math.abs(best[1] - ratio) ? candidate : best))[0]
}

/**
 * Settings for drawing the layers over a generated clip: the clip's own
 * length and shape, so it is neither cut short, padded with black, nor
 * cropped. Layer positions are fractions of the frame, so they carry over.
 */
export function fitSettingsToClip(
  settings: PersonalizationPreviewSettings,
  clip: ClipMetadata | null,
): PersonalizationPreviewSettings {
  if (!clip || !(clip.durationSeconds > 0)) return settings
  const next = { ...settings, durationInFrames: Math.max(1, Math.round(clip.durationSeconds * settings.fps)) }
  if (clip.width > 0 && clip.height > 0) {
    // The frame takes the clip's exact shape (also 4:3, 3:4…), so nothing is
    // cropped; the nearest preset only names it. The shorter side is 1080.
    const aspectRatio = closestAspectRatio(clip.width, clip.height)
    const scale = 1080 / Math.min(clip.width, clip.height)
    const even = (value: number) => Math.max(2, Math.round(value / 2) * 2)
    Object.assign(next, { aspectRatio, width: even(clip.width * scale), height: even(clip.height * scale) })
  }
  return next
}

/**
 * Reads a video's length and size from its metadata (no frames are decoded;
 * this works for other sites' videos too). Resolves null if it can't be read
 * in time.
 */
export function readClipMetadata(url: string, timeoutMs = 15_000): Promise<ClipMetadata | null> {
  if (typeof document === 'undefined') return Promise.resolve(null)
  return new Promise((resolve) => {
    const video = document.createElement('video')
    let settled = false
    const finish = (value: ClipMetadata | null) => {
      if (settled) return
      settled = true
      window.clearTimeout(timer)
      video.removeAttribute('src')
      video.load()
      resolve(value)
    }
    const timer = window.setTimeout(() => finish(null), timeoutMs)
    video.preload = 'metadata'
    video.muted = true
    video.onloadedmetadata = () => finish({
      durationSeconds: Number.isFinite(video.duration) ? video.duration : 0,
      width: video.videoWidth,
      height: video.videoHeight,
    })
    video.onerror = () => finish(null)
    video.src = url
  })
}
