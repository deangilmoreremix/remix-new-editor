/**
 * defectFixHeadlessSsrf.test.js
 *
 * Regression (SECURITY): the headless fallback's request handler
 * continued EVERY non-image/font request without any URL or DNS
 * validation, so an attacker-controlled page could make the server
 * fetch http://169.254.169.254/… or any internal host — and the
 * response body fed straight into the parsing logic. (It even aborted
 * images, the one thing the engine needs.)
 *
 * The guard must now (a) allowlist resource types, (b) validate EVERY
 * request URL through the engine's validateUrl, and (c) abort — never
 * continue — anything that fails, including a DNS-rebind check using
 * the same reResolveGuard mechanism staticFetch.js uses.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// ─── Fake puppeteer ────────────────────────────────────────────────────────

function makeFakePage() {
  return {
    handlers: {},
    calls: { setRequestInterception: [], goto: [] },
    connected: true,
    on(event, fn) { this.handlers[event] = fn; },
    async setUserAgent() {},
    async setRequestInterception(value) { this.calls.setRequestInterception.push(value); },
    async goto(url) { this.calls.goto.push(url); return { status: 200 }; },
    async content() { return '<html><body><img src="/logo.png"></body></html>'; },
    async close() {},
  };
}

let fakePage;

const fakeBrowser = {
  connected: true,
  async newPage() { fakePage = makeFakePage(); return fakePage; },
  async close() {},
};

vi.mock('puppeteer', () => ({ launch: async () => fakeBrowser }));

const {
  headlessDiscover,
  guardHeadlessRequest,
  installHeadlessRequestGuard,
  closeHeadlessBrowser,
  ALLOWED_RESOURCE_TYPES,
} = await import('../discovery/headlessFallback.js');

// ─── DNS stub (same idiom as the discovery engine tests) ───────────────────

let originalLookup;

beforeEach(() => {
  originalLookup = require('node:dns').promises.lookup;
  require('node:dns').promises.lookup = (host) => {
    if (host === 'example.com' || host === 'cdn.example.com') {
      return Promise.resolve([{ address: '93.184.216.34' }]);
    }
    if (host === 'evil.test') {
      // Attacker-controlled hostname that resolves to a private address.
      return Promise.resolve([{ address: '127.0.0.1' }]);
    }
    return Promise.reject(new Error('ENOTFOUND'));
  };
});

afterEach(async () => {
  require('node:dns').promises.lookup = originalLookup;
  await closeHeadlessBrowser();
  vi.useRealTimers();
});

function makeRequest(url, resourceType) {
  return {
    url: () => url,
    resourceType: () => resourceType,
    abort: vi.fn(async () => {}),
    continue: vi.fn(async () => {}),
  };
}

async function decide(url, resourceType) {
  const req = makeRequest(url, resourceType);
  const decision = await guardHeadlessRequest(req, new Map());
  return { decision, req };
}

// ─── The guard ─────────────────────────────────────────────────────────────

describe('defect: headless requests are SSRF-guarded before they are issued', () => {
  it('aborts a link-local metadata URL instead of continuing it', async () => {
    const { decision, req } = await decide('http://169.254.169.254/latest/meta-data/', 'image');
    expect(decision.allow).toBe(false);
    expect(decision.reason).toMatch(/blocked|private/);
    expect(req.abort).toHaveBeenCalledTimes(0); // decision only; the page handler aborts
  });

  it('aborts loopback and RFC1918 targets', async () => {
    for (const url of [
      'http://127.0.0.1:8080/admin',
      'http://10.1.2.3/internal.png',
      'http://192.168.0.10/logo.png',
      'http://[::1]/x.png',
    ]) {
      const { decision } = await decide(url, 'image');
      expect(decision.allow, url).toBe(false);
    }
  });

  it('aborts an attacker hostname that resolves to a private IP (DNS check at request time)', async () => {
    const { decision, req } = await decide('https://evil.test/steal.png', 'image');
    expect(decision.allow).toBe(false);
    expect(decision.reason).toMatch(/private/);
    expect(req.abort).not.toHaveBeenCalled(); // decision only; the page handler aborts
  });

  it('continues an allowed public image URL', async () => {
    const { decision } = await decide('https://example.com/img/hero.png', 'image');
    expect(decision).toEqual({ allow: true });
  });

  it('blocks non-allowlisted resource types even for safe URLs', async () => {
    for (const type of ['script', 'xhr', 'fetch', 'websocket', 'media', 'manifest', 'eventsource', 'texttrack', 'other']) {
      const { decision } = await decide('https://example.com/whatever', type);
      expect(decision.allow, type).toBe(false);
      expect(decision.reason).toMatch(/not allowed/);
    }
  });

  it('allows only document / image / font / stylesheet', () => {
    expect([...ALLOWED_RESOURCE_TYPES].sort()).toEqual(['document', 'font', 'image', 'stylesheet']);
  });

  it('allows document, font and stylesheet for public hosts', async () => {
    for (const type of ['document', 'font', 'stylesheet']) {
      const { decision } = await decide('https://cdn.example.com/app.css', type);
      expect(decision, type).toEqual({ allow: true });
    }
  });

  it('aborts non-http(s) URL schemes (data:, blob:, about:)', async () => {
    for (const url of ['data:image/png;base64,QUJD', 'blob:https://example.com/x', 'about:blank']) {
      const { decision } = await decide(url, 'image');
      expect(decision.allow, url).toBe(false);
    }
  });

  it('applies the DNS rebind guard to a host seen earlier on the page', async () => {
    const hostAddresses = new Map();
    const first = await guardHeadlessRequest(makeRequest('https://example.com/a.png', 'image'), hostAddresses);
    expect(first).toEqual({ allow: true });
    // Host now "rebinds" to a private address → the guard must abort.
    require('node:dns').promises.lookup = (host) => (
      host === 'example.com' ? Promise.resolve([{ address: '169.254.169.254' }]) : Promise.reject(new Error('ENOTFOUND'))
    );
    const second = await guardHeadlessRequest(makeRequest('https://example.com/b.png', 'image'), hostAddresses);
    expect(second.allow).toBe(false);
    expect(second.reason).toMatch(/private/);
  });
});

// ─── Installed handler on a mocked puppeteer page ──────────────────────────

describe('defect: the page handler aborts internal URLs and continues allowed images', () => {
  it('installs interception and validates every request through the handler', async () => {
    vi.useFakeTimers();
    const promise = headlessDiscover('https://example.com/');
    await vi.advanceTimersByTimeAsync(6_000);
    const result = await promise;

    expect(fakePage.calls.setRequestInterception).toEqual([true]);
    expect(typeof fakePage.handlers.request).toBe('function');

    // Internal URL → abort (the response body must never be parsed).
    const internal = makeRequest('http://169.254.169.254/latest/meta-data/', 'image');
    fakePage.handlers.request(internal);
    await vi.advanceTimersByTimeAsync(1);
    expect(internal.abort).toHaveBeenCalledTimes(1);
    expect(internal.continue).not.toHaveBeenCalled();

    // Script from a safe host → blocked by type, not continued.
    const script = makeRequest('https://example.com/app.js', 'script');
    fakePage.handlers.request(script);
    await vi.advanceTimersByTimeAsync(1);
    expect(script.abort).toHaveBeenCalledTimes(1);
    expect(script.continue).not.toHaveBeenCalled();

    // Allowed image → continued (normal image discovery keeps working).
    const image = makeRequest('https://example.com/img/logo.png', 'image');
    fakePage.handlers.request(image);
    await vi.advanceTimersByTimeAsync(1);
    expect(image.continue).toHaveBeenCalledTimes(1);
    expect(image.abort).not.toHaveBeenCalled();

    // The document request itself is allowed through and the rendered
    // DOM still yields its images.
    expect(result.urls).toContain('https://example.com/logo.png');
  });

  it('rejects an unsafe initial URL before any browser work', async () => {
    const r = await headlessDiscover('http://127.0.0.1/');
    expect(r.parserUsed).toBe('rejected');
    expect(r.urls).toEqual([]);
  });

  it('installHeadlessRequestGuard seeds the page host for the rebind guard', () => {
    const page = makeFakePage();
    installHeadlessRequestGuard(page, { normalized: 'https://example.com/', addresses: ['93.184.216.34'] });
    expect(typeof page.handlers.request).toBe('function');
  });
});
