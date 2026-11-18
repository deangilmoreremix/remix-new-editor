// src/lib/imageRefs.js
// MuAPI's image-edit models (nano-banana-edit / nano-banana-2-edit) only accept raster references. A logo that is an
// SVG / ICO / GIF — very common for brand logos — makes the whole job fail with "file format is not supported".

const UNSUPPORTED = /\.(svg|ico|gif|avif|bmp|tiff?)(?:[?#]|$)/i;

/** True when `url` can be sent as an image reference to a MuAPI edit model. */
export function isUsableImageRef(url) {
  if (typeof url !== 'string' || !url) return false;
  if (url.startsWith('data:')) return /^data:image\/(png|jpe?g|webp)/i.test(url);
  if (!/^https?:\/\//i.test(url)) return false;
  return !UNSUPPORTED.test(url);
}

/** Keeps only the references an edit model can read. */
export const usableImageRefs = (urls) => (urls || []).filter(isUsableImageRef);
