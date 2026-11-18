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
