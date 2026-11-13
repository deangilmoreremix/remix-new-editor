/**
 * Thumbnail and GIF settings and decisions (Stage 7). Pure: validation, which frames to sample, how to score a frame so the
 * automatic thumbnail avoids black / washed-out / blurry moments, the play-button geometry, the GIF frame plan and email-size
 * advice. Rendering the frames is the browser's job (guided/renderStills.ts).
 */

export interface ThumbnailSettings {
  /** The frame to use; null = choose the best-looking frame automatically. */
  frame: number | null
  playButton: boolean
  /** Output width in px (height follows the video's aspect ratio). */
  width: number
}

export interface GifSettings {
  startSec: number
  durationSec: number
  fps: number
  width: number
  dither: boolean
  loop: boolean
}

const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n))
const round = (n: number, d = 2) => Math.round(n * 10 ** d) / 10 ** d

export const THUMB_MIN_W = 160, THUMB_MAX_W = 1920
export const GIF_MIN_W = 120, GIF_MAX_W = 720
export const GIF_MIN_FPS = 2, GIF_MAX_FPS = 15
export const GIF_MAX_SECONDS = 10
export const GIF_MAX_FRAMES_PLANNED = 100

export const DEFAULT_THUMBNAIL: ThumbnailSettings = { frame: null, playButton: true, width: 1280 }
export const DEFAULT_GIF: GifSettings = { startSec: 0, durationSec: 3, fps: 8, width: 480, dither: false, loop: true }

export function normalizeThumbnail(raw: unknown): ThumbnailSettings | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined
  const r = raw as Record<string, unknown>
  return {
    frame: finite(r.frame) && r.frame >= 0 ? Math.round(Math.min(r.frame, 1_000_000)) : null,
    playButton: r.playButton !== false,
    width: Math.round(clamp(finite(r.width) ? r.width : DEFAULT_THUMBNAIL.width, THUMB_MIN_W, THUMB_MAX_W)),
  }
}

export function normalizeGif(raw: unknown): GifSettings | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined
  const r = raw as Record<string, unknown>
  return {
    startSec: round(clamp(finite(r.startSec) ? r.startSec : 0, 0, 36000)),
    durationSec: round(clamp(finite(r.durationSec) ? r.durationSec : DEFAULT_GIF.durationSec, 0.5, GIF_MAX_SECONDS)),
    fps: Math.round(clamp(finite(r.fps) ? r.fps : DEFAULT_GIF.fps, GIF_MIN_FPS, GIF_MAX_FPS)),
    width: Math.round(clamp(finite(r.width) ? r.width : DEFAULT_GIF.width, GIF_MIN_W, GIF_MAX_W)),
    dither: r.dither === true,
    loop: r.loop !== false,
  }
}

/** Output size keeping the video's aspect ratio, with even-ish integer sides. */
export function fitWidth(compW: number, compH: number, width: number): { w: number; h: number } {
  const w = Math.max(2, Math.round(width))
  return { w, h: Math.max(2, Math.round((w * compH) / Math.max(1, compW))) }
}

// ── which frames, how good ───────────────────────────────────────────────────────────────────────────────────────

export interface FrameWindow { total: number; fps: number; fadeInFrames?: number; fadeOutFrames?: number }

/** Evenly spaced candidate frames for the automatic thumbnail, skipping the ends (fades, first-frame flashes). */
export function candidateFrames(win: FrameWindow, count = 12): number[] {
  const margin = Math.max(Math.round(win.total * 0.04), win.fadeInFrames ?? 0, 2)
  const endMargin = Math.max(Math.round(win.total * 0.04), win.fadeOutFrames ?? 0, 2)
  const lo = Math.min(win.total - 1, margin), hi = Math.max(lo, win.total - 1 - endMargin)
  if (hi <= lo || count <= 1) return [Math.round((lo + hi) / 2)]
  const out = new Set<number>(); for (let i = 0; i < count; i += 1) out.add(Math.round(lo + ((hi - lo) * i) / (count - 1)))
  return [...out]
}

export interface FrameScore { score: number; sharpness: number; meanLuma: number; contrast: number; reasons: string[] }

/**
 * Scores a frame (RGBA, any size) for use as a thumbnail. Rewards detail (edge energy) and contrast, and a mid-range
 * brightness; punishes black, blown-out and flat frames. Returns the parts so the panel can explain a choice.
 */
export function scoreFrame(rgba: ArrayLike<number>, width: number, height: number): FrameScore {
  const n = width * height; if (n < 4) return { score: 0, sharpness: 0, meanLuma: 0, contrast: 0, reasons: ['too small'] }
  const luma = new Float32Array(n); let sum = 0
  for (let i = 0; i < n; i += 1) { const l = 0.2126 * rgba[i * 4] + 0.7152 * rgba[i * 4 + 1] + 0.0722 * rgba[i * 4 + 2]; luma[i] = l; sum += l }
  const mean = sum / n; let varSum = 0; for (let i = 0; i < n; i += 1) varSum += (luma[i] - mean) ** 2
  const contrast = Math.sqrt(varSum / n)
  let edge = 0, ec = 0
  for (let y = 1; y < height - 1; y += 1) for (let x = 1; x < width - 1; x += 1) { const i = y * width + x; edge += Math.abs(4 * luma[i] - luma[i - 1] - luma[i + 1] - luma[i - width] - luma[i + width]); ec += 1 }
  const sharpness = ec ? edge / ec : 0
  const reasons: string[] = []
  let exposure = 1
  if (mean < 35) { exposure = mean / 35; reasons.push('too dark') } else if (mean > 225) { exposure = (255 - mean) / 30; reasons.push('washed out') }
  if (contrast < 12) reasons.push('flat')
  const score = Math.max(0, exposure) * (Math.min(1, sharpness / 12) * 0.55 + Math.min(1, contrast / 55) * 0.45)
  return { score: round(score, 4), sharpness: round(sharpness), meanLuma: round(mean, 1), contrast: round(contrast, 1), reasons }
}

export function pickBestFrame(scored: Array<{ frame: number; score: FrameScore }>): { frame: number; score: FrameScore } | null {
  let best: { frame: number; score: FrameScore } | null = null
  for (const s of scored) if (!best || s.score.score > best.score.score + 1e-9) best = s
  return best
}

// ── play button ──────────────────────────────────────────────────────────────────────────────────────────────────

export interface PlayButton { cx: number; cy: number; r: number; triangle: Array<[number, number]> }
export function playButtonGeometry(w: number, h: number): PlayButton {
  const r = Math.round(Math.min(w, h) * 0.11), cx = Math.round(w / 2), cy = Math.round(h / 2)
  const t = r * 0.5
  return { cx, cy, r, triangle: [[Math.round(cx - t * 0.55), Math.round(cy - t)], [Math.round(cx - t * 0.55), Math.round(cy + t)], [Math.round(cx + t * 0.95), cy]] }
}

// ── GIF frame plan and size advice ───────────────────────────────────────────────────────────────────────────────

export interface GifPlan { frames: number[]; delayMs: number; actualFps: number; startFrame: number; endFrame: number; /** The video ends before the chosen length, so the GIF is shorter than asked. */ truncated: boolean }

/** The composition frames to render for a GIF of `gif.fps`, evenly spaced from `startSec` for `durationSec`, clipped to the video. */
export function gifPlan(gif: GifSettings, compFps: number, totalFrames: number): GifPlan {
  const fps = Math.max(1, compFps)
  const startFrame = clamp(Math.round(gif.startSec * fps), 0, Math.max(0, totalFrames - 1))
  const availableSec = Math.max(1, totalFrames - startFrame) / fps
  const effectiveSec = Math.min(gif.durationSec, availableSec)
  const count = Math.max(1, Math.min(GIF_MAX_FRAMES_PLANNED, Math.round(effectiveSec * gif.fps)))
  const step = count > 1 ? (effectiveSec * fps) / count : 1
  const frames: number[] = []
  for (let i = 0; i < count; i += 1) { const f = Math.min(totalFrames - 1, startFrame + Math.floor(i * step)); if (frames[frames.length - 1] !== f) frames.push(f) }
  const delayMs = Math.max(40, Math.round(1000 / gif.fps / 10) * 10)
  return { frames, delayMs, actualFps: round(1000 / delayMs, 1), startFrame, endFrame: frames[frames.length - 1] ?? startFrame, truncated: gif.durationSec > availableSec + 0.05 }
}

export interface SizeAdvice { level: 'ok' | 'warn' | 'bad'; message: string }
/** Plain advice about a GIF's weight for email/links (many mail apps load images on demand, and some clients show only the first frame). */
export function gifSizeAdvice(bytes: number): SizeAdvice {
  const mb = bytes / 1_048_576
  if (bytes <= 1_048_576) return { level: 'ok', message: `${mb.toFixed(2)} MB: light enough for email.` }
  if (bytes <= 3 * 1_048_576) return { level: 'warn', message: `${mb.toFixed(1)} MB: heavy for email. Use a smaller width, fewer frames per second or a shorter clip.` }
  return { level: 'bad', message: `${mb.toFixed(1)} MB: too heavy for email and slow to load. Shrink the width, lower the frame rate or shorten it.` }
}
