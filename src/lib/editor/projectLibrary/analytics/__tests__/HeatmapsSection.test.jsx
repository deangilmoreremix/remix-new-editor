// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, cleanup } from '@testing-library/react';
import HeatmapsSection from '../HeatmapsSection.jsx';
import AnalyticsTabView from '../AnalyticsTabView.jsx';

const NOW = new Date('2026-11-11T15:30:00Z');
const VIDEO = { id: 'abcdefgh12', title: 'Kitchen' };
const CLICKS = { suppressed: false, min_cohort: 5, sessions: 9, clicks: 14, grid: 50, cells: [[25, 12, 6], [5, 40, 8]], page_buckets: [{ page_bucket: 3, clicks: 14 }] };
const CTAS = { min_cohort: 5, sessions: 9, ctas: [
  { cta_key: 'c1', kind: 'book_call', label: 'Book a call', impressions: 20, clicks: 5, ctr: 0.25, suppressed: false },
  { cta_key: 'c2', kind: 'other', label: '=Sneaky', impressions: null, clicks: 2, ctr: null, suppressed: false }] };
const ENG = { suppressed: false, sessions: 9, duration_s: 4, min_cohort: 5, seconds: { viewers: [9, 7, 4, 1], replays: [0, 2, 0, 0], skips: [0, 0, 2, 1], dropoff: [0, 2, 3, 1] } };
const SCROLL = { suppressed: false, sessions: 10, min_cohort: 5, reached: { 25: 10, 50: 6, 75: 3, 100: 1 }, cta_exposed_sessions: 4 };
const mkClient = (over = {}) => {
  const calls = [];
  return { calls, from: () => ({ select: () => ({ order: () => ({ limit: async () => ({ data: [{ id: 'abcdefgh12', title: 'Kitchen' }, { id: 'zzzzzzzz99', title: 'Other video' }], error: null }) }) }) }),
    rpc: async (n, a) => { calls.push([n, a]); const m = { video_heat_clicks: CLICKS, video_heat_cta_stats: CTAS, video_heat_engagement: ENG, video_heat_scroll: SCROLL, ...over }; return { data: m[n], error: null }; } };
};
afterEach(cleanup);
const last = (c, n) => c.calls.filter(([x]) => x === n).at(-1)[1];

describe('Heatmaps section controls', () => {
  it('loads the click heatmap with the default 30-day range and renders a canvas stage', async () => {
    const c = mkClient();
    render(<HeatmapsSection client={c} video={VIDEO} projectName="Kitchen" now={NOW} />);
    await waitFor(() => expect(screen.getByTestId('heat-stage')).toBeTruthy());
    expect(last(c, 'video_heat_clicks')).toMatchObject({ p_video_id: 'abcdefgh12', p_from: '2026-10-13', p_to: '2026-11-11', p_viewport: null, p_cta: null });
    expect(screen.getByText(/14 clicks from 9 sessions/)).toBeTruthy();
  });
  it('device, CTA, date range and video controls change the query', async () => {
    const c = mkClient();
    render(<HeatmapsSection client={c} video={VIDEO} projectName="Kitchen" now={NOW} />);
    await waitFor(() => screen.getByTestId('heat-stage'));
    fireEvent.change(screen.getByLabelText('Device'), { target: { value: 'mobile' } });
    await waitFor(() => expect(last(c, 'video_heat_clicks').p_viewport).toBe('mobile'));
    await waitFor(() => expect(screen.getByLabelText('CTA').querySelectorAll('option').length).toBe(3));
    fireEvent.change(screen.getByLabelText('CTA'), { target: { value: 'c1' } });
    await waitFor(() => expect(last(c, 'video_heat_clicks').p_cta).toBe('c1'));
    fireEvent.change(screen.getByLabelText('Date range'), { target: { value: '7d' } });
    await waitFor(() => expect(last(c, 'video_heat_clicks').p_from).toBe('2026-11-05'));
    fireEvent.change(screen.getByLabelText('Date range'), { target: { value: 'custom' } });
    fireEvent.change(screen.getByLabelText('From date'), { target: { value: '2026-10-01' } });
    await waitFor(() => expect(last(c, 'video_heat_clicks').p_from).toBe('2026-10-01'));
    await waitFor(() => expect(screen.getByLabelText('Video').querySelectorAll('option').length).toBe(2));
    fireEvent.change(screen.getByLabelText('Video'), { target: { value: 'zzzzzzzz99' } });
    await waitFor(() => expect(last(c, 'video_heat_clicks').p_video_id).toBe('zzzzzzzz99'));
  });
  it('intensity redraws without refetching; overlay toggle hides the heat layer', async () => {
    const c = mkClient();
    render(<HeatmapsSection client={c} video={VIDEO} projectName="Kitchen" now={NOW} />);
    await waitFor(() => screen.getByTestId('heat-stage'));
    const n = c.calls.length;
    fireEvent.change(screen.getByLabelText('Intensity'), { target: { value: '1.8' } });
    expect(c.calls.length).toBe(n);
    expect(screen.getByLabelText('Intensity').value).toBe('1.8');
    const canvas = screen.getByTestId('heat-canvas');
    expect(canvas.hidden).toBe(false);
    fireEvent.click(screen.getByLabelText('Overlay'));
    expect(screen.getByTestId('heat-canvas').hidden).toBe(true);
  });
  it('switches between the four heatmap types', async () => {
    const c = mkClient();
    render(<HeatmapsSection client={c} video={VIDEO} projectName="Kitchen" now={NOW} />);
    await waitFor(() => screen.getByTestId('heat-stage'));
    fireEvent.click(screen.getByRole('tab', { name: 'CTA performance' }));
    await waitFor(() => expect(screen.getByRole('table')).toBeTruthy());
    expect(screen.getByRole('table').textContent).toContain('Book a call');
    expect(screen.getByText('25%')).toBeTruthy();
    expect(screen.getAllByText('—').length).toBeGreaterThan(0); // no impressions -> no fabricated CTR
    fireEvent.click(screen.getByRole('tab', { name: 'Video engagement' }));
    await waitFor(() => expect(screen.getByTestId('engagement-strip')).toBeTruthy());
    expect(screen.getByText(/Peak drop-off: second 2/)).toBeTruthy();
    fireEvent.click(screen.getByRole('tab', { name: 'Scroll depth' }));
    await waitFor(() => expect(screen.getByTestId('scroll-bars')).toBeTruthy());
    expect(screen.getByText('60%')).toBeTruthy();
  });
  it('shows "not enough data" for small cohorts and disables export', async () => {
    const c = mkClient({ video_heat_clicks: { suppressed: true, min_cohort: 5, sessions: 2 } });
    render(<HeatmapsSection client={c} video={VIDEO} projectName="Kitchen" now={NOW} />);
    await waitFor(() => expect(screen.getByTestId('heat-suppressed')).toBeTruthy());
    expect(screen.queryByTestId('heat-stage')).toBeNull();
    expect(screen.getByRole('button', { name: 'Export CSV' }).disabled).toBe(true);
  });
  it('exports a CSV download and prints the report', async () => {
    const c = mkClient();
    const created = [];
    const orig = globalThis.URL.createObjectURL;
    globalThis.URL.createObjectURL = (b) => { created.push(b); return 'blob:x'; };
    globalThis.URL.revokeObjectURL = () => {};
    const printSpy = vi.fn(); globalThis.print = printSpy;
    render(<HeatmapsSection client={c} video={VIDEO} projectName="Kitchen" now={NOW} />);
    await waitFor(() => screen.getByTestId('heat-stage'));
    fireEvent.click(screen.getByRole('button', { name: 'Export CSV' }));
    expect(created).toHaveLength(1);
    const text = await new Promise((res) => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.readAsText(created[0]); });
    expect(text).toContain('cell_x,cell_y,x_center,y_center,clicks');
    fireEvent.click(screen.getByRole('button', { name: 'Print report' }));
    expect(printSpy).toHaveBeenCalled();
    globalThis.URL.createObjectURL = orig;
  });
  it('shows an error with retry when the RPC fails', async () => {
    const c = { from: () => ({}), rpc: async () => ({ data: null, error: { message: 'boom' } }) };
    render(<HeatmapsSection client={c} video={VIDEO} projectName="Kitchen" now={NOW} />);
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('boom'));
  });
});

describe('Heatmaps tab inside the Analytics tab', () => {
  it('adds a Heatmaps tab that mounts the section', async () => {
    const full = { id: 'abcdefgh12', title: 'Kitchen', published: true, slug: 'k', revision: 1, updated_at: 'x', project: { timelineSeconds: 60, tracks: [] } };
    const base = mkClient();
    const client = { calls: base.calls, rpc: base.rpc, from: (t) => {
      const api = { select: () => api, eq: () => api, gte: () => api, lt: () => api, order: () => api, limit: () => api,
        maybeSingle: async () => ({ data: t === 'published_videos' ? full : { business_slug: 'x' }, error: null }),
        then: (res) => Promise.resolve({ data: [], error: null }).then(res) };
      return api; } };
    render(<AnalyticsTabView client={client} projectRow={{ id: 'p1', name: 'Kitchen' }} now={NOW} />);
    const tab = await screen.findByRole('button', { name: 'Heatmaps' });
    fireEvent.click(tab);
    await waitFor(() => expect(screen.getByTestId('heatmaps-section')).toBeTruthy());
  });
});
