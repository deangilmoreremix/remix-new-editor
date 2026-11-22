// [remix] Stage 4: 6-band parametric EQ model + biquad maths. Pure (no DOM, no Web Audio).
//
// Adapted from FreeCut (https://github.com/freecut/freecut, commit 5ceeeb388eef5423640b7db157706274bf1b8165), file
// src/shared/utils/audio-eq.ts, MIT License, Copyright (c) 2025 FreeCut. What is taken: the peaking / notch / shelf biquad coefficient
// formulas (RBJ audio-EQ cookbook), the gain range (+-20 dB) and Q range (0.3 to 10.3) clamps, and the idea of named presets.
// What is not taken: FreeCut's 7-pass "stage" model, per-field storage on timeline items and its 1673-line resolver (it depends on
// FreeCut's own type files). Here a clip carries one small `ClipEq` object and the same chain is used for preview and for the export bake.
//
// The chain is built from BiquadFilterNode (lib/audio/audio-graph.ts, eq-bake.ts). The coefficient functions below are only used for the
// response curve in the UI and for tests against known values / against BiquadFilterNode.getFrequencyResponse in a real browser.

export type EqBandType = 'highpass' | 'lowshelf' | 'peaking' | 'highshelf' | 'lowpass' | 'notch';

export interface EqBand {
  type: EqBandType;
  /** Hz */
  frequency: number;
  /** dB, peaking and shelf bands only */
  gain: number;
  /** linear Q (peaking, notch, highpass, lowpass) */
  q: number;
  enabled: boolean;
}

export interface ClipEq {
  enabled: boolean;
  /** always 6 bands, low to high */
  bands: EqBand[];
}

export const EQ_BAND_COUNT = 6;
export const EQ_GAIN_DB_MIN = -20;
export const EQ_GAIN_DB_MAX = 20;
export const EQ_Q_MIN = 0.3;
export const EQ_Q_MAX = 10.3;
export const EQ_FREQ_MIN = 20;
/** Shelf slope used by the browsers' BiquadFilterNode (S = 1). */
const SHELF_SLOPE = 1;

export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
export const clampEqGain = (v: number) => clamp(Number.isFinite(v) ? v : 0, EQ_GAIN_DB_MIN, EQ_GAIN_DB_MAX);
export const clampEqQ = (v: number, fallback = 1) => clamp(Number.isFinite(v) ? v : fallback, EQ_Q_MIN, EQ_Q_MAX);
export const clampEqFrequency = (v: number, sampleRate: number) => clamp(Number.isFinite(v) ? v : 1000, EQ_FREQ_MIN, sampleRate * 0.45);

export function defaultEqBands(): EqBand[] {
  return [
    { type: 'highpass', frequency: 80, gain: 0, q: Math.SQRT1_2, enabled: false },
    { type: 'peaking', frequency: 250, gain: 0, q: 1.1, enabled: true },
    { type: 'peaking', frequency: 1000, gain: 0, q: 0.9, enabled: true },
    { type: 'peaking', frequency: 3200, gain: 0, q: 1.1, enabled: true },
    { type: 'highshelf', frequency: 8000, gain: 0, q: 0.9, enabled: true },
    { type: 'lowpass', frequency: 16000, gain: 0, q: Math.SQRT1_2, enabled: false },
  ];
}

export const defaultClipEq = (): ClipEq => ({ enabled: true, bands: defaultEqBands() });

/** Bring any (possibly stored, possibly hand-edited) value to a valid 6-band EQ. Returns null when it is not an EQ at all. */
export function normalizeClipEq(input: unknown, sampleRate = 48000): ClipEq | null {
  if (!input || typeof input !== 'object') return null;
  const src = input as { enabled?: unknown; bands?: unknown };
  if (!Array.isArray(src.bands)) return null;
  const base = defaultEqBands();
  const types: EqBandType[] = ['highpass', 'lowshelf', 'peaking', 'highshelf', 'lowpass', 'notch'];
  const bands = base.map((d, i) => {
    const b = (src.bands as Array<Partial<EqBand> | undefined>)[i] ?? {};
    const type = types.includes(b.type as EqBandType) ? (b.type as EqBandType) : d.type;
    return {
      type,
      frequency: clampEqFrequency(typeof b.frequency === 'number' ? b.frequency : d.frequency, sampleRate),
      gain: clampEqGain(typeof b.gain === 'number' ? b.gain : d.gain),
      q: clampEqQ(typeof b.q === 'number' ? b.q : d.q, d.q),
      enabled: typeof b.enabled === 'boolean' ? b.enabled : d.enabled,
    };
  });
  return { enabled: src.enabled !== false, bands };
}

/** True when the EQ changes the sound (enabled, and at least one enabled band is not neutral). */
export function isEqActive(eq: ClipEq | null | undefined): boolean {
  if (!eq || !eq.enabled) return false;
  return eq.bands.some((b) => b.enabled && (b.type === 'highpass' || b.type === 'lowpass' || b.type === 'notch' || Math.abs(b.gain) > 1e-6));
}

export const EQ_PRESETS: ReadonlyArray<{ id: string; label: string; apply: (b: EqBand[]) => EqBand[] }> = Object.freeze([
  { id: 'flat', label: 'Flat', apply: (b: EqBand[]) => b.map((x) => ({ ...x, gain: 0, enabled: x.type !== 'highpass' && x.type !== 'lowpass' })) },
  { id: 'voice-clarity', label: 'Voice clarity', apply: (b: EqBand[]) => set(b, { 0: { enabled: true, frequency: 90 }, 1: { gain: -3 }, 3: { gain: 3.5 }, 4: { gain: 1.5 } }) },
  { id: 'podcast', label: 'Podcast', apply: (b: EqBand[]) => set(b, { 0: { enabled: true, frequency: 70 }, 1: { gain: 2 }, 2: { gain: -1.5 }, 3: { gain: 2.5 } }) },
  { id: 'warmth', label: 'Warmth', apply: (b: EqBand[]) => set(b, { 1: { gain: 3 }, 4: { gain: -2 } }) },
  { id: 'bass-boost', label: 'Bass boost', apply: (b: EqBand[]) => set(b, { 1: { frequency: 100, gain: 5 } }) },
  { id: 'de-mud', label: 'De-mud', apply: (b: EqBand[]) => set(b, { 1: { frequency: 300, gain: -4, q: 1.4 } }) },
  { id: 'telephone', label: 'Telephone', apply: (b: EqBand[]) => set(b, { 0: { enabled: true, frequency: 400 }, 5: { enabled: true, frequency: 3400 } }) },
]);

function set(bands: EqBand[], patch: Record<number, Partial<EqBand>>): EqBand[] {
  const flat = EQ_PRESETS[0].apply(bands);
  return flat.map((b, i) => (patch[i] ? { ...b, ...patch[i] } : b));
}

export interface Biquad { b0: number; b1: number; b2: number; a1: number; a2: number }

/** Biquad coefficients (normalised, a0 = 1) for one band, RBJ cookbook as in FreeCut's audio-eq.ts and the Web Audio spec. */
export function biquadCoefficients(band: Pick<EqBand, 'type' | 'frequency' | 'gain' | 'q'>, sampleRate: number): Biquad {
  const f = clampEqFrequency(band.frequency, sampleRate);
  const w0 = 2 * Math.PI * (f / sampleRate);
  const cos = Math.cos(w0);
  const sin = Math.sin(w0);
  const norm = (b0: number, b1: number, b2: number, a0: number, a1: number, a2: number): Biquad => ({ b0: b0 / a0, b1: b1 / a0, b2: b2 / a0, a1: a1 / a0, a2: a2 / a0 });
  const q = clampEqQ(band.q);
  switch (band.type) {
    case 'peaking': {
      const A = Math.pow(10, clampEqGain(band.gain) / 40);
      const alpha = sin / (2 * q);
      return norm(1 + alpha * A, -2 * cos, 1 - alpha * A, 1 + alpha / A, -2 * cos, 1 - alpha / A);
    }
    case 'notch': {
      const alpha = sin / (2 * q);
      return norm(1, -2 * cos, 1, 1 + alpha, -2 * cos, 1 - alpha);
    }
    case 'lowshelf':
    case 'highshelf': {
      const A = Math.pow(10, clampEqGain(band.gain) / 40);
      const sqrtA = Math.sqrt(A);
      const alpha = (sin / 2) * Math.sqrt((A + 1 / A) * (1 / SHELF_SLOPE - 1) + 2);
      if (band.type === 'lowshelf') {
        return norm(A * (A + 1 - (A - 1) * cos + 2 * sqrtA * alpha), 2 * A * (A - 1 - (A + 1) * cos), A * (A + 1 - (A - 1) * cos - 2 * sqrtA * alpha),
          A + 1 + (A - 1) * cos + 2 * sqrtA * alpha, -2 * (A - 1 + (A + 1) * cos), A + 1 + (A - 1) * cos - 2 * sqrtA * alpha);
      }
      return norm(A * (A + 1 + (A - 1) * cos + 2 * sqrtA * alpha), -2 * A * (A - 1 + (A + 1) * cos), A * (A + 1 + (A - 1) * cos - 2 * sqrtA * alpha),
        A + 1 - (A - 1) * cos + 2 * sqrtA * alpha, 2 * (A - 1 - (A + 1) * cos), A + 1 - (A - 1) * cos - 2 * sqrtA * alpha);
    }
    case 'highpass': {
      const alpha = sin / (2 * q);
      return norm((1 + cos) / 2, -(1 + cos), (1 + cos) / 2, 1 + alpha, -2 * cos, 1 - alpha);
    }
    case 'lowpass': {
      const alpha = sin / (2 * q);
      return norm((1 - cos) / 2, 1 - cos, (1 - cos) / 2, 1 + alpha, -2 * cos, 1 - alpha);
    }
  }
}

/** Magnitude in dB of one biquad at a frequency. */
export function biquadMagnitudeDb(c: Biquad, frequencyHz: number, sampleRate: number): number {
  const w = (2 * Math.PI * frequencyHz) / sampleRate;
  const cw = Math.cos(w); const sw = Math.sin(w); const c2 = Math.cos(2 * w); const s2 = Math.sin(2 * w);
  const nr = c.b0 + c.b1 * cw + c.b2 * c2; const ni = -(c.b1 * sw + c.b2 * s2);
  const dr = 1 + c.a1 * cw + c.a2 * c2; const di = -(c.a1 * sw + c.a2 * s2);
  const mag = Math.sqrt((nr * nr + ni * ni) / (dr * dr + di * di));
  return 20 * Math.log10(Math.max(mag, 1e-12));
}

/** Combined response of all enabled bands (dB) at the given frequencies. */
export function eqResponseDb(eq: ClipEq, frequencies: ArrayLike<number>, sampleRate = 48000): Float32Array {
  const out = new Float32Array(frequencies.length);
  if (!eq.enabled) return out;
  for (const band of eq.bands) {
    if (!band.enabled) continue;
    const c = biquadCoefficients(band, sampleRate);
    for (let i = 0; i < frequencies.length; i++) out[i] += biquadMagnitudeDb(c, frequencies[i], sampleRate);
  }
  return out;
}

/** Log-spaced frequencies for drawing the curve. */
export function logFrequencies(count = 128, lo = 20, hi = 20000): Float32Array {
  const out = new Float32Array(count);
  for (let i = 0; i < count; i++) out[i] = lo * Math.pow(hi / lo, i / (count - 1));
  return out;
}

/** Value for `BiquadFilterNode.Q`: highpass/lowpass take their Q in dB in the Web Audio spec, the other types a linear Q. */
export function webAudioQ(band: Pick<EqBand, 'type' | 'q'>): number {
  return band.type === 'highpass' || band.type === 'lowpass' ? 20 * Math.log10(clampEqQ(band.q)) : clampEqQ(band.q);
}

/** Cheap structural equality (used to avoid rewiring the preview graph every frame). */
export function eqKey(eq: ClipEq | null | undefined): string {
  return isEqActive(eq) ? JSON.stringify(eq!.bands.map((b) => (b.enabled ? [b.type, b.frequency, b.gain, b.q] : 0))) : '';
}
