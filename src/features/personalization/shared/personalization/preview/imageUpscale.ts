/**
 * Sharpen small pictures 2x with the free on-device upscaler (Swin2SR). Scraped logos and product photos are often
 * small and soft; a sharper copy looks better when drawn large over footage. The copy is ADDED next to the original
 * (the original stays), and an upscale only ever invents plausible detail, never real information, so it is offered
 * as a choice, not applied automatically.
 */

/** Pictures whose longest side is already at least this big are not offered a 2x. */
export const SHARPEN_BELOW_PX = 900
/** Under this, it is an icon or a tracking pixel, not a picture worth sharpening. */
export const SHARPEN_MIN_PX = 24

/** Whether a "Sharpen 2x" action makes sense for this picture. Unknown size is offered (the person decides). */
export function shouldOfferSharpen(width?: number, height?: number, mimeOrUrl = ''): boolean {
  if (/svg/i.test(mimeOrUrl)) return false // already vector: nothing to sharpen
  const w = Number(width), h = Number(height)
  if (!(w > 0) || !(h > 0)) return true
  const longest = Math.max(w, h)
  return longest >= SHARPEN_MIN_PX && longest < SHARPEN_BELOW_PX
}

/** "logo.png" -> "logo-sharper.png"; always a PNG (the upscaler returns PNG bytes). */
export function sharpenedFileName(name: string): string {
  const base = (name || 'image').replace(/\.[a-z0-9]{2,5}$/i, '').replace(/-sharper$/i, '')
  return `${base}-sharper.png`
}

export function blobToFile(blob: Blob, name: string): File {
  return new File([blob], name, { type: blob.type || 'image/png' })
}

/**
 * The provider adds pictures from a FileList. Browsers can build one from a File; where they cannot (older engines,
 * test environments) the caller falls back to adding by URL.
 */
export function fileToFileList(file: File): FileList | null {
  try {
    if (typeof DataTransfer === 'undefined') return null
    const dt = new DataTransfer()
    dt.items.add(file)
    return dt.files
  } catch { return null }
}
