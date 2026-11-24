import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { createDemoClient, MIN_COHORT } from '../demo/demoClient.js';
import { DEMO_VIDEOS, getDemoVideo, isDemoVideoId } from '../demo/demoVideos.js';
import { loadAnalytics } from '../analyticsData.js';
import { loadHeatmap, loadCampaignOptions, engagementSeries, scrollRows, ctaRows, cellsToPoints } from '../heatmap/heatmapData.js';
import { projectSections, ctaLabels, projectDuration } from '../../../publish/sections.js';

const NOW = new Date('2026-11-20T12:00:00Z');
const client = () => createDemoClient({ now: () => NOW });
const row = (d) => ({ id: d.id, name: d.title, videoId: d.id, thumbnail_url: d.thumbnailUrl });
const analytics = (d, period = '30d') => loadAnalytics(client(), { projectRow: row(d), period, now: NOW });
const [ROOFING, TEASER, OUTREACH] = DEMO_VIDEOS;

describe('demo videos: the three stories', () => {
  it('there are at least three, with distinct ids, sizes and a thumbnail each', () => {
    expect(DEMO_VIDEOS.length).toBeGreaterThanOrEqual(3);
    expect(new Set(DEMO_VIDEOS.map((d) => d.id)).size).toBe(DEMO_VIDEOS.length);
    expect(new Set(DEMO_VIDEOS.map((d) => d.aspect)).size).toBeGreaterThanOrEqual(3); // 16:9, 9:16 and 1:1
    DEMO_VIDEOS.forEach((d) => { expect(isDemoVideoId(d.id)).toBe(true); expect(d.thumbnailUrl).toMatch(/^\/analytics-demo\/.+\.jpg$/); expect(d.lookFor.length).toBeGreaterThan(0); });
  });

  it('the published project of each demo has its sections, duration and button labels (what the real screens read)', () => {
    DEMO_VIDEOS.forEach((d) => {
      expect(projectDuration(d.project)).toBe(d.durationS);
      expect(projectSections(d.project).map((s) => s.title)).toEqual(d.sections.map((s) => s.title));
      expect(d.project.tracks[0].items[0].src).toMatch(/\.mp4$/);
    });
    expect(Object.values(ctaLabels(ROOFING.project))).toContain('Get my free quote');
    expect(Object.values(ctaLabels(TEASER.project))).toContain('Shop now');
    expect(Object.values(ctaLabels(OUTREACH.project))).toContain('Book a call');
    expect(TEASER.project.aspect).toBe('9:16');
  });

  it('runs the REAL analytics loader on every demo, with every card filled in', async () => {
    for (const d of DEMO_VIDEOS) {
      const r = await analytics(d);
      expect(r.status).toBe('ok');
      expect(r.hasTracking).toBe(true);
      const m = r.data.metrics;
      expect(m.plays).toBeGreaterThan(100);
      expect(m.uniqueViewers).toBeGreaterThan(0);
      expect(m.uniqueViewers).toBeLessThanOrEqual(m.plays);
      expect(m.completionRate).toBeGreaterThan(0);
      expect(m.avgWatchSeconds).toBeGreaterThan(0);
      expect(r.data.retention).toHaveLength(21);
      expect(r.data.retention[0].retentionPercent).toBe(100);
      expect(r.data.sections.map((s) => s.title)).toEqual(d.sections.map((s) => s.title));
      expect(r.data.sections.every((s) => s.engagementPercent != null)).toBe(true);
      expect(r.data.conversions.length).toBeGreaterThan(0);
      expect(r.data.audience.total).toBeGreaterThan(0);
      expect(r.data.versions).toHaveLength(2);
      expect(r.data.versions[1].delta.completion).toBeGreaterThan(0); // version 2 beat version 1
      expect(r.data.opportunities.length).toBeGreaterThan(0);
      expect(r.data.playsOverTime.length).toBe(30);
      expect(r.data.thumbnailUrl).toBe(d.thumbnailUrl);
    }
  });

  it('the three tell different stories', async () => {
    const [a, b, c] = await Promise.all(DEMO_VIDEOS.map((d) => analytics(d)));
    // 1. the ad that works: over half finish, clicks and leads
    expect(a.data.metrics.completionRate).toBeGreaterThan(50);
    expect(a.data.metrics.leads).toBeGreaterThan(100);
    // 2. the ad that loses people: few finish, and the biggest drop is right at the start
    expect(b.data.metrics.completionRate).toBeLessThan(25);
    expect(b.data.insights.join(' ')).toMatch(/Biggest drop.*0:00 and 0:01/);
    expect(b.data.retention[4].retentionPercent).toBeLessThan(45); // 20 % in
    // 3. the outreach video: a small audience that finishes
    expect(c.data.metrics.completionRate).toBeGreaterThan(70);
    expect(c.data.metrics.plays).toBeLessThan(a.data.metrics.plays);
    expect(c.data.conversions[0].label).toBe('Hotspot: Book a call'); // the main action
  });

  it('a shorter period is part of a longer one, and the numbers are the same on every visit', async () => {
    const [d7, d30, d90] = await Promise.all(['7d', '30d', '90d'].map((p) => analytics(ROOFING, p)));
    expect(d7.data.metrics.plays).toBeLessThan(d30.data.metrics.plays);
    expect(d30.data.metrics.plays).toBeLessThanOrEqual(d90.data.metrics.plays);
    expect((await analytics(ROOFING, '30d')).data.metrics).toEqual(d30.data.metrics);
    // the daily chart adds up to the plays card
    expect(d30.data.playsOverTime.reduce((s, x) => s + x.plays, 0)).toBe(d30.data.metrics.plays);
  });

  it('a video is not published before its first day: the days before it are zero', async () => {
    const r = await analytics(OUTREACH, '90d');
    expect(r.data.playsOverTime[0].plays).toBe(0);
    expect(r.data.playsOverTime.at(-1).plays).toBeGreaterThan(0);
  });
});

describe('demo videos: heatmaps (the real loaders and privacy rules)', () => {
  const heat = (d, type, extra = {}) => loadHeatmap(client(), { videoId: d.id, type, from: '2026-10-22', to: '2026-11-20', ...extra });

  it('click heat: cells and merged areas on a 50 x 50 grid, never a cell under the minimum group size', async () => {
    for (const d of DEMO_VIDEOS) {
      const { data } = await heat(d, 'click');
      expect(data.suppressed).toBe(false);
      expect(data.grid).toBe(50);
      expect(data.cells.length).toBeGreaterThan(5);
      data.cells.forEach(([cx, cy, n]) => { expect(n).toBeGreaterThanOrEqual(MIN_COHORT); expect(cx).toBeLessThan(50); expect(cy).toBeLessThan(50); });
      data.coarse.forEach(([, , n]) => expect(n).toBeGreaterThanOrEqual(MIN_COHORT));
      expect(cellsToPoints(data.cells, data.grid).length).toBe(data.cells.length);
      expect(data.page_buckets[0].page_bucket).toBeGreaterThan(0);
    }
  });

  it('the hottest spot of the roofing ad is its button, and filtering to one button keeps only that spot', async () => {
    const all = (await heat(ROOFING, 'click')).data;
    const top = [...all.cells].sort((a, b) => b[2] - a[2])[0];
    const x = (top[0] + 0.5) / 50; const y = (top[1] + 0.5) / 50;
    expect(Math.abs(x - 0.5)).toBeLessThan(0.1);
    expect(Math.abs(y - 0.683)).toBeLessThan(0.1);
    const phone = (await heat(ROOFING, 'click', { cta: 'cta-call' })).data;
    expect(phone.clicks).toBeLessThan(all.clicks);
    phone.cells.forEach(([, cy]) => expect(Math.abs((cy + 0.5) / 50 - 0.79)).toBeLessThan(0.12));
  });

  it('the teaser spreads its taps and barely warms its button; the outreach video concentrates them', async () => {
    const scatter = async (d, cta) => { const { data } = await heat(d, 'click'); const on = (await heat(d, 'click', { cta })).data; return on.clicks / data.clicks; };
    expect(await scatter(TEASER, 'cta-shop')).toBeLessThan(0.1);
    expect(await scatter(OUTREACH, 'cta-book')).toBeGreaterThan(0.25);
  });

  it('CTA table: clicks never exceed what was seen, and agree with the analytics conversions', async () => {
    for (const d of DEMO_VIDEOS) {
      const rows = ctaRows((await heat(d, 'cta')).ctas);
      expect(rows.length).toBeGreaterThan(0);
      rows.forEach((r) => { if (!r.suppressed && !r.clicksSuppressed) { expect(r.clicks).toBeLessThanOrEqual(r.impressions); expect(r.ctr).toBeCloseTo(r.clicks / r.impressions, 5); } });
    }
    const { data } = await analytics(ROOFING);
    const quote = ctaRows((await heat(ROOFING, 'cta')).ctas).find((r) => r.key === 'cta-quote');
    expect(quote.clicks).toBe(data.conversions.find((c) => c.label === 'Get my free quote').clicks);
  });

  it('scroll depth falls with depth, and engagement has one entry per second and drop-off ranges that each hold enough viewers', async () => {
    for (const d of DEMO_VIDEOS) {
      const rows = scrollRows((await heat(d, 'scroll')).data);
      expect(rows.map((r) => r.milestone)).toEqual([25, 50, 75, 100]);
      rows.reduce((prev, r) => { expect(r.percent).toBeLessThanOrEqual(prev); return r.percent; }, 100);
      const s = engagementSeries((await heat(d, 'engagement')).data);
      expect(s.seconds).toBe(Math.ceil(d.durationS));
      s.viewers.reduce((prev, v) => { if (v != null) expect(v).toBeLessThanOrEqual(prev); return v ?? prev; }, Infinity);
      s.bins.forEach((b) => expect(b.sessions).toBeGreaterThanOrEqual(MIN_COHORT));
    }
  });

  it('a group under the minimum size is hidden, exactly like the real database does', async () => {
    // tablet viewers of the outreach video over one week: a handful of sessions, below the minimum group size
    const small = { videoId: OUTREACH.id, from: '2026-11-14', to: '2026-11-20', viewport: 'tablet' };
    const click = await loadHeatmap(client(), { ...small, type: 'click' });
    expect(click.data.suppressed).toBe(true);
    expect(click.data.min_cohort).toBe(MIN_COHORT);
    expect((await loadHeatmap(client(), { ...small, type: 'engagement' })).data.suppressed).toBe(true);
    expect((await loadHeatmap(client(), { ...small, type: 'scroll' })).data.suppressed).toBe(true);
    // ... while the same video over a longer period shows its data
    expect((await loadHeatmap(client(), { ...small, from: '2026-10-22', viewport: 'all', type: 'click' })).data.suppressed).toBe(false);
  });

  it('device and campaign filters narrow the sessions; only the outreach demo has campaigns', async () => {
    const all = (await heat(ROOFING, 'scroll')).data.sessions;
    const mobile = (await heat(ROOFING, 'scroll', { viewport: 'mobile' })).data.sessions;
    expect(mobile).toBeLessThan(all);
    expect(await loadCampaignOptions(client(), ROOFING.id)).toEqual({ available: false, campaigns: [] });
    const options = await loadCampaignOptions(client(), OUTREACH.id);
    expect(options.available).toBe(true);
    expect(options.campaigns.map((c) => c.name)).toEqual(['Q4 SaaS prospects', 'Webinar attendees']);
    const one = (await heat(OUTREACH, 'scroll', { campaign: options.campaigns[0].id })).data.sessions;
    expect(one).toBeLessThan((await heat(OUTREACH, 'scroll')).data.sessions);
  });
});

describe('demo videos: the stand-in client', () => {
  it('answers the table reads the screens make, like a Supabase builder', async () => {
    const c = client();
    const { data: video } = await c.from('published_videos').select('id').eq('project_id', ROOFING.id).eq('id', ROOFING.id).order('updated_at', { ascending: false }).limit(1).maybeSingle();
    expect(video).toMatchObject({ id: ROOFING.id, published: true, revision: 2 });
    expect(video.project).toBe(ROOFING.project);
    const list = await Promise.resolve(c.from('published_videos').select('id, title').order('updated_at', { ascending: false }).limit(50));
    expect(list.data.map((v) => v.id).sort()).toEqual(DEMO_VIDEOS.map((d) => d.id).sort());
    const notes = await c.from('owner_notifications').select('id').eq('video_id', ROOFING.id).gte('created_at', '2026-10-22T00:00:00Z').lt('created_at', '2026-11-21T00:00:00Z').order('created_at', { ascending: false }).limit(8).then((r) => r.data);
    expect(notes.length).toBe(3);
    expect(notes.every((n) => n.video_id === ROOFING.id)).toBe(true);
  });

  it('never answers for a video that is not a demo, and says so for anything it does not implement', async () => {
    const c = client();
    expect((await c.rpc('video_analytics_summary', { p_video_id: 'a-real-video-id', p_from: '2026-11-01', p_to: '2026-11-20' })).error.message).toBe('Unknown demo video');
    expect((await c.rpc('owner_portfolio_summary', { p_video_id: ROOFING.id })).error.message).toMatch(/not available for demo videos/);
    expect(getDemoVideo('a-real-video-id')).toBeNull();
    expect(isDemoVideoId('a-real-video-id')).toBe(false);
  });
});

describe('demo videos stay apart from real analytics', () => {
  const root = resolve(__dirname, '../../../../../..');
  const walk = (dir) => readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    if (f === 'node_modules' || f === '__tests__' || f === 'dist') return [];
    return statSync(p).isDirectory() ? walk(p) : [p];
  });

  // every module an import / dynamic import in the source names (comments that talk about the demos are fine)
  const specifiers = (src) => [...src.matchAll(/(?:from\s+|import\s*\(\s*)['"]([^'"]+)['"]/g)].map((m) => m[1]);

  it('the real loaders and screens never import the demo modules', () => {
    for (const f of ['analyticsData.js', 'heatmap/heatmapData.js', 'AnalyticsTabView.jsx', 'HeatmapsSection.jsx', 'SmartVideoAnalytics.tsx', 'retentionLoader.js']) {
      const imports = specifiers(readFileSync(join(root, 'src/lib/editor/projectLibrary/analytics', f), 'utf8'));
      expect(imports.filter((i) => /\/demo\/|demoClient|demoVideos|demoPrefs/.test(i)), f).toEqual([]);
    }
  });

  it('only the demo strip of the Analytics tab uses the demo modules', () => {
    const users = walk(join(root, 'src')).filter((f) => /\.(jsx?|tsx?)$/.test(f))
      .filter((f) => !f.includes('/analytics/demo/'))
      .filter((f) => /analytics\/demo\/(demoClient|demoVideos|demoPrefs)/.test(readFileSync(f, 'utf8')))
      .map((f) => f.slice(root.length + 1));
    expect(users).toEqual(['src/cinegen/components/analytics/demo-videos.tsx']);
  });

  it('the hub analytics and the published overview never show demo videos', () => {
    for (const f of ['src/components/modals/hubAnalytics.js']) expect(specifiers(readFileSync(join(root, f), 'utf8')).filter((i) => /demo\/(demoClient|demoVideos|demoPrefs)/.test(i))).toEqual([]);
  });
});
