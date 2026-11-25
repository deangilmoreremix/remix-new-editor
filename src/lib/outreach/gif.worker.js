// GIF thumbnails off the main thread (see gifEncode.js and encodeGif in thumbnail.js).
import { encodeGifBytes } from './gifEncode.js';

self.addEventListener('message', async ({ data }) => {
  const { id, input } = data || {};
  try {
    const bytes = await encodeGifBytes(input.frames, input.width, input.height, input.fps, { maxBytes: input.maxBytes });
    self.postMessage({ id, type: 'result', result: bytes }, [bytes.buffer]);
  } catch (err) {
    self.postMessage({ id, type: 'error', message: err?.message || String(err) });
  }
});
