// A failed motion-graphics download must reach the window's Retry state, and a partial load must not be remembered.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const ok = (body: unknown) => Promise.resolve({ ok: true, json: () => Promise.resolve(body) } as Response);
const down = () => Promise.resolve({ ok: false, status: 500, json: () => Promise.resolve({}) } as Response);

describe('loadMgTemplates failures', () => {
  beforeEach(() => { vi.resetModules(); });
  afterEach(() => { vi.unstubAllGlobals(); });

  it('rejects when every pack fails, does not cache that, and recovers on the next try', async () => {
    const fetchMock = vi.fn(() => down());
    vi.stubGlobal('fetch', fetchMock);
    const { loadMgTemplates } = await import('../lib/occ/mg-templates');
    await expect(loadMgTemplates()).rejects.toThrow(/could not be downloaded/);
    const before = fetchMock.mock.calls.length;
    fetchMock.mockImplementation(() => ok([]));
    await expect(loadMgTemplates()).resolves.toEqual([]); // asked again, not a cached failure
    expect(fetchMock.mock.calls.length).toBeGreaterThan(before);
  });

  it('a partial load returns what arrived but is not remembered', async () => {
    const fetchMock = vi.fn((url: string) => (String(url).includes('social-shorts') ? down() : ok([])));
    vi.stubGlobal('fetch', fetchMock);
    const { loadMgTemplates } = await import('../lib/occ/mg-templates');
    await expect(loadMgTemplates()).resolves.toEqual([]);
    await Promise.resolve();
    const before = fetchMock.mock.calls.length;
    await loadMgTemplates();
    expect(fetchMock.mock.calls.length).toBeGreaterThan(before); // it asked again
  });

  it('a complete load is remembered', async () => {
    const fetchMock = vi.fn(() => ok([]));
    vi.stubGlobal('fetch', fetchMock);
    const { loadMgTemplates } = await import('../lib/occ/mg-templates');
    await loadMgTemplates();
    const before = fetchMock.mock.calls.length;
    await loadMgTemplates();
    expect(fetchMock.mock.calls.length).toBe(before);
  });
});
