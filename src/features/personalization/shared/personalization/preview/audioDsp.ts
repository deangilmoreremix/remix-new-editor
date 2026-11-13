/**
 * Pure audio DSP for the personalization mix (Stage 4): filters, BS.1770-4 loudness, voice-activity ducking, fades and a
 * look-ahead peak limiter. Plain Float32Array maths: no Web Audio, no DOM, no clock, so every behaviour is unit-testable
 * with numbers and the same code produces the exported mixdown in the browser.
 *
 * Loudness follows ITU-R BS.1770-4 (K-weighting, 400 ms blocks with 75 % overlap, -70 LUFS absolute gate, -10 LU relative
 * gate). The limiter works on SAMPLE peaks (not inter-sample true peaks); the ceiling default leaves 1 dB of headroom for that.
 */

export type BiquadType = 'lowshelf' | 'highshelf' | 'peaking' | 'highpass' | 'lowpass'
/** Normalised (a0 = 1) direct-form coefficients. */
export interface Biquad { b0: number; b1: number; b2: number; a1: number; a2: number }

const TWO_PI = Math.PI * 2
const db2lin = (db: number) => 10 ** (db / 20)
export const lin2db = (v: number) => 20 * Math.log10(Math.max(v, 1e-12))

/** RBJ "Audio EQ Cookbook" biquads. `q` is the Q factor (shelves use it as the shelf slope Q). */
export function biquadCoefficients(type: BiquadType, fs: number, f0: number, q = Math.SQRT1_2, gainDb = 0): Biquad {
  const f = Math.min(Math.max(f0, 1), fs / 2 - 1)
  const A = 10 ** (gainDb / 40)
  const w0 = (TWO_PI * f) / fs
  const cos = Math.cos(w0)
  const sin = Math.sin(w0)
  const alpha = sin / (2 * Math.max(q, 1e-3))
  let b0: number, b1: number, b2: number, a0: number, a1: number, a2: number
  switch (type) {
    case 'peaking':
      b0 = 1 + alpha * A; b1 = -2 * cos; b2 = 1 - alpha * A
      a0 = 1 + alpha / A; a1 = -2 * cos; a2 = 1 - alpha / A
      break
    case 'lowshelf': {
      const s = 2 * Math.sqrt(A) * alpha
      b0 = A * ((A + 1) - (A - 1) * cos + s); b1 = 2 * A * ((A - 1) - (A + 1) * cos); b2 = A * ((A + 1) - (A - 1) * cos - s)
      a0 = (A + 1) + (A - 1) * cos + s; a1 = -2 * ((A - 1) + (A + 1) * cos); a2 = (A + 1) + (A - 1) * cos - s
      break
    }
    case 'highshelf': {
      const s = 2 * Math.sqrt(A) * alpha
      b0 = A * ((A + 1) + (A - 1) * cos + s); b1 = -2 * A * ((A - 1) + (A + 1) * cos); b2 = A * ((A + 1) + (A - 1) * cos - s)
      a0 = (A + 1) - (A - 1) * cos + s; a1 = 2 * ((A - 1) - (A + 1) * cos); a2 = (A + 1) - (A - 1) * cos - s
      break
    }
    case 'highpass':
      b0 = (1 + cos) / 2; b1 = -(1 + cos); b2 = (1 + cos) / 2
      a0 = 1 + alpha; a1 = -2 * cos; a2 = 1 - alpha
      break
    case 'lowpass':
      b0 = (1 - cos) / 2; b1 = 1 - cos; b2 = (1 - cos) / 2
      a0 = 1 + alpha; a1 = -2 * cos; a2 = 1 - alpha
      break
  }
  return { b0: b0 / a0, b1: b1 / a0, b2: b2 / a0, a1: a1 / a0, a2: a2 / a0 }
}

/** Filters `x` (direct form I, zero initial state). Returns a new array. */
export function applyBiquad(x: Float32Array, c: Biquad): Float32Array {
  const y = new Float32Array(x.length)
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0
  for (let i = 0; i < x.length; i += 1) {
    const xi = x[i]
    const yi = c.b0 * xi + c.b1 * x1 + c.b2 * x2 - c.a1 * y1 - c.a2 * y2
    x2 = x1; x1 = xi; y2 = y1; y1 = yi
    y[i] = yi
  }
  return y
}

/** Magnitude response in dB at `freq` for a cascade of filters. */
export function magnitudeDb(filters: Biquad | Biquad[], freq: number, fs: number): number {
  const list = Array.isArray(filters) ? filters : [filters]
  const w = (TWO_PI * freq) / fs
  const c1 = Math.cos(w), c2 = Math.cos(2 * w)
  let total = 0
  for (const c of list) {
    const num = c.b0 ** 2 + c.b1 ** 2 + c.b2 ** 2 + 2 * (c.b0 * c.b1 + c.b1 * c.b2) * c1 + 2 * c.b0 * c.b2 * c2
    const den = 1 + c.a1 ** 2 + c.a2 ** 2 + 2 * (c.a1 + c.a1 * c.a2) * c1 + 2 * c.a2 * c2
    total += 10 * Math.log10(Math.max(num / den, 1e-30))
  }
  return total
}

// ── EQ ───────────────────────────────────────────────────────────────────────────────────────────────────────────

export interface VoiceEq {
  /** High-pass corner in Hz (0 = off): removes rumble and handling noise. */
  highpassHz: number
  /** Low shelf (120 Hz), presence peak (2.5 kHz) and high shelf (6.5 kHz) gains in dB. */
  lowDb: number
  midDb: number
  highDb: number
}

export const EQ_LOW_HZ = 120
export const EQ_MID_HZ = 2500
export const EQ_HIGH_HZ = 6500

export function eqFilters(eq: VoiceEq, fs: number): Biquad[] {
  const out: Biquad[] = []
  if (eq.highpassHz > 0) out.push(biquadCoefficients('highpass', fs, eq.highpassHz, Math.SQRT1_2))
  if (eq.lowDb !== 0) out.push(biquadCoefficients('lowshelf', fs, EQ_LOW_HZ, Math.SQRT1_2, eq.lowDb))
  if (eq.midDb !== 0) out.push(biquadCoefficients('peaking', fs, EQ_MID_HZ, 0.9, eq.midDb))
  if (eq.highDb !== 0) out.push(biquadCoefficients('highshelf', fs, EQ_HIGH_HZ, Math.SQRT1_2, eq.highDb))
  return out
}

export function applyEq(x: Float32Array, eq: VoiceEq, fs: number): Float32Array {
  let y = x
  for (const f of eqFilters(eq, fs)) y = applyBiquad(y, f)
  return y
}

// ── loudness (ITU-R BS.1770-4) ───────────────────────────────────────────────────────────────────────────────────

/** The two K-weighting stages for any sample rate (same maths as libebur128). */
export function kWeightingFilters(fs: number): [Biquad, Biquad] {
  const f1 = 1681.974450955533, G = 3.999843853973347, Q1 = 0.7071752369554196
  const K1 = Math.tan((Math.PI * f1) / fs)
  const Vh = 10 ** (G / 20)
  const Vb = Vh ** 0.4996667741545416
  const a0 = 1 + K1 / Q1 + K1 * K1
  const shelf: Biquad = {
    b0: (Vh + (Vb * K1) / Q1 + K1 * K1) / a0,
    b1: (2 * (K1 * K1 - Vh)) / a0,
    b2: (Vh - (Vb * K1) / Q1 + K1 * K1) / a0,
    a1: (2 * (K1 * K1 - 1)) / a0,
    a2: (1 - K1 / Q1 + K1 * K1) / a0,
  }
  const f2 = 38.13547087602444, Q2 = 0.5003270373238773
  const K2 = Math.tan((Math.PI * f2) / fs)
  const c0 = 1 + K2 / Q2 + K2 * K2
  const hp: Biquad = { b0: 1, b1: -2, b2: 1, a1: (2 * (K2 * K2 - 1)) / c0, a2: (1 - K2 / Q2 + K2 * K2) / c0 }
  return [shelf, hp]
}

/** Integrated loudness in LUFS of 1–2 channels (BS.1770-4, gated). Returns -Infinity for silence. */
export function integratedLoudness(channels: Float32Array[], fs: number): number {
  if (channels.length === 0 || channels[0].length === 0 || fs <= 0) return -Infinity
  const [shelf, hp] = kWeightingFilters(fs)
  const weighted = channels.map((ch) => applyBiquad(applyBiquad(ch, shelf), hp))
  const n = weighted[0].length
  const block = Math.round(0.4 * fs)
  const step = Math.round(0.1 * fs)
  if (n < block) {
    let z = 0
    for (const w of weighted) { let s = 0; for (let i = 0; i < n; i += 1) s += w[i] * w[i]; z += s / n }
    return z > 0 ? -0.691 + 10 * Math.log10(z) : -Infinity
  }
  // prefix sums of squares per channel → O(1) block energy
  const prefix = weighted.map((w) => { const p = new Float64Array(n + 1); for (let i = 0; i < n; i += 1) p[i + 1] = p[i] + w[i] * w[i]; return p })
  const zs: number[] = []
  for (let start = 0; start + block <= n; start += step) {
    let z = 0
    for (const p of prefix) z += (p[start + block] - p[start]) / block
    zs.push(z)
  }
  const lk = (z: number) => -0.691 + 10 * Math.log10(z)
  const abs = zs.filter((z) => z > 0 && lk(z) > -70)
  if (abs.length === 0) return -Infinity
  const relGate = lk(abs.reduce((a, b) => a + b, 0) / abs.length) - 10
  const rel = abs.filter((z) => lk(z) > relGate)
  if (rel.length === 0) return -Infinity
  return lk(rel.reduce((a, b) => a + b, 0) / rel.length)
}

export const peakDb = (channels: Float32Array[]): number => {
  let p = 0
  for (const ch of channels) for (let i = 0; i < ch.length; i += 1) { const v = Math.abs(ch[i]); if (v > p) p = v }
  return lin2db(p)
}

// ── gain, fades, ducking ─────────────────────────────────────────────────────────────────────────────────────────

export function applyGainDb(x: Float32Array, gainDb: number): Float32Array {
  const g = db2lin(gainDb)
  const y = new Float32Array(x.length)
  for (let i = 0; i < x.length; i += 1) y[i] = x[i] * g
  return y
}

/** Smooth (raised-cosine) fade gain for sample `i` of `n`; fades never overlap each other. */
export function fadeGain(i: number, n: number, fs: number, fadeInSec: number, fadeOutSec: number): number {
  const inN = Math.max(0, Math.round(fadeInSec * fs))
  const outN = Math.max(0, Math.round(fadeOutSec * fs))
  let g = 1
  if (inN > 0 && i < inN) g *= 0.5 - 0.5 * Math.cos(Math.PI * (i / inN))
  const fromEnd = n - 1 - i
  if (outN > 0 && fromEnd < outN) g *= 0.5 - 0.5 * Math.cos(Math.PI * (fromEnd / outN))
  return g
}

export function applyFades(x: Float32Array, fs: number, fadeInSec: number, fadeOutSec: number): Float32Array {
  const y = new Float32Array(x.length)
  for (let i = 0; i < x.length; i += 1) y[i] = x[i] * fadeGain(i, x.length, fs, fadeInSec, fadeOutSec)
  return y
}

export interface DuckParams {
  /** Voice level (dBFS RMS over `hopSec`) above which the voice counts as speaking. */
  thresholdDb: number
  /** How far the music drops while the voice is speaking, in dB (positive number). */
  amountDb: number
  attackMs: number
  releaseMs: number
  /** The music stays down this long after the voice stops, so it does not pump between words. */
  holdMs: number
}

/** RMS level per hop, in dBFS (mono-summed channels). */
export function levelEnvelopeDb(channels: Float32Array[], fs: number, hopSec = 0.01): Float32Array {
  const hop = Math.max(1, Math.round(hopSec * fs))
  const n = channels[0]?.length ?? 0
  const out = new Float32Array(Math.ceil(n / hop))
  for (let h = 0; h < out.length; h += 1) {
    const s = h * hop, e = Math.min(n, s + hop)
    let sum = 0
    for (const ch of channels) for (let i = s; i < e; i += 1) sum += ch[i] * ch[i]
    out[h] = 10 * Math.log10(Math.max(sum / Math.max(1, (e - s) * channels.length), 1e-14))
  }
  return out
}

/** Linear gain per hop for the music: down by `amountDb` while the voice speaks, smoothed by attack/release, with hold. */
export function duckingCurve(voiceDb: Float32Array, hopSec: number, p: DuckParams): Float32Array {
  const target = db2lin(-Math.abs(p.amountDb))
  const out = new Float32Array(voiceDb.length)
  const aA = 1 - Math.exp(-hopSec / Math.max(1e-3, p.attackMs / 1000))
  const aR = 1 - Math.exp(-hopSec / Math.max(1e-3, p.releaseMs / 1000))
  const holdHops = Math.round(p.holdMs / 1000 / hopSec)
  let g = 1, since = Infinity
  for (let h = 0; h < voiceDb.length; h += 1) {
    if (voiceDb[h] > p.thresholdDb) since = 0
    else since += 1
    const want = since <= holdHops ? target : 1
    g += (want - g) * (want < g ? aA : aR)
    out[h] = g
  }
  return out
}

/** Applies a per-hop gain curve with linear interpolation between hop centres. */
export function applyGainCurve(x: Float32Array, curve: Float32Array, hopSamples: number): Float32Array {
  const y = new Float32Array(x.length)
  if (curve.length === 0) { y.set(x); return y }
  for (let i = 0; i < x.length; i += 1) {
    const pos = i / hopSamples - 0.5
    const a = Math.max(0, Math.min(curve.length - 1, Math.floor(pos)))
    const b = Math.min(curve.length - 1, a + 1)
    const t = Math.max(0, Math.min(1, pos - a))
    y[i] = x[i] * (curve[a] + (curve[b] - curve[a]) * t)
  }
  return y
}

// ── limiter ──────────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * Look-ahead peak limiter: the gain is reduced BEFORE a peak arrives (min over the look-ahead window, smoothed by a
 * moving average of the same length) and released slowly. Guarantees |y| <= ceiling for every sample.
 */
export function limit(channels: Float32Array[], fs: number, ceilingDb: number, lookaheadMs = 5, releaseMs = 120): Float32Array[] {
  const n = channels[0]?.length ?? 0
  if (n === 0) return channels.map((c) => new Float32Array(c))
  const ceil = db2lin(ceilingDb)
  const W = Math.max(1, Math.round((lookaheadMs / 1000) * fs))
  const req = new Float32Array(n)
  for (let i = 0; i < n; i += 1) {
    let p = 0
    for (const ch of channels) { const v = Math.abs(ch[i]); if (v > p) p = v }
    req[i] = p > ceil ? ceil / p : 1
  }
  // future-window minimum over [j, j+W-1] (monotonic deque, scanning right to left)
  const gm = new Float32Array(n)
  const dq = new Int32Array(n)
  let head = 0, tail = 0
  for (let j = n - 1; j >= 0; j -= 1) {
    while (tail > head && req[dq[tail - 1]] >= req[j]) tail -= 1
    dq[tail++] = j
    while (dq[head] > j + W - 1) head += 1
    gm[j] = req[dq[head]]
  }
  // trailing moving average of the window minimum (over the samples that exist at the very start, so the ceiling holds there too)
  const gs = new Float32Array(n)
  let run = 0
  for (let i = 0; i < n; i += 1) {
    run += gm[i]
    if (i >= W) run -= gm[i - W]
    gs[i] = run / Math.min(W, i + 1)
  }
  const rel = Math.exp(-1 / Math.max(1, (releaseMs / 1000) * fs))
  const g = new Float32Array(n)
  let prev = 1
  for (let i = 0; i < n; i += 1) {
    const recovered = prev + (1 - prev) * (1 - rel)
    prev = Math.min(gs[i], recovered)
    g[i] = prev
  }
  return channels.map((ch) => { const y = new Float32Array(n); for (let i = 0; i < n; i += 1) y[i] = ch[i] * g[i]; return y })
}

// ── beat alignment ───────────────────────────────────────────────────────────────────────────────────────────────

/** The beat time nearest to `t` (seconds), or `t` itself when there are no beats. */
export function nearestBeat(t: number, beats: readonly number[]): number {
  if (beats.length === 0) return t
  let best = beats[0]
  for (const b of beats) if (Math.abs(b - t) < Math.abs(best - t)) best = b
  return best
}
