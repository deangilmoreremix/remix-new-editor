/**
 * @vitest-environment node
 */

import { describe, test, expect, vi, beforeEach } from 'vitest';
import { apiCall } from '../lib/brandApi.js';

describe('brandApi user MuAPI key forwarding', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  test('sends X-User-Muapi-Key header when a user key is set', async () => {
    const mockKey = 'fcd5a2fb05a2f8adc74a221aa47fb963e45286f177bada5ea69f65e0095186ac';

    const mockModule = await import('../lib/apiKeyManager.js');
    const originalGetMuapiKey = mockModule.apiKeyManager.getMuapiKey.bind(mockModule.apiKeyManager);
    mockModule.apiKeyManager.getMuapiKey = vi.fn(() => mockKey);

    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ ok: true, data: { id: 'brand-123' } }),
    });

    await apiCall('/api/brand/extract', { url: 'https://example.com' });

    const fetchCall = global.fetch.mock.calls[0];
    expect(fetchCall).toBeTruthy();
    expect(fetchCall[1].headers['X-User-Muapi-Key']).toBe(mockKey);

    mockModule.apiKeyManager.getMuapiKey = originalGetMuapiKey;
  });

  test('does not send X-User-Muapi-Key header when no user key is set', async () => {
    const mockModule = await import('../lib/apiKeyManager.js');
    const originalGetMuapiKey = mockModule.apiKeyManager.getMuapiKey.bind(mockModule.apiKeyManager);
    mockModule.apiKeyManager.getMuapiKey = vi.fn(() => null);

    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ ok: true, data: { id: 'brand-123' } }),
    });

    await apiCall('/api/brand/extract', { url: 'https://example.com' });

    const fetchCall = global.fetch.mock.calls[0];
    expect(fetchCall).toBeTruthy();
    expect(fetchCall[1].headers['X-User-Muapi-Key']).toBeUndefined();

    mockModule.apiKeyManager.getMuapiKey = originalGetMuapiKey;
  });

  test('retries with the user key on transient failures', async () => {
    const mockKey = 'fcd5a2fb05a2f8adc74a221aa47fb963e45286f177bada5ea69f65e0095186ac';

    const mockModule = await import('../lib/apiKeyManager.js');
    const originalGetMuapiKey = mockModule.apiKeyManager.getMuapiKey.bind(mockModule.apiKeyManager);
    mockModule.apiKeyManager.getMuapiKey = vi.fn(() => mockKey);

    global.fetch = vi.fn()
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ ok: true, data: { id: 'brand-123' } }),
      });

    await apiCall('/api/brand/extract', { url: 'https://example.com' });

    expect(global.fetch).toHaveBeenCalledTimes(2);
    const firstCallHeaders = global.fetch.mock.calls[0][1].headers;
    const secondCallHeaders = global.fetch.mock.calls[1][1].headers;
    expect(firstCallHeaders['X-User-Muapi-Key']).toBe(mockKey);
    expect(secondCallHeaders['X-User-Muapi-Key']).toBe(mockKey);

    mockModule.apiKeyManager.getMuapiKey = originalGetMuapiKey;
  });
});
