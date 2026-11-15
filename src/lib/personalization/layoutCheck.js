// src/lib/personalization/layoutCheck.js
//
// The Personalization window's layout-quality engine (overlaps, off-frame,
// missing images, ...) run on the overlays the timeline shares with it (see
// layerOverlayBridge). Free: no AI, no network, no frame sampling, so it can
// only report what it can verify from geometry and the contact's content (the
// `notes` say what it did not check). Pure: no DOM.
import { createDefaultPreviewSettings } from '../../features/personalization/shared/personalization/preview/presets';
import { buildPlacementInput } from '../../features/personalization/shared/personalization/preview/placement/buildInput';
import { evaluateLayoutQuality } from '../../features/personalization/shared/personalization/preview/placement/quality';
import { recommendPlacement } from '../../features/personalization/shared/personalization/preview/placement/engine';

export { brandFromProfile } from './brandFromProfile.js';
import { brandFromProfile } from './brandFromProfile.js';

function inputFor({ layers, settings = {}, profile }) {
  const base = createDefaultPreviewSettings({
    layers,
    fps: settings.fps,
    durationInFrames: settings.durationInFrames,
    width: settings.width,
    height: settings.height,
    ...(settings.aspectRatio ? { aspectRatio: settings.aspectRatio } : {}),
    // The timeline has no end card of its own from the Personalize window.
    showEndCard: false,
  });
  return buildPlacementInput({ settings: base, brand: brandFromProfile(profile) });
}

/**
 * Check the layers as `profile` would see them.
 * @returns {{ status: string, issues: object[], blocksExport: boolean, notes: string[] }}
 */
export function checkTimelineLayout({ layers, settings, profile } = {}) {
  const list = Array.isArray(layers) ? layers : [];
  if (!list.length) return { status: 'ready', issues: [], blocksExport: false, notes: ['No overlays from the Personalize window to check.'] };
  const report = evaluateLayoutQuality(inputFor({ layers: list, settings, profile }));
  return {
    status: report.status,
    issues: report.issues.map(({ code, severity, layerId, tStart, tEnd, message, fixable }) => ({ code, severity, layerId, tStart, tEnd, message, fixable })),
    blocksExport: report.blocksExport,
    notes: [...report.notes, 'Checked from the overlays\' geometry and this contact\'s content; the video\'s own frames were not analysed.'],
  };
}

/**
 * The layers moved to the engine's recommended placement (never locked or
 * hand-placed ones). `layerId` limits it to one layer.
 * @returns {{ layers: object[], moved: number }}
 */
export function applyRecommendedPlacement({ layers, settings, profile, layerId } = {}) {
  const list = Array.isArray(layers) ? layers : [];
  if (!list.length) return { layers: list, moved: 0 };
  const result = recommendPlacement(inputFor({ layers: list, settings, profile }));
  const items = new Map(result.proposals.filter((p) => p.moved && (!layerId || p.layerId === layerId)).map((p) => [p.layerId, p]));
  if (!items.size) return { layers: list, moved: 0 };
  return {
    layers: list.map((l) => (items.has(l.id) ? { ...l, x: items.get(l.id).x, y: items.get(l.id).y, scale: items.get(l.id).scale } : l)),
    moved: items.size,
  };
}

// ──────────────────────────────────────────────────────────────────────────
// Every overlay on the timeline (not only the ones made in the Personalize
// window). Exact rectangles from each overlay's own geometry, so a wide logo
// is not mistaken for a square. Frames, when measured, add a readability check.
import { worstContrast, samplesFor } from '../../features/personalization/shared/personalization/preview/placement/engine';
import { resolveOverlayText } from '../editor/addons/overlayRender.js';
import { imageTokenOf } from './timelineAssets.js';
import { BRIDGE_SOURCE } from './layerOverlayBridge.js';

const TEXT_TYPES = new Set(['overlay-text']);
const IMAGE_TYPES = new Set(['overlay-personalized-image', 'overlay-image', 'overlay-sticker']);
/** A Personalize-window design: checked for leaving the frame, but not for overlapping (designs sit over things on purpose). */
const DESIGN_TYPES = new Set(['overlay-design']);
/** Full-frame by design (backgrounds, transitions): never "measured" or counted as collisions. */
const BACKDROP_TYPES = new Set(['overlay-background', 'overlay-transition', 'overlay-video-transition']);
const FRAME_W = 1920;
const FRAME_H = 1080;
const MIN_CONTRAST = 3;
const MAX_ISSUES = 20;

const clipsOf = (state) => (Array.isArray(state?.tracks) ? state.tracks : []).flatMap((t) => t?.items || t?.clips || []);
const rectArea = (r) => Math.max(0, r.width) * Math.max(0, r.height);
const labelOf = (o) => o.name || (o.kind === 'text' ? 'Text' : o.kind === 'design' ? 'Design' : 'Image');

/**
 * The text and image overlays the check can measure.
 * @returns {{ overlays: object[], notMeasured: number }}
 */
export function overlaysFromTimeline(state, { profile = null } = {}) {
  const T = Number(state?.timelineSeconds) || 60;
  const overlays = [];
  let notMeasured = 0;
  for (const clip of clipsOf(state)) {
    const type = String(clip?.type || '');
    const isText = TEXT_TYPES.has(type);
    const isImage = IMAGE_TYPES.has(type);
    const isDesign = DESIGN_TYPES.has(type);
    if (!isText && !isImage && !isDesign) {
      if ((type.startsWith('overlay-') && !BACKDROP_TYPES.has(type)) || type === 'remotion-code') notMeasured += 1;
      continue;
    }
    const a = clip.addon || {};
    const g = a.geometry;
    if (!g || ![g.left, g.top, g.width, g.height].every((n) => Number.isFinite(Number(n)))) continue;
    const startSec = Number.isFinite(Number(clip.start)) ? Number(clip.start) : 0;
    const endSec = Number.isFinite(Number(clip.end)) ? Number(clip.end) : T;
    const token = isImage ? imageTokenOf(a.src) : null;
    overlays.push({
      id: `clip:${clip.id}`,
      clipId: String(clip.id),
      name: String(clip.name || '').trim(),
      type,
      kind: isText ? 'text' : isDesign ? 'design' : 'image',
      startSec,
      endSec,
      rect: { left: Number(g.left), top: Number(g.top), width: Number(g.width), height: Number(g.height) },
      text: isText ? resolveOverlayText(String(a.text ?? ''), profile) : '',
      color: typeof a.fontColor === 'string' ? a.fontColor : '#FFFFFF',
      hasBackground: Boolean(a.background),
      token,
      // Made in the Personalize window: the placement engine may move it.
      bridged: clip.bridge?.source === BRIDGE_SOURCE,
    });
  }
  return { overlays, notMeasured };
}

const overlapSec = (a, b) => Math.min(a.endSec, b.endSec) - Math.max(a.startSec, b.startSec);
const intersection = (a, b) => ({
  width: Math.min(a.left + a.width, b.left + b.width) - Math.max(a.left, b.left),
  height: Math.min(a.top + a.height, b.top + b.height) - Math.max(a.top, b.top),
});

/** Overlays outside the frame, and overlays on top of each other at the same time. */
export function checkOverlayGeometry(overlays) {
  const issues = [];
  for (const o of overlays) {
    const r = o.rect;
    if (r.left < -0.5 || r.top < -0.5 || r.left + r.width > 100.5 || r.top + r.height > 100.5) {
      issues.push({ code: 'off-frame', severity: 'adjust', layerId: o.id, tStart: o.startSec, tEnd: o.endSec, fixable: o.bridged, message: `${labelOf(o)} reaches outside the video frame.` });
    }
  }
  // A near-full-frame overlay is a backdrop (e.g. an end-card image under its text): not a collision.
  const foreground = overlays.filter((o) => o.kind !== 'design' && rectArea(o.rect) < 80 * 80);
  for (let i = 0; i < foreground.length; i += 1) {
    for (let j = i + 1; j < foreground.length; j += 1) {
      const a = foreground[i];
      const b = foreground[j];
      if (overlapSec(a, b) < 0.1) continue;
      const inter = intersection(a.rect, b.rect);
      if (inter.width <= 0 || inter.height <= 0) continue;
      const share = (inter.width * inter.height) / Math.min(rectArea(a.rect), rectArea(b.rect));
      if (share > 0.3) {
        issues.push({
          code: 'overlay-collision', severity: 'adjust', layerId: a.id, tStart: Math.max(a.startSec, b.startSec), tEnd: Math.min(a.endSec, b.endSec),
          fixable: a.bridged || b.bridged, message: `${labelOf(a)} overlaps ${labelOf(b)}.`,
        });
      }
    }
  }
  return issues.slice(0, MAX_ISSUES);
}

/**
 * Readability of each text overlay (without its own background) against the
 * measured frames. `samples` carry TIMELINE seconds in `t`.
 */
export function checkTextContrast(overlays, samples) {
  const issues = [];
  for (const o of overlays) {
    if (o.kind !== 'text' || o.hasBackground || !String(o.text).trim()) continue;
    const mine = samplesFor(samples, [o.startSec, o.endSec]);
    const box = { left: (o.rect.left / 100) * FRAME_W, top: (o.rect.top / 100) * FRAME_H, width: (o.rect.width / 100) * FRAME_W, height: (o.rect.height / 100) * FRAME_H };
    const wc = worstContrast(box, mine, FRAME_W, FRAME_H, o.color);
    if (wc && wc.ratio < MIN_CONTRAST) {
      issues.push({ code: 'low-contrast', severity: 'adjust', layerId: o.id, tStart: wc.t, tEnd: o.endSec, fixable: false, message: `${labelOf(o)} is hard to read at ${wc.t.toFixed(1)} s (contrast ${wc.ratio.toFixed(1)}:1).` });
    }
  }
  return issues;
}

/**
 * The full report for the timeline.
 * @param {{ overlays: object[], notMeasured?: number, samples?: object[], frames?: 'not-measured'|'unavailable'|'measured' }} args
 */
export function checkOverlays({ overlays = [], notMeasured = 0, samples = [], frames = 'not-measured' } = {}) {
  const issues = [...checkOverlayGeometry(overlays)];
  const hasText = overlays.some((o) => o.kind === 'text' && !o.hasBackground && String(o.text).trim());
  const notes = [];
  if (frames === 'measured' && samples.length) {
    issues.push(...checkTextContrast(overlays, samples));
    notes.push('Text readability was measured on the video\'s frames.');
  } else if (hasText) {
    issues.push({
      code: 'contrast-unverified', severity: 'review', fixable: false,
      message: frames === 'unavailable'
        ? 'Text readability could not be measured: the video could not be read in this browser. Check it in the preview.'
        : 'Text readability has not been measured yet. Use "Measure readability" to check it against the video.',
    });
  }
  if (notMeasured) notes.push(`${notMeasured} other overlay${notMeasured === 1 ? '' : 's'} (lower thirds, animations) ${notMeasured === 1 ? 'is' : 'are'} not measured.`);
  notes.push('Not checked: whether text covers the subject of the video.');
  const status = issues.some((i) => i.severity !== 'review') ? 'needs-adjustment' : issues.length ? 'review-required' : 'ready';
  return { status, issues: issues.slice(0, MAX_ISSUES), blocksExport: false, notes };
}

// ── Measuring frames ──────────────────────────────────────────────────────

/** Where to look in each base video clip: source times spread across the part the timeline plays. */
export function videoSampleRequests(state, { maxClips = 6, perClip = 7 } = {}) {
  const T = Number(state?.timelineSeconds) || 60;
  const out = [];
  for (const track of Array.isArray(state?.tracks) ? state.tracks : []) {
    if (String(track?.type || '').toLowerCase() !== 'video') continue;
    for (const clip of track.items || track.clips || []) {
      if (clip?.type !== 'video' || !clip.src) continue;
      const start = Number.isFinite(Number(clip.start)) ? Number(clip.start) : 0;
      const end = Math.min(T, Number.isFinite(Number(clip.end)) ? Number(clip.end) : T);
      const length = end - start;
      if (!(length > 0)) continue;
      const trimIn = Number.isFinite(Number(clip.trimIn)) ? Number(clip.trimIn) : 0;
      const times = Array.from({ length: perClip }, (_, i) => Math.round((trimIn + (length * i) / (perClip - 1 || 1) - (i === perClip - 1 ? 0.1 : 0)) * 1000) / 1000).map((t) => Math.max(trimIn, t));
      out.push({ clipId: String(clip.id), src: String(clip.src), start, end, trimIn, times });
    }
  }
  return out.slice(0, maxClips);
}

/** Re-label a clip's samples from source time to timeline time. */
export function samplesToTimeline(samples, req) {
  return (samples || [])
    .map((s) => ({ ...s, t: req.start + (s.t - req.trimIn) }))
    .filter((s) => s.t >= req.start - 1e-6 && s.t <= req.end + 1e-6);
}

/**
 * Measure the base video clips. `sampler(url, { times, composition })` defaults
 * to the studio's canvas sampler. Resolves `{ samples, failed }`; a clip that
 * cannot be read (CORS, codec, timeout) counts as failed, never guessed.
 */
export async function measureTimelineFrames(state, { sampler, signal } = {}) {
  const sample = sampler || (await import('../../features/personalization/shared/personalization/preview/placement/frameSampler')).sampleFrames;
  const requests = videoSampleRequests(state);
  const samples = [];
  let failed = 0;
  for (const req of requests) {
    if (signal?.aborted) break;
    const got = await sample(req.src, { times: req.times, composition: { width: FRAME_W, height: FRAME_H }, refine: false });
    if (got?.samples?.length) samples.push(...samplesToTimeline(got.samples, req));
    else failed += 1;
  }
  samples.sort((a, b) => a.t - b.t);
  return { samples, failed, clips: requests.length };
}
