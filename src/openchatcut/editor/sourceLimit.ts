// SPDX-License-Identifier: AGPL-3.0-or-later — OpenChatCut editor/sourceLimit.ts (the two functions the tracker needs, verbatim).
import type { TimelineItem } from './types';
export type SourceTimingItem = Pick<TimelineItem, 'srcInFrame' | 'playbackRate'>;
export function timelineFramesToSourceFrames(item: SourceTimingItem, frames: number): number {
  return frames * Math.max(0.01, item.playbackRate ?? 1);
}
export function sourceFrameAt(item: SourceTimingItem, localFrame: number): number {
  return Math.max(0, (item.srcInFrame ?? 0) + timelineFramesToSourceFrames(item, localFrame));
}
