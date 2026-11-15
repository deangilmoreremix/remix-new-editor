import { describe, it, expect, vi } from 'vitest';
import { cellsToPoints, coarseToPoints, coarseBlocks, pageAspect, topPageBucket, ctaRows, engagementSeries, scrollRows, csvCell, toCsv, heatmapCsv, csvFilename, loadHeatmap } from '../heatmap/heatmapData.js';

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
  it('computes the engagement series: withheld seconds stay null, drop-off is a bin range', () => {
    const s = engagementSeries({ seconds: { viewers: [10, 8, 5, null], replays: [0, 6, null, 0], skips: [0, 0, 5, null], dropoff_bins: [[0, 1, 5], [2, 4, 12]] } });
    expect(s).toMatchObject({ seconds: 4, maxViewers: 10, peakDropoffRange: [2, 4], peakDropoffSecond: 2, totalReplays: 6, totalSkips: 5 });
    expect(s.withheld).toEqual([false, false, true, true]);
    expect(engagementSeries({ suppressed: true })).toBeNull();
    expect(engagementSeries({ seconds: { viewers: [], replays: [], skips: [], dropoff_bins: [] } })).toBeNull();
    // a single bin has nothing to compare: no peak marker
    expect(engagementSeries({ seconds: { viewers: [6], replays: [0], skips: [0], dropoff_bins: [[0, 0, 6]] } }).peakDropoffRange).toBeNull();
  });
  it('turns merged coarse blocks into an area (25 faint points) plus a dashed outline, never a precise spot', () => {
    const pts = coarseToPoints([[1, 2, 5]], 10, 5);
    expect(pts).toHaveLength(25);
    expect(Math.min(...pts.map((p) => p.x))).toBeCloseTo(0.11, 5);
    expect(Math.max(...pts.map((p) => p.x))).toBeCloseTo(0.19, 5);
    expect(pts.every((p) => p.value === 1)).toBe(true);
    expect(coarseBlocks([[1, 2, 5]], 10)).toEqual([{ left: 10, top: 20, size: 10, n: 5 }]);
    expect(coarseToPoints(null)).toEqual([]);
  });
  it('computes scroll rows and hides suppressed sets', () => {
    expect(scrollRows({ sessions: 10, reached: { 25: 10, 50: 7, 75: 4, 100: 1 } }).map((r) => r.percent)).toEqual([100, 70, 40, 10]);
    expect(scrollRows({ suppressed: true })).toEqual([]);
    // merged steps (null) are flagged, never turned into a number
    expect(scrollRows({ sessions: 12, reached: { 25: 12, 50: null, 75: null, 100: 5 } }).map((r) => [r.sessions, r.merged])).toEqual([[12, false], [null, true], [null, true], [5, false]]);
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
    expect(click).toBe('level,cell_x,cell_y,x_center,y_center,clicks\r\ncell,0,1,0.0100,0.0300,4\r\n');
    expect(heatmapCsv('click', { data: { suppressed: true } })).toBe('level,cell_x,cell_y,x_center,y_center,clicks\r\n');
    // merged blocks, the pool and the withheld marker are exported as such (no precise position for merged data, "<5" for the withheld part)
    expect(heatmapCsv('click', { data: { suppressed: false, min_cohort: 5, grid: 50, coarse_grid: 10, cells: [], coarse: [[1, 1, 5]], other: { sessions: 6, clicks: 7 }, withheld: true } }))
      .toBe('level,cell_x,cell_y,x_center,y_center,clicks\r\nmerged_block,1,1,0.1500,0.1500,5\r\nother_merged,,,,,7\r\nwithheld,,,,,<5\r\n');
    expect(heatmapCsv('cta', { ctas: { ctas: [{ cta_key: 'a', kind: 'book_call', label: '=x', impressions: 10, clicks: 2, ctr: 0.2 }] } }))
      .toBe("cta_id,kind,label,impressions,clicks,ctr\r\na,book_call,'=x,10,2,0.2\r\n");
    expect(heatmapCsv('cta', { ctas: { min_cohort: 5, ctas: [
      { cta_key: 'a', kind: 'contact', label: 'A', impressions: 12, clicks: null, clicks_suppressed: true, ctr: null, suppressed: false },
      { cta_key: 'b', kind: 'contact', label: 'B', impressions: null, clicks: null, ctr: null, suppressed: true }] } }))
      .toBe('cta_id,kind,label,impressions,clicks,ctr\r\na,contact,A,12,<5,\r\nb,contact,B,<5,<5,\r\n');
    expect(heatmapCsv('scroll', { data: { sessions: 4, reached: { 25: 4, 50: 2, 75: 1, 100: 0 } } })).toContain('50,2,50');
    expect(heatmapCsv('scroll', { data: { sessions: 12, reached: { 25: 12, 50: null, 75: null, 100: 5 } } })).toContain('50,merged,');
    expect(heatmapCsv('engagement', { data: { min_cohort: 5, seconds: { viewers: [12, 6, null], replays: [0, null, 0], skips: [0, 0, null], dropoff_bins: [[0, 2, 12]] } } }))
      .toBe('second,viewers,replays,skips,dropoff_bin,dropoff_bin_sessions\r\n0,12,0,0,0-2,12\r\n1,6,<5,0,0-2,\r\n2,<5,0,<5,0-2,\r\n');
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
