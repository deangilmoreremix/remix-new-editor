import { describe, it, expect, vi } from 'vitest';
import { withRetry, isRetryable } from '../retry.js';
import { backupDraft, loadBackup, clearBackup, cleanForBackup, hasWork, shouldOfferRestore } from '../draftBackup.js';

const noSleep = vi.fn(async () => {});

describe('retry', () => {
  it('retries a failing step and returns the first success', async () => {
    const fn = vi.fn().mockRejectedValueOnce(new Error('network')).mockRejectedValueOnce(new Error('network')).mockResolvedValue('ok');
    const onRetry = vi.fn();
    await expect(withRetry(fn, { sleep: noSleep, onRetry })).resolves.toBe('ok');
    expect(fn).toHaveBeenCalledTimes(3);
    expect(onRetry.mock.calls.map((c) => [c[0].attempt, c[0].of])).toEqual([[2, 3], [3, 3]]);
  });
  it('waits longer each time', async () => {
    const waits = []; const sleep = async (ms) => { waits.push(ms); };
    await withRetry(vi.fn().mockRejectedValueOnce(new Error('x')).mockRejectedValueOnce(new Error('x')).mockResolvedValue(1), { baseMs: 100, sleep });
    expect(waits).toEqual([100, 200]);
  });
  it('gives up after the last try with the real error', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('still down'));
    await expect(withRetry(fn, { tries: 2, sleep: noSleep })).rejects.toThrow('still down');
    expect(fn).toHaveBeenCalledTimes(2);
  });
  it('does not retry what cannot get better', async () => {
    for (const err of [Object.assign(new Error('forbidden'), { status: 403 }), Object.assign(new Error('x'), { name: 'AbortError' }), new Error('Sign in and try again.'), new Error('File too large')]) {
      const fn = vi.fn().mockRejectedValue(err);
      await expect(withRetry(fn, { sleep: noSleep })).rejects.toBe(err);
      expect(fn).toHaveBeenCalledTimes(1);
    }
    expect(isRetryable(Object.assign(new Error('slow down'), { status: 429 }))).toBe(true);
    expect(isRetryable(Object.assign(new Error('bad gateway'), { status: 502 }))).toBe(true);
  });
  it('stops waiting at once when cancelled', async () => {
    const ctl = new AbortController();
    const fn = vi.fn().mockRejectedValue(new Error('network'));
    const p = withRetry(fn, { baseMs: 10000, signal: ctl.signal });
    await Promise.resolve(); ctl.abort();
    await expect(p).rejects.toMatchObject({ name: 'AbortError' });
    expect(fn).toHaveBeenCalledTimes(1);
  });
});

const memory = () => { const m = new Map(); return { get: async (k) => m.get(k), set: async (k, v) => { m.set(k, v); }, del: async (k) => { m.delete(k); }, m }; };

describe('draft backup', () => {
  const work = { name: 'Q4', video: { url: 'https://cdn/x.mp4' }, contacts: [{ id: 'a' }] };
  it('keeps a copy and brings it back', async () => {
    const store = memory();
    expect(await backupDraft(work, { store, now: 5 })).toBe(true);
    expect(await loadBackup({ store })).toEqual({ savedAt: 5, draft: work });
    expect(await clearBackup({ store })).toBe(true);
    expect(await loadBackup({ store })).toBeNull();
  });
  it('drops temporary blob links, keeps everything else', () => {
    const d = cleanForBackup({ video: { url: 'blob:abc', duration: 9 }, header: 'Hi' });
    expect(d).toEqual({ video: { url: '', duration: 9 }, header: 'Hi' });
  });
  it('does not back up an empty draft', async () => {
    const store = memory();
    expect(hasWork({})).toBe(false);
    expect(await backupDraft({ name: '  ', contacts: [] }, { store })).toBe(false);
    expect(store.m.size).toBe(0);
  });
  it('never throws when storage fails', async () => {
    const broken = { get: async () => { throw new Error('quota'); }, set: async () => { throw new Error('quota'); }, del: async () => { throw new Error('x'); } };
    expect(await backupDraft(work, { store: broken })).toBe(false);
    expect(await loadBackup({ store: broken })).toBeNull();
    expect(await clearBackup({ store: broken })).toBe(false);
  });
  it('ignores a damaged backup', async () => {
    expect(await loadBackup({ store: { get: async () => ({ draft: 5 }) } })).toBeNull();
    expect(await loadBackup({ store: { get: async () => 'junk' } })).toBeNull();
  });
  it('offers a restore only when the current draft is empty and the backup has work', () => {
    const backup = { savedAt: 1, draft: work };
    expect(shouldOfferRestore({}, backup)).toBe(true);
    expect(shouldOfferRestore({ name: 'Something' }, backup)).toBe(false);
    expect(shouldOfferRestore({}, null)).toBe(false);
    expect(shouldOfferRestore({}, { savedAt: 1, draft: {} })).toBe(false);
  });
});
