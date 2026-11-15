// [remix] Stage 11 (port H): per-clip pitch shift (semitones + cents) and the "preserve pitch when the speed changes" option.
// Adapted from FreeCut (https://github.com/walterlow/freecut, commit 5ceeeb388eef5423640b7db157706274bf1b8165, MIT, Copyright (c) 2025 FreeCut):
// src/shared/utils/audio-pitch.ts (clamps +-12 semitones / +-100 cents, ratio = 2^(semitones/12)). The data model differs (one `Clip.pitch` object).
// Pure: no browser APIs. The DSP is in pitch-dsp.ts (SoundTouch, LGPL, kept in its own folder: src/cinegen/vendor-soundtouch).

export const PITCH_SEMITONES_MIN = -12;
export const PITCH_SEMITONES_MAX = 12;
export const PITCH_CENTS_MIN = -100;
export const PITCH_CENTS_MAX = 100;
const ACTIVE_EPSILON = 1e-4;

export interface ClipPitch {
  /** whole semitones, -12 .. +12 */
  semitones: number;
  /** cents, -100 .. +100 (added to the semitones) */
  cents: number;
  /** true (default): a speed change keeps the pitch (time-stretch). false: the pitch follows the speed like tape. */
  preservePitch: boolean;
}

export const defaultClipPitch = (): ClipPitch => ({ semitones: 0, cents: 0, preservePitch: true });

const clampInt = (v: unknown, lo: number, hi: number): number => {
  const n = typeof v === 'number' && Number.isFinite(v) ? Math.round(v) : 0;
  return Math.max(lo, Math.min(hi, n));
};
export const clampPitchSemitones = (v: unknown) => clampInt(v, PITCH_SEMITONES_MIN, PITCH_SEMITONES_MAX);
export const clampPitchCents = (v: unknown) => clampInt(v, PITCH_CENTS_MIN, PITCH_CENTS_MAX);

/** Clamp a stored / pasted value. Returns undefined when it is the neutral setting (nothing to save, nothing to process). */
export function normalizeClipPitch(p: unknown): ClipPitch | undefined {
  if (!p || typeof p !== 'object') return undefined;
  const o = p as Partial<ClipPitch>;
  const out: ClipPitch = { semitones: clampPitchSemitones(o.semitones), cents: clampPitchCents(o.cents), preservePitch: o.preservePitch !== false };
  return out.semitones === 0 && out.cents === 0 && out.preservePitch ? undefined : out;
}

/** Total shift in semitones (fractional). */
export const pitchShiftSemitones = (p?: Partial<ClipPitch> | null): number => (p ? clampPitchSemitones(p.semitones) + clampPitchCents(p.cents) / 100 : 0);
export const isPitchShiftActive = (p?: Partial<ClipPitch> | null): boolean => Math.abs(pitchShiftSemitones(p)) > ACTIVE_EPSILON;
export const pitchRatio = (semitones: number): number => Math.pow(2, (Number.isFinite(semitones) ? semitones : 0) / 12);
export const pitchKey = (p?: Partial<ClipPitch> | null): string => (p ? `${clampPitchSemitones(p.semitones)}|${clampPitchCents(p.cents)}|${p.preservePitch !== false ? 1 : 0}` : '');

export interface PitchPlan {
  /** SoundTouch tempo: time-stretch without pitch change (>1 = shorter) */
  tempo: number;
  /** SoundTouch rate: resample (pitch and speed change together) */
  rate: number;
  /** pitch shift in semitones on top */
  semitones: number;
}

/**
 * How a clip at `speed` is rendered offline: with "preserve pitch" a speed change is a pure time-stretch and the pitch shift is the user's;
 * without it the speed change is a resample (pitch follows) and the user's shift is added.
 */
export function pitchPlan(p: Partial<ClipPitch> | null | undefined, speed: number): PitchPlan {
  const s = Number.isFinite(speed) && speed > 0 ? speed : 1;
  const preserve = p?.preservePitch !== false;
  return { tempo: preserve ? s : 1, rate: preserve ? 1 : s, semitones: pitchShiftSemitones(p) };
}

/** Output pitch relative to the source, in semitones (what a listener hears): the user's shift, plus 12*log2(speed) when the pitch follows the speed. */
export function audiblePitchSemitones(p: Partial<ClipPitch> | null | undefined, speed: number): number {
  const s = Number.isFinite(speed) && speed > 0 ? speed : 1;
  return pitchShiftSemitones(p) + (p?.preservePitch === false ? 12 * Math.log2(s) : 0);
}

/**
 * Whether the export must bake this clip's sound: always for a shift; for tape mode (preserve off) when the speed is not 1 (the pitch must follow
 * the speed exactly). A plain speed change with the pitch preserved and no shift is left to the composition's own playbackRate (unchanged export).
 */
export function needsPitchBake(p: Partial<ClipPitch> | null | undefined, speed: number): boolean {
  if (isPitchShiftActive(p)) return true;
  return !!p && p.preservePitch === false && Math.abs((speed || 1) - 1) > 1e-3;
}
