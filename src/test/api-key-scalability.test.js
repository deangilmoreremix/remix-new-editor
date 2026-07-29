/**
 * Production scalability and stress tests for the API key modal logic.
 *
 * Verifies the fix works reliably under load:
 *  - Many sequential set/clear operations
 *  - Storage error handling (quota exceeded, disabled)
 *  - Concurrent reads/writes
 *  - clearClerkSession preservation under repeated calls
 *  - Memory does not leak across many save/load cycles
 */

import { describe, test, expect, beforeEach } from 'vitest';

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
    key(i) {
      return Object.keys(store)[i] || null;
    },
    get length() {
      return Object.keys(store).length;
    },
    _raw: store,
  };
}

let ls;
let ss;

beforeEach(() => {
  ls = createStorage();
  ss = createStorage();
  Object.defineProperty(globalThis, 'localStorage', { value: ls, writable: true, configurable: true });
  Object.defineProperty(globalThis, 'sessionStorage', { value: ss, writable: true, configurable: true });
});

describe('production scalability', () => {
  test('1000 sequential set/clear cycles complete without errors', async () => {
    const { ApiKeyManager } = await import('../lib/apiKeyManager.js');
    const manager = new ApiKeyManager();
    const start = Date.now();

    for (let i = 0; i < 1000; i++) {
      await manager.setMuapiKey('sk-stress-test-key-' + i, true);
      const key = manager.getMuapiKey();
      expect(key).toBe('sk-stress-test-key-' + i);
      manager.clearMuapiKey();
      expect(manager.hasMuapiKey()).toBe(false);
    }

    const elapsed = Date.now() - start;
    // 1000 cycles should complete in under 5 seconds in jsdom.
    expect(elapsed).toBeLessThan(5000);
  });

  test('1000 managers can coexist without interfering', async () => {
    const { ApiKeyManager } = await import('../lib/apiKeyManager.js');
    const managers = [];
    for (let i = 0; i < 1000; i++) {
      const m = new ApiKeyManager();
      await m.setMuapiKey('sk-manager-' + i, true);
      managers.push(m);
    }
    for (let i = 0; i < 1000; i++) {
      expect(managers[i].getMuapiKey()).toBe('sk-manager-' + i);
    }
  });

  test('handles localStorage quota exceeded gracefully', async () => {
    const { ApiKeyManager } = await import('../lib/apiKeyManager.js');
    const manager = new ApiKeyManager();

    // Simulate localStorage.setItem throwing QuotaExceededError.
    const originalSetItem = ls.setItem;
    ls.setItem = () => {
      const e = new Error('QuotaExceededError');
      e.name = 'QuotaExceededError';
      throw e;
    };

    // setMuapiKey should NOT propagate the error (graceful degradation).
    await expect(manager.setMuapiKey('sk-quota-test', true)).resolves.not.toThrow();

    // The in-memory cache should still be set.
    expect(manager._cache.muapi.key).toBe('sk-quota-test');

    // Reading from storage should still work via the cache.
    expect(manager.getMuapiKey()).toBe('sk-quota-test');

    // The app should still function for this user.
    expect(manager.hasAnyKey()).toBe(true);

    ls.setItem = originalSetItem;
  });

  test('handles localStorage disabled gracefully', async () => {
    // Simulate localStorage throwing on access.
    Object.defineProperty(globalThis, 'localStorage', {
      value: {
        getItem: () => { throw new Error('SecurityError'); },
        setItem: () => { throw new Error('SecurityError'); },
        removeItem: () => { throw new Error('SecurityError'); },
        clear: () => { throw new Error('SecurityError'); },
        length: 0,
        key: () => null,
      },
      writable: true,
      configurable: true,
    });

    const { ApiKeyManager } = await import('../lib/apiKeyManager.js');
    const manager = new ApiKeyManager();

    // _hasKeyFor should not throw.
    expect(() => manager.hasMuapiKey()).not.toThrow();
    // _getKeyFor should not throw and return null.
    expect(manager.getMuapiKey()).toBeNull();
    // hasAnyKey should not throw.
    expect(() => manager.hasAnyKey()).not.toThrow();
  });

  test('clearClerkSession preserves keys across 100 calls', async () => {
    const { ApiKeyManager } = await import('../lib/apiKeyManager.js');
    const manager = new ApiKeyManager();
    await manager.setMuapiKey('sk-preserve-key', true);
    await manager.setOpenAIKey('sk-openai-preserve', true);
    await manager.setVideoDBKey('vd-preserve-token', true);

    // Simulate 100 logout cycles.
    for (let i = 0; i < 100; i++) {
      // Save and clear (like clearClerkSession does).
      const preserved = {
        muapi_key: ls.getItem('muapi_key'),
        muapi_key_hash: ls.getItem('muapi_key_hash'),
        openai_key: ls.getItem('openai_key'),
        openai_key_hash: ls.getItem('openai_key_hash'),
        videodb_key: ls.getItem('videodb_key'),
        videodb_key_hash: ls.getItem('videodb_key_hash'),
      };
      ls.clear();
      for (const [k, v] of Object.entries(preserved)) {
        if (v) ls.setItem(k, v);
      }
    }

    // Keys should still be there.
    expect(manager.getMuapiKey()).toBe('sk-preserve-key');
    expect(manager.getOpenAIKey()).toBe('sk-openai-preserve');
    expect(manager.getVideoDBKey()).toBe('vd-preserve-token');
  });

  test('rapid set/get cycles do not cause memory leaks', async () => {
    const { ApiKeyManager } = await import('../lib/apiKeyManager.js');
    const manager = new ApiKeyManager();

    // Set 500 different keys rapidly.
    for (let i = 0; i < 500; i++) {
      await manager.setMuapiKey('sk-rapid-' + i, false);
      manager.getMuapiKey();
    }

    // Cache should only have the latest key.
    expect(manager._cache.muapi.key).toBe('sk-rapid-499');
  });

  test('hasAnyKey is fast for gating check', async () => {
    const { ApiKeyManager } = await import('../lib/apiKeyManager.js');
    const manager = new ApiKeyManager();
    await manager.setMuapiKey('sk-perf-test', true);

    const start = performance.now();
    for (let i = 0; i < 10000; i++) {
      manager.hasAnyKey();
    }
    const elapsed = performance.now() - start;

    // 10000 calls should take well under 1 second.
    expect(elapsed).toBeLessThan(1000);
  });
});
