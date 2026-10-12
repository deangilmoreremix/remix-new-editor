// src/components/personalize/discovery/worker.js
//
// Job worker — processes one discovery job from start to categorized output.
//
// Pipeline:
//   1. validateUrl(inputUrl)
//   2. staticFetch(inputUrl) — parse with htmlParser
//   3. sitemap (try /sitemap.xml + /sitemap_index.xml, fetch up to 25 entries)
//   4. IF page assets < 3 OR html looks JS-rendered → headless fallback
//   5. dedup (URL normalization + SHA-256)
//   6. categorize into logos / products / brandReferences by URL heuristics
//
// All errors are caught and collected into `errors`. The job never throws
// out to the orchestrator — failures surface as partial results.

import { URL } from 'node:url';
import { safeFetch } from './staticFetch.js';
import { discoverFromSitemap } from './sitemap.js';
import { extractAssetUrls, looksJsRendered } from './htmlParser.js';
import { dedupeUrls } from './dedup.js';
import { headlessDiscover } from './headlessFallback.js';
import { validateUrl } from './urlSafety.js';

const HEADLESS_THRESHOLD = 3;

/* ---------- Categorization ---------- */

function categorizeByUrl(url) {
  try {
    const u = new URL(url);
    const path = u.pathname.toLowerCase();
    const fname = path.split('/').pop() || '';
    if (/logo|favicon|brand[-_]?(mark|icon)|icon/i.test(fname) ||
        /\/logo(s)?\//i.test(path) ||
        /\/brand[-_]?(mark|assets)\//i.test(path)) {
      return 'logos';
    }
    if (/product|sku|item|shop|store|catalog/i.test(path) ||
        /\/products?\//i.test(path) ||
        /\/p\/[0-9]+/i.test(path) ||
        /product[_-]?image/i.test(fname)) {
      return 'products';
    }
    return 'brandReferences';
  } catch {
    return 'brandReferences';
  }
}

function categorizeAll(urls) {
  const out = { logos: [], products: [], brandReferences: [] };
  for (const u of urls) {
    const bucket = categorizeByUrl(u);
    out[bucket].push(u);
  }
  return out;
}

/* ---------- Worker ---------- */

/**
 * Run the full discovery pipeline for one URL. Returns categorized
 * results. Never throws — errors are collected in `errors`.
 *
 * @param {string} inputUrl
 * @param {object} [opts]
 * @param {boolean} [opts.allowHeadless=true]
 * @returns {Promise<{
 *   ok: boolean,
 *   urls: string[],
 *   logos: string[],
 *   products: string[],
 *   brandReferences: string[],
 *   errors: string[],
 *   sources: { static: number, sitemap: number, headless: number },
 * }>}
 */
export async function runDiscoveryWorker(inputUrl, opts = {}) {
  const allowHeadless = opts.allowHeadless !== false;
  const errors = [];
  const collected = [];

  const initial = await validateUrl(inputUrl);
  if (!initial.safe) {
    return {
      ok: false,
      urls: [],
      logos: [],
      products: [],
      brandReferences: [],
      errors: [initial.reason],
      sources: { static: 0, sitemap: 0, headless: 0 },
    };
  }

  // 1. Static fetch.
  const staticRes = await safeFetch(initial.normalized);
  if (!staticRes.ok) {
    errors.push(`Static fetch: ${staticRes.reason}`);
  } else {
    const { urls } = await extractAssetUrls(staticRes.body, staticRes.finalUrl);
    collected.push(...urls);
  }

  // 2. Sitemap.
  let sitemapCount = 0;
  try {
    const sm = await discoverFromSitemap(initial.normalized);
    sitemapCount = sm.unique.length;
    collected.push(...sm.unique);
    if (sm.errors && sm.errors.length) errors.push(...sm.errors);
  } catch (err) {
    errors.push(`Sitemap: ${err.message}`);
  }

  // 3. Dedup.
  let deduped = dedupeUrls(collected);

  // 4. Headless fallback.
  let headlessCount = 0;
  const jsRendered = staticRes.ok && looksJsRendered(staticRes.body);
  if (allowHeadless && (deduped.count < HEADLESS_THRESHOLD || jsRendered)) {
    try {
      const head = await headlessDiscover(initial.normalized);
      if (head.error) {
        errors.push(`Headless: ${head.error}`);
      }
      headlessCount = head.urls.length;
      collected.push(...head.urls);
      deduped = dedupeUrls(collected);
    } catch (err) {
      errors.push(`Headless: ${err.message}`);
    }
  }

  // 5. Categorize.
  const categorized = categorizeAll(deduped.unique);

  return {
    ok: errors.length === 0,
    urls: deduped.unique,
    logos: categorized.logos,
    products: categorized.products,
    brandReferences: categorized.brandReferences,
    errors,
    sources: { static: deduped.count, sitemap: sitemapCount, headless: headlessCount },
  };
}