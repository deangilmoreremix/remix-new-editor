/**
 * Sections and CTA labels of a published project, derived from the timeline
 * the owner already built - no re-modelling required.
 *
 * Sections (seconds): the owner's interest map when one exists
 * (`project.interestMap = [{ id, title, start, end, interest? }]`), otherwise
 * the video track's clips in time order (named clips only count as sections
 * when there are at least two, so a single full-length clip is not a "section").
 */
import { clipTimeRange } from '../addons/registry.js';

const clean = (s, n = 60) => String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, n);
const clipsOf = (t) => (Array.isArray(t?.items) ? t.items : Array.isArray(t?.clips) ? t.clips : []);

export function projectDuration(project) {
  const d = Number(project?.timelineSeconds);
  return Number.isFinite(d) && d > 0 ? d : 0;
}

export function projectSections(project) {
  const dur = projectDuration(project);
  if (!dur) return [];
  if (Array.isArray(project.interestMap) && project.interestMap.length) {
    return project.interestMap
      .map((s, i) => ({ id: clean(s.id, 80) || `m${i}`, title: clean(s.title) || `Section ${i + 1}`, start: Number(s.start), end: Number(s.end), interest: s.interest || null }))
      .filter((s) => Number.isFinite(s.start) && Number.isFinite(s.end))
      .map((s) => ({ ...s, start: Math.max(0, s.start), end: Math.min(dur, s.end) }))
      .filter((s) => s.end > s.start); // clamp first: a map made for a longer cut must not yield an inverted range
  }
  const tracks = Array.isArray(project.tracks) ? project.tracks : [];
  const video = tracks.find((t) => t?.type === 'video');
  const clips = clipsOf(video)
    .map((c, i) => ({ c, i, ...clipTimeRange(c, dur) }))
    .filter((x) => x.end > x.start)
    .sort((a, b) => a.start - b.start);
  if (clips.length < 2) return [];
  return clips.map((x, n) => ({
    id: clean(x.c.id, 80) || `clip${x.i}`,
    title: clean(x.c.name || x.c.label || x.c.title) || `Scene ${n + 1}`,
    start: Math.max(0, x.start),
    end: Math.min(dur, x.end),
    interest: null,
  }));
}

/** clip id -> human label for CTAs, forms and call buttons. */
export function ctaLabels(project) {
  const out = {};
  for (const t of Array.isArray(project?.tracks) ? project.tracks : []) {
    for (const c of clipsOf(t)) {
      if (c?.id == null) continue;
      const o = c.addon && typeof c.addon === 'object' ? c.addon : {};
      const label = clean(c.buttonText || c.ctaText || c.heading || o.buttonText || o.text || c.name, 60);
      if (label) out[String(c.id)] = label;
    }
  }
  return out;
}

/** Pricing CTAs are recognised from the owner's own wording (never guessed from viewers). */
export const isPricingLabel = (label) => /\b(pric|cost|quote|estimate|rates?|fees?|\$)/i.test(String(label || ''));
