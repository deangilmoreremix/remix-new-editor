// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, cleanup } from '@testing-library/react';
import HeatmapsSection from '../HeatmapsSection.jsx';
import { loadHeatmap, loadCampaignOptions } from '../heatmap/heatmapData.js';

const NOW = new Date('2026-11-11T15:30:00Z');
const VIDEO = { id: 'abcdefgh12', title: 'Kitchen' };
const CLICKS = { suppressed: false, min_cohort: 5, sessions: 9, clicks: 6, grid: 50, cells: [[25, 12, 6]], coarse: [], coarse_grid: 10, other: null, withheld: false, page_buckets: [{ page_bucket: 3, clicks: 6 }] };
const CTAS = { min_cohort: 5, sessions: 9, ctas: [] };
const AA = '00000000-0000-0000-0000-0000000000aa';
// `options` = what video_heat_campaign_options does: a value, 'missing' (older database: function does not exist) or 'throws'
const mkClient = (options) => {
  const calls = [];
  return {
 calls,
    from: () => ({ select: () => ({ order: () => ({ limit: async () => ({ data: [{ id: 'abcdefgh12', title: 'Kitchen' }], error: null }) }) }) }),
    rpc: async (n, a) => {
      calls.push([n, a]);
      if (n === 'video_heat_campaign_options') {
        if (options === 'throws') throw new Error('network');
        if (options === 'missing') return { data: null, error: { message: 'Could not find the function public.video_heat_campaign_options(p_video_id) in the schema cache' } };
        return { data: options, error: null };
      }
      return { data: { video_heat_clicks: CLICKS, video_heat_cta_stats: CTAS }[n], error: null };
    } 
};
};
const lastClick = (c) => c.calls.filter(([x]) => x === 'video_heat_clicks').at(-1)[1];
afterEach(cleanup);

describe('loadHeatmap / loadCampaignOptions', () => {
  it('sends p_campaign only when a campaign is selected (older RPC signatures keep working)', async () => {
    const c = mkClient({ available: false, campaigns: [] });
    await loadHeatmap(c, { videoId: 'v', type: 'click', from: 'a', to: 'b' });
    expect('p_campaign' in lastClick(c)).toBe(false);
    await loadHeatmap(c, { videoId: 'v', type: 'click', from: 'a', to: 'b', campaign: 'all' });
    expect('p_campaign' in lastClick(c)).toBe(false);
    await loadHeatmap(c, { videoId: 'v', type: 'click', from: 'a', to: 'b', campaign: AA });
    expect(lastClick(c).p_campaign).toBe(AA);
    const ctaCall = c.calls.filter(([x]) => x === 'video_heat_cta_stats').at(-1)[1];
    expect(ctaCall.p_campaign).toBe(AA);
  });
  it('options: unavailable on missing RPC, thrown error, available:false and empty list', async () => {
    const none = { available: false, campaigns: [] };
    expect(await loadCampaignOptions(mkClient('missing'), 'v')).toEqual(none);
    expect(await loadCampaignOptions(mkClient('throws'), 'v')).toEqual(none);
    expect(await loadCampaignOptions(mkClient({ available: false, campaigns: [] }), 'v')).toEqual(none);
    expect(await loadCampaignOptions(mkClient({ available: true, campaigns: [] }), 'v')).toEqual(none);
    expect(await loadCampaignOptions(mkClient(undefined), 'v')).toEqual(none);
  });
  it('options: names fall back to a short id', async () => {
    const r = await loadCampaignOptions(mkClient({ available: true, campaigns: [{ id: AA, name: 'Spring' }, { id: 'bbbbbbbb-1', name: null }] }), 'v');
    expect(r.available).toBe(true);
    expect(r.campaigns).toEqual([{ id: AA, name: 'Spring' }, { id: 'bbbbbbbb-1', name: 'Campaign bbbbbbbb' }]);
  });
});

describe('Heatmaps campaign control', () => {
  it.each(['missing', 'throws', { available: false, campaigns: [] }])('is hidden and results are unchanged when the linkage does not exist (%j)', async (opt) => {
    const c = mkClient(opt);
    render(<HeatmapsSection client={c} video={VIDEO} projectName="Kitchen" now={NOW} />);
    await waitFor(() => expect(screen.getByTestId('heat-stage')).toBeTruthy());
    await waitFor(() => expect(c.calls.some(([n]) => n === 'video_heat_campaign_options')).toBe(true));
    expect(screen.queryByLabelText('Campaign')).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
    expect('p_campaign' in lastClick(c)).toBe(false);
    expect(screen.getByText(/6 clicks shown from 9 sessions/)).toBeTruthy();
  });
  it('shows the control when available and passes the selected campaign to the RPCs', async () => {
    const c = mkClient({ available: true, campaigns: [{ id: AA, name: 'Spring outreach' }] });
    render(<HeatmapsSection client={c} video={VIDEO} projectName="Kitchen" now={NOW} />);
    const sel = await screen.findByLabelText('Campaign');
    expect([...sel.querySelectorAll('option')].map((o) => o.textContent)).toEqual(['All traffic', 'Spring outreach']);
    fireEvent.change(sel, { target: { value: AA } });
    await waitFor(() => expect(lastClick(c).p_campaign).toBe(AA));
    expect(screen.getByTestId('heat-summary').textContent).toContain('Campaign: Spring outreach');
    fireEvent.change(sel, { target: { value: 'all' } });
    await waitFor(() => expect('p_campaign' in lastClick(c)).toBe(false));
  });
  it('a withheld campaign view shows the normal "not enough data" message', async () => {
    const c = mkClient({ available: true, campaigns: [{ id: AA, name: 'Spring outreach' }] });
    const orig = c.rpc;
    c.rpc = async (n, a) => (n === 'video_heat_clicks' && a.p_campaign ? { data: { suppressed: true, min_cohort: 5, sessions: 0 }, error: null } : orig(n, a));
    render(<HeatmapsSection client={c} video={VIDEO} projectName="Kitchen" now={NOW} />);
    fireEvent.change(await screen.findByLabelText('Campaign'), { target: { value: AA } });
    expect((await screen.findByTestId('heat-suppressed')).textContent).toMatch(/Not enough data yet/);
  });
});
