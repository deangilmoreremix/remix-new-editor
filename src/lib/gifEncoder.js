/**
 * Animated-GIF assembly for the thumbnail studio. The encoder itself now lives in
 * src/features/personalization/shared/personalization/gif/gifCodec.ts (median-cut palette over ALL frames, exact colours for
 * flat graphics, integer-keyed LZW, changed-rectangle frames); this file only turns data-URL frames into pixels and the result
 * back into a data URL.
 *
 * The previous implementation drew each frame before its image had finished loading (blank frames), indexed every frame against
 * the first frame's palette, and overflowed the stack on real-sized output. It is async now because decoding an image is.
 */
import { encodeGif as encodeGifBytes } from '../features/personalization/shared/personalization/gif/gifCodec.ts';

const stripPrefix = (s) => (typeof s === 'string' ? s.replace(/^data:image\/[\w+.-]+;base64,/, '') : '');

/** Pure: RGBA frames → GIF data URL ('' when there is nothing to encode). */
export function encodeGifFromPixels(frames, width, height, delayMs = 500) {
  const list = (frames || []).filter((f) => f && f.length >= width * height * 4);
  if (list.length === 0) return '';
  const { bytes } = encodeGifBytes({ width, height, frames: list.map((rgba) => ({ rgba })), delayMs: Math.max(40, delayMs), loop: 0 });
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return `data:image/gif;base64,${btoa(binary)}`;
}

async function decodeFrame(src, width, height) {
  const b64 = stripPrefix(src);
  if (!b64) return null;
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
  // Wait for the picture to be decoded BEFORE drawing it.
  const bitmap = await createImageBitmap(new Blob([bytes]));
  try {
    const canvas = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(width, height) : Object.assign(document.createElement('canvas'), { width, height });
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(bitmap, 0, 0, width, height);
    return ctx.getImageData(0, 0, width, height).data;
  } finally {
    bitmap.close?.();
  }
}

/** @returns {Promise<string>} a data:image/gif URL, or '' when no frame could be decoded. */
export async function encodeGif(frameDataUrls, width, height, delayMs = 500) {
  if (!Array.isArray(frameDataUrls) || frameDataUrls.length === 0) {
    console.warn('[gifEncoder] No frames provided');
    return '';
  }
  const pixels = [];
  for (const src of frameDataUrls) {
    try {
      const px = await decodeFrame(src, width, height);
      if (px) pixels.push(px);
    } catch (err) {
      console.warn('[gifEncoder] A frame could not be decoded and was skipped:', err?.message || err);
    }
  }
  if (pixels.length === 0) {
    console.warn('[gifEncoder] No valid frames decoded');
    return '';
  }
  return encodeGifFromPixels(pixels, width, height, delayMs);
}
