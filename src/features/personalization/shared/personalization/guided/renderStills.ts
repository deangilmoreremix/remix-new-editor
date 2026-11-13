/**
 * Thumbnails and GIFs from the shared composition (Stage 7). The frames are rendered by Remotion's web renderer (the same
 * composition the Player and the MP4 export use), so a thumbnail or GIF shows exactly what the video shows at that moment:
 * the recipient's name, the website, the presenter, captions, effects.
 *
 * The renderer, the image encoder and the clock are injected, so the logic (frame choice, plan, encoding, errors, cancel) is
 * tested without a browser; the browser implementations at the bottom are what the editor uses.
 */
import { GifError, encodeGif, type GifStats } from '../gif/gifCodec'
import {
  DEFAULT_GIF, DEFAULT_THUMBNAIL, candidateFrames, fitWidth, gifPlan, pickBestFrame, playButtonGeometry, scoreFrame,
  type FrameScore, type GifPlan, type GifSettings, type ThumbnailSettings,
} from '../preview/stills'
import type { PreviewInputProps } from '../preview/types'

export interface RawFrame { data: ArrayLike<number>; width: number; height: number }
/** Renders composition frame `frame` at `width` px wide (height follows the video's aspect ratio). */
export type FrameRenderer = (frame: number, width: number) => Promise<RawFrame>

export interface StillDeps {
  renderFrame: FrameRenderer
  /** Draws the (optional) play button and encodes JPEG/PNG. */
  encodeImage: (frame: RawFrame, opts: { playButton: boolean; format: 'jpeg' | 'png' }) => Promise<Blob>
}

export class StillError extends Error {
  constructor(message: string, readonly code: 'ABORTED' | 'RENDER' | 'ENCODE' | 'EMPTY') { super(message); this.name = 'StillError' }
}
const aborted = () => new StillError('Cancelled', 'ABORTED')

export interface ThumbnailResult { blob: Blob; frame: number; auto: boolean; width: number; height: number; bytes: number; scores: Array<{ frame: number; score: FrameScore }> }

export async function makeThumbnail(
  inputProps: Pick<PreviewInputProps, 'settings'>,
  deps: StillDeps,
  opts: { signal?: AbortSignal; onProgress?: (p: number, label: string) => void; format?: 'jpeg' | 'png' } = {},
): Promise<ThumbnailResult> {
  const { settings } = inputProps; const cfg: ThumbnailSettings = settings.thumbnail ?? DEFAULT_THUMBNAIL
  const total = Math.max(1, Math.round(settings.durationInFrames))
  const { signal, onProgress } = opts
  if (signal?.aborted) throw aborted()
  const scores: ThumbnailResult['scores'] = []
  let frame = cfg.frame !== null ? Math.min(cfg.frame, total - 1) : 0
  const auto = cfg.frame === null
  if (auto) {
    const cands = candidateFrames({ total, fps: settings.fps, fadeInFrames: settings.footageEffects?.fade?.inFrames, fadeOutFrames: settings.footageEffects?.fade?.outFrames })
    for (const [i, f] of cands.entries()) {
      if (signal?.aborted) throw aborted()
      let raw: RawFrame
      try { raw = await deps.renderFrame(f, 192) } catch (e) { throw new StillError(`Frame ${f} could not be drawn: ${(e as Error)?.message ?? e}`, 'RENDER') }
      scores.push({ frame: f, score: scoreFrame(raw.data, raw.width, raw.height) })
      onProgress?.((i + 1) / (cands.length + 1) * 0.8, 'Choosing the best frame')
    }
    frame = pickBestFrame(scores)?.frame ?? candidateFrames({ total, fps: settings.fps })[0]
  }
  if (signal?.aborted) throw aborted()
  let raw: RawFrame
  try { raw = await deps.renderFrame(frame, cfg.width) } catch (e) { throw new StillError(`Frame ${frame} could not be drawn: ${(e as Error)?.message ?? e}`, 'RENDER') }
  let blob: Blob
  try { blob = await deps.encodeImage(raw, { playButton: cfg.playButton, format: opts.format ?? 'jpeg' }) } catch (e) { throw new StillError(`The picture could not be saved: ${(e as Error)?.message ?? e}`, 'ENCODE') }
  onProgress?.(1, 'Done')
  return { blob, frame, auto, width: raw.width, height: raw.height, bytes: blob.size, scores }
}

export interface GifResult { blob: Blob; bytes: number; plan: GifPlan; stats: GifStats; width: number; height: number }

export async function makeGif(
  inputProps: Pick<PreviewInputProps, 'settings'>,
  deps: Pick<StillDeps, 'renderFrame'>,
  opts: { signal?: AbortSignal; onProgress?: (p: number, label: string) => void } = {},
): Promise<GifResult> {
  const { settings } = inputProps; const cfg: GifSettings = settings.gif ?? DEFAULT_GIF
  const { signal, onProgress } = opts
  const total = Math.max(1, Math.round(settings.durationInFrames))
  const plan = gifPlan(cfg, settings.fps, total)
  if (!plan.frames.length) throw new StillError('There is nothing to put in the GIF.', 'EMPTY')
  const size = fitWidth(settings.width, settings.height, cfg.width)
  const frames: Array<{ rgba: ArrayLike<number> }> = []
  let w = size.w, h = size.h
  for (const [i, f] of plan.frames.entries()) {
    if (signal?.aborted) throw aborted()
    let raw: RawFrame
    try { raw = await deps.renderFrame(f, size.w) } catch (e) { throw new StillError(`Frame ${f} could not be drawn: ${(e as Error)?.message ?? e}`, 'RENDER') }
    w = raw.width; h = raw.height; frames.push({ rgba: raw.data })
    onProgress?.(((i + 1) / plan.frames.length) * 0.9, `Drawing frame ${i + 1} of ${plan.frames.length}`)
  }
  if (signal?.aborted) throw aborted()
  try {
    const { bytes, stats } = encodeGif({ width: w, height: h, frames: frames.map((f) => ({ rgba: f.rgba })), delayMs: plan.delayMs, loop: cfg.loop ? 0 : -1, dither: cfg.dither })
    onProgress?.(1, 'Done')
    return { blob: new Blob([bytes as unknown as BlobPart], { type: 'image/gif' }), bytes: bytes.length, plan, stats, width: w, height: h }
  } catch (e) {
    throw new StillError(e instanceof GifError ? e.message : `The GIF could not be made: ${(e as Error)?.message ?? e}`, 'ENCODE')
  }
}

// ── browser implementations ──────────────────────────────────────────────────────────────────────────────────────────

/** Renders composition frames with Remotion's web renderer and scales them to the requested width. */
export async function createWebFrameRenderer(inputProps: PreviewInputProps): Promise<FrameRenderer> {
  const [{ renderStillOnWeb }, { PersonalizationComposition }] = await Promise.all([import('@remotion/web-renderer'), import('../preview/PersonalizationComposition')])
  const s = inputProps.settings
  const width = Math.max(2, Math.round(s.width) - (Math.round(s.width) % 2)), height = Math.max(2, Math.round(s.height) - (Math.round(s.height) % 2))
  return async (frame, outWidth) => {
    const result = await renderStillOnWeb({
      composition: { id: 'personalization-still', component: PersonalizationComposition as never, width, height, fps: s.fps > 0 ? s.fps : 30, durationInFrames: Math.max(1, Math.round(s.durationInFrames)), defaultProps: inputProps as never },
      inputProps: inputProps as never, frame, imageFormat: 'png', licenseKey: 'free-license', delayRenderTimeoutInMilliseconds: 30000,
    } as never)
    const blob: Blob = await (result as unknown as { blob: (o: { format: string }) => Promise<Blob> }).blob({ format: 'png' })
    const bmp = await createImageBitmap(blob)
    const { w, h } = fitWidth(bmp.width, bmp.height, outWidth)
    const c = document.createElement('canvas'); c.width = w; c.height = h
    const ctx = c.getContext('2d', { willReadFrequently: true })!
    ctx.imageSmoothingQuality = 'high'; ctx.drawImage(bmp, 0, 0, w, h); bmp.close?.()
    const id = ctx.getImageData(0, 0, w, h)
    return { data: id.data, width: w, height: h }
  }
}

export const browserEncodeImage: StillDeps['encodeImage'] = async (frame, { playButton, format }) => {
  const c = document.createElement('canvas'); c.width = frame.width; c.height = frame.height
  const ctx = c.getContext('2d')!
  const img = ctx.createImageData(frame.width, frame.height); img.data.set(frame.data as ArrayLike<number> as Uint8ClampedArray); ctx.putImageData(img, 0, 0)
  if (playButton) {
    const g = playButtonGeometry(frame.width, frame.height)
    ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.beginPath(); ctx.arc(g.cx, g.cy, g.r, 0, Math.PI * 2); ctx.fill()
    ctx.lineWidth = Math.max(2, g.r * 0.08); ctx.strokeStyle = 'rgba(255,255,255,0.95)'; ctx.stroke()
    ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.moveTo(...g.triangle[0]); ctx.lineTo(...g.triangle[1]); ctx.lineTo(...g.triangle[2]); ctx.closePath(); ctx.fill()
  }
  return new Promise<Blob>((resolve, reject) => c.toBlob((b) => (b ? resolve(b) : reject(new Error('The browser could not encode the image.'))), format === 'png' ? 'image/png' : 'image/jpeg', 0.92))
}

export async function createWebStillDeps(inputProps: PreviewInputProps): Promise<StillDeps> {
  return { renderFrame: await createWebFrameRenderer(inputProps), encodeImage: browserEncodeImage }
}
