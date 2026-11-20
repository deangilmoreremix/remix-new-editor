/**
 * Waveform peaks for an audio file, decoded in the browser with the Web Audio API. Results are cached per URL and a failure
 * (blocked file, undecodable format) returns null so the UI simply shows no waveform.
 */
const CACHE = new Map<string, Promise<WaveformData | null>>();

export interface WaveformData {
  /** One 0..1 peak per bucket across the whole file. */
  peaks: number[]
  durationSec: number
}

/** Reduces decoded samples to `buckets` absolute peaks, normalized so the loudest bucket is 1. Pure. */
export function peaksFromSamples(samples: Float32Array, buckets: number): number[] {
  const n = Math.max(1, Math.round(buckets));
  const out = new Array<number>(n).fill(0);
  if (samples.length === 0) return out;
  const size = samples.length / n;
  let max = 0;
  for (let b = 0; b < n; b++) {
    const from = Math.floor(b * size);
    const to = Math.min(samples.length, Math.max(from + 1, Math.floor((b + 1) * size)));
    let peak = 0;
    for (let i = from; i < to; i++) { const v = Math.abs(samples[i]); if (v > peak) peak = v; }
    out[b] = peak;
    if (peak > max) max = peak;
  }
  return max > 0 ? out.map((p) => p / max) : out;
}

export function loadWaveform(url: string, buckets = 200): Promise<WaveformData | null> {
  const key = `${url}|${buckets}`;
  let entry = CACHE.get(key);
  if (!entry) {
    entry = (async () => {
      try {
        const Ctx = typeof window !== 'undefined' ? (window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext) : undefined;
        if (!Ctx) return null;
        const res = await fetch(url);
        if (!res.ok) return null;
        const buf = await res.arrayBuffer();
        const ctx = new Ctx();
        try {
          const audio = await ctx.decodeAudioData(buf);
          return { peaks: peaksFromSamples(audio.getChannelData(0), buckets), durationSec: audio.duration };
        } finally {
          void ctx.close();
        }
      } catch {
        return null;
      }
    })();
    CACHE.set(key, entry);
  }
  return entry;
}
