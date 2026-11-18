/**
 * Turn a recording (WebM video or audio) into a clean voice sample for
 * cloning: decode the audio in the browser, mix to mono, trim to the first
 * MAX_SECONDS and encode as 16-bit PCM WAV. MiniMax gets a plain audio file
 * instead of a video container it may not accept.
 */
export const MIN_SECONDS = 10;
export const MAX_SECONDS = 60;
export const SAMPLE_RATE = 24000;

/** Mono 16-bit PCM WAV bytes from Float32 samples in [-1, 1]. */
export function encodeWavBuffer(samples, sampleRate = SAMPLE_RATE) {
  const bytes = 44 + samples.length * 2;
  const buf = new ArrayBuffer(bytes);
  const v = new DataView(buf);
  const str = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  str(0, 'RIFF'); v.setUint32(4, bytes - 8, true); str(8, 'WAVE');
  str(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, sampleRate, true); v.setUint32(28, sampleRate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
  str(36, 'data'); v.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i++) {
    const x = Math.max(-1, Math.min(1, samples[i] || 0));
    v.setInt16(44 + i * 2, x < 0 ? x * 0x8000 : x * 0x7fff, true);
  }
  return buf;
}

export function encodeWav(samples, sampleRate = SAMPLE_RATE) {
  return new Blob([encodeWavBuffer(samples, sampleRate)], { type: 'audio/wav' });
}

/** Average the channels of a decoded AudioBuffer into one, keeping at most `maxSamples`. */
export function mixToMono(audioBuffer, maxSamples = Infinity) {
  const n = Math.min(audioBuffer.length, maxSamples);
  const out = new Float32Array(n);
  const channels = audioBuffer.numberOfChannels || 1;
  for (let c = 0; c < channels; c++) {
    const data = audioBuffer.getChannelData(c);
    for (let i = 0; i < n; i++) out[i] += data[i] / channels;
  }
  return out;
}

/**
 * Recording blob → { file: File (audio/wav), seconds }.
 * Throws a readable error when the recording has no sound or is too short.
 */
export async function extractVoiceSample(blob, { maxSeconds = MAX_SECONDS, minSeconds = MIN_SECONDS } = {}) {
  const Ctx = globalThis.OfflineAudioContext || globalThis.webkitOfflineAudioContext;
  if (!Ctx) throw new Error('This browser cannot prepare a voice sample. Try Chrome or Edge.');
  // Decode at the target rate: OfflineAudioContext resamples while decoding.
  const ctx = new Ctx(1, SAMPLE_RATE, SAMPLE_RATE);
  let decoded;
  try {
    decoded = await ctx.decodeAudioData(await blob.arrayBuffer());
  } catch {
    throw new Error('Could not read the sound in this recording. Record again with the microphone on.');
  }
  const samples = mixToMono(decoded, Math.round(maxSeconds * decoded.sampleRate));
  const seconds = samples.length / decoded.sampleRate;
  if (seconds < minSeconds) throw new Error(`The voice sample needs at least ${minSeconds} seconds of speech.`);
  let peak = 0;
  for (let i = 0; i < samples.length; i++) peak = Math.max(peak, Math.abs(samples[i]));
  if (peak < 0.01) throw new Error('The recording is silent. Check the microphone and record again.');
  const wav = encodeWav(samples, decoded.sampleRate);
  return { file: new File([wav], 'voice-sample.wav', { type: 'audio/wav' }), seconds };
}
