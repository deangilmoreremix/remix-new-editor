// src/components/personalize/discovery/headlessFallback.js
//
// Headless-browser fallback for the discovery pipeline. Only invoked when
// the static fetch + sitemap pipeline returns fewer than 3 usable assets
// AND the page appears to be JS-rendered (heuristic in htmlParser.js).
//
// Uses puppeteer (per SA-3 verification). Reuses a single browser
// instance per process to amortize the ~2s launch cost. Hard timeout
// 30 seconds per page.
//
// SECURITY: The initial URL passes through `validateUrl` first (same
// path as static fetch). Request interception then guards EVERY
// subresource the page makes: each request URL is re-validated through
// `validateUrl` and the per-host DNS rebind guard (`reResolveGuard`,
// the same mechanism staticFetch.js applies to redirect hops) BEFORE
// the request is issued, and anything that fails validation — or whose
// resource type is not explicitly allowed — is ABORTED, not continued.
// Without this, an attacker-controlled page could drive the server to
// fetch http://169.254.169.254/… or any internal host, and the response
// body would feed straight into the parsing logic (SSRF).
//
// The engine only needs the rendered document and its images, so the
// allowlist is `document` / `image` / `font` / `stylesheet`; `script`,
// `xhr`, `fetch`, `websocket` and `media` are blocked by default.

import { validateUrl, reResolveGuard } from './urlSafety.js';
import { extractAssetUrls } from './htmlParser.js';

const HARD_TIMEOUT_MS = 30_000;
const RENDER_WAIT_MS = 5_000;

/**
 * Resource types the discovery engine is allowed to fetch. Everything
 * else (script, xhr, fetch, websocket, media, manifest, …) is aborted:
 * the page is untrusted input and the engine only reads images.
 * @type {ReadonlySet<string>}
 */
export const ALLOWED_RESOURCE_TYPES = Object.freeze(new Set([
  'document', 'image', 'font', 'stylesheet',
]));

let browserInstance = null;
let browserInitPromise = null;

async function getBrowser() {
  if (browserInstance && browserInstance.connected) return browserInstance;
  if (browserInitPromise) return browserInitPromise;
  browserInitPromise = (async () => {
    let puppeteer;
    try {
      puppeteer = await import('puppeteer');
    } catch (err) {
      const e = new Error('puppeteer is not installed');
      e.cause = err;
      throw e;
    }
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    });
    browserInstance = browser;
    return browser;
  })().finally(() => {
    browserInitPromise = null;
  });
  return browserInitPromise;
}

/**
 * Decide whether one intercepted page request may proceed.
 *
 * Checks, in order:
 *   1. resource type is on the allowlist (fail closed otherwise);
 *   2. the URL passes `validateUrl` (fresh DNS resolution, private /
 *      loopback / link-local / metadata rejection, protocol + userinfo
 *      + length checks);
 *   3. for any host already seen on this page, the DNS rebind guard
 *      (`reResolveGuard`, same mechanism staticFetch.js uses on
 *      redirect hops) confirms the address set has not changed.
 *
 * `hostAddresses` is a per-page Map<host, addresses[]> that seeds the
 * rebind guard; it is mutated in place as hosts are validated.
 *
 * Exported for tests: a fake request object (`url()`, `resourceType()`)
 * is enough to exercise the guard without a browser.
 *
 * @param {{ url: () => string, resourceType: () => string }} req
 * @param {Map<string, string[]>} hostAddresses
 * @returns {Promise<{ allow: true } | { allow: false, reason: string }>}
 */
export async function guardHeadlessRequest(req, hostAddresses) {
  let url;
  let resourceType;
  try {
    url = req.url();
    resourceType = req.resourceType();
  } catch {
    return { allow: false, reason: 'request introspection failed' };
  }

  if (!ALLOWED_RESOURCE_TYPES.has(resourceType)) {
    return { allow: false, reason: `resource type "${resourceType}" is not allowed` };
  }

  const validation = await validateUrl(url);
  if (!validation.safe) {
    return { allow: false, reason: validation.reason };
  }

  let host;
  try {
    host = new URL(validation.normalized).hostname.toLowerCase();
  } catch {
    return { allow: false, reason: 'URL is not parseable' };
  }

  const known = hostAddresses instanceof Map ? hostAddresses.get(host) : undefined;
  if (known) {
    // Seen before on this page: re-resolve and require the address set
    // to still be the (public) one we validated — the rebind guard.
    const guard = await reResolveGuard(host, known);
    if (!guard.safe) {
      return { allow: false, reason: guard.reason };
    }
    hostAddresses.set(host, guard.addresses);
  } else if (hostAddresses instanceof Map) {
    hostAddresses.set(host, validation.addresses);
  }

  return { allow: true };
}

/**
 * Attach the SSRF request guard to a puppeteer page. Seeded with the
 * initial page URL's resolved addresses so the document request itself
 * is covered by the rebind guard.
 *
 * @param {import('puppeteer').Page} page
 * @param {{ normalized: string, addresses?: string[] }} initial
 */
export function installHeadlessRequestGuard(page, initial) {
  const hostAddresses = new Map();
  try {
    const host = new URL(initial.normalized).hostname.toLowerCase();
    hostAddresses.set(host, initial.addresses || []);
  } catch {
    // Unparseable initial URL — the map simply starts empty and every
    // request still goes through validateUrl.
  }
  page.on('request', (req) => {
    guardHeadlessRequest(req, hostAddresses)
      .then((decision) => (decision.allow ? req.continue() : req.abort()))
      .catch(() => req.abort().catch(() => {}));
  });
}

/**
 * Render a URL via headless Chromium and extract asset URLs from the
 * post-JS DOM.
 *
 * @param {string} url
 * @returns {Promise<{ urls: string[], parserUsed: string }>}
 */
export async function headlessDiscover(url) {
  const v = await validateUrl(url);
  if (!v.safe) {
    return { urls: [], parserUsed: 'rejected', error: `URL: ${v.reason}` };
  }

  let browser;
  try {
    browser = await getBrowser();
  } catch (err) {
    return { urls: [], parserUsed: 'no-browser', error: err.message };
  }

  let page;
  try {
    page = await Promise.race([
      browser.newPage(),
      new Promise((_, rej) => setTimeout(() => rej(new Error('Browser.newPage timeout')), HARD_TIMEOUT_MS)),
    ]);
  } catch (err) {
    return { urls: [], parserUsed: 'no-page', error: err.message };
  }

  const hardTimer = setTimeout(async () => {
    try { await page.close({ runBeforeUnload: false }); } catch { /* ignore */ }
  }, HARD_TIMEOUT_MS);

  try {
    await page.setUserAgent('remix-new-editor/1.0 (+asset-discovery)');
    await page.setRequestInterception(true);
    // SSRF guard: every request — the document, redirects, subresources,
    // XHR/fetch — is validated before it leaves the process.
    installHeadlessRequestGuard(page, v);
    const response = await page.goto(v.normalized, { waitUntil: 'domcontentloaded', timeout: HARD_TIMEOUT_MS });
    if (!response) {
      clearTimeout(hardTimer);
      try { await page.close(); } catch { /* ignore */ }
      return { urls: [], parserUsed: 'no-response', error: 'page.goto returned null' };
    }
    // Wait a fixed window for JS to render.
    await new Promise((r) => setTimeout(r, RENDER_WAIT_MS));
    const html = await page.content();
    clearTimeout(hardTimer);
    try { await page.close(); } catch { /* ignore */ }
    const { urls, parserUsed } = await extractAssetUrls(html, v.normalized);
    return { urls, parserUsed };
  } catch (err) {
    clearTimeout(hardTimer);
    try { if (page) await page.close(); } catch { /* ignore */ }
    return { urls: [], parserUsed: 'error', error: err.message };
  }
}

/**
 * Close the singleton browser. Useful for tests; production code can
 * let the process exit naturally.
 */
export async function closeHeadlessBrowser() {
  if (browserInstance) {
    try { await browserInstance.close(); } catch { /* ignore */ }
    browserInstance = null;
  }
}