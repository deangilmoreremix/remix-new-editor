/**
 * Timeline Bridge — bidirectional adapter between the legacy editor store
 * shapes (src/lib/timeline-editor/types.ts + TimelineState.js + the
 * `state.tracks` array in TimelineEditorPage.jsx) and the new pure
 * Timeline model (src/types/timeline.js + src/lib/editor/timeline-operations.js).
 *
 * Phase 0 ported the new model in. Phase 1 wires it into the editor without
 * ripping out the legacy store — this bridge is the seam.
 *
 * Conventions:
 *   - Legacy clips may live in either `track.clips` or `track.items` (the
 *     editor aliases them to the same array, but older reads still hit
 *     either name). The bridge accepts both.
 *   - Legacy clips may use `start`/`end` OR `left`/`width` (percent of
 *     `timelineSeconds`). The bridge normalises to seconds.
 *   - Legacy tracks may use `type: 'video' | 'audio' | 'text' | 'effects'`
 *     or `kind: 'video' | 'audio'`. The bridge normalises to `kind`.
 *   - Assets live in `state.mediaLibrary`, `state.project.assets`, or
 *     `state.assets` depending on the call site. The bridge checks all
 *     three.
 */

import { DEFAULT_VIDEO_COLOR, DEFAULT_AUDIO_COLOR } from '../../types/timeline.js';

/**
 * Look up an asset in the legacy state by id.
 * Checks mediaLibrary, project.assets, and assets.
 *
 * @param {Object} state - The legacy editor state object
 * @param {string} assetId
 * @returns {Object|null}
 */
export function findAssetById(state, assetId) {
  if (!state || !assetId) return null;
  const pools = [
    state.mediaLibrary,
    state.project && state.project.assets,
    state.assets,
  ];
  for (const pool of pools) {
    if (Array.isArray(pool)) {
      const found = pool.find((a) => a && a.id === assetId);
      if (found) return found;
    }
  }
  return null;
}

/**
 * Convert a legacy track's `type` or `kind` field to the new model's
 * `kind: 'video' | 'audio'`. Text/effects tracks map to video so they
 * have a valid kind; callers that need to distinguish should keep the
 * original via track.metadata.
 *
 * @param {Object} track
 * @returns {'video' | 'audio'}
 */
function trackKind(track) {
  if (track.kind === 'video' || track.kind === 'audio') return track.kind;
  const t = (track.type || '').toLowerCase();
  if (t === 'audio') return 'audio';
  return 'video';
}

/**
 * Get the clips array from a legacy track, accepting either `clips` or
 * `items` (the editor aliases them).
 *
 * @param {Object} track
 * @returns {Array}
 */
function trackClips(track) {
  if (Array.isArray(track.clips)) return track.clips;
  if (Array.isArray(track.items)) return track.items;
  return [];
}

/**
 * Convert a legacy clip's start/end or left/width to absolute seconds.
 *
 * Legacy clips use one of two representations:
 *   - `start`/`end` in seconds
 *   - `left`/`width` in percent of `timelineSeconds`
 *
 * Some clips also have `trimIn`/`trimOut` instead of `duration`.
 *
 * @param {Object} clip
 * @param {number} timelineSeconds
 * @returns {{ startTime: number, duration: number }}
 */
function clipTime(clip, timelineSeconds) {
  const total = timelineSeconds || 0;
  let startTime;
  let endTime;

  if (typeof clip.start === 'number') {
    startTime = clip.start;
  } else if (typeof clip.left === 'number') {
    startTime = (clip.left / 100) * total;
  } else {
    startTime = 0;
  }

  if (typeof clip.end === 'number') {
    endTime = clip.end;
  } else if (typeof clip.left === 'number' && typeof clip.width === 'number') {
    endTime = ((clip.left + clip.width) / 100) * total;
  } else if (typeof clip.duration === 'number') {
    endTime = startTime + clip.duration;
  } else {
    endTime = startTime;
  }

  return { startTime, duration: Math.max(0, endTime - startTime) };
}

/**
 * Convert a single legacy clip into the new Clip shape.
 *
 * @param {Object} clip - Legacy clip
 * @param {Object} track - Parent legacy track
 * @param {number} timelineSeconds
 * @returns {Object} A new-model Clip
 */
function legacyClipToNew(clip, track, timelineSeconds) {
  const { startTime, duration } = clipTime(clip, timelineSeconds);
  const trimStart = typeof clip.trimStart === 'number'
    ? clip.trimStart
    : (typeof clip.trimIn === 'number' ? clip.trimIn : 0);
  const trimEnd = typeof clip.trimEnd === 'number'
    ? clip.trimEnd
    : (typeof clip.sourceEnd === 'number' && typeof clip.duration === 'number'
        ? Math.max(0, clip.sourceEnd - clip.duration)
        : 0);
  const speed = typeof clip.speed === 'number'
    ? clip.speed
    : (typeof clip.playbackRate === 'number' ? clip.playbackRate : 1);

  return {
    id: clip.id,
    assetId: clip.assetId || clip.id,
    trackId: track.id,
    name: clip.name || clip.heading || '',
    startTime,
    duration,
    trimStart,
    trimEnd,
    speed,
    opacity: typeof clip.opacity === 'number' ? clip.opacity : 1,
    volume: typeof clip.volume === 'number' ? clip.volume : 1,
    flipH: Boolean(clip.flipH),
    flipV: Boolean(clip.flipV),
    keyframes: Array.isArray(clip.keyframes) ? clip.keyframes : [],
    linkedClipIds: Array.isArray(clip.linkedClipIds) ? clip.linkedClipIds : undefined,
    // Our own additions (not in CineGen — keep)
    type: clip.type || (track.kind === 'audio' ? 'audio' : 'video'),
    muted: typeof clip.muted === 'boolean' ? clip.muted : false,
    reversed: Boolean(clip.reversed),
    colorCorrection: clip.colorCorrection || {
      brightness: 0,
      contrast: 0,
      saturation: 0,
      temperature: 0,
      tint: 0,
      exposure: 0,
      highlights: 0,
      shadows: 0,
    },
    letterbox: clip.letterbox || {
      enabled: false,
      aspectRatio: '2.35:1',
      color: '#000000',
      opacity: 100,
    },
    effects: Array.isArray(clip.effects) ? clip.effects : [],
  };
}

/**
 * Convert the legacy editor state into a new-model Timeline.
 *
 * Accepts the state object used in TimelineEditorPage.jsx (which has
 * `state.tracks` and optionally `state.project.tracks`). Prefers
 * `state.tracks`; falls back to `state.project.tracks` if absent.
 *
 * @param {Object} state - Legacy editor state
 * @returns {Object} A new-model Timeline
 */
export function legacyToTimeline(state) {
  const tracks = (state && (state.tracks || (state.project && state.project.tracks))) || [];
  const timelineSeconds = (state && state.timelineSeconds) || 0;
  const id = (state && state.projectId) || (state && state.project && state.project.id) || 'timeline-1';
  const name = (state && state.projectTitle) || (state && state.project && state.project.name) || 'Untitled';

  const newTracks = [];
  const newClips = [];

  for (const track of tracks) {
    const newTrack = {
      id: track.id,
      name: track.name || track.id,
      kind: trackKind(track),
      color: track.color || (trackKind(track) === 'audio' ? DEFAULT_AUDIO_COLOR : DEFAULT_VIDEO_COLOR),
      muted: Boolean(track.muted),
      solo: Boolean(track.solo),
      locked: Boolean(track.locked),
      visible: track.visible !== false,
      volume: typeof track.volume === 'number' ? track.volume : 1,
    };
    newTracks.push(newTrack);

    for (const clip of trackClips(track)) {
      newClips.push(legacyClipToNew(clip, track, timelineSeconds));
    }
  }

  return {
    id,
    name,
    tracks: newTracks,
    clips: newClips,
    duration: 0,
    transitions: [],
    markers: [],
  };
}

/**
 * Convert a new-model Timeline back to a legacy `state.tracks`-shaped
 * object. This is the inverse of legacyToTimeline and is used so that
 * existing UI that still reads from `state.tracks` keeps working during
 * the transition.
 *
 * Note: the new model is flat (clips live at the top level of Timeline)
 * while the legacy model nests clips under each track. This function
 * re-groups by trackId.
 *
 * @param {Object} timeline - A new-model Timeline
 * @param {Object} [meta] - Optional metadata (e.g. timelineSeconds) to
 *   carry back into the legacy shape
 * @returns {{ tracks: Array, timelineSeconds: number }}
 */
export function timelineToLegacy(timeline, meta = {}) {
  const tracksOut = [];
  for (const t of timeline.tracks) {
    const clipsForTrack = timeline.clips
      .filter((c) => c.trackId === t.id)
      .map(newClipToLegacy);
    tracksOut.push({
      id: t.id,
      name: t.name,
      type: t.kind === 'audio' ? 'audio' : 'video',
      kind: t.kind,
      muted: t.muted,
      solo: t.solo,
      locked: t.locked,
      visible: t.visible,
      color: t.color,
      volume: t.volume,
      items: clipsForTrack,
      // Legacy editor aliases items ↔ clips; expose both for safety.
      clips: clipsForTrack,
    });
  }
  return {
    tracks: tracksOut,
    timelineSeconds: meta.timelineSeconds || timeline.duration || 0,
  };
}

/**
 * Convert a new-model Clip back to the legacy shape.
 *
 * @param {Object} clip
 * @returns {Object}
 */
function newClipToLegacy(clip) {
  return {
    id: clip.id,
    assetId: clip.assetId,
    name: clip.name,
    type: clip.type, // stored field; text overlays and images rely on this
    start: clip.startTime,
    end: clip.startTime + clip.duration,
    duration: clip.duration,
    trimStart: clip.trimStart,
    trimEnd: clip.trimEnd,
    trimIn: clip.trimStart,
    trimOut: clip.duration,
    speed: clip.speed,
    playbackRate: clip.speed,
    volume: clip.volume,
    muted: typeof clip.muted === 'boolean' ? clip.muted : false,
    reversed: Boolean(clip.reversed),
    opacity: clip.opacity,
    flipH: clip.flipH,
    flipV: clip.flipV,
    keyframes: clip.keyframes || [],
    linkedClipIds: clip.linkedClipIds,
    colorCorrection: clip.colorCorrection,
    letterbox: clip.letterbox,
    effects: clip.effects,
  };
}

/**
 * Build a preview descriptor for the selected clip, in the shape that
 * `renderPreviewAsset` expects:
 *   { type, src, name, poster, fit, heading, body }
 *
 * Reads from the new Timeline model and resolves the asset via
 * `findAssetById` against the legacy state.
 *
 * @param {Object} timeline - A new-model Timeline
 * @param {string} selectedClipId
 * @param {Object} state - Legacy state (for asset lookup)
 * @returns {Object|null}
 */
export function getPreviewClipFromTimeline(timeline, selectedClipId, state) {
  if (!timeline || !selectedClipId) return null;
  const clip = timeline.clips.find((c) => c.id === selectedClipId);
  if (!clip) return null;

  const asset = findAssetById(state, clip.assetId);

  // Type precedence: stored clip.type > original legacy clip type >
  // asset type > track kind. Text overlays and images must use the stored
  // type because they cannot be derived from track/asset alone.
  const original = findOriginalClip(state, selectedClipId);
  const type = (clip.type)
    || (original && original.type)
    || (asset && asset.type)
    || (lookupTrackKind(timeline, clip.trackId) === 'audio' ? 'audio' : 'video');

  const name = clip.name
    || (asset && asset.name)
    || (original && (original.name || original.heading))
    || '';

  const src = (original && original.src)
    || (asset && (asset.url || asset.path))
    || undefined;

  return {
    id: clip.id,
    type,
    src,
    name,
    poster: (original && original.poster) || (asset && asset.thumbnail) || undefined,
    fit: (original && original.fit) || undefined,
    heading: (original && original.heading) || name,
    body: (original && original.body) || undefined,
  };
}

/**
 * Find the original (un-transformed) legacy clip in state by id.
 * Used by getPreviewClipFromTimeline to recover fields the bridge
 * doesn't model directly (src, poster, fit, heading, body).
 *
 * @param {Object} state
 * @param {string} clipId
 * @returns {Object|null}
 */
function findOriginalClip(state, clipId) {
  if (!state) return null;
  const tracks = state.tracks || (state.project && state.project.tracks) || [];
  for (const track of tracks) {
    const arr = trackClips(track);
    const found = arr.find((c) => c && c.id === clipId);
    if (found) return found;
  }
  return null;
}

/**
 * Look up a track's kind in the new Timeline model.
 *
 * @param {Object} timeline
 * @param {string} trackId
 * @returns {'video' | 'audio' | null}
 */
function lookupTrackKind(timeline, trackId) {
  const t = timeline.tracks.find((tr) => tr.id === trackId);
  return t ? t.kind : null;
}

/**
 * Sync the new-model `timeline` field on state from `state.tracks`.
 * Returns a new state-like object (does not mutate the input).
 *
 * Also writes the result into `state.timelines[state.activeTimelineId]`
 * so the active-timeline map stays in sync with the legacy store.
 *
 * Convenience wrapper for editor code that wants to keep both
 * representations in step without manually calling legacyToTimeline.
 *
 * @param {Object} state
 * @returns {Object} The new Timeline (also assignable to state.timeline)
 */
export function syncTimelineFromState(state) {
  const timeline = legacyToTimeline(state);
  if (state.timelines && state.activeTimelineId) {
    const existing = state.timelines[state.activeTimelineId];
    timeline.id = state.activeTimelineId;
    if (existing) {
      timeline.name = existing.name;
    }
    state.timelines[state.activeTimelineId] = timeline;
  }
  return timeline;
}

/**
 * Return the active timeline from state.timelines, falling back to a
 * freshly synthesized timeline from state.tracks if the map is absent
 * or the active id is missing.
 *
 * @param {Object} state
 * @returns {Object} A new-model Timeline
 */
export function getActiveTimelineFromState(state) {
  if (state.timelines && state.activeTimelineId && state.timelines[state.activeTimelineId]) {
    return state.timelines[state.activeTimelineId];
  }
  return legacyToTimeline(state);
}
