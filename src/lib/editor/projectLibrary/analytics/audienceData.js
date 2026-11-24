/**
 * Audience breakdown and version comparison (pure mapping of the owner-only RPC rows).
 * Counts are played sessions, not people. No IPs, cities or regions exist anywhere in this data.
 */
export const MIN_SAMPLE = 5; // fewer sessions than this is too small to compare rates

const pctOf = (n, d) => (d > 0 ? Math.round((n / d) * 1000) / 10 : null);
const num = (v) => Number(v) || 0;

function regionName(code) {
  try { return new Intl.DisplayNames(['en'], { type: 'region' }).of(code) || code; } catch { return code; }
}

function labelFor(dimension, key) {
  if (dimension === 'referrer') return key || 'Direct';
  if (!key) return 'Unknown';
  if (dimension === 'device') return key[0].toUpperCase() + key.slice(1);
  return regionName(key);
}

/** rows: owner_video_audience_breakdown -> { referrers, devices, countries, total } (each list sorted by sessions). */
export function audienceRows(rows) {
  const by = { referrer: [], device: [], country: [] };
  for (const r of Array.isArray(rows) ? rows : []) {
    if (!by[r?.dimension]) continue;
    by[r.dimension].push({ key: r.key ?? null, sessions: num(r.sessions), completed: num(r.completed_sessions), leads: num(r.lead_sessions) });
  }
  // The database returns only the top ten referrers and countries, so their own sum can be far below the real number of
  // sessions. Every viewing session has a device class, so the device sum is the all-sessions total and the denominator for all three lists.
  const allSessions = by.device.filter((x) => x.sessions > 0).reduce((s, x) => s + x.sessions, 0);
  const shape = (dimension) => {
    const list = by[dimension].filter((x) => x.sessions > 0).sort((a, b) => b.sessions - a.sessions);
    const total = Math.max(allSessions, list.reduce((s, x) => s + x.sessions, 0));
    return list.map((x) => ({
      key: x.key, label: labelFor(dimension, x.key), sessions: x.sessions,
      sharePercent: pctOf(x.sessions, total), completionRate: pctOf(x.completed, x.sessions), leadRate: pctOf(x.leads, x.sessions),
    }));
  };
  const referrers = shape('referrer'); const devices = shape('device'); const countries = shape('country');
  return { referrers, devices, countries, total: devices.reduce((s, x) => s + x.sessions, 0) };
}

/** rows: owner_video_revision_comparison -> per-revision rates (0..100), oldest first. */
export function revisionRows(rows) {
  return (Array.isArray(rows) ? rows : []).map((r) => {
    const plays = num(r.plays);
    return {
      revision: num(r.revision), plays,
      completionRate: r.completion_rate == null ? pctOf(num(r.completed_sessions), plays) : Math.round(Number(r.completion_rate) * 1000) / 10,
      avgPercentWatched: r.avg_percent_watched == null ? null : Math.round(Number(r.avg_percent_watched) * 1000) / 10,
      leadRate: pctOf(num(r.lead_sessions), plays),
      ctaRate: pctOf(num(r.cta_sessions), plays),
      lowSample: plays < MIN_SAMPLE,
    };
  }).filter((r) => r.plays > 0).sort((a, b) => a.revision - b.revision);
}

const diff = (a, b) => (a == null || b == null ? null : Math.round((a - b) * 10) / 10);

/** Adds `delta` (change vs the previous revision, in percentage points; null for the first or when a side is unknown). */
export function revisionDeltas(rows) {
  const sorted = [...(rows || [])].sort((a, b) => a.revision - b.revision);
  return sorted.map((r, i) => {
    const p = sorted[i - 1];
    return {
      ...r,
      delta: p ? {
        plays: r.plays - p.plays,
        completion: diff(r.completionRate, p.completionRate),
        watched: diff(r.avgPercentWatched, p.avgPercentWatched),
        leads: diff(r.leadRate, p.leadRate),
        cta: diff(r.ctaRate, p.ctaRate),
      } : null,
    };
  });
}

/** "+6 pts" / "−3 pts" / "0 pts" / "—". */
export function formatPoints(v) {
  if (v == null || !Number.isFinite(v)) return '—';
  const a = Math.abs(Math.round(v * 10) / 10);
  return a === 0 ? '0 pts' : `${v > 0 ? '+' : '−'}${a} pts`;
}
