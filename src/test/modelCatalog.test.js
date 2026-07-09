import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getEnrichedModels, clearModelCatalogCache } from '../lib/modelCatalog.js';

const CACHE_KEY = 'muapi_model_catalog';
const CACHE_TTL_MS = 5 * 60 * 1000;

describe('modelCatalog', () => {
  let mockFetch;

  beforeEach(() => {
    vi.useFakeTimers();
    mockFetch = vi.fn();
    globalThis.fetch = mockFetch;
    globalThis.localStorage = {
      getItem: vi.fn(),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn()
    };
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('getEnrichedModels', () => {
    it('returns cached models for a modelType when cache is fresh and does not call fetch', async () => {
      const now = Date.now();
      vi.setSystemTime(now);
      const cachedData = JSON.stringify({
        ts: now - 1000,
        data: { t2i: [{ id: 'flux-schnell' }] }
      });
      localStorage.getItem.mockReturnValue(cachedData);

      const result = await getEnrichedModels('t2i');

      expect(result).toEqual([{ id: 'flux-schnell' }]);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('expires stale cache, fetches /api/model-catalog, and returns models for the requested pool', async () => {
      const now = Date.now();
      vi.setSystemTime(now);
      const staleTs = now - CACHE_TTL_MS - 1;
      localStorage.getItem.mockReturnValue(
        JSON.stringify({
          ts: staleTs,
          data: { t2i: [{ id: 'old' }] }
        })
      );

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          t2i: [{ id: 'new-t2i' }],
          i2i: [{ id: 'new-i2i' }],
          i2v: [{ id: 'new-i2v' }],
        })
      });

      const result = await getEnrichedModels('t2i');

      expect(localStorage.removeItem).toHaveBeenCalledWith(CACHE_KEY);
      expect(mockFetch).toHaveBeenCalledWith('/api/model-catalog');
      expect(result).toEqual([{ id: 'new-t2i' }]);
    });

    it('fetches on cache miss, stores catalog keyed by modelType, and returns correct pool', async () => {
      localStorage.getItem.mockReturnValue(null);

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          t2i: [{ id: 'opus-t2i' }],
          i2i: [{ id: 'opus-i2i' }],
          i2v: [{ id: 'opus-i2v' }],
        })
      });

      const result = await getEnrichedModels('i2i');

      expect(mockFetch).toHaveBeenCalledWith('/api/model-catalog');
      expect(result).toEqual([{ id: 'opus-i2i' }]);
      expect(localStorage.setItem).toHaveBeenCalledTimes(1);
      const storedRaw = localStorage.setItem.mock.calls[0][1];
      const stored = JSON.parse(storedRaw);
      expect(stored.ts).toBeGreaterThan(0);
      expect(stored.data['i2i']).toEqual([{ id: 'opus-i2i' }]);
    });

    it('merges new pool into existing cached catalog without overwriting other pools', async () => {
      const now = Date.now();
      vi.setSystemTime(now);
      const existingCatalog = JSON.stringify({
        ts: now - 60000,
        data: { t2i: [{ id: 't2i-existing' }] }
      });
      localStorage.getItem.mockReturnValue(existingCatalog);

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          t2i: [{ id: 't2i-existing' }],
          i2i: [{ id: 'new-i2i' }],
          i2v: [{ id: 'new-i2v' }],
        })
      });

      const result = await getEnrichedModels('i2i');

      expect(result).toEqual([{ id: 'new-i2i' }]);
      const storedRaw = localStorage.setItem.mock.calls[0][1];
      const stored = JSON.parse(storedRaw);
      expect(stored.data).toHaveProperty('t2i');
      expect(stored.data).toHaveProperty('i2i');
    });

    it('returns [] when response has no matching pool key', async () => {
      localStorage.getItem.mockReturnValue(null);

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ t2i: [{ id: 'a' }] })
      });

      const result = await getEnrichedModels('i2v');

      expect(result).toEqual([]);
    });

    it('returns [] when response JSON has no pool keys at all', async () => {
      localStorage.getItem.mockReturnValue(null);

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ models: 'not-a-pool-map' })
      });

      const result = await getEnrichedModels('t2i');

      expect(result).toEqual([]);
    });

    it('clears cache and throws on non-ok response', async () => {
      localStorage.getItem.mockReturnValue(null);

      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: () => Promise.resolve({})
      });

      await expect(getEnrichedModels('t2i')).rejects.toThrow(
        'Catalog request failed: 500 Internal Server Error'
      );
      expect(localStorage.removeItem).toHaveBeenCalledWith(CACHE_KEY);
    });

    it('clears cache and re-throws on fetch network error', async () => {
      localStorage.getItem.mockReturnValue(null);

      mockFetch.mockRejectedValue(new Error('Network failure'));

      await expect(getEnrichedModels('t2i')).rejects.toThrow('Network failure');
      // clearModelCatalogCache calls localStorage.removeItem; assert it was
      // invoked with the cache key (call count > 0 and first call matches).
      expect(localStorage.removeItem).toHaveBeenCalled();
      const calls = localStorage.removeItem.mock.calls;
      expect(calls.some(c => c[0] === CACHE_KEY)).toBe(true);
    });

    it('does not throw from cache read when cached JSON is malformed and proceeds to fetch', async () => {
      localStorage.getItem.mockReturnValue('not valid json {{{');

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          t2i: [{ id: 'recovered' }],
          i2i: [],
          i2v: [],
        })
      });

      const result = await getEnrichedModels('t2i');

      expect(result).toEqual([{ id: 'recovered' }]);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('clearModelCatalogCache', () => {
    it('calls localStorage.removeItem with the cache key', () => {
      clearModelCatalogCache();
      expect(localStorage.removeItem).toHaveBeenCalledWith(CACHE_KEY);
    });

    it('does not throw when removeItem throws a storage error', () => {
      localStorage.removeItem.mockImplementation(() => {
        throw new Error('Storage quota exceeded');
      });

      expect(() => clearModelCatalogCache()).not.toThrow();
    });
  });
});
