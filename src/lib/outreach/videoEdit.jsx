// src/lib/outreach/videoEdit.jsx
//
// The Record step's editor (Sendspark "Record Videos" editing): trim the start and end, cut
// sections out of the middle, and add a clip before or after (an intro, a demo). The result is
// a list of segments (source + in/out seconds) rendered into one video in the browser with
// @remotion/web-renderer, the same way the Both recording is combined (composeBoth.jsx).
import React from 'react';
import { AbsoluteFill, Series } from 'remotion';
import { Video } from '@remotion/media';

export const FPS = 30;
const MIN = 0.2; // shortest piece kept, in seconds

const round = (n) => Math.round(n * 1000) / 1000;

/** Cuts merged and clipped to [0, duration], sorted. */
export function normalizeCuts(cuts = [], duration = Infinity) {
  const list = cuts
    .map(([a, b]) => [Math.max(0, Math.min(a, b)), Math.min(duration, Math.max(a, b))])
    .filter(([a, b]) => b - a > 0.01)
    .sort((x, y) => x[0] - y[0]);
  const out = [];
  for (const c of list) {
    const last = out[out.length - 1];
    if (last && c[0] <= last[1]) last[1] = Math.max(last[1], c[1]);
    else out.push([...c]);
  }
  return out;
}

/**
 * The pieces of the main video that are kept: [trimStart, trimEnd] minus the cuts.
 * @returns {Array<{ from, to }>} seconds in the source
 */
export function keptRanges({ duration, trimStart = 0, trimEnd = null, cuts = [] }) {
  const start = Math.max(0, Math.min(trimStart, duration));
  const end = Math.max(start, Math.min(trimEnd ?? duration, duration));
  const ranges = [];
  let at = start;
  for (const [a, b] of normalizeCuts(cuts, duration)) {
    if (b <= at || a >= end) continue;
    if (a > at) ranges.push({ from: round(at), to: round(Math.min(a, end)) });
    at = Math.max(at, b);
  }
  if (end > at) ranges.push({ from: round(at), to: round(end) });
  return ranges.filter((r) => r.to - r.from >= MIN);
}

/**
 * Everything played, in order: an optional clip before, the kept pieces of the main video, an
 * optional clip after. Clips: { src, duration }.
 */
export function buildSegments({ main, edits = {}, before = null, after = null }) {
  const segs = [];
  if (before?.src && before.duration > MIN) segs.push({ src: before.src, from: 0, to: round(before.duration) });
  for (const r of keptRanges({ duration: main.duration, ...edits })) segs.push({ src: main.src, ...r });
  if (after?.src && after.duration > MIN) segs.push({ src: after.src, from: 0, to: round(after.duration) });
  return segs;
}

export const segmentsDuration = (segs) => round(segs.reduce((n, s) => n + (s.to - s.from), 0));

/** Is this just the original video, untouched? (Then there's nothing to render.) */
export function isUnchanged(segs, main) {
  return segs.length === 1 && segs[0].src === main.src && segs[0].from === 0 && Math.abs(segs[0].to - main.duration) < 0.05;
}

/** Frames for each segment, for <Series>. */
export function segmentFrames(segs, fps = FPS) {
  return segs.map((s) => ({
    ...s,
    trimBefore: Math.round(s.from * fps),
    trimAfter: Math.round(s.to * fps),
    durationInFrames: Math.max(1, Math.round(s.to * fps) - Math.round(s.from * fps)),
  }));
}

export function EditedVideo({ segments }) {
  return (
    <AbsoluteFill style={{ backgroundColor: '#000' }}>
      <Series>
        {segments.map((s, i) => (
          <Series.Sequence key={i} durationInFrames={s.durationInFrames}>
            <Video src={s.src} trimBefore={s.trimBefore} trimAfter={s.trimAfter} objectFit="contain" style={{ width: '100%', height: '100%' }} />
          </Series.Sequence>
        ))}
      </Series>
    </AbsoluteFill>
  );
}

const REMOTION_LICENSE_KEY = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_REMOTION_LICENSE_KEY) || 'free-license';
const PROFILES = [
  { container: 'mp4', videoCodec: 'h264', audioCodec: 'aac', mimeType: 'video/mp4' },
  { container: 'webm', videoCodec: 'vp8', audioCodec: 'opus', mimeType: 'video/webm' },
];

/** Render the segments to one video (1920×1080). `renderer` is injectable for tests. */
export async function renderSegments(segs, { width = 1920, height = 1080, onProgress, signal, renderer } = {}) {
  if (!segs.length) throw new Error('Nothing is left to keep. Undo a cut or the trim.');
  const r = renderer || await import('@remotion/web-renderer');
  let profile = null;
  for (const p of PROFILES) {
    const check = await r.canRenderMediaOnWeb({ container: p.container, videoCodec: p.videoCodec, audioCodec: p.audioCodec, width, height, muted: false });
    if (check.canRender) { profile = p; break; }
  }
  if (!profile) throw new Error('This browser cannot edit video. Use Chrome or Edge.');
  const segments = segmentFrames(segs);
  const durationInFrames = segments.reduce((n, s) => n + s.durationInFrames, 0);
  const inputProps = { segments };
  const result = await r.renderMediaOnWeb({
    composition: { id: 'outreach-edit', component: EditedVideo, width, height, fps: FPS, durationInFrames, defaultProps: inputProps },
    inputProps,
    container: profile.container,
    videoCodec: profile.videoCodec,
    audioCodec: profile.audioCodec,
    muted: false,
    licenseKey: REMOTION_LICENSE_KEY,
    signal,
    onProgress: (p) => onProgress?.(Math.max(0, Math.min(1, p?.progress ?? 0))),
  });
  const blob = await result.getBlob();
  return { blob: blob.type ? blob : new Blob([blob], { type: profile.mimeType }), mimeType: profile.mimeType, duration: durationInFrames / FPS };
}
