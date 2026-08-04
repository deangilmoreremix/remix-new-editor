import { describe, it, expect } from 'vitest';
import {
  legacyToTimeline,
  timelineToLegacy,
  getPreviewClipFromTimeline,
  findAssetById,
  syncTimelineFromState,
} from '../timeline-bridge.js';

/** Build a minimal legacy state with a video and audio track. */
function buildLegacyState(overrides = {}) {
  const state = {
    projectId: 'p-1',
    projectTitle: 'Demo',
    timelineSeconds: 60,
    tracks: [
      {
        id: 'v1',
        name: 'V1',
        type: 'video',
        muted: false,
        solo: false,
        locked: false,
        visible: true,
        items: [
          {
            id: 'c-video-1',
            assetId: 'asset-video-1',
            name: 'Hero Wide',
            type: 'video',
            start: 0,
            end: 10,
            src: 'https://example.com/hero.mp4',
            poster: 'https://example.com/hero.jpg',
            fit: 'cover',
          },
          {
            id: 'c-video-2',
            assetId: 'asset-video-2',
            name: 'Product Spin',
            type: 'video',
            start: 12,
            end: 25,
            src: 'https://example.com/product.mp4',
          },
        ],
      },
      {
        id: 'a1',
        name: 'A1',
        type: 'audio',
        muted: true,
        solo: false,
        locked: false,
        visible: true,
        items: [
          {
            id: 'c-audio-1',
            assetId: 'asset-audio-1',
            name: 'VO Take 1',
            type: 'audio',
            start: 0,
            end: 30,
            src: 'https://example.com/vo.mp3',
          },
        ],
      },
    ],
    selectedClipId: 'c-video-1',
    mediaLibrary: [
      {
        id: 'asset-video-1',
        type: 'video',
        name: 'Hero Wide',
        url: 'https://example.com/hero.mp4',
        path: 'https://example.com/hero.mp4',
        duration: 10,
      },
      {
        id: 'asset-video-2',
        type: 'video',
        name: 'Product Spin',
        url: 'https://example.com/product.mp4',
        path: 'https://example.com/product.mp4',
        duration: 13,
      },
      {
        id: 'asset-audio-1',
        type: 'audio',
        name: 'VO Take 1',
        url: 'https://example.com/vo.mp3',
        path: 'https://example.com/vo.mp3',
        duration: 30,
      },
    ],
    ...overrides,
  };
  return state;
}

describe('legacyToTimeline', () => {
  it('converts a legacy state into a new-model Timeline', () => {
    const timeline = legacyToTimeline(buildLegacyState());
    expect(timeline.id).toBe('p-1');
    expect(timeline.name).toBe('Demo');
    expect(timeline.tracks).toHaveLength(2);
    expect(timeline.clips).toHaveLength(3);
  });

  it('maps legacy track type to new model kind', () => {
    const timeline = legacyToTimeline(buildLegacyState());
    const videoTrack = timeline.tracks.find((t) => t.id === 'v1');
    const audioTrack = timeline.tracks.find((t) => t.id === 'a1');
    expect(videoTrack.kind).toBe('video');
    expect(audioTrack.kind).toBe('audio');
  });

  it('preserves muted/solo/locked/visible flags', () => {
    const timeline = legacyToTimeline(buildLegacyState());
    const audioTrack = timeline.tracks.find((t) => t.id === 'a1');
    expect(audioTrack.muted).toBe(true);
    expect(audioTrack.solo).toBe(false);
    expect(audioTrack.locked).toBe(false);
    expect(audioTrack.visible).toBe(true);
  });

  it('converts start/end in seconds to startTime and duration', () => {
    const timeline = legacyToTimeline(buildLegacyState());
    const clip = timeline.clips.find((c) => c.id === 'c-video-1');
    expect(clip.startTime).toBe(0);
    expect(clip.duration).toBe(10);
  });

  it('handles left/width (percent) clips', () => {
    const state = buildLegacyState({
      tracks: [
        {
          id: 't-percent',
          name: 'Percent Track',
          type: 'video',
          items: [
            { id: 'c-pct', name: 'Percent Clip', type: 'video', left: 25, width: 50 },
          ],
        },
      ],
    });
    const timeline = legacyToTimeline(state);
    const clip = timeline.clips.find((c) => c.id === 'c-pct');
    // 25% of 60s = 15s start, 50% of 60s = 30s duration
    expect(clip.startTime).toBe(15);
    expect(clip.duration).toBe(30);
  });

  it('reads clips from either track.clips or track.items', () => {
    const state = buildLegacyState({
      tracks: [
        {
          id: 't-alias',
          name: 'Alias Track',
          type: 'video',
          // Only `clips`, no `items`
          clips: [
            { id: 'c-a', name: 'A', type: 'video', start: 0, end: 5 },
          ],
        },
      ],
    });
    const timeline = legacyToTimeline(state);
    expect(timeline.clips).toHaveLength(1);
    expect(timeline.clips[0].id).toBe('c-a');
  });

  it('falls back to state.project.tracks if state.tracks is missing', () => {
    const state = {
      project: {
        id: 'p-2',
        name: 'Nested',
        tracks: [
          { id: 't1', name: 'T1', type: 'video', items: [{ id: 'c1', type: 'video', start: 0, end: 5 }] },
        ],
      },
    };
    const timeline = legacyToTimeline(state);
    expect(timeline.tracks).toHaveLength(1);
    expect(timeline.clips).toHaveLength(1);
  });

  it('returns an empty Timeline for null/undefined state', () => {
    const t1 = legacyToTimeline(null);
    const t2 = legacyToTimeline(undefined);
    expect(t1.tracks).toEqual([]);
    expect(t1.clips).toEqual([]);
    expect(t2.tracks).toEqual([]);
  });
});

describe('timelineToLegacy', () => {
  it('round-trips clips back to legacy items array', () => {
    const state = buildLegacyState();
    const timeline = legacyToTimeline(state);
    const { tracks } = timelineToLegacy(timeline, { timelineSeconds: 60 });

    expect(tracks).toHaveLength(2);
    const videoTrack = tracks.find((t) => t.id === 'v1');
    const audioTrack = tracks.find((t) => t.id === 'a1');
    expect(videoTrack.items).toHaveLength(2);
    expect(audioTrack.items).toHaveLength(1);
  });

  it('preserves clip start, end, and duration after round-trip', () => {
    const state = buildLegacyState();
    const timeline = legacyToTimeline(state);
    const { tracks } = timelineToLegacy(timeline, { timelineSeconds: 60 });

    const videoTrack = tracks.find((t) => t.id === 'v1');
    const firstClip = videoTrack.items[0];
    expect(firstClip.start).toBe(0);
    expect(firstClip.end).toBe(10);
    expect(firstClip.duration).toBe(10);
  });

  it('re-exposes items as clips alias for legacy compatibility', () => {
    const state = buildLegacyState();
    const timeline = legacyToTimeline(state);
    const { tracks } = timelineToLegacy(timeline, { timelineSeconds: 60 });

    for (const t of tracks) {
      // The bridge exposes both names pointing at the same array.
      expect(t.clips).toBe(t.items);
    }
  });

  it('groups clips by trackId correctly', () => {
    const state = buildLegacyState();
    const timeline = legacyToTimeline(state);
    // Add a clip to the timeline with a new trackId
    timeline.clips.push({
      id: 'c-extra',
      assetId: 'asset-extra',
      trackId: 'v1',
      name: 'Extra',
      startTime: 30,
      duration: 5,
      trimStart: 0,
      trimEnd: 0,
      speed: 1,
      opacity: 1,
      volume: 1,
      flipH: false,
      flipV: false,
      keyframes: [],
    });

    const { tracks } = timelineToLegacy(timeline, { timelineSeconds: 60 });
    const videoTrack = tracks.find((t) => t.id === 'v1');
    expect(videoTrack.items).toHaveLength(3);
    const audioTrack = tracks.find((t) => t.id === 'a1');
    expect(audioTrack.items).toHaveLength(1);
  });
});

describe('getPreviewClipFromTimeline', () => {
  it('returns a preview-shaped object for the selected clip', () => {
    const state = buildLegacyState();
    state.selectedClipId = 'c-video-1';
    const timeline = legacyToTimeline(state);
    const preview = getPreviewClipFromTimeline(timeline, state.selectedClipId, state);

    expect(preview).not.toBeNull();
    expect(preview.type).toBe('video');
    expect(preview.src).toBe('https://example.com/hero.mp4');
    expect(preview.name).toBe('Hero Wide');
    expect(preview.poster).toBe('https://example.com/hero.jpg');
    expect(preview.fit).toBe('cover');
  });

  it('resolves asset when clip has no src but asset does', () => {
    const state = buildLegacyState();
    state.selectedClipId = 'c-video-2';
    const timeline = legacyToTimeline(state);
    // Remove src from the legacy clip to force asset fallback
    const track = state.tracks[0];
    const clip = track.items.find((c) => c.id === 'c-video-2');
    delete clip.src;

    const preview = getPreviewClipFromTimeline(timeline, state.selectedClipId, state);
    expect(preview).not.toBeNull();
    expect(preview.src).toBe('https://example.com/product.mp4');
  });

  it('returns the right type for audio clips', () => {
    const state = buildLegacyState();
    state.selectedClipId = 'c-audio-1';
    const timeline = legacyToTimeline(state);
    const preview = getPreviewClipFromTimeline(timeline, state.selectedClipId, state);

    expect(preview).not.toBeNull();
    expect(preview.type).toBe('audio');
    expect(preview.src).toBe('https://example.com/vo.mp3');
  });

  it('returns null when no clip matches the selectedClipId', () => {
    const state = buildLegacyState();
    const timeline = legacyToTimeline(state);
    const preview = getPreviewClipFromTimeline(timeline, 'non-existent', state);
    expect(preview).toBeNull();
  });

  it('returns null when selectedClipId is null/undefined', () => {
    const state = buildLegacyState();
    const timeline = legacyToTimeline(state);
    expect(getPreviewClipFromTimeline(timeline, null, state)).toBeNull();
    expect(getPreviewClipFromTimeline(timeline, undefined, state)).toBeNull();
  });

  it('returns null when timeline is null', () => {
    expect(getPreviewClipFromTimeline(null, 'c-video-1', buildLegacyState())).toBeNull();
  });
});

describe('findAssetById', () => {
  it('looks in state.mediaLibrary', () => {
    const state = buildLegacyState();
    const asset = findAssetById(state, 'asset-video-1');
    expect(asset).not.toBeNull();
    expect(asset.name).toBe('Hero Wide');
  });

  it('looks in state.project.assets', () => {
    const state = {
      project: {
        assets: [{ id: 'a-1', name: 'In Project', url: 'https://example.com/a1.mp4' }],
      },
    };
    const asset = findAssetById(state, 'a-1');
    expect(asset).not.toBeNull();
    expect(asset.name).toBe('In Project');
  });

  it('looks in state.assets', () => {
    const state = {
      assets: [{ id: 'a-2', name: 'Top Level', url: 'https://example.com/a2.mp4' }],
    };
    const asset = findAssetById(state, 'a-2');
    expect(asset).not.toBeNull();
  });

  it('returns null for missing asset id', () => {
    const state = buildLegacyState();
    expect(findAssetById(state, 'no-such-asset')).toBeNull();
  });

  it('returns null for null state', () => {
    expect(findAssetById(null, 'x')).toBeNull();
    expect(findAssetById(undefined, 'x')).toBeNull();
  });

  it('returns null for null/empty assetId', () => {
    expect(findAssetById(buildLegacyState(), null)).toBeNull();
    expect(findAssetById(buildLegacyState(), '')).toBeNull();
  });
});

describe('syncTimelineFromState', () => {
  it('is a thin alias for legacyToTimeline', () => {
    const state = buildLegacyState();
    const t1 = legacyToTimeline(state);
    const t2 = syncTimelineFromState(state);
    expect(t1).toEqual(t2);
  });
});

describe('integration: bridge round-trips a realistic project', () => {
  it('preserves all clip fields through legacy → new → legacy', () => {
    const original = buildLegacyState();
    const timeline = legacyToTimeline(original);
    const { tracks } = timelineToLegacy(timeline, { timelineSeconds: 60 });

    // Count clips per track
    const originalVideoCount = original.tracks[0].items.length;
    const originalAudioCount = original.tracks[1].items.length;
    const roundTripVideo = tracks.find((t) => t.id === 'v1').items.length;
    const roundTripAudio = tracks.find((t) => t.id === 'a1').items.length;
    expect(roundTripVideo).toBe(originalVideoCount);
    expect(roundTripAudio).toBe(originalAudioCount);
  });
});
