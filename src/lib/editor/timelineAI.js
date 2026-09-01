/**
 * timelineAI.js — SmartVideo Timeline Studio AI operations
 *
 * Implements Fill Gap and Extend against the actual repository contracts:
 *   - Legacy clip model: start, end, sourceStart, sourceEnd, trimIn, trimOut, playbackRate
 *   - Asset storage: assetStore.saveAsset() + state.project.assets
 *   - Provider backend: cinegen.js / cinegenProviders.js via runCineGenTool
 *
 * Does NOT rely on Video Agent Studio reducers or assumed DOM selectors.
 */

import { assetStore } from '../assets/assetStore.js';
import { runCineGenTool, CINEGEN_TOOLS } from '../cinegenIntegration.js';

// ---------------------------------------------------------------------------
// Clip / track helpers (legacy model)
// ---------------------------------------------------------------------------

function getTrackById(tracks, trackId) {
  return tracks.find(t => t.id === trackId) || null;
}

function getClipById(tracks, clipId) {
  for (const track of tracks) {
    const items = track.items || track.clips || [];
    const clip = items.find(c => c.id === clipId);
    if (clip) return clip;
  }
  return null;
}

function getTrackForClip(tracks, clipId) {
  for (const track of tracks) {
    const items = track.items || track.clips || [];
    if (items.some(c => c.id === clipId)) return track;
  }
  return null;
}

function getSortedClipsOnTrack(track) {
  const items = (track.items || track.clips || []).slice();
  items.sort((a, b) => (a.start || 0) - (b.start || 0));
  return items;
}

export function clipEffectiveDuration(clip) {
  const timelineDur = Math.max(0.1, (clip.end || 0) - (clip.start || 0));
  const trimIn = clip.trimIn || 0;
  const trimOut = clip.trimOut || timelineDur;
  const visible = Math.max(0.1, trimOut - trimIn);
  const rate = clip.playbackRate || 1;
  return visible / rate;
}

export function clipTimelineDuration(clip) {
  return Math.max(0.1, (clip.end || 0) - (clip.start || 0));
}

// ---------------------------------------------------------------------------
// Gap detection
// ---------------------------------------------------------------------------

/**
 * Find the gap after a selected clip on its track.
 * The selected clip is treated as the left boundary.
 * Returns { track, leftClip, rightClip, gapStart, gapEnd, gapDuration } or error object.
 */
export function findClipGap(tracks, clipId) {
  const clip = getClipById(tracks, clipId);
  if (!clip) return null;

  const track = getTrackForClip(tracks, clipId);
  if (!track) return null;

  if (track.locked) {
    return { error: 'Track is locked', code: 'LOCKED_TRACK' };
  }

  const sorted = getSortedClipsOnTrack(track);
  const idx = sorted.findIndex(c => c.id === clipId);
  if (idx === -1) return null;

  const leftClip = sorted[idx];
  const rightClip = idx < sorted.length - 1 ? sorted[idx + 1] : null;

  if (!rightClip) {
    return { error: 'No clip after the selected clip to form a gap', code: 'NO_GAP' };
  }

  const gapStart = leftClip.end || 0;
  const gapEnd = rightClip.start || 0;
  const gapDuration = gapEnd - gapStart;

  if (gapDuration <= 0) {
    return { error: 'Clips overlap or touch; no gap to fill', code: 'NO_GAP' };
  }

  return {
    track,
    leftClip,
    rightClip,
    gapStart,
    gapEnd,
    gapDuration,
  };
}

// ---------------------------------------------------------------------------
// Boundary frame extraction
// ---------------------------------------------------------------------------

/**
 * Capture a single frame from a video URL at a given source time (seconds).
 * Returns a data URL (image/png) or null on failure.
 */
export async function captureFrameFromUrl(url, timeSeconds) {
  if (!url) return null;

  return new Promise((resolve) => {
    const video = document.createElement('video');
    video.crossOrigin = 'anonymous';
    video.muted = true;
    video.preload = 'auto';
    video.src = url;

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    let settled = false;
    const done = (value) => {
      if (settled) return;
      settled = true;
      video.pause();
      video.removeAttribute('src');
      video.load();
      resolve(value);
    };

    video.onloadedmetadata = () => {
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 360;
      const seekTime = Math.max(0, Math.min(timeSeconds, video.duration - 0.05));
      video.currentTime = seekTime;
    };

    video.onseeked = () => {
      try {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/png');
        done(dataUrl);
      } catch (e) {
        console.error('[timelineAI] frame capture failed:', e);
        done(null);
      }
    };

    video.onerror = () => done(null);
    video.ontimeout = () => done(null);

    setTimeout(() => done(null), 8000);
  });
}

/**
 * Resolve the best media URL for a clip from assetStore / project assets.
 */
export function resolveClipMediaUrl(state, clip) {
  if (!clip) return null;

  if (clip.src) return clip.src;

  const assetId = clip.assetId || clip.id;
  if (!assetId) return null;

  const pools = [
    state.project && state.project.assets,
    state.assets,
    state.mediaLibrary,
  ];

  for (const pool of pools) {
    if (Array.isArray(pool)) {
      const asset = pool.find(a => a && a.id === assetId);
      if (asset) {
        return asset.url || asset.path || asset.src || null;
      }
    }
  }

  return null;
}

/**
 * Get boundary frame URLs for Fill Gap.
 * leftBoundary = last visible frame of left clip
 * rightBoundary = first visible frame of right clip
 */
export async function getFillGapBoundaryFrames(state, leftClip, rightClip) {
  const leftUrl = resolveClipMediaUrl(state, leftClip);
  const rightUrl = resolveClipMediaUrl(state, rightClip);

  const leftFrameTime = leftClip.sourceEnd || clipTimelineDuration(leftClip);
  const rightFrameTime = rightClip.sourceStart || 0;

  const [leftFrame, rightFrame] = await Promise.all([
    captureFrameFromUrl(leftUrl, leftFrameTime),
    captureFrameFromUrl(rightUrl, rightFrameTime),
  ]);

  return {
    firstFrameUrl: leftFrame,
    lastFrameUrl: rightFrame,
    boundaryFrameUrl: leftFrame || rightFrame || null,
  };
}

/**
 * Get boundary frame URL for Extend.
 * direction='after' => last visible frame of source clip
 * direction='before' => first visible frame of source clip
 */
export async function getExtendBoundaryFrame(state, clip, direction = 'after') {
  const url = resolveClipMediaUrl(state, clip);
  if (!url) return null;

  const sourceTime = direction === 'after'
    ? (clip.sourceEnd || clipTimelineDuration(clip))
    : (clip.sourceStart || 0);

  return captureFrameFromUrl(url, sourceTime);
}

// ---------------------------------------------------------------------------
// Asset persistence
// ---------------------------------------------------------------------------

/**
 * Save a generated asset to both assetStore and state.project.assets.
 */
export async function persistGeneratedAsset(state, assetData) {
  const asset = {
    id: assetData.id || `asset-${Date.now()}`,
    type: assetData.type || 'video',
    name: assetData.name || 'Generated Clip',
    url: assetData.url || null,
    duration: assetData.duration || 0,
    thumbnail: assetData.thumbnail || null,
    source: assetData.source || 'cinegen',
    aiGenerated: true,
    aiOperation: assetData.aiOperation || null,
    provider: assetData.provider || null,
    model: assetData.model || null,
    requestId: assetData.requestId || null,
    createdAt: assetData.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  try {
    await assetStore.saveAsset(asset);
  } catch (e) {
    console.error('[timelineAI] assetStore save failed:', e);
  }

  if (state && state.project && Array.isArray(state.project.assets)) {
    const existing = state.project.assets.find(a => a.id === asset.id);
    if (!existing) {
      state.project.assets.push(asset);
    } else {
      Object.assign(existing, asset);
    }
  }

  return asset;
}

// ---------------------------------------------------------------------------
// Clip insertion helpers
// ---------------------------------------------------------------------------

/**
 * Insert a new clip into a track at an exact start time.
 */
export function insertClipAt(tracks, trackId, clipData) {
  const track = getTrackById(tracks, trackId);
  if (!track) return tracks;

  const items = (track.items || track.clips || []).slice();
  items.push(clipData);
  items.sort((a, b) => (a.start || 0) - (b.start || 0));

  const newTrack = { ...track, items };
  return tracks.map(t => t.id === trackId ? newTrack : t);
}

/**
 * Shift all clips on a track that start at or after `fromTime` by `delta`.
 */
export function shiftClipsAfter(tracks, trackId, fromTime, delta) {
  return tracks.map(track => {
    if (track.id !== trackId) return track;
    const items = (track.items || track.clips || []).map(clip => {
      if ((clip.start || 0) >= fromTime) {
        return { ...clip, start: clip.start + delta, end: clip.end + delta };
      }
      return clip;
    });
    return { ...track, items };
  });
}

// ---------------------------------------------------------------------------
// CineGen result application
// ---------------------------------------------------------------------------

/**
 * Apply a successful CineGen result to the timeline state.
 */
export async function applyCineGenResultToTimeline(result, state, showToast) {
  if (!result || !result.success) {
    const msg = result?.error || result?.message || 'Generation failed';
    const code = result?.code || 'UNKNOWN_ERROR';
    showToast?.(`${code}: ${msg}`, 'error');
    return { success: false, code, error: msg };
  }

  try {
    if (result.tool === 'fill_gap' || result.tool === 'gap_fill') {
      return await applyFillGapResult(result, state, showToast);
    }

    if (result.tool === 'extend' || result.tool === 'extend_clip') {
      return await applyExtendResult(result, state, showToast);
    }

    showToast?.(`Unsupported tool: ${result.tool}`, 'error');
    return { success: false, code: 'UNSUPPORTED_TOOL', error: `Tool ${result.tool} is not handled by timelineAI.` };
  } catch (e) {
    console.error('[timelineAI] applyCineGenResultToTimeline failed:', e);
    showToast?.(`Failed to apply result: ${e.message}`, 'error');
    return { success: false, code: 'APPLY_FAILED', error: e.message };
  }
}

async function applyFillGapResult(result, state, showToast) {
  const leftClipId = result.leftBoundaryClipId || result.clipId;
  const rightClipId = result.rightBoundaryClipId;
  if (!leftClipId || !rightClipId) {
    throw new Error('fill_gap result missing boundary clip ids');
  }

  const gap = findClipGap(state.project.tracks, leftClipId);
  if (!gap || gap.error) {
    throw new Error(gap?.error || 'Cannot locate gap for fill_gap');
  }

  const requestedDuration = result.duration || gap.gapDuration;
  const actualDuration = result.duration || requestedDuration;
  const fitDuration = Math.min(requestedDuration, gap.gapDuration);

  const asset = await persistGeneratedAsset(state, {
    type: 'video',
    name: `Fill Gap ${new Date().toLocaleTimeString()}`,
    url: result.url,
    duration: actualDuration,
    aiOperation: 'fill-gap',
    provider: result.provider || 'cinegen',
    model: result.model || null,
    requestId: result.requestId || null,
    leftBoundaryClipId: leftClipId,
    rightBoundaryClipId: rightClipId,
    requestedDuration,
    actualDuration,
  });

  const newClip = {
    id: `clip-${Date.now()}`,
    assetId: asset.id,
    type: 'video',
    start: gap.gapStart,
    end: gap.gapStart + fitDuration,
    sourceStart: 0,
    sourceEnd: fitDuration,
    lane: 0,
    trimIn: 0,
    trimOut: fitDuration,
    volume: 1,
    playbackRate: 1,
    effects: [],
    opacity: 1,
    transform: { x: 0, y: 0, scale: 1, rotation: 0 },
    name: `Fill Gap (${fitDuration.toFixed(2)}s)`,
    metadata: {
      aiGenerated: true,
      aiOperation: 'fill-gap',
      provider: asset.provider,
      model: asset.model,
      requestId: asset.requestId,
      leftBoundaryClipId: leftClipId,
      rightBoundaryClipId: rightClipId,
      requestedDuration,
      actualDuration,
    },
  };

  state.project.tracks = insertClipAt(state.project.tracks, gap.track.id, newClip);
  showToast?.(`Fill Gap inserted (${fitDuration.toFixed(2)}s)`, 'success');

  return { success: true, clip: newClip, asset, fitDuration };
}

async function applyExtendResult(result, state, showToast) {
  const clipId = result.clipId;
  if (!clipId) {
    throw new Error('extend result missing clipId');
  }

  const sourceClip = getClipById(state.project.tracks, clipId);
  if (!sourceClip) {
    throw new Error(`Source clip ${clipId} not found`);
  }

  const track = getTrackForClip(state.project.tracks, clipId);
  if (!track) {
    throw new Error(`Track for clip ${clipId} not found`);
  }

  if (track.locked) {
    throw new Error('Track is locked');
  }

  const direction = result.direction || 'after';
  const addedDuration = result.addedDuration || 5;
  const actualDuration = result.duration || addedDuration;

  const asset = await persistGeneratedAsset(state, {
    type: 'video',
    name: `Extend ${direction === 'after' ? 'After' : 'Before'} ${sourceClip.name || 'clip'}`,
    url: result.url,
    duration: actualDuration,
    aiOperation: 'extend',
    provider: result.provider || 'cinegen',
    model: result.model || null,
    requestId: result.requestId || null,
    sourceClipId: clipId,
    direction,
    addedDuration,
  });

  const newClip = {
    id: `clip-${Date.now()}`,
    assetId: asset.id,
    type: 'video',
    sourceStart: 0,
    sourceEnd: actualDuration,
    lane: sourceClip.lane || 0,
    trimIn: 0,
    trimOut: actualDuration,
    volume: 1,
    playbackRate: 1,
    effects: [],
    opacity: 1,
    transform: { x: 0, y: 0, scale: 1, rotation: 0 },
    name: `Extend ${direction} (${actualDuration.toFixed(2)}s)`,
    metadata: {
      aiGenerated: true,
      aiOperation: 'extend',
      provider: asset.provider,
      model: asset.model,
      requestId: asset.requestId,
      sourceClipId: clipId,
      direction,
      addedDuration,
    },
  };

  if (direction === 'after') {
    const insertStart = sourceClip.end || 0;
    newClip.start = insertStart;
    newClip.end = insertStart + actualDuration;

    const downstream = getSortedClipsOnTrack(track).filter(c => c.id !== clipId && (c.start || 0) >= insertStart);
    const collision = downstream.find(c => Math.abs(c.start - insertStart) < 0.05 || Math.abs(c.start - (insertStart + actualDuration)) < 0.05);

    if (collision) {
      const shift = actualDuration;
      state.project.tracks = shiftClipsAfter(state.project.tracks, track.id, collision.start, shift);
    }

    state.project.tracks = insertClipAt(state.project.tracks, track.id, newClip);
    showToast?.(`Extended after source (${actualDuration.toFixed(2)}s)`, 'success');
  } else {
    const insertEnd = sourceClip.start || 0;
    newClip.start = insertEnd - actualDuration;
    newClip.end = insertEnd;

    if (newClip.start < 0) {
      newClip.start = 0;
      newClip.end = actualDuration;
      const shift = actualDuration;
      state.project.tracks = shiftClipsAfter(state.project.tracks, track.id, sourceClip.end || 0, shift);
      state.project.tracks = shiftClipsAfter(state.project.tracks, track.id, sourceClip.start || 0, shift);
    }

    state.project.tracks = insertClipAt(state.project.tracks, track.id, newClip);
    showToast?.(`Extended before source (${actualDuration.toFixed(2)}s)`, 'success');
  }

  return { success: true, clip: newClip, asset, actualDuration };
}

// ---------------------------------------------------------------------------
// High-level modal helpers
// ---------------------------------------------------------------------------

export async function executeFillGap(state, { clipId, duration, style } = {}, showToast) {
  if (!clipId) {
    showToast?.('Select a clip before filling the gap', 'error');
    return { success: false, code: 'NO_CLIP', error: 'No clip selected' };
  }

  const gap = findClipGap(state.project.tracks, clipId);
  if (!gap) {
    showToast?.('Clip not found', 'error');
    return { success: false, code: 'CLIP_NOT_FOUND', error: 'Clip not found' };
  }

  if (gap.error) {
    showToast?.(gap.error, 'error');
    return { success: false, code: gap.code, error: gap.error };
  }

  const effectiveDuration = typeof duration === 'number' ? duration : gap.gapDuration;

  let boundaryFrames;
  try {
    boundaryFrames = await getFillGapBoundaryFrames(state, gap.leftClip, gap.rightClip);
  } catch (e) {
    showToast?.(`Failed to capture boundary frames: ${e.message}`, 'error');
    return { success: false, code: 'FRAME_CAPTURE_FAILED', error: e.message };
  }

  const providerResult = await runCineGenTool(CINEGEN_TOOLS.FILL_GAP, {
    clipId,
    beforeEnd: gap.leftClip.end,
    afterStart: gap.rightClip.start,
    duration: effectiveDuration,
    ...boundaryFrames,
    style: style || 'cinematic',
  });

  return applyCineGenResultToTimeline(providerResult, state, showToast);
}

export async function executeExtend(state, { clipId, duration, direction = 'after', style } = {}, showToast) {
  if (!clipId) {
    showToast?.('Select a clip to extend', 'error');
    return { success: false, code: 'NO_CLIP', error: 'No clip selected' };
  }

  const clip = getClipById(state.project.tracks, clipId);
  if (!clip) {
    showToast?.('Clip not found', 'error');
    return { success: false, code: 'CLIP_NOT_FOUND', error: 'Clip not found' };
  }

  const track = getTrackForClip(state.project.tracks, clipId);
  if (!track) {
    showToast?.('Track not found', 'error');
    return { success: false, code: 'TRACK_NOT_FOUND', error: 'Track not found' };
  }

  if (track.locked) {
    showToast?.('Track is locked', 'error');
    return { success: false, code: 'LOCKED_TRACK', error: 'Track is locked' };
  }

  const effectiveDuration = typeof duration === 'number' ? duration : 5;

  let boundaryFrame;
  try {
    boundaryFrame = await getExtendBoundaryFrame(state, clip, direction);
  } catch (e) {
    showToast?.(`Failed to capture boundary frame: ${e.message}`, 'error');
    return { success: false, code: 'FRAME_CAPTURE_FAILED', error: e.message };
  }

  const providerResult = await runCineGenTool(CINEGEN_TOOLS.EXTEND, {
    clipId,
    duration: effectiveDuration,
    direction,
    sourceFrameUrl: boundaryFrame,
    style: style || 'seamless',
  });

  return applyCineGenResultToTimeline(providerResult, state, showToast);
}
