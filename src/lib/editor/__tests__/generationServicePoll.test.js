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
