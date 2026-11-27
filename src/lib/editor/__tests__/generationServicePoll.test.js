import { describe, it, expect, vi, beforeEach } from 'vitest';

const { checkStatus } = vi.hoisted(() => ({ checkStatus: vi.fn() }));
vi.mock('../../muapi.js', async (orig) => ({ ...(await orig()), checkStatus }));

import { MuAPIProvider } from '../generationService.js';

describe('MuAPIProvider.poll transient failures', () => {
  beforeEach(() => checkStatus.mockReset());

  it('keeps polling after a retryable failure and does not cache it', async () => {
    const p = new MuAPIProvider();
    p.requestIds.set('g1', 'req1');
    checkStatus
      .mockResolvedValueOnce({ status: 'failed', error: 'network', retryable: true })
      .mockResolvedValueOnce({ status: 'completed', url: 'https://cdn/x.mp4' });
    expect((await p.poll('g1')).status).toBe('processing');
    const done = await p.poll('g1');
    expect(done.status).toBe('completed');
    expect(done.url).toBe('https://cdn/x.mp4');
  });

  it('still caches a real failure', async () => {
    const p = new MuAPIProvider();
    p.requestIds.set('g2', 'req2');
    checkStatus.mockResolvedValue({ status: 'failed', error: 'bad' });
    expect((await p.poll('g2')).status).toBe('failed');
    await p.poll('g2');
    expect(checkStatus).toHaveBeenCalledTimes(1);
  });
});

describe('MuAPIProvider saves finished video jobs to the Library', () => {
  const saved = () => JSON.parse(localStorage.getItem('video_history') || '[]').map((h) => h.url);
  beforeEach(() => { checkStatus.mockReset(); localStorage.removeItem('video_history'); });

  it('saves a queued take once it completes on poll', async () => {
    const p = new MuAPIProvider();
    p.requestIds.set('g3', 'req3');
    p.libraryMeta.set('g3', { prompt: 'a take', model: 'ltx-2-fast' });
    checkStatus.mockResolvedValue({ status: 'completed', url: 'https://cdn/take.mp4' });
    await p.poll('g3');
    await new Promise((r) => setTimeout(r, 0));
    expect(saved()).toEqual(['https://cdn/take.mp4']);
  });

  it('does not save a failed job, and forgets it', async () => {
    const p = new MuAPIProvider();
    p.requestIds.set('g4', 'req4');
    p.libraryMeta.set('g4', { prompt: 'x', model: 'm' });
    checkStatus.mockResolvedValue({ status: 'failed', error: 'bad' });
    await p.poll('g4');
    await new Promise((r) => setTimeout(r, 0));
    expect(saved()).toEqual([]);
    expect(p.libraryMeta.has('g4')).toBe(false);
  });

  it('ignores jobs that are not videos (no metadata recorded)', async () => {
    const p = new MuAPIProvider();
    p.requestIds.set('g5', 'req5');
    checkStatus.mockResolvedValue({ status: 'completed', url: 'https://cdn/pic.png' });
    await p.poll('g5');
    await new Promise((r) => setTimeout(r, 0));
    expect(saved()).toEqual([]);
  });
});
