/**
 * Repeatability / stress tests for API key persistence.
 *
 * Verifies the core guarantee: users can enter a key once and it remains
 * available through reloads, modal switches, and repeated save/clear cycles.
 */

import { describe, test, expect, beforeEach } from 'vitest';

function createStorage() {
  const store = {};
  return {
    getItem(key) { return store.hasOwnProperty(key) ? store[key] : null; },
    setItem(key, value) { store[key] = String(value); },
    removeItem(key) { delete store[key]; },
    clear() { Object.keys(store).forEach((k) => delete store[k]); },
    _raw: store,
  };
}

let ls;
let ss;
let apiKeyManager;

beforeEach(async () => {
  ls = createStorage();
  ss = createStorage();
  Object.defineProperty(globalThis, 'localStorage', { value: ls, writable: true, configurable: true });
  Object.defineProperty(globalThis, 'sessionStorage', { value: ss, writable: true, configurable: true });

  const mod = await import('../lib/apiKeyManager.js');
  apiKeyManager = mod.apiKeyManager;

  apiKeyManager._cache.muapi.key = null;
  apiKeyManager._cache.muapi.hash = null;
  apiKeyManager._cache.openai.key = null;
  apiKeyManager._cache.openai.hash = null;
  apiKeyManager._cache.videodb.key = null;
  apiKeyManager._cache.videodb.hash = null;
});

async function simulateReload(manager) {
  manager._cache.muapi.key = null;
  manager._cache.muapi.hash = null;
  manager._cache.openai.key = null;
  manager._cache.openai.hash = null;
  manager._cache.videodb.key = null;
  manager._cache.videodb.hash = null;
}

describe('API key repeatability', () => {
  test('saving and clearing all three keys 50 times via apiKeyManager', async () => {
    for (let i = 0; i < 50; i++) {
      const cyclePrefix = `cycle${i}`;

      await apiKeyManager.setMuapiKey(`sk-muapi-${cyclePrefix}`, true);
      await apiKeyManager.setOpenAIKey(`sk-openai-${cyclePrefix}`, true);
      await apiKeyManager.setVideoDBKey(`sk-videodb-${cyclePrefix}`, true);

      expect(apiKeyManager.getMuapiKey()).toBe(`sk-muapi-${cyclePrefix}`);
      expect(apiKeyManager.getOpenAIKey()).toBe(`sk-openai-${cyclePrefix}`);
      expect(apiKeyManager.getVideoDBKey()).toBe(`sk-videodb-${cyclePrefix}`);
      expect(apiKeyManager.hasAnyKey()).toBe(true);

      apiKeyManager.clearMuapiKey();
      apiKeyManager.clearOpenAIKey();
      apiKeyManager.clearVideoDBKey();

      expect(apiKeyManager.hasMuapiKey()).toBe(false);
      expect(apiKeyManager.hasOpenAIKey()).toBe(false);
      expect(apiKeyManager.hasVideoDBKey()).toBe(false);
      expect(apiKeyManager.hasAnyKey()).toBe(false);
    }
  });

  test('keys survive simulated reloads 30 times with alternating providers', async () => {
    for (let i = 0; i < 30; i++) {
      const cyclePrefix = `reload${i}`;
      const provider = i % 3;

      if (provider === 0) {
        await apiKeyManager.setMuapiKey(`sk-muapi-${cyclePrefix}`, true);
      } else if (provider === 1) {
        await apiKeyManager.setOpenAIKey(`sk-openai-${cyclePrefix}`, true);
      } else {
        await apiKeyManager.setVideoDBKey(`sk-videodb-${cyclePrefix}`, true);
      }

      await simulateReload(apiKeyManager);

      // The saved key survives reload.
      if (provider === 0) {
        expect(apiKeyManager.getMuapiKey()).toBe(`sk-muapi-${cyclePrefix}`);
      } else if (provider === 1) {
        expect(apiKeyManager.getOpenAIKey()).toBe(`sk-openai-${cyclePrefix}`);
      } else {
        expect(apiKeyManager.getVideoDBKey()).toBe(`sk-videodb-${cyclePrefix}`);
      }

      // hasAnyKey reflects the saved key.
      expect(apiKeyManager.hasAnyKey()).toBe(true);

      // Clear for next cycle.
      apiKeyManager.clearMuapiKey();
      apiKeyManager.clearOpenAIKey();
      apiKeyManager.clearVideoDBKey();
      expect(apiKeyManager.hasAnyKey()).toBe(false);
    }
  });

  test('setup modal gating flips correctly across 20 save/clear cycles', async () => {
    for (let i = 0; i < 20; i++) {
      expect(apiKeyManager.hasAnyKey()).toBe(false);
      expect(!apiKeyManager.hasAnyKey()).toBe(true);

      await apiKeyManager.setMuapiKey(`sk-gating-${i}`, true);
      expect(apiKeyManager.hasAnyKey()).toBe(true);
      expect(!apiKeyManager.hasAnyKey()).toBe(false);

      apiKeyManager.clearMuapiKey();
      expect(apiKeyManager.hasAnyKey()).toBe(false);
      expect(!apiKeyManager.hasAnyKey()).toBe(true);
    }
  });

  test('saving one provider does not leak into others across 25 cycles', async () => {
    for (let i = 0; i < 25; i++) {
      await apiKeyManager.setMuapiKey(`sk-only-muapi-${i}`, true);
      expect(apiKeyManager.hasMuapiKey()).toBe(true);
      expect(apiKeyManager.hasOpenAIKey()).toBe(false);
      expect(apiKeyManager.hasVideoDBKey()).toBe(false);

      apiKeyManager.clearMuapiKey();
      expect(apiKeyManager.hasMuapiKey()).toBe(false);
      expect(apiKeyManager.hasOpenAIKey()).toBe(false);
      expect(apiKeyManager.hasVideoDBKey()).toBe(false);
    }
  });

  test('rapid save-then-clear within the same cycle does not corrupt state', async () => {
    for (let i = 0; i < 100; i++) {
      await apiKeyManager.setMuapiKey(`sk-rapid-${i}`, true);
      apiKeyManager.clearMuapiKey();

      expect(apiKeyManager.hasMuapiKey()).toBe(false);
      expect(ls.getItem('muapi_key')).toBeNull();
      expect(ss.getItem('muapi_key')).toBeNull();
    }
  });

  test('storage failure fallback does not corrupt subsequent saves', async () => {
    // Simulate quota exceeded on the FIRST localStorage write only.
    let failOnce = true;
    const origSetItem = ls.setItem.bind(ls);
    ls.setItem = (key, value) => {
      if (failOnce && key === 'muapi_key') {
        failOnce = false;
        throw new Error('QuotaExceededError');
      }
      return origSetItem(key, value);
    };

    // First save should still keep the key in memory.
    await apiKeyManager.setMuapiKey('sk-quota-test', true);
    expect(apiKeyManager.hasMuapiKey()).toBe(true);
    expect(apiKeyManager.getMuapiKey()).toBe('sk-quota-test');

    // Subsequent saves should work normally and persist to storage.
    await apiKeyManager.setMuapiKey('sk-after-quota', true);
    expect(apiKeyManager.getMuapiKey()).toBe('sk-after-quota');
    expect(apiKeyManager.hasMuapiKey()).toBe(true);
  });
});
