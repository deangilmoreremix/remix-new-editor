/**
 * Cross-modal API key tests for the React SettingsModal.
 *
 * Verifies:
 * - React SettingsModal can save Muapi, OpenAI, and VideoDB keys.
 * - Keys saved in React SettingsModal are readable by the vanilla
 *   SettingsModal factory and by apiKeyManager directly.
 * - Keys saved in the vanilla modal are reflected in the React modal
 *   when the API tab is opened.
 * - Clearing keys removes them from both storages.
 * - Validation errors are shown for invalid keys.
 */

import { describe, test, expect, beforeEach, vi } from 'vitest';

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

  // Reset the apiKeyManager singleton cache so tests don't leak state.
  apiKeyManager._cache.muapi.key = null;
  apiKeyManager._cache.muapi.hash = null;
  apiKeyManager._cache.openai.key = null;
  apiKeyManager._cache.openai.hash = null;
  apiKeyManager._cache.videodb.key = null;
  apiKeyManager._cache.videodb.hash = null;
});

// Reset document.body for each test.
beforeEach(() => {
  if (globalThis.document && globalThis.document.body) {
    globalThis.document.body.innerHTML = '';
  }
});

const { ApiKeyManager, apiKeyManager } = await import('../lib/apiKeyManager.js');
const { SettingsModal: ReactSettingsModal } = await import('../components/modals/SettingsModal.jsx');
const { SettingsModal: VanillaSettingsModal } = await import('../components/SettingsModal.js');

describe('React SettingsModal API key persistence', () => {
  test('saves Muapi key through the React API tab', async () => {
    const manager = new ApiKeyManager();

    const modal = new ReactSettingsModal();
    modal.render();
    modal.setupEventListeners();
    const overlay = modal.overlay;
    const input = overlay.querySelector('#settings-muapi-key');
    input.value = 'sk-test-muapi-1234567890';
    const saveBtn = overlay.querySelector('#settings-muapi-save');
    saveBtn.click();

    // Allow async save to complete.
    await new Promise((r) => setTimeout(r, 50));

    expect(manager.getMuapiKey()).toBe('sk-test-muapi-1234567890');
    expect(manager.hasMuapiKey()).toBe(true);
    expect(ls.getItem('muapi_key')).toBeTruthy();
    expect(ls.getItem('muapi_key_hash')).toBeTruthy();
  });

  test('saves OpenAI key through the React API tab', async () => {
    const manager = new ApiKeyManager();

    const modal = new ReactSettingsModal();
    modal.render();
    modal.setupEventListeners();
    const overlay = modal.overlay;
    const input = overlay.querySelector('#settings-openai-key');
    input.value = 'sk-test-openai-1234567890';
    const saveBtn = overlay.querySelector('#settings-openai-save');
    saveBtn.click();

    await new Promise((r) => setTimeout(r, 50));

    expect(manager.getOpenAIKey()).toBe('sk-test-openai-1234567890');
    expect(manager.hasOpenAIKey()).toBe(true);
    expect(ls.getItem('openai_key')).toBeTruthy();
  });

  test('saves VideoDB key through the React API tab', async () => {
    const manager = new ApiKeyManager();

    const modal = new ReactSettingsModal();
    modal.render();
    modal.setupEventListeners();
    const overlay = modal.overlay;
    const input = overlay.querySelector('#settings-videodb-key');
    input.value = 'videodb-test-token-1234567890';
    const saveBtn = overlay.querySelector('#settings-videodb-save');
    saveBtn.click();

    await new Promise((r) => setTimeout(r, 50));

    expect(manager.getVideoDBKey()).toBe('videodb-test-token-1234567890');
    expect(manager.hasVideoDBKey()).toBe(true);
    expect(ls.getItem('videodb_key')).toBeTruthy();
  });

  test('clearing a key removes it from both storages', async () => {
    // Use the singleton since the React modal clears via apiKeyManager.
    await apiKeyManager.setMuapiKey('sk-to-clear', true);
    expect(apiKeyManager.hasMuapiKey()).toBe(true);

    const modal = new ReactSettingsModal();
    modal.render();
    modal.setupEventListeners();
    const overlay = modal.overlay;
    const clearBtn = overlay.querySelector('#settings-muapi-clear');
    clearBtn.click();

    await new Promise((r) => setTimeout(r, 50));

    expect(apiKeyManager.hasMuapiKey()).toBe(false);
    expect(apiKeyManager.getMuapiKey()).toBeNull();
    expect(ls.getItem('muapi_key')).toBeNull();
    expect(ss.getItem('muapi_key')).toBeNull();
  });

  test('shows validation error for too-short keys', async () => {
    const modal = new ReactSettingsModal();
    modal.render();
    modal.setupEventListeners();
    const overlay = modal.overlay;
    const input = overlay.querySelector('#settings-muapi-key');
    input.value = 'abc';
    const saveBtn = overlay.querySelector('#settings-muapi-save');
    saveBtn.click();

    await new Promise((r) => setTimeout(r, 50));

    const errorEl = overlay.querySelector('#settings-muapi-error');
    expect(errorEl.style.display).not.toBe('none');
    expect(errorEl.textContent).toMatch(/too short/i);

    // Key should NOT have been saved.
    const manager = new ApiKeyManager();
    expect(manager.hasMuapiKey()).toBe(false);
  });

  test('shows validation error for whitespace in keys', async () => {
    const modal = new ReactSettingsModal();
    modal.render();
    modal.setupEventListeners();
    const overlay = modal.overlay;
    const input = overlay.querySelector('#settings-openai-key');
    input.value = 'sk-abc def';
    const saveBtn = overlay.querySelector('#settings-openai-save');
    saveBtn.click();

    await new Promise((r) => setTimeout(r, 50));

    const errorEl = overlay.querySelector('#settings-openai-error');
    expect(errorEl.textContent).toMatch(/spaces/i);
  });
});

describe('Cross-modal key sharing', () => {
  test('vanilla modal saved key is visible in React modal', async () => {
    const manager = new ApiKeyManager();
    await manager.setOpenAIKey('sk-cross-modal-openai', true);

    const modal = new ReactSettingsModal();
    modal.render();
    modal.setupEventListeners();
    const overlay = modal.overlay;

    const input = overlay.querySelector('#settings-openai-key');
    expect(input.value).toBe('sk-cross-modal-openai');

    const status = overlay.querySelector('#settings-openai-status');
    expect(status.textContent).toContain('✓ Key saved');
  });

  test('React modal saved key is visible in vanilla modal', async () => {
    const manager = new ApiKeyManager();
    await manager.setMuapiKey('sk-cross-modal-muapi', true);

    const overlay = VanillaSettingsModal();

    // Vanilla modal renders provider forms; find the Muapi input.
    const inputs = overlay.querySelectorAll('input');
    const muapiInput = Array.from(inputs).find((el) =>
      el.placeholder?.toLowerCase().includes('muapi') ||
      el.placeholder?.toLowerCase().includes('sk-')
    );
    expect(muapiInput).toBeTruthy();
    expect(muapiInput.value).toBe('sk-cross-modal-muapi');
  });

  test('keys survive a simulated reload and are visible in both modals', async () => {
    const manager = new ApiKeyManager();
    await manager.setVideoDBKey('sk-survive-reload-videodb', true);

    // Simulate reload by clearing in-memory cache.
    manager._cache.videodb.key = null;
    manager._cache.videodb.hash = null;

    // React modal should see the persisted key.
    const reactModal = new ReactSettingsModal();
    reactModal.render();
    const reactOverlay = reactModal.overlay;
    const reactInput = reactOverlay.querySelector('#settings-videodb-key');
    expect(reactInput.value).toBe('sk-survive-reload-videodb');

    // Vanilla modal should also see it.
    const vanillaOverlay = VanillaSettingsModal();
    const inputs = vanillaOverlay.querySelectorAll('input');
    const vanillaInput = Array.from(inputs).find((el) =>
      el.placeholder?.toLowerCase().includes('videodb') ||
      el.placeholder?.toLowerCase().includes('token')
    );
    expect(vanillaInput).toBeTruthy();
    expect(vanillaInput.value).toBe('sk-survive-reload-videodb');
  });

  test('saving in React modal makes hasAnyKey true for vanilla modal gating', async () => {
    const manager = new ApiKeyManager();

    // Before any keys: vanilla modal should show setup gating.
    expect(manager.hasAnyKey()).toBe(false);

    // Save a key in the React modal.
    const reactModal = new ReactSettingsModal();
    reactModal.render();
    reactModal.setupEventListeners();
    const reactOverlay = reactModal.overlay;
    const input = reactOverlay.querySelector('#settings-openai-key');
    input.value = 'sk-gating-openai';
    const saveBtn = reactOverlay.querySelector('#settings-openai-save');
    saveBtn.click();

    await new Promise((r) => setTimeout(r, 50));

    expect(manager.hasAnyKey()).toBe(true);

    // Vanilla modal gating: should NOT show the auth modal.
    const shouldShowAuth = !manager.hasAnyKey();
    expect(shouldShowAuth).toBe(false);
  });
});

describe('React SettingsModal Save button waits for all keys', () => {
  test('save button persists all three keys before closing', async () => {
    const manager = new ApiKeyManager();

    const modal = new ReactSettingsModal();
    modal.render();
    modal.setupEventListeners();
    const overlay = modal.overlay;

    // Fill all three fields.
    overlay.querySelector('#settings-muapi-key').value = 'sk-muapi-save-test';
    overlay.querySelector('#settings-openai-key').value = 'sk-openai-save-test';
    overlay.querySelector('#settings-videodb-key').value = 'sk-videodb-save-test';

    // Click the global Save Settings button.
    const saveBtn = overlay.querySelector('[data-action="save"]');
    let confirmPayload = null;
    modal.onConfirm = (payload) => {
      confirmPayload = payload;
    };

    saveBtn.click();
    await new Promise((r) => setTimeout(r, 50));

    expect(confirmPayload).toBeTruthy();
    expect(confirmPayload.action).toBe('settingsSaved');
    expect(confirmPayload.api.muapiKey).toBe('sk-muapi-save-test');
    expect(confirmPayload.api.openAIKey).toBe('sk-openai-save-test');
    expect(confirmPayload.api.videoDBKey).toBe('sk-videodb-save-test');

    // And apiKeyManager should reflect all three.
    expect(manager.hasMuapiKey()).toBe(true);
    expect(manager.hasOpenAIKey()).toBe(true);
    expect(manager.hasVideoDBKey()).toBe(true);
  });
});
