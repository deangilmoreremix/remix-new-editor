/**
 * Keyframes: values a layer takes at chosen moments, with the in-between frames worked out for you.
 *
 * A keyframe stores CHANGES to the layer, not new absolute values, so the layer's own position, size and
 * animation stay what they are and a keyframed layer still follows a layout change:
 *   dx, dy    move, as a fraction of the frame width / height (0.1 = 10% to the right / down)
 *   scale     size multiplier (1 = unchanged, 1.5 = half again as big)
 *   opacity   fade multiplier (1 = unchanged, 0 = invisible)
 *   rotation  extra degrees
 * A channel only moves between keyframes that set it; before the first and after the last it holds that value.
 * Pure functions of (keyframes, frame), so the live Player, the editor and the browser export agree.
 */
export type KeyframeEasing = 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out' | 'hold'

export const KEYFRAME_EASINGS: { id: KeyframeEasing; label: string }[] = [
  { id: 'ease-in-out', label: 'Smooth' },
  { id: 'linear', label: 'Linear' },
  { id: 'ease-in', label: 'Ease in' },
  { id: 'ease-out', label: 'Ease out' },
  { id: 'hold', label: 'Hold (jump)' },
];

export type KeyframeChannel = 'dx' | 'dy' | 'scale' | 'opacity' | 'rotation'
export const KEYFRAME_CHANNELS: KeyframeChannel[] = ['dx', 'dy', 'scale', 'opacity', 'rotation'];

export interface LayerKeyframe {
  frame: number
  dx?: number
  dy?: number
  scale?: number
  opacity?: number
  rotation?: number
  /** How the layer travels from this keyframe to the next one. */
  easing: KeyframeEasing
}

export interface KeyframeState {
  dx: number
  dy: number
  scale: number
  opacity: number
  rotation: number
}

export const NEUTRAL_KEYFRAME_STATE: KeyframeState = { dx: 0, dy: 0, scale: 1, opacity: 1, rotation: 0 };
export const MAX_KEYFRAMES = 24;

const LIMITS: Record<KeyframeChannel, [number, number]> = {
  dx: [-1.5, 1.5],
  dy: [-1.5, 1.5],
  scale: [0.05, 5],
  opacity: [0, 1],
  rotation: [-360, 360],
};

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const isFiniteNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

export function clampChannel(channel: KeyframeChannel, value: number): number {
  const [lo, hi] = LIMITS[channel];
  return clamp(value, lo, hi);
}

function ease(easing: KeyframeEasing, t: number): number {
  const x = clamp(t, 0, 1);
  switch (easing) {
    case 'linear':
      return x;
    case 'ease-in':
      return x * x * x;
    case 'ease-out':
      return 1 - (1 - x) ** 3;
    case 'hold':
      return 0;
    case 'ease-in-out':
    default:
      return x < 0.5 ? 4 * x * x * x : 1 - ((-2 * x + 2) ** 3) / 2;
  }
}

/** The state at `frame`. No keyframes (or none for a channel) leaves that channel neutral. */
export function keyframeStateFor(keyframes: readonly LayerKeyframe[] | undefined, frame: number): KeyframeState {
  if (!keyframes || keyframes.length === 0) return NEUTRAL_KEYFRAME_STATE;
  const out: KeyframeState = { ...NEUTRAL_KEYFRAME_STATE };
  for (const channel of KEYFRAME_CHANNELS) {
    const keyed = keyframes.filter((k) => isFiniteNumber(k[channel])).sort((a, b) => a.frame - b.frame);
    if (keyed.length === 0) continue;
    if (frame <= keyed[0].frame) { out[channel] = keyed[0][channel] as number; continue; }
    const last = keyed[keyed.length - 1];
    if (frame >= last.frame) { out[channel] = last[channel] as number; continue; }
    let i = 0;
    while (i < keyed.length - 2 && frame >= keyed[i + 1].frame) i++;
    const a = keyed[i];
    const b = keyed[i + 1];
    const t = (frame - a.frame) / Math.max(1, b.frame - a.frame);
    const av = a[channel] as number;
    const bv = b[channel] as number;
    out[channel] = a.easing === 'hold' ? av : av + (bv - av) * ease(a.easing, t);
  }
  return out;
}

export function isNeutralKeyframeState(s: KeyframeState): boolean {
  return s.dx === 0 && s.dy === 0 && s.scale === 1 && s.opacity === 1 && s.rotation === 0;
}

/** CSS transform parts for a state, to be applied about the layer's center (the caller sets the origin). */
export function keyframeTransformParts(s: KeyframeState, compW: number, compH: number): string[] {
  const parts: string[] = [];
  if (s.dx || s.dy) parts.push(`translate(${s.dx * compW}px, ${s.dy * compH}px)`);
  if (s.scale !== 1) parts.push(`scale(${s.scale})`);
  if (s.rotation) parts.push(`rotate(${s.rotation}deg)`);
  return parts;
}

/** Reads saved keyframes defensively: sorted by frame, one per frame, every value clamped. Undefined when there are none. */
export function normalizeKeyframes(raw: unknown): LayerKeyframe[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const byFrame = new Map<number, LayerKeyframe>();
  for (const item of raw) {
    if (typeof item !== 'object' || item === null) continue;
    const r = item as Record<string, unknown>;
    if (!isFiniteNumber(r.frame)) continue;
    const frame = Math.max(0, Math.round(r.frame));
    const kf: LayerKeyframe = {
      frame,
      easing: KEYFRAME_EASINGS.some((e) => e.id === r.easing) ? (r.easing as KeyframeEasing) : 'ease-in-out',
    };
    for (const channel of KEYFRAME_CHANNELS) {
      const v = r[channel];
      if (isFiniteNumber(v)) kf[channel] = clampChannel(channel, v);
    }
    if (KEYFRAME_CHANNELS.some((c) => kf[c] !== undefined)) byFrame.set(frame, kf);
  }
  const list = [...byFrame.values()].sort((a, b) => a.frame - b.frame).slice(0, MAX_KEYFRAMES);
  return list.length > 0 ? list : undefined;
}

/** The channel values currently in effect, used to seed a new keyframe so adding one never makes the layer jump. */
export function snapshotKeyframe(keyframes: readonly LayerKeyframe[] | undefined, frame: number, easing: KeyframeEasing = 'ease-in-out'): LayerKeyframe {
  const s = keyframeStateFor(keyframes, frame);
  return { frame: Math.max(0, Math.round(frame)), dx: s.dx, dy: s.dy, scale: s.scale, opacity: s.opacity, rotation: s.rotation, easing };
}

/** Adds a keyframe at `frame`, or replaces the one already there. */
export function upsertKeyframe(keyframes: readonly LayerKeyframe[] | undefined, next: LayerKeyframe): LayerKeyframe[] {
  const others = (keyframes ?? []).filter((k) => k.frame !== Math.round(next.frame));
  return normalizeKeyframes([...others, next]) ?? [];
}

export function removeKeyframe(keyframes: readonly LayerKeyframe[] | undefined, frame: number): LayerKeyframe[] | undefined {
  const rest = (keyframes ?? []).filter((k) => k.frame !== Math.round(frame));
  return rest.length > 0 ? rest : undefined;
}

/** Moves a keyframe to another frame (replacing any keyframe already there). */
export function moveKeyframe(keyframes: readonly LayerKeyframe[] | undefined, from: number, to: number, durationInFrames: number): LayerKeyframe[] | undefined {
  const source = (keyframes ?? []).find((k) => k.frame === Math.round(from));
  if (!source) return keyframes ? [...keyframes] : undefined;
  const target = clamp(Math.round(to), 0, Math.max(0, Math.round(durationInFrames) - 1));
  const rest = (keyframes ?? []).filter((k) => k.frame !== source.frame && k.frame !== target);
  return normalizeKeyframes([...rest, { ...source, frame: target }]);
}

/** A few ready-made motions. They write ordinary keyframes the customer can then edit. */
export interface KeyframePreset {
  id: string
  label: string
  /** Keyframes for a layer shown from `start` for `length` frames. */
  build: (start: number, length: number) => LayerKeyframe[]
}

const kf = (frame: number, patch: Partial<LayerKeyframe>): LayerKeyframe => ({ frame: Math.max(0, Math.round(frame)), easing: 'ease-in-out', ...patch });

export const KEYFRAME_PRESETS: KeyframePreset[] = [
  { id: 'zoom-in', label: 'Slow zoom in', build: (s, l) => [kf(s, { scale: 1 }), kf(s + l, { scale: 1.2 })] },
  { id: 'drift', label: 'Drift across', build: (s, l) => [kf(s, { dx: -0.06 }), kf(s + l, { dx: 0.06 })] },
  { id: 'float', label: 'Float up', build: (s, l) => [kf(s, { dy: 0.04 }), kf(s + l, { dy: -0.04 })] },
  { id: 'fade-in-out', label: 'Fade in and out', build: (s, l) => [kf(s, { opacity: 0 }), kf(s + Math.min(15, l / 3), { opacity: 1 }), kf(s + l - Math.min(15, l / 3), { opacity: 1 }), kf(s + l, { opacity: 0 })] },
  { id: 'wobble', label: 'Gentle tilt', build: (s, l) => [kf(s, { rotation: -4 }), kf(s + l / 2, { rotation: 4 }), kf(s + l, { rotation: -4 })] },
];
