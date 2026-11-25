// Ported from Remotion Recorder (https://github.com/remotion-dev/recorder, commit 4c09934),
// src/helpers/convert-in-browser.ts: re-mux / re-encode a take with Mediabunny, keeping the first
// video track and at most 1080p.
import { ALL_FORMATS, BlobSource, BufferTarget, Conversion, Input, Output } from 'mediabunny';
import { getMediabunnyOutput } from './codec.js';

export async function convertInBrowser({ src, mimeType, onProgress }) {
  const input = new Input({ formats: ALL_FORMATS, source: new BlobSource(src) });
  const output = new Output({ format: getMediabunnyOutput(mimeType), target: new BufferTarget() });
  const conversion = await Conversion.init({
    input,
    output,
    video: (videoTrack, n) => (n > 1 ? { discard: true } : { height: Math.min(videoTrack.displayHeight, 1080) }),
  });
  conversion.onProgress = (progress) => onProgress?.(progress, () => conversion.cancel());
  if (!conversion.isValid) throw new Error('Conversion is not valid');
  await conversion.execute();
  if (!output.target.buffer) throw new Error('Conversion failed');
  return new Blob([output.target.buffer], { type: mimeType.split(';')[0] });
}

/** Cut a take to [start, end] seconds (Mediabunny), keeping its format. Copies where it can, so it is quick. */
export async function trimTake(blob, { start = 0, end, onProgress } = {}) {
  const mimeType = blob.type || 'video/webm';
  const input = new Input({ formats: ALL_FORMATS, source: new BlobSource(blob) });
  const output = new Output({ format: getMediabunnyOutput(mimeType), target: new BufferTarget() });
  const conversion = await Conversion.init({ input, output, trim: { start, ...(end != null ? { end } : {}) } });
  conversion.onProgress = (p) => onProgress?.(p);
  if (!conversion.isValid) throw new Error('This take cannot be trimmed in the browser.');
  await conversion.execute();
  if (!output.target.buffer) throw new Error('Trimming failed');
  return new Blob([output.target.buffer], { type: mimeType.split(';')[0] });
}
