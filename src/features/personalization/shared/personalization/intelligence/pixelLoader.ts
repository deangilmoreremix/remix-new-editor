import { loadImageBlob } from '../backgroundRemoval/loadImageBlob'
import type { PixelBuffer } from './imageIntel'

export interface LoadedPixels extends PixelBuffer { naturalWidth: number; naturalHeight: number }

/**
 * Decodes an image (data URL, blob URL or website image via the existing safe download proxy) into a small RGBA
 * buffer for analysis. The original file is never modified. Returns null when the browser cannot decode it.
 */
export async function loadPixels(url: string, maxSide = 256, signal?: AbortSignal): Promise<LoadedPixels | null> {
  try {
    if (signal?.aborted) return null
    const blob = url.startsWith('blob:') ? await (await fetch(url)).blob() : await loadImageBlob(url)
    if (signal?.aborted) return null
    const bmp = await createImageBitmap(blob)
    const scale = Math.min(1, maxSide / Math.max(bmp.width, bmp.height))
    const w = Math.max(1, Math.round(bmp.width * scale)), h = Math.max(1, Math.round(bmp.height * scale))
    const canvas = document.createElement('canvas')
    canvas.width = w; canvas.height = h
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) { bmp.close?.(); return null }
    ctx.drawImage(bmp, 0, 0, w, h)
    const out = { data: ctx.getImageData(0, 0, w, h).data, width: w, height: h, naturalWidth: bmp.width, naturalHeight: bmp.height }
    bmp.close?.()
    return out
  } catch {
    return null
  }
}
