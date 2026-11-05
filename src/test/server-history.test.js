import { describe, it, expect, vi } from 'vitest';
import { normalizeServerHistory, mergeServerHistory, fetchServerHistory } from '../lib/serverHistory.js';

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
});
