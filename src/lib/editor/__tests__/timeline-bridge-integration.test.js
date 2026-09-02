/**
 * Integration test: verify that the TimelineEditorPage wiring change
 * populates `state.timeline` from the legacy store, and that
 * `updatePreview()` (via the bridge) produces a preview-shaped object
 * compatible with `renderPreviewAsset()`.
 *
 * We don't mount the full TimelineEditorPage component (it has heavy DOM
 * side effects). Instead, we verify the seam: the functions the wiring
 * change touches produce the right output.
 */

import { describe, it, expect } from 'vitest';
import {
  legacyToTimeline,
  timelineToLegacy,
  getPreviewClipFromTimeline,
  syncTimelineFromState,
} from '../timeline-bridge.js';

/** Simulate what createState() / loadProjectFromStorage() do after the
 *  wiring change: build a legacy state, then mirror it into the new
 *  Timeline model. */
function buildStateWithTimeline(overrides = {}) {
  const state = {
    projectId: 'p-1',
    projectTitle: 'Wiring Test',
    timelineSeconds: 30,
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
            id: 'clip-a',
            assetId: 'asset-a',
            name: 'Clip A',
            type: 'video',
            start: 0,
            end: 5,
            src: 'https://example.com/a.mp4',
          },
        ],
      },
    ],
    selectedClipId: 'clip-a',
    mediaLibrary: [
      {
        id: 'asset-a',
        type: 'video',
        name: 'Asset A',
        url: 'https://example.com/a.mp4',
        path: 'https://example.com/a.mp4',
        duration: 5,
      },
    ],
    ...overrides,
  };
  // Mirror into the new model — this is the wiring change.
  state.timeline = syncTimelineFromState(state);
  return state;
}

describe('TimelineEditorPage wiring integration', () => {
  it('createState path: state.timeline is populated and matches state.tracks', () => {
    const state = buildStateWithTimeline();
    expect(state.timeline).toBeDefined();
    expect(state.timeline.tracks).toHaveLength(1);
    expect(state.timeline.clips).toHaveLength(1);
    // The selected clip id is preserved
    expect(state.timeline.clips[0].id).toBe('clip-a');
  });

  it('updatePreview path: no-arg updatePreview resolves to a preview-shaped clip', () => {
    const state = buildStateWithTimeline();

    // Simulate the no-arg path of updatePreview():
    //   const selected = getPreviewClipFromTimeline(
    //     state.timeline, state.selectedClipId, state);
    const selected = getPreviewClipFromTimeline(
      state.timeline,
      state.selectedClipId,
      state,
    );

    // renderPreviewAsset expects: { type, src, name, poster, fit, heading, body }
    expect(selected).toMatchObject({
      id: 'clip-a',
      type: 'video',
      src: 'https://example.com/a.mp4',
      name: 'Clip A',
      heading: 'Clip A',
    });
  });

  it('after state.tracks is mutated, re-syncing state.timeline reflects the change', () => {
    const state = buildStateWithTimeline();
    expect(state.timeline.clips).toHaveLength(1);

    // Simulate a mutation (e.g. a drag-drop adds a clip)
    state.tracks[0].items.push({
      id: 'clip-b',
      assetId: 'asset-b',
      name: 'Clip B',
      type: 'video',
      start: 5,
      end: 10,
      src: 'https://example.com/b.mp4',
    });

    // Re-sync — this is what updatePreview() does on every call
    state.timeline = syncTimelineFromState(state);
    expect(state.timeline.clips).toHaveLength(2);
    const newClip = state.timeline.clips.find((c) => c.id === 'clip-b');
    expect(newClip.startTime).toBe(5);
    expect(newClip.duration).toBe(5);
  });

  it('after re-sync, the new clip can be previewed', () => {
    const state = buildStateWithTimeline();
    state.tracks[0].items.push({
      id: 'clip-b',
      assetId: 'asset-b',
      name: 'Clip B',
      type: 'video',
      start: 5,
      end: 10,
      src: 'https://example.com/b.mp4',
    });
    state.timeline = syncTimelineFromState(state);
    state.selectedClipId = 'clip-b';

    const selected = getPreviewClipFromTimeline(
      state.timeline,
      state.selectedClipId,
      state,
    );
    expect(selected.src).toBe('https://example.com/b.mp4');
    expect(selected.type).toBe('video');
  });

  it('writing back via timelineToLegacy preserves track structure for legacy readers', () => {
    const state = buildStateWithTimeline();
    const { tracks } = timelineToLegacy(state.timeline, { timelineSeconds: 30 });
    expect(tracks).toHaveLength(1);
    expect(tracks[0].id).toBe('v1');
    expect(tracks[0].type).toBe('video');
    expect(tracks[0].items).toHaveLength(1);
  });

  it('handles the demo data shape (left/width percent clips)', () => {
    // The default createState() uses percent-based clips
    const state = {
      projectId: 'demo',
      projectTitle: 'Demo',
      timelineSeconds: 45,
      tracks: [
        {
          id: 'track-video',
          type: 'video',
          name: 'Main Video',
          muted: false,
          solo: false,
          locked: false,
          items: [
            { id: 'clip-hero', name: 'Hero Wide', left: 2, width: 22, type: 'video' },
            { id: 'clip-product', name: 'Product Spin', left: 25, width: 16, type: 'video' },
          ],
        },
      ],
      selectedClipId: 'clip-hero',
    };
    state.timeline = syncTimelineFromState(state);
    expect(state.timeline.clips).toHaveLength(2);
    const hero = state.timeline.clips.find((c) => c.id === 'clip-hero');
    // 2% of 45s = 0.9s
    expect(hero.startTime).toBeCloseTo(0.9);
    // 22% of 45s = 9.9s duration
    expect(hero.duration).toBeCloseTo(9.9);
  });
});
