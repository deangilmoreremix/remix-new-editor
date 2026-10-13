// UploadPicker + studio → MuAPI adapter flow.
//
// Simulates a MuAPI-bound studio (the UpscaleStudio shape: pick a reference,
// then generate with it) on top of the REAL UploadPicker and the REAL studio
// media bridge. The adapter (src/lib/muapiUpload.js) and the auth context
// (src/lib/authContext.js) are mocked so the test asserts wiring, not network.
//
// Invariants covered:
//   - a picked file is validated, saved to the PERMANENT Asset Library and
//     uploaded to MuAPI exactly once,
//   - re-picking the same file reuses the saved asset through
//     resolveMuAPIMediaInput (no second upload),
//   - the studio hands MuAPI the freshly resolved URL, never a permanent URL
//     where a temp URL is required and never a temp URL as an identifier,
//   - failures surface the adapter's UI-safe userMessage,
//   - duplicate submissions while a batch is in flight are dropped.

import { describe, test, expect, beforeEach, vi } from 'vitest';

// ── jsdom DataTransfer polyfill (mirrors tests/unit/upload-picker-*.spec.ts) ──
class MockDataTransfer {
  constructor() { this.items = []; }
  add(file) { this.items.push({ kind: 'file', getAsFile: () => file }); }
  get files() {
    const items = this.items;
    return {
      length: items.length,
      item: (i) => items[i]?.getAsFile() || null,
      [Symbol.iterator]: function* generator() {
        for (const item of items) yield item.getAsFile();
      },
    };
  }
}
globalThis.DataTransfer = MockDataTransfer;

// setup.js installs a no-op `vi.fn()` localStorage stub on some branch bases;
// the Library → "Use in studio" handoff persists its pending asset through
// localStorage, so this file installs a minimal working store of its own to
// stay base-independent.
const localStorageStore = new Map();
globalThis.localStorage = {
  getItem: (key) => (localStorageStore.has(key) ? localStorageStore.get(key) : null),
  setItem: (key, value) => { localStorageStore.set(key, String(value)); },
  removeItem: (key) => { localStorageStore.delete(key); },
  clear: () => { localStorageStore.clear() },
  key: (index) => [...localStorageStore.keys()][index] ?? null,
  get length() { return localStorageStore.size; },
};

// ── Mocks ──────────────────────────────────────────────────────────────────

vi.mock('../../src/lib/apiKeyManager.js', () => ({
  apiKeyManager: {
    getMuapiKey: vi.fn(() => 'test-muapi-key'),
    hasMuapiKey: vi.fn(() => true),
    getKey: vi.fn(() => 'test-muapi-key'),
  },
}));

vi.mock('../../src/lib/uploadHistory.js', () => ({
  getUploadHistory: vi.fn(() => []),
  saveUpload: vi.fn(),
  removeUpload: vi.fn(),
}));

vi.mock('../../src/components/AuthModal.js', () => ({ AuthModal: vi.fn() }));

vi.mock('../../src/lib/loading.js', () => ({ showToast: vi.fn() }));

vi.mock('../../src/lib/editor/uploadPipeline.js', () => ({
  processFileUpload: vi.fn(),
  fetchUrlAsFile: vi.fn(),
}));

vi.mock('../../src/lib/muapi.js', () => ({
  muapi: {
    generateI2I: vi.fn(async (params) => ({ url: 'https://cdn.test/result.png', params })),
    generateI2V: vi.fn(async (params) => ({ url: 'https://cdn.test/result.mp4', params })),
  },
}));

vi.mock('../../src/lib/authContext.js', () => ({
  getAuthContext: vi.fn(async () => ({
    userId: 'user-a',
    workspaceId: 'ws-1',
    muapiKey: 'test-muapi-key',
    hasMuapiKey: true,
    isAnonymous: false,
  })),
  getAuthContextSync: vi.fn(() => ({
    userId: 'user-a',
    workspaceId: 'ws-1',
    muapiKey: 'test-muapi-key',
    hasMuapiKey: true,
    isAnonymous: false,
  })),
}));

// ── The adapter under test (Sub-agent A's module) ──────────────────────────
const uploadCalls = { image: 0, video: 0, other: 0 };
const resolveCalls = [];

vi.mock('../../src/lib/muapiUpload.js', () => ({
  validateMuAPIUpload: vi.fn(async (file) => {
    const category = String(file.type || '').startsWith('video/') ? 'video' : 'image';
    return { category, mime: file.type, sizeBytes: file.size, name: file.name };
  }),
  uploadImageToMuAPI: vi.fn(async () => {
    uploadCalls.image += 1;
    return {
      url: 'https://api.muapi.ai/tmp/img-1',
      category: 'image',
      source: 'file',
      uploadedAt: Date.now(),
      expiresAt: Date.now() + 60 * 60 * 1000,
    };
  }),
  uploadVideoToMuAPI: vi.fn(async () => {
    uploadCalls.video += 1;
    return {
      url: 'https://api.muapi.ai/tmp/vid-1',
      category: 'video',
      source: 'file',
      uploadedAt: Date.now(),
      expiresAt: Date.now() + 60 * 60 * 1000,
    };
  }),
  uploadFileToMuapi: vi.fn(async () => {
    uploadCalls.other += 1;
    return {
      url: 'https://api.muapi.ai/tmp/other-1',
      category: 'other',
      source: 'file',
      uploadedAt: Date.now(),
      expiresAt: Date.now() + 60 * 60 * 1000,
    };
  }),
  resolveMuAPIMediaInput: vi.fn(async (assetId) => {
    resolveCalls.push(assetId);
    return {
      url: `https://api.muapi.ai/tmp/resolved-${assetId}`,
      source: 'asset',
      assetId,
      uploadedAt: Date.now(),
      expiresAt: Date.now() + 60 * 60 * 1000,
    };
  }),
  handleMuAPIUploadError: vi.fn(() => ({
    code: 'MUAPI_PROVIDER_ERROR',
    message: 'MuAPI could not process the upload.',
    retryable: false,
    userMessage: 'MuAPI could not process the upload right now. Please try again.',
  })),
}));

// ── The permanent Asset Library (Sub-agent C's module) ─────────────────────
const library = { saved: [], assets: [], duplicate: null };

vi.mock('../../src/lib/assetLibrary.js', () => ({
  saveAsset: vi.fn(async (file, authContext) => {
    const asset = {
      id: `asset-${library.saved.length + 1}`,
      url: `https://storage.test.local/${file.name}`,
      path: `user-a/${file.name}`,
      name: file.name,
      type: file.type,
      size: file.size,
      userId: authContext.userId,
      workspaceId: authContext.workspaceId,
    };
    library.saved.push(asset);
    return asset;
  }),
  listAssets: vi.fn(async () => library.assets),
  findDuplicateAsset: vi.fn(() => library.duplicate),
}));

vi.mock('../../src/lib/supabase.js', () => ({
  supabase: {},
  isSupabaseConfigured: () => true,
  getUserKey: vi.fn(async () => 'user-a'),
}));

import { createUploadPicker, queueAssetForStudio } from '../../src/components/UploadPicker.js';
import { resolveMuapiMediaRefs, resolvePersonalizationMediaRef } from '../../src/lib/muapiStudioMedia.js';
import { showToast } from '../../src/lib/loading.js';
import { resolveMuapiMediaRef, getMuapiAuthContext } from '../../src/lib/muapiStudioMedia.js';
import { muapi } from '../../src/lib/muapi.js';
import * as adapter from '../../src/lib/muapiUpload.js';
import * as authContextModule from '../../src/lib/authContext.js';
import * as assetLibrary from '../../src/lib/assetLibrary.js';

function makeFile(name, type, size = 1024) {
  return new File([new Uint8Array(size)], name, { type });
}

function setFiles(input, files) {
  const dt = new MockDataTransfer();
  files.forEach((f) => dt.add(f));
  Object.defineProperty(input, 'files', { value: dt.files, configurable: true });
}

function flush(times = 6) {
  let p = Promise.resolve();
  for (let i = 0; i < times; i += 1) p = p.then(() => new Promise((r) => setTimeout(r, 0)));
  return p;
}

// A minimal MuAPI-bound studio: pick a reference, then generate with it.
// This mirrors how the wired studios consume the picker payload.
function createStudio() {
  const studio = {
    reference: null,
    onSelectCalls: 0,
    generate: async () => {
      const imageUrl = await resolveMuapiMediaRef({
        url: studio.reference?.url,
        assetId: studio.reference?.assetId,
      });
      const res = await muapi.generateI2I({ model: 'ai-image-upscaler', image_url: imageUrl });
      studio.lastResult = res;
      return res;
    },
  };
  studio.picker = createUploadPicker({
    anchorContainer: document.createElement('div'),
    muapiStudio: true,
    studioId: 'upscale-studio',
    onSelect: (payload) => {
      studio.onSelectCalls += 1;
      studio.reference = {
        url: payload.url,
        assetId: payload.assetId,
        muapiUrl: payload.muapiUrl,
      };
    },
  });
  studio.input = studio.picker.trigger.querySelector('input[type="file"]');
  studio.pick = (files) => {
    setFiles(studio.input, files);
    studio.input.onchange({ target: studio.input });
    return flush();
  };
  return studio;
}

describe('UploadPicker → MuAPI studio upload flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    uploadCalls.image = 0;
    uploadCalls.video = 0;
    uploadCalls.other = 0;
    resolveCalls.length = 0;
    library.saved = [];
    library.assets = [];
    library.duplicate = null;
  });

  test('picking a file validates, saves it to the Asset Library and uploads once', async () => {
    const studio = createStudio();
    await studio.pick([makeFile('hero.png', 'image/png')]);

    // Validated through the shared adapter.
    expect(adapter.validateMuAPIUpload).toHaveBeenCalledTimes(1);
    expect(adapter.validateMuAPIUpload.mock.calls[0][0].name).toBe('hero.png');

    // Saved durably — the file object, not a URL.
    expect(assetLibrary.saveAsset).toHaveBeenCalledTimes(1);
    expect(assetLibrary.saveAsset.mock.calls[0][0].name).toBe('hero.png');
    const authArg = assetLibrary.saveAsset.mock.calls[0][1];
    expect(authArg.userId).toBe('user-a');
    expect(authArg.workspaceId).toBe('ws-1');
    expect(authArg.muapiKey).toBe('test-muapi-key');

    // Exactly one MuAPI upload.
    expect(adapter.uploadImageToMuAPI).toHaveBeenCalledTimes(1);
    expect(adapter.uploadImageToMuAPI.mock.calls[0][0].name).toBe('hero.png');
    expect(adapter.uploadImageToMuAPI.mock.calls[0][1].userId).toBe('user-a');

    // The studio receives the PERMANENT reference plus the fresh temp URL.
    expect(studio.reference.url).toBe('https://storage.test.local/hero.png');
    expect(studio.reference.assetId).toBe('asset-1');
    expect(studio.reference.muapiUrl).toBe('https://api.muapi.ai/tmp/img-1');
  });

  test('uploads videos through the video uploader', async () => {
    const studio = createStudio();
    await studio.pick([makeFile('clip.mp4', 'video/mp4', 4096)]);
    expect(adapter.uploadVideoToMuAPI).toHaveBeenCalledTimes(1);
    expect(adapter.uploadImageToMuAPI).not.toHaveBeenCalled();
    expect(studio.reference.muapiUrl).toBe('https://api.muapi.ai/tmp/vid-1');
  });

  test('re-picking the same file reuses the saved asset — no second upload', async () => {
    const studio = createStudio();
    await studio.pick([makeFile('hero.png', 'image/png')]);
    expect(adapter.uploadImageToMuAPI).toHaveBeenCalledTimes(1);
    // Start counting from the re-pick onwards.
    assetLibrary.saveAsset.mockClear();

    // The library now holds the file (same name + size) so the next pick is a
    // duplicate: it must reuse the asset through resolveMuAPIMediaInput.
    library.duplicate = library.saved[0];
    studio.picker.reset();
    await studio.pick([makeFile('hero.png', 'image/png')]);

    expect(assetLibrary.saveAsset).not.toHaveBeenCalled();
    expect(adapter.uploadImageToMuAPI).toHaveBeenCalledTimes(1);
    expect(adapter.resolveMuAPIMediaInput).toHaveBeenCalledWith('asset-1', expect.objectContaining({ userId: 'user-a' }));
    expect(studio.reference.assetId).toBe('asset-1');
    expect(studio.reference.muapiUrl).toBe('https://api.muapi.ai/tmp/resolved-asset-1');
  });

  test('the studio hands MuAPI the freshly resolved URL at generation time', async () => {
    const studio = createStudio();
    await studio.pick([makeFile('hero.png', 'image/png')]);
    resolveCalls.length = 0;

    const res = await studio.generate();

    // Generation resolves through the adapter, so the URL MuAPI receives is
    // always fresh (and never the permanent identifier).
    expect(adapter.resolveMuAPIMediaInput).toHaveBeenCalledTimes(1);
    expect(res.url).toBe('https://cdn.test/result.png');
    expect(muapi.generateI2I.mock.calls[0][0].image_url).toBe('https://api.muapi.ai/tmp/resolved-asset-1');
  });

  test('shows the adapter userMessage when the upload fails', async () => {
    adapter.uploadImageToMuAPI.mockRejectedValueOnce(new Error('network down'));
    const studio = createStudio();
    await studio.pick([makeFile('hero.png', 'image/png')]);

    expect(adapter.handleMuAPIUploadError).toHaveBeenCalled();
    expect(showToast).toHaveBeenCalledWith(
      'MuAPI could not process the upload right now. Please try again.',
      'error',
    );
    expect(studio.onSelectCalls).toBe(0);
  });

  test('shows the adapter userMessage for an oversized file (validation failure)', async () => {
    const studio = createStudio();
    await studio.pick([makeFile('huge.png', 'image/png', 20 * 1024 * 1024)]);
    expect(showToast).toHaveBeenCalled();
    const message = showToast.mock.calls.at(-1)[0];
    expect(String(message)).toMatch(/too large|10 ?MB|50 ?MB/i);
    expect(adapter.uploadImageToMuAPI).not.toHaveBeenCalled();
  });

  test('drops duplicate submissions while a batch is in flight', async () => {
    const studio = createStudio();
    setFiles(studio.input, [makeFile('first.png', 'image/png')]);
    // Fire twice synchronously: the second must be ignored while the first
    // is still in flight.
    studio.input.onchange({ target: studio.input });
    studio.input.onchange({ target: studio.input });
    await flush();

    expect(adapter.validateMuAPIUpload).toHaveBeenCalledTimes(1);
    expect(assetLibrary.saveAsset).toHaveBeenCalledTimes(1);
    expect(adapter.uploadImageToMuAPI).toHaveBeenCalledTimes(1);
  });

  test('resolves the auth context through the shared authContext module', async () => {
    const studio = createStudio();
    await studio.pick([makeFile('hero.png', 'image/png')]);
    expect(authContextModule.getAuthContext).toHaveBeenCalled();
  });

  test('"Use in studio" hands the library asset to the picker (no re-upload)', async () => {
    const studio = createStudio();
    assetLibrary.saveAsset.mockClear();
    adapter.uploadImageToMuAPI.mockClear();

    // The Library page passes the permanent asset reference straight to the
    // studio's own picker — the adapter resolves the URL, nothing is re-uploaded.
    await studio.picker.selectAsset({ id: 'asset-77', name: 'hero.png', url: 'https://storage.test.local/hero.png', category: 'image' });
    await flush();

    expect(assetLibrary.saveAsset).not.toHaveBeenCalled();
    expect(adapter.uploadImageToMuAPI).not.toHaveBeenCalled();
    expect(adapter.resolveMuAPIMediaInput).toHaveBeenCalledWith('asset-77', expect.objectContaining({ userId: 'user-a' }));
    expect(studio.reference.assetId).toBe('asset-77');
    expect(studio.reference.muapiUrl).toBe('https://api.muapi.ai/tmp/resolved-asset-77');

    // Generation uses the resolved URL, still not a new upload.
    await studio.generate();
    expect(adapter.uploadImageToMuAPI).not.toHaveBeenCalled();
  });

  test('an asset queued from the Library page is picked up when the studio mounts', async () => {
    library.assets = [{
      id: 'asset-99', name: 'brand.png', url: 'https://storage.test.local/brand.png', category: 'image',
    }];
    // Library → "Use in studio" on a studio that is not mounted yet.
    queueAssetForStudio('upscale-studio', 'asset-99');

    const studio = createStudio();
    await flush(10);

    expect(adapter.resolveMuAPIMediaInput).toHaveBeenCalledWith('asset-99', expect.objectContaining({ userId: 'user-a' }));
    expect(studio.reference.assetId).toBe('asset-99');
    expect(studio.reference.url).toBe('https://storage.test.local/brand.png');
    expect(adapter.uploadImageToMuAPI).not.toHaveBeenCalled();
  });

  test('keeps the Clerk identity when no MuAPI key is configured yet', async () => {
    // A signed-in user without a BYOK key must not fall back to the shared
    // 'anonymous' owner — durable assets are saved under the Clerk identity
    // and BYOK is enforced at upload time instead.
    authContextModule.getAuthContext.mockResolvedValueOnce({
      userId: 'user-a',
      workspaceId: 'ws-1',
      muapiKey: '',
      hasMuapiKey: false,
      isAnonymous: false,
    });
    const auth = await getMuapiAuthContext();
    expect(auth.userId).toBe('user-a');
    expect(auth.workspaceId).toBe('ws-1');
  });

  test('multi-image studios receive normalized library asset entries', async () => {
    library.assets = [
      { id: 'asset-11', name: 'one.png', url: 'https://storage.test.local/one.png', category: 'image' },
      { id: 'asset-12', name: 'two.png', url: 'https://storage.test.local/two.png', category: 'image' },
    ];
    const picker = createUploadPicker({
      anchorContainer: document.createElement('div'),
      muapiStudio: true,
      studioId: 'multi-studio',
      maxImages: 3,
      onSelect: () => {},
    });
    await picker.selectAsset({ id: 'asset-11', name: 'one.png', url: 'https://storage.test.local/one.png', category: 'image' });
    await picker.selectAsset({ id: 'asset-12', name: 'two.png', url: 'https://storage.test.local/two.png', category: 'image' });
    await flush();

    // getSelectedUrls() (and the Done action's fireOnSelect payload) read
    // `entry.url`; library entries must be normalized to that shape.
    expect(picker.getSelectedUrls()).toEqual([
      'https://storage.test.local/one.png',
      'https://storage.test.local/two.png',
    ]);
    expect(adapter.uploadImageToMuAPI).not.toHaveBeenCalled();
  });

  test('resolves a list of attachment references in order', async () => {
    const urls = await resolveMuapiMediaRefs([
      { url: 'https://storage.test.local/a.png', assetId: 'asset-1' },
      { url: 'https://pexels.test/b.png', assetId: null },
    ]);
    expect(urls).toEqual([
      'https://api.muapi.ai/tmp/resolved-asset-1',
      'https://pexels.test/b.png',
    ]);
  });
});

describe('Personalization media references', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    library.duplicate = null;
  });

  test('a personalization element with an asset id resolves through the adapter', async () => {
    const url = await resolvePersonalizationMediaRef({
      src: 'https://storage.test.local/logo.png',
      assetId: 'asset-42',
    });
    expect(adapter.resolveMuAPIMediaInput).toHaveBeenCalledWith('asset-42', expect.objectContaining({ userId: 'user-a' }));
    expect(url).toBe('https://api.muapi.ai/tmp/resolved-asset-42');
  });

  test('legacy personalization elements (no asset id) keep their stored URL', async () => {
    const url = await resolvePersonalizationMediaRef({ src: 'https://storage.test.local/legacy-logo.png' });
    expect(url).toBe('https://storage.test.local/legacy-logo.png');
    expect(adapter.resolveMuAPIMediaInput).not.toHaveBeenCalled();
  });

  test('a plain string reference passes through untouched', async () => {
    await expect(resolvePersonalizationMediaRef('https://example.com/a.png')).resolves.toBe('https://example.com/a.png');
    await expect(resolvePersonalizationMediaRef(null)).resolves.toBe(null);
  });
});
