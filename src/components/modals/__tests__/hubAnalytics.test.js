import { describe, it, expect } from 'vitest';
import { changePct, previousRange, loadHubAnalytics, analyticsHtml, insightsFrom } from '../hubAnalytics.js';
import { resetRetentionLoader } from '../../../lib/editor/projectLibrary/analytics/retentionLoader.js';

const NOW = new Date('2026-11-15T12:00:00Z');
const fake = ({ cur, prev, rows, fail } = {}) => {
  let n = 0;
  return {
    rpc: async (name) => {
      if (fail) return { data: null, error: { message: 'boom' } };
      if (name === 'owner_portfolio_summary') return { data: (n++ === 0 ? cur : prev), error: null };
      if (name === 'owner_video_stats') return { data: rows, error: null };
      return { data: null, error: { code: 'PGRST202', message: 'could not find the function' } };
    },
  };
};

describe('hub analytics', () => {
  it('changePct needs a baseline', () => {
    expect(changePct(10, 0)).toBeNull();
    expect(changePct(15, 10)).toBe(50);
    expect(changePct(5, 10)).toBe(-50);
  });
  it('previousRange is the 30 days before', () => {
    expect(previousRange({ from: '2026-10-17', to: '2026-11-15' })).toEqual({ from: '2026-09-17', to: '2026-10-16' });
  });
  it('loads numbers and shows no change without a baseline', async () => {
    resetRetentionLoader();
    const d = await loadHubAnalytics(fake({
      cur: { plays: 10, unique_viewers: 4, cta_clicks: 2, call_clicks: 1, leads: 1 },
      prev: { plays: 0 },
      rows: [{ video_id: 'a', title: 'A <b>', plays: 10, unique_viewers: 4, completion_pct: 80, leads: 1 }, { video_id: 'b', title: 'B', plays: 0 }],
    }), { now: NOW });
    expect(d.status).toBe('ok');
    expect(d.current.cta).toBe(3);
    expect(d.changes.plays).toBeNull();
    expect(d.videos.map((v) => v.id)).toEqual(['a']);
    const html = analyticsHtml(d);
    expect(html).toContain('No earlier period to compare');
    expect(html).toContain('A &lt;b&gt;');
    expect(html).not.toMatch(/12\.5|Tuesday|0:15/);
    expect(insightsFrom(d).length).toBeGreaterThan(0);
  });
  it('empty and error states are honest', async () => {
    const d = await loadHubAnalytics(fake({ cur: {}, prev: {}, rows: [] }), { now: NOW });
    expect(d.status).toBe('empty');
    expect(analyticsHtml(d)).toContain('No plays yet');
    await expect(loadHubAnalytics(fake({ fail: true }), { now: NOW })).rejects.toBeTruthy();
    expect(analyticsHtml({ status: 'signed-out' })).toContain('Sign in');
    expect(analyticsHtml({ status: 'error' })).toContain('not available');
  });
});
