/**
 * Measures assigned images in the browser so styling can be decided without
 * touching the files: natural aspect ratio, transparent corners and an existing
 * decorative frame (see `analyzeImagePixels`). If the pixels cannot be read
 * (cross-origin without CORS) only the aspect ratio is reported — never a guess.
 * No timers: a browser always fires `onload` or `onerror`, and nothing waits on this.
 */
import { analyzeImagePixels, transparentContentBox } from './imagePixels'
import type { ImageHints } from './imageStyle'

const SIZE = 64

export function measureImageHints(urls: string[]): Promise<Record<string, ImageHints>> {
  if (typeof Image === 'undefined' || typeof document === 'undefined') return Promise.resolve({})
  const unique = Array.from(new Set(urls.filter((u) => u && !u.startsWith('blob:'))))
  return Promise.all(
    unique.map(
      (url) =>
        new Promise<[string, ImageHints | null]>((resolve) => {
          const img = new Image()
          img.crossOrigin = 'anonymous'
          img.onload = () => {
            const w = img.naturalWidth
            const h = img.naturalHeight
            if (!(w > 0 && h > 0)) return resolve([url, null])
            const hint: ImageHints = { aspect: w / h }
            try {
              const cw = w >= h ? SIZE : Math.max(8, Math.round((SIZE * w) / h))
              const ch = w >= h ? Math.max(8, Math.round((SIZE * h) / w)) : SIZE
              const canvas = document.createElement('canvas')
              canvas.width = cw
              canvas.height = ch
              const ctx = canvas.getContext('2d', { willReadFrequently: true })
              if (ctx) {
                ctx.drawImage(img, 0, 0, cw, ch)
                const a = analyzeImagePixels(ctx.getImageData(0, 0, cw, ch).data, cw, ch)
                if (a.transparentCorners) hint.transparentCorners = true
                if (a.alreadyFramed) hint.alreadyFramed = true
                if (a.hasTransparency) hint.hasTransparency = true
              }
            } catch {
              /* tainted canvas: aspect only */
            }
            resolve([url, hint])
          }
          img.onerror = () => resolve([url, null])
          img.src = url
        }),
    ),
  ).then((pairs) => {
    const out: Record<string, ImageHints> = {}
    for (const [url, hint] of pairs) if (hint) out[url] = hint
    return out
  })
}

const TRIM_MAX_SIDE = 512
const TRIM_OUT_MAX_SIDE = 1024
const TRIM_MAX_DATA_URL = 150_000

/**
 * For a TRANSPARENT logo: a copy with its empty padding cropped away, as a PNG data URL, or null when there is
 * nothing worth trimming, the pixels cannot be read (cross-origin without CORS), or the result would be large.
 * The original file is untouched; null always means "keep using the original".
 */
export function measureLogoTrim(url: string): Promise<string | null> {
  if (typeof Image === 'undefined' || typeof document === 'undefined' || !url || url.startsWith('blob:')) return Promise.resolve(null)
  return new Promise((resolve) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      try {
        const w = img.naturalWidth
        const h = img.naturalHeight
        if (!(w > 0 && h > 0)) return resolve(null)
        const scale = Math.min(1, TRIM_MAX_SIDE / Math.max(w, h))
        const cw = Math.max(3, Math.round(w * scale))
        const ch = Math.max(3, Math.round(h * scale))
        const canvas = document.createElement('canvas')
        canvas.width = cw
        canvas.height = ch
        const ctx = canvas.getContext('2d', { willReadFrequently: true })
        if (!ctx) return resolve(null)
        ctx.drawImage(img, 0, 0, cw, ch)
        const box = transparentContentBox(ctx.getImageData(0, 0, cw, ch).data, cw, ch)
        if (!box) return resolve(null)
        // Crop from the ORIGINAL pixels (not the small analysis copy) so the logo stays sharp; cap the output size.
        const sx = Math.round(box.x * w), sy = Math.round(box.y * h)
        const sw = Math.max(1, Math.round(box.w * w)), sh = Math.max(1, Math.round(box.h * h))
        const outScale = Math.min(1, TRIM_OUT_MAX_SIDE / Math.max(sw, sh))
        const out = document.createElement('canvas')
        out.width = Math.max(1, Math.round(sw * outScale))
        out.height = Math.max(1, Math.round(sh * outScale))
        const octx = out.getContext('2d')
        if (!octx) return resolve(null)
        octx.drawImage(img, sx, sy, sw, sh, 0, 0, out.width, out.height)
        const dataUrl = out.toDataURL('image/png')
        resolve(dataUrl.length <= TRIM_MAX_DATA_URL ? dataUrl : null)
      } catch {
        resolve(null) // tainted canvas or encode failure: keep the original
      }
    }
    img.onerror = () => resolve(null)
    img.src = url
  })
}
