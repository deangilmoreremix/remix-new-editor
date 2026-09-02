import { describe, it, expect, vi, beforeEach } from 'vitest';
import { searchPhotos, searchVideos, getCuratedPhotos, getPopularVideos, getPhoto, getVideo, clearPexelsCache } from '../pexelsApi.js';

describe('pexelsApi', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    // Mock sessionStorage with a simple in-memory store
    const store = {};
    global.sessionStorage = {
      getItem: (key) => store[key] || null,
      setItem: (key, value) => { store[key] = String(value); },
      removeItem: (key) => { delete store[key]; },
      clear: () => { Object.keys(store).forEach(k => delete store[k]); },
      get length() { return Object.keys(store).length; },
      key: (i) => Object.keys(store)[i] || null,
    };
    global.fetch = vi.fn();
  });

  it('searchPhotos calls backend proxy with correct params', async () => {
    const mockResponse = {
      photos: [{ id: 1, alt: 'Nature', src: { large: 'https://example.com/1.jpg' } }],
      total_results: 1,
      page: 1,
      per_page: 1,
      _rateLimit: { limit: 20000, remaining: 19999, reset: 1234567890 },
    };
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    });

    const result = await searchPhotos({ query: 'nature', page: 1, per_page: 1 });
    expect(result.photos).toHaveLength(1);
    expect(result.photos[0].id).toBe(1);
    expect(global.fetch).toHaveBeenCalledTimes(1);
    const calledUrl = global.fetch.mock.calls[0][0];
    expect(calledUrl).toContain('/api/pexels/photos/search');
    expect(calledUrl).toContain('query=nature');
  });

  it('searchPhotos uses cache on second call', async () => {
    const mockResponse = {
      photos: [{ id: 2, alt: 'Ocean', src: { large: 'https://example.com/2.jpg' } }],
      total_results: 1,
      page: 1,
      per_page: 1,
      _rateLimit: { limit: 20000, remaining: 19998, reset: 1234567890 },
    };
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    });

    const first = await searchPhotos({ query: 'ocean', page: 1, per_page: 1 });
    expect(first.photos).toHaveLength(1);
    const callCountAfterFirst = global.fetch.mock.calls.length;

    const second = await searchPhotos({ query: 'ocean', page: 1, per_page: 1 });
    expect(second.photos).toHaveLength(1);
    expect(global.fetch.mock.calls.length).toBe(callCountAfterFirst);
  });

  it('searchVideos calls backend proxy', async () => {
    const mockResponse = {
      videos: [{ id: 10, duration: 15, video_files: [{ link: 'https://example.com/v.mp4' }] }],
      total_results: 1,
      page: 1,
      per_page: 1,
    };
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    });

    const result = await searchVideos({ query: 'waves', page: 1, per_page: 1 });
    expect(result.videos).toHaveLength(1);
    expect(result.videos[0].id).toBe(10);
  });

  it('getPhoto fetches by id', async () => {
    const mockResponse = { id: 5, alt: 'Mountain', width: 2000, height: 1500 };
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    });

    const result = await getPhoto(5);
    expect(result.id).toBe(5);
    const calledUrl = global.fetch.mock.calls[0][0];
    expect(calledUrl).toContain('/api/pexels/photos/5');
  });

  it('getVideo fetches by id', async () => {
    const mockResponse = { id: 8, duration: 30, video_files: [] };
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    });

    const result = await getVideo(8);
    expect(result.id).toBe(8);
  });

  it('throws on empty query', async () => {
    await expect(searchPhotos({ query: '' })).rejects.toThrow('query is required');
    await expect(searchVideos({ query: '   ' })).rejects.toThrow('query is required');
  });

  it('clearPexelsCache removes cache entries', async () => {
    sessionStorage.setItem('pexels_cache_test', JSON.stringify({ ts: Date.now(), data: {} }));
    clearPexelsCache();
    const val = sessionStorage.getItem('pexels_cache_test');
    expect(val).toBeFalsy();
  });
});
