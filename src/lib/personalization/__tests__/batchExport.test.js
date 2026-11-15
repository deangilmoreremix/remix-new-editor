import { describe, it, expect, vi } from 'vitest';
import { runBatch, summarizeBatch, uniqueFileName, safeFileName } from '../batchExport.js';

const items = [{ id: 'a', name: 'Ann' }, { id: 'b', name: 'Raj' }, { id: 'c', name: 'Lee' }];

describe('file names', () => {
  it('strips unsafe characters and never returns empty', () => {
    expect(safeFileName('  A/B:C*?  ')).toBe('ABC');
    expect(safeFileName('../..')).toBe('video');
    expect(safeFileName('', 'x')).toBe('x');
  });
  it('de-duplicates case-insensitively', () => {
    const used = new Set();
    expect([uniqueFileName('Ann Lee', used, 'mp4'), uniqueFileName('ann lee', used, 'mp4'), uniqueFileName('Ann Lee', used, '.mp4')])
      .toEqual(['Ann Lee.mp4', 'ann lee (2).mp4', 'Ann Lee (3).mp4']);
  });
});

describe('runBatch', () => {
  it('renders in order and reports each item', async () => {
    const onItem = vi.fn();
    const { results, cancelled } = await runBatch(items, async (i) => `blob-${i.id}`, { onItem });
    expect(cancelled).toBe(false);
    expect(results.map((r) => [r.id, r.ok, r.value])).toEqual([['a', true, 'blob-a'], ['b', true, 'blob-b'], ['c', true, 'blob-c']]);
    expect(onItem).toHaveBeenCalledTimes(3);
  });
  it('continues after a failed item and records its error', async () => {
    const { results } = await runBatch(items, async (i) => { if (i.id === 'b') throw new Error('no image'); return i.id; });
    expect(results.map((r) => r.ok)).toEqual([true, false, true]);
    expect(results[1].error).toBe('no image');
  });
  it('aggregates progress across items', async () => {
    const seen = [];
    await runBatch(items.slice(0, 2), async (_i, ctx) => { ctx.onProgress(0.5); }, { onProgress: (p) => seen.push(Math.round(p * 100) / 100) });
    expect(seen).toEqual([0, 0.25, 0.5, 0.5, 0.75, 1]); // item done, then next item starts at the same point
    expect(seen).toEqual([...seen].sort((a, b) => a - b)); // never goes backwards
  });
  it('clamps bad progress values', async () => {
    const seen = [];
    await runBatch([items[0]], async (_i, ctx) => { ctx.onProgress(5); ctx.onProgress(NaN); }, { onProgress: (p) => seen.push(p) });
    expect(Math.max(...seen)).toBe(1);
    expect(Math.min(...seen)).toBe(0);
  });
  it('stops cleanly when cancelled between items', async () => {
    const ctl = new AbortController();
    const { results, cancelled } = await runBatch(items, async (i) => { if (i.id === 'a') ctl.abort(); return i.id; }, { signal: ctl.signal });
    expect(cancelled).toBe(true);
    expect(results).toHaveLength(0); // the cancel landed during item 1, which is not counted as done
  });
  it('treats a Cancelled error from the renderer as a cancel, not a failure', async () => {
    const { results, cancelled } = await runBatch(items, async (i) => { if (i.id === 'b') throw new Error('Cancelled'); return i.id; });
    expect(cancelled).toBe(true);
    expect(results.map((r) => r.id)).toEqual(['a']);
  });
  it('handles an empty list', async () => {
    expect(await runBatch([], async () => 1)).toEqual({ results: [], cancelled: false });
  });
});

describe('summarizeBatch', () => {
  it('summarises success, failure and cancel', () => {
    expect(summarizeBatch({ results: [{ ok: true, name: 'A' }, { ok: true, name: 'B' }] })).toBe('Exported 2 videos');
    expect(summarizeBatch({ results: [{ ok: true, name: 'A' }, { ok: false, name: 'Raj', error: 'no image' }] })).toBe('Exported 1 of 2. Failed: Raj (no image)');
    expect(summarizeBatch({ results: [{ ok: true, name: 'A' }], cancelled: true })).toBe('Exported 1 of 1 (cancelled)');
    expect(summarizeBatch({ results: [{ ok: true, name: 'A' }, { ok: true, name: 'B' }] }, { noun: 'image', verb: 'Prepared' })).toBe('Prepared 2 images');
  });
});
