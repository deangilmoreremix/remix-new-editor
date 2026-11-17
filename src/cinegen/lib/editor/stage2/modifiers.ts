// Adapted from FreeCut (https://github.com/freecut/freecut, MIT licence), commit 5ceeeb388eef5423640b7db157706274bf1b8165,
// file src/features/keyframes/utils/motion-modifier-eval.ts (the analytic float-drift / breath-pulse / micro-shake / sway / spin evaluators and
// the sin-hash value noise). Changes: pixel amplitudes are expressed in % of a 1920x1080 reference frame (CineGen transforms are in %, so preview
// and export agree whatever the viewer size), time is in seconds (frame / fps), the type names follow the CineGen UI (drift, sway, breathing,
// spin, shake), and `seed` is a plain number. Each modifier is a pure function of time + its own parameters: no Date.now, no Math.random,
// no stored state, so a given frame renders identically every time in the editor and in the export.

export type ModifierType = 'drift' | 'sway' | 'breathing' | 'spin' | 'shake';
export const MODIFIER_TYPES: ModifierType[] = ['drift', 'sway', 'breathing', 'spin', 'shake'];
export const MODIFIER_LABELS: Record<ModifierType, string> = { drift: 'Drift', sway: 'Sway', breathing: 'Breathing', spin: 'Spin', shake: 'Shake' };

export type ModifierChannel = 'x' | 'y' | 'rotation' | 'scale' | 'opacity';
const CHANNELS: Record<ModifierType, ModifierChannel[]> = {
  drift: ['x', 'y', 'rotation'], sway: ['rotation'], breathing: ['scale', 'opacity'], spin: ['rotation'], shake: ['x', 'y', 'rotation'],
};
export const modifierChannels = (t: ModifierType) => CHANNELS[t];

export interface MotionModifier {
  id: string;
  type: ModifierType;
  enabled: boolean;
  /** intensity multiplier 0..2 */
  amplitude: number;
  /** Hz (cycles per second; spin: revolutions per second; shake: noise rate) */
  frequency: number;
  /** seconds of phase offset (stagger several clips) */
  phase: number;
  /** noise seed (shake) */
  seed: number;
  /** per-channel gain 0..2 (missing = 1) */
  gains?: Partial<Record<ModifierChannel, number>>;
}

export const DEFAULT_FREQUENCY: Record<ModifierType, number> = { drift: 0.625, sway: 0.5, breathing: 0.55, spin: 0.3, shake: 8 };

export interface ModifierContribution { dx: number; dy: number; dRotation: number; dOpacity: number; scale: number }
export const NO_CONTRIBUTION: ModifierContribution = Object.freeze({ dx: 0, dy: 0, dRotation: 0, dOpacity: 0, scale: 1 });

const TWO_PI = Math.PI * 2;
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const gain = (m: MotionModifier, ch: ModifierChannel) => (CHANNELS[m.type].includes(ch) ? clamp(m.gains?.[ch] ?? 1, 0, 2) : 0);

// reference frame 1920x1080: FreeCut's pixel amplitudes (clamp(W*0.008,4,18) etc.) converted to % of the frame
const DRIFT_X = 0.8; const DRIFT_Y = 1.4; const DRIFT_ROT = 1.2;
const SHAKE_X = 0.4; const SHAKE_Y = 0.4; const SHAKE_ROT = 0.55;

/** Signed value noise in [-1, 1] from a number (FreeCut hashNoise). */
const hashNoise = (seed: number) => { const x = Math.sin(seed * 12.9898) * 43758.5453; return (x - Math.floor(x)) * 2 - 1; };
const smoothstep = (t: number) => t * t * (3 - 2 * t);
const valueNoise = (seed: number, s: number) => { const i = Math.floor(s); const a = hashNoise(seed + i); const b = hashNoise(seed + i + 1); return a + (b - a) * smoothstep(s - i); };

function one(m: MotionModifier, t: number, o: { dx: number; dy: number; dRotation: number; dOpacity: number; scale: number }): void {
  if (!m.enabled || !(m.amplitude > 0)) return;
  const f = m.frequency; const A = m.amplitude;
  const phase = m.phase * f * TWO_PI;
  switch (m.type) {
    case 'drift':
      o.dx += gain(m, 'x') * DRIFT_X * A * Math.sin(TWO_PI * f * t + phase + Math.PI / 2);
      o.dy += gain(m, 'y') * DRIFT_Y * A * Math.sin(TWO_PI * f * t + phase);
      o.dRotation += gain(m, 'rotation') * DRIFT_ROT * A * Math.sin(Math.PI * f * t + phase + Math.PI);
      return;
    case 'sway':
      o.dRotation += gain(m, 'rotation') * 4 * A * Math.sin(TWO_PI * f * t + phase);
      return;
    case 'breathing': {
      const wave = Math.sin(TWO_PI * f * t + phase);
      o.scale *= 1 + gain(m, 'scale') * 0.035 * A * wave;
      o.dOpacity += gain(m, 'opacity') * Math.min(0.08, 0.04 * A) * wave;
      return;
    }
    case 'spin':
      o.dRotation += gain(m, 'rotation') * 360 * f * A * t;
      return;
    case 'shake': {
      const s = (t + m.phase) * f; const seed = m.seed * 97;
      o.dx += gain(m, 'x') * valueNoise(seed + 11, s) * SHAKE_X * A;
      o.dy += gain(m, 'y') * valueNoise(seed + 23, s) * SHAKE_Y * A;
      o.dRotation += gain(m, 'rotation') * valueNoise(seed + 37, s) * SHAKE_ROT * A;
      return;
    }
    default: { const _never: never = m.type; return _never; }
  }
}

/** Combined contribution of all modifiers at time t (seconds). Position / rotation / opacity are additive, scale is a factor. */
export function evalModifiers(mods: readonly MotionModifier[] | undefined, t: number): ModifierContribution {
  if (!mods?.length) return NO_CONTRIBUTION;
  const o = { dx: 0, dy: 0, dRotation: 0, dOpacity: 0, scale: 1 };
  for (const m of mods) one(m, t, o);
  return o;
}

let counter = 0;
/** New modifier with the type's defaults. `id` is only for list keys; it is not used by the evaluator. */
export function createModifier(type: ModifierType, over: Partial<MotionModifier> = {}): MotionModifier {
  counter += 1;
  return { id: over.id ?? `mm_${type}_${counter}`, type, enabled: true, amplitude: 1, frequency: DEFAULT_FREQUENCY[type], phase: 0, seed: 1, ...over };
}

/** Validate an untrusted modifier (loaded project). */
export function normalizeModifier(raw: unknown): MotionModifier | null {
  const r = raw as Partial<MotionModifier> | null;
  if (!r || typeof r !== 'object' || !MODIFIER_TYPES.includes(r.type as ModifierType)) return null;
  const num = (v: unknown, d: number) => (typeof v === 'number' && Number.isFinite(v) ? v : d);
  return {
    id: typeof r.id === 'string' && r.id ? r.id : `mm_${r.type}`, type: r.type as ModifierType, enabled: r.enabled !== false,
    amplitude: clamp(num(r.amplitude, 1), 0, 2), frequency: clamp(num(r.frequency, DEFAULT_FREQUENCY[r.type as ModifierType]), 0, 30), phase: num(r.phase, 0), seed: num(r.seed, 1),
    ...(r.gains ? { gains: r.gains } : {}),
  };
}
