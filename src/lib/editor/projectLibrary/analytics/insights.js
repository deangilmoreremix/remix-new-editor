/**
 * Rule-based, plain-language insights (pure). No model calls: each rule reads numbers that are already on the page
 * and states them. At most MAX_INSIGHTS sentences; a rule with too little data says nothing.
 */
import { MIN_SAMPLE } from './audienceData.js';

export const MAX_INSIGHTS = 4;
const MIN_DROP_POINTS = 5;
const SPREAD_POINTS = 10;
const clock = (ms) => { const s = Math.max(0, Math.round(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
const r0 = (v) => Math.round(v);

/** The steepest fall between two neighbouring retention points, with the marker nearest to it. null when there is no real drop. */
export function biggestDrop(retention, durationMs, markers = []) {
  if (!Array.isArray(retention) || retention.length < 3 || !(durationMs > 0)) return null;
  const pts = [...retention].sort((a, b) => a.positionPercent - b.positionPercent);
  let best = null;
  for (let i = 1; i < pts.length; i += 1) {
    const drop = pts[i - 1].retentionPercent - pts[i].retentionPercent;
    if (drop >= MIN_DROP_POINTS && (!best || drop > best.points)) {
      best = {
        points: Math.round(drop * 10) / 10,
        fromMs: Math.round((pts[i - 1].positionPercent / 100) * durationMs), toMs: Math.round((pts[i].positionPercent / 100) * durationMs),
        fromPercent: pts[i - 1].retentionPercent, toPercent: pts[i].retentionPercent,
      };
    }
  }
  if (!best) return null;
  const slack = durationMs * 0.05; // one retention step either side
  let near = null; let nearDist = Infinity;
  for (const m of markers) {
    const dist = m.startMs > best.toMs ? m.startMs - best.toMs : m.endMs < best.fromMs ? best.fromMs - m.endMs : 0;
    if (dist <= slack && dist < nearDist) { near = m; nearDist = dist; }
  }
  return { ...best, marker: near };
}

function dropInsight({ retention, durationMs, markers }) {
  const d = biggestDrop(retention, durationMs, markers);
  if (!d) return null;
  const base = `Biggest drop: ${d.points} points between ${clock(d.fromMs)} and ${clock(d.toMs)} (${r0(d.fromPercent)}% to ${r0(d.toPercent)}% still watching)`;
  return d.marker ? `${base}, right at the ${d.marker.label} (${clock(d.marker.startMs)}).` : `${base}.`;
}

function sourceInsight({ audience }) {
  const list = (audience?.referrers || []).filter((r) => r.sessions >= MIN_SAMPLE);
  if (list.length < 2) return null;
  const hasLeads = list.some((r) => (r.leadRate || 0) > 0);
  const key = hasLeads ? 'leadRate' : 'completionRate';
  const ranked = list.filter((r) => r[key] != null).sort((a, b) => b[key] - a[key]);
  if (ranked.length < 2) return null;
  const best = ranked[0]; const worst = ranked[ranked.length - 1];
  if (best[key] - worst[key] < (hasLeads ? 2 : SPREAD_POINTS)) return null;
  return hasLeads
    ? `${best.label} is your best source for leads (${best.leadRate}% of ${best.sessions} viewers submit) versus ${worst.leadRate}% from ${worst.label}.`
    : `${best.label} viewers finish the video ${best.completionRate}% of the time versus ${worst.completionRate}% from ${worst.label}.`;
}

function deviceInsight({ audience }) {
  const list = audience?.devices || [];
  const top = list[0];
  if (!top || audience.total < 10 || top.sharePercent < 60) return null;
  const other = list.slice(1).filter((d) => d.sessions >= MIN_SAMPLE && d.completionRate != null).sort((a, b) => b.completionRate - a.completionRate)[0];
  const lead = `${r0(top.sharePercent)}% of viewers are on ${top.label.toLowerCase()}`;
  if (other && top.sessions >= MIN_SAMPLE && top.completionRate != null && other.completionRate - top.completionRate >= SPREAD_POINTS) {
    return `${lead}, and they finish ${top.completionRate}% of the time versus ${other.completionRate}% on ${other.label.toLowerCase()}. Check text size and overlays on that screen.`;
  }
  return `${lead}. Design and preview for that screen first.`;
}

function versionInsight({ versions }) {
  const list = (versions || []).filter((v) => !v.lowSample && v.completionRate != null);
  if (list.length < 2) return null;
  const ranked = [...list].sort((a, b) => b.completionRate - a.completionRate);
  const best = ranked[0]; const worst = ranked[ranked.length - 1];
  if (best.completionRate - worst.completionRate < 3) return null;
  return `Version ${best.revision} completes best (${best.completionRate}% over ${best.plays} plays); version ${worst.revision} is lowest (${worst.completionRate}% over ${worst.plays} plays).`;
}

/**
 * @param {{retention?:object[], durationMs?:number, markers?:object[], audience?:object|null, versions?:object[]}} input
 * @returns {string[]} up to four sentences, most important first
 */
export function buildInsights(input = {}) {
  const ctx = { retention: input.retention || [], durationMs: input.durationMs || 0, markers: input.markers || [], audience: input.audience || null, versions: input.versions || [] };
  return [dropInsight(ctx), sourceInsight(ctx), deviceInsight(ctx), versionInsight(ctx)].filter(Boolean).slice(0, MAX_INSIGHTS);
}
