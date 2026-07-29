// keyframe-animation-service — value interpolation for keyframed clip
// properties (ported from upstream `keyframe-animation-service.ts`).

import type { Keyframe } from '../types/timeline';

function bezier(t: number): number {
  // Simple ease-in-out approximation for 'bezier' easing.
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

export function interpolateKeyframes(
  keyframes: Keyframe[],
  time: number,
): number {
  if (keyframes.length === 0) return 0;
  const sorted = [...keyframes].sort((a, b) => a.time - b.time);
  if (time <= sorted[0].time) return sorted[0].value;
  const last = sorted[sorted.length - 1];
  if (time >= last.time) return last.value;

  for (let i = 0; i < sorted.length - 1; i++) {
    const a = sorted[i];
    const b = sorted[i + 1];
    if (time >= a.time && time <= b.time) {
      if (a.easing === 'hold') return a.value;
      const span = b.time - a.time || 1;
      const linear = (time - a.time) / span;
      const eased = a.easing === 'linear' ? linear : bezier(linear);
      return a.value + (b.value - a.value) * eased;
    }
  }
  return last.value;
}

export function addKeyframe(
  keyframes: Keyframe[],
  kf: Keyframe,
): Keyframe[] {
  return [...keyframes.filter((k) => k.id !== kf.id), kf].sort(
    (a, b) => a.time - b.time,
  );
}
