import { grabFramePixels } from '../localAI/engine'
import { loadImageBlob } from '../backgroundRemoval/loadImageBlob'
import { sharpnessScore } from './imageIntel'
import { pickThumbnails, type FrameStats, type ThumbPick } from './thumbnailIntel'

const toCanvas = (f: { width: number; height: number; data: Uint8ClampedArray }): HTMLCanvasElement => {
  const c = document.createElement('canvas'); c.width = f.width; c.height = f.height
  c.getContext('2d')!.putImageData(new ImageData(new Uint8ClampedArray(f.data), f.width, f.height), 0, 0)
  return c
}

/** Samples frames evenly and returns the best few with a small preview of each. Local only; cancellable. */
export async function suggestThumbnails(url: string, duration: number, opts: { count?: number; signal?: AbortSignal; onProgress?: (d: number, t: number) => void } = {}): Promise<(ThumbPick & { preview: string })[]> {
  const n = opts.count ?? 12
  const stats: (FrameStats & { preview: string })[] = []
  for (let i = 0; i < n; i++) {
    if (opts.signal?.aborted) throw Object.assign(new Error('Cancelled'), { name: 'AbortError' })
    const t = Math.min(Math.max(0, duration - 0.1), (duration * (i + 0.5)) / n)
    try {
      const f = await grabFramePixels(url, t, { maxSize: 320, signal: opts.signal })
      let sum = 0, sumSq = 0
      const px = f.width * f.height
      for (let p = 0; p < px; p++) { const l = 0.299 * f.data[p * 4]! + 0.587 * f.data[p * 4 + 1]! + 0.114 * f.data[p * 4 + 2]!; sum += l; sumSq += l * l }
      const mean = sum / px
      stats.push({ t, sharpness: sharpnessScore(f), brightness: mean, contrast: Math.sqrt(Math.max(0, sumSq / px - mean * mean)), preview: toCanvas(f).toDataURL('image/jpeg', 0.7) })
    } catch (e) { if ((e as { name?: string })?.name === 'AbortError') throw e }
    opts.onProgress?.(i + 1, n)
  }
  return pickThumbnails(stats).map((p) => ({ ...p, preview: stats.find((s) => s.t === p.t)!.preview }))
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = []; let cur = ''
  for (const w of text.split(/\s+/).filter(Boolean)) {
    const next = cur ? `${cur} ${w}` : w
    if (ctx.measureText(next).width > maxWidth && cur) { lines.push(cur); cur = w } else cur = next
  }
  if (cur) lines.push(cur)
  return lines.slice(0, 3)
}

export interface ThumbnailSpec { videoUrl: string; atSeconds: number; title: string; subtitle?: string; primary: string; text: string; logoUrl?: string | null }

/** Editable 1280x720 thumbnail from the chosen frame, business name, brand colours and verified logo. No generation service. */
export async function composeThumbnail(spec: ThumbnailSpec, signal?: AbortSignal): Promise<Blob> {
  const W = 1280, H = 720
  const frame = await grabFramePixels(spec.videoUrl, spec.atSeconds, { maxSize: 1280, signal })
  const src = toCanvas(frame)
  const canvas = document.createElement('canvas'); canvas.width = W; canvas.height = H
  const ctx = canvas.getContext('2d')!
  const s = Math.max(W / src.width, H / src.height)
  ctx.drawImage(src, (W - src.width * s) / 2, (H - src.height * s) / 2, src.width * s, src.height * s)
  const g = ctx.createLinearGradient(0, H * 0.45, 0, H)
  g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.78)')
  ctx.fillStyle = g; ctx.fillRect(0, H * 0.45, W, H * 0.55)
  ctx.fillStyle = spec.primary; ctx.fillRect(0, H - 14, W, 14)
  const x = 56
  if (spec.logoUrl) {
    try {
      const bmp = await createImageBitmap(await loadImageBlob(spec.logoUrl))
      const lh = 96, lw = Math.min(260, (bmp.width / bmp.height) * lh)
      ctx.drawImage(bmp, 56, H - 14 - 40 - lh, lw, lh); bmp.close?.()
    } catch { /* logo could not be read: the thumbnail is made without it */ }
  }
  ctx.fillStyle = spec.text; ctx.textBaseline = 'alphabetic'; ctx.font = '800 64px system-ui, sans-serif'
  const lines = wrap(ctx, spec.title, W - 112)
  let y = H - 14 - 40 - (spec.logoUrl ? 110 : 0) - (lines.length - 1) * 72
  for (const l of lines) { ctx.fillText(l, x, y); y += 72 }
  if (spec.subtitle) { ctx.font = '600 32px system-ui, sans-serif'; ctx.fillStyle = spec.primary; ctx.fillText(spec.subtitle, x, y - 8) }
  return new Promise((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error('The thumbnail could not be created.'))), 'image/png'))
}
