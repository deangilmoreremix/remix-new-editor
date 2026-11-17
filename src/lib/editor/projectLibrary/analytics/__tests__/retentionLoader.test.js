import { describe, it, expect, vi, beforeEach } from 'vitest';
import { loadRetentionCurves, resetRetentionLoader } from '../retentionLoader.js';

// 100 database rows (bucket 0..99) for one video: everyone at the start, half by the end.
const rowsFor = (videoId, base = 10) => Array.from({ length: 100 }, (_, b) => ({
  video_id: videoId, bucket: b, viewers: Math.round(base - (b / 99) * (base / 2)), base,
}));
const tick = () => new Promise((r) => setTimeout(r, 0));

describe('loadRetentionCurves', () => {
  beforeEach(() => resetRetentionLoader());

  it('asks for every video in ONE request and returns a curve per video with data', async () => {
    const rpc = vi.fn(async () => ({ data: [...rowsFor('a'), ...rowsFor('b'), ...rowsFor('c', 0)], error: null }));
    const seen = [];
    const out = await loadRetentionCurves({ rpc }, ['a', 'b', 'c'], { onCurve: (id) => seen.push(id) });
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc.mock.calls[0][0]).toBe('video_retention_curves');
    expect(rpc.mock.calls[0][1].p_video_ids).toEqual(['a', 'b', 'c']);
    expect(Object.keys(out).sort()).toEqual(['a', 'b']);            // c has base 0 -> no curve
    expect(out.a).toHaveLength(21);                                  // 0..100 in steps of 5
    expect(out.a[0].retentionPercent).toBe(100);
    expect(out.a[20].retentionPercent).toBeLessThan(100);
    expect(seen.sort()).toEqual(['a', 'b']);
  });

  it('de-duplicates and ignores invalid ids; no ids means no request', async () => {
    const rpc = vi.fn(async () => ({ data: rowsFor('a'), error: null }));
    expect(await loadRetentionCurves({ rpc }, [], {})).toEqual({});
    expect(await loadRetentionCurves({ rpc }, [null, '', 7, undefined], {})).toEqual({});
    expect(rpc).not.toHaveBeenCalled();
    await loadRetentionCurves({ rpc }, ['a', 'a', null, 'a'], {});
    expect(rpc.mock.calls[0][1].p_video_ids).toEqual(['a']);
  });

  it('splits long lists so one response never exceeds 1,000 rows (10 videos x 100 buckets)', async () => {
    const rpc = vi.fn(async () => ({ data: [], error: null }));
    const ids = Array.from({ length: 25 }, (_, i) => `v${i}`);
    await loadRetentionCurves({ rpc }, ids, {});
    expect(rpc.mock.calls.map(([, a]) => a.p_video_ids.length)).toEqual([10, 10, 5]);
  });

  it('falls back to one request per video when the batch function is missing, and remembers that', async () => {
    const rpc = vi.fn(async (name, args) => {
      if (name === 'video_retention_curves') return { data: null, error: { code: '42883', message: 'function public.video_retention_curves does not exist' } };
      return { data: rowsFor(args.p_video_id), error: null };
    });
    const first = await loadRetentionCurves({ rpc }, ['a', 'b'], {});
    expect(Object.keys(first).sort()).toEqual(['a', 'b']);
    expect(rpc.mock.calls.map(([n]) => n)).toEqual(['video_retention_curves', 'video_retention_curve', 'video_retention_curve']);
    rpc.mockClear();
    await loadRetentionCurves({ rpc }, ['a'], {});
    expect(rpc.mock.calls.map(([n]) => n)).toEqual(['video_retention_curve']);   // batch is not tried again
  });

  it('a one-off batch failure falls back but does not disable the batch path', async () => {
    let fail = true;
    const rpc = vi.fn(async (name, args) => {
      if (name === 'video_retention_curves') return fail ? { data: null, error: { message: 'network down' } } : { data: rowsFor('a'), error: null };
      return { data: rowsFor(args.p_video_id), error: null };
    });
    expect(Object.keys(await loadRetentionCurves({ rpc }, ['a'], {}))).toEqual(['a']);
    fail = false;
    rpc.mockClear();
    await loadRetentionCurves({ rpc }, ['a'], {});
    expect(rpc.mock.calls.map(([n]) => n)).toEqual(['video_retention_curves']);
  });

  it('per-video fallback never runs more than 4 requests at a time and skips failures', async () => {
    let running = 0; let peak = 0;
    const rpc = vi.fn(async (name, args) => {
      if (name === 'video_retention_curves') return { data: null, error: { code: 'PGRST202', message: 'Could not find the function' } };
      running++; peak = Math.max(peak, running); await tick(); running--;
      return args.p_video_id === 'v3' ? { data: null, error: { message: 'denied' } } : { data: rowsFor(args.p_video_id), error: null };
    });
    const ids = Array.from({ length: 9 }, (_, i) => `v${i}`);
    const out = await loadRetentionCurves({ rpc }, ids, { concurrency: 4 });
    expect(peak).toBeLessThanOrEqual(4);
    expect(Object.keys(out)).toHaveLength(8);
    expect(out.v3).toBeUndefined();
  });

  it('stops early when cancelled', async () => {
    const rpc = vi.fn(async () => ({ data: rowsFor('a'), error: null }));
    const out = await loadRetentionCurves({ rpc }, ['a'], { isCancelled: () => true });
    expect(out).toEqual({});
    expect(rpc).not.toHaveBeenCalled();
  });

  it('a client without rpc just yields no curves', async () => {
    expect(await loadRetentionCurves({}, ['a'], {})).toEqual({});
  });
});
