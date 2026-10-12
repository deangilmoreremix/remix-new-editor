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
// SECURITY: We pass the URL through `validateUrl` first (same path as
// static fetch). The browser is constrained to a 5s wait for JS; we do
// not execute any user-supplied JS on the page. The browser fetches the
// rendered DOM, and we hand it to the same parser as static fetch.

import { validateUrl } from './urlSafety.js';
import { extractAssetUrls } from './htmlParser.js';

const HARD_TIMEOUT_MS = 30_000;
const RENDER_WAIT_MS = 5_000;

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
    page.on('request', (req) => {
      const t = req.resourceType();
      if (t === 'image' || t === 'font') {
        req.abort().catch(() => {});
      } else {
        req.continue().catch(() => {});
      }
    });
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