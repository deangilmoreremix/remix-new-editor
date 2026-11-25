// @vitest-environment node
import { describe, it, expect, vi, afterEach } from 'vitest';
import { encodeGif, _setGifWorker } from '../thumbnail.js';
import { encodeGifBytes } from '../gifEncode.js';

const frame = (v, w = 4, h = 4) => new Uint8ClampedArray(w * h * 4).fill(v);
const bytesOf = async (blob) => new Uint8Array(await blob.arrayBuffer());

describe('GIF encoding in a worker', () => {
  afterEach(() => _setGifWorker(null));

  it('uses the worker when there is one, and gets the same bytes as inline', async () => {
    const frames = [frame(10), frame(200), frame(90)];
    const inline = await encodeGifBytes(frames, 4, 4, 12, { maxBytes: Infinity });
    // A stand-in worker that runs the same encoder.
    const run = vi.fn(async (task, input) => encodeGifBytes(input.frames, input.width, input.height, input.fps, { maxBytes: input.maxBytes }));
    _setGifWorker({ run });
    const viaWorker = await bytesOf(await encodeGif(frames, 4, 4, 12, { maxBytes: Infinity }));
    expect(run).toHaveBeenCalledWith('gif', expect.objectContaining({ width: 4, height: 4, fps: 12 }), expect.any(Object));
    expect(viaWorker).toEqual(inline);
  });

  it('falls back to encoding here when the worker fails', async () => {
    _setGifWorker({ run: vi.fn(async () => { throw new Error('blocked by CSP'); }) });
    const blob = await encodeGif([frame(0), frame(255)], 4, 4);
    expect(blob.type).toBe('image/gif');
    expect(String.fromCharCode(...(await bytesOf(blob)).slice(0, 6))).toBe('GIF89a');
  });

  it('stops when asked, without falling back', async () => {
    _setGifWorker({ run: vi.fn(async () => { throw Object.assign(new Error('Cancelled'), { name: 'AbortError' }); }) });
    await expect(encodeGif([frame(0), frame(1)], 4, 4)).rejects.toMatchObject({ name: 'AbortError' });
  });
});
