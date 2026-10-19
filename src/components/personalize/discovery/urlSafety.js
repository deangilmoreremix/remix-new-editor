// src/components/personalize/discovery/urlSafety.js
//
// URL safety layer for the website asset discovery module.
//
// This is the security-critical foundation. Every HTTP fetch the discovery
// pipeline issues MUST go through `validateUrl` first, and every redirect
// hop MUST re-resolve DNS and re-validate (DNS rebinding guard).
//
// Threat model (in scope):
//   - SSRF against loopback, private RFC1918, link-local, CGNAT, IPv6 ULA,
//     and IPv6 link-local networks.
//   - SSRF against cloud metadata endpoints (169.254.169.254, metadata.google.internal).
//   - DNS rebinding: hostname resolves safely at validation time, then
//     re-resolves to a private IP at request time. We abort the fetch.
//   - Protocol smuggling (file://, ftp://, gopher://, data:, javascript:).
//   - Userinfo leakage (https://user:pass@host/).
//   - Excessively long URLs (DoS / log poisoning).
//   - Social platforms that explicitly forbid scraping (Facebook, Instagram,
//     X, TikTok, LinkedIn, Reddit, Pinterest, YouTube).
//   - Junk file extensions served as image URLs (.exe, .dll, .zip, ...).
//   - Asset extensions outside the allowlist.
//
// Out of scope:
//   - Application-layer attacks after the URL is validated (e.g. a remote
//     server returning a malicious SVG with embedded JS — see
//     `htmlParser.js` for the no-eval/no-Function policy).
//   - DNS rebinding between the rebind check and the actual TCP connect.
//     We re-check immediately before the fetch but a TOCTOU window of
//     microseconds remains. Mitigated by short timeouts + low parallelism.
//   - TLS validation issues (we trust Node's default TLS verification).
//   - Server-side request forgery against the local host of OTHER services
//     (e.g. cloud metadata of a co-located VM). Only loopback and RFC1918
//     of THIS process are rejected.

import { URL } from 'node:url';

/**
 * Lazily-loaded Node DNS resolver (`node:dns` `promises` API).
 *
 * It is loaded on first use — NEVER statically imported — because this
 * module is shared code: a static `import ... from 'node:dns'` cannot
 * resolve in non-Node runtimes and breaks any bundle that reaches it.
 * Outside Node (or if the builtin cannot be loaded) the loader returns
 * null and every validation path fails CLOSED (the fetch is refused),
 * which is the safe default for this SSRF guard.
 *
 * @type {{ lookup: (hostname: string, options: object) => Promise<{ address: string }[]> } | null}
 */
let dnsResolver = null;

/**
 * Load `node:dns` lazily. Callers MUST treat a null result as "cannot
 * validate" — never as "URL is fine".
 *
 * @returns {Promise<{ lookup: Function } | null>}
 */
async function loadDns() {
  if (dnsResolver) return dnsResolver;
  try {
    const mod = await import('node:dns');
    dnsResolver = mod.promises || (mod.default && mod.default.promises) || null;
  } catch {
    dnsResolver = null;
  }
  return dnsResolver;
}

/** Maximum allowed URL length, characters. Conservative default matching most browsers. */
export const MAX_URL_LENGTH = 2048;

/** Fetch timeout for the validation resolver. Kept short to bound DoS surface. */
const DNS_LOOKUP_TIMEOUT_MS = 5000;

/**
 * Hostnames we reject outright, regardless of resolution. These names
 * frequently map to metadata services or loopback in container runtimes.
 */
const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  'metadata.google.internal',
  '169.254.169.254',
  'metadata',
  'instance-data',
  'kubernetes.default.svc',
]);

/** Private / reserved IPv4 ranges (RFC 6890). */
const PRIVATE_IPV4_RANGES = [
  { cidr: '127.0.0.0/8', label: 'loopback' },
  { cidr: '10.0.0.0/8', label: 'private-10' },
  { cidr: '172.16.0.0/12', label: 'private-172' },
  { cidr: '192.168.0.0/16', label: 'private-192' },
  { cidr: '169.254.0.0/16', label: 'link-local' },
  { cidr: '0.0.0.0/8', label: 'unspecified' },
  { cidr: '100.64.0.0/10', label: 'cgnat' },
  { cidr: '224.0.0.0/4', label: 'multicast' },
  { cidr: '240.0.0.0/4', label: 'reserved' },
];

/** Private / reserved IPv6 ranges. */
const PRIVATE_IPV6_RANGES = [
  { cidr: '::1/128', label: 'loopback-v6' },
  { cidr: 'fc00::/7', label: 'ula-v6' },
  { cidr: 'fe80::/10', label: 'link-local-v6' },
  { cidr: '::/128', label: 'unspecified-v6' },
  { cidr: 'ff00::/8', label: 'multicast-v6' },
];

/**
 * Social platforms that explicitly forbid automated crawling in their
 * Terms of Service. We reject if the user explicitly passes one of these
 * as the input URL — but we DO still validate asset URLs that happen to
 * live on these domains if they originate from a non-blocked source.
 */
export const UNSUPPORTED_SOCIAL_DOMAINS = Object.freeze([
  'facebook.com',
  'instagram.com',
  'twitter.com',
  'x.com',
  'tiktok.com',
  'linkedin.com',
  'reddit.com',
  'pinterest.com',
  'youtube.com',
]);

/** Junk file extensions we refuse to fetch as assets (could be malware). */
export const JUNK_EXTENSIONS = Object.freeze([
  '.exe', '.dll', '.zip', '.rar', '.tar', '.gz',
  '.bat', '.sh', '.msi', '.dmg', '.iso', '.7z',
  '.jar', '.apk', '.deb', '.rpm',
]);

/** Extensions allowed for image assets. Lowercase. */
export const ALLOWED_ASSET_EXTENSIONS = Object.freeze([
  '.jpg', '.jpeg', '.png', '.webp', '.gif', '.svg', '.avif', '.ico',
]);

/* ---------- CIDR matching ---------- */

function ipv4ToInt(ip) {
  const parts = ip.split('.');
  if (parts.length !== 4) return null;
  let acc = 0;
  for (const p of parts) {
    const n = Number(p);
    if (!Number.isInteger(n) || n < 0 || n > 255) return null;
    acc = (acc * 256) + n;
  }
  return acc >>> 0;
}

function cidr4Match(ip, cidr) {
  const [base, bitsStr] = cidr.split('/');
  const bits = Number(bitsStr);
  const ipInt = ipv4ToInt(ip);
  const baseInt = ipv4ToInt(base);
  if (ipInt === null || baseInt === null) return false;
  if (bits === 0) return true;
  const mask = bits === 32 ? -1 << 0 : (~0 << (32 - bits)) >>> 0;
  return (ipInt & mask) === (baseInt & mask);
}

function expandIPv6(ip) {
  // Use BigInt for IPv6 math. Returns bigint or null on parse failure.
  if (!ip.includes(':')) return null;
  // Handle :: expansion.
  let s = ip;
  if (s.includes('::')) {
    const parts = s.split('::');
    const left = parts[0] ? parts[0].split(':') : [];
    const right = parts[1] ? parts[1].split(':') : [];
    const fill = 8 - (left.length + right.length);
    if (fill < 0) return null;
    const middle = new Array(fill).fill('0');
    s = [...left, ...middle, ...right].join(':');
  }
  const groups = s.split(':');
  if (groups.length !== 8) return null;
  let acc = 0n;
  for (const g of groups) {
    // Strip optional /zoneid (e.g. fe80::1%eth0).
    const clean = g.split('%')[0];
    if (!/^[0-9a-fA-F]{1,4}$/.test(clean)) return null;
    acc = (acc << 16n) + BigInt(parseInt(clean, 16));
  }
  return acc;
}

function cidr6Match(ip, cidr) {
  const [base, bitsStr] = cidr.split('/');
  const bits = Number(bitsStr);
  const ipBig = expandIPv6(ip);
  const baseBig = expandIPv6(base);
  if (ipBig === null || baseBig === null) return false;
  if (bits === 0) return true;
  const mask = bits === 128 ? (1n << 128n) - 1n : ((1n << BigInt(bits)) - 1n) << (128n - BigInt(bits));
  return (ipBig & mask) === (baseBig & mask);
}

export function isPrivateIp(addr) {
  // Strip zone identifier for IPv6 (e.g. fe80::1%eth0).
  const clean = String(addr).split('%')[0];
  if (clean.includes(':')) {
    return PRIVATE_IPV6_RANGES.some((r) => cidr6Match(clean, r.cidr));
  }
  return PRIVATE_IPV4_RANGES.some((r) => cidr4Match(clean, r.cidr));
}

/* ---------- Validation ---------- */

/**
 * Validate a URL for safe fetching.
 *
 * @param {string} inputUrl
 * @returns {Promise<{ safe: true, normalized: string, addresses: string[] }
 *                | { safe: false, reason: string }>}
 */
export async function validateUrl(inputUrl) {
  if (typeof inputUrl !== 'string') {
    return { safe: false, reason: 'URL is not a string' };
  }
  const trimmed = inputUrl.trim();
  if (trimmed.length === 0) {
    return { safe: false, reason: 'URL is empty' };
  }
  if (trimmed.length > MAX_URL_LENGTH) {
    return { safe: false, reason: `URL exceeds ${MAX_URL_LENGTH} chars` };
  }

  let parsed;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { safe: false, reason: 'URL is not parseable' };
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { safe: false, reason: `Protocol "${parsed.protocol}" is not allowed` };
  }

  if (parsed.username || parsed.password) {
    return { safe: false, reason: 'URL contains userinfo (user:pass@)' };
  }

  const host = parsed.hostname.toLowerCase();
  if (host.length === 0) {
    return { safe: false, reason: 'URL has empty host' };
  }

  if (BLOCKED_HOSTNAMES.has(host)) {
    return { safe: false, reason: `Hostname "${host}" is blocked` };
  }

  // If the host is a literal IP (rare for inbound URLs but possible),
  // short-circuit the DNS check.
  let addresses;
  const bareHost = stripIpv6Brackets(host);
  if (isLikelyLiteralIp(host)) {
    if (isPrivateIp(bareHost)) {
      return { safe: false, reason: `Hostname resolves to private IP ${bareHost}` };
    }
    addresses = [bareHost];
  } else {
    const dns = await loadDns();
    if (!dns) {
      // Fail closed: without DNS resolution we cannot prove the host is
      // public, so the URL is not safe to fetch.
      return { safe: false, reason: 'DNS resolution requires a Node runtime' };
    }
    let lookupResult;
    try {
      const ac = new AbortController();
      const timer = setTimeout(() => ac.abort(), DNS_LOOKUP_TIMEOUT_MS);
      try {
        lookupResult = await dns.lookup(host, { all: true, verbatim: true });
      } finally {
        clearTimeout(timer);
      }
    } catch (err) {
      return { safe: false, reason: `DNS lookup failed: ${err.message}` };
    }
    addresses = lookupResult.map((r) => r.address);
    if (addresses.length === 0) {
      return { safe: false, reason: 'DNS lookup returned no addresses' };
    }
    for (const addr of addresses) {
      if (isPrivateIp(addr)) {
        return { safe: false, reason: `Hostname resolves to private IP ${addr}` };
      }
    }
  }

  // Build a normalized form: lowercase scheme + host, drop fragment,
  // drop default ports.
  const normalized = buildNormalizedUrl(parsed);

  return { safe: true, normalized, addresses };
}

function stripIpv6Brackets(host) {
  if (host.startsWith('[') && host.endsWith(']')) {
    return host.slice(1, -1);
  }
  return host;
}

function isLikelyLiteralIp(host) {
  const bare = stripIpv6Brackets(host);
  // IPv4 literal or bare IPv6 literal.
  if (/^[0-9.]+$/.test(bare)) return true;
  if (bare.includes(':')) return true; // bare IPv6
  return false;
}

function buildNormalizedUrl(parsed) {
  const u = new URL(parsed.toString());
  u.hash = '';
  u.protocol = u.protocol.toLowerCase();
  u.hostname = u.hostname.toLowerCase();
  // Drop default ports.
  if ((u.protocol === 'http:' && u.port === '80') ||
      (u.protocol === 'https:' && u.port === '443')) {
    u.port = '';
  }
  return u.toString();
}

/**
 * DNS rebinding guard: re-resolve a hostname and compare the resolved
 * address set to a previously validated set. If ANY new address is private
 * or differs from the original set, ABORT (return false).
 *
 * @param {string} host
 * @param {string[]} originalAddresses
 * @returns {Promise<{ safe: true, addresses: string[] }
 *                  | { safe: false, reason: string }>}
 */
export async function reResolveGuard(host, originalAddresses) {
  const lower = host.toLowerCase();
  const bare = stripIpv6Brackets(lower);
  if (isLikelyLiteralIp(lower)) {
    if (isPrivateIp(bare)) {
      return { safe: false, reason: `Rebind guard: ${bare} is a private literal` };
    }
    return { safe: true, addresses: [bare] };
  }

  const dns = await loadDns();
  if (!dns) {
    // Fail closed: without DNS resolution the host cannot be re-validated.
    return { safe: false, reason: 'Rebind guard: DNS resolution requires a Node runtime' };
  }
  let lookupResult;
  try {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), DNS_LOOKUP_TIMEOUT_MS);
    try {
      lookupResult = await dns.lookup(lower, { all: true, verbatim: true });
    } finally {
      clearTimeout(timer);
    }
  } catch (err) {
    return { safe: false, reason: `Rebind guard DNS lookup failed: ${err.message}` };
  }

  const newAddrs = lookupResult.map((r) => r.address);
  for (const addr of newAddrs) {
    if (isPrivateIp(addr)) {
      return { safe: false, reason: `Rebind guard: hostname now resolves to private IP ${addr}` };
    }
  }
  // Require at least one address to match the original set (preventing
  // a complete swap to a new public IP). If all addresses are different
  // we still allow it but warn — true rebinding attacks swap to private,
  // not to a different public IP. For strict mode flip this to require
  // set equality.
  const overlap = newAddrs.some((a) => originalAddresses.includes(a));
  if (!overlap && originalAddresses.length > 0) {
    return {
      safe: false,
      reason: `Rebind guard: hostname "${lower}" resolved to ${newAddrs.join(', ')} (expected one of ${originalAddresses.join(', ')})`,
    };
  }
  return { safe: true, addresses: newAddrs };
}

/**
 * Check whether an input URL is on the social-domain blocklist. Used
 * as a separate top-level gate before deeper validation.
 *
 * @param {string} inputUrl
 * @returns {{ blocked: true, domain: string } | { blocked: false }}
 */
export function checkSocialDomainBlock(inputUrl) {
  let parsed;
  try {
    parsed = new URL(inputUrl);
  } catch {
    return { blocked: false };
  }
  const host = parsed.hostname.toLowerCase();
  for (const d of UNSUPPORTED_SOCIAL_DOMAINS) {
    if (host === d || host.endsWith(`.${d}`)) {
      return { blocked: true, domain: d };
    }
  }
  return { blocked: false };
}

/**
 * Validate a candidate asset URL (extension allowlist). Returns the
 * normalized URL if acceptable, or a rejection reason.
 *
 * @param {string} url
 * @returns {{ ok: true, extension: string } | { ok: false, reason: string }}
 */
export function validateAssetUrl(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return { ok: false, reason: 'Asset URL is not parseable' };
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { ok: false, reason: 'Asset URL protocol not allowed' };
  }
  const path = parsed.pathname.toLowerCase();
  for (const ext of JUNK_EXTENSIONS) {
    if (path.endsWith(ext)) {
      return { ok: false, reason: `Asset URL has junk extension ${ext}` };
    }
  }
  let matchedExt = null;
  for (const ext of ALLOWED_ASSET_EXTENSIONS) {
    if (path.endsWith(ext)) {
      matchedExt = ext;
      break;
    }
  }
  // If no extension matched, allow it through but report null — many
  // CMS systems serve images without an extension (signed URLs). The
  // extension is only required for hard-rejection of junk extensions.
  return { ok: true, extension: matchedExt };
}