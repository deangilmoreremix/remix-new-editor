import {
  clipEffectiveDuration,
  clipEndTime,
  TRACK_COLORS,
  DEFAULT_VIDEO_COLOR,
  DEFAULT_AUDIO_COLOR,
} from '../../types/timeline.js';
import { generateId } from './renderActions.js';

/* Linked clip helpers */

/** Get all linked clip IDs for a clip (empty array if none). */
export function getLinkedIds(clip) {
  return clip?.linkedClipIds ?? [];
}

/** Check if a clip is linked to another clip. */
function isLinkedTo(clip, targetId) {
  return clip.linkedClipIds?.includes(targetId) ?? false;
}

/** Add a link between two clips (bidirectional). Returns updated clips array. */
function addLink(clips, clipIdA, clipIdB) {
  return clips.map((c) => {
    if (c.id === clipIdA && !isLinkedTo(c, clipIdB)) {
      return { ...c, linkedClipIds: [...(c.linkedClipIds ?? []), clipIdB] };
    }
    if (c.id === clipIdB && !isLinkedTo(c, clipIdA)) {
      return { ...c, linkedClipIds: [...(c.linkedClipIds ?? []), clipIdA] };
    }
    return c;
  });
}

/** Remove a link between two clips (bidirectional). Returns updated clips array. */
function removeLink(clips, clipIdA, clipIdB) {
  return clips.map((c) => {
    if (c.id === clipIdA) {
      const filtered = (c.linkedClipIds ?? []).filter((id) => id !== clipIdB);
      return { ...c, linkedClipIds: filtered.length ? filtered : undefined };
    }
    if (c.id === clipIdB) {
      const filtered = (c.linkedClipIds ?? []).filter((id) => id !== clipIdA);
      return { ...c, linkedClipIds: filtered.length ? filtered : undefined };
    }
    return c;
  });
}

/* Duration */

export function calculateTimelineDuration(timeline) {
  let max = 0;
  for (const clip of timeline.clips) {
    const end = clipEndTime(clip);
    if (end > max) max = end;
  }
  return max;
}

function withDuration(timeline) {
  return { ...timeline, duration: calculateTimelineDuration(timeline) };
}

/* Snapping */

export function snapToHalfSecond(time) {
  return Math.round(time * 2) / 2;
}

/* Clip CRUD */

export function addClipToTrack(
  timeline,
  trackId,
  asset,
  startTime,
) {
  const track = timeline.tracks.find((t) => t.id === trackId);
  const isVideoOnVideoTrack = asset.type === 'video' && track?.kind === 'video';

  const videoClipId = generateId();
  const audioClipId = generateId();

  const clip = {
    id: videoClipId,
    assetId: asset.id,
    trackId,
    name: asset.name,
    startTime: Math.max(0, startTime),
    duration: asset.duration ?? 5,
    trimStart: 0,
    trimEnd: 0,
    speed: 1,
    opacity: 1,
    volume: 1,
    flipH: false,
    flipV: false,
    keyframes: [],
    ...(isVideoOnVideoTrack ? { linkedClipIds: [audioClipId] } : {}),
  };

  if (!isVideoOnVideoTrack) {
    return withDuration({ ...timeline, clips: [...timeline.clips, clip] });
  }

  // Find first audio track or create one
  let tl = timeline;
  let audioTrack = tl.tracks.find((t) => t.kind === 'audio');
  if (!audioTrack) {
    tl = addTrack(tl, 'audio');
    audioTrack = tl.tracks.find((t) => t.kind === 'audio');
  }

  const audioClip = {
    id: audioClipId,
    assetId: asset.id,
    trackId: audioTrack.id,
    name: `${asset.name} (audio)`,
    startTime: Math.max(0, startTime),
    duration: asset.duration ?? 5,
    trimStart: 0,
    trimEnd: 0,
    speed: 1,
    opacity: 1,
    volume: 1,
    flipH: false,
    flipV: false,
    keyframes: [],
    linkedClipIds: [videoClipId],
  };

  return withDuration({ ...tl, clips: [...tl.clips, clip, audioClip] });
}

export function removeClip(timeline, clipId) {
  const clip = timeline.clips.find((c) => c.id === clipId);
  const linkedIds = new Set(getLinkedIds(clip));
  linkedIds.add(clipId);
  return withDuration({
    ...timeline,
    clips: timeline.clips
      .filter((c) => !linkedIds.has(c.id))
      // Clean up dangling references in other clips that pointed to removed clips
      .map((c) => {
        if (!c.linkedClipIds) return c;
        const filtered = c.linkedClipIds.filter((id) => !linkedIds.has(id));
        return { ...c, linkedClipIds: filtered.length ? filtered : undefined };
      }),
  });
}

export function moveClip(
  timeline,
  clipId,
  newTrackId,
  newStartTime,
) {
  const clip = timeline.clips.find((c) => c.id === clipId);
  const timeDelta = clip ? newStartTime - clip.startTime : 0;
  const linkedIds = new Set(getLinkedIds(clip));

  return withDuration({
    ...timeline,
    clips: timeline.clips.map((c) => {
      if (c.id === clipId) {
        return { ...c, trackId: newTrackId, startTime: Math.max(0, newStartTime) };
      }
      // Linked clips only move horizontally (time delta) — they stay on their own track
      if (linkedIds.has(c.id)) {
        return {
          ...c,
          startTime: Math.max(0, c.startTime + timeDelta),
        };
      }
      return c;
    }),
  });
}

export function trimClip(
  timeline,
  clipId,
  trimStart,
  trimEnd,
  startTime,
) {
  const clip = timeline.clips.find((c) => c.id === clipId);
  const linkedIds = new Set(getLinkedIds(clip));
  return withDuration({
    ...timeline,
    clips: timeline.clips.map((c) => {
      if (c.id === clipId || linkedIds.has(c.id)) {
        return {
          ...c,
          trimStart: Math.max(0, trimStart),
          trimEnd: Math.max(0, trimEnd),
          ...(startTime !== undefined ? { startTime: Math.max(0, startTime) } : {}),
        };
      }
      return c;
    }),
  });
}

export function splitClip(
  timeline,
  clipId,
  splitTime,
) {
  const clip = timeline.clips.find((c) => c.id === clipId);
  if (!clip) return timeline;

  const effDur = clipEffectiveDuration(clip);
  const rel = splitTime - clip.startTime;
  if (rel <= 0 || rel >= effDur) return timeline;

  const sourceSplitOffset = rel * clip.speed;
  const firstId = clip.id;
  const secondId = generateId();

  // Build ID map: old linked clip ID → new second-half ID
  const linkedClips = getLinkedIds(clip)
    .map((id) => timeline.clips.find((c) => c.id === id))
    .filter((c) => !!c);
  const linkedIdMap = new Map(); // oldId → newSecondId
  for (const lc of linkedClips) {
    linkedIdMap.set(lc.id, generateId());
  }

  // Build new linkedClipIds for the first and second halves of the main clip
  const firstLinkedIds = linkedClips.map((lc) => lc.id);
  const secondLinkedIds = linkedClips.map((lc) => linkedIdMap.get(lc.id));

  const first = {
    ...clip,
    trimEnd: clip.trimEnd + (clip.duration - clip.trimStart - clip.trimEnd - sourceSplitOffset),
    keyframes: clip.keyframes.filter((kf) => kf.time < sourceSplitOffset),
    linkedClipIds: firstLinkedIds.length ? firstLinkedIds : undefined,
  };

  const second = {
    ...clip,
    id: secondId,
    startTime: splitTime,
    trimStart: clip.trimStart + sourceSplitOffset,
    keyframes: clip.keyframes
      .filter((kf) => kf.time >= sourceSplitOffset)
      .map((kf) => ({ ...kf, time: kf.time - sourceSplitOffset })),
    linkedClipIds: secondLinkedIds.length ? secondLinkedIds : undefined,
  };

  let result = {
    ...timeline,
    clips: timeline.clips.flatMap((c) => (c.id === clipId ? [first, second] : [c])),
  };

  // Split each linked clip too
  for (const linked of linkedClips) {
    const newSecondId = linkedIdMap.get(linked.id);
    const linkedSourceSplitOffset = rel * linked.speed;

    // Rebuild this linked clip's linkedClipIds: replace main clip's old ID with first/second
    const otherLinks = (linked.linkedClipIds ?? []).filter((id) => id !== clipId);
    const linkedFirstLinks = [firstId, ...otherLinks.map((id) => (linkedIdMap.has(id) ? id : id))];
    const linkedSecondLinks = [secondId, ...otherLinks.map((id) => linkedIdMap.get(id) ?? id)];

    const linkedFirst = {
      ...linked,
      trimEnd: linked.trimEnd + (linked.duration - linked.trimStart - linked.trimEnd - linkedSourceSplitOffset),
      keyframes: linked.keyframes.filter((kf) => kf.time < linkedSourceSplitOffset),
      linkedClipIds: linkedFirstLinks,
    };
    const linkedSecond = {
      ...linked,
      id: newSecondId,
      startTime: splitTime,
      trimStart: linked.trimStart + linkedSourceSplitOffset,
      keyframes: linked.keyframes
        .filter((kf) => kf.time >= linkedSourceSplitOffset)
        .map((kf) => ({ ...kf, time: kf.time - linkedSourceSplitOffset })),
      linkedClipIds: linkedSecondLinks,
    };
    result = {
      ...result,
      clips: result.clips.flatMap((c) => (c.id === linked.id ? [linkedFirst, linkedSecond] : [c])),
    };
  }

  return withDuration(result);
}

export function splitAllTracks(timeline, splitTime) {
  const lockedTrackIds = new Set(
    timeline.tracks.filter((t) => t.locked).map((t) => t.id),
  );
  let result = timeline;
  const clips = [...timeline.clips];
  const seen = new Set(timeline.clips.map((c) => c.id));

  for (const track of timeline.tracks) {
    if (lockedTrackIds.has(track.id)) continue;
    for (const item of (track.items || [])) {
      if (!seen.has(item.id)) {
        clips.push({
          id: item.id,
          assetId: item.assetId || item.id,
          trackId: track.id,
          name: item.name || item.text || 'Item',
          startTime: item.start || 0,
          duration: typeof item.end === 'number' && typeof item.start === 'number'
            ? item.end - item.start
            : (item.duration || 0),
          trimStart: item.trimIn || item.trimStart || 0,
          trimEnd: item.trimOut || item.trimEnd || 0,
          speed: item.playbackRate || item.speed || 1,
          opacity: item.opacity ?? 1,
          volume: item.volume ?? 1,
          flipH: Boolean(item.flipH),
          flipV: Boolean(item.flipV),
          keyframes: Array.isArray(item.keyframes) ? item.keyframes : [],
          linkedClipIds: Array.isArray(item.linkedClipIds) ? item.linkedClipIds : undefined,
        });
        seen.add(item.id);
      }
    }
  }

  if (clips.length !== timeline.clips.length) {
    result = { ...result, clips };
  }

  for (const clip of clips) {
    if (lockedTrackIds.has(clip.trackId)) continue;
    const effDur = clipEffectiveDuration(clip);
    const rel = splitTime - clip.startTime;
    if (rel > 0 && rel < effDur) {
      result = splitClip(result, clip.id, splitTime);
    }
  }
  return result;
}

export function duplicateClip(timeline, clipId, newStartTime) {
  const clip = timeline.clips.find((c) => c.id === clipId);
  if (!clip) return { timeline, newClipId: null };

  const copy = {
    ...clip,
    id: generateId(),
    startTime: Math.max(0, newStartTime),
  };
  return {
    timeline: withDuration({ ...timeline, clips: [...timeline.clips, copy] }),
    newClipId: copy.id,
  };
}

export function duplicateClips(timeline, clipIds, draggedClipId) {
  const uniqueIds = [...new Set(clipIds)];
  const clipsToCopy = uniqueIds
    .map((id) => timeline.clips.find((c) => c.id === id))
    .filter((clip) => !!clip);

  if (clipsToCopy.length === 0) {
    return { timeline, newClipIds: [], draggedCopyId: null };
  }

  const idMap = new Map();
  for (const clip of clipsToCopy) {
    idMap.set(clip.id, generateId());
  }

  const copies = clipsToCopy.map((clip) => ({
    ...clip,
    id: idMap.get(clip.id),
    linkedClipIds: clip.linkedClipIds
      ?.map((id) => idMap.get(id))
      .filter((id) => !!id) ?? undefined,
  })).map((clip) => ({
    ...clip,
    linkedClipIds: clip.linkedClipIds?.length ? clip.linkedClipIds : undefined,
  }));

  return {
    timeline: withDuration({ ...timeline, clips: [...timeline.clips, ...copies] }),
    newClipIds: copies.map((clip) => clip.id),
    draggedCopyId: draggedClipId ? idMap.get(draggedClipId) ?? null : null,
  };
}

/* Track CRUD */

function nextTrackName(tracks, kind) {
  const prefix = kind === 'video' ? 'V' : 'A';
  const existing = tracks
    .filter((t) => t.kind === kind)
    .map((t) => {
      const m = t.name.match(/^[VA](\d+)$/);
      return m ? parseInt(m[1], 10) : 0;
    });
  const next = Math.max(0, ...existing) + 1;
  return `${prefix}${next}`;
}

function nextTrackColor(_tracks, kind) {
  return kind === 'video' ? DEFAULT_VIDEO_COLOR : DEFAULT_AUDIO_COLOR;
}

export function addTrack(timeline, kind, color) {
  const track = {
    id: generateId(),
    name: nextTrackName(timeline.tracks, kind),
    kind,
    color: color ?? nextTrackColor(timeline.tracks, kind),
    muted: false,
    solo: false,
    locked: false,
    visible: true,
    volume: 1,
  };

  const videoTracks = timeline.tracks.filter((t) => t.kind === 'video');
  const audioTracks = timeline.tracks.filter((t) => t.kind === 'audio');

  const newTracks =
    kind === 'video'
      ? [...videoTracks, track, ...audioTracks]
      : [...videoTracks, ...audioTracks, track];

  return { ...timeline, tracks: newTracks };
}

export function removeTrack(timeline, trackId) {
  const track = timeline.tracks.find((t) => t.id === trackId);
  if (!track) return timeline;

  // Protect the last track of its kind from accidental removal when it is empty.
  // If the track has clips on it, allow removal even if it is the last of its kind.
  const sameKindCount = timeline.tracks.filter((t) => t.kind === track.kind).length;
  const trackHasClips = timeline.clips.some((c) => c.trackId === trackId);
  if (sameKindCount <= 1 && !trackHasClips) return timeline;

  return withDuration({
    ...timeline,
    tracks: timeline.tracks.filter((t) => t.id !== trackId),
    clips: timeline.clips.filter((c) => c.trackId !== trackId),
  });
}

export function updateTrack(
  timeline,
  trackId,
  updates,
) {
  return {
    ...timeline,
    tracks: timeline.tracks.map((t) =>
      t.id === trackId ? { ...t, ...updates } : t,
    ),
  };
}

/* Helpers */

export function clipsOnTrack(timeline, trackId) {
  return timeline.clips
    .filter((c) => c.trackId === trackId)
    .sort((a, b) => a.startTime - b.startTime);
}

export function clipAtTime(timeline, trackId, time) {
  return timeline.clips.find(
    (c) => c.trackId === trackId && c.startTime <= time && clipEndTime(c) > time,
  );
}

export function createDefaultTimeline(name) {
  return {
    id: generateId(),
    name,
    tracks: [
      { id: generateId(), name: 'V1', kind: 'video', color: DEFAULT_VIDEO_COLOR, muted: false, solo: false, locked: false, visible: true, volume: 1 },
      { id: generateId(), name: 'V2', kind: 'video', color: DEFAULT_VIDEO_COLOR, muted: false, solo: false, locked: false, visible: true, volume: 1 },
      { id: generateId(), name: 'A1', kind: 'audio', color: DEFAULT_AUDIO_COLOR, muted: false, solo: false, locked: false, visible: true, volume: 1 },
      { id: generateId(), name: 'A2', kind: 'audio', color: DEFAULT_AUDIO_COLOR, muted: false, solo: false, locked: false, visible: true, volume: 1 },
    ],
    clips: [],
    duration: 0,
    transitions: [],
    markers: [],
  };
}

/* ------------------------------------------------------------------
   Advanced Editing Operations
   ------------------------------------------------------------------ */

const MIN_CLIP_DURATION = 0.1;

export function rippleTrim(
  timeline,
  clipId,
  edge,
  delta,
) {
  const clip = timeline.clips.find((c) => c.id === clipId);
  if (!clip) return timeline;

  const effDur = clipEffectiveDuration(clip);
  let actualDelta = delta;

  if (edge === 'right') {
    const maxTrimInward = -(effDur - MIN_CLIP_DURATION);
    const maxExtendOutward = clip.trimEnd;
    actualDelta = Math.max(maxTrimInward, Math.min(maxExtendOutward, delta));
  } else {
    const maxTrimInward = effDur - MIN_CLIP_DURATION;
    const maxExtendOutward = -clip.trimStart;
    actualDelta = Math.max(maxExtendOutward, Math.min(maxTrimInward, delta));
  }

  if (actualDelta === 0) return timeline;

  const trackClips = clipsOnTrack(timeline, clip.trackId);
  const clipIndex = trackClips.findIndex((c) => c.id === clipId);

  const subsequentIds = new Set(
    trackClips.slice(clipIndex + 1).map((c) => c.id),
  );

  const rippleAmount = edge === 'right' ? actualDelta : -actualDelta;

  return withDuration({
    ...timeline,
    clips: timeline.clips.map((c) => {
      if (c.id === clipId) {
        if (edge === 'right') {
          return { ...c, trimEnd: Math.max(0, c.trimEnd - actualDelta) };
        } else {
          return {
            ...c,
            trimStart: Math.max(0, c.trimStart + actualDelta),
          };
        }
      }
      if (subsequentIds.has(c.id)) {
        return { ...c, startTime: Math.max(0, c.startTime + rippleAmount) };
      }
      return c;
    }),
  });
}

export function rollTrim(
  timeline,
  leftClipId,
  rightClipId,
  delta,
) {
  const left = timeline.clips.find((c) => c.id === leftClipId);
  const right = timeline.clips.find((c) => c.id === rightClipId);
  if (!left || !right) return timeline;

  const leftEff = clipEffectiveDuration(left);
  const rightEff = clipEffectiveDuration(right);

  const maxRight = Math.min(rightEff - MIN_CLIP_DURATION, left.trimEnd);
  const maxLeft = Math.min(leftEff - MIN_CLIP_DURATION, right.trimStart);
  const clamped = Math.max(-maxLeft, Math.min(maxRight, delta));

  if (clamped === 0) return timeline;

  return withDuration({
    ...timeline,
    clips: timeline.clips.map((c) => {
      if (c.id === leftClipId) {
        return { ...c, trimEnd: Math.max(0, c.trimEnd - clamped) };
      }
      if (c.id === rightClipId) {
        return {
          ...c,
          trimStart: Math.max(0, c.trimStart + clamped),
          startTime: Math.max(0, c.startTime + clamped),
        };
      }
      return c;
    }),
  });
}

export function slipClip(timeline, clipId, delta) {
  const clip = timeline.clips.find((c) => c.id === clipId);
  if (!clip) return timeline;

  const maxRight = clip.trimEnd;
  const maxLeft = clip.trimStart;
  const clamped = Math.max(-maxLeft, Math.min(maxRight, delta));

  if (clamped === 0) return timeline;

  return {
    ...timeline,
    clips: timeline.clips.map((c) =>
      c.id === clipId
        ? { ...c, trimStart: c.trimStart + clamped, trimEnd: c.trimEnd - clamped }
        : c,
    ),
  };
}

export function slideClip(timeline, clipId, delta) {
  const clip = timeline.clips.find((c) => c.id === clipId);
  if (!clip) return timeline;

  const trackClips = clipsOnTrack(timeline, clip.trackId);
  const idx = trackClips.findIndex((c) => c.id === clipId);

  const leftNeighbor = idx > 0 ? trackClips[idx - 1] : null;
  const rightNeighbor = idx < trackClips.length - 1 ? trackClips[idx + 1] : null;

  if (!leftNeighbor || !rightNeighbor) return timeline;

  const rightEff = clipEffectiveDuration(rightNeighbor);
  const leftEff = clipEffectiveDuration(leftNeighbor);
  // Slide right: left neighbor absorbs (trimEnd decreases), right neighbor gets trimmed more (trimStart increases)
  const maxRight = Math.min(leftNeighbor.trimEnd, rightEff - MIN_CLIP_DURATION);
  // Slide left: right neighbor absorbs (trimStart decreases), left neighbor gets trimmed more (trimEnd increases)
  const maxLeft = Math.min(rightNeighbor.trimStart, leftEff - MIN_CLIP_DURATION);
  const clamped = Math.max(-maxLeft, Math.min(maxRight, delta));

  if (clamped === 0) return timeline;

  return withDuration({
    ...timeline,
    clips: timeline.clips.map((c) => {
      if (c.id === clipId) {
        return { ...c, startTime: c.startTime + clamped };
      }
      if (leftNeighbor && c.id === leftNeighbor.id) {
        return { ...c, trimEnd: Math.max(0, c.trimEnd - clamped) };
      }
      if (rightNeighbor && c.id === rightNeighbor.id) {
        return {
          ...c,
          trimStart: Math.max(0, c.trimStart + clamped),
          startTime: Math.max(0, c.startTime + clamped),
        };
      }
      return c;
    }),
  });
}

export function trackSelectForward(timeline, clipId) {
  const clip = timeline.clips.find((c) => c.id === clipId);
  if (!clip) return new Set();

  const trackClips = clipsOnTrack(timeline, clip.trackId);
  const ids = new Set();
  for (const c of trackClips) {
    if (c.startTime >= clip.startTime) ids.add(c.id);
  }
  return ids;
}

/* ------------------------------------------------------------------
   Keyframe & Transition Operations
   ------------------------------------------------------------------ */

export function interpolateProperty(
  clip,
  property,
  clipTime,
) {
  const kfs = clip.keyframes
    .filter((k) => k.property === property)
    .sort((a, b) => a.time - b.time);

  if (kfs.length === 0) return clip[property];
  if (kfs.length === 1) return kfs[0].value;
  if (clipTime <= kfs[0].time) return kfs[0].value;
  if (clipTime >= kfs[kfs.length - 1].time) return kfs[kfs.length - 1].value;

  // Find surrounding keyframes
  for (let i = 0; i < kfs.length - 1; i++) {
    if (clipTime >= kfs[i].time && clipTime <= kfs[i + 1].time) {
      const t = (clipTime - kfs[i].time) / (kfs[i + 1].time - kfs[i].time);
      return kfs[i].value + t * (kfs[i + 1].value - kfs[i].value);
    }
  }
  return kfs[kfs.length - 1].value;
}

export function addKeyframe(timeline, clipId, keyframe) {
  return {
    ...timeline,
    clips: timeline.clips.map((c) =>
      c.id === clipId
        ? { ...c, keyframes: [...c.keyframes, keyframe].sort((a, b) => a.time - b.time) }
        : c,
    ),
  };
}

export function removeKeyframe(timeline, clipId, keyframeIndex) {
  return {
    ...timeline,
    clips: timeline.clips.map((c) =>
      c.id === clipId
        ? { ...c, keyframes: c.keyframes.filter((_, i) => i !== keyframeIndex) }
        : c,
    ),
  };
}

export function moveKeyframe(
  timeline,
  clipId,
  keyframeIndex,
  newTime,
) {
  return {
    ...timeline,
    clips: timeline.clips.map((c) => {
      if (c.id !== clipId) return c;
      const kfs = c.keyframes.map((kf, i) =>
        i === keyframeIndex ? { ...kf, time: Math.max(0, newTime) } : kf,
      );
      return { ...c, keyframes: kfs.sort((a, b) => a.time - b.time) };
    }),
  };
}

export function addTransition(timeline, transition) {
  if (transition.type === 'dissolve' && transition.clipBId) {
    const clipA = timeline.clips.find((c) => c.id === transition.clipAId);
    const clipB = timeline.clips.find((c) => c.id === transition.clipBId);
    if (!clipA || !clipB) return timeline;

    // Available handle: outgoing material from A (trimEnd), incoming material from B (trimStart)
    const available = Math.min(clipA.trimEnd, clipB.trimStart);
    if (available <= 0) return timeline;

    const clampedDuration = Math.min(transition.duration, available);
    // Shift clipB left by the transition duration so the clips overlap
    return withDuration({
      ...timeline,
      clips: timeline.clips.map((c) =>
        c.id === transition.clipBId
          ? { ...c, startTime: c.startTime - clampedDuration }
          : c,
      ),
      transitions: [...(timeline.transitions ?? []), { ...transition, duration: clampedDuration }],
    });
  }

  // Fade transitions have no handle requirement
  return {
    ...timeline,
    transitions: [...(timeline.transitions ?? []), transition],
  };
}

export function removeTransition(timeline, transitionId) {
  return {
    ...timeline,
    transitions: (timeline.transitions ?? []).filter((t) => t.id !== transitionId),
  };
}

export function updateTransition(
  timeline,
  transitionId,
  updates,
) {
  return {
    ...timeline,
    transitions: (timeline.transitions ?? []).map((t) =>
      t.id === transitionId ? { ...t, ...updates } : t,
    ),
  };
}

/* ------------------------------------------------------------------
   Link / Unlink Operations
   ------------------------------------------------------------------ */

/** Link two clips bidirectionally so they move/trim together. */
export function linkClips(timeline, clipIdA, clipIdB) {
  return { ...timeline, clips: addLink(timeline.clips, clipIdA, clipIdB) };
}

/** Unlink two clips so they become independent. */
export function unlinkClips(timeline, clipIdA, clipIdB) {
  return { ...timeline, clips: removeLink(timeline.clips, clipIdA, clipIdB) };
}

/** Unlink a clip from ALL its linked clips. */
export function unlinkAllFromClip(timeline, clipId) {
  const clip = timeline.clips.find((c) => c.id === clipId);
  if (!clip) return timeline;
  let clips = timeline.clips;
  for (const linkedId of getLinkedIds(clip)) {
    clips = removeLink(clips, clipId, linkedId);
  }
  return { ...timeline, clips };
}

/* ------------------------------------------------------------------
   Sync Operations
   ------------------------------------------------------------------ */

/**
 * @param {string} videoClipId
 * @param {string} audioClipId
 * @param {number} offsetSeconds
 * @param {'replace' | 'keep'} scratchMode
 */
export function syncClips(
  timeline,
  videoClipId,
  audioClipId,
  offsetSeconds,
  scratchMode,
) {
  const videoClip = timeline.clips.find((c) => c.id === videoClipId);
  if (!videoClip) return timeline;

  // Add bidirectional link between video and audio (preserving existing links)
  let clips = addLink(timeline.clips, videoClipId, audioClipId);

  // Position the audio clip at the sync offset
  clips = clips.map((c) => {
    if (c.id === audioClipId) {
      return { ...c, startTime: Math.max(0, videoClip.startTime + offsetSeconds) };
    }
    return c;
  });

  // Handle scratch audio — mute the TRACK so user can toggle it back
  let tracks = timeline.tracks;
  const existingLinkedIds = getLinkedIds(videoClip);
  if (existingLinkedIds.length > 0 && scratchMode === 'replace') {
    const audioClipObj = clips.find((c) => c.id === audioClipId);
    // Mute tracks of existing linked audio clips (not the new one)
    for (const linkedId of existingLinkedIds) {
      if (linkedId === audioClipId) continue; // Don't mute the clip we just synced
      const scratchClip = timeline.clips.find((c) => c.id === linkedId);
      if (scratchClip && audioClipObj && scratchClip.trackId !== audioClipObj.trackId) {
        tracks = tracks.map((t) =>
          t.id === scratchClip.trackId ? { ...t, muted: true } : t
        );
      }
    }
  }

  return withDuration({ ...timeline, clips, tracks });
}

export function updateClipProperties(
  timeline,
  clipId,
  updates,
) {
  const clip = timeline.clips.find((c) => c.id === clipId);
  const linkedIds = new Set(getLinkedIds(clip));
  // Only propagate speed to linked clips (not visual props like opacity/flip)
  const linkedUpdates = {};
  if (updates.speed !== undefined) linkedUpdates.speed = updates.speed;

  return withDuration({
    ...timeline,
    clips: timeline.clips.map((c) => {
      if (c.id === clipId) {
        const merged = { ...c, ...updates };
        merged.speed = Math.max(0.25, Math.min(4, merged.speed));
        merged.opacity = Math.max(0, Math.min(1, merged.opacity));
        merged.volume = Math.max(0, Math.min(4, merged.volume));
        return merged;
      }
      if (linkedIds.has(c.id) && Object.keys(linkedUpdates).length > 0) {
        const merged = { ...c, ...linkedUpdates };
        merged.speed = Math.max(0.25, Math.min(4, merged.speed));
        return merged;
      }
      return c;
    }),
  });
}

/* ------------------------------------------------------------------
   Our own helpers (not in CineGen)
   ------------------------------------------------------------------ */

/**
 * Set clip speed with clamping to 0.25–4. Linked clips are updated together.
 * @param {Object} timeline
 * @param {string} clipId
 * @param {number} speed
 * @returns {Object}
 */
export function setClipSpeed(timeline, clipId, speed) {
  return updateClipProperties(timeline, clipId, { speed });
}

/**
 * Compute whether a track should be audible during playback/render.
 * Solo is a derived read: it does not mutate other tracks' mute state.
 *
 * @param {Object} track - The track to evaluate
 * @param {Object[]} allTracks - All tracks in the timeline
 * @returns {boolean} true if the track should produce audio
 */
export function isTrackAudible(track, allTracks) {
  const anySoloed = allTracks.some((t) => t.solo);
  return !track.muted && (!anySoloed || track.solo);
}
