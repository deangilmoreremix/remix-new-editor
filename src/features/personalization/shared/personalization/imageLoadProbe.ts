/**
 * Whether the browser can show an image straight from its own address.
 *
 * Discovered website images are linked by that address instead of being
 * copied to storage. A site that blocks other sites from showing its images
 * fails this check, and that image is downloaded and stored instead.
 */
export const IMAGE_LOAD_TIMEOUT_MS = 6000

export function imageLoadsInBrowser(url: string, timeoutMs = IMAGE_LOAD_TIMEOUT_MS): Promise<boolean> {
  if (!url || typeof Image === 'undefined') return Promise.resolve(false)
  // jsdom never loads images, so the check would only ever time out there.
  if (typeof navigator !== 'undefined' && /jsdom/i.test(navigator.userAgent)) return Promise.resolve(false)
  return new Promise((resolve) => {
    const img = new Image()
    // Declared before `done`, which clears it.
    let timer: ReturnType<typeof setTimeout> | undefined
    const done = (ok: boolean) => {
      clearTimeout(timer)
      img.onload = null
      img.onerror = null
      resolve(ok)
    }
    timer = setTimeout(() => done(false), timeoutMs)
    img.onload = () => done(img.naturalWidth > 0)
    img.onerror = () => done(false)
    img.src = url
  })
}
