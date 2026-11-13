import { describe, it, expect, vi } from 'vitest';
import { periodRange, defaultCustomRange, retentionPoints, conversionRows, opportunityRows, loadAnalytics } from '../analyticsData.js';

const NOW = new Date('2026-11-11T15:30:00Z');

describe('periodRange (real UTC day ranges)', () => {
  it('maps each period to an inclusive range ending today', () => {
    expect(periodRange('today', null, NOW)).toEqual({ from: '2026-11-11', to: '2026-11-11' });
    expect(periodRange('7d', null, NOW)).toEqual({ from: '2026-11-05', to: '2026-11-11' });
    expect(periodRange('30d', null, NOW)).toEqual({ from: '2026-10-13', to: '2026-11-11' });
    expect(periodRange('90d', null, NOW)).toEqual({ from: '2026-08-14', to: '2026-11-11' });
  });
  it('uses a valid custom range and rejects bad ones', () => {
    expect(periodRange('custom', { from: '2026-10-01', to: '2026-10-31' }, NOW)).toEqual({ from: '2026-10-01', to: '2026-10-31' });
    expect(periodRange('custom', { from: '2026-10-31', to: '2026-10-01' }, NOW)).toEqual(periodRange('30d', null, NOW)); // reversed
    expect(periodRange('custom', { from: 'x', to: 'y' }, NOW)).toEqual(periodRange('30d', null, NOW));
    expect(periodRange('custom', { from: '2024-01-01', to: '2026-11-11' }, NOW).from).toBe('2025-10-08'); // capped to 400 days
    expect(defaultCustomRange(NOW)).toEqual({ from: '2026-10-13', to: '2026-11-11' });
  });
});

describe('mapping helpers', () => {
  it('retention: percent of played sessions per position, empty without sessions', () => {
    const rows = Array.from({ length: 100 }, (_, b) => ({ bucket: b, viewers: Math.max(0, 10 - Math.floor(b / 10)), base: 10 }));
    const pts = retentionPoints(rows);
    expect(pts[0]).toEqual({ positionPercent: 0, retentionPercent: 100 });
    expect(pts.at(-1).positionPercent).toBe(100);
    expect(pts.at(-1).retentionPercent).toBe(10);
    expect(retentionPoints([{ bucket: 0, viewers: 0, base: 0 }])).toEqual([]);
    expect(retentionPoints([])).toEqual([]);
  });
  it('conversions use owner labels and distinct sessions', () => {
    expect(conversionRows([
      { type: 'cta_click', clip_id: 'c1', label: null, sessions: '5' },
      { type: 'call_click', clip_id: 'c2', label: 'Call us', sessions: 2 },
      { type: 'lead_submit', clip_id: 'f1', label: null, sessions: 1 },
      { type: 'overlay_click', clip_id: 'zz', label: null, sessions: 1 },
    ], { c1: 'Get a quote', f1: 'Request estimate' })).toEqual([
      { label: 'Get a quote', clicks: 5, uniqueSessions: 5 },
      { label: 'Call: Call us', clicks: 2, uniqueSessions: 2 },
      { label: 'Lead: Request estimate', clicks: 1, uniqueSessions: 1 },
      { label: 'Overlay click', clicks: 1, uniqueSessions: 1 },
    ]);
  });
  it('opportunities come from owner notifications (digests excluded) with unread state', () => {
    const rows = opportunityRows([
      { id: 'a', type: 'pricing_cta', title: 'Pricing interest', summary: 'S', suggestion: 'Make a pricing video.', read_at: null },
      { id: 'b', type: 'daily_digest', title: 'Digest', summary: 'x', read_at: null },
      { id: 'c', type: 'new_lead', title: 'New lead captured', summary: 'S2', suggestion: null, read_at: '2026-11-11T00:00:00Z' },
    ]);
    expect(rows).toEqual([
      { id: 'a', icon: 'trend', title: 'Pricing interest', explanation: 'S', suggestion: 'Suggested action: Make a pricing video.', unread: true },
      { id: 'c', icon: 'lead', title: 'New lead captured', explanation: 'S2', suggestion: 'Suggested action: Review this activity in your Projects.', unread: false },
    ]);
  });
});

/** Supabase client double: records every RPC and table query; returns what a real database would for a given state. */
function client({ video, rpcs = {}, notes = [], business = 'acme' } = {}) {
  const calls = [];
  const chain = (table) => {
    const q = { table, filters: [] };
    const api = {
      select: () => api, eq: (c, v) => { q.filters.push(['eq', c, v]); return api; }, order: () => api, limit: () => api,
      gte: (c, v) => { q.filters.push(['gte', c, v]); return api; }, lt: (c, v) => { q.filters.push(['lt', c, v]); return api; },
      maybeSingle: async () => { calls.push(['table', table, q.filters]); return { data: table === 'published_videos' ? video : { business_slug: business }, error: null }; },
      then: (res, rej) => { calls.push(['table', table, q.filters]); return Promise.resolve({ data: notes, error: null }).then(res, rej); },
    };
    return api;
  };
  return { calls, from: chain, rpc: async (name, args) => { calls.push(['rpc', name, args]); const v = rpcs[name]; return { data: typeof v === 'function' ? v(args) : v ?? null, error: null }; } };
}
const VIDEO = { id: 'abcdefgh12', title: 'Kitchen', published: true, slug: 'kitchen', revision: 3, updated_at: 'x',
  project: { timelineSeconds: 100, tracks: [{ type: 'video', items: [{ id: 'a', name: 'Designs', left: 0, width: 50 }, { id: 'b', name: 'Pricing', left: 50, width: 50 }] }, { items: [{ id: 'cta1', buttonText: 'Get a quote' }] }] } };
const ROW = { id: 'proj-1', name: 'Kitchen Renovation', thumbnail_url: 'https://cdn/x.png' };

describe('loadAnalytics', () => {
  it('reports unpublished when the project has no published video (no queries beyond the lookup)', async () => {
    const c = client({ video: null });
    expect(await loadAnalytics(c, { projectRow: ROW })).toEqual({ status: 'unpublished' });
    expect(c.calls.some((x) => x[0] === 'rpc')).toBe(false);
  });

  it('queries every metric with the selected real date range and maps real results', async () => {
    const c = client({
      video: VIDEO,
      rpcs: {
        video_analytics_summary: { page_visits: 40, plays: 30, unique_viewers: 12, completion_rate: 0.4333, avg_watch_seconds: 41.2, cta_clicks: 5, call_clicks: 2, leads: 3 },
        video_analytics_timeseries: [{ day: '2026-11-10', plays: 10 }, { day: '2026-11-11', plays: 20 }],
        video_retention_curve: Array.from({ length: 100 }, (_, b) => ({ bucket: b, viewers: 30 - Math.floor(b / 5), base: 30 })),
        video_cta_performance: [{ type: 'cta_click', clip_id: 'cta1', label: null, sessions: 4 }],
        video_section_engagement: [{ section_id: 'a', engagement_percent: 80.5 }, { section_id: 'b', engagement_percent: null }],
      },
      notes: [{ id: 'n1', type: 'pricing_cta', title: 'Pricing interest', summary: 'Viewers clicked "Get a quote".', suggestion: 'Make a pricing video.', read_at: null }],
    });
    const r = await loadAnalytics(c, { projectRow: ROW, period: '7d', now: NOW, origin: 'https://smartvid.app' });
    expect(r.status).toBe('ok');
    // every RPC received the real inclusive range for the chosen period
    const rpcs = c.calls.filter((x) => x[0] === 'rpc');
    expect(rpcs.map((x) => x[1]).sort()).toEqual(['video_analytics_summary', 'video_analytics_timeseries', 'video_cta_performance', 'video_retention_curve', 'video_section_engagement']);
    for (const [, , a] of rpcs) expect(a).toMatchObject({ p_video_id: 'abcdefgh12', p_from: '2026-11-05', p_to: '2026-11-11' });
    // notifications are date-filtered too
    const nq = c.calls.find((x) => x[1] === 'owner_notifications')[2];
    expect(nq).toContainEqual(['gte', 'created_at', '2026-11-05T00:00:00Z']);
    expect(nq).toContainEqual(['lt', 'created_at', '2026-11-12T00:00:00Z']);
    expect(nq).toContainEqual(['eq', 'video_id', 'abcdefgh12']);

    const d = r.data;
    expect(d.metrics).toEqual({ plays: 30, uniqueViewers: 12, completionRate: expect.closeTo(43.33, 6), avgWatchSeconds: 41.2, ctaClicks: 7, leads: 3 });
    expect(d.thumbnailUrl).toBe('https://cdn/x.png'); // the saved project thumbnail
    expect(d.publishedUrl).toBe('https://smartvid.app/v/acme/kitchen'); // readable canonical link (slug + business set)
    expect(d.sections).toEqual([
      { id: 'a', title: 'Designs', startMs: 0, endMs: 50000, engagementPercent: 80.5 },
      { id: 'b', title: 'Pricing', startMs: 50000, endMs: 100000, engagementPercent: null },
    ]);
    expect(d.playsOverTime).toEqual([{ day: 'Tue', plays: 10 }, { day: 'Wed', plays: 20 }]);
    expect(d.conversions).toEqual([{ label: 'Get a quote', clicks: 4, uniqueSessions: 4 }]);
    expect(d.opportunities[0]).toMatchObject({ id: 'n1', unread: true, icon: 'trend' });
    expect(d.durationMs).toBe(100000);
    expect(r.hasTracking).toBe(true);
  });

  it('changing the period issues new queries with the new range (7d -> 90d -> custom)', async () => {
    const c = client({ video: VIDEO, rpcs: { video_analytics_summary: {} } });
    await loadAnalytics(c, { projectRow: ROW, period: '90d', now: NOW });
    await loadAnalytics(c, { projectRow: ROW, period: 'custom', custom: { from: '2026-09-01', to: '2026-09-30' }, now: NOW });
    const ranges = c.calls.filter((x) => x[1] === 'video_analytics_summary').map((x) => [x[2].p_from, x[2].p_to]);
    expect(ranges).toEqual([['2026-08-14', '2026-11-11'], ['2026-09-01', '2026-09-30']]);
  });

  it('never fabricates: no tracking data -> zeros for counts, null ("—") for undefined rates', async () => {
    const c = client({
      video: VIDEO,
      rpcs: {
        video_analytics_summary: { page_visits: 0, plays: 0, unique_viewers: 0, completion_rate: null, avg_watch_seconds: null, cta_clicks: 0, call_clicks: 0, leads: 0 },
        video_analytics_timeseries: [{ day: '2026-11-11', plays: 0 }],
        video_retention_curve: Array.from({ length: 100 }, (_, b) => ({ bucket: b, viewers: 0, base: 0 })),
        video_cta_performance: [], video_section_engagement: [{ section_id: 'a', engagement_percent: null }],
      },
    });
    const r = await loadAnalytics(c, { projectRow: { ...ROW, thumbnail_url: null }, period: 'today', now: NOW });
    expect(r.hasTracking).toBe(false);
    expect(r.data.metrics).toEqual({ plays: 0, uniqueViewers: 0, completionRate: null, avgWatchSeconds: null, ctaClicks: 0, leads: 0 });
    expect(r.data.retention).toEqual([]);
    expect(r.data.conversions).toEqual([]);
    expect(r.data.opportunities).toEqual([]);
    expect(r.data.thumbnailUrl).toBeUndefined();
  });

  it('unique viewers are unavailable (null) when plays exist but no viewer id was available', async () => {
    const c = client({ video: VIDEO, rpcs: { video_analytics_summary: { page_visits: 5, plays: 5, unique_viewers: 0, completion_rate: 0.2, avg_watch_seconds: 10, cta_clicks: 0, call_clicks: 0, leads: 0 } } });
    const r = await loadAnalytics(c, { projectRow: ROW, now: NOW });
    expect(r.data.metrics.uniqueViewers).toBeNull();
    expect(r.data.metrics.plays).toBe(5);
  });

  it('unpublished videos report an unpublished status but keep the readable URL off', async () => {
    const c = client({ video: { ...VIDEO, published: false }, rpcs: { video_analytics_summary: {} } });
    const r = await loadAnalytics(c, { projectRow: ROW, now: NOW });
    expect(r.data.status).toBe('unpublished');
    expect(r.data.publishedUrl).toBeUndefined();
  });

  it('surfaces database errors', async () => {
    const c = client({ video: VIDEO });
    c.rpc = async () => ({ data: null, error: { message: 'permission denied' } });
    await expect(loadAnalytics(c, { projectRow: ROW, now: NOW })).rejects.toThrow('permission denied');
  });
});
