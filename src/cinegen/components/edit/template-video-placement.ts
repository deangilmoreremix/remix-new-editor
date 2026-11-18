// Template videos library: turning a picked clip into a timeline asset, and placing it at the playhead.
// Kept apart from timeline-editor.tsx so the placement rules are unit-testable with the real timeline operations.
import { useCallback, type MutableRefObject } from 'react';
import type { Timeline } from '@cinegen/types/timeline';
import { clipEndTime } from '@cinegen/types/timeline';
import type { Asset } from '@cinegen/types/project';
import { generateId } from '@cinegen/lib/utils/ids';
import { addClipToTrack, addTrack } from '@cinegen/lib/editor/timeline-operations';
import { ratioNumber, type TemplateVideo } from './template-videos-modal';

const DEFAULT_DURATION = 5;

/** The library clip as a video asset (long side 1920, frame size from the clip's aspect ratio). */
export function templateVideoAsset(item: Pick<TemplateVideo, 'id' | 'title' | 'videoSrc' | 'posterSrc' | 'duration' | 'aspectRatio'>): Asset {
  const ratio = ratioNumber(item.aspectRatio);
  return {
    id: generateId(),
    name: item.title,
    type: 'video',
    url: item.videoSrc,
    // [remix] `fileRef` is what the workspace's media backfill looks for (use-asset-media-backfill.ts): without it a template video never got
    // a filmstrip, a first-frame thumbnail or an audio waveform in its clip. The clip host sends `access-control-allow-origin: *`, so the
    // browser can read frames and sound from it. `status` says the clip is usable now; the picture and waveform fill in as the jobs finish.
    fileRef: item.videoSrc,
    status: 'online',
    thumbnailUrl: item.posterSrc ?? undefined,
    duration: item.duration && item.duration > 0 ? item.duration : DEFAULT_DURATION,
    width: ratio >= 1 ? 1920 : Math.round(1920 * ratio),
    height: ratio >= 1 ? Math.round(1920 / ratio) : 1920,
    createdAt: new Date().toISOString(),
    metadata: { source: 'template-videos', templateId: item.id },
  };
}

/**
 * Put the asset on a video track at `at`: the first unlocked video track with nothing in that span, otherwise a new video track.
 * `addClipToTrack` adds the linked audio clip. The new track is found by id because `addTrack` inserts video tracks
 * before the audio tracks (it is not the last track).
 */
export function placeTemplateVideo(timeline: Timeline, asset: Asset, at: number): Timeline {
  const dur = asset.duration ?? DEFAULT_DURATION;
  const isFree = (trackId: string) => !timeline.clips.some((c) => c.trackId === trackId && c.startTime < at + dur && clipEndTime(c) > at);
  const existing = timeline.tracks.find((t) => t.kind === 'video' && !t.locked && isFree(t.id));
  if (existing) return addClipToTrack(timeline, existing.id, asset, at);
  const known = new Set(timeline.tracks.map((t) => t.id));
  const withTrack = addTrack(timeline, 'video');
  const added = withTrack.tracks.find((t) => !known.has(t.id));
  if (!added) return timeline;
  return addClipToTrack(withTrack, added.id, asset, at);
}

/** The editor's "pick a template video" handler: asset into the media pool, clip at the playhead (kept here so timeline-editor.tsx stays close to CineGen). */
export function usePickTemplateVideo({ dispatch, setTimeline, timelineRef, currentTime, onPlaced }: {
  dispatch: (action: { type: 'ADD_ASSET'; asset: Asset }) => void;
  setTimeline: (timeline: Timeline) => void;
  timelineRef: MutableRefObject<Timeline>;
  currentTime: number;
  /** Called with the new video clip's id (so the editor can select it and show it in the inspector). */
  onPlaced?: (clipId: string) => void;
}) {
  return useCallback((item: TemplateVideo) => {
    const asset = templateVideoAsset(item);
    dispatch({ type: 'ADD_ASSET', asset });
    const next = placeTemplateVideo(timelineRef.current, asset, currentTime);
    setTimeline(next);
    const placed = next.clips.find((c) => c.assetId === asset.id && next.tracks.find((t) => t.id === c.trackId)?.kind === 'video');
    if (placed) onPlaced?.(placed.id);
  }, [dispatch, setTimeline, timelineRef, currentTime, onPlaced]);
}
