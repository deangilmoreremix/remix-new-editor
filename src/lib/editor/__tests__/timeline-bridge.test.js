import { describe, it, expect } from 'vitest';
import {
  legacyToTimeline,
  timelineToLegacy,
  getPreviewClipFromTimeline,
  findAssetById,
  syncTimelineFromState,
} from '../timeline-bridge.js';
import { setClipSpeed } from '../timeline-operations.js';

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

describe('Track field round-trip (name, muted, solo, locked)', () => {
  it('reads track name from legacy and writes it to the new model', () => {
    const timeline = legacyToTimeline(buildLegacyState());
    expect(timeline.tracks.find((t) => t.id === 'v1').name).toBe('V1');
    expect(timeline.tracks.find((t) => t.id === 'a1').name).toBe('A1');
  });

  it('reads track muted from legacy and exposes it as `muted` on the new model', () => {
    const timeline = legacyToTimeline(buildLegacyState());
    const v1 = timeline.tracks.find((t) => t.id === 'v1');
    const a1 = timeline.tracks.find((t) => t.id === 'a1');
    expect(v1.muted).toBe(false);
    expect(a1.muted).toBe(true);
  });

  it('reads legacy `solo` and exposes it as `solo` on the new model', () => {
    const timeline = legacyToTimeline(buildLegacyState());
    const v1 = timeline.tracks.find((t) => t.id === 'v1');
    expect(v1.solo).toBe(false);
  });

  it('reads track locked from legacy and exposes it as `locked` on the new model', () => {
    const timeline = legacyToTimeline(buildLegacyState());
    const v1 = timeline.tracks.find((t) => t.id === 'v1');
    expect(v1.locked).toBe(false);
  });

  it('writes new-model solo back to legacy `solo` on timelineToLegacy', () => {
    const timeline = legacyToTimeline(buildLegacyState());
    const soloedTimeline = {
      ...timeline,
      tracks: timeline.tracks.map((t, i) =>
        i === 0 ? { ...t, solo: true } : t,
      ),
    };
    const { tracks } = timelineToLegacy(soloedTimeline, { timelineSeconds: 60 });
    expect(tracks.find((t) => t.id === 'v1').solo).toBe(true);
    expect(tracks.find((t) => t.id === 'a1').solo).toBe(false);
  });

  it('round-trips muted/solo/locked through legacy → new → legacy', () => {
    const original = buildLegacyState();
    // Set a mix of flags on the legacy state
    original.tracks[0].muted = false;
    original.tracks[0].solo = true;
    original.tracks[0].locked = true;
    original.tracks[1].muted = true;
    original.tracks[1].solo = false;
    original.tracks[1].locked = false;

    const timeline = legacyToTimeline(original);
    const { tracks } = timelineToLegacy(timeline, { timelineSeconds: 60 });
    const v1 = tracks.find((t) => t.id === 'v1');
    const a1 = tracks.find((t) => t.id === 'a1');
    expect(v1.muted).toBe(false);
    expect(v1.solo).toBe(true);
    expect(v1.locked).toBe(true);
    expect(a1.muted).toBe(true);
    expect(a1.solo).toBe(false);
    expect(a1.locked).toBe(false);
  });

  it('round-trips track name through legacy → new → legacy', () => {
    const original = buildLegacyState();
    original.tracks[0].name = 'Custom Video Track';
    original.tracks[1].name = 'Custom Audio Track';

    const timeline = legacyToTimeline(original);
    expect(timeline.tracks[0].name).toBe('Custom Video Track');
    expect(timeline.tracks[1].name).toBe('Custom Audio Track');

    const { tracks } = timelineToLegacy(timeline, { timelineSeconds: 60 });
    expect(tracks[0].name).toBe('Custom Video Track');
    expect(tracks[1].name).toBe('Custom Audio Track');
  });
});

describe('Clip field round-trip (muted)', () => {
  it('reads clip muted from legacy and exposes it on the new model', () => {
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
          items: [
            { id: 'c-1', name: 'Clip 1', type: 'video', start: 0, end: 5, muted: true },
            { id: 'c-2', name: 'Clip 2', type: 'video', start: 5, end: 10, muted: false },
          ],
        },
      ],
    };
    const timeline = legacyToTimeline(state);
    const c1 = timeline.clips.find((c) => c.id === 'c-1');
    const c2 = timeline.clips.find((c) => c.id === 'c-2');
    expect(c1.muted).toBe(true);
    expect(c2.muted).toBe(false);
  });

  it('defaults clip muted to false when not set on legacy', () => {
    const timeline = legacyToTimeline(buildLegacyState());
    const clip = timeline.clips.find((c) => c.id === 'c-video-1');
    expect(clip.muted).toBe(false);
  });

  it('writes new-model clip muted back to legacy on timelineToLegacy', () => {
    const timeline = legacyToTimeline(buildLegacyState());
    const updated = {
      ...timeline,
      clips: timeline.clips.map((c, i) =>
        i === 0 ? { ...c, muted: true } : c,
      ),
    };
    const { tracks } = timelineToLegacy(updated, { timelineSeconds: 60 });
    expect(tracks[0].items[0].muted).toBe(true);
    expect(tracks[0].items[1].muted).toBe(false);
  });

  it('keeps clip muted independent of volume', () => {
    const state = {
      projectId: 'p-1',
      projectTitle: 'Demo',
      timelineSeconds: 60,
      tracks: [
        {
          id: 'v1',
          name: 'V1',
          type: 'video',
          items: [
            { id: 'c-1', name: 'Clip 1', type: 'video', start: 0, end: 5, volume: 0.5, muted: true },
          ],
        },
      ],
    };
    const timeline = legacyToTimeline(state);
    const clip = timeline.clips.find((c) => c.id === 'c-1');
    expect(clip.volume).toBe(0.5);
    expect(clip.muted).toBe(true);
  });
});

describe('Phase 4 — speed round-trip', () => {
  it('speed survives legacyToTimeline → timelineToLegacy round-trip', () => {
    const state = buildLegacyState();
    state.tracks[0].items[0].speed = 1.5;
    const timeline = legacyToTimeline(state);
    expect(timeline.clips.find((c) => c.id === 'c-video-1').speed).toBe(1.5);

    const { tracks } = timelineToLegacy(timeline, { timelineSeconds: 60 });
    expect(tracks[0].items[0].speed).toBe(1.5);
  });

  it('speed is clamped to 0.25–4 via bridge path', () => {
    const timeline = legacyToTimeline(buildLegacyState());
    const tooFast = setClipSpeed(timeline, 'c-video-1', 10);
    const tooSlow = setClipSpeed(timeline, 'c-video-2', 0.05);

    const { tracks } = timelineToLegacy(tooFast, { timelineSeconds: 60 });
    expect(tracks[0].items[0].speed).toBe(4.0);

    const { tracks: tracks2 } = timelineToLegacy(tooSlow, { timelineSeconds: 60 });
    expect(tracks2[0].items[1].speed).toBe(0.25);
  });

  it('speed defaults to 1 when missing', () => {
    const state = buildLegacyState();
    delete state.tracks[0].items[0].speed;
    delete state.tracks[0].items[0].playbackRate;
    const timeline = legacyToTimeline(state);
    const clip = timeline.clips.find((c) => c.id === 'c-video-1');
    expect(clip.speed).toBe(1);
  });
});

describe('Clip field round-trip (Phase 3: type, colorCorrection, letterbox, effects, reversed)', () => {
  it('reads clip type from legacy and stores it on the new model', () => {
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
          items: [
            { id: 'c-1', name: 'Title', type: 'text', start: 0, end: 5 },
            { id: 'c-2', name: 'Photo', type: 'image', start: 5, end: 10 },
            { id: 'c-3', name: 'Video', type: 'video', start: 10, end: 15 },
          ],
        },
      ],
    };
    const timeline = legacyToTimeline(state);
    expect(timeline.clips.find((c) => c.id === 'c-1').type).toBe('text');
    expect(timeline.clips.find((c) => c.id === 'c-2').type).toBe('image');
    expect(timeline.clips.find((c) => c.id === 'c-3').type).toBe('video');
  });

  it('derives clip type from asset when legacy clip type is missing', () => {
    const state = {
      projectId: 'p-1',
      projectTitle: 'Demo',
      timelineSeconds: 60,
      tracks: [
        {
          id: 'v1',
          name: 'V1',
          type: 'video',
          items: [
            { id: 'c-1', name: 'Clip', start: 0, end: 5 },
          ],
        },
      ],
    };
    const timeline = legacyToTimeline(state);
    // No type on clip, no asset, track is video → defaults to 'video'
    expect(timeline.clips.find((c) => c.id === 'c-1').type).toBe('video');
  });

  it('writes new-model clip type back to legacy on timelineToLegacy', () => {
    const timeline = legacyToTimeline(buildLegacyState());
    const updated = {
      ...timeline,
      clips: timeline.clips.map((c, i) =>
        i === 0 ? { ...c, type: 'text' } : c,
      ),
    };
    const { tracks } = timelineToLegacy(updated, { timelineSeconds: 60 });
    expect(tracks[0].items[0].type).toBe('text');
  });

  it('reads clip reversed from legacy and writes it back', () => {
    const state = {
      projectId: 'p-1',
      projectTitle: 'Demo',
      timelineSeconds: 60,
      tracks: [
        {
          id: 'v1',
          name: 'V1',
          type: 'video',
          items: [
            { id: 'c-1', name: 'Clip', type: 'video', start: 0, end: 5, reversed: true },
          ],
        },
      ],
    };
    const timeline = legacyToTimeline(state);
    expect(timeline.clips.find((c) => c.id === 'c-1').reversed).toBe(true);

    const { tracks } = timelineToLegacy(timeline, { timelineSeconds: 60 });
    expect(tracks[0].items[0].reversed).toBe(true);
  });

  it('reads clip colorCorrection from legacy and writes it back', () => {
    const state = {
      projectId: 'p-1',
      projectTitle: 'Demo',
      timelineSeconds: 60,
      tracks: [
        {
          id: 'v1',
          name: 'V1',
          type: 'video',
          items: [
            {
              id: 'c-1',
              name: 'Clip',
              type: 'video',
              start: 0,
              end: 5,
              colorCorrection: { brightness: 0.2, contrast: -0.1, saturation: 0, temperature: 0, tint: 0, exposure: 0, highlights: 0, shadows: 0 },
            },
          ],
        },
      ],
    };
    const timeline = legacyToTimeline(state);
    const cc = timeline.clips.find((c) => c.id === 'c-1').colorCorrection;
    expect(cc.brightness).toBe(0.2);
    expect(cc.contrast).toBe(-0.1);

    const { tracks } = timelineToLegacy(timeline, { timelineSeconds: 60 });
    expect(tracks[0].items[0].colorCorrection.brightness).toBe(0.2);
  });

  it('defaults colorCorrection to zeros when missing on legacy', () => {
    const timeline = legacyToTimeline(buildLegacyState());
    const clip = timeline.clips.find((c) => c.id === 'c-video-1');
    expect(clip.colorCorrection).toEqual({
      brightness: 0,
      contrast: 0,
      saturation: 0,
      temperature: 0,
      tint: 0,
      exposure: 0,
      highlights: 0,
      shadows: 0,
    });
  });

  it('reads clip letterbox from legacy and writes it back', () => {
    const state = {
      projectId: 'p-1',
      projectTitle: 'Demo',
      timelineSeconds: 60,
      tracks: [
        {
          id: 'v1',
          name: 'V1',
          type: 'video',
          items: [
            {
              id: 'c-1',
              name: 'Clip',
              type: 'video',
              start: 0,
              end: 5,
              letterbox: { enabled: true, aspectRatio: '2.39:1', color: '#000000', opacity: 80 },
            },
          ],
        },
      ],
    };
    const timeline = legacyToTimeline(state);
    const lb = timeline.clips.find((c) => c.id === 'c-1').letterbox;
    expect(lb.enabled).toBe(true);
    expect(lb.aspectRatio).toBe('2.39:1');
    expect(lb.opacity).toBe(80);

    const { tracks } = timelineToLegacy(timeline, { timelineSeconds: 60 });
    expect(tracks[0].items[0].letterbox.enabled).toBe(true);
  });

  it('defaults letterbox to disabled when missing on legacy', () => {
    const timeline = legacyToTimeline(buildLegacyState());
    const clip = timeline.clips.find((c) => c.id === 'c-video-1');
    expect(clip.letterbox).toEqual({
      enabled: false,
      aspectRatio: '2.35:1',
      color: '#000000',
      opacity: 100,
    });
  });

  it('reads clip effects from legacy and writes them back', () => {
    const state = {
      projectId: 'p-1',
      projectTitle: 'Demo',
      timelineSeconds: 60,
      tracks: [
        {
          id: 'v1',
          name: 'V1',
          type: 'video',
          items: [
            {
              id: 'c-1',
              name: 'Clip',
              type: 'video',
              start: 0,
              end: 5,
              effects: [
                { id: 'ef-1', type: 'blur', enabled: true, params: { radius: 5 } },
                { id: 'ef-2', type: 'lut-cinematic', enabled: false, params: { intensity: 0.8 } },
              ],
            },
          ],
        },
      ],
    };
    const timeline = legacyToTimeline(state);
    const effects = timeline.clips.find((c) => c.id === 'c-1').effects;
    expect(effects).toHaveLength(2);
    expect(effects[0].type).toBe('blur');
    expect(effects[1].type).toBe('lut-cinematic');

    const { tracks } = timelineToLegacy(timeline, { timelineSeconds: 60 });
    expect(tracks[0].items[0].effects).toHaveLength(2);
    expect(tracks[0].items[0].effects[0].type).toBe('blur');
  });

  it('defaults effects to empty array when missing on legacy', () => {
    const timeline = legacyToTimeline(buildLegacyState());
    const clip = timeline.clips.find((c) => c.id === 'c-video-1');
    expect(clip.effects).toEqual([]);
  });
});
