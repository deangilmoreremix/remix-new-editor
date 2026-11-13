// [remix] Stage 4: bake a clip's EQ into a new audio file for export. The Remotion web renderer plays <Audio src> as is and has no filter
// chain, so the EQ'd sound is rendered once with an OfflineAudioContext (the same BiquadFilterNode chain the preview uses) and the export
// clip points at the resulting WAV (a blob: URL; export-client.js already ships blob: URLs to the sandboxed renderer as Blobs).
import { type ClipEq, isEqActive, normalizeClipEq, webAudioQ } from './eq';

/** Longest source the bake will process (decoded stereo float audio is about 23 MB per minute at 48 kHz). */
export const MAX_BAKE_SECONDS = 20 * 60;

interface PcmLike { numberOfChannels: number; sampleRate: number; length: number; getChannelData(ch: number): Float32Array }

/** 16-bit PCM WAV (RIFF) file from decoded audio. Pure: tested without a browser. */
export function encodeWav16(buf: PcmLike): ArrayBuffer {
  const ch = Math.max(1, buf.numberOfChannels);
  const frames = buf.length;
  const dataBytes = frames * ch * 2;
  const out = new ArrayBuffer(44 + dataBytes);
  const v = new DataView(out);
  const str = (o: number, s: string) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  str(0, 'RIFF'); v.setUint32(4, 36 + dataBytes, true); str(8, 'WAVE'); str(12, 'fmt ');
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, ch, true); v.setUint32(24, buf.sampleRate, true);
  v.setUint32(28, buf.sampleRate * ch * 2, true); v.setUint16(32, ch * 2, true); v.setUint16(34, 16, true);
  str(36, 'data'); v.setUint32(40, dataBytes, true);
  const data = Array.from({ length: ch }, (_, c) => buf.getChannelData(c));
  let o = 44;
  for (let i = 0; i < frames; i++) {
    for (let c = 0; c < ch; c++) {
      const s = Math.max(-1, Math.min(1, data[c][i]));
      v.setInt16(o, s < 0 ? s * 0x8000 : s * 0x7fff, true);
      o += 2;
    }
  }
  return out;
}

/** Run decoded audio through the EQ chain with an OfflineAudioContext. */
export async function renderEq(input: AudioBuffer, eq: ClipEq): Promise<AudioBuffer> {
  const ctx = new OfflineAudioContext(input.numberOfChannels, input.length, input.sampleRate);
  const src = ctx.createBufferSource();
  src.buffer = input;
  let tail: AudioNode = src;
  for (const band of eq.bands) {
    if (!band.enabled) continue;
    const f = ctx.createBiquadFilter();
    f.type = band.type; f.frequency.value = band.frequency; f.gain.value = band.gain; f.Q.value = webAudioQ(band);
    tail.connect(f); tail = f;
  }
  tail.connect(ctx.destination);
  src.start(0);
  return ctx.startRendering();
}

const cache = new Map<string, Promise<string>>();

/** EQ'd copy of the audio at `url` as a blob: URL of a WAV file. Cached per (url, EQ). Rejects with AbortError when cancelled. */
export function bakeEqToBlobUrl(url: string, eqInput: ClipEq, signal?: AbortSignal): Promise<string> {
  const eq = normalizeClipEq(eqInput);
  if (!eq || !isEqActive(eq)) return Promise.resolve(url);
  const key = `${url}\n${JSON.stringify(eq)}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const job = (async () => {
    const abort = () => { throw new DOMException('EQ bake cancelled', 'AbortError'); };
    if (signal?.aborted) abort();
    const res = await fetch(url, { signal });
    if (!res.ok) throw new Error(`Could not read the audio for EQ (HTTP ${res.status}).`);
    const bytes = await res.arrayBuffer();
    if (signal?.aborted) abort();
    const decoded = await new OfflineAudioContext(2, 1, 48000).decodeAudioData(bytes);
    if (decoded.duration > MAX_BAKE_SECONDS) throw new Error(`Audio is ${Math.round(decoded.duration / 60)} min long; EQ is baked for sources up to ${MAX_BAKE_SECONDS / 60} min.`);
    const rendered = await renderEq(decoded, eq);
    if (signal?.aborted) abort();
    return URL.createObjectURL(new Blob([encodeWav16(rendered)], { type: 'audio/wav' }));
  })();
  cache.set(key, job);
  job.catch(() => cache.delete(key)); // a failed or cancelled bake is retried next time
  return job;
}
