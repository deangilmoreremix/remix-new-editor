/**
 * Server-side Playwright/Chromium fallback for business asset discovery.
 *
 * This module is only invoked when the static axios+Cheerio path appears
 * insufficient. It keeps browser resources bounded and preserves the
 * existing security model.
 *
 * SSRF posture (see `tests/browser-discovery-ssrf.vitest.test.ts` and
 * `tests/discovery-proxy-failclosed.vitest.test.ts`): the destination the
 * browser is navigated to, every subresource the page requests and every
 * redirect the browser wants to follow clear one shared gate. The gate is
 * applied twice — by the `context.route` interceptor, which is the layer that
 * sees subresources, and by a mandatory local allowlist proxy, which is the
 * only layer that sees *every* socket the browser opens (the interceptor is
 * not called for redirect targets or service-worker fetches). A discovery run
 * that cannot start its proxy fails closed instead of running with one layer.
 */

import { SITE_USER_AGENT } from '../lib/siteRequestHeaders'
import { isThirdPartyAdUrl } from './adDomains'
import { createRequire } from 'node:module'
import { isIPv6 } from 'node:net'

import {
  MAX_REDIRECT_HOPS,
  createPinnedAgent,
  isBlockedHostname,
  isBlockedIpAddress,
  pickPinnedAddress,
  resolvePublicAddresses,
  validateRedirect,
} from '../lib/networkSafety'

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

export const BROWSER_FALLBACK_MAX_PAGES = 4
export const BROWSER_FALLBACK_MAX_CANDIDATES = 60
export const BROWSER_FALLBACK_NAVIGATION_TIMEOUT = 9_000
export const BROWSER_FALLBACK_SCROLL_TIMEOUT = 2_000
export const BROWSER_FALLBACK_SCROLL_ATTEMPTS = 3
export const BROWSER_FALLBACK_SCROLL_DELAY = 300
export const BROWSER_FALLBACK_MAX_IMAGES_PER_PAGE = 40

// ---------------------------------------------------------------------------
// SSRF limits
// ---------------------------------------------------------------------------

/**
 * Hard cap on the redirect hops a single navigation may take. The number comes
 * from `src/lib/networkSafety.ts` so the browser path and every other
 * server-side fetch share one budget.
 */
export const BROWSER_SSRF_MAX_REDIRECTS = MAX_REDIRECT_HOPS
/** Maximum number of pages that may be open/navigating at the same time. */
export const BROWSER_SSRF_MAX_CONCURRENT_PAGES = 2
/** Maximum number of in-flight resource requests allowed per browser context. */
export const BROWSER_SSRF_MAX_INFLIGHT_REQUESTS = 64
/** Longest URL the gate will even consider. */
export const BROWSER_SSRF_MAX_URL_LENGTH = 2048
/** How long a resolved DNS answer is trusted before it must be resolved again. */
export const BROWSER_SSRF_DNS_TTL_MS = 30_000

// Resource types to block during discovery to improve performance.
const BLOCKED_RESOURCE_TYPES = [
  'media',
  'font',
  'stylesheet',
]

// Patterns for URLs that should be blocked.
const BLOCKED_URL_PATTERNS = [
  /google-analytics\.com/i,
  /googletagmanager\.com/i,
  /doubleclick\.net/i,
  /facebook\.com\/tr/i,
  /twitter\.com\/i\/ads/i,
  /ads\/|advertising/i,
  /analytics/i,
  /tracking/i,
]

// ---------------------------------------------------------------------------
// SSRF gate
//
// The pipeline used to filter only *junk* and *social* paths. It never looked
// at where a socket was about to go, so any caller could make the server fetch
// internal URLs (169.254.169.254, RFC1918 hosts, IPv6 ULA, ...). Everything
// below is the destination gate: scheme, literal-address spelling, resolved
// address, redirect hops.
// ---------------------------------------------------------------------------

const ALLOWED_PROTOCOLS = new Set(['http:', 'https:'])

/**
 * Schemes that never open a socket. They are permitted for *subresources*
 * only; the navigation target itself must be http/https.
 */
const NON_NETWORK_SUBRESOURCE_SCHEMES = new Set(['data:', 'blob:', 'about:'])

const HOSTNAME_LABEL = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/

const CANONICAL_IPV4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/

/** One integer literal in any base: `127`, `0177`, `0x7f`. */
const INTEGER_LITERAL_PART = /^(?:0[xX][0-9a-fA-F]+|0[0-7]+|0|[1-9][0-9]*)$/

/**
 * Suffixes reserved for internal use. A host ending in one of these is never a
 * public destination, even when the name is globally unique.
 */
const BLOCKED_HOST_SUFFIXES = [
  '.localhost',
  '.local',
  '.localdomain',
  '.internal',
  '.intranet',
  '.corp',
  '.home',
  '.lan',
  '.onion',
  '.test',
  '.invalid',
  '.example',
]

/** Well-known internal / cloud-metadata names with no dot of their own. */
const BLOCKED_HOST_NAMES = new Set([
  'localhost',
  'ip6-localhost',
  'ip6-loopback',
  'metadata',
  'metadata.google.internal',
  'metadata.goog',
  'instance-data',
])

/** Thrown whenever a destination fails the SSRF gate. */
export class BrowserSsrfError extends Error {
  readonly url: string
  readonly hostname: string

  constructor(message: string, url: string, hostname = '') {
    super(message)
    this.name = 'BrowserSsrfError'
    this.url = url
    this.hostname = hostname
  }
}

/** Resolves a host name to the addresses a connection would actually use. */
export type DnsResolver = (hostname: string) => Promise<string[]>

/**
 * Production resolver. Delegates to `src/lib/networkSafety.ts`, which performs
 * the DNS lookups *and* re-checks every answer against the blocked ranges, so
 * a name that flips to 169.254.169.254 after this gate has run cannot be used
 * to reach it. `NetworkSafetyError` is translated into the message this module
 * has always thrown so the callers (and their tests) keep working.
 */
async function systemDnsResolver(hostname: string): Promise<string[]> {
  return resolvePublicAddresses(hostname, {})
}

const defaultDnsResolver: DnsResolver = systemDnsResolver

// --- literal address parsing -------------------------------------------------

/**
 * Canonical dotted-quad IPv4 → uint32.
 *
 * Returns null for every other spelling, including the smuggled forms
 * (`0177.0.0.1`, `0x7f.0.0.1`, `127.1`, `2130706433`). Those are rejected
 * outright rather than normalised, because a host name made only of integer
 * literals can never be a real DNS name.
 */
function parseCanonicalIpv4(hostname: string): number | null {
  const match = CANONICAL_IPV4.exec(hostname)
  if (!match) return null

  let value = 0
  for (const part of match.slice(1)) {
    // A leading zero is the octal smuggling vector: `0177.0.0.1` is 127.0.0.1.
    if (/^0\d/.test(part)) return null
    const octet = Number(part)
    if (octet > 255) return null
    value = value * 256 + octet
  }
  return value
}

/** True for a hostname written as a numeric literal that is not canonical. */
function isNonCanonicalIpLiteral(hostname: string): boolean {
  const parts = hostname.split('.')
  if (parts.length === 0 || parts.length > 4) return false
  return parts.every((part) => INTEGER_LITERAL_PART.test(part))
}

/**
 * IPv6 → the eight 16-bit groups of the address (an embedded IPv4 tail is
 * folded into the last two groups). Groups rather than a 128-bit integer so
 * the prefix checks stay readable and ES2017-compatible.
 */
function parseIpv6Groups(hostname: string): number[] | null {
  let value = hostname.split('%')[0] // drop any zone id, e.g. `fe80::1%eth0`
  if (!/^[0-9a-fA-F:.]+$/.test(value)) return null

  // Fold an embedded IPv4 tail (`::ffff:192.168.1.1`) into two hex groups.
  // `>>>` matters here: `>>` sign-extends, so any first octet >= 128 would
  // produce a negative hex group and the parse would fail closed.
  const lastColon = value.lastIndexOf(':')
  if (lastColon !== -1) {
    const tail = value.slice(lastColon + 1)
    if (tail.includes('.')) {
      const ipv4 = parseCanonicalIpv4(tail)
      if (ipv4 === null) return null
      value = `${value.slice(0, lastColon + 1)}${(ipv4 >>> 16).toString(16)}:${(ipv4 & 0xffff).toString(16)}`
    }
  }

  const compressed = value.includes('::')
  const [head, tail] = compressed ? value.split('::') : [value, '']
  if (head.startsWith(':') || tail.endsWith(':')) return null

  const headGroups = head ? head.split(':') : []
  const tailGroups = tail ? tail.split(':') : []
  const missing = 8 - headGroups.length - tailGroups.length
  if (!compressed && headGroups.length !== 8) return null
  if (compressed && missing < 0) return null

  const groups = [
    ...headGroups,
    ...Array<string>(compressed ? missing : 0).fill('0'),
    ...tailGroups,
  ]
  if (groups.length !== 8) return null

  const parsed: number[] = []
  for (const group of groups) {
    if (!/^[0-9a-f]{1,4}$/i.test(group)) return null
    const value16 = parseInt(group, 16)
    if (!Number.isFinite(value16)) return null
    parsed.push(value16)
  }
  return parsed
}

function ipv4ToString(value: number): string {
  return [(value >>> 24) & 0xff, (value >>> 16) & 0xff, (value >>> 8) & 0xff, value & 0xff].join('.')
}

interface IpVerdict {
  unsafe: boolean
  reason: string
}

function unsafeVerdict(reason: string): IpVerdict {
  return { unsafe: true, reason }
}

const SAFE_VERDICT: IpVerdict = { unsafe: false, reason: '' }

function classifyIpv4(value: number): IpVerdict {
  const first = (value >>> 24) & 0xff
  const second = (value >>> 16) & 0xff

  if (value === 0 || first === 0) {
    return unsafeVerdict('0.0.0.0/8 is the "this network" / unspecified range')
  }
  if (first === 10) return unsafeVerdict('10.0.0.0/8 is a private range')
  if (first === 172 && second >= 16 && second <= 31) {
    return unsafeVerdict('172.16.0.0/12 is a private range')
  }
  if (first === 192 && second === 168) return unsafeVerdict('192.168.0.0/16 is a private range')
  if (first === 127) return unsafeVerdict('127.0.0.0/8 is the loopback range')
  if (first === 169 && second === 254) {
    return unsafeVerdict(
      '169.254.0.0/16 is link-local and includes the cloud metadata service 169.254.169.254',
    )
  }
  if (first === 100 && second >= 64 && second <= 127) {
    return unsafeVerdict('100.64.0.0/10 is the CGNAT shared range')
  }
  if (first === 192 && second === 0) {
    return unsafeVerdict('192.0.0.0/24 is reserved (includes 192.0.2.0/24 TEST-NET-1)')
  }
  if (first === 198 && (second === 18 || second === 19)) {
    return unsafeVerdict('198.18.0.0/15 is reserved for benchmarking')
  }
  if (first === 198 && second === 51) return unsafeVerdict('198.51.100.0/24 is TEST-NET-2')
  if (first === 203 && second === 0) return unsafeVerdict('203.0.113.0/24 is TEST-NET-3')
  if (first >= 224) return unsafeVerdict('the address is in the multicast/reserved/broadcast range')
  return SAFE_VERDICT
}

/**
 * True for the IANA address-translation formats, where the top 96 bits are
 * nothing but 0x0000 / 0xffff filler: `::a.b.c.d`, `::ffff:a.b.c.d`,
 * `::ffff:0:a.b.c.d` and friends. Those spellings have to be judged on the
 * embedded IPv4, otherwise `[::ffff:169.254.169.254]` walks straight through.
 */
function isIpv4TransitionPrefix(groups: number[]): boolean {
  return groups.slice(0, 6).every((group) => group === 0 || group === 0xffff)
}

function classifyIpv6(groups: number[]): IpVerdict {
  const [g0, g1, g2, g3, g4, g5, g6, g7] = groups
  const low32 = (((g6 << 16) | g7) >>> 0)
  const allZeroHead = g0 === 0 && g1 === 0 && g2 === 0 && g3 === 0 && g4 === 0 && g5 === 0

  if (allZeroHead && g6 === 0 && g7 === 0) return unsafeVerdict(':: is the IPv6 unspecified address')
  if (allZeroHead && g6 === 0 && g7 === 1) return unsafeVerdict('::1 is the IPv6 loopback address')

  const embedded =
    isIpv4TransitionPrefix(groups) // ::ffff:0:0:a.b.c.d and every variant
      ? low32
      : g0 === 0x2002 // 6to4             2002:a.b.c.d::
        ? (((g1 << 16) | g2) >>> 0)
        : g0 === 0x0064 && g1 === 0xff9b // NAT64            64:ff9b::a.b.c.d
          ? low32
          : g0 === 0x2001 && g1 === 0x0000 // Teredo           2001:0::/32
            ? low32
            : null

  if (embedded !== null) {
    const verdict = classifyIpv4(embedded)
    if (verdict.unsafe) {
      return unsafeVerdict(`the IPv6 address wraps an unsafe IPv4 destination (${ipv4ToString(embedded)})`)
    }
    return SAFE_VERDICT
  }

  const top8 = g0 >> 8
  const top7 = g0 >> 9
  const top10 = g0 >> 6

  if (top10 === 0x3fa) return unsafeVerdict('fe80::/10 is the IPv6 link-local range')
  if (top7 === 0x7e) return unsafeVerdict('fc00::/7 is the IPv6 unique-local range')
  if (top8 === 0xff) return unsafeVerdict('ff00::/8 is the IPv6 multicast range')
  return SAFE_VERDICT
}

/**
 * Structural host-name gate. No network I/O happens here, so it is safe to run
 * synchronously and in unit tests.
 */
export function findUnsafeHostReason(hostnameInput: string): string | null {
  const raw = (hostnameInput || '').toLowerCase()
  const hostname = raw.replace(/^\[|\]$/g, '').replace(/\.+$/, '')

  if (!hostname) return 'the URL has no host name'
  if (hostname.length > 253) return 'the host name is too long'
  if (/[\s\u0000]/.test(hostname)) return 'the host name contains whitespace or a NUL byte'

  if (isIPv6(hostname)) {
    const value = parseIpv6Groups(hostname)
    if (value === null) return 'the IPv6 address is malformed'
    const verdict = classifyIpv6(value)
    return verdict.unsafe ? verdict.reason : null
  }

  if (hostname === 'localhost' || hostname.endsWith('.localhost')) {
    return 'the loopback host name is not a public destination'
  }
  if (BLOCKED_HOST_NAMES.has(hostname)) {
    return 'the host name is a well-known internal or cloud-metadata name'
  }
  const matchedSuffix = BLOCKED_HOST_SUFFIXES.find((suffix) => hostname.endsWith(suffix))
  if (matchedSuffix) return `the "${matchedSuffix}" suffix is reserved for internal use`

  const canonicalIpv4 = parseCanonicalIpv4(hostname)
  if (canonicalIpv4 !== null) {
    const verdict = classifyIpv4(canonicalIpv4)
    return verdict.unsafe ? verdict.reason : null
  }

  if (isNonCanonicalIpLiteral(hostname)) {
    return 'the IP address is not in canonical dotted-quad form; decimal, octal and hex spellings are rejected'
  }

  // A host name with no dot cannot be a public site: `http://intranet/`,
  // `http://router/` and friends are internal by construction.
  if (!hostname.includes('.')) return 'single-label host names are not public destinations'

  for (const label of hostname.split('.')) {
    if (!HOSTNAME_LABEL.test(label)) return 'the host name has an empty or malformed label'
  }

  // Second opinion from the centralized gate in `src/lib/networkSafety.ts`.
  // The local classifier above exists to produce a human-readable reason; the
  // allow/deny decision is cross-checked against Agent A's module so the two
  // cannot drift apart. Anything networkSafety rejects is rejected here too.
  if (isBlockedHostname(hostname)) {
    return `the host name is not a public destination (networkSafety rejected ${hostname})`
  }

  return null
}

/** Re-checks a single address returned by the resolver. */
function findUnsafeAddressReason(address: string): string | null {
  const value = (address || '').trim().toLowerCase().replace(/^\[|\]$/g, '')
  if (!value) return 'the resolver returned an empty address'

  if (isIPv6(value)) {
    const parsed = parseIpv6Groups(value)
    if (parsed === null) return 'the resolver returned a malformed IPv6 address'
    const verdict = classifyIpv6(parsed)
    return verdict.unsafe ? verdict.reason : null
  }

  const canonical = parseCanonicalIpv4(value)
  if (canonical !== null) {
    const verdict = classifyIpv4(canonical)
    return verdict.unsafe ? verdict.reason : null
  }
  return 'the resolver returned something that is not an IP literal'
}

/** True when the host name is itself an IP literal, so DNS can be skipped. */
function isIpLiteralHost(hostname: string): boolean {
  return isIPv6(hostname) || parseCanonicalIpv4(hostname) !== null
}

// --- resolver with caching ---------------------------------------------------

interface DnsCacheEntry {
  addresses: string[]
  expiresAt: number
}

/**
 * Wraps a resolver with a short-lived cache plus in-flight de-duplication, so
 * the per-subresource gate does not turn into a DNS thundering herd.
 */
export function createCachingDnsResolver(
  resolver: DnsResolver = defaultDnsResolver,
  ttlMs: number = BROWSER_SSRF_DNS_TTL_MS,
): DnsResolver {
  const cache = new Map<string, DnsCacheEntry>()
  const inFlight = new Map<string, Promise<string[]>>()

  return async (hostname: string) => {
    const now = Date.now()
    const hit = cache.get(hostname)
    if (hit && hit.expiresAt > now) return hit.addresses

    const pending = inFlight.get(hostname)
    if (pending) return pending

    const lookup = (async () => {
      const addresses = await resolver(hostname)
      if (!Array.isArray(addresses) || addresses.length === 0) {
        throw new Error(`DNS resolution for ${hostname} returned no addresses`)
      }
      cache.set(hostname, { addresses, expiresAt: Date.now() + ttlMs })
      return addresses
    })()

    inFlight.set(hostname, lookup)
    try {
      return await lookup
    } finally {
      inFlight.delete(hostname)
    }
  }
}

// --- the gate itself ---------------------------------------------------------

export interface ValidatedBrowserUrl {
  /** The URL that is safe to hand to `page.goto()`. */
  url: string
  hostname: string
  /** Addresses the host resolved to (empty for an IP literal). */
  addresses: string[]
  /** True when the destination was pinned to the addresses resolved here. */
  pinned: boolean
  /** The URL's protocol (`http:` / `https:`). */
  protocol: string
}

export interface ValidateBrowserUrlOptions {
  dnsResolver?: DnsResolver | null
  /** Redirect hops already taken to arrive at this URL. */
  redirectHops?: number
  maxRedirectHops?: number
}

/**
 * Validates a navigation target *before* a socket is opened.
 *
 * Throws `BrowserSsrfError` when the destination is not a verifiable public
 * http(s) destination. Never performs navigation itself.
 */
export async function validateBrowserNavigationUrl(
  rawUrl: string,
  options: ValidateBrowserUrlOptions = {},
): Promise<ValidatedBrowserUrl> {
  const input = typeof rawUrl === 'string' ? rawUrl.trim() : ''
  if (!input) throw new BrowserSsrfError('A navigation URL is required', String(rawUrl ?? ''))
  if (input.length > BROWSER_SSRF_MAX_URL_LENGTH) {
    throw new BrowserSsrfError(`The URL exceeds the ${BROWSER_SSRF_MAX_URL_LENGTH} character limit`, input)
  }

  let parsed: URL
  try {
    parsed = new URL(input)
  } catch {
    throw new BrowserSsrfError('The URL could not be parsed', input)
  }

  if (!ALLOWED_PROTOCOLS.has(parsed.protocol)) {
    throw new BrowserSsrfError('Only http/https protocols are allowed', input)
  }
  if (parsed.username || parsed.password) {
    throw new BrowserSsrfError('URLs with embedded credentials are not allowed', input)
  }

  const hostname = parsed.hostname.toLowerCase()
  const hostReason = findUnsafeHostReason(hostname)
  if (hostReason) {
    throw new BrowserSsrfError(`Destination rejected: ${hostReason}`, input, hostname)
  }

  const maxHops = options.maxRedirectHops ?? BROWSER_SSRF_MAX_REDIRECTS
  const hops = options.redirectHops ?? 0
  if (hops > maxHops) {
    throw new BrowserSsrfError(`Too many redirects (limit ${maxHops})`, input, hostname)
  }

  const addresses: string[] = []

  // A host name (as opposed to an IP literal) has to be resolved and every
  // answer re-checked, because `internal.example.com` may point at 10.0.0.5.
  if (!isIpLiteralHost(hostname)) {
    const resolver = options.dnsResolver ?? defaultDnsResolver
    let resolved: string[]
    try {
      resolved = await resolver(hostname)
    } catch (err) {
      // The delegated resolver (networkSafety) reports *why* it refused. Keep
      // the historical wording for an unresolvable name and be specific when
      // the answer itself was in a blocked range.
      const refused = err && typeof err === 'object' ? (err as { reason?: string }).reason : undefined
      if (refused === 'resolved_to_blocked_ip') {
        throw new BrowserSsrfError(
          `Destination rejected: ${hostname} resolves to an address in a blocked (private/loopback/link-local/metadata) range`,
          input,
          hostname,
        )
      }
      throw new BrowserSsrfError(
        `Destination rejected: the host name ${hostname} could not be resolved, so it cannot be verified`,
        input,
        hostname,
      )
    }
    if (!Array.isArray(resolved) || resolved.length === 0) {
      throw new BrowserSsrfError(
        `Destination rejected: the host name ${hostname} resolved to no addresses`,
        input,
        hostname,
      )
    }
    for (const address of resolved) {
      // Two independent classifiers must agree: the local one produces the
      // human-readable reason, networkSafety's `isBlockedIpAddress` is the
      // centralized fail-closed decision. Either one blocking the address
      // rejects the destination.
      const addressReason = findUnsafeAddressReason(address)
      if (addressReason || isBlockedIpAddress(address)) {
        throw new BrowserSsrfError(
          `Destination rejected: ${hostname} resolves to ${address} (${addressReason ?? 'blocked by networkSafety'})`,
          input,
          hostname,
        )
      }
      addresses.push(address)
    }
  }

  return { url: parsed.toString(), hostname, addresses, pinned: addresses.length > 0, protocol: parsed.protocol }
}

/**
 * `--host-resolver-rules` fragment that forces Chromium to connect to the
 * address Node just validated, closing part of the DNS-rebinding window.
 *
 * The address is chosen with networkSafety's `pickPinnedAddress`, which keeps
 * the family aligned with the literal that was validated (an IPv6 literal is
 * pinned to an IPv6 answer), so the Host header, the SNI and the certificate
 * verification all still use the original host name — only the peer IP is
 * pinned.
 */
export function buildHostResolverRules(pins: Array<{ hostname: string; addresses: string[] }>): string | undefined {
  const rules: string[] = []

  for (const pin of pins) {
    if (!pin || !pin.hostname || !Array.isArray(pin.addresses) || pin.addresses.length === 0) continue
    if (isIpLiteralHost(pin.hostname)) continue // already an address, nothing to pin
    const pinned =
      pickPinnedAddress({ hostname: pin.hostname, addresses: pin.addresses }) ||
      pin.addresses.find((address) => parseCanonicalIpv4(address) !== null)
    if (!pinned) continue
    rules.push(`MAP ${pin.hostname} ${pinned}`)
  }

  return rules.length > 0 ? rules.join(', ') : undefined
}

/**
 * Walks Playwright's redirect chain and returns how many hops it has already
 * taken.
 *
 * The walk is cycle-safe: a request whose `redirectedFrom` eventually points
 * back at a request it already visited would otherwise be counted forever.
 * Such a chain never terminates, so it is reported as one hop *over* the cap —
 * every caller that compares the result against `BROWSER_SSRF_MAX_REDIRECTS`
 * therefore refuses it.
 */
export function redirectHopCount(
  request:
    | { redirectedFrom?: () => { redirectedFrom?: () => unknown } | null | undefined }
    | null
    | undefined,
): number {
  const seen = new Set<unknown>()
  let hops = 0
  let current: { redirectedFrom?: () => unknown } | null | undefined =
    request && typeof request.redirectedFrom === 'function' ? request.redirectedFrom() : null

  while (current) {
    if (seen.has(current)) {
      // Cyclic chain: it never reaches a terminal request.
      return BROWSER_SSRF_MAX_REDIRECTS + 1
    }
    seen.add(current)
    hops += 1
    if (hops > BROWSER_SSRF_MAX_REDIRECTS) return hops
    current =
      typeof (current as { redirectedFrom?: () => unknown }).redirectedFrom === 'function'
        ? (current as { redirectedFrom: () => { redirectedFrom?: () => unknown } | null }).redirectedFrom()
        : null
  }

  return hops
}

/** True for the page's own top-level navigation (not an iframe, not a subresource). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function isMainFrameNavigation(request: any): boolean {
  try {
    if (typeof request?.isNavigationRequest !== 'function' || !request.isNavigationRequest()) return false
    const frame = typeof request.frame === 'function' ? request.frame() : null
    return !frame || typeof frame.parentFrame !== 'function' || frame.parentFrame() === null
  } catch {
    // Playwright throws from frame() for some service-worker requests: treat as a subresource.
    return false
  }
}

/** True when a request has already been redirected at (or past) the cap. */
export function exceedsRedirectHopLimit(
  request:
    | { redirectedFrom?: () => { redirectedFrom?: () => unknown } | null | undefined }
    | null
    | undefined,
): boolean {
  return redirectHopCount(request) > BROWSER_SSRF_MAX_REDIRECTS
}

/**
 * The URL the request was redirected *from*, when Playwright still has that
 * hop. Used to resolve a relative `Location` against the right base when the
 * centralized redirect validator re-checks a hop.
 */
function redirectedFromUrl(
  request:
    | {
        redirectedFrom?: () =>
          | { redirectedFrom?: () => unknown; url?: () => string }
          | null
          | undefined
      }
    | null
    | undefined,
): string | undefined {
  const parent =
    request && typeof request.redirectedFrom === 'function' ? request.redirectedFrom() : null
  if (!parent || typeof parent.url !== 'function') return undefined
  return parent.url()
}

export interface BrowserSsrfGuard {
  /** Cache-backed resolver shared by every check in one discovery run. */
  dnsResolver: DnsResolver
  /** True when the guard was built with an injected (hermetic) resolver. */
  readonly usesInjectedResolver: boolean
  /** Full gate for a navigation target (page URL or redirect target). */
  validateNavigationTarget(rawUrl: string, redirectHops?: number): Promise<ValidatedBrowserUrl>
  /** Gate for a browser subresource. Non-network schemes are allowed through. */
  isResourceRequestAllowed(rawUrl: string, currentUrl?: string): Promise<boolean>
  /** `--host-resolver-rules` fragment pinning host names to validated addresses. */
  hostResolverRules(pins: Array<{ hostname: string; addresses: string[] }>): string | undefined
}

export function createSsrfGuard(options: { dnsResolver?: DnsResolver | null } = {}): BrowserSsrfGuard {
  const injected = typeof options.dnsResolver === 'function'
  const dnsResolver = createCachingDnsResolver(options.dnsResolver ?? defaultDnsResolver)

  return {
    dnsResolver,
    usesInjectedResolver: injected,

    validateNavigationTarget(rawUrl, redirectHops = 0) {
      return validateBrowserNavigationUrl(rawUrl, { dnsResolver, redirectHops })
    },

    async isResourceRequestAllowed(rawUrl, currentUrl) {
      if (typeof rawUrl !== 'string' || !rawUrl) return false

      let parsed: URL
      try {
        parsed = new URL(rawUrl)
      } catch {
        return false
      }

      if (NON_NETWORK_SUBRESOURCE_SCHEMES.has(parsed.protocol)) return true
      if (!ALLOWED_PROTOCOLS.has(parsed.protocol)) return false

      // Hop 1: the local gate, which is the one the hermetic test suite drives
      // through an injected resolver (no socket, no real DNS).
      try {
        await validateBrowserNavigationUrl(parsed.toString(), { dnsResolver })
      } catch {
        return false
      }

      // Hop 2: the centralized redirect validator from networkSafety. It runs
      // the same protocol + hostname + resolve-and-validate price on the
      // destination *and* resolves the Location against the URL the browser is
      // currently on, which is what "re-validate every hop" means. It is only
      // usable with the production resolver: it owns its DNS, so injecting one
      // here would silently bypass the second opinion.
      if (!injected) {
        try {
          const next = await validateRedirect(rawUrl, currentUrl || rawUrl)
          if (!next) return false
        } catch {
          return false
        }
      }

      return true
    },

    hostResolverRules(pins) {
      return buildHostResolverRules(pins)
    },
  }
}

// ---------------------------------------------------------------------------
// Runtime guard / lazy loader
// ---------------------------------------------------------------------------

let cachedChromium: Promise<any> | null = null

// remix: the Netlify functions are ES modules, where `require` does not exist.
const requireFromHere = typeof require === 'function' ? require : createRequire(import.meta.url)

export function isBrowserDiscoveryAvailable(): boolean {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    requireFromHere.resolve('playwright')
    return true
  } catch {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      requireFromHere.resolve('playwright-core')
      return true
    } catch {
      return false
    }
  }
}

let serverlessChromiumEnvironmentReady = false

/**
 * Points the serverless Chromium at its bundled system libraries. Without it
 * the binary cannot start on Netlify's runtime (same bootstrap as
 * netlify/functions/personalization-browser-discovery.js).
 */
async function ensureServerlessChromiumEnvironment(): Promise<void> {
  if (serverlessChromiumEnvironmentReady) return
  try {
    const mod = await import('@sparticuz/chromium')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const setupLambdaEnvironment = (mod as any).setupLambdaEnvironment
    if (typeof setupLambdaEnvironment === 'function') {
      const { tmpdir } = await import('node:os')
      const { join } = await import('node:path')
      setupLambdaEnvironment(join(tmpdir(), 'al2023', 'lib'))
    }
  } catch {
    // Not a serverless runtime (or the package is absent): nothing to set up.
  }
  serverlessChromiumEnvironmentReady = true
}

async function getChromiumExecutablePath(): Promise<string | undefined> {
  await ensureServerlessChromiumEnvironment()
  try {
    // @sparticuz/chromium provides a Linux serverless-compatible Chromium.
    // Use it only when the local platform is not macOS, because the downloaded
    // binary is Linux ELF and cannot run on Darwin.
    if (process.platform !== 'darwin') {
      const { default: chromium } = await import('@sparticuz/chromium')
      return chromium.executablePath()
    }
  } catch {
    // Fall back to Playwright-managed Chromium below.
  }
  return undefined
}

/**
 * Launch flags. With the serverless Chromium, use its own flag set (it needs
 * e.g. single-process on Lambda-style runtimes) minus site isolation, which
 * crashes the page target there — the fix from the Netlify discovery function.
 */
async function getChromiumArgs(executablePath: string | undefined): Promise<string[]> {
  const base = ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu']
  if (!executablePath) return base
  try {
    const { default: chromium } = await import('@sparticuz/chromium')
    const args: string[] = Array.isArray(chromium.args) ? chromium.args : []
    // Untrusted pages: keep the same-origin policy and mixed-content blocking.
    const unsafe = new Set(['--disable-web-security', '--allow-running-insecure-content'])
    const filtered = args.filter(
      (arg) => !arg.startsWith('--disable-features=') && !arg.startsWith('--headless') && !unsafe.has(arg),
    )
    filtered.push('--disable-features=site-per-process')
    return filtered.length > 1 ? filtered : base
  } catch {
    return base
  }
}

async function getChromium() {
  if (!cachedChromium) {
    cachedChromium = (async () => {
      try {
        const { chromium } = await import('playwright')
        return chromium
      } catch {
        const { chromium } = await import('playwright-core')
        return chromium
      }
    })()
  }
  return cachedChromium
}

if (!isBrowserDiscoveryAvailable()) {
  console.warn('[browserDiscovery] Playwright is not available in this runtime; browser fallback is disabled.')
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BrowserImageCandidate {
  url: string
  sourcePage: string
  altText?: string
}

export interface BrowserDiscoveryResult {
  candidates: BrowserImageCandidate[]
  staticCandidates: number
  browserCandidates: number
  pagesCrawled: number
  fallbackUsed: boolean
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isBlockedUrl(url: string): boolean {
  return BLOCKED_URL_PATTERNS.some((pattern) => pattern.test(url))
}

function isLikelyJunk(url: string): boolean {
  const lower = url.toLowerCase()
  const path = new URL(url).pathname.toLowerCase()

  const junkFragments = [
    'favicon', 'icon', 'sprite', 'pixel', 'tracking', 'analytics', 'beacon',
    '1x1', 'spacer', 'loader', 'spinner', 'placeholder', 'blank',
  ]
  if (junkFragments.some((frag) => path.includes(frag))) return true
  if (path.endsWith('.svg')) return true
  if (path.endsWith('.gif')) return true

  const socialDomains = [
    'facebook.com', 'twitter.com', 'x.com', 'instagram.com', 'linkedin.com',
    'youtube.com', 'tiktok.com', 'pinterest.com', 'yelp.com', 'google.com',
    'maps.google', 'goo.gl', 'bit.ly', 'tinyurl.com',
  ]
  if (socialDomains.some((d) => lower.includes(d))) return true

  return false
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function extractRenderedImages(page: any, pageUrl: string): Promise<BrowserImageCandidate[]> {
  const candidates: BrowserImageCandidate[] = []
  const seen = new Set<string>()

  const add = (rawUrl: string, altText?: string) => {
    if (!rawUrl || rawUrl.startsWith('data:')) return
    let absolute: string
    try {
      absolute = new URL(rawUrl, pageUrl).toString()
    } catch {
      return
    }
    if (seen.has(absolute)) return
    if (isLikelyJunk(absolute)) return
    seen.add(absolute)
    candidates.push({ url: absolute, sourcePage: pageUrl, altText })
  }

  await page.evaluate(`
    (function() {
      var win = window;
      if (!win.__discoveryCandidates) {
        win.__discoveryCandidates = [];
      }

      function walk(root) {
        var imgs = root.querySelectorAll('img');
        for (var i = 0; i < imgs.length; i++) {
          var img = imgs[i];
          var src = img.src || '';
          var currentSrc = img.currentSrc || '';
          var dataSrc = img.getAttribute('data-src') || '';
          var dataSrcset = img.getAttribute('data-srcset') || '';
          var srcset = img.getAttribute('srcset') || '';

          if (src) win.__discoveryCandidates.push({ src: src, alt: img.alt || '' });
          if (currentSrc && currentSrc !== src) win.__discoveryCandidates.push({ src: currentSrc, alt: img.alt || '' });
          if (dataSrc) win.__discoveryCandidates.push({ src: dataSrc, alt: img.alt || '' });
          if (dataSrcset) {
            var dataEntries = dataSrcset.split(',').map(function(s) { return s.trim().split(/\\s+/)[0]; }).filter(Boolean);
            for (var j = 0; j < dataEntries.length; j++) {
              win.__discoveryCandidates.push({ src: dataEntries[j], alt: img.alt || '' });
            }
          }
          if (srcset) {
            var srcEntries = srcset.split(',').map(function(s) { return s.trim().split(/\\s+/)[0]; }).filter(Boolean);
            for (var k = 0; k < srcEntries.length; k++) {
              win.__discoveryCandidates.push({ src: srcEntries[k], alt: img.alt || '' });
            }
          }
        }

        var pictures = root.querySelectorAll('picture');
        for (var p = 0; p < pictures.length; p++) {
          var sources = pictures[p].querySelectorAll('source[srcset]');
          for (var s = 0; s < sources.length; s++) {
            var sourceSrcset = sources[s].getAttribute('srcset') || '';
            var sourceEntries = sourceSrcset.split(',').map(function(x) { return x.trim().split(/\\s+/)[0]; }).filter(Boolean);
            for (var e = 0; e < sourceEntries.length; e++) {
              win.__discoveryCandidates.push({ src: sourceEntries[e] });
            }
          }
        }

        var allElements = root.querySelectorAll('[style]');
        for (var el = 0; el < allElements.length; el++) {
          var bg = allElements[el].style.backgroundImage;
          if (bg && bg.includes('url(')) {
            var match = bg.match(/url\\(["']?([^"')]+)["']?\\)/);
            if (match && match[1]) {
              win.__discoveryCandidates.push({ src: match[1] });
            }
          }
        }
      }

      walk(document);
    })()
  `)

  const raw = (await page.evaluate(`
    (function() {
      var win = window;
      if (!win.__discoveryCandidates) {
        return [];
      }
      return win.__discoveryCandidates;
    })()
  `)) as Array<{ src: string; alt?: string }>

  for (const item of raw) {
    add(item.src, item.alt)
  }

  return candidates
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function scrollPage(page: any, maxAttempts: number, delayMs: number): Promise<void> {
  let lastHeight = 0
  let attempts = 0

  await page.waitForTimeout(500)

  while (attempts < maxAttempts) {
    const currentHeight = await page.evaluate('document.documentElement.scrollHeight')
    if (currentHeight === lastHeight) break

    lastHeight = currentHeight
    await page.evaluate('window.scrollBy(0, window.innerHeight * 0.8)')
    await page.waitForTimeout(delayMs)
    attempts++
  }

  await page.evaluate('window.scrollTo(0, 0)')
}

let cachedBrowser: { pinKey: string; browser: Promise<any> } | null = null

interface BrowserPin {
  hostname: string
  addresses: string[]
}

function browserPinKey(pins: BrowserPin[]): string {
  return pins.map((pin) => `${pin.hostname}=${(pin.addresses || []).join('|')}`).join(';')
}

/**
 * Launches Chromium. `headless: true` is deliberate and must stay that way.
 *
 * `pins` adds a `--host-resolver-rules` entry so the browser process connects
 * to the address Node already validated instead of resolving the name a second
 * time. That closes part of the DNS-rebinding window: without it the browser's
 * own resolver could return a different (internal) answer between Node's check
 * and Chromium's connect.
 *
 * `proxyUrl`, when present, is the local allowlist proxy from
 * `startAllowlistProxy`. It is the *network-level* half of the guard: every
 * socket the browser opens is refused by the proxy unless the destination has
 * already cleared the same gate, and the upstream connection is then made
 * through networkSafety's pinned lookup, so even a `context.route()` bypass
 * cannot reach a private address.
 */
async function launchChromium(pins: BrowserPin[], proxyUrl?: string): Promise<any> {
  const chromium = await getChromium()
  const executablePath = await getChromiumExecutablePath()
  const args = await getChromiumArgs(executablePath)

  const resolverRules = buildHostResolverRules(pins)
  if (resolverRules) {
    args.push(`--host-resolver-rules=${resolverRules}`)
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const launchOptions: Record<string, any> = { headless: true, executablePath, args }
  if (proxyUrl) {
    launchOptions.proxy = { server: proxyUrl }
  }

  return chromium.launch(launchOptions)
}

async function acquireBrowser(pins: BrowserPin[], proxyUrl?: string): Promise<{ browser: any; owned: boolean }> {
  // A browser launched behind the allowlist proxy is only ever usable behind
  // *that* proxy, and the proxy's lifetime is one discovery run. Reusing a warm
  // browser left over from a previous run would point its whole network stack
  // at a listener that has already been closed, so the warm cache is bypassed
  // and this run owns (and closes) the process it started.
  if (proxyUrl) {
    return { browser: await launchChromium(pins, proxyUrl), owned: true }
  }

  const pinKey = browserPinKey(pins)

  // If we have a cached browser, verify it is still alive and still pinned to
  // the same validated addresses.
  const cached = cachedBrowser
  if (cached && cached.pinKey === pinKey) {
    try {
      const browser = await cached.browser
      if (browser && typeof browser.isConnected === 'function' && !browser.isConnected()) {
        cachedBrowser = null
      } else {
        return { browser, owned: false }
      }
    } catch {
      cachedBrowser = null
    }
  }

  const launch = launchChromium(pins, proxyUrl).catch((err) => {
    if (cachedBrowser && cachedBrowser.pinKey === pinKey && cachedBrowser.browser === launch) {
      cachedBrowser = null
    }
    throw err
  })

  if (cachedBrowser && cachedBrowser.pinKey !== pinKey) {
    // A browser pinned to a different host is already warm. Chromium's resolver
    // rules are fixed at launch, so this run gets its own process and owns it.
    return { browser: await launch, owned: true }
  }

  cachedBrowser = { pinKey, browser: launch }
  return { browser: await launch, owned: false }
}

// ---------------------------------------------------------------------------
// Network-level restriction: a local allowlist proxy
//
// `context.route('**/*', ...)` is a *request* filter. It sits above the
// browser's network stack, so anything that can make the browser issue a
// request without going through the interceptor (a bug in the handler, a
// redirect the handler mis-counts, a prefetch, a service worker) still gets a
// socket. The proxy below removes that class of bypass entirely: Chromium is
// launched with `--proxy-server`, so *every* connection it makes terminates in
// this process, and the destination is re-validated here with the very same
// gate before an upstream socket is opened. The upstream connection is opened
// through networkSafety's pinned lookup (`createPinnedLookup`), so the address
// that was validated is the address that is connected to.
//
// Limits, stated plainly:
//   * It is a separate process-local listener, so it only protects this
//     deployment's Chromium; it is not a network ACL.
//   * The tunnel validates the host name at CONNECT time; it cannot see what
//     happens afterwards inside the TLS session, which is why the
//     `context.route()` interceptor is kept as well (defence in depth, not
//     redundancy).
//   * Chromium resolves nothing itself when an explicit proxy is configured,
//     so `--host-resolver-rules` remains a second binding on top of the proxy
//     rather than a substitute for it. There is deliberately no proxy-less
//     fallback path any more: a run that cannot start its proxy fails closed.
// ---------------------------------------------------------------------------

export interface AllowlistProxy {
  /** `http://127.0.0.1:<port>` to hand to `chromium.launch({ proxy })`. */
  url: string
  /** Number of destinations the proxy refused. */
  rejected(): number
  close(): Promise<void>
}

/**
 * The address the proxy must connect to for a validated destination: the
 * pinned DNS answer, or the literal itself when the destination was already an
 * IP address (nothing to resolve, so the literal is the connection target).
 */
function pinnedAddressFor(destination: ValidatedBrowserUrl): string | null {
  const pinned = pickPinnedAddress(destination)
  if (pinned) return pinned
  return isIpLiteralHost(destination.hostname) ? destination.hostname : null
}

/**
 * True when the allowlist proxy should be used for this run.
 *
 * Decision, documented per the security review: the environment escape hatch
 * `BROWSER_DISCOVERY_ALLOWLIST_PROXY=0` is a *development* affordance only. In
 * production it is ignored outright, because silently running without the
 * network-level layer would leave nothing but `context.route()` between a page
 * and an internal address, and that interceptor is not consulted for redirect
 * targets or service-worker fetches. An operator who really needs the old
 * behaviour in production must fail loudly and knowingly, not through an env
 * var that reads like a config switch — so production always uses the proxy,
 * and a proxy that cannot start fails the run (fail closed).
 */
export function shouldUseAllowlistProxy(): boolean {
  // Production is never allowed to switch the network layer off.
  if (process.env.NODE_ENV === 'production') return true
  if (process.env.BROWSER_DISCOVERY_ALLOWLIST_PROXY === '0') return false
  // Under Vitest the browser is replaced at the module boundary, so Chromium
  // never opens a socket and a listener would have no client to protect.
  if (process.env.VITEST || process.env.NODE_ENV === 'test') return false
  return true
}

export async function startAllowlistProxy(guard: BrowserSsrfGuard): Promise<AllowlistProxy | null> {
  const http = await import('node:http')
  const net = await import('node:net')

  const validated = new Map<string, ValidatedBrowserUrl | null>()
  let rejected = 0

  /** Runs the full gate for a host name and memoises the verdict. */
  const authorize = async (hostname: string): Promise<ValidatedBrowserUrl | null> => {
    const key = hostname.toLowerCase()
    if (validated.has(key)) return validated.get(key) || null

    // The protocol of the probe is irrelevant for the DNS half of the gate;
    // both http: and https: are allowed and the addresses are identical.
    let destination: ValidatedBrowserUrl | null = null
    try {
      destination = await guard.validateNavigationTarget(`https://${key}/`)
    } catch {
      destination = null
    }
    validated.set(key, destination)
    return destination
  }

  const refuse = (socket: { end: (data: string) => void }) => {
    rejected += 1
    socket.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n')
  }

  const server = http.createServer()

  // Plain HTTP. The request target arrives in absolute form, which is exactly
  // the destination that has to be authorized.
  server.on('request', (req, res) => {
    let target: URL
    try {
      target = new URL(req.url || '')
    } catch {
      res.writeHead(400)
      res.end()
      return
    }
    if (target.protocol !== 'http:' && target.protocol !== 'https:') {
      res.writeHead(403)
      res.end()
      return
    }

    void authorize(target.hostname).then((destination) => {
      if (!destination) {
        rejected += 1
        res.writeHead(403)
        res.end('blocked by the asset-discovery allowlist')
        return
      }
      // Only ever connect to the address the gate validated.
      const agent = createPinnedAgent({ ...destination, protocol: 'http:' })
      const upstream = http.request(
        {
          protocol: 'http:',
          hostname: target.hostname,
          port: target.port || 80,
          path: `${target.pathname}${target.search}`,
          method: req.method,
          headers: { ...req.headers, host: target.host },
          agent: agent || undefined,
        },
        (upstreamRes) => {
          res.writeHead(upstreamRes.statusCode || 502, upstreamRes.headers)
          upstreamRes.pipe(res)
        },
      )
      upstream.on('error', () => {
        try {
          res.destroy()
        } catch {
          // ignore
        }
      })
      req.pipe(upstream)
    })
  })

  // HTTPS arrives as CONNECT. The tunnel is opened to the *validated* address,
  // so TLS continues with the correct SNI/Host against a peer that has already
  // been checked.
  server.on('connect', (req, clientSocket, head) => {
    const authority = String(req.url || '')
    const separator = authority.lastIndexOf(':')
    const hostname = separator === -1 ? authority : authority.slice(0, separator)
    const port = Number(separator === -1 ? '443' : authority.slice(separator + 1)) || 443

    void     authorize(hostname).then((destination) => {
      const address = destination ? pinnedAddressFor(destination) : null
      if (!destination || !address) {
        refuse(clientSocket)
        return
      }

      const upstream = net.connect({ host: address, port })
      upstream.on('connect', () => {
        clientSocket.write('HTTP/1.1 200 Connection Established\r\n\r\n')
        if (head && head.length > 0) upstream.write(head)
        upstream.pipe(clientSocket)
        clientSocket.pipe(upstream)
      })
      upstream.on('error', () => clientSocket.destroy())
      clientSocket.on('error', () => upstream.destroy())
    })
  })

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => resolve())
  })

  const address = server.address()
  const port = typeof address === 'object' && address ? address.port : 0

  return {
    url: `http://127.0.0.1:${port}`,
    rejected: () => rejected,
    close: async () => {
      await new Promise<void>((resolve) => {
        let settled = false
        const done = () => {
          if (!settled) {
            settled = true
            resolve()
          }
        }
        server.close(() => done())
        try {
          // Node >= 18.2: drop keep-alive tunnels instead of waiting for them.
          server.closeAllConnections()
        } catch {
          // older runtimes: the timer below still resolves
        }
        setTimeout(done, 250).unref()
      })
    },
  }
}

// --- bounded concurrency -----------------------------------------------------

/**
 * Runs tasks with at most `limit` in flight. The page navigations themselves
 * stay sequential by default; this exists so the concurrency cap is actually
 * enforced rather than merely documented.
 */
async function runWithConcurrencyLimit<T>(
  limit: number,
  tasks: Array<() => Promise<T>>,
): Promise<T[]> {
  const results: T[] = new Array(tasks.length)
  let cursor = 0
  const workers = Math.max(1, Math.min(limit, tasks.length))

  await Promise.all(
    Array.from({ length: workers }, async () => {
      for (;;) {
        const index = cursor++
        if (index >= tasks.length) return
        results[index] = await tasks[index]()
      }
    }),
  )

  return results
}

interface PageTelemetry {
  url: string
  navigationStartedAt: string
  navigationCompletedAt: string | null
  navigationDurationMs: number | null
  candidateCount: number
  error: string | null
}

interface CollectBrowserCandidatesOptions {
  /** Shared SSRF gate. A fresh one is created when omitted. */
  guard?: BrowserSsrfGuard
  /** Optional sink for per-page telemetry, in page order. */
  onPageTelemetry?: (entry: PageTelemetry) => void
  /** Receives the count of subresources the SSRF gate aborted. */
  onSubrequestsBlocked?: (count: number) => void
}

interface GuardedContextOptions {
  guard: BrowserSsrfGuard
  /** The validated base URL; the browser's resolver is pinned to its addresses. */
  baseTarget: ValidatedBrowserUrl
  /** Playwright context options (user agent, viewport, scale factor…). */
  contextOptions: Record<string, unknown>
  /** Resource types aborted before the SSRF gate is consulted. */
  blockedResourceTypes: readonly string[]
}

/**
 * Runs `fn` with a browser context behind the full SSRF guard: the allowlist
 * proxy (network level), the pinned resolver, the per-request interceptor, and
 * blocked service workers. Owns the context, browser and proxy lifetimes.
 * Shared by asset discovery and Motion Studio page capture so both stay behind
 * exactly the same protections.
 */
async function withGuardedContext<T>(
  options: GuardedContextOptions,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  fn: (context: any, counters: { readonly blockedSubrequests: number }) => Promise<T>,
  /** When set, teardown waits at most this long for each close (default: wait for it). */
  closeTimeoutMs?: number,
): Promise<T> {
  const closing = <R,>(p: Promise<R>): Promise<R | void> =>
    closeTimeoutMs ? Promise.race([p, new Promise<void>((resolve) => setTimeout(resolve, closeTimeoutMs))]) : p
  let browser: any = null
  let ownedBrowser = false
  let context: any = null
  let allowlistProxy: AllowlistProxy | null = null

  try {
    // Network-level half of the guard: every socket the browser opens is forced
    // through a local proxy that re-validates the destination. This layer is
    // mandatory, because `context.route()` is not called for redirect targets
    // or service-worker fetches, so it cannot be the only thing that stands
    // between a page and an internal address. If the proxy cannot be started
    // the run is aborted (fail closed) rather than continued with the weaker
    // request-level interceptor plus the `--host-resolver-rules` pin.
    if (shouldUseAllowlistProxy()) {
      allowlistProxy = await startAllowlistProxy(options.guard)
    }

    const { browser: launched, owned } = await acquireBrowser(
      [
        { hostname: options.baseTarget.hostname, addresses: options.baseTarget.addresses },
      ],
      allowlistProxy ? allowlistProxy.url : undefined,
    )
    browser = launched
    ownedBrowser = owned

    context = await browser.newContext({
      ...options.contextOptions,
      // A registered service worker issues its own `fetch`es in a worker scope
      // that `context.route()` never sees. Blocking them closes the bypass: the
      // first page can no longer cache a worker that keeps talking to an
      // internal address after the run's checks are over.
      serviceWorkers: 'block',
    })

    let inflightRequests = 0
    const counters = { blockedSubrequests: 0 }

    // One interceptor for every request the context makes. This is the layer
    // that stops a *public* page from pulling images or scripts out of an
    // internal address: `context.route` sees subresources, and `page.goto`'s
    // own validation never would.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await context.route('**/*', async (route: any, request: any) => {
      const resourceType = typeof request.resourceType === 'function' ? request.resourceType() : ''
      const url = typeof request.url === 'function' ? request.url() : ''

      // Cheap synchronous filters first, so the DNS gate is not consulted for
      // every tracker pixel on the page.
      if (isBlockedUrl(url) || options.blockedResourceTypes.includes(resourceType)) {
        return route.abort()
      }

      // Ad / tracker requests (Scrapling's `block_ads`): they slow the page and
      // put ad banners in the DOM. The page's own top-level navigation and the
      // site's own host are never blocked.
      if (!isMainFrameNavigation(request) && isThirdPartyAdUrl(url, `https://${options.baseTarget.hostname}/`)) {
        return route.abort()
      }

      // Redirect hops are counted here as a cheap budget, not as a guarantee:
      // Playwright does not invoke this interceptor for every hop of every
      // navigation (and not at all for service-worker fetches), so this counter
      // cannot be the thing that stops a public page 30x-ing into an internal
      // host. That is exactly why the allowlist proxy is mandatory — it is the
      // only layer that sees every socket the browser opens. The counter is
      // cycle-safe, so a chain that never terminates is refused as well.
      if (exceedsRedirectHopLimit(request)) {
        counters.blockedSubrequests++
        return route.abort()
      }

      // The full destination gate for this request. `currentUrl` is where the
      // browser is coming from, which is what makes this a redirect-aware check
      // rather than a plain URL check. Treat it as the best-effort layer; the
      // proxy re-runs the same gate per socket.
      if (!(await options.guard.isResourceRequestAllowed(url, redirectedFromUrl(request)))) {
        counters.blockedSubrequests++
        return route.abort()
      }

      if (inflightRequests >= BROWSER_SSRF_MAX_INFLIGHT_REQUESTS) {
        return route.abort()
      }

      inflightRequests++
      try {
        return await route.continue()
      } finally {
        inflightRequests--
      }
    })


    return await fn(context, counters)
  } finally {
    // Close the browser context after each discovery run so businesses do not
    // share cookies, cache, or storage between runs. The cached browser
    // process itself is kept for warm-server reuse.
    try {
      if (context) {
        await closing(context.close())
      }
    } catch {
      // ignore context close errors
    }
    if (ownedBrowser && browser) {
      try {
        await closing(browser.close())
      } catch {
        // ignore
      }
    }
    // The allowlist proxy is torn down with the run that created it: it exists
    // only to serve this browser, and leaving a listener bound to a stale guard
    // would keep rejected hosts memoised for the next business.
    if (allowlistProxy) {
      try {
        await closing(allowlistProxy.close())
      } catch {
        // ignore proxy close errors
      }
      allowlistProxy = null
    }
  }

}

async function collectBrowserCandidates(
  baseUrl: string,
  pages: string[],
  options: CollectBrowserCandidatesOptions = {},
): Promise<BrowserDiscoveryResult> {
  const guard = options.guard ?? createSsrfGuard()
  const allCandidates: BrowserImageCandidate[] = []
  let pagesCrawled = 0

  // 1. The base URL and every page we were asked to open must clear the gate
  //    before a browser process is even started. A rejected base URL is a hard
  //    failure, never a silent skip.
  const baseTarget = await guard.validateNavigationTarget(baseUrl)

  const safePages: string[] = []
  for (const pageUrl of pages) {
    try {
      safePages.push((await guard.validateNavigationTarget(pageUrl)).url)
    } catch (err) {
      console.warn(
        `[browser-discovery] skipped ${pageUrl}: ${err instanceof Error ? err.message : String(err)}`,
      )
    }
  }

  if (safePages.length === 0) {
    throw new BrowserSsrfError(
      'No navigation target passed the SSRF gate',
      baseUrl,
      baseTarget.hostname,
    )
  }

  return withGuardedContext(
    {
      guard,
      baseTarget,
      contextOptions: {
        userAgent: SITE_USER_AGENT,
        viewport: { width: 1280, height: 900 },
      },
      blockedResourceTypes: BLOCKED_RESOURCE_TYPES,
    },
    async (context, counters) => {
    const tasks = safePages.map((pageUrl) => async (): Promise<PageTelemetry> => {
      const navStartedAt = new Date().toISOString()
      let navCompletedAt: string | null = null
      let navError: string | null = null
      let candidateCount = 0

      if (allCandidates.length >= BROWSER_FALLBACK_MAX_CANDIDATES) {
        return {
          url: pageUrl,
          navigationStartedAt: navStartedAt,
          navigationCompletedAt: null,
          navigationDurationMs: null,
          candidateCount: 0,
          error: null,
        }
      }

      let page: any = null
      try {
        page = await context.newPage()
        await page.goto(pageUrl, {
          waitUntil: 'domcontentloaded',
          timeout: BROWSER_FALLBACK_NAVIGATION_TIMEOUT,
        })
        navCompletedAt = new Date().toISOString()

        // The route interceptor above is best effort: it is not invoked for
        // every redirect hop, so re-check the URL the browser actually ended up
        // on as well. Together with the allowlist proxy, which re-validates
        // every socket, this stops a redirect that slipped past (or a DNS answer
        // that changed mid-flight) from yielding an internal destination.
        const currentUrl = page.url()
        const finalTarget = await guard.validateNavigationTarget(currentUrl)
        if (finalTarget.hostname !== baseTarget.hostname) {
          navError = 'navigation left the validated origin'
        } else {
          await scrollPage(page, BROWSER_FALLBACK_SCROLL_ATTEMPTS, BROWSER_FALLBACK_SCROLL_DELAY)

          const pageCandidates = await extractRenderedImages(page, pageUrl)
          allCandidates.push(...pageCandidates)
          candidateCount = pageCandidates.length
          pagesCrawled++
        }
      } catch (err) {
        navError = err instanceof Error ? err.message : String(err)
      } finally {
        if (page) {
          try {
            await page.close()
          } catch {
            // ignore page close errors
          }
        }
      }

      return {
        url: pageUrl,
        navigationStartedAt: navStartedAt,
        navigationCompletedAt: navCompletedAt,
        navigationDurationMs: navCompletedAt
          ? new Date(navCompletedAt).getTime() - new Date(navStartedAt).getTime()
          : null,
        candidateCount,
        error: navError,
      }
    })

    const telemetry = await runWithConcurrencyLimit(
      BROWSER_SSRF_MAX_CONCURRENT_PAGES,
      tasks,
    )

    for (const entry of telemetry) {
      options.onPageTelemetry?.(entry)
    }
    options.onSubrequestsBlocked?.(counters.blockedSubrequests)

      const staticCount = allCandidates.length
      const browserCount = allCandidates.length

      return {
        candidates: allCandidates.slice(0, BROWSER_FALLBACK_MAX_CANDIDATES),
        staticCandidates: staticCount,
        browserCandidates: browserCount,
        pagesCrawled,
        fallbackUsed: true,
      }
    },
  )
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function discoverRenderedAssets(
  baseUrl: string,
  pages: string[],
  options: CollectBrowserCandidatesOptions = {},
): Promise<BrowserDiscoveryResult> {
  if (pages.length === 0) {
    return {
      candidates: [],
      staticCandidates: 0,
      browserCandidates: 0,
      pagesCrawled: 0,
      fallbackUsed: false,
    }
  }

  const limitedPages = pages.slice(0, BROWSER_FALLBACK_MAX_PAGES)
  return collectBrowserCandidates(baseUrl, limitedPages, options)
}

// ---------------------------------------------------------------------------
// Motion Studio page capture
// ---------------------------------------------------------------------------

/**
 * Capture geometry matches the textures Motion Studio's screenshot-based shots
 * were tuned on (upstream ShotCraft's capture step): pages 1920 CSS px wide at
 * a 2x device scale, cut at the sample page's height, plus element crops of
 * card-sized blocks.
 */
export const CAPTURE_VIEWPORT = { width: 1920, height: 1080 } as const
export const CAPTURE_DEVICE_SCALE = 2
export const CAPTURE_MAX_PAGE_HEIGHT = 1746
export const CAPTURE_MAX_CROPS = 6
/** Site images (product shots, hero art) pulled from the page as stills. */
export const CAPTURE_MAX_IMAGES = 6
/** How far down the page site images are looked for (CSS px). */
export const CAPTURE_MAX_IMAGE_Y = 4200
export const CAPTURE_NAVIGATION_TIMEOUT = 12_000
/** Optional capture work (cutouts, images, extra routes) stops being started after this. */
export const CAPTURE_DEADLINE_MS = 15_000
/** The capture returns what it has by now: the host ends a function at ~30 s with nothing, and the images still have to be stored. */
export const CAPTURE_HARD_MS = 20_000
/** Upstream's settle: after `document.fonts.ready`, wait this long before shooting (no FOUT / skeletons). */
export const CAPTURE_SETTLE_MS = 600
/** Longest wait for web fonts before shooting anyway. */
export const CAPTURE_FONT_WAIT_MS = 2_000
/** Longest the browser teardown may delay the reply (the host cuts a request off at about 30 s). */
const CAPTURE_CLOSE_MS = 1_500
/** Longest the first picture of the page may take before the capture goes on with the site's words alone. */
const CAPTURE_FIRST_SHOT_MS = 7_000
/** Routes captured besides the one asked for (features, pricing… found in the site's own links). */
export const CAPTURE_MAX_EXTRA_ROUTES = 2
/** A deep capture (the background worker has minutes, not seconds) takes more routes, more cards and the whole length of the page. */
/** Deep captures stop on time, not on a count: these are only guards against runaway pages. */
export const DEEP_MAX_ROUTES = 40
export const DEEP_MAX_CROPS = 80
export const DEEP_MAX_Y = 40_000
export const DEEP_MAX_BANDS = 120
export const DEEP_MAX_IMAGES = 200
/** Card cutouts across every captured route. */
export const CAPTURE_MAX_TOTAL_CROPS = 12
/** A film wants this many distinct pictures of the site; page slices make up the difference. */
export const CAPTURE_MIN_PICTURES = 8
/** Extra routes are only started while the run is younger than this. */
export const CAPTURE_ROUTE_BUDGET_MS = 9_000
export const CAPTURE_ROUTE_NAVIGATION_TIMEOUT = 8_000
// Media is never needed for a still capture; fonts and stylesheets are, so
// unlike discovery they are allowed (each still passes the SSRF gate).
const CAPTURE_BLOCKED_RESOURCE_TYPES = ['media'] as const

export interface CaptureRect {
  x: number
  y: number
  width: number
  height: number
}

/** What one card shot / page slice shows, read off the page when it was cut (for the film's picture catalogue). */
export interface CropInfo {
  /** The route it was cut from ('home' for the page asked for). */
  route: string
  /** 'card' = an element of the page, 'band' = a full-width slice. */
  cut: 'card' | 'band'
  width: number
  height: number
  /** The words inside it (first 200 characters). */
  text: string
  /** Share of its area covered by pictures (img / picture / video / background images), 0–1. */
  imageShare: number
  /** Portrait-like photos inside (people). */
  portraits: number
  /** A map is in it (map iframe / map tiles). */
  map: boolean
}

export interface PageCaptureBrand {
  background: string | null
  text: string | null
  accent: string | null
  fontFamily: string | null
  /** The rest of the product's tokens (upstream THEMES.md's seven colours, body font, corner radius). */
  surface?: string | null
  field?: string | null
  muted?: string | null
  border?: string | null
  bodyFont?: string | null
  radius?: number | null
}

const brandFrom = (styles: Record<string, string | null> | undefined): PageCaptureBrand => {
  const font = (v: unknown) => (typeof v === 'string' && v ? v.slice(0, 120) : null)
  const r = Number.parseFloat(String(styles?.radius ?? ''))
  return {
    background: cssColorToHex(styles?.background),
    text: cssColorToHex(styles?.text),
    accent: cssColorToHex(styles?.accent),
    fontFamily: font(styles?.fontFamily),
    surface: cssColorToHex(styles?.surface),
    field: cssColorToHex(styles?.field),
    muted: cssColorToHex(styles?.muted),
    border: cssColorToHex(styles?.border),
    bodyFont: font(styles?.bodyFont),
    radius: Number.isFinite(r) && r >= 0 && r <= 64 ? Math.round(r) : null,
  }
}

export interface PageCapture {
  url: string
  title: string
  /** JPEG of the page, CAPTURE_VIEWPORT.width CSS px wide at CAPTURE_DEVICE_SCALE. Null when the host ran out of time before a picture was taken: the words and colours are still returned. */
  page: Buffer | null
  pageHeight: number
  /** JPEG element crops (card-sized blocks), largest first. */
  crops: Buffer[]
  /** What each crop shows, same order as `crops` (missing for captures made before it existed). */
  cropInfo?: CropInfo[]
  brand: PageCaptureBrand
  /** The site's logo as a transparent PNG (header / nav logo), when one was found. */
  logo: Buffer | null
  /** The site's own images (product shots, hero art) as JPEGs, largest first. */
  images: Buffer[]
  /** What the site says about itself (upstream's product check). */
  content: PageContent
  /** Layout of the captured page: section headings and card cutouts, in page CSS px (upstream's layout.json). */
  layout: RouteLayout
  /** Floating UI cutouts, upstream's `nav` / `float-search` / `float-filter`: the nav bar, and transparent PNGs of the search pill and main button. */
  cutouts: { nav: Buffer | null; search: Buffer | null; button: Buffer | null }
  /** The page again with the card cutouts hidden: the empty plate for fly-in shots (null when no cards were found). */
  emptyPlate: Buffer | null
  /** More routes of the same site (features, pricing…), each captured the same way. */
  routes: CapturedRoute[]
  /** The site's pages found in its links (captured or not), for a later targeted capture. */
  links?: Array<{ name: string; path: string; url: string }>
}

/** True when a capture read anything the page says (title, headline, sections, calls to action). */
export function captureHasWords(c: Pick<PageCapture, 'title' | 'content'>): boolean {
  return Boolean(c.title || c.content?.headline || c.content?.description || c.content?.headings?.length || c.content?.ctas?.length)
}

export interface PageContent {
  description: string
  headline: string
  /** Section headings, in page order. */
  headings: string[]
  /** Button / call-to-action labels. */
  ctas: string[]
  /** Nav link labels. */
  nav: string[]
}

export interface RouteLayout {
  pageH: number
  sections: CaptureRect[]
  cards: CaptureRect[]
}

export interface CapturedRoute {
  name: string
  path: string
  url: string
  page: Buffer
  pageHeight: number
  layout: RouteLayout
  /** Card cutouts of this route (also appended to `PageCapture.crops`). */
  crops: Buffer[]
}

const EMPTY_CONTENT: PageContent = { description: '', headline: '', headings: [], ctas: [], nav: [] }

/** `rgb()/rgba()` → `#rrggbb`; null for transparent or unparseable colours. */
export function cssColorToHex(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const m = value.match(/rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)(?:[,\s/]+([\d.]+))?\s*\)/i)
  if (!m) return /^#[0-9a-f]{6}$/i.test(value) ? value.toLowerCase() : null
  if (m[4] !== undefined && Number(m[4]) === 0) return null
  return `#${[m[1], m[2], m[3]].map((n) => Math.min(255, Number(n)).toString(16).padStart(2, '0')).join('')}`
}

/**
 * Card-sized, visible, non-overlapping blocks near the top of the page, largest
 * first. Runs in the page; kept free of closures so it serialises cleanly.
 */
function findCropRects(limits: { maxY: number; max: number }): CaptureRect[] {
  const picked: CaptureRect[] = []
  const overlaps = (a: CaptureRect, b: CaptureRect) =>
    a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height
  const nodes = Array.from(document.querySelectorAll('article, section, li, a, div')) as HTMLElement[]
  const candidates = nodes
    .map((el) => {
      const r = el.getBoundingClientRect()
      return { el, rect: { x: r.left + window.scrollX, y: r.top + window.scrollY, width: r.width, height: r.height } }
    })
    .filter(({ el, rect }) => {
      if (rect.width < 280 || rect.width > 760 || rect.height < 200 || rect.height > 700) return false
      const aspect = rect.width / rect.height
      if (aspect < 0.8 || aspect > 1.9) return false
      if (rect.y < 0 || rect.y + rect.height > limits.maxY) return false
      const style = getComputedStyle(el)
      if (style.visibility === 'hidden' || Number(style.opacity) === 0) return false
      return (el.textContent ?? '').trim().length > 20 || el.querySelector('img, svg, canvas') !== null
    })
    .sort((a, b) => b.rect.width * b.rect.height - a.rect.width * a.rect.height)
  for (const { rect } of candidates) {
    if (picked.length >= limits.max) break
    if (picked.some((p) => overlaps(p, rect))) continue
    picked.push({ x: Math.round(rect.x), y: Math.round(rect.y), width: Math.round(rect.width), height: Math.round(rect.height) })
  }
  return picked
}

/**
 * The site's logo and its largest content images, as page rects. Runs in the
 * page; kept free of closures so it serialises cleanly.
 *
 * Logo: an <img>/<svg> near the top that says "logo" (class, id, alt, src),
 * sits in the header/nav, or is the home link — scored, best first.
 * Images: loaded, visible <img> elements at least 240×160, largest first,
 * not overlapping each other or the logo.
 */
function findAssetRects(limits: { maxY: number; maxImages: number }): { logo: CaptureRect | null; images: CaptureRect[] } {
  const toRect = (el: Element): CaptureRect => {
    const r = el.getBoundingClientRect()
    return { x: Math.round(r.left + window.scrollX), y: Math.round(r.top + window.scrollY), width: Math.round(r.width), height: Math.round(r.height) }
  }
  const visible = (el: Element) => {
    const style = getComputedStyle(el)
    return style.visibility !== 'hidden' && style.display !== 'none' && Number(style.opacity) > 0.05
  }
  const overlaps = (a: CaptureRect, b: CaptureRect) =>
    a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height
  const says = (el: Element, word: RegExp) => {
    let node: Element | null = el
    for (let depth = 0; node && depth < 3; depth++, node = node.parentElement) {
      const attrs = [node.getAttribute('class'), node.id, node.getAttribute('alt'), node.getAttribute('src'), node.getAttribute('aria-label')]
      if (attrs.some((a) => typeof a === 'string' && word.test(a))) return true
    }
    return false
  }

  let logo: CaptureRect | null = null
  let best = 0
  for (const el of Array.from(document.querySelectorAll('img, svg'))) {
    if (el.closest('svg') !== el && el.tagName.toLowerCase() === 'svg') continue
    const rect = toRect(el)
    if (rect.y > 260 || rect.width < 24 || rect.width > 520 || rect.height < 14 || rect.height > 220 || !visible(el)) continue
    let score = 0
    if (says(el, /logo|brand/i)) score += 4
    if (el.closest('header, nav, [role="banner"]')) score += 2
    const link = el.closest('a')
    if (link) {
      try {
        const href = new URL(link.href, location.href)
        if (href.origin === location.origin && (href.pathname === '/' || href.pathname === '')) score += 3
      } catch { /* ignore */ }
    }
    if (rect.x < window.innerWidth / 3) score += 1
    if (score > best) {
      best = score
      logo = rect
    }
  }
  if (best < 3) logo = null

  const images: CaptureRect[] = []
  const candidates: CaptureRect[] = (Array.from(document.querySelectorAll('img')) as HTMLImageElement[])
    .filter((img) => img.complete && img.naturalWidth >= 200 && visible(img) && !notAPicture(img, img.currentSrc || img.src))
    .map((img) => toRect(img))
    .filter((r) => r.width >= 240 && r.height >= 160 && r.y >= 0 && r.y + r.height <= limits.maxY)
    .sort((a, b) => b.width * b.height - a.width * a.height)
  // Maps, video posters and players are not pictures of the business.
  function notAPicture(el: Element, src: string): boolean {
    if (/maps\.(?:googleapis|gstatic)\.com|google\.[a-z.]+\/maps|staticmap|api\.mapbox|openstreetmap|ytimg\.com|vimeocdn\.com|\/vi\/[^/]+\/(?:max|hq|sd|mq)?default/i.test(src)) return true
    return Boolean(el.closest('[class*="map" i], [id*="map" i], [class*="video" i], [class*="player" i], [class*="lightbox" i], iframe'))
  }
  // Pictures set as CSS backgrounds (hero art, people, product shots on many sites) are not <img> elements.
  const backgrounds: CaptureRect[] = []
  for (const el of Array.from(document.querySelectorAll('div, section, header, figure, a, span')).slice(0, 4000)) {
    const bg = getComputedStyle(el).backgroundImage
    if (!bg || bg === 'none' || !/url\(/.test(bg) || /gradient/.test(bg) && !/url\(/.test(bg)) continue
    const r = toRect(el)
    if (r.width >= 300 && r.height >= 200 && r.width <= 1920 && r.y >= 0 && r.y + r.height <= limits.maxY && visible(el) && !notAPicture(el, bg)) backgrounds.push(r)
  }
  backgrounds.sort((a, b) => b.width * b.height - a.width * a.height)
  candidates.push(...backgrounds)
  for (const rect of candidates) {
    if (images.length >= limits.maxImages) break
    if (logo && overlaps(rect, logo)) continue
    if (images.some((p) => overlaps(p, rect))) continue
    images.push(rect)
  }
  return { logo, images }
}

/**
 * Upstream's product check: what the page says about itself, plus its links
 * (for finding more routes). Runs in the page; kept free of closures so it
 * serialises cleanly.
 */
function readPageContent(): PageContent & { links: Array<{ href: string; text: string }> } {
  const clean = (value: string | null | undefined) => (value ?? '').replace(/\s+/g, ' ').trim()
  // innerText follows the rendering (line breaks and blocks become spaces); textContent glues "for" + "Your" into "forYour".
  const read = (el: Element | null | undefined) => clean(el ? ((el as HTMLElement).innerText ?? el.textContent) : '')
  const visible = (el: Element) => {
    const r = el.getBoundingClientRect()
    const style = getComputedStyle(el)
    return r.width > 0 && r.height > 0 && style.visibility !== 'hidden' && style.display !== 'none'
  }
  const texts = (selector: string, max: number, len: number, minLen = 1) => {
    const out: string[] = []
    for (const el of Array.from(document.querySelectorAll(selector))) {
      if (out.length >= max) break
      if (!visible(el)) continue
      const text = read(el)
      if (text.length < minLen || text.length > len || out.includes(text)) continue
      out.push(text)
    }
    return out
  }
  const meta = document.querySelector('meta[name="description"]') ?? document.querySelector('meta[property="og:description"]')
  const h1 = Array.from(document.querySelectorAll('h1')).find(visible)
  return {
    description: clean(meta?.getAttribute('content')).slice(0, 300),
    headline: read(h1).slice(0, 160),
    headings: texts('h2, h3', 8, 120, 3),
    ctas: texts('main a[class*="btn" i], main a[class*="button" i], main button, a[class*="btn" i], a[class*="button" i], button', 4, 32, 2),
    nav: texts('header a, nav a', 10, 40, 2),
    links: (Array.from(document.querySelectorAll('header a[href], nav a[href], main a[href], footer a[href]')) as HTMLAnchorElement[])
      .slice(0, 300)
      .map((a) => ({ href: a.href, text: read(a).slice(0, 60) })),
  }
}

/**
 * Upstream's semantic cutouts (capture-template.mjs CONFIG): the header / nav
 * bar, the page's cards (`article`, `*card*`), the search pill (an input's
 * rounded parent) and the main button, plus section headings for the layout.
 * Cards are tagged `data-sv-card` so the empty plate can hide exactly them.
 * Runs in the page; kept free of closures so it serialises cleanly.
 */
function findCutoutRects(limits: { maxY: number; maxCards: number }): {
  nav: CaptureRect | null
  cards: CaptureRect[]
  search: CaptureRect | null
  button: CaptureRect | null
  sections: CaptureRect[]
} {
  const toRect = (el: Element): CaptureRect => {
    const r = el.getBoundingClientRect()
    return { x: Math.round(r.left + window.scrollX), y: Math.round(r.top + window.scrollY), width: Math.round(r.width), height: Math.round(r.height) }
  }
  const visible = (el: Element) => {
    const style = getComputedStyle(el)
    return style.visibility !== 'hidden' && style.display !== 'none' && Number(style.opacity) > 0.05
  }
  const inBand = (r: CaptureRect) => r.width > 0 && r.height > 0 && r.y >= 0 && r.y + r.height <= limits.maxY
  const overlaps = (a: CaptureRect, b: CaptureRect) =>
    a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height

  const navEl = Array.from(document.querySelectorAll('header, [role="banner"], nav')).find((el) => {
    const r = toRect(el)
    return visible(el) && r.y < 200 && r.height >= 32 && r.height <= 220 && r.width >= 600
  })

  document.querySelectorAll('[data-sv-card]').forEach((el) => el.removeAttribute('data-sv-card'))
  const cards: CaptureRect[] = []
  const cardCandidates = Array.from(document.querySelectorAll('article, [class*="card" i]'))
    .filter(visible)
    .map((el) => ({ el, rect: toRect(el) }))
    .filter(({ rect }) => inBand(rect) && rect.width >= 200 && rect.width <= 900 && rect.height >= 120 && rect.height <= 800)
    .sort((a, b) => a.rect.y - b.rect.y || b.rect.width * b.rect.height - a.rect.width * a.rect.height)
  for (const { el, rect } of cardCandidates) {
    if (cards.length >= limits.maxCards) break
    if (cards.some((c) => overlaps(c, rect))) continue
    cards.push(rect)
    el.setAttribute('data-sv-card', '')
  }

  const input = Array.from(document.querySelectorAll('input[type="search"], input[type="text"], input[type="email"], input:not([type])')).find(
    (el) => visible(el) && inBand(toRect(el)),
  )
  const shell = input?.parentElement ?? null
  const shellRect = shell ? toRect(shell) : null
  const search = shellRect && inBand(shellRect) && shellRect.width <= 900 && shellRect.height <= 160 ? shellRect : null

  const buttonEl = Array.from(
    document.querySelectorAll('main button, main a[class*="btn" i], main a[class*="button" i], button, a[class*="btn" i], a[class*="button" i]'),
  ).find((el) => {
    const r = toRect(el)
    return visible(el) && inBand(r) && r.y > 120 && r.width >= 60 && r.width <= 480 && r.height >= 28 && r.height <= 120
  })

  const sections = Array.from(document.querySelectorAll('h2'))
    .filter(visible)
    .map(toRect)
    .filter(inBand)
    .slice(0, 12)

  return { nav: navEl ? toRect(navEl) : null, cards, search, button: buttonEl ? toRect(buttonEl) : null, sections }
}

/** Hide (or show again) the cards `findCutoutRects` tagged, for the empty plate. Runs in the page. */
function setCardsHidden(hidden: boolean): number {
  const cards = Array.from(document.querySelectorAll('[data-sv-card]')) as HTMLElement[]
  for (const el of cards) el.style.visibility = hidden ? 'hidden' : ''
  return cards.length
}

/**
 * Upstream's settle: wait for web fonts (at most `maxMs`; a stalled font
 * request must not hold up the capture). Runs in the page.
 */
async function waitForFonts(maxMs: number): Promise<boolean> {
  return Promise.race([document.fonts.ready.then(() => true), new Promise<boolean>((resolve) => setTimeout(() => resolve(false), maxMs))])
}

const ROUTE_HINT_RE = /feature|product|pricing|plans?\b|solution|platform|how-it-works|services?|use-cases?|tour|demo|overview|why|customers?|showcase|gallery|menu|about|integrations?|team|people|leadership|staff|case-stud|stories|testimonial|reviews?|work|portfolio|projects?|industr|locations?|contact|company/i
const ROUTE_SKIP_RE =
  /log-?in|sign-?in|sign-?up|register|account|auth|cart|checkout|privacy|terms|legal|cookie|gdpr|careers|jobs|status|wp-|cdn-cgi|\.(pdf|zip|png|jpe?g|gif|svg|webp|mp4|xml|txt|json)$/i

/**
 * Which more routes of the site to capture — upstream's CONFIG.PAGES, found
 * from the page's own same-host links: product routes (features, pricing,
 * solutions…) first, in link order, then other short routes. Never login,
 * legal, cart or file links, nothing past two path segments, no repeats.
 */
export function pickCaptureRoutes(
  links: ReadonlyArray<{ href: string; text: string }>,
  baseUrl: string,
  max = CAPTURE_MAX_EXTRA_ROUTES,
): Array<{ name: string; path: string; url: string }> {
  let base: URL
  try {
    base = new URL(baseUrl)
  } catch {
    return []
  }
  const norm = (p: string) => (p.replace(/\/+$/, '') || '/').toLowerCase()
  const seen = new Set<string>([norm(base.pathname)])
  const picked: Array<{ path: string; url: string; hint: boolean; order: number }> = []
  links.forEach((link, order) => {
    let u: URL
    try {
      u = new URL(link.href, base)
    } catch {
      return
    }
    if (!/^https?:$/.test(u.protocol) || u.hostname !== base.hostname) return
    const path = norm(u.pathname)
    if (seen.has(path) || ROUTE_SKIP_RE.test(path) || path.split('/').filter(Boolean).length > 2) return
    seen.add(path)
    picked.push({ path, url: `${u.origin}${u.pathname}`, hint: ROUTE_HINT_RE.test(path) || ROUTE_HINT_RE.test(link.text), order })
  })
  const names = new Set<string>(['home'])
  return picked
    .sort((a, b) => Number(b.hint) - Number(a.hint) || a.order - b.order)
    .slice(0, Math.max(0, max))
    .map(({ path, url }) => {
      const slug = (path.split('/').filter(Boolean).pop() ?? 'page').replace(/[^a-z0-9-]/g, '-').slice(0, 32) || 'page'
      let name = slug
      for (let i = 2; names.has(name); i++) name = `${slug}-${i}`
      names.add(name)
      return { name, path, url }
    })
}

/**
 * The page the browser landed on belongs to the same site as the one asked for: the same host, `www.` added or
 * dropped, or a sub-domain of it. (shopify.com -> www.shopify.com is the usual case.) The SSRF gate has already
 * validated the landing address; this only decides it is still "the site" and not somewhere else.
 */
export function sameSiteHost(asked: string, landed: string): boolean {
  const bare = (h: string) => h.toLowerCase().replace(/\.$/, '').replace(/^www\./, '')
  const a = bare(asked)
  const b = bare(landed)
  return a === b || a.endsWith(`.${b}`) || b.endsWith(`.${a}`)
}

/** Clip rects for 16:9 slices of the page from `fromY` down to `toY` (a short last slice is kept when it is at least half a slice). */
export function bandRects(fromY: number, toY: number, width: number, bandH: number, max: number): Array<{ x: number; y: number; width: number; height: number }> {
  const out: Array<{ x: number; y: number; width: number; height: number }> = []
  for (let y = Math.max(0, Math.round(fromY)); out.length < max && toY - y >= bandH / 2; y += bandH) {
    out.push({ x: 0, y, width, height: Math.min(bandH, Math.round(toY - y)) })
  }
  return out
}

/** Computed brand colours/fonts from the rendered page. Runs in the page. */
function describeRect(rect: { x: number; y: number; width: number; height: number }): { text: string; imageShare: number; portraits: number; map: boolean } {
  const sx = window.scrollX
  const sy = window.scrollY
  const area = Math.max(1, rect.width * rect.height)
  const inside = (r: DOMRect, need: number) => {
    const x0 = Math.max(rect.x, r.left + sx)
    const y0 = Math.max(rect.y, r.top + sy)
    const x1 = Math.min(rect.x + rect.width, r.right + sx)
    const y1 = Math.min(rect.y + rect.height, r.bottom + sy)
    const overlap = Math.max(0, x1 - x0) * Math.max(0, y1 - y0)
    return r.width * r.height > 0 && overlap / (r.width * r.height) >= need ? overlap : 0
  }
  const words: string[] = []
  for (const el of Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, p, li, blockquote, figcaption, button, a, label, td'))) {
    if (words.join(' ').length > 200) break
    if (el.querySelector('h1, h2, h3, h4, h5, p, li, blockquote')) continue
    const r = el.getBoundingClientRect()
    if (!inside(r, 0.6)) continue
    const t = ((el as HTMLElement).innerText || '').replace(/\s+/g, ' ').trim()
    if (t && !words.includes(t)) words.push(t)
  }
  let pictures = 0
  let portraits = 0
  for (const el of Array.from(document.querySelectorAll('img, picture, video, svg image, [style*="background-image"]'))) {
    const r = el.getBoundingClientRect()
    const overlap = inside(r, 0.5)
    if (!overlap) continue
    pictures += overlap
    const ratio = r.width / Math.max(1, r.height)
    if (r.width >= 70 && r.height >= 70 && ratio > 0.6 && ratio < 1.25 && el.tagName === 'IMG') portraits++
  }
  const map = Array.from(document.querySelectorAll('iframe[src*="map"], img[src*="maps"], img[src*="staticmap"], [class*="map" i] canvas, .gm-style')).some((el) => inside(el.getBoundingClientRect(), 0.3) > 0)
  return { text: words.join(' · ').slice(0, 200), imageShare: Math.min(1, pictures / area), portraits, map }
}

function readBrandStyles(): Record<string, string | null> {
  const body = getComputedStyle(document.body)
  const heading = document.querySelector('h1, h2')
  // Saturation of a computed rgb() colour (0 grey … 1 pure): an accent is a colour, not white/black/grey.
  const sat = (c: string | null | undefined) => {
    const m = /rgba?\(\s*(\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?/.exec(c ?? '')
    if (!m || (m[4] !== undefined && Number(m[4]) < 0.5)) return 0
    const v = [m[1], m[2], m[3]].map(Number)
    const hi = Math.max(...v)
    const lo = Math.min(...v)
    return hi === 0 ? 0 : (hi - lo) / hi
  }
  const colourful = (sel: string, prop: 'backgroundColor' | 'color') =>
    Array.from(document.querySelectorAll(sel)).slice(0, 60).map((el) => getComputedStyle(el)[prop]).find((c) => sat(c) > 0.25) ?? null
  const action =
    colourful('button, a[class*="btn"], a[class*="button"], [role="button"], [class*="cta"]', 'backgroundColor') ??
    colourful('a', 'color') ??
    (heading && sat(getComputedStyle(heading).color) > 0.25 ? getComputedStyle(heading).color : null)
  const html = getComputedStyle(document.documentElement)
  const clear = (c: string | null | undefined) => !c || /rgba?\(\s*0,\s*0,\s*0,\s*0\s*\)|transparent/.test(c)
  const first = <T,>(sel: string, pick: (st: CSSStyleDeclaration, el: Element) => T | null): T | null => {
    for (const el of Array.from(document.querySelectorAll(sel)).slice(0, 40)) {
      const r = el.getBoundingClientRect()
      if (r.width < 40 || r.height < 16) continue
      const v = pick(getComputedStyle(el), el)
      if (v !== null && v !== undefined) return v
    }
    return null
  }
  // Card-like blocks: their fill is the surface, their edge the border, their corners the radius.
  const cardSel = '[class*="card"], [class*="Card"], article, [class*="tile"], [class*="panel"]'
  const surface = first(cardSel, (st) => (clear(st.backgroundColor) ? null : st.backgroundColor))
  const border = first(cardSel + ', hr, input', (st) => (parseFloat(st.borderTopWidth) > 0 && !clear(st.borderTopColor) ? st.borderTopColor : null))
  const radius = first(cardSel + ', button, a[class*="btn"]', (st) => (parseFloat(st.borderTopLeftRadius) > 0 ? st.borderTopLeftRadius : null))
  const field = first('input:not([type=hidden]), textarea, select', (st) => (clear(st.backgroundColor) ? null : st.backgroundColor))
  // Muted text: a paragraph whose colour differs from the main text.
  const mainText = body.color
  const muted = first('p, small, figcaption, [class*="subtitle"], [class*="description"]', (st) => (st.color && st.color !== mainText ? st.color : null))
  const para = document.querySelector('p')
  return {
    // A transparent page is the browser's white.
    background: !clear(body.backgroundColor) ? body.backgroundColor : !clear(html.backgroundColor) ? html.backgroundColor : 'rgb(255, 255, 255)',
    // The text colour is the body's; a heading is often decorated (gradient, brand colour).
    text: !clear(body.color) ? body.color : heading ? getComputedStyle(heading).color : null,
    accent: action ?? null,
    fontFamily: (heading ? getComputedStyle(heading).fontFamily : body.fontFamily) || null,
    surface,
    field,
    muted,
    border,
    radius,
    bodyFont: (para ? getComputedStyle(para).fontFamily : body.fontFamily) || null,
  }
}

/**
 * Captures a public site for Motion Studio the way upstream ShotCraft's
 * capture step does (assets/scripts/capture-template.mjs), behind the same
 * SSRF guard as discovery: the URL, every redirect hop and every subresource
 * must pass the gate, and every route ends on the validated host.
 *
 * For the page asked for: a product check (headline, sections, calls to
 * action), a 1920-wide 2x page shot after the fonts load and the page
 * settles, semantic cutouts (nav bar, cards, transparent search pill and
 * button), the layout of those elements, an empty plate with the cards
 * hidden, the brand colours, the logo and the site's own images. Then up to
 * CAPTURE_MAX_EXTRA_ROUTES more routes of the same site (features, pricing…
 * from its own links), each shot and cut out the same way, while the run
 * stays inside CAPTURE_ROUTE_BUDGET_MS.
 */
export async function capturePageScreenshots(
  rawUrl: string,
  options: { guard?: BrowserSsrfGuard; maxCrops?: number; maxRoutes?: number; settleMs?: number; hardMs?: number; firstShotMs?: number; budgetMs?: number; navigationMs?: number; deep?: boolean } = {},
): Promise<PageCapture> {
  const started = Date.now()
  const guard = options.guard ?? createSsrfGuard()
  const baseTarget = await guard.validateNavigationTarget(rawUrl)
  const deep = Boolean(options.deep)
  const cropCap = deep ? DEEP_MAX_CROPS : CAPTURE_MAX_CROPS
  const routeCap = deep ? DEEP_MAX_ROUTES : CAPTURE_MAX_EXTRA_ROUTES
  const maxCrops = Math.max(0, Math.min(cropCap, options.maxCrops ?? cropCap))
  const maxRoutes = Math.max(0, Math.min(routeCap, options.maxRoutes ?? routeCap))
  const settleMs = Math.max(0, options.settleMs ?? CAPTURE_SETTLE_MS)

  return withGuardedContext(
    {
      guard,
      baseTarget,
      contextOptions: {
        userAgent: 'Mozilla/5.0 (compatible; SmartVideoMotionStudio/1.0)',
        viewport: { ...CAPTURE_VIEWPORT },
        deviceScaleFactor: CAPTURE_DEVICE_SCALE,
      },
      blockedResourceTypes: CAPTURE_BLOCKED_RESOURCE_TYPES,
    },
    async (context) => {
      const page = await context.newPage()
      const elapsed = () => Date.now() - started
      /** Time left before optional work (cutouts, images, extra routes) is skipped. */
      const budgetMs = options.budgetMs ?? CAPTURE_DEADLINE_MS
      const left = () => budgetMs - elapsed()
      const timing: Record<string, number> = {}
      const mark = (phase: string) => {
        timing[phase] = elapsed()
      }
      /** A step that failed: say why in the host's logs (host only, no address) and carry on. */
      const warnStep = (step: string, error: unknown): undefined => {
        console.warn(`[motion-studio/capture] ${baseTarget.hostname} ${step} failed after ${elapsed()}ms: ${error instanceof Error ? error.message.split('\n')[0] : String(error)}`)
        return undefined
      }
      /** Reject when `promise` has not settled in `ms` (the promise itself keeps running). */
      const withinMs = <T,>(promise: Promise<T>, ms: number): Promise<T> =>
        new Promise<T>((resolve, reject) => {
          const timer = setTimeout(() => reject(new Error(`took longer than ${ms} ms`)), ms)
          promise.then(
            (v) => {
              clearTimeout(timer)
              resolve(v)
            },
            (e) => {
              clearTimeout(timer)
              reject(e)
            },
          )
        })
      const clipShot = (rect: CaptureRect, png = false): Promise<Buffer | null> =>
        page
          .screenshot(png ? { type: 'png', omitBackground: true, fullPage: true, clip: rect } : { type: 'jpeg', quality: 88, fullPage: true, clip: rect })
          .catch(() => null)

      /** Load lazy content, settle, shoot the page band and cut out its cards. */
      const shootRoute = async (maxCards: number, onShot?: (shot: Buffer, pageHeight: number) => void, acc?: { crops: Buffer[]; cards: CaptureRect[]; info?: Omit<CropInfo, 'route'>[] }) => {
        await page.waitForLoadState('networkidle', { timeout: 1_500 }).catch(() => undefined)
        // Nudge lazy-loaded content inside the captured band, then return to the top.
        await page.evaluate(async (maxY: number) => {
          const end = Math.min(maxY, document.documentElement.scrollHeight)
          for (let y = 0; y < end; y += 600) {
            window.scrollTo(0, y)
            await new Promise((resolve) => setTimeout(resolve, 80))
          }
          window.scrollTo(0, 0)
        }, deep ? DEEP_MAX_Y : CAPTURE_MAX_PAGE_HEIGHT)
        await page.waitForLoadState('networkidle', { timeout: 1_000 }).catch(() => undefined)
        await page.evaluate(waitForFonts, CAPTURE_FONT_WAIT_MS).catch(() => undefined)
        if (settleMs) await new Promise((resolve) => setTimeout(resolve, settleMs))

        const docHeight: number = await page.evaluate(() => document.documentElement.scrollHeight)
        const pageHeight = Math.max(CAPTURE_VIEWPORT.height, Math.min(CAPTURE_MAX_PAGE_HEIGHT, docHeight || 0))
        const pageClip = { x: 0, y: 0, width: CAPTURE_VIEWPORT.width, height: pageHeight }
        // A heavy page may not give a tall picture in time: fall back to what is on screen rather than lose the page.
        // The height the picture really has: the tall shot, or only the viewport when that is all there was time for.
        let shotHeight = pageHeight
        const shot: Buffer = await page.screenshot({ type: 'jpeg', quality: 82, fullPage: true, clip: pageClip, timeout: 25_000 }).catch(() => {
          shotHeight = Math.min(pageHeight, CAPTURE_VIEWPORT.height)
          return page.screenshot({ type: 'jpeg', quality: 80, animations: 'disabled', clip: { x: 0, y: 0, width: CAPTURE_VIEWPORT.width, height: shotHeight }, timeout: 15_000 })
        })
        // The page is usable from here: a stalled crop below must not lose it.
        onShot?.(shot, shotHeight)

        // A deep capture looks for cards down the whole page, not only in the band that is photographed whole.
        const searchY = deep ? Math.max(pageHeight, Math.min(DEEP_MAX_Y, docHeight || 0)) : pageHeight
        const found = (await page.evaluate(findCutoutRects, { maxY: searchY, maxCards }).catch(() => null)) ?? null
        // The page's own cards when it marks them up as cards; otherwise card-sized blocks.
        const semantic = (found?.cards.length ?? 0) >= 2
        const rects: CaptureRect[] = semantic
          ? found!.cards
          : maxCards
            ? ((await page.evaluate(findCropRects, { maxY: searchY, max: maxCards }).catch(() => null)) ?? [])
            : []
        const crops: Buffer[] = acc?.crops ?? []
        const cards: CaptureRect[] = acc?.cards ?? []
        const info: Omit<CropInfo, 'route'>[] = acc?.info ?? []
        const blank = { text: '', imageShare: 0, portraits: 0, map: false }
        /** What a cut shows (read off the page; a failed read is a blank, never a lost crop). */
        const describe = async (rect: CaptureRect, cut: 'card' | 'band') => {
          const seen = (await page.evaluate(describeRect, rect).catch(() => null)) ?? blank
          info.push({ cut, width: Math.round(rect.width), height: Math.round(rect.height), ...seen })
        }
        for (const rect of rects) {
          if (left() < 5_000 && crops.length >= 2) break
          const crop = await page.screenshot({ type: 'jpeg', quality: deep ? 76 : 85, fullPage: true, clip: rect }).catch(() => null)
          if (!crop) continue
          crops.push(crop)
          cards.push(rect)
          await describe(rect, 'card')
        }
        // Few card-like blocks (many sites have 1-2): fill up to CAPTURE_MIN_PICTURES with
        // full-width slices of the page, so a film shows distinct parts of it instead of the
        // same two pictures. Appended after the cards, which keeps `cards[i]` <-> `crops[i]`.
        if (maxCards && crops.length < CAPTURE_MIN_PICTURES && left() > 6_000) {
          const bandH = Math.round(CAPTURE_VIEWPORT.width * (9 / 16))
          for (let y = 0; y + bandH <= pageHeight + 1 && crops.length < CAPTURE_MIN_PICTURES; y += bandH) {
            if (left() < 4_000) break
            const clip = { x: 0, y, width: CAPTURE_VIEWPORT.width, height: bandH }
            const band = await page.screenshot({ type: 'jpeg', quality: 82, fullPage: true, clip }).catch(() => null)
            if (band) {
              crops.push(band)
              await describe(clip, 'band')
            }
          }
        }
        // Deep: the rest of the page, below the photographed band, as 16:9 slices — the film's pictures of the parts nobody saw.
        if (deep && maxCards) {
          const bottom = Math.min(DEEP_MAX_Y, docHeight || 0)
          for (const clip of bandRects(pageHeight, bottom, CAPTURE_VIEWPORT.width, Math.round(CAPTURE_VIEWPORT.width * (9 / 16)), DEEP_MAX_BANDS)) {
            if (left() < 6_000) break
            const band = await page.screenshot({ type: 'jpeg', quality: 72, fullPage: true, clip }).catch(() => null)
            if (band) {
              crops.push(band)
              await describe(clip, 'band')
            }
          }
        }
        // The layout describes the picture: sections and cards below what was photographed are left out.
        const inShot = (r: CaptureRect) => r.y < shotHeight
        const layout: RouteLayout = { pageH: shotHeight, sections: (found?.sections ?? []).filter(inShot), cards: shotHeight < pageHeight ? cards.filter(inShot) : cards }
        return { shot, pageHeight: shotHeight, pageClip: shotHeight < pageHeight ? { ...pageClip, height: shotHeight } : pageClip, found, semantic, crops, layout, info }
      }

      /** What has been captured so far: the capture can end at any step and still return this. */
      let out: PageCapture | null = null

      const work = async (): Promise<PageCapture> => {
        await page.goto(baseTarget.url, { waitUntil: 'domcontentloaded', timeout: options.navigationMs ?? CAPTURE_NAVIGATION_TIMEOUT })
        const finalTarget = await guard.validateNavigationTarget(page.url())
        if (!sameSiteHost(baseTarget.hostname, finalTarget.hostname)) {
          throw new BrowserSsrfError('Navigation left the validated origin', page.url(), finalTarget.hostname)
        }
        mark('loaded')

        const homeAcc = { crops: [] as Buffer[], cards: [] as CaptureRect[], info: [] as Omit<CropInfo, 'route'>[] }
        // The words and colours first: reading the page text needs no rendering, so even a page too heavy to
        // photograph in time still gives the film the site's own headline, sections and calls to action.
        await page.waitForLoadState('load', { timeout: 1_500 }).catch(() => undefined)
        const read0 = await page.evaluate(readPageContent).catch((e) => warnStep('content', e))
        const styles0 = await page.evaluate(readBrandStyles).catch((e) => warnStep('brand', e) ?? ({} as Record<string, string | null>))
        const snapshot: PageCapture = {
          url: page.url(),
          title: String((await page.title().catch(() => '')) ?? '').slice(0, 200),
          page: null,
          pageHeight: CAPTURE_VIEWPORT.height,
          crops: homeAcc.crops,
          logo: null,
          images: [],
          content: read0
            ? { description: read0.description, headline: read0.headline, headings: read0.headings, ctas: read0.ctas, nav: read0.nav }
            : { ...EMPTY_CONTENT },
          layout: { pageH: CAPTURE_VIEWPORT.height, sections: [], cards: homeAcc.cards },
          cutouts: { nav: null, search: null, button: null },
          emptyPlate: null,
          routes: [],
          brand: brandFrom(styles0 ?? undefined),
        }
        out = snapshot
        mark('content')
        // A first, cheap picture of what is on screen (CSS pixels: a quarter of the work of the 2x shots),
        // with its own time limit: a page that cannot be rendered in time must not use up the whole capture.
        const first: Buffer | undefined = await withinMs<Buffer>(
          page.screenshot({ type: 'jpeg', quality: 82, scale: 'css', animations: 'disabled', clip: { x: 0, y: 0, width: CAPTURE_VIEWPORT.width, height: CAPTURE_VIEWPORT.height } }),
          options.firstShotMs ?? CAPTURE_FIRST_SHOT_MS,
        ).catch((e) => warnStep('first picture', e) as unknown as Buffer | undefined)
        if (!first) {
          // The page cannot be rendered in time (a very heavy page on a small host): hand back what the page says.
          mark('words-only')
          return snapshot
        }
        snapshot.page = first
        mark('first')
        let home: Awaited<ReturnType<typeof shootRoute>>
        try {
          home = await shootRoute(
          maxCrops,
          (shot, pageHeight) => {
            // The full-height shot replaces the first one.
            if (out) {
              out.page = shot
              out.pageHeight = pageHeight
              out.layout = { pageH: pageHeight, sections: [], cards: homeAcc.cards }
            }
          },
          homeAcc,
          )
        } catch (error) {
          // The first picture and the page's words are already in the snapshot: hand those back instead of failing.
          warnStep('home', error)
          mark('home-failed')
          return snapshot
        }
        mark('home')
        const read = await page.evaluate(readPageContent).catch(() => null)
        const content: PageContent = read
          ? { description: read.description, headline: read.headline, headings: read.headings, ctas: read.ctas, nav: read.nav }
          : { ...EMPTY_CONTENT }
        const styles = await page.evaluate(readBrandStyles).catch(() => ({}) as Record<string, string | null>)
        const url = page.url()
        const title = String((await page.title().catch(() => '')) ?? '').slice(0, 200)

        // From here a capture is usable: the page, its cards, its words and colours.
        const result: PageCapture = {
          url,
          title,
          page: home.shot,
          pageHeight: home.pageHeight,
          crops: [...home.crops],
          cropInfo: home.info.map((i) => ({ ...i, route: 'home' })),
          logo: null,
          images: [],
          content,
          layout: home.layout,
          cutouts: { nav: null, search: null, button: null },
          emptyPlate: null,
          routes: [],
          brand: brandFrom(styles),
        }
        out = result

        // The site's own assets first (what the film shows): its logo (transparent PNG) and largest images.
        const assets = (await page.evaluate(findAssetRects, { maxY: deep ? DEEP_MAX_Y : CAPTURE_MAX_IMAGE_Y, maxImages: deep ? DEEP_MAX_IMAGES : CAPTURE_MAX_IMAGES }).catch(() => null)) ?? { logo: null, images: [] }
        result.logo = assets.logo ? await clipShot(assets.logo, true) : null
        for (const rect of assets.images) {
          if (left() < 4_000) break
          const image = await clipShot(rect)
          if (image) result.images.push(image)
        }
        mark('assets')

        // Optional pieces, only while there is time: floating UI cutouts and the empty plate.
        if (left() > 6_000) {
          result.cutouts = {
            nav: home.found?.nav ? await clipShot(home.found.nav) : null,
            search: home.found?.search ? await clipShot(home.found.search, true) : null,
            button: home.found?.button ? await clipShot(home.found.button, true) : null,
          }
        }
        if (home.semantic && left() > 5_000) {
          const hidden = await page.evaluate(setCardsHidden, true).catch(() => 0)
          if (hidden) result.emptyPlate = await page.screenshot({ type: 'jpeg', quality: 82, fullPage: true, clip: home.pageClip }).catch(() => null)
          await page.evaluate(setCardsHidden, false).catch(() => undefined)
        }
        mark('extras')

        // More routes of the same site, captured the same way, while time allows.
        let cropBudget = (deep ? 400 : CAPTURE_MAX_TOTAL_CROPS) - home.crops.length
        // The site's other pages (name, path, address), captured or not: a storyboard row that needs a page
        // the capture did not reach can have it captured on its own afterwards (pipeline stage 4).
        result.links = pickCaptureRoutes(read?.links ?? [], url, 80)
        for (const route of pickCaptureRoutes(read?.links ?? [], url, maxRoutes)) {
          if (deep ? left() < 12_000 : elapsed() > (options.budgetMs ? options.budgetMs * 0.6 : CAPTURE_ROUTE_BUDGET_MS) || left() < 6_000) break
          try {
            await page.goto(route.url, { waitUntil: 'domcontentloaded', timeout: CAPTURE_ROUTE_NAVIGATION_TIMEOUT })
            const landed = await guard.validateNavigationTarget(page.url())
            if (landed.hostname !== finalTarget.hostname) continue
            const shot = await shootRoute(Math.max(0, Math.min(deep ? DEEP_MAX_CROPS : 2, cropBudget)))
            cropBudget -= shot.crops.length
            result.routes.push({ name: route.name, path: route.path, url: page.url(), page: shot.shot, pageHeight: shot.pageHeight, layout: shot.layout, crops: shot.crops })
            result.crops.push(...shot.crops)
            result.cropInfo?.push(...shot.info.map((i) => ({ ...i, route: route.name })))
            mark(`route:${route.name}`)
          } catch {
            // A route that will not load (or leaves the site) is skipped; the capture stands without it.
          }
        }
        return result
      }

      let hardTimer: ReturnType<typeof setTimeout> | undefined
      try {
        const running = work()
        running.catch(() => undefined)
        // The host cuts a function off at ~30 s with nothing returned: at the hard deadline hand back what was captured.
        const deadline = new Promise<PageCapture>((resolve, reject) => {
          hardTimer = setTimeout(() => {
            mark('deadline')
            const snapshot = out as PageCapture | null
            // A snapshot with neither a picture nor any words is nothing to hand back.
            if (!snapshot || (!snapshot.page && !captureHasWords(snapshot))) return reject(new Error('The page took too long to load'))
            resolve({ ...snapshot, crops: [...snapshot.crops], images: [...snapshot.images], routes: [...snapshot.routes] })
          }, Math.max(options.hardMs === undefined ? 2_000 : 0, (options.hardMs ?? CAPTURE_HARD_MS) - elapsed()))
        })
        return await Promise.race([running, deadline])
      } catch (error) {
        // The background worker records how far the capture got next to why it failed.
        if (error instanceof Error) Object.assign(error, { timing: { ...timing } })
        throw error
      } finally {
        if (hardTimer) clearTimeout(hardTimer)
        // Which step took the time (host only, no address) — visible in the host's function logs.
        console.warn(`[motion-studio/capture] ${baseTarget.hostname} total=${elapsed()}ms ${JSON.stringify(timing)}`)
        // A page stuck mid-screenshot can take a long time to close: the reply must not wait for it.
        void page.close().catch(() => undefined)
      }
    },
    CAPTURE_CLOSE_MS,
  )
}
