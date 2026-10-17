// Studio upload fixes — regression coverage for the confirmed runtime defects:
//
//   1. AudioStudio omits schema params whose media reference no longer
//      resolves (never sends an explicit null) and passes non-media params
//      through untouched, with the abort controller wired into the call.
//   2. AudioStudio's toolbar audio reference (audio_url) is omitted when the
//      asset no longer resolves.
//   3. UpscaleStudio hands the fresh abort signal to the MuAPI call.
//   4. Replacing the source file resets the picker's asset identity — the
//      onSelect payload carries the NEW upload's assetId/assetUrl/muapiUrl.
//   5. Re-selecting from the upload history keeps the file's durable asset
//      identity.
//   6. "Use in studio" targets the earliest-registered MOUNTED picker for a
//      studio with several pickers (the watermark picker must not steal).
//   7. CinemaStudio frame picks carry the permanent assetId all the way into
//      the adapter resolve call.
//
// The REAL studios and the REAL UploadPicker run on top of a mocked studio
// media bridge (../../src/lib/muapiStudioMedia.js) and mocked adapter/auth,
// so resolution outcomes are deterministic — this asserts wiring, not network.

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';

// ── jsdom DataTransfer polyfill (mirrors src/test/muapi-upload-ui.test.js) ──
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

// The picker's panel placement uses requestAnimationFrame; provide a
// synchronous fallback when the jsdom env does not implement it.
if (typeof globalThis.requestAnimationFrame !== 'function') {
  globalThis.requestAnimationFrame = (cb) => { cb(); return 1; };
}

// jsdom does not implement scrollIntoView (studio camera controls use it).
if (typeof Element !== 'undefined' && !Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}

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

const uploadHistoryStore = { entries: [] };

vi.mock('../../src/lib/uploadHistory.js', () => ({
  getUploadHistory: vi.fn(() => uploadHistoryStore.entries),
  saveUpload: vi.fn(),
  removeUpload: vi.fn(),
}));

vi.mock('../../src/components/AuthModal.js', () => ({ AuthModal: vi.fn() }));

vi.mock('../../src/lib/loading.js', () => ({ showToast: vi.fn() }));

vi.mock('../../src/lib/editor/uploadPipeline.js', () => ({
  processFileUpload: vi.fn(),
  fetchUrlAsFile: vi.fn(),
}));

vi.mock('../../src/lib/clerkEntitlements.js', () => ({
  requireEntitlement: vi.fn(async () => true),
}));

// The real popover sets SVGElement.className (browser-tolerant, jsdom-fatal).
// Token replacement is behaviour-neutral for these tests (no tokens used).
vi.mock('../../src/components/personalize/personalizePopover.js', () => ({
  mountPersonalizeTrigger: vi.fn(() => ({ element: null })),
  replaceTokensInPrompt: vi.fn((prompt) => prompt),
  inspectPromptTokens: vi.fn(() => ({ resolved: [], unresolved: [] })),
}));

vi.mock('../../src/lib/muapi.js', () => ({
  muapi: {
    generateMusic: vi.fn(async (params) => ({ url: null, params })),
    generateAudio: vi.fn(async (params) => ({ url: null, params })),
    generateI2I: vi.fn(async (params) => ({ url: null, params })),
    generateI2V: vi.fn(async (params) => ({ url: null, params })),
    generateVideo: vi.fn(async (params) => ({ url: null, params })),
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

// ── The studio media bridge (deterministic resolution outcomes) ────────────
const STALE_URL = 'https://storage.test.local/stale.mp3';
const TRACK_URL = 'https://storage.test.local/track.mp3';
const GONE_ASSET_ID = 'asset-gone';
const FRAME_URL = 'https://storage.test.local/frame-start.png';

vi.mock('../../src/lib/muapiStudioMedia.js', () => {
  // Mirrors the real bridge's contract: plain strings pass through, refs
  // without an assetId fall back to their URL, and refs whose asset can no
  // longer be resolved return null.
  const resolveRef = async (ref) => {
    if (!ref) return null;
    if (typeof ref === 'string') return ref === STALE_URL ? null : ref;
    if (!ref.assetId) return ref.url || null;
    if (ref.assetId === GONE_ASSET_ID) return null;
    return `https://api.muapi.ai/tmp/resolved-${ref.assetId}`;
  };
  return {
    getMuapiAuthContext: vi.fn(async () => ({
      userId: 'user-a',
      workspaceId: 'ws-1',
      muapiKey: 'test-muapi-key',
    })),
    ingestStudioUpload: vi.fn(async (file) => {
      const byName = {
        'track.mp3': { assetId: GONE_ASSET_ID, url: TRACK_URL, muapiUrl: 'https://api.muapi.ai/tmp/track' },
        'frame-start.png': { assetId: 'asset-frame-1', url: FRAME_URL, muapiUrl: 'https://api.muapi.ai/tmp/frame-1' },
        'a.png': { assetId: 'asset-A', url: 'https://storage.test.local/a.png', muapiUrl: 'https://api.muapi.ai/tmp/a' },
        'b.png': { assetId: 'asset-B', url: 'https://storage.test.local/b.png', muapiUrl: 'https://api.muapi.ai/tmp/b' },
      };
      const hit = byName[file.name] || {
        assetId: `asset-${file.name}`,
        url: `https://storage.test.local/${file.name}`,
        muapiUrl: null,
      };
      return {
        ...hit,
        path: `user-a/${file.name}`,
        name: file.name,
        type: file.type,
        category: 'image',
        mime: file.type,
        sizeBytes: file.size,
        reused: false,
      };
    }),
    resolveMuapiMediaRef: vi.fn(resolveRef),
    resolveMuapiMediaRefs: vi.fn(async (refs) => {
      const list = Array.isArray(refs) ? refs : [];
      const resolved = await Promise.all(list.map(resolveRef));
      return resolved.filter(Boolean);
    }),
    describeMuapiUploadError: vi.fn(async (err) => err?.message || 'Upload failed.'),
    resolvePersonalizationMediaRef: vi.fn(async (el) => el?.src || el?.url || null),
    createStudioInFlightGuard: vi.fn(() => ({
      isBusy: () => false,
      keys: () => [],
      run: async (key, fn) => ({ skipped: false, value: await fn() }),
    })),
  };
});

vi.mock('../../src/lib/muapiUpload.js', () => ({
  validateMuAPIUpload: vi.fn(async (file) => ({
    category: String(file.type || '').startsWith('video/') ? 'video' : 'image',
    mime: file.type,
    sizeBytes: file.size,
    name: file.name,
  })),
  uploadImageToMuAPI: vi.fn(async () => ({ url: 'https://api.muapi.ai/tmp/img-1' })),
  uploadVideoToMuAPI: vi.fn(async () => ({ url: 'https://api.muapi.ai/tmp/vid-1' })),
  uploadFileToMuapi: vi.fn(async () => ({ url: 'https://api.muapi.ai/tmp/other-1' })),
  resolveMuAPIMediaInput: vi.fn(async (assetId) => ({ url: `https://api.muapi.ai/tmp/resolved-${assetId}` })),
  handleMuAPIUploadError: vi.fn(() => ({ userMessage: 'Upload failed.' })),
}));

vi.mock('../../src/lib/assetLibrary.js', () => ({
  saveAsset: vi.fn(async (file, authContext) => ({
    id: `asset-${file.name}`,
    url: `https://storage.test.local/${file.name}`,
    path: `${authContext?.userId}/${file.name}`,
    name: file.name,
    type: file.type,
    size: file.size,
  })),
  listAssets: vi.fn(async () => []),
  findDuplicateAsset: vi.fn(() => null),
}));

vi.mock('../../src/lib/supabase.js', () => ({
  supabase: {},
  isSupabaseConfigured: () => true,
  getUserKey: vi.fn(async () => 'user-a'),
}));

import { AudioStudio } from '../../src/components/AudioStudio.js';
import { CinemaStudio } from '../../src/components/CinemaStudio.js';
import { UpscaleStudio } from '../../src/components/UpscaleStudio.js';
import { createUploadPicker, selectAssetInStudio } from '../../src/components/UploadPicker.js';
import { muapi } from '../../src/lib/muapi.js';
import * as studioMedia from '../../src/lib/muapiStudioMedia.js';

// ── Helpers ────────────────────────────────────────────────────────────────

function makeFile(name, type, size = 1024) {
  return new File([new Uint8Array(size)], name, { type });
}

function setFiles(input, files) {
  const dt = new MockDataTransfer();
  files.forEach((f) => dt.add(f));
  Object.defineProperty(input, 'files', { value: dt.files, configurable: true });
}

function flush(times = 8) {
  let p = Promise.resolve();
  for (let i = 0; i < times; i += 1) p = p.then(() => new Promise((r) => setTimeout(r, 0)));
  return p;
}

// Same scoping as AudioStudio's scopedPersistKey so seeded persistence lands
// on the key the studio actually reads.
function audioPersistKey(apiKey) {
  let hash = 0;
  for (let i = 0; i < apiKey.length; i++) {
    hash = (hash * 31 + apiKey.charCodeAt(i)) | 0;
  }
  return `hg_audio_studio_persistent:${(hash >>> 0).toString(36)}`;
}

function setPrompt(studio, label, text) {
  const ta = studio.querySelector(`textarea[aria-label="${label}"]`);
  ta.value = text;
  ta.dispatchEvent(new Event('input', { bubbles: true }));
  return ta;
}

// The picker's file input (distinguished from the attachment toolbar's
// type-specific inputs by its document accept group).
function pickerFileInput(root) {
  return [...root.querySelectorAll('input[type="file"]')]
    .find((i) => (i.getAttribute('accept') || '').includes('application/pdf'));
}

afterEach(() => {
  document.body.innerHTML = '';
  localStorageStore.clear();
  uploadHistoryStore.entries = [];
  vi.clearAllMocks();
});

async function pickViaInput(input, file) {
  setFiles(input, [file]);
  await input.onchange({ target: input });
  await flush();
}

describe('AudioStudio generate params', () => {
  beforeEach(() => {
    localStorageStore.clear();
  });

  test('omits resolved-null schema params and keeps non-media values — never sends explicit null', async () => {
    localStorageStore.set(audioPersistKey('test-muapi-key'), JSON.stringify({
      selectedModelId: 'flux-3-audio',
      params: { reference_audios: STALE_URL, warmth: 7 },
    }));

    const studio = AudioStudio();
    setPrompt(studio, 'Audio prompt', 'a calm ambient track');
    const genBtn = studio.querySelector('button[aria-label="Generate audio"]');
    await genBtn.onclick();
    await flush();

    expect(muapi.generateAudio).toHaveBeenCalledTimes(1);
    const params = muapi.generateAudio.mock.calls[0][0];

    // The media reference that no longer resolves is omitted entirely.
    expect(params).not.toHaveProperty('reference_audios');
    expect(studioMedia.resolveMuapiMediaRef).toHaveBeenCalledWith(STALE_URL);
    // Non-media params are not media references — the original value survives.
    expect(params.warmth).toBe(7);
    // The abort controller is declared, assigned and wired into the call.
    expect(params.signal).toBeInstanceOf(AbortSignal);
    expect(params.model).toBe('flux-3-audio');
    expect(params.prompt).toBe('a calm ambient track');
  }, 30000);

  test('omits audio_url when the attachment reference no longer resolves', async () => {
    const studio = AudioStudio();
    setPrompt(studio, 'Audio prompt', 'remix this take');

    // The attachment toolbar creates its file input on demand.
    const audioTool = [...studio.querySelectorAll('button')]
      .find((b) => b.getAttribute('aria-label') === 'Reference Audios');
    expect(audioTool).toBeTruthy();
    audioTool.click();
    const input = document.body.querySelector('input[accept="audio/*"]');
    expect(input).toBeTruthy();
    await pickViaInput(input, makeFile('track.mp3', 'audio/mpeg'));

    expect(studioMedia.ingestStudioUpload).toHaveBeenCalledTimes(1);

    const genBtn = studio.querySelector('button[aria-label="Generate audio"]');
    await genBtn.onclick();
    await flush();

    expect(studioMedia.resolveMuapiMediaRef).toHaveBeenCalledWith(
      expect.objectContaining({ url: TRACK_URL, assetId: GONE_ASSET_ID }),
    );

    const params = muapi.generateAudio.mock.calls[0][0];
    expect(params).not.toHaveProperty('audio_url');
    expect(params).not.toHaveProperty('reference_audios');
    expect(params.signal).toBeInstanceOf(AbortSignal);
  }, 30000);
});

describe('UpscaleStudio generate params', () => {
  test('resolves the source through the adapter and passes the abort signal', async () => {
    const studio = UpscaleStudio();
    const input = pickerFileInput(studio);
    expect(input).toBeTruthy();
    await pickViaInput(input, makeFile('source.png', 'image/png'));

    const genBtn = studio.querySelector('button[aria-label="Upscale image"]');
    await genBtn.onclick();
    await flush();

    expect(muapi.generateI2I).toHaveBeenCalledTimes(1);
    const params = muapi.generateI2I.mock.calls[0][0];
    expect(params.image_url).toBe('https://api.muapi.ai/tmp/resolved-asset-source.png');
    expect(params.signal).toBeInstanceOf(AbortSignal);
  }, 30000);
});

describe('UploadPicker asset identity', () => {
  test('replacing the source file resets stale asset identity in the onSelect payload', async () => {
    const payloads = [];
    const picker = createUploadPicker({
      anchorContainer: document.createElement('div'),
      muapiStudio: true,
      studioId: 'identity-check-studio',
      onSelect: (payload) => payloads.push(payload),
    });
    const input = picker.trigger.querySelector('input[type="file"]');

    await pickViaInput(input, makeFile('a.png', 'image/png'));
    await pickViaInput(input, makeFile('b.png', 'image/png'));

    expect(payloads).toHaveLength(2);
    expect(payloads[0]).toMatchObject({ url: 'https://storage.test.local/a.png', assetId: 'asset-A' });

    // The second payload carries the NEW upload's identity only.
    expect(payloads[1]).toMatchObject({
      url: 'https://storage.test.local/b.png',
      assetId: 'asset-B',
      muapiUrl: 'https://api.muapi.ai/tmp/b',
    });
    expect(payloads[1].assetIds).toEqual(['asset-B']);
    expect(JSON.stringify(payloads[1])).not.toContain('asset-A');
    expect(JSON.stringify(payloads[1])).not.toContain('/tmp/a');
  });

  test('re-selecting from history keeps the picked file’s durable asset identity', async () => {
    uploadHistoryStore.entries = [{
      id: 'hist-1',
      name: 'old.png',
      uploadedUrl: 'https://storage.test.local/old.png',
      assetUrl: 'https://storage.test.local/old.png',
      assetId: 'asset-hist-1',
      muapiUrl: 'https://api.muapi.ai/tmp/old',
      thumbnail: 'https://storage.test.local/old.png',
      type: 'image',
    }];

    const anchor = document.createElement('div');
    document.body.appendChild(anchor);
    const payloads = [];
    const picker = createUploadPicker({
      anchorContainer: anchor,
      muapiStudio: true,
      studioId: 'history-check-studio',
      onSelect: (payload) => payloads.push(payload),
    });
    document.body.appendChild(picker.trigger);

    // Open the panel so the history grid renders, then pick the entry.
    expect(picker.panel.querySelector('.grid')).toBeNull();
    picker.trigger.click();
    const cell = picker.panel.querySelector('.grid')?.children[0];
    expect(cell).toBeTruthy();
    cell.click();
    await flush();

    expect(payloads).toHaveLength(1);
    expect(payloads[0]).toMatchObject({
      url: 'https://storage.test.local/old.png',
      assetId: 'asset-hist-1',
      muapiUrl: 'https://api.muapi.ai/tmp/old',
    });
    expect(payloads[0].assetIds).toEqual(['asset-hist-1']);
  });
});

describe('"Use in studio" picker registry', () => {
  test('hands the asset to the earliest-registered mounted picker', async () => {
    const seen = { first: [], second: [] };
    const makePicker = (key) => createUploadPicker({
      anchorContainer: document.createElement('div'),
      muapiStudio: true,
      studioId: 'registry-check-studio',
      onSelect: (payload) => seen[key].push(payload),
    });
    // EditStudio registers several pickers under one studioId, mounting each
    // trigger before the next picker is created; the main picker registers
    // first, the watermark picker last.
    const first = makePicker('first');
    document.body.appendChild(first.trigger);
    const second = makePicker('second');
    document.body.appendChild(second.trigger);

    const asset = {
      id: 'asset-77',
      name: 'hero.png',
      url: 'https://storage.test.local/hero.png',
      category: 'image',
    };

    await selectAssetInStudio('registry-check-studio', asset);
    await flush();

    expect(seen.first).toHaveLength(1);
    expect(seen.first[0].assetId).toBe('asset-77');
    expect(seen.second).toHaveLength(0);

    // Detached pickers never receive the asset — the next-earliest mounted one wins.
    first.trigger.remove();
    await selectAssetInStudio('registry-check-studio', asset);
    await flush();

    expect(seen.second).toHaveLength(1);
    expect(seen.second[0].assetId).toBe('asset-77');
  });
});

describe('CinemaStudio frame references', () => {
  test('the picked frame’s assetId reaches the adapter resolve call', async () => {
    const studio = CinemaStudio();
    const input = pickerFileInput(studio);
    expect(input).toBeTruthy();
    await pickViaInput(input, makeFile('frame-start.png', 'image/png'));

    // The picker payload carried the permanent asset identity into studio state.
    setPrompt(studio, 'Cinema prompt', 'a neon city rooftop at dusk');
    const generateBtn = studio.querySelector('button[aria-label="Generate cinema shot"]');
    await generateBtn.onclick();
    await flush();

    expect(studioMedia.resolveMuapiMediaRef).toHaveBeenCalledWith(
      expect.objectContaining({ url: FRAME_URL, assetId: 'asset-frame-1' }),
    );

    expect(muapi.generateI2V).toHaveBeenCalledTimes(1);
    const params = muapi.generateI2V.mock.calls[0][0];
    expect(params.image_url).toBe('https://api.muapi.ai/tmp/resolved-asset-frame-1');
  }, 30000);
});
