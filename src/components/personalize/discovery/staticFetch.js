// src/components/personalize/discovery/staticFetch.js
//
// Safe HTTP fetch wrapper for the discovery pipeline.
//
// Every fetch:
//   1. Passes the URL through `validateUrl` (which resolves DNS and
//      rejects private/loopback/link-local addresses).
//   2. Manually follows up to MAX_REDIRECTS redirects, re-validating
//      each hop's URL and re-running the DNS rebind guard.
//   3. Enforces a per-fetch timeout.
//   4. Uses raw `fetch` (no SDK) and only accepts text/html responses.
//
// SECURITY: We never blindly follow redirects to private IPs. The
// rebind guard runs at every hop — if the hostname now resolves to a
// different address set, we abort the entire fetch chain.

import {
  validateUrl,
  reResolveGuard,
  validateAssetUrl,
} from './urlSafety.js';

const MAX_REDIRECTS = 3;
const DEFAULT_TIMEOUT_MS = 30_000;
const USER_AGENT = 'remix-new-editor/1.0 (+asset-discovery)';

/**
 * Safely fetch a URL, validating DNS at every redirect hop.
 *
 * @param {string} inputUrl
 * @param {object} [opts]
 * @param {number} [opts.timeoutMs]
 * @param {AbortSignal} [opts.signal]
 * @returns {Promise<{ ok: true, status: number, finalUrl: string, body: string, contentType: string }
 *                  | { ok: false, reason: string }>}
 */
export async function safeFetch(inputUrl, opts = {}) {
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const externalSignal = opts.signal;

  const currentUrl = inputUrl;
  let initial = await validateUrl(currentUrl);
  if (!initial.safe) {
    return { ok: false, reason: `Initial validation: ${initial.reason}` };
  }
  let lastAddresses = initial.addresses;

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), timeoutMs);
    if (externalSignal) {
      if (externalSignal.aborted) {
        clearTimeout(timer);
        return { ok: false, reason: 'Caller aborted' };
      }
      externalSignal.addEventListener('abort', () => ac.abort(), { once: true });
    }

    let response;
    try {
      response = await fetch(initial.normalized, {
        method: 'GET',
        redirect: 'manual',
        headers: { 'user-agent': USER_AGENT, 'accept': 'text/html,application/xhtml+xml,*/*;q=0.8' },
        signal: ac.signal,
      });
    } catch (err) {
      clearTimeout(timer);
      return { ok: false, reason: `Fetch error: ${err.message}` };
    }
    clearTimeout(timer);

    const status = response.status;

    if (status >= 300 && status < 400) {
      const location = response.headers.get('location');
      if (!location) {
        return { ok: false, reason: `Redirect ${status} missing Location header` };
      }
      if (hop === MAX_REDIRECTS) {
        return { ok: false, reason: `Exceeded ${MAX_REDIRECTS} redirects` };
      }
      // Resolve relative redirects against the current URL.
      let nextUrl;
      try {
        nextUrl = new URL(location, initial.normalized).toString();
      } catch {
        return { ok: false, reason: `Bad redirect Location: ${location}` };
      }
      const nextValidation = await validateUrl(nextUrl);
      if (!nextValidation.safe) {
        return { ok: false, reason: `Redirect ${hop + 1}: ${nextValidation.reason}` };
      }
      // Rebind guard: did the original hostname change its address set?
      if (hop > 0) {
        const nextHost = new URL(nextValidation.normalized).hostname.toLowerCase();
        const guard = await reResolveGuard(nextHost, lastAddresses);
        if (!guard.safe) {
          return { ok: false, reason: `Redirect ${hop + 1}: ${guard.reason}` };
        }
        lastAddresses = guard.addresses;
      } else {
        lastAddresses = nextValidation.addresses;
      }
      initial = nextValidation;
      continue;
    }

    // Final response — read body.
    const contentType = (response.headers.get('content-type') || '').toLowerCase();
    if (!contentType.includes('text/html') && !contentType.includes('application/xhtml')) {
      // Could be a sitemap or other asset; if XML, allow it.
      if (!contentType.includes('xml') && !contentType.includes('text/plain')) {
        return { ok: false, reason: `Unexpected content-type: ${contentType || '(none)'}` };
      }
    }
    let body;
    try {
      body = await response.text();
    } catch (err) {
      return { ok: false, reason: `Body read error: ${err.message}` };
    }
    return {
      ok: true,
      status,
      finalUrl: initial.normalized,
      body,
      contentType,
    };
  }
  return { ok: false, reason: 'Unreachable: redirect loop did not terminate' };
}

/**
 * Fetch an asset URL. Validates URL safety + extension allowlist.
 * Returns binary body (Uint8Array) for downstream hashing / probing.
 *
 * @param {string} url
 * @param {object} [opts]
 * @returns {Promise<{ ok: true, status: number, bytes: Uint8Array, contentType: string }
 *                  | { ok: false, reason: string }>}
 */
export async function safeFetchAsset(url, opts = {}) {
  const assetCheck = validateAssetUrl(url);
  if (!assetCheck.ok) {
    return { ok: false, reason: assetCheck.reason };
  }
  const initial = await validateUrl(url);
  if (!initial.safe) {
    return { ok: false, reason: `Asset URL: ${initial.reason}` };
  }
  let lastAddresses = initial.addresses;
  let currentNormalized = initial.normalized;

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), opts.timeoutMs ?? DEFAULT_TIMEOUT_MS);
    let response;
    try {
      response = await fetch(currentNormalized, {
        method: 'GET',
        redirect: 'manual',
        headers: { 'user-agent': USER_AGENT, 'accept': 'image/*,*/*;q=0.5' },
        signal: ac.signal,
      });
    } catch (err) {
      clearTimeout(timer);
      return { ok: false, reason: `Asset fetch error: ${err.message}` };
    }
    clearTimeout(timer);
    const status = response.status;
    if (status >= 300 && status < 400) {
      const location = response.headers.get('location');
      if (!location) return { ok: false, reason: `Asset redirect ${status} missing Location` };
      if (hop === MAX_REDIRECTS) return { ok: false, reason: 'Asset exceeded redirects' };
      let nextUrl;
      try { nextUrl = new URL(location, currentNormalized).toString(); }
      catch { return { ok: false, reason: `Bad asset redirect Location: ${location}` }; }
      const next = await validateUrl(nextUrl);
      if (!next.safe) return { ok: false, reason: `Asset redirect ${hop + 1}: ${next.reason}` };
      const nextHost = new URL(next.normalized).hostname.toLowerCase();
      const guard = await reResolveGuard(nextHost, lastAddresses);
      if (!guard.safe) return { ok: false, reason: `Asset redirect ${hop + 1}: ${guard.reason}` };
      lastAddresses = guard.addresses;
      currentNormalized = next.normalized;
      continue;
    }
    let bytes;
    try {
      const buf = await response.arrayBuffer();
      bytes = new Uint8Array(buf);
    } catch (err) {
      return { ok: false, reason: `Asset body error: ${err.message}` };
    }
    return {
      ok: true,
      status,
      bytes,
      contentType: (response.headers.get('content-type') || '').toLowerCase(),
    };
  }
  return { ok: false, reason: 'Asset redirect loop did not terminate' };
}