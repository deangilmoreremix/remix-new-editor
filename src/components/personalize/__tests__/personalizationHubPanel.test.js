/**
 * personalizationHubPanel.test.js
 *
 * Verifies the Personalization Hub panel: the user-reachable surface over
 * the EXISTING personalization stores. Every collaborator is mocked — the
 * panel is tested as a pure view over store APIs (same mocking idiom as
 * studioBridge.test.js). From this directory a sibling module is `../x.js`.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// ─── Fake stores + spies (assigned before the panel is imported) ──────────

function makeStore(initial) {
  const state = { ...initial };
  const listeners = new Set();
  return {
    getState: () => state,
    subscribe: (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    emit: () => listeners.forEach((fn) => fn(state)),
    listenerCount: () => listeners.size,
  };
}

let clientState = { clients: [], currentClientId: null, hydrated: true };
let assetState = { assets: [], removed: [], hydrated: true };
let sharedState = { entries: [], hydrated: true };

const clientStore = makeStore(clientState);
const assetStore = makeStore(assetState);
const sharedStore = makeStore(sharedState);

const addClient = vi.fn((partial) => ({ id: 'client-new', ...partial }));
const updateClient = vi.fn((id, patch) => ({ id, ...patch }));
const addAsset = vi.fn((input) => ({ id: `asset-${input.role}-new`, ...input, isPrimary: false }));
const removeAsset = vi.fn(() => true);
const setPrimary = vi.fn();
const importSelectedAssetIds = vi.fn();

vi.mock('../clientProfileStore.js', () => ({
  clientProfileStore: {
    getState: () => clientState,
    subscribe: (fn) => clientStore.subscribe(fn),
    addClient: (partial) => addClient(partial),
    updateClient: (id, patch) => updateClient(id, patch),
  },
}));

vi.mock('../assetLibraryStore.js', () => ({
  assetLibraryStore: {
    getState: () => assetState,
    subscribe: (fn) => assetStore.subscribe(fn),
    addAsset: (input) => addAsset(input),
    removeAsset: (id) => removeAsset(id),
    setPrimary: (role, id) => setPrimary(role, id),
    importSelectedAssetIds: (ids) => importSelectedAssetIds(ids),
  },
}));

vi.mock('../sharedMediaStore.js', () => ({
  sharedMediaStore: {
    getState: () => sharedState,
    subscribe: (fn) => sharedStore.subscribe(fn),
    getEntriesByClient: (clientId) => (
      clientId ? sharedState.entries.filter((e) => e.clientId === clientId) : sharedState.entries
    ),
  },
}));

const hasPersonalizationData = vi.fn(() => false);
const resolveForRenderStudio = vi.fn(() => ({
  referenceImages: [], promptPrefix: '', clientProfile: null, assetIds: [], lastFrameUrl: null,
}));
const resolveForCineGen = vi.fn(() => ({
  image_url: null, images_list: [], promptSuffix: '', clientProfile: null, assetIds: [], aspectRatio: null,
}));

vi.mock('../studioBridge.js', () => ({
  hasPersonalizationData: () => hasPersonalizationData(),
  resolveForRenderStudio: () => resolveForRenderStudio(),
  resolveForCineGen: () => resolveForCineGen(),
}));

const runAiAssistEdit = vi.fn(async () => ({ ok: true, id: 'pzo_test', images: [], videos: [] }));
const checkAiAssistAvailability = vi.fn(() => ({ ok: true }));

vi.mock('../personalizeAiAssist.js', () => ({
  runAiAssistEdit: (params) => runAiAssistEdit(params),
  checkAiAssistAvailability: (intent) => checkAiAssistAvailability(intent),
  AI_ASSIST_ROLES: ['face_identity', 'logo', 'product_reference', 'brand_reference', 'first_frame', 'last_frame'],
  AI_ASSIST_ROLE_LABELS: {
    face_identity: 'Person', logo: 'Logo', product_reference: 'Product',
    brand_reference: 'Brand', first_frame: 'First frame', last_frame: 'Last frame',
  },
}));

// The panel authenticates discovery with the CLERK session token
// (getPersonalizationAccessToken) — the app authenticates with Clerk, not
// Supabase Auth, so that is the only identity seam discovery uses.
const getPersonalizationAccessToken = vi.fn(async () => 'test-token');

vi.mock('../../../lib/personalizationAuth.js', () => ({
  getPersonalizationAccessToken: (...args) => getPersonalizationAccessToken(...args),
}));

const {
  mountPersonalizationHub,
  unmountPersonalizationHub,
  buildLibraryProjection,
  toOutputSrc,
  discoveryResultBuckets,
  planDiscoveryImport,
  HUB_ROLES,
  HUB_DISCOVERY_ENDPOINT,
  HUB_DISCOVERY_POLL_MS,
} = await import('../PersonalizationHubPanel.js');

// ─── Harness ──────────────────────────────────────────────────────────────

let container;

function mountHub() {
  container = document.createElement('div');
  document.body.appendChild(container);
  return mountPersonalizationHub(container);
}

function buttonByText(text) {
  return Array.from(container.querySelectorAll('button')).find((btn) => btn.textContent === text);
}

function sectionBody(title) {
  const heading = Array.from(container.querySelectorAll('.pzh-section > h4'))
    .find((h) => h.textContent === title);
  return heading ? heading.nextElementSibling : null;
}

beforeEach(() => {
  clientState = { clients: [], currentClientId: null, hydrated: true };
  assetState = { assets: [], removed: [], hydrated: true };
  sharedState = { entries: [], hydrated: true };
  addClient.mockClear();
  updateClient.mockClear();
  addAsset.mockClear();
  removeAsset.mockClear();
  setPrimary.mockClear();
  importSelectedAssetIds.mockClear();
  hasPersonalizationData.mockClear();
  hasPersonalizationData.mockReturnValue(false);
  resolveForRenderStudio.mockClear();
  resolveForRenderStudio.mockReturnValue({
    referenceImages: [], promptPrefix: '', clientProfile: null, assetIds: [], lastFrameUrl: null,
  });
  resolveForCineGen.mockClear();
  resolveForCineGen.mockReturnValue({
    image_url: null, images_list: [], promptSuffix: '', clientProfile: null, assetIds: [], aspectRatio: null,
  });
  runAiAssistEdit.mockClear();
  runAiAssistEdit.mockImplementation(async () => ({ ok: true, id: 'pzo_test', images: [], videos: [] }));
  checkAiAssistAvailability.mockClear();
  checkAiAssistAvailability.mockReturnValue({ ok: true });
  getPersonalizationAccessToken.mockClear();
  getPersonalizationAccessToken.mockImplementation(async () => 'test-token');
  vi.useRealTimers();
});

afterEach(() => {
  unmountPersonalizationHub();
  document.body.innerHTML = '';
  vi.useRealTimers();
});

// ─── Pure helpers ─────────────────────────────────────────────────────────

describe('pure helpers', () => {
  it('exposes the six spec roles', () => {
    expect(HUB_ROLES.map((r) => r.role)).toEqual([
      'face_identity', 'logo', 'product_reference', 'brand_reference', 'first_frame', 'last_frame',
    ]);
  });

  it('projects the flat asset list into the bucketed AssetLibrary shape', () => {
    const library = buildLibraryProjection([
      { id: 'f1', role: 'face_identity', url: 'https://x.test/f1.png', isPrimary: true },
      { id: 'l1', role: 'logo', url: 'https://x.test/l1.png', isPrimary: false },
      { id: 'ff', role: 'first_frame', url: 'https://x.test/ff.png', isPrimary: true },
      { id: 'x1', role: 'saved_reference', url: 'https://x.test/x.png', isPrimary: false },
    ]);
    expect(library.identities).toHaveLength(1);
    expect(library.primaryIdentity.id).toBe('f1');
    expect(library.logos[0].id).toBe('l1');
    expect(library.primaryLogo).toBeNull();
    expect(library.firstFrame.id).toBe('ff');
    expect(library.savedReferences).toHaveLength(1);
    expect(buildLibraryProjection(undefined).identities).toEqual([]);
  });

  it('turns base64 outputs into data URLs and passes URLs through', () => {
    expect(toOutputSrc({ outputIsBase64: true }, 'AAA')).toBe('data:image/png;base64,AAA');
    expect(toOutputSrc({}, 'https://x.test/a.png')).toBe('https://x.test/a.png');
    expect(toOutputSrc({ outputIsBase64: true }, '')).toBe('');
  });

  it('normalizes discovery results and plans imports', () => {
    const found = {
      logos: ['https://s.test/logo.png'],
      products: [],
      brandReferences: ['https://s.test/brand.png'],
      urls: ['https://s.test/logo.png', 'https://s.test/other.png'],
    };
    const buckets = discoveryResultBuckets(found);
    expect(buckets.map((b) => b.role)).toEqual(['logo', 'brand_reference', 'saved_reference']);

    const existing = [{ id: 'a-logo', role: 'logo', url: 'https://s.test/logo.png', isPrimary: true }];
    const plan = planDiscoveryImport(found, existing);
    expect(plan).toHaveLength(3);
    expect(plan[0]).toMatchObject({ action: 'import', id: 'a-logo' });
    expect(plan[1]).toMatchObject({ action: 'add', role: 'brand_reference', name: 'brand.png' });
    expect(plan[2]).toMatchObject({ action: 'add', role: 'saved_reference', name: 'other.png' });
    expect(discoveryResultBuckets(undefined)).toEqual([]);
  });
});

// ─── Mount / unmount ──────────────────────────────────────────────────────

describe('mount / unmount', () => {
  it('requires a DOM container', () => {
    expect(() => mountPersonalizationHub(null)).toThrow(/container must be a DOM element/);
  });

  it('renders every hub section', () => {
    mountHub();
    const text = container.textContent;
    ['Personalization Hub', 'Client profile', 'Asset library', 'AI Assist', 'Discover from website', 'Send to studio']
      .forEach((label) => expect(text).toContain(label));
    expect(container.querySelector('.personalization-hub')).toBeTruthy();
  });

  it('tears down DOM, subscriptions and discovery jobs', () => {
    const hub = mountHub();
    expect(clientStore.listenerCount()).toBe(1);
    hub.destroy();
    expect(container.querySelector('.personalization-hub')).toBeNull();
    expect(clientStore.listenerCount()).toBe(0);
    expect(() => clientStore.emit()).not.toThrow();
    // Unmounting with nothing mounted must be a safe no-op.
    unmountPersonalizationHub();
  });

  it('replaces a previous hub when mounted twice', () => {
    mountHub();
    mountHub();
    expect(container.querySelectorAll('.personalization-hub')).toHaveLength(1);
    expect(clientStore.listenerCount()).toBe(1);
  });
});

// ─── Client profile ───────────────────────────────────────────────────────

describe('client profile section', () => {
  it('creates a profile through addClient', () => {
    mountHub();
    expect(sectionBody('Client profile').textContent).toContain('No client profile yet');
    const inputs = sectionBody('Client profile').querySelectorAll('input');
    inputs[0].value = 'Acme Roofing';
    inputs[1].value = 'roofing';
    inputs[2].value = 'premium shingles';
    buttonByText('Create profile').click();
    expect(addClient).toHaveBeenCalledWith({
      businessName: 'Acme Roofing',
      industry: 'roofing',
      productService: 'premium shingles',
    });
  });

  it('shows the current client and updates through updateClient', () => {
    clientState = {
      clients: [{
        id: 'c1', businessName: 'Acme Roofing', industry: 'roofing', productService: 'premium shingles',
      }],
      currentClientId: 'c1',
      hydrated: true,
    };
    mountHub();
    const body = sectionBody('Client profile');
    expect(body.textContent).toContain('Acme Roofing');
    expect(body.textContent).toContain('roofing');
    expect(body.textContent).toContain('premium shingles');
    expect(buttonByText('Save profile')).toBeTruthy();

    const inputs = body.querySelectorAll('input');
    expect(inputs[0].value).toBe('Acme Roofing');
    inputs[0].value = 'Acme Roofing Co';
    buttonByText('Save profile').click();
    expect(updateClient).toHaveBeenCalledWith('c1', expect.objectContaining({ businessName: 'Acme Roofing Co' }));
  });
});

// ─── Asset library ────────────────────────────────────────────────────────

describe('asset library section', () => {
  const assets = [
    { id: 'f1', role: 'face_identity', name: 'founder.png', url: 'https://x.test/f1.png', isPrimary: true },
    { id: 'f2', role: 'face_identity', name: 'ceo.png', url: 'https://x.test/f2.png', isPrimary: false },
    { id: 'l1', role: 'logo', name: 'logo.png', url: 'https://x.test/l1.png', isPrimary: true },
  ];

  beforeEach(() => {
    assetState = { assets: assets.map((a) => ({ ...a })), removed: [], hydrated: true };
  });

  it('renders a grid per spec role with thumbnails and primary badges', () => {
    mountHub();
    const personBlock = container.querySelector('[data-hub-role="face_identity"]');
    expect(personBlock.textContent).toContain('Person (2)');
    const thumbs = personBlock.querySelectorAll('img.pzh-thumb');
    expect(thumbs).toHaveLength(2);
    expect(thumbs[0].getAttribute('src')).toBe('https://x.test/f1.png');
    expect(personBlock.querySelectorAll('.pzh-badge')).toHaveLength(1);
    expect(personBlock.textContent).toContain('Primary');
    // Roles with no assets still render their "add from URL" affordance.
    const productBlock = container.querySelector('[data-hub-role="product_reference"]');
    expect(productBlock.textContent).toContain('Product (0)');
    expect(productBlock.querySelector('[data-hub-add-input="product_reference"]')).toBeTruthy();
  });

  it('sets primary, removes and adds assets', () => {
    mountHub();
    const personBlock = container.querySelector('[data-hub-role="face_identity"]');
    const tiles = personBlock.querySelectorAll('.pzh-tile');

    // Second tile is not primary -> it offers "Set primary".
    const setPrimaryBtn = Array.from(tiles[1].querySelectorAll('button')).find((b) => b.textContent === 'Set primary');
    setPrimaryBtn.click();
    expect(setPrimary).toHaveBeenCalledWith('face_identity', 'f2');

    const removeBtn = Array.from(tiles[1].querySelectorAll('button')).find((b) => b.textContent === 'Remove');
    removeBtn.click();
    expect(removeAsset).toHaveBeenCalledWith('f2');

    const urlInput = personBlock.querySelector('[data-hub-add-input="face_identity"]');
    urlInput.value = 'https://cdn.test/new-founder.png';
    Array.from(personBlock.querySelectorAll('button')).find((b) => b.textContent === 'Add').click();
    expect(addAsset).toHaveBeenCalledWith({
      role: 'face_identity', name: 'new-founder.png', url: 'https://cdn.test/new-founder.png',
    });
  });

  it('ignores an empty add-from-URL submission', () => {
    mountHub();
    const personBlock = container.querySelector('[data-hub-role="face_identity"]');
    Array.from(personBlock.querySelectorAll('button')).find((b) => b.textContent === 'Add').click();
    expect(addAsset).not.toHaveBeenCalled();
  });

  it('re-renders when the library store changes', () => {
    mountHub();
    assetState.assets = [...assetState.assets, {
      id: 'l2', role: 'logo', name: 'logo2.png', url: 'https://x.test/l2.png', isPrimary: false,
    }];
    assetStore.emit();
    const logoBlock = container.querySelector('[data-hub-role="logo"]');
    expect(logoBlock.textContent).toContain('Logo (2)');
  });
});

// ─── AI Assist ────────────────────────────────────────────────────────────

describe('AI assist section', () => {
  it('runs an edit with the projected library and current client', async () => {
    clientState = { clients: [{ id: 'c1', businessName: 'Acme' }], currentClientId: 'c1', hydrated: true };
    assetState = {
      assets: [{ id: 'l1', role: 'logo', name: 'logo.png', url: 'https://x.test/l1.png', isPrimary: true }],
      removed: [], hydrated: true,
    };
    mountHub();

    const body = sectionBody('AI Assist');
    const select = body.querySelector('select');
    select.value = 'logo';
    const textarea = body.querySelector('textarea');
    textarea.value = 'remove the background';
    buttonByText('Edit with AI').click();

    await vi.waitFor(() => expect(runAiAssistEdit).toHaveBeenCalledTimes(1));
    const params = runAiAssistEdit.mock.calls[0][0];
    expect(params.role).toBe('logo');
    expect(params.instruction).toBe('remove the background');
    expect(params.options.clientId).toBe('c1');
    expect(params.options.library.logos[0].id).toBe('l1');
    expect(params.options.library.primaryLogo.id).toBe('l1');
    expect(body.querySelector('[data-hub-ai-status]').textContent).toContain('Done');
  });

  it('surfaces provider failures without throwing', async () => {
    runAiAssistEdit.mockImplementation(async () => ({ ok: false, code: 'NO_ASSET', reason: 'No asset found for role "logo".' }));
    mountHub();
    sectionBody('AI Assist').querySelector('textarea').value = 'brighten it';
    buttonByText('Edit with AI').click();
    await vi.waitFor(() => {
      expect(sectionBody('AI Assist').querySelector('[data-hub-ai-status]').textContent).toContain('No asset found');
    });
  });

  it('requires an instruction', () => {
    mountHub();
    buttonByText('Edit with AI').click();
    expect(sectionBody('AI Assist').querySelector('[data-hub-ai-status]').textContent).toContain('instruction is required');
    expect(runAiAssistEdit).not.toHaveBeenCalled();
  });

  it('lists shared-media outputs: b64 images as data URLs, videos as URLs', () => {
    sharedState = {
      entries: [
        {
          id: 'sm-1', clientId: 'c1', outputType: 'image', outputIsBase64: true,
          outputUrls: ['AAA'], createdAt: '2026-10-01T10:00:00.000Z',
        },
        {
          id: 'sm-2', clientId: 'c1', outputType: 'video', outputIsBase64: false,
          outputUrls: ['https://muapi.test/out.mp4'], createdAt: '2026-10-02T10:00:00.000Z',
        },
      ],
      hydrated: true,
    };
    clientState = { clients: [{ id: 'c1' }], currentClientId: 'c1', hydrated: true };
    mountHub();
    const results = sectionBody('AI Assist').querySelector('[data-hub-ai-results]');
    const img = results.querySelector('img');
    expect(img.getAttribute('src')).toBe('data:image/png;base64,AAA');
    const video = results.querySelector('video');
    expect(video.getAttribute('src')).toBe('https://muapi.test/out.mp4');
    expect(video.controls).toBe(true);
  });

  it('shows an empty state until outputs exist', () => {
    mountHub();
    const results = sectionBody('AI Assist').querySelector('[data-hub-ai-results]');
    expect(results.textContent).toContain('No AI Assist outputs yet');
  });

  it('re-renders results when the shared media store changes', () => {
    mountHub();
    sharedState.entries = [{
      id: 'sm-1', clientId: null, outputType: 'image', outputIsBase64: false,
      outputUrls: ['https://x.test/out.png'], createdAt: '2026-10-01T10:00:00.000Z',
    }];
    sharedStore.emit();
    const results = sectionBody('AI Assist').querySelector('[data-hub-ai-results]');
    expect(results.querySelector('img').getAttribute('src')).toBe('https://x.test/out.png');
  });
});

// ─── Website discovery ────────────────────────────────────────────────────
//
// The panel no longer imports the Node-only discovery engine; it talks to
// the personalization-discovery Netlify function over fetch. Deeper failure
// and cleanup coverage lives in hubDiscoveryIntegration.test.js — these
// tests pin the panel-level wiring.

describe('discover from website section', () => {
  function jsonResponse(body, status = 200) {
    return { ok: status >= 200 && status < 300, status, json: async () => body };
  }

  /**
   * Fetch stub: first POST starts a job, every GET poll answers `running`
   * until `doneAfter` polls, then returns the completed payload.
   */
  function stubDiscoveryServer(doneAfter = 1, found) {
    const calls = { posts: [], gets: [], deletes: [] };
    let polls = 0;
    global.fetch = vi.fn(async (url, options = {}) => {
      const target = String(url);
      const method = (options && options.method) || 'GET';
      if (target === HUB_DISCOVERY_ENDPOINT && method === 'POST') {
        calls.posts.push(options);
        return jsonResponse({ jobId: 'job-1', status: 'pending' });
      }
      if (target.startsWith(`${HUB_DISCOVERY_ENDPOINT}?jobId=`) && method === 'DELETE') {
        calls.deletes.push(target);
        return jsonResponse({ jobId: 'job-1', status: 'cancelled' });
      }
      polls += 1;
      calls.gets.push(target);
      if (polls < doneAfter) return jsonResponse({ jobId: 'job-1', status: 'running', errors: [] });
      return jsonResponse({
        jobId: 'job-1',
        status: 'done',
        errors: [],
        found: found || {
          logos: ['https://s.test/logo.png'],
          products: ['https://s.test/product.png'],
          brandReferences: [],
          urls: [],
        },
      });
    });
    return calls;
  }

  function startDiscovery(url) {
    const body = sectionBody('Discover from website');
    body.querySelector('[data-hub-discover-input]').value = url;
    Array.from(body.querySelectorAll('button')).find((b) => b.textContent === 'Discover').click();
  }

  function discoveryStatus() {
    return sectionBody('Discover from website').querySelector('[data-hub-discover-status]').textContent;
  }

  afterEach(() => {
    delete global.fetch;
  });

  it('posts the url to the function, polls and renders found assets', async () => {
    vi.useFakeTimers();
    const calls = stubDiscoveryServer(1);
    mountHub();
    startDiscovery('https://s.test');
    await vi.advanceTimersByTimeAsync(HUB_DISCOVERY_POLL_MS);
    expect(calls.posts).toHaveLength(1);
    expect(JSON.parse(calls.posts[0].body)).toEqual({ url: 'https://s.test' });
    const results = sectionBody('Discover from website').querySelector('[data-hub-discover-results]');
    expect(results.textContent).toContain('Logos (1)');
    expect(results.textContent).toContain('Products (1)');
    expect(discoveryStatus()).toContain('Discovery complete');
  });

  it('imports discovered assets into the library', async () => {
    vi.useFakeTimers();
    assetState = {
      assets: [{ id: 'a-logo', role: 'logo', name: 'logo.png', url: 'https://s.test/logo.png', isPrimary: true }],
      removed: [], hydrated: true,
    };
    stubDiscoveryServer(1, {
      logos: ['https://s.test/logo.png'], products: [], brandReferences: [], urls: ['https://s.test/other.png'],
    });
    mountHub();
    startDiscovery('https://s.test');
    await vi.advanceTimersByTimeAsync(HUB_DISCOVERY_POLL_MS);

    Array.from(sectionBody('Discover from website').querySelectorAll('button'))
      .find((b) => b.textContent === 'Import selected')
      .click();
    // Existing URL -> import marker; new URL -> addAsset.
    expect(importSelectedAssetIds).toHaveBeenCalledWith(['a-logo']);
    expect(addAsset).toHaveBeenCalledWith({ role: 'saved_reference', name: 'other.png', url: 'https://s.test/other.png' });
  });

  it('reports job errors and stops polling', async () => {
    vi.useFakeTimers();
    const calls = { gets: [] };
    global.fetch = vi.fn(async (url) => {
      const target = String(url);
      if (target === HUB_DISCOVERY_ENDPOINT) return { ok: true, status: 200, json: async () => ({ jobId: 'job-1', status: 'pending' }) };
      calls.gets.push(target);
      return { ok: true, status: 200, json: async () => ({ jobId: 'job-1', status: 'failed', errors: ['blocked domain'] }) };
    });
    mountHub();
    startDiscovery('https://s.test');
    await vi.advanceTimersByTimeAsync(HUB_DISCOVERY_POLL_MS);
    expect(discoveryStatus()).toContain('blocked domain');
    const getsBefore = calls.gets.length;
    await vi.advanceTimersByTimeAsync(HUB_DISCOVERY_POLL_MS * 3);
    expect(calls.gets.length).toBe(getsBefore);
  });

  it('cancels the server-side job on unmount', async () => {
    vi.useFakeTimers();
    const calls = stubDiscoveryServer(Number.MAX_SAFE_INTEGER);
    mountHub();
    startDiscovery('https://s.test');
    await vi.advanceTimersByTimeAsync(HUB_DISCOVERY_POLL_MS);
    expect(calls.gets.length).toBeGreaterThanOrEqual(1);
    unmountPersonalizationHub();
    await vi.advanceTimersByTimeAsync(0);
    expect(calls.deletes).toHaveLength(1);
    expect(calls.deletes[0]).toContain('jobId=job-1');
    const getsBefore = calls.gets.length;
    await vi.advanceTimersByTimeAsync(HUB_DISCOVERY_POLL_MS * 3);
    expect(calls.gets.length).toBe(getsBefore);
  });
});

// ─── Send to studio ───────────────────────────────────────────────────────

describe('send to studio section', () => {
  it('explains what studios receive once personalization data exists', () => {
    hasPersonalizationData.mockReturnValue(true);
    resolveForRenderStudio.mockReturnValue({
      referenceImages: [{ url: 'https://x.test/l1.png', role: 'logo', assetId: 'l1' }],
      promptPrefix: 'Create imagery for Acme Roofing.',
      clientProfile: { id: 'c1' },
      assetIds: ['l1'],
      lastFrameUrl: 'https://x.test/last.png',
    });
    resolveForCineGen.mockReturnValue({
      image_url: 'https://x.test/l1.png',
      images_list: ['https://x.test/p1.png'],
      promptSuffix: 'Include the call to action: "Call now".',
      clientProfile: { id: 'c1' },
      assetIds: ['l1', 'p1'],
      aspectRatio: '16:9',
    });
    mountHub();
    const text = sectionBody('Send to studio').textContent;
    expect(text).toContain('Personalization data active');
    expect(text).toContain('reference images:1');
    expect(text).toContain('Create imagery for Acme Roofing.');
    expect(text).toContain('https://x.test/last.png');
    expect(text).toContain('https://x.test/l1.png');
    expect(text).toContain('extra references:1');
    expect(text).toContain('Call now');
  });

  it('stays quiet when there is no personalization data', () => {
    mountHub();
    expect(sectionBody('Send to studio').textContent).toContain('No personalization data yet');
  });

  it('re-renders when a client profile is added', () => {
    mountHub();
    clientState = { clients: [{ id: 'c1', businessName: 'Acme' }], currentClientId: 'c1', hydrated: true };
    hasPersonalizationData.mockReturnValue(true);
    clientStore.emit();
    expect(sectionBody('Send to studio').textContent).toContain('Personalization data active');
  });
});
