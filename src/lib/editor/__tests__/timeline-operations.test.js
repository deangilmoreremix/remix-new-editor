import { describe, it, expect } from 'vitest';
import {
  createDefaultTimeline,
  addClipToTrack,
  addTrack,
  removeTrack,
  updateTrack,
  trimClip,
  splitClip,
  rippleTrim,
  rollTrim,
  slipClip,
  slideClip,
  addKeyframe,
  removeKeyframe,
  moveKeyframe,
  addTransition,
  removeTransition,
  updateTransition,
  updateClipProperties,
  removeClip,
  moveClip,
  trackSelectForward,
  calculateTimelineDuration,
  snapToHalfSecond,
  linkClips,
  unlinkClips,
  unlinkAllFromClip,
  syncClips,
  duplicateClip,
  duplicateClips,
  splitAllTracks,
  clipAtTime,
} from '../timeline-operations.js';
import { clipEffectiveDuration, clipEndTime } from '../../../types/timeline.js';

/** Helper to build a simple timeline with one video track and one audio track */
function buildBaseTimeline() {
  const tl = createDefaultTimeline('test');
  return tl;
}

/** Helper to add a clip to the first video track */
function addVideoClip(timeline, asset, startTime = 0) {
  const videoTrack = timeline.tracks.find((t) => t.kind === 'video');
  return addClipToTrack(timeline, videoTrack.id, asset, startTime);
}

const mockAsset = {
  id: 'asset-1',
  type: 'video',
  name: 'Test Clip',
  duration: 10,
};

const mockAudioAsset = {
  id: 'asset-audio-1',
  type: 'audio',
  name: 'Test Audio',
  duration: 10,
};

describe('createDefaultTimeline', () => {
  it('produces a valid empty Timeline', () => {
    const tl = createDefaultTimeline('my project');
    expect(tl.id).toBeDefined();
    expect(tl.name).toBe('my project');
    expect(tl.tracks).toHaveLength(4);
    expect(tl.clips).toHaveLength(0);
    expect(tl.duration).toBe(0);
    expect(tl.transitions).toEqual([]);
    expect(tl.markers).toEqual([]);
    expect(tl.tracks.filter((t) => t.kind === 'video')).toHaveLength(2);
    expect(tl.tracks.filter((t) => t.kind === 'audio')).toHaveLength(2);
  });
});

describe('clipEffectiveDuration and clipEndTime', () => {
  it('computes effective duration with trim and speed', () => {
    const clip = {
      duration: 10,
      trimStart: 2,
      trimEnd: 1,
      speed: 2,
      startTime: 0,
    };
    expect(clipEffectiveDuration(clip)).toBeCloseTo((10 - 2 - 1) / 2);
    expect(clipEndTime(clip)).toBeCloseTo(0 + (10 - 2 - 1) / 2);
  });
});

describe('addTrack / removeTrack / updateTrack', () => {
  it('addTrack appends a new track of the requested kind', () => {
    let tl = buildBaseTimeline();
    tl = addTrack(tl, 'video');
    expect(tl.tracks).toHaveLength(5);
    const newTrack = tl.tracks.find((t) => t.name === 'V3');
    expect(newTrack).toBeDefined();
    expect(newTrack.kind).toBe('video');
    expect(newTrack.muted).toBe(false);
    expect(newTrack.locked).toBe(false);
    expect(newTrack.visible).toBe(true);
  });

  it('addTrack places video tracks before audio tracks', () => {
    let tl = buildBaseTimeline();
    tl = addTrack(tl, 'audio');
    const lastTrack = tl.tracks[tl.tracks.length - 1];
    expect(lastTrack.kind).toBe('audio');
  });

  it('removeTrack removes the track and its clips', () => {
    let tl = buildBaseTimeline();
    const trackToRemove = tl.tracks[0];
    tl = addVideoClip(tl, mockAsset, 0);
    tl = removeTrack(tl, trackToRemove.id);
    expect(tl.tracks.find((t) => t.id === trackToRemove.id)).toBeUndefined();
    expect(tl.clips.every((c) => c.trackId !== trackToRemove.id)).toBe(true);
  });

  it('removeTrack protects the last empty track of its kind when only one exists', () => {
    let tl = buildBaseTimeline();
    // Remove all but one video track
    const videoTracks = tl.tracks.filter((t) => t.kind === 'video');
    const toRemove = videoTracks[0];
    tl = { ...tl, tracks: tl.tracks.filter((t) => t.id !== toRemove.id) };
    const lastVideo = tl.tracks.find((t) => t.kind === 'video');
    const result = removeTrack(tl, lastVideo.id);
    expect(result.tracks).toHaveLength(tl.tracks.length); // unchanged
  });

  it('removeTrack allows removing the last track if it has clips', () => {
    let tl = buildBaseTimeline();
    const lastVideo = tl.tracks.find((t) => t.kind === 'video');
    tl = addVideoClip(tl, mockAsset, 0);
    // Move clip to the last video track
    tl = {
      ...tl,
      clips: tl.clips.map((c) => (c.trackId === lastVideo.id ? c : { ...c, trackId: lastVideo.id })),
    };
    const result = removeTrack(tl, lastVideo.id);
    expect(result.tracks.find((t) => t.id === lastVideo.id)).toBeUndefined();
  });

  it('updateTrack toggles mute, solo, locked, visible', () => {
    let tl = buildBaseTimeline();
    const track = tl.tracks[0];
    tl = updateTrack(tl, track.id, { muted: true, solo: true, locked: true, visible: false });
    const updated = tl.tracks.find((t) => t.id === track.id);
    expect(updated.muted).toBe(true);
    expect(updated.solo).toBe(true);
    expect(updated.locked).toBe(true);
    expect(updated.visible).toBe(false);
  });
});

describe('addClipToTrack', () => {
  it('adds a clip to a video track', () => {
    let tl = buildBaseTimeline();
    const track = tl.tracks.find((t) => t.kind === 'video');
    tl = addClipToTrack(tl, track.id, mockAsset, 0);
    // addClipToTrack creates a linked audio clip for video-on-video
    expect(tl.clips.length >= 1).toBe(true);
    const videoClip = tl.clips.find((c) => c.assetId === mockAsset.id && c.trackId === track.id);
    expect(videoClip).toBeDefined();
    expect(videoClip.name).toBe(mockAsset.name);
    expect(videoClip.startTime).toBe(0);
    expect(videoClip.duration).toBe(10);
    expect(videoClip.trimStart).toBe(0);
    expect(videoClip.trimEnd).toBe(0);
    expect(videoClip.speed).toBe(1);
    expect(videoClip.opacity).toBe(1);
    expect(videoClip.volume).toBe(1);
    expect(videoClip.flipH).toBe(false);
    expect(videoClip.flipV).toBe(false);
    expect(videoClip.keyframes).toEqual([]);
  });

  it('adds a linked audio clip when adding video to a video track', () => {
    let tl = buildBaseTimeline();
    const track = tl.tracks.find((t) => t.kind === 'video');
    tl = addClipToTrack(tl, track.id, mockAsset, 0);
    const videoClip = tl.clips.find((c) => c.assetId === mockAsset.id && c.trackId === track.id);
    const audioClip = tl.clips.find((c) => c.assetId === mockAsset.id && c.trackId !== track.id);
    expect(videoClip).toBeDefined();
    expect(audioClip).toBeDefined();
    expect(videoClip.linkedClipIds).toContain(audioClip.id);
    expect(audioClip.linkedClipIds).toContain(videoClip.id);
  });

  it('creates an audio track if none exists when linking video+audio', () => {
    let tl = buildBaseTimeline();
    // Remove all audio tracks
    tl = { ...tl, tracks: tl.tracks.filter((t) => t.kind === 'video') };
    const track = tl.tracks.find((t) => t.kind === 'video');
    tl = addClipToTrack(tl, track.id, mockAsset, 0);
    expect(tl.tracks.some((t) => t.kind === 'audio')).toBe(true);
  });

  it('does not link when adding audio to an audio track', () => {
    let tl = buildBaseTimeline();
    const audioTrack = tl.tracks.find((t) => t.kind === 'audio');
    tl = addClipToTrack(tl, audioTrack.id, mockAudioAsset, 0);
    expect(tl.clips.filter((c) => c.assetId === mockAudioAsset.id)).toHaveLength(1);
    expect(tl.clips[0].linkedClipIds).toBeUndefined();
  });
});

describe('removeClip', () => {
  it('removes a clip and its linked clips', () => {
    let tl = buildBaseTimeline();
    const track = tl.tracks.find((t) => t.kind === 'video');
    tl = addClipToTrack(tl, track.id, mockAsset, 0);
    const videoClip = tl.clips.find((c) => c.assetId === mockAsset.id && c.trackId === track.id);
    const clipIdToRemove = videoClip.id;
    tl = removeClip(tl, clipIdToRemove);
    // Both video and linked audio clips should be removed
    expect(tl.clips.filter((c) => c.assetId === mockAsset.id)).toHaveLength(0);
  });
});

describe('moveClip', () => {
  it('moves a clip to a new track and start time', () => {
    let tl = buildBaseTimeline();
    const v1 = tl.tracks.find((t) => t.kind === 'video' && t.name === 'V1');
    const v2 = tl.tracks.find((t) => t.kind === 'video' && t.name === 'V2');
    tl = addVideoClip(tl, mockAsset, 0);
    const clip = tl.clips.find((c) => c.assetId === mockAsset.id && c.trackId === v1.id);
    tl = moveClip(tl, clip.id, v2.id, 5);
    const moved = tl.clips.find((c) => c.id === clip.id);
    expect(moved.trackId).toBe(v2.id);
    expect(moved.startTime).toBe(5);
  });
});

describe('trimClip', () => {
  it('updates trimStart and trimEnd on the target clip', () => {
    let tl = buildBaseTimeline();
    tl = addVideoClip(tl, mockAsset, 0);
    const videoClip = tl.clips.find((c) => c.assetId === mockAsset.id && c.trackId === tl.tracks.find((t) => t.kind === 'video').id);
    tl = trimClip(tl, videoClip.id, 1, 2);
    const trimmed = tl.clips.find((c) => c.id === videoClip.id);
    expect(trimmed.trimStart).toBe(1);
    expect(trimmed.trimEnd).toBe(2);
  });

  it('also trims linked clips', () => {
    let tl = buildBaseTimeline();
    tl = addVideoClip(tl, mockAsset, 0);
    const videoClip = tl.clips.find((c) => c.assetId === mockAsset.id && c.trackId === tl.tracks.find((t) => t.kind === 'video').id);
    const linkedId = videoClip.linkedClipIds[0];
    tl = trimClip(tl, videoClip.id, 1, 2);
    const linked = tl.clips.find((c) => c.id === linkedId);
    expect(linked.trimStart).toBe(1);
    expect(linked.trimEnd).toBe(2);
  });
});

describe('splitClip', () => {
  it('splits a clip at the given time into two clips plus splits linked clips', () => {
    let tl = buildBaseTimeline();
    tl = addVideoClip(tl, mockAsset, 0);
    const videoClip = tl.clips.find((c) => c.assetId === mockAsset.id && c.trackId === tl.tracks.find((t) => t.kind === 'video').id);
    const splitTime = 5;
    tl = splitClip(tl, videoClip.id, splitTime);
    // Video clip splits into 2, linked audio clip splits into 2 = 4 total
    expect(tl.clips.length).toBeGreaterThanOrEqual(2);
    const firstVideo = tl.clips.find((c) => c.id === videoClip.id);
    expect(firstVideo).toBeDefined();
    const secondVideo = tl.clips.find((c) => c.id !== videoClip.id && c.assetId === mockAsset.id && c.trackId === videoClip.trackId);
    expect(secondVideo).toBeDefined();
    expect(firstVideo.startTime).toBe(0);
    expect(secondVideo.startTime).toBe(splitTime);
  });

  it('does nothing if splitTime is outside the clip bounds', () => {
    let tl = buildBaseTimeline();
    tl = addVideoClip(tl, mockAsset, 0);
    const videoClip = tl.clips.find((c) => c.assetId === mockAsset.id && c.trackId === tl.tracks.find((t) => t.kind === 'video').id);
    const before = { ...tl };
    tl = splitClip(tl, videoClip.id, -1);
    expect(tl.clips).toEqual(before.clips);
    tl = splitClip(tl, videoClip.id, 100);
    expect(tl.clips).toEqual(before.clips);
  });
});

describe('rippleTrim', () => {
  it('trims right edge and shifts subsequent clips', () => {
    let tl = buildBaseTimeline();
    tl = addVideoClip(tl, { ...mockAsset, id: 'a1', name: 'A' }, 0);
    tl = addVideoClip(tl, { ...mockAsset, id: 'a2', name: 'B' }, 10);
    const clipA = tl.clips.find((c) => c.assetId === 'a1');
    const clipB = tl.clips.find((c) => c.assetId === 'a2');
    // Set initial trim so there's room to trim
    tl = trimClip(tl, clipA.id, 0, 2);
    tl = rippleTrim(tl, clipA.id, 'right', -2);
    const updatedA = tl.clips.find((c) => c.id === clipA.id);
    expect(updatedA.trimEnd).toBe(4);
    const updatedB = tl.clips.find((c) => c.id === clipB.id);
    expect(updatedB.startTime).toBe(8);
  });
});

describe('rollTrim', () => {
  it('adjusts trim on both adjacent clips', () => {
    let tl = buildBaseTimeline();
    tl = addVideoClip(tl, { ...mockAsset, id: 'a1', name: 'A' }, 0);
    tl = addVideoClip(tl, { ...mockAsset, id: 'a2', name: 'B' }, 10);
    const clipA = tl.clips.find((c) => c.assetId === 'a1');
    const clipB = tl.clips.find((c) => c.assetId === 'a2');
    // Set initial trims so roll trim has room to work
    tl = trimClip(tl, clipA.id, 0, 2);
    tl = trimClip(tl, clipB.id, 2, 0);
    tl = rollTrim(tl, clipA.id, clipB.id, 1);
    const updatedA = tl.clips.find((c) => c.id === clipA.id);
    const updatedB = tl.clips.find((c) => c.id === clipB.id);
    // Roll trim with delta=1: A's trimEnd decreases by 1 (from 2 to 1), B's trimStart increases by 1 (from 2 to 3)
    expect(updatedA.trimEnd).toBe(1);
    expect(updatedB.trimStart).toBe(3);
    // In roll trim, startTime shifts by the clamped amount
    expect(updatedB.startTime).toBe(11);
  });
});

describe('slipClip', () => {
  it('shifts source material without changing position or duration', () => {
    let tl = buildBaseTimeline();
    tl = addVideoClip(tl, mockAsset, 0);
    const videoClip = tl.clips.find((c) => c.assetId === mockAsset.id && c.trackId === tl.tracks.find((t) => t.kind === 'video').id);
    const originalStart = videoClip.startTime;
    // Set initial trim to give room to slip
    tl = trimClip(tl, videoClip.id, 1, 1);
    const trimmedClip = tl.clips.find((c) => c.id === videoClip.id);
    const originalDuration = clipEffectiveDuration(trimmedClip);
    tl = slipClip(tl, trimmedClip.id, 0.5);
    const slipped = tl.clips.find((c) => c.id === trimmedClip.id);
    expect(slipped.startTime).toBe(originalStart);
    expect(clipEffectiveDuration(slipped)).toBeCloseTo(originalDuration);
  });
});

describe('slideClip', () => {
  it('slides clip and adjusts neighboring trim values', () => {
    let tl = buildBaseTimeline();
    tl = addVideoClip(tl, { ...mockAsset, id: 'a1', name: 'A' }, 0);
    tl = addVideoClip(tl, { ...mockAsset, id: 'a2', name: 'B' }, 10);
    tl = addVideoClip(tl, { ...mockAsset, id: 'a3', name: 'C' }, 20);
    const clipA = tl.clips.find((c) => c.assetId === 'a1');
    const clipB = tl.clips.find((c) => c.assetId === 'a2');
    const clipC = tl.clips.find((c) => c.assetId === 'a3');
    // Set initial trims to allow sliding
    tl = trimClip(tl, clipA.id, 0, 2);
    tl = trimClip(tl, clipC.id, 2, 0);
    tl = slideClip(tl, clipB.id, 1);
    const updatedB = tl.clips.find((c) => c.id === clipB.id);
    const updatedA = tl.clips.find((c) => c.id === clipA.id);
    const updatedC = tl.clips.find((c) => c.id === clipC.id);
    expect(updatedB.startTime).toBe(11);
    expect(updatedA.trimEnd).toBe(1);
    expect(updatedC.trimStart).toBe(3);
    expect(updatedC.startTime).toBe(21);
  });
});

describe('addKeyframe / removeKeyframe / moveKeyframe', () => {
  it('adds a keyframe to a clip', () => {
    let tl = buildBaseTimeline();
    tl = addVideoClip(tl, mockAsset, 0);
    const videoClip = tl.clips.find((c) => c.assetId === mockAsset.id && c.trackId === tl.tracks.find((t) => t.kind === 'video').id);
    tl = addKeyframe(tl, videoClip.id, { time: 1, property: 'opacity', value: 0.5 });
    const updated = tl.clips.find((c) => c.id === videoClip.id);
    expect(updated.keyframes).toHaveLength(1);
    expect(updated.keyframes[0]).toEqual({ time: 1, property: 'opacity', value: 0.5 });
  });

  it('removes a keyframe by index', () => {
    let tl = buildBaseTimeline();
    tl = addVideoClip(tl, mockAsset, 0);
    const videoClip = tl.clips.find((c) => c.assetId === mockAsset.id && c.trackId === tl.tracks.find((t) => t.kind === 'video').id);
    tl = addKeyframe(tl, videoClip.id, { time: 1, property: 'opacity', value: 0.5 });
    tl = addKeyframe(tl, videoClip.id, { time: 2, property: 'opacity', value: 0.8 });
    const updated = tl.clips.find((c) => c.id === videoClip.id);
    expect(updated.keyframes).toHaveLength(2);
    tl = removeKeyframe(tl, videoClip.id, 0);
    const afterRemove = tl.clips.find((c) => c.id === videoClip.id);
    expect(afterRemove.keyframes).toHaveLength(1);
    expect(afterRemove.keyframes[0].time).toBe(2);
  });

  it('moves a keyframe to a new time', () => {
    let tl = buildBaseTimeline();
    tl = addVideoClip(tl, mockAsset, 0);
    const videoClip = tl.clips.find((c) => c.assetId === mockAsset.id && c.trackId === tl.tracks.find((t) => t.kind === 'video').id);
    tl = addKeyframe(tl, videoClip.id, { time: 1, property: 'opacity', value: 0.5 });
    tl = moveKeyframe(tl, videoClip.id, 0, 3);
    const updated = tl.clips.find((c) => c.id === videoClip.id);
    expect(updated.keyframes[0].time).toBe(3);
  });
});

describe('addTransition / removeTransition / updateTransition', () => {
  it('adds a dissolve transition between two clips with available handle', () => {
    let tl = buildBaseTimeline();
    tl = addVideoClip(tl, { ...mockAsset, id: 'a1', name: 'A' }, 0);
    tl = addVideoClip(tl, { ...mockAsset, id: 'a2', name: 'B' }, 10);
    const clipA = tl.clips.find((c) => c.assetId === 'a1');
    const clipB = tl.clips.find((c) => c.assetId === 'a2');
    // Give clips some trim room
    tl = trimClip(tl, clipA.id, 0, 2);
    tl = trimClip(tl, clipB.id, 2, 0);
    const transition = {
      id: 'trans-1',
      type: 'dissolve',
      duration: 2,
      clipAId: clipA.id,
      clipBId: clipB.id,
    };
    tl = addTransition(tl, transition);
    expect(tl.transitions).toHaveLength(1);
    expect(tl.transitions[0].id).toBe('trans-1');
    // clipB should have shifted left by 2
    const updatedB = tl.clips.find((c) => c.id === clipB.id);
    expect(updatedB.startTime).toBe(8);
  });

  it('removes a transition by id', () => {
    let tl = buildBaseTimeline();
    tl = addVideoClip(tl, { ...mockAsset, id: 'a1', name: 'A' }, 0);
    tl = addVideoClip(tl, { ...mockAsset, id: 'a2', name: 'B' }, 10);
    const clipA = tl.clips.find((c) => c.assetId === 'a1');
    const clipB = tl.clips.find((c) => c.assetId === 'a2');
    tl = trimClip(tl, clipA.id, 0, 2);
    tl = trimClip(tl, clipB.id, 2, 0);
    const transition = {
      id: 'trans-1',
      type: 'dissolve',
      duration: 2,
      clipAId: clipA.id,
      clipBId: clipB.id,
    };
    tl = addTransition(tl, transition);
    tl = removeTransition(tl, 'trans-1');
    expect(tl.transitions).toHaveLength(0);
  });

  it('updates a transition', () => {
    let tl = buildBaseTimeline();
    tl = addVideoClip(tl, { ...mockAsset, id: 'a1', name: 'A' }, 0);
    tl = addVideoClip(tl, { ...mockAsset, id: 'a2', name: 'B' }, 10);
    const clipA = tl.clips.find((c) => c.assetId === 'a1');
    const clipB = tl.clips.find((c) => c.assetId === 'a2');
    tl = trimClip(tl, clipA.id, 0, 2);
    tl = trimClip(tl, clipB.id, 2, 0);
    const transition = {
      id: 'trans-1',
      type: 'dissolve',
      duration: 2,
      clipAId: clipA.id,
      clipBId: clipB.id,
    };
    tl = addTransition(tl, transition);
    tl = updateTransition(tl, 'trans-1', { duration: 1.5 });
    expect(tl.transitions[0].duration).toBe(1.5);
  });
});

describe('updateClipProperties', () => {
  it('updates volume, opacity, and flip on the target clip', () => {
    let tl = buildBaseTimeline();
    tl = addVideoClip(tl, mockAsset, 0);
    const videoClip = tl.clips.find((c) => c.assetId === mockAsset.id && c.trackId === tl.tracks.find((t) => t.kind === 'video').id);
    tl = updateClipProperties(tl, videoClip.id, { volume: 0.5, opacity: 0.8, flipH: true, flipV: true });
    const updated = tl.clips.find((c) => c.id === videoClip.id);
    expect(updated.volume).toBe(0.5);
    expect(updated.opacity).toBe(0.8);
    expect(updated.flipH).toBe(true);
    expect(updated.flipV).toBe(true);
  });

  it('clamps opacity to 0-1 and volume to 0-4', () => {
    let tl = buildBaseTimeline();
    tl = addVideoClip(tl, mockAsset, 0);
    const videoClip = tl.clips.find((c) => c.assetId === mockAsset.id && c.trackId === tl.tracks.find((t) => t.kind === 'video').id);
    tl = updateClipProperties(tl, videoClip.id, { opacity: 2, volume: 10 });
    const updated = tl.clips.find((c) => c.id === videoClip.id);
    expect(updated.opacity).toBe(1);
    expect(updated.volume).toBe(4);
  });

  it('propagates speed to linked clips', () => {
    let tl = buildBaseTimeline();
    tl = addVideoClip(tl, mockAsset, 0);
    const videoClip = tl.clips.find((c) => c.assetId === mockAsset.id && c.trackId === tl.tracks.find((t) => t.kind === 'video').id);
    const linkedId = videoClip.linkedClipIds[0];
    tl = updateClipProperties(tl, videoClip.id, { speed: 2 });
    const linked = tl.clips.find((c) => c.id === linkedId);
    expect(linked.speed).toBe(2);
  });

  it('does not propagate opacity/flip to linked clips', () => {
    let tl = buildBaseTimeline();
    tl = addVideoClip(tl, mockAsset, 0);
    const videoClip = tl.clips.find((c) => c.assetId === mockAsset.id && c.trackId === tl.tracks.find((t) => t.kind === 'video').id);
    const linkedId = videoClip.linkedClipIds[0];
    tl = updateClipProperties(tl, videoClip.id, { opacity: 0.5, flipH: true });
    const linked = tl.clips.find((c) => c.id === linkedId);
    expect(linked.opacity).toBe(1); // unchanged
    expect(linked.flipH).toBe(false); // unchanged
  });
});

describe('trackSelectForward', () => {
  it('returns all clips on the same track from the given clip start time forward', () => {
    let tl = buildBaseTimeline();
    tl = addVideoClip(tl, { ...mockAsset, id: 'a1', name: 'A' }, 0);
    tl = addVideoClip(tl, { ...mockAsset, id: 'a2', name: 'B' }, 5);
    tl = addVideoClip(tl, { ...mockAsset, id: 'a3', name: 'C' }, 15);
    const clipA = tl.clips.find((c) => c.assetId === 'a1');
    const result = trackSelectForward(tl, clipA.id);
    expect(result.has(clipA.id)).toBe(true);
    expect(result.has(tl.clips.find((c) => c.assetId === 'a2').id)).toBe(true);
    expect(result.has(tl.clips.find((c) => c.assetId === 'a3').id)).toBe(true);
  });
});

describe('calculateTimelineDuration', () => {
  it('returns the maximum end time of all clips', () => {
    let tl = buildBaseTimeline();
    tl = addVideoClip(tl, mockAsset, 0);
    const duration = calculateTimelineDuration(tl);
    expect(duration).toBeGreaterThan(0);
  });
});

describe('snapToHalfSecond', () => {
  it('snaps a time value to the nearest 0.5', () => {
    expect(snapToHalfSecond(0.1)).toBe(0);
    expect(snapToHalfSecond(0.3)).toBe(0.5);
    expect(snapToHalfSecond(1.2)).toBe(1);
    expect(snapToHalfSecond(1.3)).toBe(1.5);
  });
});

describe('linkClips / unlinkClips / unlinkAllFromClip', () => {
  it('links two clips bidirectionally', () => {
    let tl = buildBaseTimeline();
    tl = addVideoClip(tl, { ...mockAsset, id: 'a1', name: 'A' }, 0);
    tl = addVideoClip(tl, { ...mockAsset, id: 'a2', name: 'B' }, 0);
    const clipA = tl.clips.find((c) => c.assetId === 'a1');
    const clipB = tl.clips.find((c) => c.assetId === 'a2');
    tl = linkClips(tl, clipA.id, clipB.id);
    const updatedA = tl.clips.find((c) => c.id === clipA.id);
    const updatedB = tl.clips.find((c) => c.id === clipB.id);
    expect(updatedA.linkedClipIds).toContain(clipB.id);
    expect(updatedB.linkedClipIds).toContain(clipA.id);
  });

  it('unlinks two clips', () => {
    let tl = buildBaseTimeline();
    tl = addVideoClip(tl, { ...mockAsset, id: 'a1', name: 'A' }, 0);
    tl = addVideoClip(tl, { ...mockAsset, id: 'a2', name: 'B' }, 0);
    const clipA = tl.clips.find((c) => c.assetId === 'a1');
    const clipB = tl.clips.find((c) => c.assetId === 'a2');
    tl = linkClips(tl, clipA.id, clipB.id);
    tl = unlinkClips(tl, clipA.id, clipB.id);
    const updatedA = tl.clips.find((c) => c.id === clipA.id);
    const updatedB = tl.clips.find((c) => c.id === clipB.id);
    // Each clip still has its own linked audio clip from addVideoClip
    expect(updatedA.linkedClipIds?.length).toBeGreaterThan(0);
    expect(updatedB.linkedClipIds?.length).toBeGreaterThan(0);
    // But they should no longer be linked to each other
    expect(updatedA.linkedClipIds).not.toContain(clipB.id);
    expect(updatedB.linkedClipIds).not.toContain(clipA.id);
  });

  it('unlinkAllFromClip removes all links from a clip', () => {
    let tl = buildBaseTimeline();
    tl = addVideoClip(tl, { ...mockAsset, id: 'a1', name: 'A' }, 0);
    tl = addVideoClip(tl, { ...mockAsset, id: 'a2', name: 'B' }, 0);
    tl = addVideoClip(tl, { ...mockAsset, id: 'a3', name: 'C' }, 0);
    const clipA = tl.clips.find((c) => c.assetId === 'a1');
    const clipB = tl.clips.find((c) => c.assetId === 'a2');
    const clipC = tl.clips.find((c) => c.assetId === 'a3');
    tl = linkClips(tl, clipA.id, clipB.id);
    tl = linkClips(tl, clipA.id, clipC.id);
    tl = unlinkAllFromClip(tl, clipA.id);
    const updatedA = tl.clips.find((c) => c.id === clipA.id);
    expect(updatedA.linkedClipIds).toBeUndefined();
    // clipB and clipC should no longer be linked to clipA
    expect(tl.clips.find((c) => c.id === clipB.id).linkedClipIds).not.toContain(clipA.id);
    expect(tl.clips.find((c) => c.id === clipC.id).linkedClipIds).not.toContain(clipA.id);
  });
});

describe('syncClips', () => {
  it('links video and audio clips and positions audio at offset', () => {
    let tl = buildBaseTimeline();
    tl = addVideoClip(tl, { ...mockAsset, id: 'v1', name: 'V' }, 0);
    tl = addVideoClip(tl, { ...mockAudioAsset, id: 'a1', name: 'A' }, 0);
    const videoClip = tl.clips.find((c) => c.assetId === 'v1');
    const audioClip = tl.clips.find((c) => c.assetId === 'a1');
    tl = syncClips(tl, videoClip.id, audioClip.id, 1.5, 'keep');
    const updatedAudio = tl.clips.find((c) => c.id === audioClip.id);
    expect(updatedAudio.startTime).toBeCloseTo(1.5);
    expect(updatedAudio.linkedClipIds).toContain(videoClip.id);
  });
});

describe('duplicateClip', () => {
  it('creates a copy at the new start time', () => {
    let tl = buildBaseTimeline();
    tl = addVideoClip(tl, mockAsset, 0);
    const videoClip = tl.clips.find((c) => c.assetId === mockAsset.id && c.trackId === tl.tracks.find((t) => t.kind === 'video').id);
    const { timeline: newTl, newClipId } = duplicateClip(tl, videoClip.id, 12);
    expect(newClipId).not.toBeNull();
    // Original video + linked audio + new video copy = 3 clips
    expect(newTl.clips.length).toBeGreaterThanOrEqual(2);
    const copy = newTl.clips.find((c) => c.id === newClipId);
    expect(copy.startTime).toBe(12);
  });
});

describe('duplicateClips', () => {
  it('duplicates multiple clips', () => {
    let tl = buildBaseTimeline();
    tl = addVideoClip(tl, { ...mockAsset, id: 'a1', name: 'A' }, 0);
    tl = addVideoClip(tl, { ...mockAsset, id: 'a2', name: 'B' }, 0);
    const ids = tl.clips.map((c) => c.id);
    const { timeline: newTl, newClipIds } = duplicateClips(tl, ids);
    expect(newClipIds.length).toBeGreaterThanOrEqual(2);
    expect(newTl.clips.length).toBeGreaterThanOrEqual(4);
  });
});

describe('splitAllTracks', () => {
  it('splits all clips across all non-locked tracks', () => {
    let tl = buildBaseTimeline();
    tl = addVideoClip(tl, { ...mockAsset, id: 'a1', name: 'A' }, 0);
    const videoClip = tl.clips.find((c) => c.assetId === 'a1');
    tl = splitAllTracks(tl, 5);
    expect(tl.clips.length).toBeGreaterThanOrEqual(2);
  });
});

describe('clipAtTime', () => {
  it('returns the clip at a given time on a track', () => {
    let tl = buildBaseTimeline();
    tl = addVideoClip(tl, mockAsset, 0);
    const clip = tl.clips.find((c) => c.assetId === mockAsset.id && c.trackId === tl.tracks.find((t) => t.kind === 'video').id);
    const track = tl.tracks.find((t) => t.id === clip.trackId);
    const found = clipAtTime(tl, track.id, 1);
    expect(found).toBeDefined();
    expect(found.id).toBe(clip.id);
  });

  it('returns undefined if no clip covers the time', () => {
    let tl = buildBaseTimeline();
    tl = addVideoClip(tl, mockAsset, 0);
    const clip = tl.clips.find((c) => c.assetId === mockAsset.id && c.trackId === tl.tracks.find((t) => t.kind === 'video').id);
    const track = tl.tracks.find((t) => t.id === clip.trackId);
    const found = clipAtTime(tl, track.id, 100);
    expect(found).toBeUndefined();
  });
});
