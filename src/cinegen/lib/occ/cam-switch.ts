// [remix] Multicam camera switching on the CineGen timeline. The edit plan is OpenChatCut's own `planCamSwitch` (editor/camSwitch.ts):
// in [from, to) every other camera's clip is split at the interval edges and the part inside is removed, without moving the rest of the
// timeline. Their actions are applied here with CineGen's splitClip / removeClip (linked audio follows its video clip).
import { planCamSwitch } from '../../../openchatcut/editor/camSwitch';
import { splitClip, removeClip } from '@cinegen/lib/editor/timeline-operations';
import { clipEffectiveDuration, type Clip, type Timeline } from '@cinegen/types/timeline';

export const SWITCH_BASIS_FPS = 30;
const toFrame = (s: number) => Math.round(s * SWITCH_BASIS_FPS);
const span = (c: Clip) => ({ id: c.id, startFrame: toFrame(c.startTime), durationInFrames: Math.max(1, toFrame(clipEffectiveDuration(c))) });

export interface CamSwitchResult { timeline: Timeline; removed: Array<{ clipId: string; fromSec: number; toSec: number }>; gapSeconds: number }

/** Cut to the camera of `target` (the clip's video track) between `fromSec` and `toSec`. */
export function cutToCamera(tl: Timeline, targetId: string, fromSec: number, toSec: number): CamSwitchResult | { error: string } {
  const target = tl.clips.find((c) => c.id === targetId);
  if (!target) return { error: 'Select a video clip on the camera you want to switch to.' };
  const trackKind = (id: string) => tl.tracks.find((t) => t.id === id)?.kind;
  if (trackKind(target.trackId) !== 'video') return { error: 'Select the video clip of the camera you want to switch to.' };
  if (!(toSec - fromSec > 0.05)) return { error: 'The switch length must be longer than a few frames.' };
  const targets = tl.clips.filter((c) => c.trackId === target.trackId);
  const others = tl.clips.filter((c) => c.trackId !== target.trackId && trackKind(c.trackId) === 'video');
  const n = { v: 0 };
  const plan = planCamSwitch(targets.map(span), others.map(span), toFrame(fromSec), toFrame(toSec), () => `cs-${++n.v}`);
  const alias = new Map<string, string>();
  let next = tl;
  for (const a of plan.actions) {
    const id = alias.get(a.id) ?? a.id;
    if (a.type === 'split') {
      const before = new Set(next.clips.map((c) => c.id));
      const src = next.clips.find((c) => c.id === id);
      next = splitClip(next, id, a.atFrame / SWITCH_BASIS_FPS);
      // the right half (and the right half of a linked clip) are the new ids; map the planner's id to the one on the same track as `id`
      const created = next.clips.find((c) => !before.has(c.id) && src && c.trackId === src.trackId);
      if (created) alias.set(a.newId, created.id);
    } else {
      next = removeClip(next, id);
    }
  }
  return { timeline: next, removed: plan.removed.map((r) => ({ clipId: r.itemId, fromSec: r.fromFrame / SWITCH_BASIS_FPS, toSec: r.toFrame / SWITCH_BASIS_FPS })), gapSeconds: plan.coverageGapFrames / SWITCH_BASIS_FPS };
}
