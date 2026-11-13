/**
 * The legacy thumbnail-studio GIF entry point now delegates to the new codec. The decode-from-data-URL half needs a browser
 * (createImageBitmap + canvas) and is covered by the Stage 7 real-browser check; here the pure half and the guard rails.
 */
import { describe, expect, it } from 'vitest';
import { decodeGif } from '../../features/personalization/shared/personalization/gif/gifCodec.ts';
import { encodeGif, encodeGifFromPixels } from '../gifEncoder.js';

const px = (w, h, fn) => { const a = new Uint8ClampedArray(w * h * 4); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const [r, g, b] = fn(x, y); const i = (y * w + x) * 4; a[i] = r; a[i + 1] = g; a[i + 2] = b; a[i + 3] = 255; } return a; };
const fromDataUrl = (u) => Uint8Array.from(atob(u.replace('data:image/gif;base64,', '')), (c) => c.charCodeAt(0));

describe('legacy gifEncoder wrapper', () => {
  it('encodes RGBA frames to a GIF data URL whose EVERY frame is right (the old encoder got frames 2+ wrong)', () => {
    const cols = [[255, 0, 0], [0, 255, 0], [0, 0, 255]];
    const url = encodeGifFromPixels(cols.map((c) => px(20, 10, () => c)), 20, 10, 300);
    expect(url.startsWith('data:image/gif;base64,')).toBe(true);
    const g = decodeGif(fromDataUrl(url));
    expect(g.frames.length).toBe(3);
    cols.forEach((c, i) => expect(Array.from(g.frames[i].rgba.slice(0, 3))).toEqual(c));
    expect(g.frames[0].delayMs).toBe(300);
  });
  it('a real-sized, many-colour output does not overflow the stack', () => {
    const w = 640, h = 360; const f = px(w, h, (x, y) => [x % 256, y % 256, (x + y) % 256]);
    const url = encodeGifFromPixels([f, f], w, h, 100);
    expect(decodeGif(fromDataUrl(url)).width).toBe(w);
  });
  it('nothing to encode → empty string, as before', async () => {
    expect(encodeGifFromPixels([], 4, 4)).toBe('');
    expect(encodeGifFromPixels([new Uint8ClampedArray(3)], 4, 4)).toBe('');
    expect(await encodeGif([], 4, 4)).toBe('');
    expect(await encodeGif(null, 4, 4)).toBe('');
  });
});
