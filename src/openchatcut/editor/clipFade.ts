// SPDX-License-Identifier: AGPL-3.0-or-later — OpenChatCut (apps/video-agent-studio/src/editor/clipFade.ts), vendored.
// [remix] Only `clipFadeFactor` is taken (the rest of their file is tied to their TimelineItem/keyframe model).

/** Fade multiplier at a Sequence-relative frame (unit-agnostic: CineGen passes seconds). */
export function clipFadeFactor(
  frame: number,
  durationInFrames: number,
  fadeInFrames = 0,
  fadeOutFrames = 0,
): number {
  let factor = 1;
  if (fadeInFrames > 0) factor = Math.min(factor, frame / fadeInFrames);
  if (fadeOutFrames > 0) factor = Math.min(factor, (durationInFrames - frame) / fadeOutFrames);
  return Math.max(0, Math.min(1, factor));
}
