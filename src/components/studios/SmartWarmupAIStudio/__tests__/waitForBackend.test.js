import { describe, expect, it, vi } from 'vitest';
import { waitForBackend } from '../SmartWarmupAIStudio.js';

const ok = (body = '') => ({ ok: true, text: async () => body });
const down = () => ({ ok: false, text: async () => '' });
const liveConfig = ok('window.__WARMBLY_ENV__ = { DEMO: "0", HOST_SESSION: "1" };');
const noSleep = () => Promise.resolve();

describe('waitForBackend', () => {
  it('does nothing on the demo build (no live config)', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(down());
    const onWaiting = vi.fn();
    await waitForBackend({ onWaiting, fetchImpl, sleep: noSleep });
    expect(onWaiting).not.toHaveBeenCalled();
    expect(fetchImpl).toHaveBeenCalledTimes(1); // only the config probe, never the backend
  });

  it('does nothing when the config keeps demo on', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(ok('window.__WARMBLY_ENV__ = { DEMO: "1" };'));
    const onWaiting = vi.fn();
    await waitForBackend({ onWaiting, fetchImpl, sleep: noSleep });
    expect(onWaiting).not.toHaveBeenCalled();
  });

  it('says it is starting, then waits until the backend answers', async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(liveConfig)
      .mockRejectedValueOnce(new Error('timeout'))
      .mockResolvedValueOnce(down())
      .mockResolvedValueOnce(ok());
    const onWaiting = vi.fn();
    const sleep = vi.fn(noSleep);
    await waitForBackend({ onWaiting, fetchImpl, sleep });
    expect(onWaiting).toHaveBeenCalledTimes(1);
    expect(fetchImpl.mock.calls[1][0]).toBe('/smartwarmupai-api/health');
    expect(sleep).toHaveBeenCalledTimes(2);
  });

  it('gives up after the limit so the dashboard can show its own message', async () => {
    const fetchImpl = vi.fn().mockImplementation(async (url) => (String(url).endsWith('config.js') ? liveConfig : down()));
    await expect(waitForBackend({ fetchImpl, maxMs: 30, stepMs: 10, sleep: (ms) => new Promise((r) => setTimeout(r, ms)) })).resolves.toBeUndefined();
  });

  it('does not let a request that never answers outlive the limit', async () => {
    // Like a hung proxy: only an abort ends it.
    const hang = (url, { signal } = {}) => new Promise((_, reject) => signal?.addEventListener('abort', () => reject(new Error('aborted'))));
    const fetchImpl = vi.fn().mockImplementation((url, opts) => (String(url).endsWith('config.js') ? Promise.resolve(liveConfig) : hang(url, opts)));
    const started = Date.now();
    await waitForBackend({ fetchImpl, maxMs: 60, stepMs: 10, sleep: (ms) => new Promise((r) => setTimeout(r, ms)) });
    expect(Date.now() - started).toBeLessThan(1000);
  });

  it('does not let a stalled config probe keep the dashboard from loading', async () => {
    // A fetch that never answers and ignores abort, like a stuck connection.
    const fetchImpl = vi.fn().mockReturnValue(new Promise(() => {}));
    const started = Date.now();
    await waitForBackend({ fetchImpl, maxMs: 40, sleep: noSleep });
    expect(Date.now() - started).toBeLessThan(1000);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('does not let a config body that never finishes keep the dashboard from loading', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true, text: () => new Promise(() => {}) });
    const onWaiting = vi.fn();
    const started = Date.now();
    await waitForBackend({ onWaiting, fetchImpl, maxMs: 40, sleep: noSleep });
    expect(Date.now() - started).toBeLessThan(1000);
    expect(onWaiting).not.toHaveBeenCalled();
  });

  it('bounds a health request that ignores its abort signal', async () => {
    const fetchImpl = vi.fn().mockImplementation((url) => (String(url).endsWith('config.js') ? Promise.resolve(liveConfig) : new Promise(() => {})));
    const started = Date.now();
    await waitForBackend({ fetchImpl, maxMs: 60, stepMs: 10, sleep: (ms) => new Promise((r) => setTimeout(r, ms)) });
    expect(Date.now() - started).toBeLessThan(1000);
  });
});
