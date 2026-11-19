/**
 * Form / button markers for the retention curve (pure functions, no DOM).
 *
 * The published video's `project` JSON carries the overlays the viewer sees: timed items on the tracks
 * (`lead-form`, `click-to-call` and any overlay with a link or phone number) and the project-level List Builder wall
 * (`project.listBuilder.enabled`, shown before playback starts). Times are seconds in the project; markers are in ms.
 */
import { clipTimeRange } from '../../addons/registry.js';
import { projectDuration } from '../../publish/sections.js';

const MAX_MARKERS = 12;
const clean = (s, n = 30) => String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, n);
const itemsOf = (t) => (Array.isArray(t?.items) ? t.items : Array.isArray(t?.clips) ? t.clips : []);
const hasLink = (c) => ['linkUrl', 'phoneNumber', 'ctaUrl'].some((k) => typeof c?.[k] === 'string' && c[k].trim());
const r1 = (v) => Math.round(v * 10) / 10;

/** @returns {{id:string, kind:'lead-form'|'list-builder'|'cta', label:string, startMs:number, endMs:number}[]} sorted by start. */
export function buildMarkers(project) {
  const dur = projectDuration(project);
  if (!dur) return [];
  const out = [];
  if (project.listBuilder && project.listBuilder.enabled) {
    out.push({ id: 'list-builder', kind: 'list-builder', label: 'List Builder wall', startMs: 0, endMs: 0 });
  }
  const tracks = Array.isArray(project.tracks) ? project.tracks : [];
  tracks.forEach((t, ti) => itemsOf(t).forEach((c, ci) => {
    if (!c || typeof c !== 'object') return;
    const kind = c.type === 'lead-form' ? 'lead-form' : c.type === 'click-to-call' || hasLink(c) ? 'cta' : null;
    if (!kind) return;
    let { start, end } = clipTimeRange(c, dur);
    if (kind === 'lead-form' && c.trigger === 'end') { start = dur; end = dur; } // "at the end of the video"
    if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || start > dur) return;
    end = Math.min(dur, Math.max(start, end));
    const text = clean(c.buttonText || c.ctaText);
    out.push({
      id: `${kind}:${c.id ?? `${ti}-${ci}`}`,
      kind,
      label: kind === 'lead-form' ? 'Lead form' : text ? `CTA: ${text}` : 'CTA button',
      startMs: Math.round(start * 1000),
      endMs: Math.round(end * 1000),
    });
  }));
  return out.sort((a, b) => a.startMs - b.startMs || a.id.localeCompare(b.id)).slice(0, MAX_MARKERS);
}

/** Retention % at a time, interpolated between the curve's points. null when there is no curve or no duration. */
export function retentionAtMs(points, durationMs, ms) {
  if (!Array.isArray(points) || !points.length || !(durationMs > 0)) return null;
  const sorted = [...points].sort((a, b) => a.positionPercent - b.positionPercent);
  const pos = Math.max(0, Math.min(100, (ms / durationMs) * 100));
  if (pos <= sorted[0].positionPercent) return sorted[0].retentionPercent;
  for (let i = 1; i < sorted.length; i += 1) {
    const a = sorted[i - 1]; const b = sorted[i];
    if (pos <= b.positionPercent) {
      const span = b.positionPercent - a.positionPercent;
      return span > 0 ? a.retentionPercent + ((b.retentionPercent - a.retentionPercent) * (pos - a.positionPercent)) / span : b.retentionPercent;
    }
  }
  return sorted[sorted.length - 1].retentionPercent;
}

/** Markers with the retention % at their start and the drop (percentage points) across their visible window (null when unknown). */
export function markerStats(markers, retention, durationMs) {
  return (markers || []).map((m) => {
    const at = retentionAtMs(retention, durationMs, m.startMs);
    const hasWindow = m.endMs > m.startMs;
    const after = hasWindow ? retentionAtMs(retention, durationMs, m.endMs) : null;
    return {
      ...m,
      retentionPercent: at == null ? null : r1(at),
      dropPoints: at == null || after == null ? null : r1(at - after),
    };
  });
}
