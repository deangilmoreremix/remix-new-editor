// slip-slide-service — SLIP / SLIDE edit-mode math (ported from upstream
// `slip-slide-service.ts`). Operates purely on clip in/out points and position.

import type { Clip } from '../types/timeline';

/** SLIP: move in/out points while keeping the clip's timeline position + duration. */
export function slipClip(clip: Clip, deltaIn: number, maxIn: number): Partial<Clip> {
  const newIn = Math.max(0, Math.min(clip.inPoint + deltaIn, maxIn));
  const delta = newIn - clip.inPoint;
  return {
    inPoint: newIn,
    outPoint: clip.outPoint + delta,
  };
}

/** SLIDE: move the clip on the timeline while keeping its source in/out points. */
export function slideClip(clip: Clip, deltaStart: number): Partial<Clip> {
  return { start: Math.max(0, clip.start + deltaStart) };
}
