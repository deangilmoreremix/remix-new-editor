import { generateVideoFromFrames } from '../../ai/muapiService.js';

function getClipTimeRange(clip, timelineSeconds = 60) {
  if (clip.start !== undefined && clip.end !== undefined) {
    return { start: clip.start, end: clip.end };
  }
  if (clip.startTime !== undefined && clip.duration !== undefined) {
    return { start: clip.startTime, end: clip.startTime + clip.duration };
  }
  if (clip.left !== undefined && clip.width !== undefined) {
    const start = (clip.left / 100) * timelineSeconds;
    const end = ((clip.left + clip.width) / 100) * timelineSeconds;
    return { start, end };
  }
  return { start: 0, end: 0 };
}

export function findGapsOnTrack(track, timelineSeconds = 60) {
  if (!track || !Array.isArray(track.clips)) return [];

  const sorted = [...track.clips]
    .map(c => getClipTimeRange(c, timelineSeconds))
    .filter(c => typeof c.start === 'number' && typeof c.end === 'number' && c.end > c.start)
    .sort((a, b) => a.start - b.start);

  const gaps = [];
  for (let i = 0; i < sorted.length - 1; i++) {
    const before = sorted[i];
    const after = sorted[i + 1];
    if (after.start > before.end) {
      gaps.push({
        start: before.end,
        end: after.start,
        beforeClip: track.clips.find(c => {
          const range = getClipTimeRange(c, timelineSeconds);
          return Math.abs(range.start - before.start) < 0.01 && Math.abs(range.end - before.end) < 0.01;
        }) || null,
        afterClip: track.clips.find(c => {
          const range = getClipTimeRange(c, timelineSeconds);
          return Math.abs(range.start - after.start) < 0.01 && Math.abs(range.end - after.end) < 0.01;
        }) || null,
      });
    }
  }
  return gaps;
}

function getFrameUrl(clip) {
  return clip.thumbnail || clip.poster || clip.src || clip.source || clip.sourceUrl || null;
}

export async function fillGap(timelineState, trackId, gapStart, gapEnd, options = {}) {
  const tracks = timelineState.tracks || timelineState.project?.tracks || [];
  const track = tracks.find(t => t.id === trackId);
  if (!track) throw new Error(`Track ${trackId} not found`);

  const timelineSeconds = timelineState.timelineSeconds || 60;
  const gaps = findGapsOnTrack(track, timelineSeconds);
  const gap = gaps.find(g => Math.abs(g.start - gapStart) < 0.01 && Math.abs(g.end - gapEnd) < 0.01);
  if (!gap) throw new Error('Gap not found on track');

  const firstFrameUrl = gap.beforeClip ? getFrameUrl(gap.beforeClip) : null;
  const lastFrameUrl = gap.afterClip ? getFrameUrl(gap.afterClip) : null;
  if (!firstFrameUrl && !lastFrameUrl) throw new Error('Cannot determine frame URLs for bordering clips');

  const duration = gapEnd - gapStart;
  const prompt = options.prompt || `Generate footage to bridge a ${duration.toFixed(1)}s gap`;

  const result = await generateVideoFromFrames({
    firstFrameUrl: firstFrameUrl || lastFrameUrl,
    lastFrameUrl: lastFrameUrl || undefined,
    prompt,
    model: options.model || 'seedance-2.5-first-last-frame',
    duration,
  });

  const videoUrl = result.url || result.outputs?.[0] || result.raw?.url || result.raw?.outputs?.[0];
  if (!videoUrl) throw new Error('MuAPI did not return a video URL');

  const newClip = {
    id: `clip-ai-${Date.now()}`,
    type: 'video',
    source: videoUrl,
    start: gapStart,
    end: gapEnd,
    duration,
    name: options.name || 'AI Fill Gap',
    sourceStart: 0,
    sourceEnd: duration,
    trimIn: 0,
    trimOut: duration,
    volume: 1,
    playbackRate: 1,
    opacity: 1,
    effects: [],
    transform: { x: 0, y: 0, scale: 1, rotation: 0 },
    lane: 0,
  };

  const clipIndex = track.clips.findIndex(c => {
    const range = getClipTimeRange(c, timelineSeconds);
    return range.start >= gapEnd;
  });
  const updatedClips = [...track.clips];
  updatedClips.splice(clipIndex === -1 ? updatedClips.length : clipIndex, 0, newClip);

  const updatedTracks = tracks.map(t => t.id === trackId ? { ...t, clips: updatedClips, items: updatedClips } : t);
  timelineState.tracks = updatedTracks;
  if (timelineState.project?.tracks) {
    timelineState.project = { ...timelineState.project, tracks: updatedTracks };
  }

  return { success: true, clipId: newClip.id, clip: newClip };
}

export async function extendClip(timelineState, clipId, direction = 'after', options = {}) {
  const tracks = timelineState.tracks || timelineState.project?.tracks || [];
  const timelineSeconds = timelineState.timelineSeconds || 60;
  let targetClip = null;
  let targetTrack = null;

  for (const track of tracks) {
    const clip = track.clips.find(c => c.id === clipId);
    if (clip) {
      targetClip = clip;
      targetTrack = track;
      break;
    }
  }
  if (!targetClip || !targetTrack) throw new Error(`Clip ${clipId} not found`);

  const extendDuration = options.duration || 2;
  const targetRange = getClipTimeRange(targetClip, timelineSeconds);
  const clipStart = targetRange.start;
  const clipEnd = targetRange.end;

  const sortedClips = [...targetTrack.clips]
    .map(c => ({ ...c, _range: getClipTimeRange(c, timelineSeconds) }))
    .sort((a, b) => a._range.start - b._range.start);

  const clipIndex = sortedClips.findIndex(c => c.id === clipId);

  let firstFrameUrl = null;
  let lastFrameUrl = null;

  if (direction === 'after') {
    firstFrameUrl = getFrameUrl(targetClip);
    const nextClip = clipIndex < sortedClips.length - 1 ? sortedClips[clipIndex + 1] : null;
    lastFrameUrl = nextClip ? getFrameUrl(nextClip) : null;
  } else if (direction === 'before') {
    const prevClip = clipIndex > 0 ? sortedClips[clipIndex - 1] : null;
    firstFrameUrl = prevClip ? getFrameUrl(prevClip) : null;
    lastFrameUrl = getFrameUrl(targetClip);
  }

  const prompt = options.prompt || `Generate ${extendDuration}s of footage extending clip ${direction}`;
  const result = await generateVideoFromFrames({
    firstFrameUrl: firstFrameUrl || lastFrameUrl,
    lastFrameUrl: lastFrameUrl || undefined,
    prompt,
    model: options.model || 'seedance-2.5-first-last-frame',
    duration: extendDuration,
  });

  const videoUrl = result.url || result.outputs?.[0] || result.raw?.url || result.raw?.outputs?.[0];
  if (!videoUrl) throw new Error('MuAPI did not return a video URL');

  const newClip = {
    id: `clip-ai-extend-${Date.now()}`,
    type: 'video',
    source: videoUrl,
    sourceStart: 0,
    sourceEnd: extendDuration,
    trimIn: 0,
    trimOut: extendDuration,
    volume: 1,
    playbackRate: 1,
    opacity: 1,
    effects: [],
    transform: { x: 0, y: 0, scale: 1, rotation: 0 },
    lane: targetClip.lane ?? 0,
  };

  if (direction === 'after') {
    newClip.start = clipEnd;
    newClip.end = clipEnd + extendDuration;
    newClip.duration = extendDuration;
    newClip.name = options.name || `${targetClip.name || 'Clip'} (Extended After)`;
  } else {
    newClip.start = clipStart - extendDuration;
    newClip.end = clipStart;
    newClip.duration = extendDuration;
    newClip.name = options.name || `${targetClip.name || 'Clip'} (Extended Before)`;
  }

  const updatedClips = [...targetTrack.clips];
  const insertIndex = clipIndex + (direction === 'after' ? 1 : 0);
  updatedClips.splice(insertIndex === -1 ? updatedClips.length : insertIndex, 0, newClip);

  const updatedTracks = tracks.map(t => t.id === targetTrack.id ? { ...t, clips: updatedClips, items: updatedClips } : t);
  timelineState.tracks = updatedTracks;
  if (timelineState.project?.tracks) {
    timelineState.project = { ...timelineState.project, tracks: updatedTracks };
  }

  return { success: true, clipId: newClip.id, clip: newClip };
}
