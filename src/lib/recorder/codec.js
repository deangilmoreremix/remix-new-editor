// Ported from Remotion Recorder (https://github.com/remotion-dev/recorder, commit 4c09934),
// src/helpers/find-good-supported-codec.ts. Remotion Recorder is under the Remotion license
// (https://www.remotion.dev/license); see ./README.md.
import { Mp4OutputFormat, WebMOutputFormat } from 'mediabunny';

export const MP4_WITH_AUDIO = 'video/mp4;codecs=avc1,mp4a.40.2';
export const MP4_WITHOUT_AUDIO = 'video/mp4;codecs=avc1';
export const WEBM_WITH_AUDIO = 'video/webm;codecs=vp8,opus';
export const WEBM_WITHOUT_AUDIO = 'video/webm;codecs=vp8';
// Audio-only takes (voice samples) are not a Recorder mode; Opus in WebM is the widely supported choice.
export const AUDIO_ONLY = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/webm'];

const supported = (type, Recorder = globalThis.MediaRecorder) => !!Recorder?.isTypeSupported?.(type);

/** MP4 (H.264/AAC) first, then WebM (VP8/Opus), as Recorder does. Throws when neither records. */
export function findGoodSupportedCodec(withAudio, { audioOnly = false, Recorder } = {}) {
  if (audioOnly) {
    const hit = AUDIO_ONLY.find((t) => supported(t, Recorder));
    if (hit) return hit;
    throw new Error('This browser cannot record audio.');
  }
  const order = withAudio ? [MP4_WITH_AUDIO, WEBM_WITH_AUDIO] : [MP4_WITHOUT_AUDIO, WEBM_WITHOUT_AUDIO];
  const hit = order.find((t) => supported(t, Recorder));
  if (hit) return hit;
  throw new Error('No supported codec found');
}

export function getMediabunnyOutput(mimeType) {
  if (mimeType.includes('mp4')) return new Mp4OutputFormat();
  if (mimeType.includes('webm')) return new WebMOutputFormat();
  throw new Error('Unsupported mime type: ' + mimeType);
}

export function getExtension(mimeType) {
  if (mimeType.includes('mp4')) return 'mp4';
  if (mimeType.includes('webm')) return 'webm';
  throw new Error('Unsupported mime type: ' + mimeType);
}
