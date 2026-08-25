/**
 * Tests for the unified generation-history module.
 *
 * Verifies:
 * - saveGeneration writes to the correct localStorage key based on content type
 * - saveGeneration normalizes studio types correctly
 * - saveGeneration stores request_id for webhook correlation
 * - saveGeneration respects max history limit
 * - deleteGeneration removes entries by URL from the correct localStorage key
 * - loadGenerationHistory merges localStorage entries
 * - loadGenerationHistory gracefully falls back to localStorage-only when
 *   Supabase is not configured or returns errors
 * - loadGenerationHistory deduplicates by URL, preferring cloud entries
 */

import { describe, test, expect, beforeEach, vi } from 'vitest';

// --- Real localStorage fake ---
function createStorage() {
  const store = {};
  return {
    getItem(key) {
      return Object.prototype.hasOwnProperty.call(store, key) ? store[key] : null;
    },
    setItem(key, value) {
      store[key] = String(value);
    },
    removeItem(key) {
      delete store[key];
    },
    clear() {
      Object.keys(store).forEach((k) => delete store[k]);
    },
    _raw: store,
  };
}

let ls;

// --- Module mocks ---
vi.mock('../lib/supabase.js', () => ({
  isSupabaseConfigured: vi.fn(() => true),
  getSupabaseUrl: vi.fn(() => 'https://test.supabase.co'),
  getUserKey: vi.fn(() => 'test_user_key'),
}));

// --- Global fetch mock (for Supabase Edge Function calls) ---
const fetchMock = vi.fn();
globalThis.fetch = fetchMock;

// --- Import after mocks are set up ---
let { saveGeneration, deleteGeneration, loadGenerationHistory } = await import('../lib/generationHistory.js');

beforeEach(async () => {
  ls = createStorage();
  Object.defineProperty(globalThis, 'localStorage', { value: ls, configurable: true, writable: true });

  fetchMock.mockReset();
  fetchMock.mockResolvedValue({
    ok: true,
    json: () => Promise.resolve({ data: [] }),
  });

  // Re-import to get fresh module state with mocked deps
  const mod = await import('../lib/generationHistory.js');
  saveGeneration = mod.saveGeneration;
  deleteGeneration = mod.deleteGeneration;
  loadGenerationHistory = mod.loadGenerationHistory;
});

describe('saveGeneration', () => {
  test('writes image generations to muapi_history localStorage key', () => {
    const entry = saveGeneration({
      studio: 'image',
      type: 'image',
      url: 'https://example.com/image.png',
      prompt: 'A beautiful sunset',
      model: 'flux-dev',
    });

    expect(entry.url).toBe('https://example.com/image.png');

    const history = JSON.parse(ls.getItem('muapi_history'));
    expect(history).toHaveLength(1);
    expect(history[0].url).toBe('https://example.com/image.png');
    expect(history[0].studio).toBe('image');
    expect(history[0].type).toBe('image');
  });

  test('writes video generations to video_history localStorage key', () => {
    saveGeneration({
      studio: 'video',
      type: 'video',
      url: 'https://example.com/video.mp4',
      prompt: 'A dancing cat',
      model: 'ltx-video',
    });

    const history = JSON.parse(ls.getItem('video_history'));
    expect(history).toHaveLength(1);
    expect(history[0].type).toBe('video');
  });

  test('normalizes studio type "template" to "image"', () => {
    const entry = saveGeneration({
      studio: 'template',
      type: 'image',
      url: 'https://example.com/img.jpg',
      prompt: 'Portrait',
      model: 'flux-schnell',
    });

    expect(entry.studio).toBe('image');
  });

  test('normalizes studio type "effects" to "effects"', () => {
    const entry = saveGeneration({
      studio: 'effects',
      type: 'video',
      url: 'https://example.com/vid.mp4',
      prompt: 'zoom effect',
      model: 'wan',
    });

    expect(entry.studio).toBe('effects');
  });

  test('stores request_id for webhook correlation', () => {
    const entry = saveGeneration({
      studio: 'image',
      type: 'image',
      url: 'https://example.com/img.jpg',
      prompt: 'Test',
      model: 'flux',
      request_id: 'req_12345',
    });

    expect(entry.request_id).toBe('req_12345');
  });

  test('skips save when url is missing', () => {
    const result = saveGeneration({
      studio: 'image',
      prompt: 'No URL',
    });

    expect(result).toBeNull();
    expect(ls.getItem('muapi_history')).toBeNull();
  });

  test('respects max history limit of 100', () => {
    for (let i = 0; i < 150; i++) {
      saveGeneration({
        studio: 'image',
        type: 'image',
        url: `https://example.com/img_${i}.png`,
        prompt: `Prompt ${i}`,
      });
    }

    const history = JSON.parse(ls.getItem('muapi_history'));
    expect(history).toHaveLength(100);
    // Most recent should be first
    expect(history[0].url).toBe('https://example.com/img_149.png');
  });

  test('preserves extra metadata fields in the entry', () => {
    const entry = saveGeneration({
      studio: 'cinema',
      type: 'image',
      url: 'https://example.com/cinema.jpg',
      prompt: 'Cinematic scene',
      model: 'flux-cinematic',
      template_id: 'template_abc',
      aspect_ratio: '21:9',
    });

    expect(entry.template_id).toBe('template_abc');
    expect(entry.aspect_ratio).toBe('21:9');
  });

  test('triggers fire-and-forget Supabase save via fetch', async () => {
    saveGeneration({
      studio: 'image',
      type: 'image',
      url: 'https://example.com/img.png',
      prompt: 'Test',
      model: 'flux',
    });

    // Allow microtasks to flush
    await new Promise((r) => setTimeout(r, 10));

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://test.supabase.co/functions/v1/generation-history',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ 'x-user-key': 'test_user_key' }),
      })
    );
  });
});

describe('deleteGeneration', () => {
  test('removes entry by URL from image history', () => {
    saveGeneration({ studio: 'image', type: 'image', url: 'https://a.com/1.png', prompt: 'A' });
    saveGeneration({ studio: 'image', type: 'image', url: 'https://a.com/2.png', prompt: 'B' });
    saveGeneration({ studio: 'image', type: 'image', url: 'https://a.com/3.png', prompt: 'C' });

    deleteGeneration('https://a.com/2.png', 'image');

    const history = JSON.parse(ls.getItem('muapi_history'));
    expect(history).toHaveLength(2);
    expect(history.find((h) => h.url === 'https://a.com/2.png')).toBeUndefined();
  });

  test('removes entry by URL from video history', () => {
    saveGeneration({ studio: 'video', type: 'video', url: 'https://a.com/v1.mp4', prompt: 'V1' });
    saveGeneration({ studio: 'video', type: 'video', url: 'https://a.com/v2.mp4', prompt: 'V2' });

    deleteGeneration('https://a.com/v1.mp4', 'video');

    const history = JSON.parse(ls.getItem('video_history'));
    expect(history).toHaveLength(1);
    expect(history[0].url).toBe('https://a.com/v2.mp4');
  });
});

describe('loadGenerationHistory', () => {
  test('returns merged entries from localStorage', async () => {
    saveGeneration({ studio: 'image', type: 'image', url: 'https://a.com/1.png', prompt: 'Image 1' });
    saveGeneration({ studio: 'video', type: 'video', url: 'https://b.com/1.mp4', prompt: 'Video 1' });

    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ data: [] }),
    });

    const results = await loadGenerationHistory();

    expect(results).toHaveLength(2);
    const types = results.map((r) => r.type);
    expect(types).toContain('image');
    expect(types).toContain('video');
  });

  test('falls back to localStorage when Supabase returns errors', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      json: () => Promise.resolve({ error: 'auth failed' }),
    });

    saveGeneration({ studio: 'image', type: 'image', url: 'https://a.com/fallback.png', prompt: 'Fallback test' });

    const results = await loadGenerationHistory();

    expect(results).toHaveLength(1);
    expect(results[0].url).toBe('https://a.com/fallback.png');
    expect(results[0].source).toBe('local');
  });

  test('merges cloud and local, deduplicating by URL', async () => {
    saveGeneration({ studio: 'image', type: 'image', url: 'https://a.com/shared.png', prompt: 'Shared local' });
    saveGeneration({ studio: 'image', type: 'image', url: 'https://b.com/local.png', prompt: 'Local only' });

    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        data: [
          {
            id: 'cloud-1',
            output_url: 'https://a.com/shared.png',
            prompt: 'Shared (cloud enriched)',
            model_name: 'flux-dev',
            studio_type: 'image',
            generation_type: 'image',
            created_at: new Date().toISOString(),
            parameters: { muapi_request_id: 'req_abc' },
            thumbnail_url: 'https://a.com/shared.png',
          },
          {
            id: 'cloud-2',
            output_url: 'https://c.com/cloud.png',
            prompt: 'Cloud only',
            model_name: 'sdxl',
            studio_type: 'image',
            generation_type: 'image',
            created_at: new Date().toISOString(),
            parameters: {},
            thumbnail_url: 'https://c.com/cloud.png',
          },
        ],
      }),
    });

    const results = await loadGenerationHistory();

    expect(results).toHaveLength(3);
    // Cloud should take priority for shared URL
    const shared = results.find((r) => r.url === 'https://a.com/shared.png');
    expect(shared.source).toBe('cloud');
    expect(shared.prompt).toBe('Shared (cloud enriched)');
  });

  test('sorts results by timestamp descending', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ data: [] }),
    });

    saveGeneration({ studio: 'image', type: 'image', url: 'https://a.com/old.png', prompt: 'Old', timestamp: '2025-01-01T00:00:00.000Z' });
    saveGeneration({ studio: 'image', type: 'image', url: 'https://a.com/new.png', prompt: 'New', timestamp: '2025-06-01T00:00:00.000Z' });

    const results = await loadGenerationHistory();

    expect(results[0].prompt).toBe('New');
    expect(results[1].prompt).toBe('Old');
  });
});
