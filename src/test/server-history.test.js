import { describe, it, expect, vi } from 'vitest';
import { normalizeServerHistory, mergeServerHistory, fetchServerHistory, rememberDeletedUrl, loadDeletedUrls } from '../lib/serverHistory.js';

describe('server history', () => {
  it('normalizes the common response shapes and skips unusable rows', () => {
    const rows = normalizeServerHistory({ data: [
      { request_id: 'a', outputs: ['https://cdn.example.com/a.mp4'], prompt: 'p', created_at: '2026-01-02' },
      { id: 'b', url: 'https://cdn.example.com/b.png' },
      { id: 'c', outputs: [] },
    ] });
    expect(rows.map((r) => [r.id, r.type])).toEqual([['a', 'video'], ['b', 'image']]);
    expect(normalizeServerHistory(null)).toEqual([]);
  });

  it('merges without duplicating local urls, newest first', () => {
    const local = [{ url: 'https://x/1.png', timestamp: '2026-01-01' }];
    const server = [{ url: 'https://x/1.png' }, { url: 'https://x/2.png', timestamp: '2026-02-01' }];
    expect(mergeServerHistory(local, server).map((i) => i.url)).toEqual(['https://x/2.png', 'https://x/1.png']);
  });

  it('returns nothing when the endpoint fails', async () => {
    expect(await fetchServerHistory({ getHistory: vi.fn().mockRejectedValue(new Error('404')) })).toEqual([]);
  });

  it('does not bring back a generation the user deleted', () => {
    try { localStorage.removeItem('library_deleted_urls'); } catch { /* ignore */ }
    const server = [{ url: 'https://cdn.example.com/gone.png', timestamp: 2 }, { url: 'https://cdn.example.com/keep.png', timestamp: 1 }];
    rememberDeletedUrl('https://cdn.example.com/gone.png');
    expect(loadDeletedUrls().has('https://cdn.example.com/gone.png')).toBe(true);
    const merged = mergeServerHistory([], server);
    expect(merged.map((i) => i.url)).toEqual(['https://cdn.example.com/keep.png']);
  });
});
