/**
 * Measures assigned images in the browser so styling can be decided without
 * touching the files: natural aspect ratio, transparent corners and an existing
 * decorative frame (see `analyzeImagePixels`). If the pixels cannot be read
 * (cross-origin without CORS) only the aspect ratio is reported — never a guess.
 * No timers: a browser always fires `onload` or `onerror`, and nothing waits on this.
 */
import { analyzeImagePixels } from './imagePixels'
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
