/**
 * Real numbers for the Personalization Suite "View Analytics" tab.
 * Owner-only RPCs through the signed-in client; nothing here is invented:
 * no data -> a clear state, no baseline -> no percentage change.
 */
import { periodRange } from '../../lib/editor/projectLibrary/analytics/analyticsData.js';
import { heatBuckets, heatBarHeight } from '../../lib/editor/projectLibrary/analytics/heatBuckets.js';
import { loadRetentionCurves } from '../../lib/editor/projectLibrary/analytics/retentionLoader.js';

const DAY_MS = 86_400_000;
const num = (v) => Number(v) || 0;
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/** The 30 days before `range` (same length). */
export function previousRange(range) {
  const from = Date.parse(`${range.from}T00:00:00Z`);
  const days = (Date.parse(`${range.to}T00:00:00Z`) - from) / DAY_MS + 1;
  const iso = (t) => new Date(t).toISOString().slice(0, 10);
  return { from: iso(from - days * DAY_MS), to: iso(from - DAY_MS) };
}

/** Percentage change, or null when there is no baseline to compare with. */
export function changePct(cur, prev) {
  return num(prev) > 0 ? Math.round(((num(cur) - num(prev)) / num(prev)) * 1000) / 10 : null;
}

export async function loadHubAnalytics(client, { now = new Date(), topCount = 5 } = {}) {
  const range = periodRange('30d', null, now);
  const prior = previousRange(range);
  const call = async (name, r) => {
    const { data, error } = await client.rpc(name, { p_from: r.from, p_to: r.to });
    if (error) throw error;
    return data;
  };
  const [cur, prev, rows] = await Promise.all([
    call('owner_portfolio_summary', range), call('owner_portfolio_summary', prior), call('owner_video_stats', range),
  ]);
  const totals = (d) => ({ plays: num(d?.plays), viewers: num(d?.unique_viewers), cta: num(d?.cta_clicks) + num(d?.call_clicks), leads: num(d?.leads) });
  const videos = (rows || []).map((r) => ({
    id: r.video_id, title: r.title || 'Untitled video', plays: num(r.plays), viewers: num(r.unique_viewers),
    completion: r.completion_pct == null ? null : num(r.completion_pct), leads: num(r.leads),
  })).filter((v) => v.plays > 0).sort((a, b) => b.plays - a.plays).slice(0, topCount);
  let curves = {};
  try { curves = videos.length ? await loadRetentionCurves(client, videos.map((v) => v.id), { period: '30d' }) : {}; } catch { curves = {}; }
  videos.forEach((v) => { v.retention = curves[v.id] || []; });
  const current = totals(cur);
  const previous = totals(prev);
  return {
    status: current.plays > 0 || previous.plays > 0 ? 'ok' : 'empty',
    range, current, previous, videos,
    changes: { plays: changePct(current.plays, previous.plays), viewers: changePct(current.viewers, previous.viewers), cta: changePct(current.cta, previous.cta), leads: changePct(current.leads, previous.leads) },
  };
}

/** Plain-language facts derived only from the loaded numbers. */
export function insightsFrom(d) {
  const out = [];
  if (!d || d.status !== 'ok') return out;
  const top = d.videos[0];
  if (top) out.push(`Most watched: “${top.title}” with ${top.plays} play${top.plays === 1 ? '' : 's'} in the last 30 days.`);
  if (d.current.plays > 0) {
    const rate = Math.round((d.current.cta / d.current.plays) * 100);
    out.push(`${d.current.cta} call-to-action click${d.current.cta === 1 ? '' : 's'} from ${d.current.plays} plays (${rate}%).`);
  }
  const best = d.videos.filter((v) => v.completion != null).sort((a, b) => b.completion - a.completion)[0];
  if (best) out.push(`Highest completion: “${best.title}” at ${Math.round(best.completion)}%.`);
  return out;
}

const changeHtml = (p) => (p == null ? '<div class="metric-change">No earlier period to compare</div>'
  : `<div class="metric-change ${p >= 0 ? 'positive' : 'negative'}">${p >= 0 ? '+' : ''}${p}% vs previous 30 days</div>`);

const metric = (icon, label, value, ch) => `<div class="metric-card"><div class="metric-icon">${icon}</div><div class="metric-value">${value}</div><div class="metric-label">${label}</div>${changeHtml(ch)}</div>`;

export function heatHtml(retention) {
  if (!retention?.length) return '<div class="hub-heat hub-heat-empty" aria-hidden="true"></div>';
  const bars = heatBuckets(retention, 34).map((v) => `<span style="height:${heatBarHeight(v)}%"></span>`).join('');
  return `<div class="hub-heat" role="img" aria-label="Audience retention across the video">${bars}</div>`;
}

/** @param {{status:string, message?:string}|object} d */
export function analyticsHtml(d) {
  const box = (msg) => `<div class="tab-content analytics-tab"><div class="empty-state">${esc(msg)}</div></div>`;
  if (!d || d.status === 'loading' || d.status === 'idle') return box('Loading your analytics…');
  if (d.status === 'signed-out') return box('Sign in to see analytics for your published videos.');
  if (d.status === 'error') return box('Analytics are not available right now. Try again in a moment.');
  if (d.status === 'empty') return box('No plays yet. Publish and share a video to see views, clicks and where viewers stay.');
  const c = d.current;
  const list = d.videos.map((v) => `<li class="hub-top-video"><div class="hub-top-title">${esc(v.title)}</div><div class="hub-top-meta">${v.plays} plays${v.completion != null ? ` · ${Math.round(v.completion)}% complete` : ''}</div>${heatHtml(v.retention)}</li>`).join('');
  const facts = insightsFrom(d).map((t) => `<div class="insight-card"><span class="insight-icon">💡</span><div class="insight-text">${esc(t)}</div></div>`).join('');
  return `<div class="tab-content analytics-tab"><div class="analytics-dashboard">
    <div class="metrics-grid">${metric('👁️', 'Plays', c.plays, d.changes.plays)}${metric('👥', 'Unique viewers', c.viewers, d.changes.viewers)}${metric('🔗', 'CTA clicks', c.cta, d.changes.cta)}${metric('📥', 'Leads', c.leads, d.changes.leads)}</div>
    <div class="chart-section"><h4>Top videos · last 30 days</h4><ul class="hub-top-list">${list}</ul></div>
    <div class="insights-section"><h4>Highlights</h4>${facts}</div></div></div>`;
}
