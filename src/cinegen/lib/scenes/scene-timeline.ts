// [remix] Stage 4: put one scene (a source range of a media-pool asset) on the timeline, using the editor's own addClipToTrack
// (so linked audio, track creation and duration handling stay the editor's) and then trimming the new clips to the scene.
import type { Asset } from '@cinegen/types/project';
import type { Timeline } from '@cinegen/types/timeline';
import { addClipToTrack, calculateTimelineDuration } from '../editor/timeline-operations';
import type { SceneInfo } from './scenes';

export function addSceneToTimeline(tl: Timeline, trackId: string, asset: Asset, scene: Pick<SceneInfo, 'startSec' | 'endSec'>, at: number): Timeline {
  const before = new Set(tl.clips.map((c) => c.id));
  const total = asset.duration && asset.duration > 0 ? asset.duration : scene.endSec;
  const next = addClipToTrack(tl, trackId, asset, at);
  const clips = next.clips.map((c) => (before.has(c.id) ? c : { ...c, duration: total, trimStart: Math.max(0, scene.startSec), trimEnd: Math.max(0, total - scene.endSec) }));
  return { ...next, clips, duration: calculateTimelineDuration({ ...next, clips }) };
}
