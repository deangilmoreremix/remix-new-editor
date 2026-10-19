/**
 * hubDiscoveryAuth.test.js
 *
 * Discovery authenticates as a CLERK user — the release-blocker regression
 * tests. The panel used to attach `supabase.auth.getSession()`'s token, but
 * the app authenticates with Clerk (not Supabase Auth), so every discovery
 * request went out unauthenticated and the Netlify function failed closed
 * with 401: website discovery was non-functional for real signed-in users.
 *
 * The panel now sends a fresh Clerk session token
 * (getPersonalizationAccessToken, src/lib/personalizationAuth.js) as
 * `Authorization: Bearer <token>` — the same verified identity token
 * src/lib/supabase.js sends on every Supabase request — and refuses to call
 * the server at all when there is no session.
 *
 * Mock-depth note (same convention as personalizationHubPanel.test.js):
 * this spec lives in __tests__/, one level deeper than the panel, so the
 * panel is ../PersonalizationHubPanel.js and lib modules are
 * ../../../lib/x.js. `../../../lib/supabase.js` is mocked with a spy ONLY
 * to prove it is never consulted.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// ─── Fake stores (mount/mock idiom copied from personalizationHubPanel.test.js) ──

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

/** The Clerk session token seam. `null` models a signed-out caller. */
const getPersonalizationAccessToken = vi.fn(async () => 'clerk-token-123');

vi.mock('../../../lib/personalizationAuth.js', () => ({
  getPersonalizationAccessToken: (...args) => getPersonalizationAccessToken(...args),
}));

/** Supabase Auth is NOT the app's auth: prove it is never consulted. */
const getSession = vi.fn(async () => ({ data: { session: { access_token: 'supabase-session-token' } } }));

vi.mock('../../../lib/supabase.js', () => ({
  supabase: { auth: { getSession: () => getSession() } },
}));

const {
  mountPersonalizationHub,
  unmountPersonalizationHub,
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

function discoveryBody() {
  const heading = Array.from(container.querySelectorAll('.pzh-section > h4'))
    .find((h) => h.textContent === 'Discover from website');
  return heading ? heading.nextElementSibling : null;
}

function discoveryStatusText() {
  return discoveryBody().querySelector('[data-hub-discover-status]').textContent;
}

function startDiscovery(url) {
  const body = discoveryBody();
  body.querySelector('[data-hub-discover-input]').value = url;
  Array.from(body.querySelectorAll('button')).find((b) => b.textContent === 'Discover').click();
}

function jsonResponse(body, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

const fetchMock = vi.fn();

/** POST starts a job; every GET poll answers `running` forever. */
function stubServer() {
  fetchMock.mockImplementation(async (url, options = {}) => {
    const target = String(url);
    const method = (options && options.method) || 'GET';
    if (target === HUB_DISCOVERY_ENDPOINT && method === 'POST') {
      return jsonResponse({ jobId: 'job-1', status: 'pending' });
    }
    if (target.startsWith(`${HUB_DISCOVERY_ENDPOINT}?jobId=`) && method === 'DELETE') {
      return jsonResponse({ jobId: 'job-1', status: 'cancelled' });
    }
    return jsonResponse({ jobId: 'job-1', status: 'running', errors: [] });
  });
}

function discoveryCalls(method) {
  return fetchMock.mock.calls.filter(([url, options]) => {
    const m = (options && options.method) || 'GET';
    return (String(url) === HUB_DISCOVERY_ENDPOINT || String(url).startsWith(`${HUB_DISCOVERY_ENDPOINT}?`))
      && m === method;
  });
}

beforeEach(() => {
  clientState = { clients: [], currentClientId: null, hydrated: true };
  assetState = { assets: [], removed: [], hydrated: true };
  sharedState = { entries: [], hydrated: true };
  // The browser never has the internal shared secret; make sure a leaked
  // shell variable can never route these tests through the server path.
  delete process.env.PERSONALIZATION_DISCOVERY_SECRET;
  getPersonalizationAccessToken.mockClear();
  getPersonalizationAccessToken.mockImplementation(async () => 'clerk-token-123');
  getSession.mockClear();
  getSession.mockImplementation(async () => ({ data: { session: { access_token: 'supabase-session-token' } } }));
  fetchMock.mockReset();
  global.fetch = fetchMock;
  vi.useFakeTimers();
});

afterEach(() => {
  unmountPersonalizationHub();
  document.body.innerHTML = '';
  vi.useRealTimers();
  delete global.fetch;
  delete process.env.PERSONALIZATION_DISCOVERY_SECRET;
  // The old (broken) contract must never come back: NOT ONE discovery
  // request in this file may consult Supabase Auth.
  expect(getSession).not.toHaveBeenCalled();
});

// ─── Signed out: fail closed before the server is ever contacted ──────────

describe('discovery auth — signed out', () => {
  it('shows the sign-in state and never calls the server', async () => {
    getPersonalizationAccessToken.mockImplementation(async () => null);
    stubServer();
    mountHub();
    startDiscovery('https://s.test');
    await vi.advanceTimersByTimeAsync(0);

    expect(discoveryStatusText()).toContain('Sign in to run website discovery');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('surfaces a token-fetch failure and never calls the server', async () => {
    getPersonalizationAccessToken.mockRejectedValue(new Error('clerk unavailable'));
    stubServer();
    mountHub();
    startDiscovery('https://s.test');
    await vi.advanceTimersByTimeAsync(0);

    const status = discoveryStatusText();
    expect(status).toContain('Could not read your session');
    expect(status).toContain('clerk unavailable');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

// ─── Signed in: the Clerk token rides every discovery request ─────────────

describe('discovery auth — signed in', () => {
  it('attaches Authorization: Bearer <clerk token> to the start request and polls', async () => {
    stubServer();
    mountHub();
    startDiscovery('https://s.test');
    await vi.advanceTimersByTimeAsync(0);

    const posts = discoveryCalls('POST');
    expect(posts).toHaveLength(1);
    expect(posts[0][1].headers.Authorization).toBe('Bearer clerk-token-123');
    expect(JSON.parse(posts[0][1].body)).toEqual({ url: 'https://s.test' });
    expect(discoveryStatusText()).toContain('Discovering assets');

    // Every poll carries the same verified identity, re-resolved per request.
    await vi.advanceTimersByTimeAsync(HUB_DISCOVERY_POLL_MS);
    const gets = discoveryCalls('GET');
    expect(gets.length).toBeGreaterThanOrEqual(1);
    gets.forEach(([, options]) => {
      expect(options.headers.Authorization).toBe('Bearer clerk-token-123');
    });
    // A fresh token is minted for the start plus each poll.
    expect(getPersonalizationAccessToken.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it('cancels the server-side job with the Clerk token on unmount', async () => {
    stubServer();
    mountHub();
    startDiscovery('https://s.test');
    await vi.advanceTimersByTimeAsync(0);
    unmountPersonalizationHub();
    await vi.advanceTimersByTimeAsync(0);

    const deletes = discoveryCalls('DELETE');
    expect(deletes).toHaveLength(1);
    expect(deletes[0][0]).toContain('jobId=job-1');
    expect(deletes[0][1].headers.Authorization).toBe('Bearer clerk-token-123');
  });
});

// ─── Expired session: explain once, never auto-retry ──────────────────────

describe('discovery auth — expired session', () => {
  it('renders the session-expired message on a 401 and does not retry', async () => {
    fetchMock.mockImplementation(async (url, options = {}) => {
      const target = String(url);
      const method = (options && options.method) || 'GET';
      if (target === HUB_DISCOVERY_ENDPOINT && method === 'POST') {
        return jsonResponse({ error: 'Unauthorized' }, 401);
      }
      return jsonResponse({ jobId: 'job-1', status: 'running', errors: [] });
    });
    mountHub();
    startDiscovery('https://s.test');
    await vi.advanceTimersByTimeAsync(0);

    expect(discoveryStatusText()).toBe('Your session expired — sign in again.');
    // No automatic retry: exactly one request was ever made and no poll
    // loop was started.
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(discoveryCalls('GET')).toHaveLength(0);

    await vi.advanceTimersByTimeAsync(HUB_DISCOVERY_POLL_MS * 5);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(discoveryCalls('GET')).toHaveLength(0);
  });

  it('stops the poll loop when the token expires mid-job and never retries', async () => {
    getPersonalizationAccessToken
      .mockImplementationOnce(async () => 'clerk-token-123')
      .mockImplementationOnce(async () => null); // session ends between polls
    stubServer();
    mountHub();
    startDiscovery('https://s.test');
    await vi.advanceTimersByTimeAsync(0);
    expect(discoveryCalls('POST')).toHaveLength(1);

    await vi.advanceTimersByTimeAsync(HUB_DISCOVERY_POLL_MS);
    expect(discoveryStatusText()).toContain('Sign in to run website discovery');

    const callsBefore = fetchMock.mock.calls.length;
    await vi.advanceTimersByTimeAsync(HUB_DISCOVERY_POLL_MS * 5);
    expect(fetchMock.mock.calls.length).toBe(callsBefore);
  });
});

// ─── Server context: the shared-secret path stays available ───────────────

describe('discovery auth — server context', () => {
  it('presents X-Discovery-Secret when the internal secret is configured', async () => {
    process.env.PERSONALIZATION_DISCOVERY_SECRET = 'internal-secret';
    stubServer();
    mountHub();
    startDiscovery('https://s.test');
    await vi.advanceTimersByTimeAsync(0);

    const posts = discoveryCalls('POST');
    expect(posts).toHaveLength(1);
    expect(posts[0][1].headers['X-Discovery-Secret']).toBe('internal-secret');
    expect(posts[0][1].headers.Authorization).toBeUndefined();
    // The browser identity token is not needed on the server path.
    expect(getPersonalizationAccessToken).not.toHaveBeenCalled();
  });
});
