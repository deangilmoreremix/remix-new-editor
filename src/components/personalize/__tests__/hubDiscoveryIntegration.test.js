/**
 * hubDiscoveryIntegration.test.js
 *
 * Integration tests for the Personalization Hub's website-discovery flow
 * AFTER the stopgap browser-side import was replaced by calls to the
 * personalization-discovery Netlify function.
 *
 * The Node-only discovery engine is NOT mocked here — it must not even be
 * imported by the panel. Instead `global.fetch` simulates the server:
 *   POST /.netlify/functions/personalization-discovery        → start
 *   GET  /.netlify/functions/personalization-discovery?jobId= → poll
 *   DELETE ...?jobId=                                          → cancel
 * Sibling stores are mocked at ../x.js depth (same idiom as
 * personalizationHubPanel.test.js).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// ─── Fake stores (same idiom as personalizationHubPanel.test.js) ──────────

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

vi.mock('../studioBridge.js', () => ({
  hasPersonalizationData: () => false,
  resolveForRenderStudio: () => ({
    referenceImages: [], promptPrefix: '', clientProfile: null, assetIds: [], lastFrameUrl: null,
  }),
  resolveForCineGen: () => ({
    image_url: null, images_list: [], promptSuffix: '', clientProfile: null, assetIds: [], aspectRatio: null,
  }),
}));

vi.mock('../personalizeAiAssist.js', () => ({
  runAiAssistEdit: async () => ({ ok: true, id: 'pzo_test', images: [], videos: [] }),
  checkAiAssistAvailability: () => ({ ok: true }),
  AI_ASSIST_ROLES: [],
  AI_ASSIST_ROLE_LABELS: {},
}));

// The panel reads the caller's Supabase session token (sent to the function,
// exactly like PersonalizeModal does) — mock it so the Authorization header
// is deterministic.
const getSession = vi.fn(async () => ({ data: { session: { access_token: 'test-session-token' } } }));

vi.mock('../../../lib/supabase.js', () => ({
  supabase: { auth: { getSession: () => getSession() } },
}));

const {
  mountPersonalizationHub,
  unmountPersonalizationHub,
  HUB_DISCOVERY_ENDPOINT,
  HUB_DISCOVERY_POLL_MS,
  HUB_DISCOVERY_MAX_POLLS,
} = await import('../PersonalizationHubPanel.js');

// ─── Fake server ──────────────────────────────────────────────────────────

function jsonResponse(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  };
}

const fetchMock = vi.fn();

/** Build a fetch mock: `start` answers POST, `poll` answers each GET poll. */
function stubServer({ start, poll }) {
  let pollIndex = 0;
  fetchMock.mockImplementation(async (url, options = {}) => {
    const target = String(url);
    const method = (options && options.method) || 'GET';
    if (target === HUB_DISCOVERY_ENDPOINT && method === 'POST') {
      return typeof start === 'function' ? start(target, options) : jsonResponse({ jobId: 'job-9', status: 'pending' });
    }
    if (target.startsWith(HUB_DISCOVERY_ENDPOINT) && method === 'DELETE') {
      return jsonResponse({ jobId: 'job-9', status: 'cancelled' });
    }
    if (target.startsWith(`${HUB_DISCOVERY_ENDPOINT}?jobId=`)) {
      pollIndex += 1;
      return typeof poll === 'function' ? poll(pollIndex, target) : jsonResponse({ jobId: 'job-9', status: 'pending', errors: [] });
    }
    return jsonResponse({ error: 'unexpected route' }, 404);
  });
}

// ─── Harness ──────────────────────────────────────────────────────────────

let container;

function mountHub() {
  container = document.createElement('div');
  document.body.appendChild(container);
  return mountPersonalizationHub(container);
}

function discoveryBody() {
  const heading = Array.from(container.querySelectorAll('.pzh-section > h4'))
    .find((h) => h.textContent === 'Discover from website');
  return heading ? heading.nextElementSibling : null;
}

function discoveryStatusText() {
  return discoveryBody().querySelector('[data-hub-discover-status]').textContent;
}

function discoveryResultsText() {
  return discoveryBody().querySelector('[data-hub-discover-results]').textContent;
}

function startDiscovery(url) {
  const body = discoveryBody();
  body.querySelector('[data-hub-discover-input]').value = url;
  Array.from(body.querySelectorAll('button')).find((b) => b.textContent === 'Discover').click();
}

function getCalls(method, predicate) {
  return fetchMock.mock.calls.filter(([url, options]) => {
    if (String(url) !== HUB_DISCOVERY_ENDPOINT && !String(url).startsWith(`${HUB_DISCOVERY_ENDPOINT}?`)) return false;
    const m = (options && options.method) || 'GET';
    if (m !== method) return false;
    return predicate ? predicate(url, options) : true;
  });
}

const FOUND = Object.freeze({
  logos: ['https://s.test/logo.png'],
  products: ['https://s.test/product.png'],
  brandReferences: ['https://s.test/brand.png'],
  urls: ['https://s.test/other.png'],
});

beforeEach(() => {
  clientState = { clients: [], currentClientId: null, hydrated: true };
  assetState = { assets: [], removed: [], hydrated: true };
  sharedState = { entries: [], hydrated: true };
  addAsset.mockClear();
  importSelectedAssetIds.mockClear();
  getSession.mockClear();
  getSession.mockImplementation(async () => ({ data: { session: { access_token: 'test-session-token' } } }));
  fetchMock.mockReset();
  global.fetch = fetchMock;
  vi.useFakeTimers();
});

afterEach(() => {
  unmountPersonalizationHub();
  document.body.innerHTML = '';
  vi.useRealTimers();
  delete global.fetch;
});

// ─── Start → poll → render → import ───────────────────────────────────────

describe('discovery start and poll loop', () => {
  it('POSTs the url, polls until done, then renders assets grouped by category', async () => {
    stubServer({
      start: () => jsonResponse({ jobId: 'job-9', status: 'pending' }),
      poll: (index) => (
        index === 1
          ? jsonResponse({ jobId: 'job-9', status: 'running', errors: [] })
          : jsonResponse({ jobId: 'job-9', status: 'done', errors: [], found: FOUND })
      ),
    });
    mountHub();
    startDiscovery('https://s.test');
    // Flush the POST + first poll (microtasks), then let the interval fire.
    await vi.advanceTimersByTimeAsync(HUB_DISCOVERY_POLL_MS);

    const post = getCalls('POST')[0];
    expect(post).toBeTruthy();
    expect(JSON.parse(post[1].body)).toEqual({ url: 'https://s.test' });
    expect(post[1].headers.Authorization).toBe('Bearer test-session-token');

    expect(discoveryStatusText()).toContain('Discovery complete');
    const results = discoveryResultsText();
    expect(results).toContain('Logos (1)');
    expect(results).toContain('Products (1)');
    expect(results).toContain('Brand references (1)');
    expect(results).toContain('Other images (1)');

    // Polling stopped on the terminal status: no further GETs.
    const getsBefore = getCalls('GET').length;
    await vi.advanceTimersByTimeAsync(HUB_DISCOVERY_POLL_MS * 5);
    expect(getCalls('GET').length).toBe(getsBefore);
  });

  it('shows engine-reported errors verbatim and stops polling', async () => {
    stubServer({
      poll: () => jsonResponse({ jobId: 'job-9', status: 'failed', errors: ['Domain "facebook.com" is not supported'] }),
    });
    mountHub();
    startDiscovery('https://facebook.com');
    await vi.advanceTimersByTimeAsync(HUB_DISCOVERY_POLL_MS);

    expect(discoveryStatusText()).toContain('Domain "facebook.com" is not supported');
    const getsBefore = getCalls('GET').length;
    await vi.advanceTimersByTimeAsync(HUB_DISCOVERY_POLL_MS * 3);
    expect(getCalls('GET').length).toBe(getsBefore);
  });

  it('surfaces the SSRF rejection reason verbatim and never starts polling', async () => {
    stubServer({
      start: () => jsonResponse({ error: 'UNSAFE_URL', reason: 'Hostname resolves to private IP 127.0.0.1' }, 400),
    });
    mountHub();
    startDiscovery('http://localhost');
    await vi.advanceTimersByTimeAsync(HUB_DISCOVERY_POLL_MS);

    expect(discoveryStatusText()).toBe('Hostname resolves to private IP 127.0.0.1');
    expect(getCalls('GET')).toHaveLength(0);
    expect(discoveryResultsText()).toBe('');
  });

  it('reports cancelled jobs', async () => {
    stubServer({
      poll: () => jsonResponse({ jobId: 'job-9', status: 'cancelled', errors: [] }),
    });
    mountHub();
    startDiscovery('https://s.test');
    await vi.advanceTimersByTimeAsync(HUB_DISCOVERY_POLL_MS);
    expect(discoveryStatusText()).toBe('Discovery cancelled.');
  });

  it('asks the user to re-submit when the server reports unknown', async () => {
    stubServer({
      poll: () => jsonResponse({ jobId: 'job-9', status: 'unknown', errors: [] }),
    });
    mountHub();
    startDiscovery('https://s.test');
    await vi.advanceTimersByTimeAsync(HUB_DISCOVERY_POLL_MS);
    expect(discoveryStatusText()).toContain('Re-submit');
    const getsBefore = getCalls('GET').length;
    await vi.advanceTimersByTimeAsync(HUB_DISCOVERY_POLL_MS * 3);
    expect(getCalls('GET').length).toBe(getsBefore);
  });

  it('stops and explains when the job 404s (expired)', async () => {
    stubServer({
      start: () => jsonResponse({ jobId: 'job-9', status: 'pending' }),
      poll: () => jsonResponse({ error: 'Unknown jobId', status: 'not_found' }, 404),
    });
    mountHub();
    startDiscovery('https://s.test');
    await vi.advanceTimersByTimeAsync(HUB_DISCOVERY_POLL_MS);
    expect(discoveryStatusText()).toContain('no longer running');
  });
});

// ─── Failure handling ─────────────────────────────────────────────────────

describe('discovery failure handling', () => {
  it('ignores an empty url without calling the server', async () => {
    stubServer({});
    mountHub();
    startDiscovery('   ');
    await vi.advanceTimersByTimeAsync(HUB_DISCOVERY_POLL_MS);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(discoveryStatusText()).toContain('Enter a website URL');
  });

  it('rejects a non-http(s) url client-side', async () => {
    stubServer({});
    mountHub();
    startDiscovery('ftp://files.example.com');
    await vi.advanceTimersByTimeAsync(HUB_DISCOVERY_POLL_MS);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(discoveryStatusText()).toContain('http:// or https://');
  });

  it('explains that sign-in is required on 401', async () => {
    stubServer({ start: () => jsonResponse({ error: 'Unauthorized' }, 401) });
    mountHub();
    startDiscovery('https://s.test');
    await vi.advanceTimersByTimeAsync(HUB_DISCOVERY_POLL_MS);
    expect(discoveryStatusText()).toContain('Sign in');
    expect(getCalls('GET')).toHaveLength(0);
  });

  it('reports service unavailability when the fetch throws', async () => {
    fetchMock.mockRejectedValue(new Error('network down'));
    mountHub();
    startDiscovery('https://s.test');
    await vi.advanceTimersByTimeAsync(HUB_DISCOVERY_POLL_MS);
    expect(discoveryStatusText()).toBe('Discovery service unavailable. Please try again later.');
  });

  it('surfaces a job-limit rejection verbatim', async () => {
    stubServer({
      start: () => jsonResponse({ error: 'JOB_LIMIT_REACHED', message: 'Concurrent job limit (3) reached' }, 429),
    });
    mountHub();
    startDiscovery('https://s.test');
    await vi.advanceTimersByTimeAsync(HUB_DISCOVERY_POLL_MS);
    expect(discoveryStatusText()).toBe('Concurrent job limit (3) reached');
  });

  it('times out a stuck job, cancels it server-side and stops polling', async () => {
    stubServer({ poll: () => jsonResponse({ jobId: 'job-9', status: 'running', errors: [] }) });
    mountHub();
    startDiscovery('https://s.test');
    await vi.advanceTimersByTimeAsync(HUB_DISCOVERY_POLL_MS * (HUB_DISCOVERY_MAX_POLLS + 3));

    expect(discoveryStatusText()).toContain('timed out');
    const deletes = getCalls('DELETE');
    expect(deletes.length).toBeGreaterThanOrEqual(1);
    expect(deletes[0][0]).toContain('jobId=job-9');
    const getsBefore = getCalls('GET').length;
    await vi.advanceTimersByTimeAsync(HUB_DISCOVERY_POLL_MS * 3);
    expect(getCalls('GET').length).toBe(getsBefore);
  });

  it('keeps polling through transient GET errors until the deadline', async () => {
    stubServer({
      start: () => jsonResponse({ jobId: 'job-9', status: 'pending' }),
      poll: (index) => (
        index < 3
          ? { ok: false, status: 500, json: async () => ({ error: 'boom' }) }
          : jsonResponse({ jobId: 'job-9', status: 'done', errors: [], found: FOUND })
      ),
    });
    mountHub();
    startDiscovery('https://s.test');
    await vi.advanceTimersByTimeAsync(HUB_DISCOVERY_POLL_MS * 4);
    expect(discoveryStatusText()).toContain('Discovery complete');
  });
});

// ─── Cleanup ──────────────────────────────────────────────────────────────

describe('discovery cleanup', () => {
  it('cancels the server-side job and clears the interval on unmount', async () => {
    stubServer({ poll: () => jsonResponse({ jobId: 'job-9', status: 'running', errors: [] }) });
    mountHub();
    startDiscovery('https://s.test');
    await vi.advanceTimersByTimeAsync(HUB_DISCOVERY_POLL_MS);
    expect(getCalls('GET').length).toBeGreaterThanOrEqual(1);

    unmountPersonalizationHub();
    // The cancel DELETE is fire-and-forget behind an async header chain.
    await vi.advanceTimersByTimeAsync(0);
    const deletes = getCalls('DELETE');
    expect(deletes).toHaveLength(1);
    expect(deletes[0][0]).toContain('jobId=job-9');

    // No leaked interval: no further polls after unmount.
    const getsBefore = getCalls('GET').length;
    await vi.advanceTimersByTimeAsync(HUB_DISCOVERY_POLL_MS * 5);
    expect(getCalls('GET').length).toBe(getsBefore);
  });

  it('starting a new discovery cancels the previous job', async () => {
    stubServer({ poll: () => jsonResponse({ jobId: 'job-9', status: 'running', errors: [] }) });
    mountHub();
    startDiscovery('https://s.test');
    await vi.advanceTimersByTimeAsync(HUB_DISCOVERY_POLL_MS);
    startDiscovery('https://other.test');
    await vi.advanceTimersByTimeAsync(HUB_DISCOVERY_POLL_MS);

    expect(getCalls('DELETE').length).toBe(1);
    expect(getCalls('POST')).toHaveLength(2);
  });
});

// ─── Import flow ──────────────────────────────────────────────────────────

describe('discovery import', () => {
  it('imports known assets and adds new ones under the right roles', async () => {
    assetState = {
      assets: [{ id: 'a-logo', role: 'logo', name: 'logo.png', url: 'https://s.test/logo.png', isPrimary: true }],
      removed: [], hydrated: true,
    };
    stubServer({
      poll: () => jsonResponse({ jobId: 'job-9', status: 'done', errors: [], found: FOUND }),
    });
    mountHub();
    startDiscovery('https://s.test');
    await vi.advanceTimersByTimeAsync(HUB_DISCOVERY_POLL_MS);

    Array.from(discoveryBody().querySelectorAll('button'))
      .find((b) => b.textContent === 'Import selected')
      .click();

    // logos → logo (existing URL re-imports by id), products → product_reference,
    // brandReferences → brand_reference, other urls → saved_reference (addAsset).
    expect(importSelectedAssetIds).toHaveBeenCalledWith(['a-logo']);
    const added = addAsset.mock.calls.map(([input]) => input);
    expect(added).toEqual([
      { role: 'product_reference', name: 'product.png', url: 'https://s.test/product.png' },
      { role: 'brand_reference', name: 'brand.png', url: 'https://s.test/brand.png' },
      { role: 'saved_reference', name: 'other.png', url: 'https://s.test/other.png' },
    ]);
  });

  it('checkboxes default to selected and unchecking excludes an asset', async () => {
    stubServer({
      poll: () => jsonResponse({
        jobId: 'job-9',
        status: 'done',
        errors: [],
        found: { logos: [], products: ['https://s.test/product.png'], brandReferences: [], urls: [] },
      }),
    });
    mountHub();
    startDiscovery('https://s.test');
    await vi.advanceTimersByTimeAsync(HUB_DISCOVERY_POLL_MS);

    const checkbox = discoveryBody().querySelector('input[type="checkbox"]');
    expect(checkbox.checked).toBe(true);
    checkbox.checked = false;
    checkbox.dispatchEvent(new Event('change'));

    Array.from(discoveryBody().querySelectorAll('button'))
      .find((b) => b.textContent === 'Import selected')
      .click();
    expect(addAsset).not.toHaveBeenCalled();
  });
});
