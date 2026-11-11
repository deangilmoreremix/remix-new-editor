/**
 * Re-encodes an image data URL as PNG so the image models accept it.
 *
 * Discovered assets come in whatever format the website serves: SVG and ICO
 * logos, AVIF photos, or files whose bytes do not match their content type.
 * The vision and edit APIs accept only JPEG, PNG, GIF and WebP, and reject the
 * rest with "The image data you provided does not represent a valid image".
 * Drawing the image onto a canvas decodes it the way the browser displays it
 * and gives back a PNG the APIs accept. Large images are scaled down so the
 * PNG stays well inside the upload limits.
 */
export const NORMALIZED_MAX_DIMENSION = 1536

/** Formats the vision and edit APIs accept as-is. */
const MODEL_SUPPORTED_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif']

/**
 * Re-encodes only what the models would reject (SVG, ICO, AVIF, …) and leaves
 * a supported image untouched, keeping its size and compression. The image
 * editor uses this: its masks are drawn at the natural size, and a full-size
 * PNG of a large photo can outgrow the request limits a JPEG fits.
 */
export async function ensureModelSupportedImage(dataUrl: string): Promise<string> {
  const mime = dataUrl.slice(5, dataUrl.indexOf(';')).toLowerCase()
  if (MODEL_SUPPORTED_TYPES.includes(mime)) return dataUrl
  return normalizeImageDataUrl(dataUrl, Number.POSITIVE_INFINITY)
}

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('This image could not be read. Try another image or upload your own.'))
    img.src = src
  })
}

export async function normalizeImageDataUrl(dataUrl: string, maxDimension = NORMALIZED_MAX_DIMENSION): Promise<string> {
  const img = await loadImage(dataUrl)
  // SVGs without intrinsic dimensions report 0; give them a usable size that
  // stays finite even when resizing is off (maxDimension = Infinity).
  const fallback = Number.isFinite(maxDimension) ? maxDimension : NORMALIZED_MAX_DIMENSION
  const width = img.naturalWidth || fallback
  const height = img.naturalHeight || fallback
  const scale = Math.min(1, maxDimension / Math.max(width, height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(width * scale))
  canvas.height = Math.max(1, Math.round(height * scale))
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('This browser cannot prepare images for editing.')
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
  return canvas.toDataURL('image/png')
}
