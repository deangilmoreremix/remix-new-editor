// [remix] CineGen timeline + overlays -> the classic project state the interactive player and the publish client understand.
// The List Builder is a registration wall on the whole video, so it is lifted to `listBuilder` (what the player reads) instead of
// staying an item on the overlay track; Lead Generators, CTAs and the other overlays stay as timed items.
import { clipEffectiveDuration, type Clip, type Timeline } from '@cinegen/types/timeline';
import type { Asset } from '@cinegen/types/project';
import type { OverlayClip } from '@cinegen/types/workspace';
// @ts-expect-error plain JS opt-in form config
import { normalizeListBuilder } from '../../../lib/editor/addons/listBuilder.js';

export function buildPublishState(tl: Timeline, assets: Asset[], overlays: OverlayClip[], title: string) {
  const byId = new Map(assets.map((a) => [a.id, a]));
  const kind = (c: Clip) => tl.tracks.find((t) => t.id === c.trackId)?.kind;
  const item = (c: Clip, i: number, audioOnly: boolean) => {
    const a = byId.get(c.assetId); const src = a?.fileRef || a?.url;
    if (!a || !src) return null;
    return { id: `c${i}`, type: audioOnly || a.type === 'audio' ? 'audio' : a.type === 'image' ? 'image' : 'video', src, start: c.startTime, end: c.startTime + clipEffectiveDuration(c), trimIn: c.trimStart, playbackRate: c.speed || 1, volume: c.volume ?? 1 };
  };
  const video = tl.clips.filter((c) => kind(c) === 'video').map((c, i) => item(c, i, false)).filter(Boolean);
  const audio = tl.clips.filter((c) => kind(c) === 'audio').map((c, i) => item(c, 1000 + i, true)).filter(Boolean);
  const wall = overlays.find((o) => o.type === 'list-builder');
  const items = overlays.filter((o) => o.type !== 'list-builder');
  const duration = Math.max(1, tl.duration, ...items.map((o) => o.end));
  return {
    projectTitle: title, timelineSeconds: duration,
    ...(wall ? { listBuilder: { ...normalizeListBuilder(JSON.parse(JSON.stringify(wall.config ?? {}))), enabled: true } } : {}),
    tracks: [
      { id: 'v', name: 'Video', type: 'video', items: video },
      { id: 'a', name: 'Audio', type: 'audio', items: audio },
      { id: 'ov', name: 'Overlays', type: 'text', items: JSON.parse(JSON.stringify(items)) },
    ],
  };
}
