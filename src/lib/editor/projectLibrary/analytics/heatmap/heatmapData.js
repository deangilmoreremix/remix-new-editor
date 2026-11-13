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
export async function loadHeatmap(client, { videoId, type, from, to, viewport = 'all', cta = 'all', pageBucket = null }) {
  const vp = viewport === 'all' ? null : viewport;
  const base = { p_video_id: videoId, p_from: from, p_to: to };
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

/** [[cx,cy,n],...] on an N x N grid -> normalized cell-centre points {x,y,value}. */
export function cellsToPoints(cells, grid = 50) {
  return (cells || []).map(([cx, cy, n]) => ({ x: (Number(cx) + 0.5) / grid, y: (Number(cy) + 0.5) / grid, value: Number(n) || 0 })).filter((p) => p.value > 0);
}

/** Aspect (width / height) of the page the clicks were made on: bucket * 400 px tall at the device's nominal width. */
export function pageAspect(pageBucket, viewport = 'desktop') {
  const w = NOMINAL_WIDTH[viewport] || 1280;
  const h = Math.max(1, Number(pageBucket) || 1) * 400;
  return Math.min(4, Math.max(0.3, w / h));
}

export const topPageBucket = (buckets) => (buckets && buckets[0] ? Number(buckets[0].page_bucket) : 1);

/** CTA rows for the table and the selector; CTR is null (shown as "—") when there are no impressions. */
export function ctaRows(stats) {
  return (stats?.ctas || []).map((c) => ({
    key: c.cta_key, kind: c.kind || 'other', kindLabel: CTA_KIND_LABEL[c.kind] || CTA_KIND_LABEL.other,
    label: c.label || c.cta_key, impressions: c.impressions ?? null, clicks: c.clicks ?? null, ctr: c.ctr ?? null,
    suppressed: !!c.suppressed,
  }));
}

/** Per-second arrays -> chart series with the largest value for scaling; drop-off = the second most sessions ended on. */
export function engagementSeries(res) {
  const s = res?.seconds;
  if (!s || !Array.isArray(s.viewers)) return null;
  const n = s.viewers.length;
  const maxViewers = Math.max(1, ...s.viewers);
  const dropIdx = s.dropoff.reduce((best, v, i) => (v > (s.dropoff[best] ?? -1) ? i : best), 0);
  return {
    seconds: n, viewers: s.viewers, replays: s.replays, skips: s.skips, dropoff: s.dropoff, maxViewers,
    peakDropoffSecond: s.dropoff[dropIdx] > 0 ? dropIdx : null,
    totalReplays: s.replays.reduce((a, b) => a + b, 0), totalSkips: s.skips.reduce((a, b) => a + b, 0),
  };
}

export function scrollRows(res) {
  if (!res || res.suppressed) return [];
  const base = Number(res.sessions) || 0;
  return ['25', '50', '75', '100'].map((m) => {
    const n = Number(res.reached?.[m]) || 0;
    return { milestone: Number(m), sessions: n, percent: base ? Math.round((n / base) * 1000) / 10 : null };
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

/** CSV text for a loaded heatmap. Suppressed (small-cohort) data exports no rows, only the header. */
export function heatmapCsv(type, loaded) {
  const d = loaded?.data;
  if (type === 'click') {
    const grid = d?.grid || 50;
    return toCsv(['cell_x', 'cell_y', 'x_center', 'y_center', 'clicks'],
      d && !d.suppressed ? d.cells.map(([cx, cy, n]) => [cx, cy, ((cx + 0.5) / grid).toFixed(4), ((cy + 0.5) / grid).toFixed(4), n]) : []);
  }
  if (type === 'cta') {
    return toCsv(['cta_id', 'kind', 'label', 'impressions', 'clicks', 'ctr'],
      ctaRows(loaded?.ctas).map((r) => [r.key, r.kind, r.label, r.impressions, r.clicks, r.ctr]));
  }
  if (type === 'scroll') {
    return toCsv(['milestone_percent', 'sessions_reached', 'percent_of_sessions'], scrollRows(d).map((r) => [r.milestone, r.sessions, r.percent]));
  }
  const s = engagementSeries(d);
  return toCsv(['second', 'viewers', 'replays', 'skips', 'dropoff'],
    s ? s.viewers.map((v, i) => [i, v, s.replays[i], s.skips[i], s.dropoff[i]]) : []);
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
