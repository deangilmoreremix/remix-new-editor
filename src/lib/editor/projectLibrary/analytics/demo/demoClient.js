/**
 * A stand-in for the Supabase client that answers the Analytics and Heatmaps screens from the DEMO videos (demoVideos.js).
 *
 * It implements only what those screens call: `rpc(name, args)` for the owner analytics / heatmap functions and a small
 * chainable `from(table)` for published_videos, video_owner_profiles and owner_notifications. The answers have the same
 * shapes as the database functions, so the real screens (AnalyticsTabView, HeatmapsSection, ...) run on a demo video
 * unchanged, and so do the real privacy rules: a group smaller than MIN_COHORT is hidden, exactly as the server does.
 *
 * Nothing is written anywhere and nothing is read from anywhere: the numbers are generated, per day, from each demo's
 * profile and a fixed seed, so they are the same on every visit and a shorter period is always part of a longer one.
 */
import { DEMO_VIDEOS, getDemoVideo } from './demoVideos.js';

const DAY = 86_400_000;
export const MIN_COHORT = 5; // the server's _heat_min_cohort()
const GRID = 50;
const COARSE = 10;
const PER = GRID / COARSE;
const WEEKDAY = [0.78, 1.04, 1.1, 1.1, 1.04, 0.94, 0.8]; // Sunday first

// ------------------------------------------------------------------ small helpers
const dayMs = (iso) => Date.parse(`${iso}T00:00:00Z`);
const isoDay = (ms) => new Date(ms).toISOString().slice(0, 10);
const hash = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i += 1) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const lerp = (a, b, t) => a + (b - a) * t;
/** Piecewise-linear value of anchors [[x, y], ...] at x. */
function curve(anchors, x) {
  if (x <= anchors[0][0]) return anchors[0][1];
  for (let i = 1; i < anchors.length; i += 1) {
    if (x <= anchors[i][0]) return lerp(anchors[i - 1][1], anchors[i][1], (x - anchors[i - 1][0]) / (anchors[i][0] - anchors[i - 1][0]));
  }
  return anchors[anchors.length - 1][1];
}

// ------------------------------------------------------------------ the per-day model
const sumKeys = ['plays', 'visits', 'completes', 'watch', 'cta', 'calls', 'leads', 'overlay'];
const blank = () => Object.fromEntries(sumKeys.map((k) => [k, 0]));

function dayStats(def, iso, today) {
  const p = def.profile;
  const t = dayMs(iso);
  const n = Math.round((t - (today - p.publishedDaysAgo * DAY)) / DAY);
  if (n < 0 || t > today) return null;
  const r = rng(hash(`${def.id}:${n}`));
  const plays = Math.max(0, Math.round(p.basePlays * (0.55 + 1.6 * Math.exp(-n / 10)) * WEEKDAY[new Date(t).getUTCDay()] * (0.8 + 0.4 * r())));
  const rev = n >= p.v2Day ? 2 : 1;
  const rt = p.rates[rev];
  const pick = (rate) => Math.min(plays, Math.round(plays * rate * (0.85 + 0.3 * r())));
  return {
    rev, plays,
    visits: Math.round(plays * p.visitsPerPlay * (0.9 + 0.2 * r())),
    completes: pick(rt.complete),
    watch: Math.round(plays * def.durationS * rt.watch * (0.92 + 0.16 * r())),
    cta: pick(rt.cta), calls: pick(rt.call), leads: pick(rt.lead), overlay: pick(rt.overlay),
  };
}

/** Totals, per-revision totals and the day list for an inclusive range of ISO days (capped like the real timeseries). */
function aggregate(def, from, to, today) {
  const start = Math.max(dayMs(from), dayMs(to) - 399 * DAY);
  const days = [];
  const sum = blank();
  const byRev = { 1: blank(), 2: blank() };
  for (let t = start; t <= dayMs(to); t += DAY) {
    const d = dayStats(def, isoDay(t), today);
    days.push({ day: isoDay(t), plays: d ? d.plays : 0 });
    if (!d) continue;
    sumKeys.forEach((k) => { sum[k] += d[k]; byRev[d.rev][k] += d[k]; });
  }
  return { days, sum, byRev };
}

/** Retention (percent of played sessions still watching) at a position, blended between the two versions by their share of plays. */
const retentionAt = (def, agg, pct) => {
  const total = agg.byRev[1].plays + agg.byRev[2].plays;
  const share2 = total ? agg.byRev[2].plays / total : 1;
  const { retention } = def.profile;
  return lerp(curve(retention[1], pct), curve(retention[2], pct), share2);
};

// ------------------------------------------------------------------ audience filters (device, campaign)
const deviceShare = (def, viewport) => (viewport ? (def.profile.audience.device.find(([k]) => k === viewport)?.[1] ?? 0.05) : 1);
const campaignShare = (def, campaign) => {
  if (!campaign) return 1;
  return def.profile.campaigns?.find((c) => c.id === campaign)?.share ?? 0;
};

// ------------------------------------------------------------------ RPC answers
function summary(def, { p_from, p_to }, today) {
  const { sum } = aggregate(def, p_from, p_to, today);
  const p = def.profile;
  return {
    page_visits: sum.visits, plays: sum.plays, sessions: sum.plays, completes: sum.completes,
    unique_viewers: Math.round(sum.plays * p.uniqueRatio),
    completion_rate: sum.plays ? sum.completes / sum.plays : null,
    avg_watch_seconds: sum.plays ? sum.watch / sum.plays : null,
    cta_clicks: sum.cta, call_clicks: sum.calls, overlay_clicks: sum.overlay, product_selects: 0, leads: sum.leads,
  };
}

function retentionRows(def, { p_from, p_to }, today) {
  const agg = aggregate(def, p_from, p_to, today);
  const base = agg.sum.plays;
  if (!base) return [];
  return Array.from({ length: 100 }, (_, b) => ({ bucket: b, viewers: Math.round((base * retentionAt(def, agg, b)) / 100), base }));
}

const TYPE_TOTAL = { cta_click: 'cta', call_click: 'calls', lead_submit: 'leads', overlay_click: 'overlay' };
function ctaTotals(def, agg) {
  return def.profile.ctas.map((c) => ({ ...c, sessions: Math.round((agg.sum[TYPE_TOTAL[c.type]] || 0) * c.share) }));
}

function ctaPerformance(def, { p_from, p_to }, today) {
  const agg = aggregate(def, p_from, p_to, today);
  return ctaTotals(def, agg).filter((c) => c.sessions > 0)
    .map((c) => ({ type: c.type, clip_id: c.id, label: c.label, sessions: c.sessions, eligible_sessions: agg.sum.plays }))
    .sort((a, b) => b.sessions - a.sessions);
}

function sectionEngagement(def, { p_sections, p_from, p_to }, today) {
  const agg = aggregate(def, p_from, p_to, today);
  const r = rng(hash(`${def.id}:sec:${p_from}`));
  return (p_sections || []).map((s) => {
    const v = def.profile.sectionEngagement[s.id];
    return { section_id: s.id, engagement_percent: agg.sum.plays && v != null ? Math.max(1, Math.min(99, Math.round((v + (r() - 0.5) * 4) * 10) / 10)) : null };
  });
}

function audience(def, { p_from, p_to }, today) {
  const agg = aggregate(def, p_from, p_to, today);
  const P = agg.sum.plays;
  const comp = P ? agg.sum.completes / P : 0;
  const lead = P ? agg.sum.leads / P : 0;
  const rows = [];
  Object.entries(def.profile.audience).forEach(([dimension, list]) => {
    list.forEach(([key, share, cMult, lMult]) => {
      const sessions = Math.round(P * share);
      rows.push({
        dimension, key, sessions,
        completed_sessions: Math.min(sessions, Math.round(sessions * comp * cMult)),
        lead_sessions: Math.min(sessions, Math.round(sessions * lead * lMult)),
      });
    });
  });
  return rows;
}

function revisions(def, { p_from, p_to }, today) {
  const agg = aggregate(def, p_from, p_to, today);
  return [1, 2].map((rev) => {
    const s = agg.byRev[rev];
    return {
      revision: rev, plays: s.plays, completed_sessions: s.completes,
      completion_rate: s.plays ? s.completes / s.plays : null,
      avg_percent_watched: s.plays ? s.watch / (s.plays * def.durationS) : null,
      lead_sessions: s.leads, cta_sessions: s.cta + s.calls + s.overlay,
    };
  }).filter((r) => r.plays > 0);
}

// -- heatmaps
/** Sessions that match the heatmap filters (device and campaign), scaled from the whole period. */
function heatSessions(def, args, today) {
  const agg = aggregate(def, args.p_from, args.p_to, today);
  const f = deviceShare(def, args.p_viewport) * campaignShare(def, args.p_campaign);
  return { agg, f, sessions: Math.round(agg.sum.plays * f) };
}

function heatCtaStats(def, args, today) {
  const { agg, f, sessions } = heatSessions(def, args, today);
  const ctas = ctaTotals(def, agg).map((c) => {
    const impressions = Math.round(sessions * c.exposure);
    const clicks = Math.min(impressions, Math.round(c.sessions * f));
    const suppressed = impressions < MIN_COHORT;
    const clicksSuppressed = !suppressed && clicks > 0 && clicks < MIN_COHORT;
    return {
      cta_key: c.id, kind: c.kind, label: c.label,
      impressions: suppressed ? null : impressions,
      clicks: suppressed || clicksSuppressed ? null : clicks,
      ctr: suppressed || clicksSuppressed || !impressions ? null : clicks / impressions,
      suppressed, clicks_suppressed: clicksSuppressed,
    };
  });
  return { min_cohort: MIN_COHORT, sessions, ctas };
}

function heatClicks(def, args, today) {
  const { agg, f, sessions } = heatSessions(def, args, today);
  const h = def.profile.heat;
  const pageBuckets = [{ page_bucket: h.pageBucket, sessions }];
  const clickSessions = Math.round(sessions * h.clickSessionRate);
  if (clickSessions < MIN_COHORT) return { suppressed: true, min_cohort: MIN_COHORT, sessions: clickSessions, page_buckets: pageBuckets };
  // Each button's spot gets its own click count (so the heat agrees with the CTA table); stray taps are spread over the scatter areas.
  const scatterTotal = sessions * h.scatterPerSession;
  const scatterW = h.scatter.reduce((s, b) => s + b.w, 0);
  const blobs = [
    ...ctaTotals(def, agg).filter((c) => h.ctaSpots[c.id]).map((c) => ({ ...h.ctaSpots[c.id], n: c.sessions * f * h.ctaTaps, cta: c.id })),
    ...h.scatter.map((b) => ({ ...b, n: (scatterTotal * b.w) / scatterW, cta: null })),
  ].filter((b) => !args.p_cta || b.cta === args.p_cta);
  // expected clicks per fine cell: every blob is a gaussian normalised to its own click count
  const expected = new Float64Array(GRID * GRID);
  for (const b of blobs) {
    const g = new Float64Array(GRID * GRID);
    let z = 0;
    for (let cy = 0; cy < GRID; cy += 1) {
      for (let cx = 0; cx < GRID; cx += 1) {
        const v = Math.exp(-0.5 * ((((cx + 0.5) / GRID - b.x) / b.sx) ** 2 + (((cy + 0.5) / GRID - b.y) / b.sy) ** 2));
        g[cy * GRID + cx] = v; z += v;
      }
    }
    for (let i = 0; i < g.length; i += 1) expected[i] += (g[i] / z) * b.n;
  }
  const cells = [];
  const merged = new Map(); // coarse block -> clicks of the fine cells that were too small to show on their own
  let shown = 0;
  const rnd = rng(hash(`${def.id}:heat:${args.p_from}:${args.p_cta || ''}`));
  for (let cy = 0; cy < GRID; cy += 1) {
    for (let cx = 0; cx < GRID; cx += 1) {
      const n = Math.round(expected[cy * GRID + cx] * (0.85 + 0.3 * rnd()));
      if (n <= 0) continue;
      if (n >= MIN_COHORT) { cells.push([cx, cy, n]); shown += n; } else {
        const key = `${Math.floor(cx / PER)},${Math.floor(cy / PER)}`;
        merged.set(key, (merged.get(key) || 0) + n);
      }
    }
  }
  const coarse = [];
  let withheld = false;
  merged.forEach((n, key) => {
    const [bx, by] = key.split(',').map(Number);
    if (n >= MIN_COHORT) { coarse.push([bx, by, n]); shown += n; } else withheld = true;
  });
  return {
    suppressed: false, min_cohort: MIN_COHORT, sessions: clickSessions, clicks: shown,
    grid: GRID, coarse_grid: COARSE, cells, coarse, ...(withheld ? { withheld: true } : {}), page_buckets: pageBuckets,
  };
}

function heatScroll(def, args, today) {
  const { sessions } = heatSessions(def, args, today);
  if (sessions < MIN_COHORT) return { suppressed: true, min_cohort: MIN_COHORT, sessions };
  const h = def.profile.heat;
  return {
    suppressed: false, min_cohort: MIN_COHORT, sessions,
    reached: Object.fromEntries(['25', '50', '75', '100'].map((m) => [m, Math.round(sessions * h.scroll[m])])),
    cta_exposed_sessions: Math.round(sessions * h.ctaExposed),
  };
}

function heatEngagement(def, args, today) {
  const { agg, sessions } = heatSessions(def, args, today);
  if (sessions < MIN_COHORT) return { suppressed: true, min_cohort: MIN_COHORT, sessions };
  const h = def.profile.heat;
  const n = Math.ceil(def.durationS);
  const raw = Array.from({ length: n }, (_, i) => Math.round((sessions * retentionAt(def, agg, (i / def.durationS) * 100)) / 100));
  const rate = (windows, i) => windows.reduce((s, [a, b, r]) => (i >= a && i < b ? s + r : s), 0);
  const viewers = raw.map((v) => (v < MIN_COHORT ? null : v));
  const small = (v) => (v > 0 && v < MIN_COHORT ? null : v);
  const replays = raw.map((v, i) => (viewers[i] == null ? null : small(Math.round(v * rate(h.replayAt, i)))));
  const skips = raw.map((v, i) => (viewers[i] == null ? null : small(Math.round(v * rate(h.skipAt, i)))));
  // drop-off in ranges of seconds, each holding at least MIN_COHORT sessions
  const bins = [];
  let from = 0; let acc = 0;
  raw.forEach((v, i) => {
    if (i === 0) return;
    acc += Math.max(0, raw[i - 1] - v);
    if (acc >= MIN_COHORT) { bins.push([from, i, acc]); from = i + 1; acc = 0; }
  });
  if (acc > 0 && bins.length) bins[bins.length - 1][2] += acc; else if (acc >= MIN_COHORT) bins.push([from, n - 1, acc]);
  return { suppressed: false, min_cohort: MIN_COHORT, sessions, seconds: { viewers, replays, skips, dropoff_bins: bins } };
}

function campaignOptions(def) {
  const c = def.profile.campaigns;
  return c ? { available: true, campaigns: c.map(({ id, name }) => ({ id, name })) } : { available: false, campaigns: [] };
}

const RPC = {
  video_analytics_summary: summary,
  video_analytics_timeseries: (def, a, today) => aggregate(def, a.p_from, a.p_to, today).days,
  video_retention_curve: retentionRows,
  video_cta_performance: ctaPerformance,
  video_section_engagement: sectionEngagement,
  owner_video_audience_breakdown: audience,
  owner_video_revision_comparison: revisions,
  video_heat_cta_stats: heatCtaStats,
  video_heat_clicks: heatClicks,
  video_heat_scroll: heatScroll,
  video_heat_engagement: heatEngagement,
  video_heat_campaign_options: campaignOptions,
};

// ------------------------------------------------------------------ the tables
function notificationRows(today) {
  return DEMO_VIDEOS.flatMap((def) => def.profile.notes.map((n, i) => ({
    id: `${def.id}-note-${i}`, video_id: def.id, type: n.type, title: n.title, summary: n.summary, suggestion: n.suggestion,
    read_at: i === 0 ? null : new Date(today - n.daysAgo * DAY + 3_600_000).toISOString(),
    created_at: new Date(today - n.daysAgo * DAY + 9 * 3_600_000).toISOString(),
  })));
}

function tableRows(table, today) {
  if (table === 'published_videos') {
    return DEMO_VIDEOS.map((d) => ({
      id: d.id, project_id: d.id, title: d.title, published: true, project: d.project, slug: d.id, privacy: 'public', revision: 2,
      updated_at: new Date(today - 3600_000).toISOString(),
    }));
  }
  if (table === 'video_owner_profiles') return [{ business_slug: 'demo' }];
  if (table === 'owner_notifications') return notificationRows(today);
  return [];
}

/** The part of a Supabase query builder the Analytics screens use. It is thenable, like the real one. */
function query(rows) {
  let list = rows;
  const api = {
    select: () => api,
    eq: (col, val) => { list = list.filter((r) => r[col] === val); return api; },
    gte: (col, val) => { list = list.filter((r) => String(r[col]) >= String(val)); return api; },
    lt: (col, val) => { list = list.filter((r) => String(r[col]) < String(val)); return api; },
    order: (col, { ascending = true } = {}) => { list = [...list].sort((a, b) => (a[col] < b[col] ? -1 : a[col] > b[col] ? 1 : 0) * (ascending ? 1 : -1)); return api; },
    limit: (n) => { list = list.slice(0, n); return api; },
    maybeSingle: () => Promise.resolve({ data: list[0] ?? null, error: null }),
    single: () => Promise.resolve(list[0] ? { data: list[0], error: null } : { data: null, error: { message: 'No rows' } }),
    then: (res, rej) => Promise.resolve({ data: list, error: null }).then(res, rej),
  };
  return api;
}

/**
 * @param {{ now?: () => Date }} [opts]  `now` lets tests pin the date; demos are always "published N days before today".
 */
export function createDemoClient({ now = () => new Date() } = {}) {
  const today = () => { const d = now(); return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()); };
  return {
    isDemo: true,
    async rpc(name, args = {}) {
      const handler = RPC[name];
      const def = getDemoVideo(args.p_video_id);
      if (!handler) return { data: null, error: { message: `${name} is not available for demo videos` } };
      if (!def) return { data: null, error: { message: 'Unknown demo video' } };
      return { data: handler(def, args, today()), error: null };
    },
    from: (table) => query(tableRows(table, today())),
  };
}
