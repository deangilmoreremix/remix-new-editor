// [remix] Stage 11 (port H): bake a clip's pitch shift / time stretch into a new audio file for export (the same approach as the EQ bake in
// eq-bake.ts). The Remotion web renderer plays <Audio src playbackRate> as is, with no pitch shifter, so the stretched / shifted sound of the
// clip's source range is rendered once (SoundTouch on the main thread, yielding between chunks, cancellable) into a WAV blob: URL and the
// export clip then plays that file at speed 1 from 0 (see export-pitch.ts).
import { encodeWav16, MAX_BAKE_SECONDS } from './eq-bake';
import { pitchKey, pitchPlan, type ClipPitch } from './pitch';
import { renderPitchStretch } from './pitch-dsp';

/** Source audio around the segment, so SoundTouch's analysis window has real signal at both edges. */
const PAD_SECONDS = 0.2;

export interface PitchBakeRequest { url: string; trimStart: number; /** timeline seconds the clip plays */ duration: number; speed: number; pitch: ClipPitch }

const decodedCache: { url: string; job: Promise<AudioBuffer> } = { url: '', job: Promise.resolve(null as unknown as AudioBuffer) };
async function decode(url: string, signal?: AbortSignal): Promise<AudioBuffer> {
  if (decodedCache.url === url) return decodedCache.job;
  const job = (async () => {
    const res = await fetch(url, { signal });
    if (!res.ok) throw new Error(`Could not read the audio for pitch shift (HTTP ${res.status}).`);
    const bytes = await res.arrayBuffer();
    const buf = await new OfflineAudioContext(2, 1, 48000).decodeAudioData(bytes);
    if (buf.duration > MAX_BAKE_SECONDS) throw new Error(`Audio is ${Math.round(buf.duration / 60)} min long; pitch is baked for sources up to ${MAX_BAKE_SECONDS / 60} min.`);
    return buf;
  })();
  decodedCache.url = url; decodedCache.job = job;
  job.catch(() => { if (decodedCache.job === job) decodedCache.url = ''; });
  return job;
}
/** Release the decoded source kept between the pieces of one export. */
export const clearPitchDecodeCache = () => { decodedCache.url = ''; decodedCache.job = Promise.resolve(null as unknown as AudioBuffer); };

/**
 * Pure part (no Web Audio): the stretched / shifted PCM of source range [trimStart, trimStart + duration * speed) of `buf`.
 * Exactly `duration` seconds long (shorter only when the source ends first).
 */
export async function renderClipPitch(chans: Float32Array[], sampleRate: number, req: Omit<PitchBakeRequest, 'url'>, signal?: AbortSignal): Promise<Float32Array[]> {
  const total = chans[0]?.length ?? 0;
  const plan = pitchPlan(req.pitch, req.speed);
  const ratio = plan.tempo * plan.rate; // source seconds per output second
  const a = Math.max(0, Math.floor((req.trimStart - PAD_SECONDS) * sampleRate));
  const b = Math.min(total, Math.ceil((req.trimStart + req.duration * req.speed + PAD_SECONDS) * sampleRate));
  if (b <= a) return chans.map(() => new Float32Array(0));
  const rendered = await renderPitchStretch(chans.map((c) => c.subarray(a, b)), plan, { signal });
  const skip = Math.round(((req.trimStart * sampleRate - a) / ratio));
  const want = Math.round(req.duration * sampleRate);
  return rendered.map((c) => c.slice(skip, Math.min(c.length, skip + want)));
}

const cache = new Map<string, Promise<string>>();

/** Pitched / stretched copy of the clip's sound as a blob: URL of a WAV. Cached per (url, range, speed, pitch). Rejects with AbortError when cancelled. */
export function bakePitchToBlobUrl(req: PitchBakeRequest, signal?: AbortSignal): Promise<string> {
  const key = `${req.url}\n${req.trimStart}|${req.duration}|${req.speed}|${pitchKey(req.pitch)}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const job = (async () => {
    if (signal?.aborted) throw new DOMException('Pitch bake cancelled', 'AbortError');
    const buf = await decode(req.url, signal);
    const chans = Array.from({ length: Math.min(2, buf.numberOfChannels) }, (_, c) => buf.getChannelData(c));
    const out = await renderClipPitch(chans, buf.sampleRate, req, signal);
    const wav = encodeWav16({ numberOfChannels: out.length, sampleRate: buf.sampleRate, length: out[0]?.length ?? 0, getChannelData: (c) => out[c] });
    return URL.createObjectURL(new Blob([wav], { type: 'audio/wav' }));
  })();
  cache.set(key, job);
  job.catch(() => cache.delete(key));
  return job;
}
