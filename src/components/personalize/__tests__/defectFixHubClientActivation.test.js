/**
 * defectFixHubClientActivation.test.js
 *
 * Regression: "Create profile" called `clientProfileStore.addClient()`
 * but never activated the new profile — `addClient` does not touch
 * `currentClientId` and the panel exposed no client selector, so the
 * fresh profile stayed inactive and the form kept re-rendering empty.
 *
 * Also pins the shared-media rendering half of the base64 defect:
 * an entry whose value is ALREADY a data URL must not be double-prefixed.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// ─── Fake stores (mocking idiom from personalizationHubPanel.test.js) ──────

function makeStore() {
  const listeners = new Set();
  return {
    subscribe: (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    emit: () => listeners.forEach((fn) => fn()),
    listenerCount: () => listeners.size,
  };
}

let clientState = { clients: [], currentClientId: null, hydrated: true };
let assetState = { assets: [], removed: [], hydrated: true };
let sharedState = { entries: [], hydrated: true };

const clientStore = makeStore();
const assetStore = makeStore();
const sharedStore = makeStore();

const addClient = vi.fn((partial) => {
  const client = { id: 'client-new', ...partial };
  clientState = { ...clientState, clients: [...clientState.clients, client] };
  return client;
});
const updateClient = vi.fn((id, patch) => ({ id, ...patch }));
const setCurrentClientId = vi.fn((id) => {
  clientState = { ...clientState, currentClientId: id || null };
  clientStore.emit();
});
const addAsset = vi.fn((input) => ({ id: `asset-${input.role}-new`, ...input, isPrimary: false }));

vi.mock('../clientProfileStore.js', () => ({
  clientProfileStore: {
    getState: () => clientState,
    subscribe: (fn) => clientStore.subscribe(fn),
    addClient: (partial) => addClient(partial),
    updateClient: (id, patch) => updateClient(id, patch),
    setCurrentClientId: (id) => setCurrentClientId(id),
  },
}));

vi.mock('../assetLibraryStore.js', () => ({
  assetLibraryStore: {
    getState: () => assetState,
    subscribe: (fn) => assetStore.subscribe(fn),
    addAsset: (input) => addAsset(input),
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

vi.mock('../studioBridge.js', () => ({
  hasPersonalizationData: () => true,
  resolveForRenderStudio: () => ({
    referenceImages: [], promptPrefix: '', clientProfile: null, assetIds: [], lastFrameUrl: null,
  }),
  resolveForCineGen: () => ({
    image_url: null, images_list: [], promptSuffix: '', clientProfile: null, assetIds: [], aspectRatio: null,
  }),
}));

vi.mock('../personalizeAiAssist.js', () => ({
  runAiAssistEdit: async () => ({ ok: true, id: 'pzo_x', images: [], videos: [] }),
  checkAiAssistAvailability: () => ({ ok: true }),
}));

const {
  mountPersonalizationHub,
  unmountPersonalizationHub,
  toOutputSrc,
} = await import('../PersonalizationHubPanel.js');

// ─── Harness ───────────────────────────────────────────────────────────────

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
  setCurrentClientId.mockClear();
  addAsset.mockClear();
  vi.useRealTimers();
});

afterEach(() => {
  unmountPersonalizationHub();
  document.body.innerHTML = '';
  vi.useRealTimers();
});

// ─── The defect ────────────────────────────────────────────────────────────

describe('defect: a newly created client profile becomes the active client', () => {
  it('activates the new profile and re-renders the form from it', () => {
    mountHub();
    const body = sectionBody('Client profile');
    expect(body.textContent).toContain('No client profile yet');

    const inputs = body.querySelectorAll('input');
    inputs[0].value = 'Acme Roofing';
    inputs[1].value = 'roofing';
    inputs[2].value = 'premium shingles';
    buttonByText('Create profile').click();

    expect(addClient).toHaveBeenCalledWith({
      businessName: 'Acme Roofing',
      industry: 'roofing',
      productService: 'premium shingles',
    });
    // The created profile is now the CURRENT client …
    expect(setCurrentClientId).toHaveBeenCalledWith('client-new');
    expect(clientState.currentClientId).toBe('client-new');

    // … the section shows which client is active …
    const rendered = sectionBody('Client profile');
    expect(rendered.querySelector('[data-hub-active-client]')).toBeTruthy();
    expect(rendered.querySelector('[data-hub-active-client]').dataset.hubActiveClient).toBe('client-new');
    expect(rendered.textContent).toContain('Active profile');
    expect(rendered.textContent).toContain('Acme Roofing');

    // … and the form is repopulated from the newly current client,
    // offering "Save profile" instead of re-rendering empty.
    const freshInputs = rendered.querySelectorAll('input');
    expect(freshInputs[0].value).toBe('Acme Roofing');
    expect(freshInputs[1].value).toBe('roofing');
    expect(freshInputs[2].value).toBe('premium shingles');
    expect(buttonByText('Save profile')).toBeTruthy();
    expect(buttonByText('Create profile')).toBeFalsy();
  });

  it('shows which client is active and switches when the selector changes', () => {
    clientState = {
      clients: [
        { id: 'c1', businessName: 'Acme Roofing', industry: 'roofing', productService: 'shingles' },
        { id: 'c2', businessName: 'Blue Tide Dental', industry: 'dental', productService: 'cleanings' },
      ],
      currentClientId: 'c1',
      hydrated: true,
    };
    mountHub();
    const body = sectionBody('Client profile');
    expect(body.querySelector('[data-hub-active-client]').dataset.hubActiveClient).toBe('c1');
    expect(body.textContent).toContain('Active profile:');
    expect(body.textContent).toContain('Acme Roofing');

    const select = body.querySelector('[data-hub-client-select]');
    expect(select).toBeTruthy();
    expect(select.querySelectorAll('option')).toHaveLength(2);
    select.value = 'c2';
    select.dispatchEvent(new Event('change'));
    expect(setCurrentClientId).toHaveBeenCalledWith('c2');
  });

  it('keeps the existing update path intact when a client is already active', () => {
    clientState = {
      clients: [{ id: 'c1', businessName: 'Acme Roofing', industry: 'roofing', productService: 'shingles' }],
      currentClientId: 'c1',
      hydrated: true,
    };
    mountHub();
    const body = sectionBody('Client profile');
    const inputs = body.querySelectorAll('input');
    inputs[0].value = 'Acme Roofing Co';
    buttonByText('Save profile').click();
    expect(updateClient).toHaveBeenCalledWith('c1', expect.objectContaining({ businessName: 'Acme Roofing Co' }));
    expect(addClient).not.toHaveBeenCalled();
  });
});

// ─── Base64 rendering half of the shared-media defect ─────────────────────

describe('toOutputSrc', () => {
  it('prefixes a raw base64 payload with a data URL', () => {
    expect(toOutputSrc({ outputIsBase64: true }, 'QUJD')).toBe('data:image/png;base64,QUJD');
    expect(toOutputSrc({ outputIsBase64: true, outputMime: 'image/jpeg' }, 'QUJD')).toBe('data:image/jpeg;base64,QUJD');
  });

  it('never double-prefixes a value that is already a data URL', () => {
    expect(toOutputSrc({ outputIsBase64: true }, 'data:image/png;base64,QUJD')).toBe('data:image/png;base64,QUJD');
    expect(toOutputSrc({ outputIsBase64: true }, 'DATA:image/png;base64,QUJD')).toBe('DATA:image/png;base64,QUJD');
  });

  it('passes normal URLs through untouched', () => {
    expect(toOutputSrc({ outputIsBase64: false }, 'https://muapi.test/out.mp4')).toBe('https://muapi.test/out.mp4');
    expect(toOutputSrc({}, 'https://x.test/a.png')).toBe('https://x.test/a.png');
    expect(toOutputSrc({ outputIsBase64: true }, '')).toBe('');
  });
});
