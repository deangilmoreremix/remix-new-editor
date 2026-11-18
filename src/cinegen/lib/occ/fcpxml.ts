// [remix] CineGen timeline → OpenChatCut's TimelineState → their `timelineToFcpxml` (Final Cut / Premiere / Resolve import).
import { timelineToFcpxml, type NleFormat } from '../../../openchatcut/export/fcpxml';
import type { TimelineItem, TimelineState } from '../../../openchatcut/editor/types';
import { clipEffectiveDuration, type Timeline } from '@cinegen/types/timeline';
import type { Asset } from '@cinegen/types/project';

export function cinegenToOccState(tl: Timeline, assets: Asset[], fps: number): TimelineState {
  const byId = new Map(assets.map((a) => [a.id, a]));
  const vIds = tl.tracks.filter((t) => t.kind === 'video').map((t) => t.id);
  const aIds = tl.tracks.filter((t) => t.kind === 'audio').map((t) => t.id);
  const trackName = (id: string) => { const v = vIds.indexOf(id); return v >= 0 ? `V${v + 1}` : `A${aIds.indexOf(id) + 1}`; };
  const items: TimelineItem[] = [];
  for (const c of tl.clips) {
    const a = byId.get(c.assetId);
    const track = trackName(c.trackId);
    const isAudio = track.startsWith('A');
    const dur = Math.round(clipEffectiveDuration(c) * fps);
    if (dur <= 0) continue;
    items.push({
      id: c.id, track, name: c.name, startFrame: Math.round(c.startTime * fps), durationInFrames: dur,
      kind: isAudio ? 'audio' : a?.type === 'image' ? 'image' : 'video',
      src: a ? `/media/uploads/${a.name}` : undefined,
      srcInFrame: Math.round(c.trimStart * fps), playbackRate: c.speed || 1, volume: Math.min(1, c.volume ?? 1),
      ...(a?.width ? { width: a.width, height: a.height } : {}),
    } as TimelineItem);
  }
  return { fps, width: 1920, height: 1080, items } as TimelineState;
}

export function cinegenFcpxml(tl: Timeline, assets: Asset[], opts: { fps?: number; title?: string; nleFormat?: NleFormat } = {}): string {
  return timelineToFcpxml(cinegenToOccState(tl, assets, opts.fps ?? 30), { title: opts.title ?? tl.name, nleFormat: opts.nleFormat });
}
