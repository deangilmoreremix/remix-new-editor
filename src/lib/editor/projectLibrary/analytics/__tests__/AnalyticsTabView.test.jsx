// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, within, cleanup } from '@testing-library/react';
import AnalyticsTabView from '../AnalyticsTabView.jsx';

const NOW = new Date('2026-11-11T15:30:00Z');
const VIDEO = { id: 'abcdefgh12', title: 'Kitchen', published: true, slug: 'kitchen-renovation', revision: 2, updated_at: 'x',
  project: { timelineSeconds: 150, tracks: [{ type: 'video', items: [
    { id: 'a', name: 'Kitchen Designs', left: 0, width: 30 }, { id: 'b', name: 'Cabinet Upgrades', left: 30, width: 33 }, { id: 'c', name: 'Pricing and Estimates', left: 63, width: 37 }] }] } };
const ROW = { id: 'proj-1', name: 'Kitchen Renovation Promo', thumbnail_url: 'https://cdn.example/thumb.png' };

const SUMMARY = { page_visits: 60, plays: 48, sessions: 48, unique_viewers: 31, completion_rate: 0.5625, avg_watch_seconds: 77, cta_clicks: 6, call_clicks: 2, leads: 5 };
const defaults = () => ({
  video_analytics_summary: SUMMARY,
  video_analytics_timeseries: [{ day: '2026-11-09', plays: 10 }, { day: '2026-11-10', plays: 18 }, { day: '2026-11-11', plays: 20 }],
  video_retention_curve: Array.from({ length: 100 }, (_, b) => ({ bucket: b, viewers: Math.max(0, 48 - Math.floor(b / 2)), base: 48 })),
  video_cta_performance: [{ type: 'cta_click', clip_id: 'c1', label: 'Get a quote', sessions: 6 }, { type: 'call_click', clip_id: 'c2', label: 'Call us', sessions: 2 }],
  video_section_engagement: [{ section_id: 'a', engagement_percent: 88.2 }, { section_id: 'b', engagement_percent: 61 }, { section_id: 'c', engagement_percent: null }],
});

function makeClient({ video = VIDEO, rpcs = defaults(), notes = [], fail = null } = {}) {
  const calls = [];
  const chain = (table) => {
    const f = [];
    const api = { select: () => api, eq: (c, v) => { f.push([c, v]); return api; }, gte: () => api, lt: () => api, order: () => api, limit: () => api,
      maybeSingle: async () => ({ data: table === 'published_videos' ? video : { business_slug: 'example' }, error: null }),
      then: (res, rej) => Promise.resolve({ data: notes, error: null }).then(res, rej) };
    return api;
  };
  return { calls, from: chain, rpc: async (name, args) => { calls.push([name, args]); if (fail) return { data: null, error: { message: fail } }; return { data: rpcs[name] ?? null, error: null }; } };
}
const fakePlayer = () => { const p = { seek: vi.fn(), play: vi.fn(), destroy: vi.fn() }; return { p, createPlayer: vi.fn(async () => p) }; };
const view = (props = {}) => render(<AnalyticsTabView client={props.client || makeClient()} projectRow={ROW} now={NOW} {...props} />);
const ranges = (c, name = 'video_analytics_summary') => c.calls.filter(([n]) => n === name).map(([, a]) => [a.p_from, a.p_to]);

beforeEach(() => { Object.defineProperty(navigator, 'clipboard', { value: { writeText: vi.fn(async () => {}) }, configurable: true }); });
afterEach(cleanup);

describe('Analytics tab: states', () => {
  it('shows a loading skeleton, then the real numbers from the API', async () => {
    view();
    expect(screen.getByLabelText('Loading analytics')).toBeTruthy();
    await screen.findByText('Video Analytics');
    const stat = (label) => screen.getByText(label).closest('.sv-stat').querySelector('.sv-stat-value').textContent;
    expect(stat('Video plays')).toBe('48');
    expect(stat('Unique viewers')).toBe('31');
    expect(stat('Completion rate')).toBe('56%');       // 0.5625 -> 56%, calculated, not a fixture value
    expect(stat('Avg. watch time')).toBe('1:17');
    expect(stat('CTA clicks')).toBe('8');             // 6 CTA + 2 calls
    expect(stat('Leads captured')).toBe('5');
    expect(screen.getByText('Kitchen Renovation Promo')).toBeTruthy();
  });

  it('explains how to get analytics for an unpublished project and offers to publish', async () => {
    const onPublish = vi.fn();
    view({ client: makeClient({ video: null }), onPublish });
    await screen.findByText('Publish this video to see analytics');
    fireEvent.click(screen.getByRole('button', { name: /Publish video/ }));
    expect(onPublish).toHaveBeenCalled();
    expect(screen.queryByText('Video plays')).toBeNull();
  });

  it('shows an actionable error and retries', async () => {
    const client = makeClient({ fail: 'permission denied' });
    view({ client });
    await screen.findByText('Analytics could not be loaded');
    expect(screen.getByText('permission denied')).toBeTruthy();
    const before = client.calls.length;
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await waitFor(() => expect(client.calls.length).toBeGreaterThan(before));
  });

  it('says so when no tracking data exists, with real zeros and "—" for undefined rates', async () => {
    const rpcs = { ...defaults(), video_analytics_summary: { page_visits: 0, plays: 0, unique_viewers: 0, completion_rate: null, avg_watch_seconds: null, cta_clicks: 0, call_clicks: 0, leads: 0 },
      video_analytics_timeseries: [{ day: '2026-11-11', plays: 0 }], video_retention_curve: [], video_cta_performance: [] };
    view({ client: makeClient({ rpcs }), initialPeriod: 'today' });
    await screen.findByText(/No viewing data has been collected/);
    const stat = (label) => screen.getByText(label).closest('.sv-stat').querySelector('.sv-stat-value').textContent;
    expect(stat('Video plays')).toBe('0');
    expect(stat('Completion rate')).toBe('—');
    expect(stat('Avg. watch time')).toBe('—');
  });

  it('unique viewers show "—" when viewer ids are unsupported', async () => {
    const rpcs = { ...defaults(), video_analytics_summary: { ...SUMMARY, unique_viewers: 0 } };
    view({ client: makeClient({ rpcs }) });
    await screen.findByText('Video Analytics');
    expect(screen.getByText('Unique viewers').closest('.sv-stat').querySelector('.sv-stat-value').textContent).toBe('—');
  });
});

describe('Analytics tab: reporting periods use real date-ranged queries', () => {
  it('7 -> 30 -> 90 days, Today and a custom range each re-query with that range', async () => {
    const client = makeClient();
    view({ client });
    await screen.findByText('Video Analytics');
    expect(ranges(client)).toEqual([['2026-11-05', '2026-11-11']]);
    for (const [label, range] of [['30 days', ['2026-10-13', '2026-11-11']], ['90 days', ['2026-08-14', '2026-11-11']], ['Today', ['2026-11-11', '2026-11-11']]]) {
      fireEvent.click(screen.getByRole('button', { name: label }));
      await waitFor(() => expect(ranges(client).at(-1)).toEqual(range));
      expect(screen.getByRole('button', { name: label }).getAttribute('aria-pressed')).toBe('true');
    }
    fireEvent.click(screen.getByRole('button', { name: 'Custom' }));
    const group = await screen.findByRole('group', { name: 'Custom date range' });
    fireEvent.change(within(group).getByLabelText('From'), { target: { value: '2026-09-01' } });
    await waitFor(() => expect(ranges(client).at(-1)[0]).toBe('2026-09-01'));
    // every metric query received the same range (retention + sections + ctas too)
    const last = ranges(client).at(-1);
    for (const name of ['video_analytics_timeseries', 'video_retention_curve', 'video_cta_performance', 'video_section_engagement']) expect(ranges(client, name).at(-1)).toEqual(last);
  });
});

describe('Analytics tab: published URL, tabs, charts', () => {
  it('copies the canonical published URL', async () => {
    view({ client: makeClient() });
    await screen.findByText('Video Analytics');
    fireEvent.click(screen.getByRole('button', { name: /Copy video URL/ }));
    await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalledWith(`${location.origin}/v/example/kitchen-renovation`));
    await screen.findByText('Copied');
  });

  it('switches Overview / Engagement / Conversions and renders real chart data', async () => {
    view({ client: makeClient() });
    await screen.findByText('Video plays over time');
    expect(screen.getByRole('img', { name: /Line chart: Mon: 10, Tue: 18, Wed: 20/ })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Engagement' }));
    expect(screen.getByText('Audience retention')).toBeTruthy();
    expect(screen.getByRole('img', { name: /Audience retention curve, 21 data points/ })).toBeTruthy();
    expect(screen.getByText('88%')).toBeTruthy();       // section engagement from the RPC
    expect(screen.getAllByText('—').length).toBeGreaterThan(0); // section with no data
    fireEvent.click(screen.getByRole('button', { name: 'Conversions' }));
    expect(screen.getByText('Get a quote')).toBeTruthy();
    expect(screen.getByText('Call: Call us')).toBeTruthy();
  });

  it('shows honest empty states on Engagement and Conversions', async () => {
    const rpcs = { ...defaults(), video_retention_curve: [], video_cta_performance: [] };
    view({ client: makeClient({ rpcs }) });
    await screen.findByText('Video Analytics');
    fireEvent.click(screen.getByRole('button', { name: 'Engagement' }));
    expect(screen.getByText('No playback data for this period.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Conversions' }));
    expect(screen.getByText('No call-to-action activity for this period.')).toBeTruthy();
  });
});

describe('Analytics tab: engagement explorer drives the real player', () => {
  it('shows the saved project thumbnail first, then seeks the player to the section start', async () => {
    const { p, createPlayer } = fakePlayer();
    view({ client: makeClient(), createPlayer });
    await screen.findByText('Video Analytics');
    fireEvent.click(screen.getByRole('button', { name: 'Engagement' }));
    expect(screen.getByAltText('Kitchen Renovation Promo video thumbnail').getAttribute('src')).toBe('https://cdn.example/thumb.png');
    expect(createPlayer).not.toHaveBeenCalled();         // nothing is loaded until asked
    const cabinets = screen.getByRole('button', { name: /Cabinet Upgrades/ });
    expect(cabinets.textContent).toContain('0:45–1:35');   // 30%-63% of 150 s = 45 s to 94.5 s, shown as m:ss
    fireEvent.click(cabinets);
    await waitFor(() => expect(p.seek).toHaveBeenCalledWith(45));   // the section's real start (30% of 150 s)
    expect(p.play).toHaveBeenCalled();
    expect(createPlayer.mock.calls[0][1]).toBe(VIDEO.project);       // the published snapshot is what plays
    fireEvent.click(screen.getByRole('button', { name: /Pricing and Estimates/ }));
    await waitFor(() => expect(p.seek).toHaveBeenLastCalledWith(94.5)); // 63% of 150 s
    expect(createPlayer).toHaveBeenCalledTimes(1);                    // one player, reused
  });

  it('the play button starts the same player', async () => {
    const { p, createPlayer } = fakePlayer();
    view({ client: makeClient(), createPlayer });
    await screen.findByText('Video Analytics');
    fireEvent.click(screen.getByRole('button', { name: 'Engagement' }));
    fireEvent.click(screen.getByRole('button', { name: 'Play preview' }));
    await waitFor(() => expect(p.play).toHaveBeenCalled());
  });

  it('reports a preview failure without breaking the dashboard', async () => {
    const createPlayer = vi.fn(async () => { throw new Error('engine unavailable'); });
    view({ client: makeClient(), createPlayer });
    await screen.findByText('Video Analytics');
    fireEvent.click(screen.getByRole('button', { name: 'Engagement' }));
    fireEvent.click(screen.getByRole('button', { name: 'Play preview' }));
    await screen.findByText('engine unavailable');
    expect(screen.getByText('Top engaged sections')).toBeTruthy();
  });
});

describe('Analytics tab: opportunities and follow-up', () => {
  const notes = [
    { id: 'n1', type: 'pricing_cta', title: 'Pricing interest', summary: 'Viewers clicked "Get a quote".', suggestion: 'Create a pricing explainer video.', read_at: null },
    { id: 'n2', type: 'new_lead', title: 'New lead captured', summary: 'A viewer submitted a form.', suggestion: 'Review the inquiry.', read_at: '2026-11-10T00:00:00Z' },
  ];
  it('lists real owner notifications as opportunities and opens the clicked one', async () => {
    const onOpenOpportunity = vi.fn();
    view({ client: makeClient({ notes }), onOpenOpportunity });
    await screen.findByText('Marketing Opportunities');
    expect(screen.getByText('2 alerts')).toBeTruthy();
    expect(screen.getAllByRole('img', { name: 'Unread' })).toHaveLength(1);   // only n1 is unread
    fireEvent.click(screen.getByRole('button', { name: /Pricing interest/ }));
    expect(onOpenOpportunity).toHaveBeenCalledWith('n1');
    expect(screen.getByText('Suggested action: Create a pricing explainer video.')).toBeTruthy();
  });
  it('shows the supplied empty copy when there are none', async () => {
    view({ client: makeClient({ notes: [] }) });
    await screen.findByText('No opportunities detected for this period.');
  });
  it('the marketing insight is the latest real alert and launches the follow-up flow', async () => {
    const onCreateFollowup = vi.fn();
    view({ client: makeClient({ notes }), onCreateFollowup });
    await screen.findByText('Marketing insight');
    expect(screen.getByText('Viewers clicked "Get a quote".', { selector: 'p' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Plan personalized follow-up/ }));
    expect(onCreateFollowup).toHaveBeenCalled();
  });
  it('without any alert the insight says insights appear after engagement; the action is disabled without a handler', async () => {
    view({ client: makeClient({ notes: [] }) });
    await screen.findByText('Marketing insight');
    expect(screen.getByText(/Insights will appear when your published video collects engagement data/)).toBeTruthy();
    expect(screen.getByRole('button', { name: /Plan personalized follow-up/ }).disabled).toBe(true);
  });
});

describe('preview teardown', () => {
  it('destroys a player that owns a nested React root without unmounting a root mid-commit', async () => {
    const { createRoot } = await import('react-dom/client');
    const { mountAnalyticsTab } = await import('../mountAnalyticsTab.jsx');
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
    const panel = document.createElement('div');
    document.body.appendChild(panel);
    let nested;
    const destroy = vi.fn(() => nested.unmount());          // like previewEngine.jsx: destroy() unmounts its own React root
    const createPlayer = vi.fn(async (host) => {
      nested = createRoot(host);
      nested.render(<div data-testid="engine" />);
      return { seek: vi.fn(), play: vi.fn(), destroy };
    });
    const stop = mountAnalyticsTab(panel, { project: ROW }, { client: makeClient(), now: NOW, createPlayer });
    await waitFor(() => expect(panel.textContent).toContain('Video Analytics'));
    fireEvent.click(within(panel).getByRole('button', { name: 'Engagement' }));
    fireEvent.click(within(panel).getByRole('button', { name: 'Play preview' }));
    await waitFor(() => expect(createPlayer).toHaveBeenCalled());
    await new Promise((r) => setTimeout(r, 30));
    stop();                                                  // the Projects panel changes tab
    await new Promise((r) => setTimeout(r, 60));
    expect(destroy).toHaveBeenCalledTimes(1);               // the player is still cleaned up...
    expect(errors.mock.calls.flat().join(' ')).not.toMatch(/synchronously unmount/); // ...without the React error
    errors.mockRestore();
  });
});

describe('long date ranges', () => {
  it('never draws the last two axis labels on top of each other', async () => {
    const days = Array.from({ length: 30 }, (_, i) => ({ day: `2026-10-${String(i + 1).padStart(2, '0')}`, plays: i }));
    view({ client: makeClient({ rpcs: { ...defaults(), video_analytics_timeseries: days } }), initialPeriod: '30d' });
    await screen.findByText('Video plays over time');
    const svg = screen.getByRole('img', { name: /Line chart/ });
    const xs = [...svg.querySelectorAll('text')].map((t) => Number(t.getAttribute('x'))).sort((a, b) => a - b);
    expect(xs.length).toBeGreaterThan(2);
    for (let i = 1; i < xs.length; i += 1) expect(xs[i] - xs[i - 1]).toBeGreaterThan(50); // 12px labels of ~45px width never touch
  });
});

describe('editor palette', () => {
  it('the Analytics tab renders with the editor theme class in every state', async () => {
    const ok = view();
    await screen.findByText('Video Analytics');
    expect(document.querySelector('main.sv-analytics').classList.contains('sv-editor')).toBe(true);
    expect(document.querySelector('main.sv-analytics').classList.contains('sv-dark')).toBe(false);
    cleanup();
    view({ client: makeClient({ video: null }) });
    await screen.findByText('Publish this video to see analytics');
    expect(document.querySelector('.sv-analytics').classList.contains('sv-editor')).toBe(true);
    cleanup();
    view({ client: makeClient({ fail: 'x' }) });
    await screen.findByText('Analytics could not be loaded');
    expect(document.querySelector('.sv-analytics').classList.contains('sv-editor')).toBe(true);
    void ok;
  });
});
