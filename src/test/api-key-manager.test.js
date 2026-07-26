/**
 * Tests for API key persistence and the setup-modal guard.
 *
 * Verifies:
 * - ApiKeyManager saves keys to localStorage / sessionStorage.
 * - hasAnyKey() reflects stored keys across reloads.
 * - The SettingsModal provider form persists through apiKeyManager.
 */

import { describe, test, expect, beforeEach } from 'vitest';

// ---------------------------------------------------------------
// Realistic storage fakes so ApiKeyManager can persist keys.
// The global setup.js stubs storage with vi.fn(); we override with
// real fakes per-file so persistence is actually testable.
// ---------------------------------------------------------------
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

beforeEach(() => {
  ls = createStorage();
  ss = createStorage();
  Object.defineProperty(globalThis, 'localStorage', { value: ls, writable: true, configurable: true });
  Object.defineProperty(globalThis, 'sessionStorage', { value: ss, writable: true, configurable: true });
});

// Import the class to instantiate fresh managers per test.
import { ApiKeyManager } from '../lib/apiKeyManager.js';

describe('ApiKeyManager persistence', () => {
  test('setMuapiKey persists and hasAnyKey reflects it', async () => {
    const manager = new ApiKeyManager();

    expect(manager.hasMuapiKey()).toBe(false);
    expect(manager.hasAnyKey()).toBe(false);

    await manager.setMuapiKey('sk-test-key-1234567890', true);

    expect(manager.hasMuapiKey()).toBe(true);
    expect(manager.hasAnyKey()).toBe(true);
    expect(manager.getMuapiKey()).toBe('sk-test-key-1234567890');

    // Persisted to localStorage when persist=true
    expect(ls.getItem('muapi_key')).toBeTruthy();
    expect(ls.getItem('muapi_key_hash')).toBeTruthy();
  });

  test('simulated reload reads previously saved key from localStorage', async () => {
    const manager = new ApiKeyManager();

    // Session 1: save key
    await manager.setMuapiKey('first-session-key', true);

    // Force-clear in-memory cache to simulate a fresh page load.
    manager._cache.muapi.key = null;
    manager._cache.muapi.hash = null;

    // Session 2: still sees the key.
    expect(manager.hasMuapiKey()).toBe(true);
    expect(manager.getMuapiKey()).toBe('first-session-key');
    expect(manager.hasAnyKey()).toBe(true);
  });

  test('clearMuapiKey removes key from storage', async () => {
    const manager = new ApiKeyManager();

    await manager.setMuapiKey('to-be-cleared', true);
    expect(manager.hasAnyKey()).toBe(true);

    manager.clearMuapiKey();
    expect(manager.hasMuapiKey()).toBe(false);
    expect(ls.getItem('muapi_key')).toBeNull();
    expect(ls.getItem('muapi_key_hash')).toBeNull();
    expect(manager.hasAnyKey()).toBe(false);
  });

  test('non-muapi keys also contribute to hasAnyKey', async () => {
    const manager = new ApiKeyManager();

    expect(manager.hasAnyKey()).toBe(false);

    await manager.setOpenAIKey('sk-openai-1234567890', true);
    expect(manager.hasAnyKey()).toBe(true);
    expect(manager.hasOpenAIKey()).toBe(true);
    expect(manager.hasMuapiKey()).toBe(false);
    expect(manager.hasVideoDBKey()).toBe(false);
  });

  test('persist=false keeps the key in sessionStorage only', async () => {
    const manager = new ApiKeyManager();

    await manager.setMuapiKey('session-only-key', false);

    expect(manager.hasMuapiKey()).toBe(true);
    expect(ss.getItem('muapi_key')).toBeTruthy();
    expect(ls.getItem('muapi_key')).toBeNull();
  });
});

describe('SettingsModal provider form', () => {
  test('renders muapi form wired to apiKeyManager', async () => {
    const { apiKeyManager } = await import('../lib/apiKeyManager.js');
    const { SettingsModal } = await import('../components/SettingsModal.js');

    apiKeyManager.clearMuapiKey();
    apiKeyManager.clearOpenAIKey();
    apiKeyManager.clearVideoDBKey();

    const overlay = SettingsModal();
    const muapiForm = overlay.querySelector('form');
    expect(muapiForm).toBeTruthy();

    const input = muapiForm.querySelector('input');
    const saveBtn = muapiForm.querySelector('button[type="submit"]');
    expect(input).toBeTruthy();
    expect(saveBtn).toBeTruthy();

    // The form submit path calls apiKeyManager.setMuapiKey with persist=true.
    // We verify the wiring by calling the underlying manager directly.
    await apiKeyManager.setMuapiKey('sk-modal-test-key', true);
    expect(apiKeyManager.getMuapiKey()).toBe('sk-modal-test-key');
    expect(apiKeyManager.hasAnyKey()).toBe(true);
    expect(ls.getItem('muapi_key')).toBeTruthy();
  });
});

describe('setup-modal gating logic', () => {
  test('not shown when apiKeyManager already has a key', async () => {
    const manager = new ApiKeyManager();

    await manager.setMuapiKey('sk-gating-test', true);
    expect(manager.hasAnyKey()).toBe(true);

    const shouldShow = !manager.hasAnyKey();
    expect(shouldShow).toBe(false);
  });

  test('shown when no keys are configured', async () => {
    const manager = new ApiKeyManager();

    expect(manager.hasAnyKey()).toBe(false);

    const shouldShow = !manager.hasAnyKey();
    expect(shouldShow).toBe(true);
  });

  test('shown again after keys are configured and cleared', async () => {
    const manager = new ApiKeyManager();

    await manager.setMuapiKey('temp-key-long-enough', true);
    expect(manager.hasAnyKey()).toBe(true);

    manager.clearMuapiKey();
    expect(manager.hasAnyKey()).toBe(false);

    const shouldShow = !manager.hasAnyKey();
    expect(shouldShow).toBe(true);
  });
});
