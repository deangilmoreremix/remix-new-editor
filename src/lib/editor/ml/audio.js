/**
 * Audio decoding for local AI (CLAP wants 48 kHz, pyannote and Whisper 16 kHz).
 */

/** Mono-mix and linearly resample PCM channels to `rate`. */
export function mixAndResample(channels, fromRate, rate) {
  const len = channels[0]?.length || 0;
  const mono = new Float32Array(len);
  for (const ch of channels) for (let i = 0; i < len; i += 1) mono[i] += ch[i] / channels.length;
  if (fromRate === rate) return mono;
  const ratio = fromRate / rate;
  const out = new Float32Array(Math.floor(len / ratio));
  for (let i = 0; i < out.length; i += 1) {
    const x = i * ratio;
    const i0 = Math.floor(x);
    out[i] = mono[i0] + (mono[Math.min(len - 1, i0 + 1)] - mono[i0]) * (x - i0);
  }
  return out;
}

/** Fetch media and decode to mono PCM at `sampleRate`, cut to [fromSec, toSec). */
export async function decodeAudioAt(src, { sampleRate = 16000, fromSec = 0, toSec = Infinity, signal } = {}) {
  const res = await fetch(src, { signal });
  if (!res.ok) throw new Error(`Couldn't load the clip's media (HTTP ${res.status})`);
  const buf = await res.arrayBuffer();
  const Ctx = globalThis.OfflineAudioContext || globalThis.webkitOfflineAudioContext;
  if (!Ctx) throw new Error('This browser cannot decode audio');
  const ctx = new Ctx(1, 1, sampleRate);
  let audio;
  try {
    audio = await ctx.decodeAudioData(buf);
  } catch {
    throw new Error('This clip has no audio track that the browser can decode');
  }
  const rate = audio.sampleRate;
  const start = Math.max(0, Math.floor(fromSec * rate));
  const end = Math.min(audio.length, Number.isFinite(toSec) ? Math.ceil(toSec * rate) : audio.length);
  const chans = [];
  for (let c = 0; c < audio.numberOfChannels; c += 1) chans.push(audio.getChannelData(c).subarray(start, end));
  return mixAndResample(chans, rate, sampleRate);
}

/** RMS loudness per window (seconds) — used to find silences without a model. */
export function rmsWindows(pcm, sampleRate, windowSec = 0.1) {
  const n = Math.max(1, Math.round(windowSec * sampleRate));
  const out = [];
  for (let i = 0; i < pcm.length; i += n) {
    let s = 0;
    const end = Math.min(pcm.length, i + n);
    for (let j = i; j < end; j += 1) s += pcm[j] * pcm[j];
    out.push(Math.sqrt(s / Math.max(1, end - i)));
  }
  return out;
}

/**
 * Silent ranges (seconds) from RMS windows.
 * @returns {{start:number,end:number}[]}
 */
export function findSilences(pcm, sampleRate, { thresholdDb = -42, minSec = 0.6, windowSec = 0.1 } = {}) {
  const rms = rmsWindows(pcm, sampleRate, windowSec);
  const thr = 10 ** (thresholdDb / 20);
  const out = [];
  let runStart = -1;
  rms.forEach((v, i) => {
    if (v < thr) { if (runStart < 0) runStart = i; }
    else if (runStart >= 0) { out.push([runStart, i]); runStart = -1; }
  });
  if (runStart >= 0) out.push([runStart, rms.length]);
  return out
    .map(([a, b]) => ({ start: a * windowSec, end: Math.min(pcm.length / sampleRate, b * windowSec) }))
    .filter((r) => r.end - r.start >= minSec);
}

/** Onset strength (rises in loudness) at `hz` frames per second. */
export function onsetEnvelope(pcm, sampleRate, hz = 100) {
  const env = rmsWindows(pcm, sampleRate, 1 / hz);
  const out = new Float32Array(env.length);
  for (let i = 1; i < env.length; i += 1) out[i] = Math.max(0, env[i] - env[i - 1]);
  return out;
}

/**
 * Best alignment of `b` against `a` by normalized cross-correlation.
 * Returns lag in frames: b[i] matches a[i + lag] (so b starts `lag` frames
 * after a). score is the correlation (0–1).
 */
export function bestLag(a, b, maxLag) {
  const mean = (x) => x.reduce((s, v) => s + v, 0) / Math.max(1, x.length);
  const ma = mean(a);
  const mb = mean(b);
  const A = Float32Array.from(a, (v) => v - ma);
  const B = Float32Array.from(b, (v) => v - mb);
  let best = { lag: 0, score: -Infinity };
  const lim = Math.min(maxLag, Math.max(A.length, B.length));
  for (let lag = -lim; lag <= lim; lag += 1) {
    let s = 0;
    let ea = 0;
    let eb = 0;
    const i0 = Math.max(0, -lag);
    const i1 = Math.min(B.length, A.length - lag);
    if (i1 - i0 < 20) continue;
    for (let i = i0; i < i1; i += 1) {
      const x = A[i + lag];
      const y = B[i];
      s += x * y; ea += x * x; eb += y * y;
    }
    const score = s / (Math.sqrt(ea * eb) || 1);
    if (score > best.score) best = { lag, score };
  }
  return { lag: best.lag, score: Math.max(0, best.score) };
}

/**
 * How many seconds after `ref` starts the `other` recording starts, from
 * their sound (e.g. a separately recorded mic vs. camera audio).
 * @returns {{ offsetSec: number, confidence: number }}
 */
export function syncOffset(refPcm, otherPcm, sampleRate, { hz = 100, maxOffsetSec = 60, analyzeSec = 120 } = {}) {
  const cut = (x) => x.subarray(0, Math.min(x.length, Math.round(analyzeSec * sampleRate)));
  const a = onsetEnvelope(cut(refPcm), sampleRate, hz);
  const b = onsetEnvelope(cut(otherPcm), sampleRate, hz);
  const { lag, score } = bestLag(a, b, Math.round(maxOffsetSec * hz));
  return { offsetSec: lag / hz, confidence: score };
}
