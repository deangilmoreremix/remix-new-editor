// src/lib/outreach/gifEncode.js
//
// The pure part of making a GIF thumbnail: RGBA frames → GIF bytes (gifenc, a palette per frame).
// Runs in gif.worker.js so a big campaign doesn't freeze the page, or inline where workers aren't
// available. Same input, same bytes, either way.

/**
 * Loops forever. If it is bigger than `maxBytes` it is made again at 8 frames a second, then with
 * 128 colours, so email apps can show it.
 * @returns {Promise<Uint8Array>}
 */
export async function encodeGifBytes(frames, width, height, fps, { maxBytes = Infinity } = {}) {
  const { GIFEncoder, quantize, applyPalette } = await import('gifenc');
  const encode = (list, rate, colors) => {
    const gif = GIFEncoder();
    const delay = Math.round(1000 / rate);
    list.forEach((rgba, i) => {
      const palette = quantize(rgba, colors);
      gif.writeFrame(applyPalette(rgba, palette), width, height, { palette, delay, ...(i === 0 ? { repeat: 0 } : {}) });
    });
    gif.finish();
    return gif.bytes();
  };
  let bytes = encode(frames, fps, 256);
  if (bytes.length > maxBytes && frames.length > 2) {
    // 12 -> 8 frames a second: keep two frames in every three (the first frame always stays).
    const fewer = frames.filter((_, i) => i % 3 !== 2);
    const rate = fps * (2 / 3);
    bytes = encode(fewer, rate, 256);
    if (bytes.length > maxBytes) bytes = encode(fewer, rate, 128);
  }
  return bytes;
}
