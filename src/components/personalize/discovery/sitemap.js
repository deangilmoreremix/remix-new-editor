// src/components/personalize/discovery/sitemap.js
//
// Sitemap.xml parser and fetcher.
//
// Tries /sitemap.xml, then /sitemap_index.xml. Uses `safeFetch` for
// every network call (DNS rebinding, SSRF, etc. all handled). For each
// <loc> entry in the sitemap, optionally fetches the page and extracts
// asset URLs using the same HTML parser.
//
// Hard cap: 50 total URLs (sitemap entries + per-page candidate assets).

import { safeFetch } from './staticFetch.js';
import { extractAssetUrls } from './htmlParser.js';
import { dedupeUrls } from './dedup.js';
import { validateUrl } from './urlSafety.js';

const MAX_TOTAL_URLS = 50;
const MAX_SITEMAP_ENTRIES = 25;

/**
 * Pull candidate URLs from a site's sitemap(s).
 *
 * @param {string} baseUrl — page root, e.g. "https://example.com/"
 * @returns {Promise<{ locs: string[], pageAssets: string[], errors: string[] }>}
 */
export async function discoverFromSitemap(baseUrl) {
  const errors = [];
  let normalizedBase;
  try {
    const u = new URL(baseUrl);
    normalizedBase = `${u.protocol}//${u.host}/`;
  } catch {
    return { locs: [], pageAssets: [], errors: [`Bad base URL: ${baseUrl}`] };
  }

  const candidates = [`${normalizedBase}sitemap.xml`, `${normalizedBase}sitemap_index.xml`];
  const allLocs = [];
  const pageAssets = [];
  let processed = 0;

  for (const smUrl of candidates) {
    if (processed >= MAX_SITEMAP_ENTRIES) break;
    const v = await validateUrl(smUrl);
    if (!v.safe) {
      errors.push(`Sitemap ${smUrl}: ${v.reason}`);
      continue;
    }
    const fetchRes = await safeFetch(smUrl);
    if (!fetchRes.ok) {
      errors.push(`Sitemap ${smUrl}: ${fetchRes.reason}`);
      continue;
    }
    const xml = fetchRes.body;
    const locs = extractLocs(xml);
    for (const loc of locs) {
      if (processed >= MAX_SITEMAP_ENTRIES) break;
      allLocs.push(loc);
      processed++;
      // Try to fetch this page and pull its assets.
      if (allLocs.length + pageAssets.length >= MAX_TOTAL_URLS) break;
      const pv = await validateUrl(loc);
      if (!pv.safe) continue;
      const pageFetch = await safeFetch(loc);
      if (!pageFetch.ok) continue;
      const { urls } = await extractAssetUrls(pageFetch.body, pageFetch.finalUrl);
      pageAssets.push(...urls);
    }
  }

  const deduped = dedupeUrls([...allLocs, ...pageAssets]);
  // Re-split: locs and pageAssets, but respect the cap.
  const capped = deduped.unique.slice(0, MAX_TOTAL_URLS);
  return {
    locs: allLocs,
    pageAssets: pageAssets.slice(0, MAX_TOTAL_URLS),
    unique: capped,
    errors,
  };
}

/**
 * Extract <loc>...</loc> entries from a sitemap XML body. Simple regex
 * — sitemaps are well-formed enough that this is reliable and avoids
 * pulling in another parser.
 */
export function extractLocs(xml) {
  const out = [];
  if (typeof xml !== 'string') return out;
  const re = /<loc[^>]*>([\s\S]*?)<\/loc>/gi;
  let m;
  while ((m = re.exec(xml)) !== null) {
    const v = m[1].trim();
    if (v) out.push(v);
  }
  return out;
}