// transition-collision-detector — ensures two adjacent transitions do not
// overlap past their clips (ported from upstream `transition-collision-detector.ts`).

import type { Clip, Transition } from '../types/timeline';

export function detectCollision(
  transition: Transition,
  allClips: Clip[],
): { clipId: string; overflow: number }[] {
  const problems: { clipId: string; overflow: number }[] = [];
  for (const clipId of transition.clipIds) {
    const clip = allClips.find((c) => c.id === clipId);
    if (!clip) continue;
    const overflow = clip.duration - transition.duration;
    if (overflow < 0) problems.push({ clipId, overflow });
  }
  return problems;
}

/** Returns the largest safe duration so no involved clip is fully consumed. */
export function safeTransitionDuration(
  transition: Transition,
  allClips: Clip[],
): number {
  const mins = transition.clipIds
    .map((id) => allClips.find((c) => c.id === id)?.duration ?? 0);
  return Math.max(0, Math.min(transition.duration, ...mins) - 0.1);
}
