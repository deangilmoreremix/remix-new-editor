import { describe, it, expect, vi } from 'vitest';
import { cellsToPoints, pageAspect, topPageBucket, ctaRows, engagementSeries, scrollRows, csvCell, toCsv, heatmapCsv, csvFilename, loadHeatmap } from '../heatmap/heatmapData.js';

describe('heatmap aggregation helpers', () => {
  it('converts grid cells to normalized centre points', () => {
    expect(cellsToPoints([[0, 0, 3], [49, 49, 1], [5, 5, 0]], 50)).toEqual([{ x: 0.01, y: 0.01, value: 3 }, { x: 0.99, y: 0.99, value: 1 }]);
  });
  it('derives the page aspect from bucket and device', () => {
    expect(pageAspect(3, 'desktop')).toBeCloseTo(1280 / 1200, 5);
    expect(pageAspect(3, 'mobile')).toBeCloseTo(390 / 1200, 5);
    expect(pageAspect(10, 'mobile')).toBe(0.3); // clamped
    expect(topPageBucket([{ page_bucket: 4 }])).toBe(4);
    expect(topPageBucket([])).toBe(1);
  });
  it('builds CTA rows without fabricating CTR', () => {
    const rows = ctaRows({ ctas: [
      { cta_key: 'a', kind: 'book_call', label: 'Book', impressions: 20, clicks: 5, ctr: 0.25 },
      { cta_key: 'b', kind: null, label: null, impressions: null, clicks: 3, ctr: null },
      { cta_key: 'c', kind: 'contact', label: 'x', suppressed: true, impressions: null, clicks: null, ctr: null }] });
    expect(rows[0]).toMatchObject({ kindLabel: 'Book a call', ctr: 0.25 });
    expect(rows[1]).toMatchObject({ kind: 'other', label: 'b', impressions: null, ctr: null });
    expect(rows[2].suppressed).toBe(true);
    expect(ctaRows(null)).toEqual([]);
  });
  it('computes the engagement series with the peak drop-off second', () => {
    const s = engagementSeries({ seconds: { viewers: [10, 8, 5, 2], replays: [0, 1, 2, 0], skips: [0, 0, 1, 1], dropoff: [0, 2, 3, 5] } });
    expect(s).toMatchObject({ seconds: 4, maxViewers: 10, peakDropoffSecond: 3, totalReplays: 3, totalSkips: 2 });
    expect(engagementSeries({ suppressed: true })).toBeNull();
    expect(engagementSeries({ seconds: { viewers: [1], replays: [0], skips: [0], dropoff: [0] } }).peakDropoffSecond).toBeNull();
  });
  it('computes scroll rows and hides suppressed sets', () => {
    expect(scrollRows({ sessions: 10, reached: { 25: 10, 50: 7, 75: 4, 100: 1 } }).map((r) => r.percent)).toEqual([100, 70, 40, 10]);
    expect(scrollRows({ suppressed: true })).toEqual([]);
  });
});

describe('CSV export', () => {
  it('quotes cells and neutralises spreadsheet formulas', () => {
    expect(csvCell('a,b')).toBe('"a,b"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell('=HYPERLINK("x")')).toBe('"\'=HYPERLINK(""x"")"');
    expect(csvCell('+1')).toBe("'+1");
    expect(csvCell(5)).toBe('5');
    expect(csvCell(-5)).toBe('-5');
    expect(csvCell(null)).toBe('');
    expect(toCsv(['a', 'b'], [[1, 'x,y']])).toBe('a,b\r\n1,"x,y"\r\n');
  });
  it('exports each heatmap type; suppressed data exports a header only', () => {
    const click = heatmapCsv('click', { data: { suppressed: false, grid: 50, cells: [[0, 1, 4]] } });
    expect(click).toBe('cell_x,cell_y,x_center,y_center,clicks\r\n0,1,0.0100,0.0300,4\r\n');
    expect(heatmapCsv('click', { data: { suppressed: true } })).toBe('cell_x,cell_y,x_center,y_center,clicks\r\n');
    expect(heatmapCsv('cta', { ctas: { ctas: [{ cta_key: 'a', kind: 'book_call', label: '=x', impressions: 10, clicks: 2, ctr: 0.2 }] } }))
      .toBe("cta_id,kind,label,impressions,clicks,ctr\r\na,book_call,'=x,10,2,0.2\r\n");
    expect(heatmapCsv('scroll', { data: { sessions: 4, reached: { 25: 4, 50: 2, 75: 1, 100: 0 } } })).toContain('50,2,50');
    expect(heatmapCsv('engagement', { data: { seconds: { viewers: [3, 2], replays: [0, 1], skips: [0, 0], dropoff: [1, 2] } } }))
      .toBe('second,viewers,replays,skips,dropoff\r\n0,3,0,0,1\r\n1,2,1,0,2\r\n');
    expect(csvFilename('click', 'abc/../d', '2026-01-01', '2026-01-31')).toBe('smartvideo-heatmap-click-abcd-2026-01-01_2026-01-31.csv');
  });
});

describe('loadHeatmap RPC calls', () => {
  const mk = () => { const calls = []; return { calls, rpc: vi.fn(async (n, a) => { calls.push([n, a]); return { data: { ok: n }, error: null }; }) }; };
  it('passes the filters to the owner RPCs', async () => {
    const c = mk();
    await loadHeatmap(c, { videoId: 'v1', type: 'click', from: '2026-01-01', to: '2026-01-31', viewport: 'mobile', cta: 'c9', pageBucket: 2 });
    expect(c.calls.map((x) => x[0])).toEqual(['video_heat_cta_stats', 'video_heat_clicks']);
    expect(c.calls[1][1]).toEqual({ p_video_id: 'v1', p_from: '2026-01-01', p_to: '2026-01-31', p_viewport: 'mobile', p_cta: 'c9', p_page_bucket: 2 });
  });
  it('"all" means no filter, and each type calls its own RPC', async () => {
    const c = mk();
    await loadHeatmap(c, { videoId: 'v1', type: 'engagement', from: 'a', to: 'b' });
    await loadHeatmap(c, { videoId: 'v1', type: 'scroll', from: 'a', to: 'b' });
    await loadHeatmap(c, { videoId: 'v1', type: 'cta', from: 'a', to: 'b' });
    expect(c.calls.map((x) => x[0])).toEqual(['video_heat_cta_stats', 'video_heat_engagement', 'video_heat_cta_stats', 'video_heat_scroll', 'video_heat_cta_stats']);
    expect(c.calls[1][1].p_viewport).toBeNull();
  });
  it('throws the RPC error message', async () => {
    await expect(loadHeatmap({ rpc: async () => ({ data: null, error: { message: 'not_found' } }) }, { videoId: 'v', type: 'click', from: 'a', to: 'b' })).rejects.toThrow('not_found');
  });
});
