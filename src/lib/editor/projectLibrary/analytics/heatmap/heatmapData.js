/**
 * Data access, aggregation helpers and CSV export for the Heatmaps section (Stage 7).
 * Everything comes from the owner-only aggregated RPCs of 20261114100000_heatmap_analytics.sql.
 */
export const HEATMAP_TYPES = Object.freeze([
  ['click', 'Click heatmap'], ['cta', 'CTA performance'], ['engagement', 'Video engagement'], ['scroll', 'Scroll depth'],
]);
export const VIEWPORTS = Object.freeze([['all', 'All devices'], ['mobile', 'Mobile'], ['tablet', 'Tablet'], ['desktop', 'Desktop']]);
export const CTA_KIND_LABEL = Object.freeze({
  book_call: 'Book a call', visit_website: 'Visit website', call_now: 'Call now', get_offer: 'Get offer',
  contact: 'Contact', lead_capture: 'Lead capture', other: 'Other',
});
const NOMINAL_WIDTH = { mobile: 390, tablet: 768, desktop: 1280, all: 1280 };

const rpc = async (client, name, args) => {
  const { data, error } = await client.rpc(name, args);
  if (error) throw new Error(error.message || `${name} failed`);
  return data;
};

/** Load the data behind one heatmap type (the CTA list is always loaded: it feeds the CTA selector). */
export async function loadHeatmap(client, { videoId, type, from, to, viewport = 'all', cta = 'all', pageBucket = null, campaign = 'all' }) {
  const vp = viewport === 'all' ? null : viewport;
  // p_campaign is sent ONLY when a campaign is selected, so databases without 20261117100000 (old RPC signatures) keep working.
  const camp = campaign && campaign !== 'all' ? { p_campaign: campaign } : {};
  const base = { p_video_id: videoId, p_from: from, p_to: to, ...camp };
  const ctas = await rpc(client, 'video_heat_cta_stats', { ...base, p_viewport: vp });
  let data = null;
  if (type === 'click') {
    data = await rpc(client, 'video_heat_clicks', { ...base, p_viewport: vp, p_cta: cta === 'all' ? null : cta, p_page_bucket: pageBucket });
  } else if (type === 'scroll') {
    data = await rpc(client, 'video_heat_scroll', { ...base, p_viewport: vp });
  } else if (type === 'engagement') {
    data = await rpc(client, 'video_heat_engagement', { ...base, p_viewport: vp });
  }
  return { type, data, ctas };
}

/**
 * Campaign filter options (20261117100000). The control exists only when the database has the campaign linkage:
 * a missing RPC (migration not applied), an error, or {available:false} all mean "no filter" and never an error banner.
 * -> { available: boolean, campaigns: [{ id, name }] }
 */
export async function loadCampaignOptions(client, videoId) {
  try {
    const { data, error } = await client.rpc('video_heat_campaign_options', { p_video_id: videoId });
    if (error || !data || data.available !== true || !Array.isArray(data.campaigns) || !data.campaigns.length) return { available: false, campaigns: [] };
    return { available: true, campaigns: data.campaigns.filter((c) => c && c.id).map((c) => ({ id: String(c.id), name: c.name || `Campaign ${String(c.id).slice(0, 8)}` })) };
  } catch { return { available: false, campaigns: [] }; }
}

/** [[cx,cy,n],...] on an N x N grid -> normalized cell-centre points {x,y,value}. */
export function cellsToPoints(cells, grid = 50) {
  return (cells || []).map(([cx, cy, n]) => ({ x: (Number(cx) + 0.5) / grid, y: (Number(cy) + 0.5) / grid, value: Number(n) || 0 })).filter((p) => p.value > 0);
}

/**
 * Coarse blocks [[bx,by,n],...] on the 10 x 10 grid (each block = 5 x 5 fine cells: the events of fine cells that had fewer than the
 * minimum number of sessions, merged). Drawn as 25 faint points so that they read as an area, not a position.
 */
export function coarseToPoints(coarse, grid = 10, per = 5) {
  const fine = grid * per;
  const out = [];
  (coarse || []).forEach(([bx, by, n]) => {
    const value = (Number(n) || 0) / per;
    if (value <= 0) return;
    for (let i = 0; i < per; i += 1) for (let j = 0; j < per; j += 1) out.push({ x: (Number(bx) * per + i + 0.5) / fine, y: (Number(by) * per + j + 0.5) / fine, value });
  });
  return out;
}

/** Outlines (percent of the stage) for the merged blocks, so they are visibly "approximate area" and not a precise spot. */
export const coarseBlocks = (coarse, grid = 10) => (coarse || []).map(([bx, by, n]) => ({ left: (bx / grid) * 100, top: (by / grid) * 100, size: 100 / grid, n }));

/** Aspect (width / height) of the page the clicks were made on: bucket * 400 px tall at the device's nominal width. */
export function pageAspect(pageBucket, viewport = 'desktop') {
  const w = NOMINAL_WIDTH[viewport] || 1280;
  const h = Math.max(1, Number(pageBucket) || 1) * 400;
  return Math.min(4, Math.max(0.3, w / h));
}

export const topPageBucket = (buckets) => (buckets && buckets[0] ? Number(buckets[0].page_bucket) : 1);

/** The minimum cohort the server applied (single definition lives in the database: _heat_min_cohort()). */
export const minCohort = (d) => Number(d?.min_cohort) || 5;

/**
 * CTA rows for the table and the selector; CTR is null (shown as "—") when there are no impressions.
 * suppressed = impressions below the minimum cohort (whole row); clicksSuppressed = clicks in 1..min-1 (clicks and CTR withheld).
 */
export function ctaRows(stats) {
  return (stats?.ctas || []).map((c) => ({
    key: c.cta_key, kind: c.kind || 'other', kindLabel: CTA_KIND_LABEL[c.kind] || CTA_KIND_LABEL.other,
    label: c.label || c.cta_key, impressions: c.impressions ?? null, clicks: c.clicks ?? null, ctr: c.ctr ?? null,
    suppressed: !!c.suppressed, clicksSuppressed: !!c.clicks_suppressed,
  }));
}

/**
 * Per-second arrays -> chart series. A null entry is a second withheld by the server (fewer than the minimum number of viewers),
 * drawn hatched. Drop-off comes as bins (consecutive second ranges each holding at least the minimum number of sessions):
 * the marker spans the busiest bin and exists only when there are at least two bins to compare.
 */
export function engagementSeries(res) {
  const s = res?.seconds;
  if (!s || !Array.isArray(s.viewers) || !s.viewers.length) return null;
  const n = s.viewers.length;
  const sum = (a) => a.reduce((t, v) => t + (v == null ? 0 : v), 0);
  const maxViewers = Math.max(1, ...s.viewers.map((v) => v ?? 0));
  const bins = (s.dropoff_bins || []).map(([from, to, sessions]) => ({ from, to, sessions }));
  const top = bins.length > 1 ? bins.reduce((best, b) => (b.sessions > best.sessions ? b : best), bins[0]) : null;
  return {
    seconds: n, viewers: s.viewers, replays: s.replays, skips: s.skips, maxViewers, bins,
    withheld: s.viewers.map((v, i) => v == null || s.replays[i] == null || s.skips[i] == null),
    peakDropoffRange: top && top.sessions > 0 ? [top.from, top.to] : null,
    peakDropoffSecond: top && top.sessions > 0 ? top.from : null,
    totalReplays: sum(s.replays), totalSkips: sum(s.skips),
  };
}

/** Scroll milestones; a null `reached` value = merged into a neighbouring step (a step with fewer sessions than the minimum is never shown). */
export function scrollRows(res) {
  if (!res || res.suppressed) return [];
  const base = Number(res.sessions) || 0;
  return ['25', '50', '75', '100'].map((m) => {
    const v = res.reached?.[m];
    if (v == null) return { milestone: Number(m), sessions: null, percent: null, merged: true };
    const n = Number(v) || 0;
    return { milestone: Number(m), sessions: n, percent: base ? Math.round((n / base) * 1000) / 10 : null, merged: false };
  });
}

// ---------------------------------------------------------------- CSV
/** RFC 4180 quoting plus a leading-apostrophe guard against spreadsheet formula injection (=,+,-,@ in owner labels). */
export function csvCell(v) {
  if (v == null) return '';
  let s = String(v);
  if (typeof v === 'string' && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
export const toCsv = (header, rows) => [header, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n') + '\r\n';

/** CSV text for a loaded heatmap. Suppressed (small-cohort) data exports no rows, only the header; withheld cells are marked, never filled in. */
export function heatmapCsv(type, loaded) {
  const d = loaded?.data;
  const lt = `<${minCohort(type === 'cta' ? loaded?.ctas : d)}`;
  if (type === 'click') {
    const grid = d?.grid || 50;
    const cg = d?.coarse_grid || 10;
    const rows = [];
    if (d && !d.suppressed) {
      (d.cells || []).forEach(([cx, cy, n]) => rows.push(['cell', cx, cy, ((cx + 0.5) / grid).toFixed(4), ((cy + 0.5) / grid).toFixed(4), n]));
      (d.coarse || []).forEach(([bx, by, n]) => rows.push(['merged_block', bx, by, ((bx + 0.5) / cg).toFixed(4), ((by + 0.5) / cg).toFixed(4), n]));
      if (d.other) rows.push(['other_merged', '', '', '', '', d.other.clicks]);
      if (d.withheld) rows.push(['withheld', '', '', '', '', lt]);
    }
    return toCsv(['level', 'cell_x', 'cell_y', 'x_center', 'y_center', 'clicks'], rows);
  }
  if (type === 'cta') {
    return toCsv(['cta_id', 'kind', 'label', 'impressions', 'clicks', 'ctr'],
      ctaRows(loaded?.ctas).map((r) => [r.key, r.kind, r.label, r.suppressed ? lt : r.impressions, r.suppressed || r.clicksSuppressed ? lt : r.clicks, r.ctr]));
  }
  if (type === 'scroll') {
    return toCsv(['milestone_percent', 'sessions_reached', 'percent_of_sessions'], scrollRows(d).map((r) => [r.milestone, r.merged ? 'merged' : r.sessions, r.percent]));
  }
  const s = engagementSeries(d);
  const binAt = (i) => s.bins.find((b) => i >= b.from && i <= b.to);
  return toCsv(['second', 'viewers', 'replays', 'skips', 'dropoff_bin', 'dropoff_bin_sessions'],
    s ? s.viewers.map((v, i) => {
      const b = binAt(i);
      return [i, v ?? lt, s.replays[i] ?? lt, s.skips[i] ?? lt, b ? `${b.from}-${b.to}` : '', b && b.from === i ? b.sessions : ''];
    }) : []);
}

export function csvFilename(type, videoId, from, to) {
  return `smartvideo-heatmap-${type}-${String(videoId).replace(/[^A-Za-z0-9_-]/g, '')}-${from}_${to}.csv`;
}

export function downloadCsv(text, filename, doc = globalThis.document, urlApi = globalThis.URL) {
  const blob = new Blob([text], { type: 'text/csv;charset=utf-8' });
  const url = urlApi.createObjectURL(blob);
  const a = doc.createElement('a');
  a.href = url; a.download = filename; a.rel = 'noopener';
  doc.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => urlApi.revokeObjectURL(url), 1000);
}
