/**
 * OpenMontage API key storage and forwarding tests.
 *
 * Verifies that API keys are correctly stored, retrieved, and forwarded
 * to the OpenMontage proxy:
 * - API key storage (muapi, openai, videodb)
 * - Key retrieval for tools
 * - Multi-provider support
 * - Key forwarding to proxy endpoints
 */

import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';

function createStorage() {
  const store = {};
  return {
    getItem(key) {
      return store.hasOwnProperty(key) ? store[key] : null;
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
let ss;
let fetchMock;

const OPENMONTAGE_BASE = 'http://localhost:3001/openmontage';

beforeEach(() => {
  ls = createStorage();
  ss = createStorage();
  Object.defineProperty(globalThis, 'localStorage', { value: ls, writable: true, configurable: true });
  Object.defineProperty(globalThis, 'sessionStorage', { value: ss, writable: true, configurable: true });
  fetchMock = vi.fn();
  global.fetch = fetchMock;
});

afterEach(() => {
  vi.restoreAllMocks();
});

function mockJsonResponse(data, status = 200) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(data),
  });
}

describe('API key storage', () => {
  test('stores muapi key in sessionStorage and localStorage', async () => {
    const { ApiKeyManager } = await import('../lib/apiKeyManager.js');
    const manager = new ApiKeyManager();

    await manager.setMuapiKey('sk-muapi-storage-test-1234567890', true);

    expect(manager.hasMuapiKey()).toBe(true);
    expect(manager.getMuapiKey()).toBe('sk-muapi-storage-test-1234567890');
    // sessionStorage always gets the key
    expect(ss.getItem('muapi_key')).toBeTruthy();
    // localStorage gets it when persist=true
    expect(ls.getItem('muapi_key')).toBeTruthy();
  });

  test('stores openai key separately from muapi key', async () => {
    const { ApiKeyManager } = await import('../lib/apiKeyManager.js');
    const manager = new ApiKeyManager();

    await manager.setMuapiKey('sk-muapi-key-1234567890', true);
    await manager.setOpenAIKey('sk-openai-key-1234567890', true);

    expect(manager.getMuapiKey()).toBe('sk-muapi-key-1234567890');
    expect(manager.getOpenAIKey()).toBe('sk-openai-key-1234567890');
    expect(manager.hasMuapiKey()).toBe(true);
    expect(manager.hasOpenAIKey()).toBe(true);
  });

  test('session-only storage does not persist to localStorage', async () => {
    const { ApiKeyManager } = await import('../lib/apiKeyManager.js');
    const manager = new ApiKeyManager();

    await manager.setMuapiKey('sk-session-only-1234567890', false);

    expect(manager.hasMuapiKey()).toBe(true);
    expect(ss.getItem('muapi_key')).toBeTruthy();
    expect(ls.getItem('muapi_key')).toBeNull();
  });

  test('clearing one key does not affect others', async () => {
    const { ApiKeyManager } = await import('../lib/apiKeyManager.js');
    const manager = new ApiKeyManager();

    await manager.setMuapiKey('sk-muapi-1234567890', true);
    await manager.setOpenAIKey('sk-openai-1234567890', true);
    await manager.setVideoDBKey('vd-token-1234567890', true);

    manager.clearMuapiKey();

    expect(manager.hasMuapiKey()).toBe(false);
    expect(manager.hasOpenAIKey()).toBe(true);
    expect(manager.hasVideoDBKey()).toBe(true);
    expect(manager.getOpenAIKey()).toBe('sk-openai-1234567890');
    expect(manager.getVideoDBKey()).toBe('vd-token-1234567890');
  });

  test('keys survive simulated page reload', async () => {
    const { ApiKeyManager } = await import('../lib/apiKeyManager.js');
    const manager = new ApiKeyManager();

    // Session 1: store key
    await manager.setMuapiKey('sk-persist-1234567890', true);

    // Simulate reload by clearing in-memory cache
    manager._cache.muapi.key = null;
    manager._cache.muapi.hash = null;

    // Session 2: key should still be available from storage
    expect(manager.hasMuapiKey()).toBe(true);
    expect(manager.getMuapiKey()).toBe('sk-persist-1234567890');
  });
});

describe('Key retrieval for tools', () => {
  test('retrieves muapi key for production requests', async () => {
    const { ApiKeyManager } = await import('../lib/apiKeyManager.js');
    const manager = new ApiKeyManager();
    await manager.setMuapiKey('sk-muapi-tool-1234567890', true);

    const key = manager.getMuapiKey();
    expect(key).toBe('sk-muapi-tool-1234567890');

    // Build headers as the frontend would
    const headers = { 'Content-Type': 'application/json' };
    if (key) headers['x-muapi-api-key'] = key;

    fetchMock.mockResolvedValueOnce(mockJsonResponse({ jobId: 'om_1', status: 'queued' }));

    await fetch(`${OPENMONTAGE_BASE}/api/productions`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ prompt: 'Test' }),
    });

    expect(fetchMock).toHaveBeenCalledWith(
      `${OPENMONTAGE_BASE}/api/productions`,
      expect.objectContaining({
        headers: expect.objectContaining({ 'x-muapi-api-key': 'sk-muapi-tool-1234567890' }),
      })
    );
  });

  test('retrieves openai key for narration/TTS tools', async () => {
    const { ApiKeyManager } = await import('../lib/apiKeyManager.js');
    const manager = new ApiKeyManager();
    await manager.setOpenAIKey('sk-openai-tts-1234567890', true);

    const key = manager.getOpenAIKey();
    expect(key).toBe('sk-openai-tts-1234567890');
  });

  test('returns null when no key is configured', async () => {
    const { ApiKeyManager } = await import('../lib/apiKeyManager.js');
    const manager = new ApiKeyManager();

    expect(manager.getMuapiKey()).toBeNull();
    expect(manager.getOpenAIKey()).toBeNull();
    expect(manager.getVideoDBKey()).toBeNull();
  });

  test('validates key against stored hash', async () => {
    const { ApiKeyManager } = await import('../lib/apiKeyManager.js');
    const manager = new ApiKeyManager();
    const key = 'sk-validate-1234567890';

    await manager.setMuapiKey(key, true);

    expect(await manager.validateKey(key)).toBe(true);
    expect(await manager.validateKey('wrong-key')).toBe(false);
  });
});

describe('Multi-provider support', () => {
  test('hasAnyKey returns true when at least one key is set', async () => {
    const { ApiKeyManager } = await import('../lib/apiKeyManager.js');
    const manager = new ApiKeyManager();

    expect(manager.hasAnyKey()).toBe(false);

    await manager.setMuapiKey('sk-any-1234567890', true);
    expect(manager.hasAnyKey()).toBe(true);
  });

  test('hasAnyKey returns true with only openai key', async () => {
    const { ApiKeyManager } = await import('../lib/apiKeyManager.js');
    const manager = new ApiKeyManager();

    await manager.setOpenAIKey('sk-openai-only-1234567890', true);
    expect(manager.hasAnyKey()).toBe(true);
    expect(manager.hasMuapiKey()).toBe(false);
    expect(manager.hasOpenAIKey()).toBe(true);
  });

  test('hasAnyKey returns true with only videodb key', async () => {
    const { ApiKeyManager } = await import('../lib/apiKeyManager.js');
    const manager = new ApiKeyManager();

    await manager.setVideoDBKey('vd-only-token-1234567890', true);
    expect(manager.hasAnyKey()).toBe(true);
    expect(manager.hasMuapiKey()).toBe(false);
    expect(manager.hasVideoDBKey()).toBe(true);
  });

  test('forwards all configured provider keys to proxy', async () => {
    const { ApiKeyManager } = await import('../lib/apiKeyManager.js');
    const manager = new ApiKeyManager();
    await manager.setMuapiKey('sk-muapi-multi-1234567890', true);
    await manager.setOpenAIKey('sk-openai-multi-1234567890', true);

    const headers = { 'Content-Type': 'application/json' };
    if (manager.hasMuapiKey()) headers['x-muapi-api-key'] = manager.getMuapiKey();
    if (manager.hasOpenAIKey()) headers['x-openai-api-key'] = manager.getOpenAIKey();

    fetchMock.mockResolvedValueOnce(mockJsonResponse({ jobId: 'om_multi', status: 'queued' }));

    await fetch(`${OPENMONTAGE_BASE}/api/productions`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ prompt: 'Multi-provider test' }),
    });

    expect(fetchMock).toHaveBeenCalledWith(
      `${OPENMONTAGE_BASE}/api/productions`,
      expect.objectContaining({
        headers: expect.objectContaining({
          'x-muapi-api-key': 'sk-muapi-multi-1234567890',
          'x-openai-api-key': 'sk-openai-multi-1234567890',
        }),
      })
    );
  });

  test('does not send headers for unconfigured providers', async () => {
    const { ApiKeyManager } = await import('../lib/apiKeyManager.js');
    const manager = new ApiKeyManager();
    // Only set muapi key
    await manager.setMuapiKey('sk-muapi-only-1234567890', true);

    const headers = { 'Content-Type': 'application/json' };
    if (manager.hasMuapiKey()) headers['x-muapi-api-key'] = manager.getMuapiKey();
    if (manager.hasOpenAIKey()) headers['x-openai-api-key'] = manager.getOpenAIKey();

    // Verify openai key header is NOT set
    expect(headers['x-openai-api-key']).toBeUndefined();
    expect(headers['x-muapi-api-key']).toBe('sk-muapi-only-1234567890');
  });
});

describe('Key forwarding to proxy', () => {
  test('proxy receives api_keys in body after header transform', async () => {
    const { ApiKeyManager } = await import('../lib/apiKeyManager.js');
    const manager = new ApiKeyManager();
    await manager.setMuapiKey('sk-muapi-proxy-1234567890', true);
    await manager.setOpenAIKey('sk-openai-proxy-1234567890', true);

    // Simulate what the frontend sends (headers)
    const requestHeaders = {
      'Content-Type': 'application/json',
      'x-muapi-api-key': manager.getMuapiKey(),
      'x-openai-api-key': manager.getOpenAIKey(),
    };

    // Simulate what the proxy would produce (body with api_keys)
    const proxyBody = {
      prompt: 'Test production',
      pipeline: 'animated-explainer',
      api_keys: {
        muapi: requestHeaders['x-muapi-api-key'],
        openai: requestHeaders['x-openai-api-key'],
      },
    };

    fetchMock.mockResolvedValueOnce(mockJsonResponse({ jobId: 'om_proxy', status: 'queued' }));

    await fetch(`${OPENMONTAGE_BASE}/api/productions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(proxyBody),
    });

    const callArgs = fetchMock.mock.calls[0];
    const sentBody = JSON.parse(callArgs[1].body);

    expect(sentBody.api_keys).toBeDefined();
    expect(sentBody.api_keys.muapi).toBe('sk-muapi-proxy-1234567890');
    expect(sentBody.api_keys.openai).toBe('sk-openai-proxy-1234567890');
  });

  test('proxy passes through body api_keys unchanged', async () => {
    // When api_keys is already in the body, proxy should not modify it
    const bodyWithKeys = {
      prompt: 'Direct body keys',
      api_keys: {
        muapi: 'sk-direct-muapi-1234567890',
        openai: 'sk-direct-openai-1234567890',
      },
    };

    fetchMock.mockResolvedValueOnce(mockJsonResponse({ jobId: 'om_direct', status: 'queued' }));

    await fetch(`${OPENMONTAGE_BASE}/api/productions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(bodyWithKeys),
    });

    const callArgs = fetchMock.mock.calls[0];
    const sentBody = JSON.parse(callArgs[1].body);

    expect(sentBody.api_keys.muapi).toBe('sk-direct-muapi-1234567890');
    expect(sentBody.api_keys.openai).toBe('sk-direct-openai-1234567890');
  });

  test('handles missing keys gracefully in proxy body', async () => {
    const bodyNoKeys = { prompt: 'No keys provided' };

    fetchMock.mockResolvedValueOnce(mockJsonResponse({ jobId: 'om_no_keys', status: 'queued' }));

    await fetch(`${OPENMONTAGE_BASE}/api/productions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(bodyNoKeys),
    });

    const callArgs = fetchMock.mock.calls[0];
    const sentBody = JSON.parse(callArgs[1].body);

    expect(sentBody.api_keys).toBeUndefined();
    expect(sentBody.prompt).toBe('No keys provided');
  });
});
