/**
 * Helpers around the app's existing on-device background removal (BG0: BiRefNet on WebGPU, WebAssembly fallback):
 * a consent record (the model is ~190 MB and must never download silently) and compositing the cut-out onto a new background.
 * The removal itself is `removeAssetBackground` in shared/personalization/backgroundRemoval/backgroundRemovalClient.
 */
const CONSENT_KEY = 'remix-bg0-consent'

export function hasBackgroundModelConsent(storage: Pick<Storage, 'getItem'> | undefined = safeStorage()): boolean {
  try { return storage?.getItem(CONSENT_KEY) === '1' } catch { return false }
}
export function rememberBackgroundModelConsent(storage: Pick<Storage, 'setItem'> | undefined = safeStorage()): void {
  try { storage?.setItem(CONSENT_KEY, '1') } catch { /* storage blocked: ask again next time */ }
}
function safeStorage(): Storage | undefined { try { return globalThis.localStorage } catch { return undefined } }

/** Largest centred source rectangle with the destination's aspect ("cover"), so a background picture fills the frame without stretching. */
export function coverRect(srcW: number, srcH: number, dstW: number, dstH: number) {
  if (!(srcW > 0 && srcH > 0 && dstW > 0 && dstH > 0)) throw new Error('Sizes must be positive.')
  const k = Math.max(dstW / srcW, dstH / srcH)
  const sw = dstW / k, sh = dstH / k
  return { sx: (srcW - sw) / 2, sy: (srcH - sh) / 2, sw, sh }
}

export interface CompositeDeps {
  bitmap: (b: Blob) => Promise<{ width: number; height: number; close?: () => void }>
  canvas: (w: number, h: number) => { getContext: (t: '2d') => any; toBlob: (cb: (b: Blob | null) => void, type?: string, q?: number) => void }
}
const defaultDeps = (): CompositeDeps => ({
  bitmap: (b) => createImageBitmap(b) as any,
  canvas: (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c as any },
})

/**
 * Puts a transparent cut-out on a solid colour or a picture. Result is a JPEG by default (most platforms flatten transparency
 * anyway); pass image/png to keep the file lossless. The background picture is cropped to fill, never stretched.
 */
export async function compositeOnBackground(
  subject: Blob,
  bg: { color?: string; image?: Blob },
  { mime = 'image/jpeg', quality = 0.92, deps = defaultDeps() }: { mime?: 'image/jpeg' | 'image/png'; quality?: number; deps?: CompositeDeps } = {},
): Promise<Blob> {
  if (!bg.color && !bg.image) throw new Error('Choose a background colour or picture.')
  const fg = await deps.bitmap(subject)
  let back: Awaited<ReturnType<CompositeDeps['bitmap']>> | null = null
  try {
    const c = deps.canvas(fg.width, fg.height)
    const ctx = c.getContext('2d')
    if (!ctx) throw new Error('Canvas is not available in this browser.')
    if (bg.image) {
      back = await deps.bitmap(bg.image)
      const r = coverRect(back.width, back.height, fg.width, fg.height)
      ctx.drawImage(back, r.sx, r.sy, r.sw, r.sh, 0, 0, fg.width, fg.height)
    } else {
      ctx.fillStyle = bg.color as string
      ctx.fillRect(0, 0, fg.width, fg.height)
    }
    ctx.drawImage(fg, 0, 0)
    return await new Promise<Blob>((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('Could not encode the image.'))), mime, quality))
  } finally {
    fg.close?.()
    back?.close?.()
  }
}
