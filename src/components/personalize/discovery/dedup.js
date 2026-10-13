// src/components/personalize/discovery/dedup.js
//
// Duplicate / hash dedup of discovered asset URL candidates.
//
// Strategy:
//   1. URL-level normalization: lowercase scheme+host, strip trailing slash
//      on the path (but only if the path is non-root), drop fragments,
//      strip utm_* / fbclid / gclid tracking query params, sort remaining
//      query keys, rebuild via the WHATWG URL parser.
//   2. SHA-256 hash of the URL string as a tie-breaker for URL-rewrite
//      variants that survive normalization (rare, but cheap).
//
// We DO NOT hash the asset bytes — that would require fetching each
// candidate. URL-level dedup is what the spec calls for.

import { createHash } from 'node:crypto';
import { URL } from 'node:url';

const TRACKING_KEY_PREFIXES = ['utm_'];
const TRACKING_KEY_EXACT = new Set([
  'fbclid', 'gclid', 'msclkid', 'mc_cid', 'mc_eid',
  'yclid', 'dclid', 'ref', 'ref_src', 'ref_url',
  '_hsenc', '_hsmi', 'mkt_tok',
]);

/**
 * Normalize a URL string per the dedup rules.
 *
 * @param {string} url
 * @returns {string | null}
 */
export function normalizeUrl(url) {
  try {
    const u = new URL(url);
    u.protocol = u.protocol.toLowerCase();
    u.hostname = u.hostname.toLowerCase();
    u.hash = '';
    // Default ports.
    if ((u.protocol === 'http:' && u.port === '80') ||
        (u.protocol === 'https:' && u.port === '443')) {
      u.port = '';
    }
    // Strip trailing slash from non-root paths.
    if (u.pathname.length > 1 && u.pathname.endsWith('/')) {
      u.pathname = u.pathname.slice(0, -1);
    }
    // Filter and sort query params.
    const params = Array.from(u.searchParams.entries());
    const kept = params.filter(([k]) => {
      if (!k) return false;
      if (TRACKING_KEY_EXACT.has(k)) return false;
      if (TRACKING_KEY_PREFIXES.some((p) => k.startsWith(p))) return false;
      return true;
    });
    // Dedupe identical (k, v) pairs and sort.
    const seen = new Set();
    const unique = [];
    for (const [k, v] of kept) {
      const key = `${k}\u0000${v}`;
      if (seen.has(key)) continue;
      seen.add(key);
      unique.push([k, v]);
    }
    unique.sort((a, b) => (a[0] === b[0] ? a[1].localeCompare(b[1]) : a[0].localeCompare(b[0])));
    u.search = '';
    for (const [k, v] of unique) {
      u.searchParams.append(k, v);
    }
    return u.toString();
  } catch {
    return null;
  }
}

function hashUrl(url) {
  return createHash('sha256').update(url).digest('hex');
}

/**
 * Dedupe a list of URLs using URL normalization + SHA-256 fallback.
 *
 * Returns an array of unique URLs in first-seen order.
 *
 * @param {string[]} urls
 * @returns {{ unique: string[], count: number, byHash: number }}
 */
export function dedupeUrls(urls) {
  const seen = new Map(); // normalized → url
  const hashes = new Set();
  let byHash = 0;

  // First pass: collect normalized forms; the first time we see a
  // normalized form we store the canonical (normalized) URL, so the
  // output is the clean form rather than the first raw form.
  const preClean = [];
  for (const u of urls) {
    const n = normalizeUrl(u);
    if (n === null) continue;
    if (!seen.has(n)) {
      seen.set(n, n);
      preClean.push({ normalized: n, value: n });
    }
  }

  // Second pass: SHA-256 fallback for any URL that survived the
  // normalizer but happens to hash-collide with an existing entry.
  const final = new Map();
  for (const { normalized, value } of preClean) {
    const h = hashUrl(normalized);
    if (hashes.has(h)) {
      byHash++;
      continue;
    }
    hashes.add(h);
    final.set(normalized, value);
  }
  return {
    unique: Array.from(final.values()),
    count: final.size,
    byHash,
  };
}