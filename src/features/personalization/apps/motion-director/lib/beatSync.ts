/**
 * Beat grid for user music, so the director's scene changes land on the beat
 * (upstream ShotCraft does this with librosa offline; this is a light,
 * in-browser equivalent: energy-onset envelope → tempo by autocorrelation →
 * phase by onset alignment). Pure core (`beatsFromEnvelope`) + a browser
 * wrapper that decodes the file.
 */

const MIN_BPM = 70;
const MAX_BPM = 180;

/** Beat times (s) from a per-hop energy envelope. Returns [] when no clear pulse. */
export function beatsFromEnvelope(envelope: ArrayLike<number>, hopSec: number, durationSec: number): { bpm: number; beats: number[] } {
  const n = envelope.length;
  if (n < 16 || hopSec <= 0) return { bpm: 0, beats: [] };
  // Onset strength: half-wave rectified first difference.
  // Log-compressed so a loud chorus does not drown the quiet verse's pulse.
  const env = new Float64Array(n);
  for (let i = 0; i < n; i++) env[i] = Math.log1p(60 * Math.max(0, envelope[i]));
  const onset = new Float64Array(n);
  for (let i = 1; i < n; i++) onset[i] = Math.max(0, env[i] - env[i - 1]);
  const mean = onset.reduce((a, b) => a + b, 0) / n;
  for (let i = 0; i < n; i++) onset[i] = Math.max(0, onset[i] - mean);

  // Tempo: lag with the strongest autocorrelation inside the BPM range.
  const minLag = Math.max(1, Math.floor(60 / MAX_BPM / hopSec));
  const maxLag = Math.min(n - 1, Math.ceil(60 / MIN_BPM / hopSec));
  const scores = new Float64Array(maxLag + 2);
  let bestLag = 0;
  let bestScore = 0;
  for (let lag = minLag; lag <= maxLag; lag++) {
    let score = 0;
    for (let i = lag; i < n; i++) score += onset[i] * onset[i - lag];
    scores[lag] = score;
    // Tempo prior (log-normal around 118 bpm) settles half / double-time ties the usual way.
    const bpm = 60 / (lag * hopSec);
    const weighted = score * Math.exp(-0.5 * (Math.log2(bpm / 118) / 0.6) ** 2);
    if (weighted > bestScore) {
      bestScore = weighted;
      bestLag = lag;
    }
  }
  if (!bestLag || bestScore <= 0) return { bpm: 0, beats: [] };

  // A whole-hop lag drifts over a minute of music (1 hop is ~12 ms), so search period and phase
  // together at a fraction of a hop: the grid whose beats collect the most onset strength wins.
  let lagF = bestLag;
  let bestPhase = 0;
  let bestGrid = -1;
  for (let cand = bestLag - 1; cand <= bestLag + 1 + 1e-9; cand += 0.05) {
    if (cand < 1) continue;
    for (let phase = 0; phase < cand; phase += 0.5) {
      let score = 0;
      for (let pos = phase; pos < n; pos += cand) score += onset[Math.round(pos)] ?? 0;
      if (score > bestGrid) {
        bestGrid = score;
        lagF = cand;
        bestPhase = phase;
      }
    }
  }

  const period = lagF * hopSec;
  const beats: number[] = [];
  for (let tSec = bestPhase * hopSec; tSec <= durationSec + 1e-6; tSec += period) beats.push(Math.round(tSec * 1000) / 1000);
  return { bpm: Math.round(60 / period), beats };
}

/* ---------- drum hits by frequency band (kick / snare / hi-hat) ---------- */

type FilterKind = 'lowpass' | 'highpass' | 'bandpass';

/** One RBJ biquad run over the samples (second-order, so two in a row give a steeper band edge). */
function biquad(x: ArrayLike<number>, kind: FilterKind, freq: number, sr: number, q = 0.707): Float32Array {
  const w = (2 * Math.PI * freq) / sr;
  const cos = Math.cos(w);
  const alpha = Math.sin(w) / (2 * q);
  let b0 = 0, b1 = 0, b2 = 0;
  if (kind === 'lowpass') {
    b0 = (1 - cos) / 2; b1 = 1 - cos; b2 = (1 - cos) / 2;
  } else if (kind === 'highpass') {
    b0 = (1 + cos) / 2; b1 = -(1 + cos); b2 = (1 + cos) / 2;
  } else {
    b0 = alpha; b1 = 0; b2 = -alpha;
  }
  const a0 = 1 + alpha, a1 = -2 * cos, a2 = 1 - alpha;
  const out = new Float32Array(x.length);
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < x.length; i++) {
    const xi = x[i];
    const y = (b0 * xi + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2) / a0;
    out[i] = y;
    x2 = x1; x1 = xi; y2 = y1; y1 = y;
  }
  return out;
}

const rmsEnvelope = (x: ArrayLike<number>, hop: number): Float64Array => {
  const env = new Float64Array(Math.floor(x.length / hop));
  for (let i = 0; i < env.length; i++) {
    let sum = 0;
    for (let j = i * hop; j < (i + 1) * hop; j++) sum += x[j] * x[j];
    env[i] = Math.sqrt(sum / hop);
  }
  return env;
};

/**
 * Hit times (s) in one band's envelope: peaks of the rising edge that stand out from the band's
 * own level (mean + `k` standard deviations) and are at least `minGapSec` apart. Strength is the
 * onset size, so a caller can tell a hard hit from a ghost note.
 */
export function pickHits(envelope: ArrayLike<number>, hopSec: number, k = 1.4, minGapSec = 0.09): Array<{ t: number; strength: number }> {
  const n = envelope.length;
  const onset = new Float64Array(n);
  for (let i = 1; i < n; i++) onset[i] = Math.max(0, Math.log1p(80 * envelope[i]) - Math.log1p(80 * envelope[i - 1]));
  let mean = 0;
  for (let i = 0; i < n; i++) mean += onset[i];
  mean /= Math.max(1, n);
  let varSum = 0;
  for (let i = 0; i < n; i++) varSum += (onset[i] - mean) ** 2;
  const threshold = mean + k * Math.sqrt(varSum / Math.max(1, n));
  const hits: Array<{ t: number; strength: number }> = [];
  for (let i = 1; i < n - 1; i++) {
    // A floor on the onset itself: in silence (no spread at all) nothing is a hit.
    if (onset[i] < Math.max(threshold, 0.03) || onset[i] < onset[i - 1] || onset[i] < onset[i + 1]) continue;
    const t = i * hopSec;
    const last = hits[hits.length - 1];
    if (last && t - last.t < minGapSec) {
      if (onset[i] > last.strength) hits[hits.length - 1] = { t, strength: onset[i] };
      continue;
    }
    hits.push({ t, strength: onset[i] });
  }
  return hits;
}

export interface DrumMap {
  bpm: number;
  /** The tempo grid (every beat). */
  beats: number[];
  /** The first beat of each bar, picked where the kick lands hardest (4/4 assumed). */
  downbeats: number[];
  kicks: number[];
  snares: number[];
  hats: number[];
}

/**
 * Beats and drum hits from raw samples, with no model and no server: the signal is split into three
 * bands (low < 160 Hz for the kick, 160 Hz – 3 kHz for the snare body, above 6 kHz for the hi-hat),
 * each band's own onsets are picked, and the tempo grid is found on the weighted sum of the bands
 * (the kick counts double). Cuts can then sit on the kick or the downbeat, not just on "a beat".
 */
export function analyzeDrums(samples: ArrayLike<number>, sampleRate: number): DrumMap {
  const hop = 512;
  const hopSec = hop / sampleRate;
  const low = biquad(biquad(samples, 'lowpass', 160, sampleRate), 'lowpass', 160, sampleRate);
  const mid = biquad(biquad(samples, 'highpass', 160, sampleRate), 'lowpass', 3000, sampleRate);
  const high = biquad(biquad(samples, 'highpass', 6000, sampleRate), 'highpass', 6000, sampleRate);
  const envLow = rmsEnvelope(low, hop);
  const envMid = rmsEnvelope(mid, hop);
  const envHigh = rmsEnvelope(high, hop);
  const mix = new Float64Array(envLow.length);
  for (let i = 0; i < mix.length; i++) mix[i] = 2 * envLow[i] + envMid[i] + 0.5 * envHigh[i];
  const duration = samples.length / sampleRate;
  const grid = beatsFromEnvelope(mix, hopSec, duration);
  // A hit belongs to the band that carries it: a snare leaks a little low end and a kick a little mid, so the
  // band with the clearly larger level over the hit's first few frames takes it.
  const level = (env: Float64Array, t: number) => {
    const i = Math.round(t / hopSec);
    return Math.max(env[i] ?? 0, env[i + 1] ?? 0, env[i + 2] ?? 0);
  };
  const kickHits = pickHits(envLow, hopSec, 1.2).filter((h) => level(envLow, h.t) >= 1.1 * level(envMid, h.t));
  const snareHits = pickHits(envMid, hopSec, 1.6).filter((h) => level(envMid, h.t) > 1.1 * level(envLow, h.t) && level(envMid, h.t) > level(envHigh, h.t));
  const hatHits = pickHits(envHigh, hopSec, 1.6, 0.06);
  // Downbeat: of the four phases of the beat grid, the one whose beats carry the hardest kicks.
  let downbeats: number[] = [];
  if (grid.beats.length >= 8) {
    const near = (t: number) => kickHits.reduce((best, k) => (Math.abs(k.t - t) < 0.06 ? Math.max(best, k.strength) : best), 0);
    const score = [0, 1, 2, 3].map((ph) => grid.beats.filter((_, i) => i % 4 === ph).reduce((sum, t) => sum + near(t), 0));
    const phase = score.indexOf(Math.max(...score));
    downbeats = grid.beats.filter((_, i) => i % 4 === phase);
  }
  return { bpm: grid.bpm, beats: grid.beats, downbeats, kicks: kickHits.map((h) => Math.round(h.t * 1000) / 1000), snares: snareHits.map((h) => Math.round(h.t * 1000) / 1000), hats: hatHits.map((h) => Math.round(h.t * 1000) / 1000) };
}

/** Decode an audio URL (object URL or same-origin) and return its beats and drum hits. */
export async function analyzeBeats(url: string): Promise<DrumMap> {
  const empty: DrumMap = { bpm: 0, beats: [], downbeats: [], kicks: [], snares: [], hats: [] };
  const AudioCtx: typeof AudioContext | undefined =
    typeof window !== 'undefined' ? (window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext) : undefined;
  if (!AudioCtx) return empty;
  const data = await (await fetch(url)).arrayBuffer();
  const ctx = new AudioCtx();
  try {
    const audio = await ctx.decodeAudioData(data);
    // Mono mix of the first minute and a half: enough to find the groove, quick enough to run in the tab.
    const frames = Math.min(audio.length, Math.round(audio.sampleRate * 90));
    const mono = new Float32Array(frames);
    for (let c = 0; c < audio.numberOfChannels; c++) {
      const ch = audio.getChannelData(c);
      for (let i = 0; i < frames; i++) mono[i] += ch[i] / audio.numberOfChannels;
    }
    return analyzeDrums(mono, audio.sampleRate);
  } finally {
    void ctx.close();
  }
}

/**
 * How well scene cuts sit on the beat grid, measured (never assumed): the share of cuts within
 * `toleranceFrames` of the nearest beat, and the worst miss. Upstream asks for <= 3 frames.
 */
export function syncReport(cutSec: readonly number[], beats: readonly number[], fps = 30, toleranceFrames = 3): { cuts: number; within: number; worstFrames: number } {
  if (!beats.length) return { cuts: cutSec.length, within: 0, worstFrames: 0 };
  let within = 0;
  let worst = 0;
  for (const c of cutSec) {
    const miss = Math.min(...beats.map((b) => Math.abs(b - c))) * fps;
    if (miss <= toleranceFrames) within++;
    worst = Math.max(worst, miss);
  }
  return { cuts: cutSec.length, within, worstFrames: Math.round(worst * 10) / 10 };
}
