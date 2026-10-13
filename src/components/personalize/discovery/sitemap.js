// src/components/personalize/discovery/sitemap.js
//
// Sitemap.xml parser and fetcher.
//
// Tries /sitemap.xml, then /sitemap_index.xml. Uses `safeFetch` for
// every network call (DNS rebinding, SSRF, etc. all handled).
//
// URL SEMANTICS (the defect this module used to have):
//   - A plain <urlset> <loc> is an HTML PAGE URL, NOT a media URL.
//     Such entries are CRAWL TARGETS ONLY: they are fetched and parsed
//     for images (that already happens below), and are never returned
//     as image assets. They used to be merged into `unique`, and
//     because extensionless URLs pass `validateAssetUrl`, they reached
//     the hub as broken image cards.
//   - An image sitemap's <image:image><image:loc> entry IS a media URL.
//     Those are validated (URL safety + asset-extension allowlist) and
//     returned as assets.
//
// Hard cap: 50 total URLs (sitemap entries + per-page candidate assets).

import { safeFetch } from './staticFetch.js';
import { extractAssetUrls } from './htmlParser.js';
import { dedupeUrls } from './dedup.js';
import { validateUrl, validateAssetUrl } from './urlSafety.js';

const MAX_TOTAL_URLS = 50;
const MAX_SITEMAP_ENTRIES = 25;

/**
 * Pull candidate URLs from a site's sitemap(s).
 *
 * @param {string} baseUrl — page root, e.g. "https://example.com/"
 * @returns {Promise<{ locs: string[], pageAssets: string[], errors: string[] }>}
 *   `locs` are HTML page URLs (crawl targets, never assets); `unique`
 *   is the deduped set of MEDIA URLs (image-sitemap entries + assets
 *   found by crawling those pages).
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
  const allLocs = [];      // HTML page URLs — crawl targets only
  const imageAssets = [];  // <image:loc> media URLs — real assets
  const pageAssets = [];   // assets discovered by crawling the pages
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

    // Image sitemap entries are media URLs — validate and keep them.
    for (const imageLoc of extractImageLocs(xml)) {
      if (imageAssets.length + pageAssets.length >= MAX_TOTAL_URLS) break;
      const iv = await validateUrl(imageLoc);
      if (!iv.safe) continue;
      // Extension allowlist: junk extensions never reach the results.
      if (!validateAssetUrl(iv.normalized).ok) continue;
      imageAssets.push(iv.normalized);
    }

    const locs = extractLocs(xml);
    for (const loc of locs) {
      if (processed >= MAX_SITEMAP_ENTRIES) break;
      allLocs.push(loc);
      processed++;
      // <loc> in a <urlset> is an HTML page: crawl it for images, but
      // never treat the page URL itself as an image asset.
      if (allLocs.length + pageAssets.length + imageAssets.length >= MAX_TOTAL_URLS) break;
      const pv = await validateUrl(loc);
      if (!pv.safe) continue;
      const pageFetch = await safeFetch(loc);
      if (!pageFetch.ok) continue;
      const { urls } = await extractAssetUrls(pageFetch.body, pageFetch.finalUrl);
      pageAssets.push(...urls);
    }
  }

  // Only media URLs reach `unique` — the list callers render as assets.
  const deduped = dedupeUrls([...imageAssets, ...pageAssets]);
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
 * Extract <image:loc>...</image:loc> entries from an image sitemap.
 * These are the MEDIA URLs of an image:image entry — the only sitemap
 * entries that are legitimately image assets. A plain <loc> (page URL)
 * is deliberately NOT matched here.
 */
export function extractImageLocs(xml) {
  const out = [];
  if (typeof xml !== 'string') return out;
  const re = /<image:loc[^>]*>([\s\S]*?)<\/image:loc>/gi;
  let m;
  while ((m = re.exec(xml)) !== null) {
    const v = m[1].trim();
    if (v) out.push(v);
  }
  return out;
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