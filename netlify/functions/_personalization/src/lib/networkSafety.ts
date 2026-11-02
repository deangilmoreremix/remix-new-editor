/**
 * Centralized network-destination validation (SSRF / DNS-rebinding guard).
 *
 * Single source of truth for "may this process open a connection to that
 * destination?". Every server-side fetch, proxy and discovery path routes
 * through this module:
 *
 *   - src/server/discoverAssets.ts            (asset discovery crawl)
 *   - src/lib/uploadProxyTarget.js            (upload / proxy targets)
 *
 * Deliberate design notes
 * -----------------------
 * 1. This file keeps plain-JS-parseable syntax inside the .ts wrapper so the
 *    plain .js consumer (src/lib/uploadProxyTarget.js, run by both the Next.js
 *    runtime and the studio package's Babel build, i.e. preset-env +
 *    preset-react with no extra plugin) can load it directly. Keep it that
 *    way: nothing here needs syntax extensions beyond plain JavaScript.
 * 2. The module never reads runtime configuration and never touches any
 *    provider secret, so the source scan that walks src/ keeps passing.
 * 3. No function here performs network I/O on its own except the explicit
 *    `resolve*` helpers, which only *read* DNS.
 */

import dns from 'dns'
import http from 'http'
import https from 'https'

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

/** Message thrown by callers that historically reported private ranges. */
export const SSRF_BLOCKED_MESSAGE = 'Private network addresses are not allowed'

export class NetworkSafetyError extends Error {
  reason

  constructor(reason) {
    super(SSRF_BLOCKED_MESSAGE)
    this.name = 'NetworkSafetyError'
    this.reason = reason
  }
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Hostnames that always denote the local host or a cloud metadata service. */
const BLOCKED_HOST_LABELS = new Set([
  'localhost',
  'localhost.localdomain',
  'ip6-localhost',
  'ip6-loopback',
  'metadata',
  'metadata.google.internal',
  'instance-data',
  'instance-data.ec2.internal',
])

/** DNS suffixes that never resolve to a legitimate public website. */
const BLOCKED_HOST_SUFFIXES = ['.localhost', '.local', '.internal', '.home.arpa']

/** Schemes we are willing to fetch on the server. */
const ALLOWED_PROTOCOLS = ['http:', 'https:']

/**
 * Private / special-use IPv4 ranges. Each entry is `[networkBase, prefixLen]`
 * where networkBase is the 32-bit integer form of the network address, so the
 * base and the prefix can never be confused the way a bare `[octet, prefix]`
 * pair can (that pair once destructured into three slots and silently
 * produced a /0 mask that matched nothing).
 *
 * The audit baseline covered only 10/8, 172.16/12, 192.168/16 and 127/8.
 * The rest are the ranges that never host a public asset: 0/8 "this network"
 * (0.0.0.0 is the unspecified address), 100.64/10 CGNAT, 169.254/16 link-local
 * (cloud metadata), 192.0.0/24 IETF assignments, the TEST-NET /24s,
 * 198.18/15 benchmarking, 224/4 multicast and 240/4 reserved (including the
 * 255.255.255.255 broadcast address).
 */
const BLOCKED_IPV4_RANGES = [
  [0x00000000, 8], // 0.0.0.0/8       "this network" / unspecified
  [0x0a000000, 8], // 10.0.0.0/8      RFC1918
  [0x64400000, 10], // 100.64.0.0/10  CGNAT (RFC 6598)
  [0x7f000000, 8], // 127.0.0.0/8     loopback
  [0xa9fe0000, 16], // 169.254.0.0/16 link-local + cloud metadata
  [0xac100000, 12], // 172.16.0.0/12  RFC1918
  [0xc0000000, 24], // 192.0.0.0/24   IETF protocol assignments
  [0xc0000200, 24], // 192.0.2.0/24   TEST-NET-1
  [0xc0a80000, 16], // 192.168.0.0/16 RFC1918
  [0xc6120000, 15], // 198.18.0.0/15  benchmarking (RFC 2544)
  [0xc6336400, 24], // 198.51.100.0/24 TEST-NET-2
  [0xcb007100, 24], // 203.0.113.0/24 TEST-NET-3
  [0xe0000000, 4], // 224.0.0.0/4     multicast
  [0xf0000000, 4], // 240.0.0.0/4     reserved (incl. 255.255.255.255)
]

/** HTTP statuses that mean "ask the next hop before you have a body". */
export const REDIRECT_STATUSES = [301, 302, 303, 307, 308]

/** Maximum number of manually followed redirects per request. */
export const MAX_REDIRECT_HOPS = 5

// ---------------------------------------------------------------------------
// Raw address parsing
// ---------------------------------------------------------------------------

const MAX_IPV4 = 0xffffffff

/**
 * Parses a single IPv4 address written in ANY of the forms a URL, a socket
 * library or an attacker will accept, and returns the four octets.
 *
 * Covered forms:
 *   - dotted quad             127.0.0.1
 *   - decimal integer         2130706433
 *   - hexadecimal             0x7f000001, 0x7f.0.0.1
 *   - octal                   0177.0.0.1, 017700000001
 *   - short forms             127.1 -> 127.0.0.1
 *   - fully qualified form    127.0.0.1. (trailing dot)
 *
 * Returns null when the input is not an IPv4 address literal at all (for
 * example a hostname).
 */
export function parseIpv4(input) {
  if (typeof input !== 'string') return null
  let text = input.trim().toLowerCase()
  if (text.startsWith('[') && text.endsWith(']')) text = text.slice(1, -1)
  // A single trailing dot is the root label of a fully qualified name.
  if (text.endsWith('.')) text = text.slice(0, -1)
  if (!text || !/^[0-9a-fx.:]+$/.test(text) || !/[0-9a-f]/.test(text)) return null
  if ((text.match(/\./g) || []).length > 3) return null

  const parseChunk = (chunk) => {
    if (!chunk) return null
    if (/^0x[0-9a-f]+$/.test(chunk)) {
      const value = Number.parseInt(chunk.slice(2), 16)
      return Number.isSafeInteger(value) && value <= MAX_IPV4 ? value : null
    }
    if (/^0[0-7]+$/.test(chunk)) {
      const value = Number.parseInt(chunk, 8)
      return Number.isSafeInteger(value) && value <= MAX_IPV4 ? value : null
    }
    if (/^[0-9]+$/.test(chunk)) {
      const value = Number.parseInt(chunk, 10)
      return Number.isSafeInteger(value) && value <= MAX_IPV4 ? value : null
    }
    return null
  }

  const chunks = text.split('.')
  const parsed = chunks.map(parseChunk)
  if (parsed.some((value) => value === null)) return null
  const values = parsed.map((value) => Number(value))

  // Fold "a.b", "a.b.c" and "a" into "a.b.c.d" the way inet_aton() does.
  let octets
  if (values.length === 4) {
    octets = values
  } else {
    let value = 0
    for (const part of values) {
      value = value * 256 + part
      if (value > MAX_IPV4) return null
    }
    octets = [(value >>> 24) & 0xff, (value >>> 16) & 0xff, (value >>> 8) & 0xff, value & 0xff]
  }

  if (octets.some((octet) => !Number.isInteger(octet) || octet < 0 || octet > 255)) {
    return null
  }
  return octets
}

/**
 * Expands an IPv6 literal into its eight 16-bit groups.
 * Handles '::' compression, an embedded dotted-quad tail and a zone index.
 * Returns null for anything that is not IPv6.
 */
export function parseIpv6(input) {
  if (typeof input !== 'string') return null
  let text = input.trim().toLowerCase()
  if (text.startsWith('[') && text.endsWith(']')) text = text.slice(1, -1)
  const zone = text.indexOf('%')
  if (zone !== -1) text = text.slice(0, zone)
  if (!text || text.indexOf(':') === -1) return null

  // A dotted-quad tail counts as two groups.
  let tail = null
  const lastColon = text.lastIndexOf(':')
  const dottedTail = text.slice(lastColon + 1)
  if (dottedTail.indexOf('.') !== -1) {
    tail = parseIpv4(dottedTail)
    if (!tail) return null
    text = text.slice(0, lastColon + 1)
    // "1:2:3:4:5:6:" loses its separator once the tail is removed.
    if (text.endsWith(':') && !text.endsWith('::')) text = text.slice(0, -1)
  }

  const halves = text.split('::')
  if (halves.length > 2) return null

  const toGroups = (part) => {
    if (!part) return []
    const groups = part
      .split(':')
      .map((chunk) => (/^[0-9a-f]{1,4}$/.test(chunk) ? Number.parseInt(chunk, 16) : null))
    if (groups.some((group) => group === null)) return null
    return groups
  }

  const head = toGroups(halves[0])
  const rest = halves.length === 2 ? toGroups(halves[1]) : head
  if (!head || !rest) return null

  const target = tail ? 6 : 8
  let groups
  if (halves.length === 2) {
    const missing = target - head.length - rest.length
    if (missing < 0) return null
    const padding = new Array(missing)
    for (let index = 0; index < missing; index += 1) padding[index] = 0
    groups = padding.length > 0 ? head.concat(padding).concat(rest) : head.concat(rest)
  } else {
    if (head.length !== 8) return null
    groups = head
  }

  if (tail) {
    if (groups.length !== 6) return null
    groups = groups.concat([(tail[0] << 8) | tail[1], (tail[2] << 8) | tail[3]])
  }

  return groups.length === 8 ? groups : null
}

// ---------------------------------------------------------------------------
// Address classification
// ---------------------------------------------------------------------------

const inIpv4Range = (octets, range) => {
  const [base, prefix] = range
  // /0 matches everything; otherwise compare only the masked network bits.
  if (prefix <= 0) return true
  const mask = (0xffffffff << (32 - prefix)) >>> 0
  const value = ((octets[0] << 24) | (octets[1] << 16) | (octets[2] << 8) | octets[3]) >>> 0
  return (value & mask) === (base & mask)
}

/** True when an IPv4 address is private, loopback, link-local or otherwise unusable. */
export function isBlockedIpv4(ip) {
  const octets = parseIpv4(ip)
  if (!octets) return true
  return BLOCKED_IPV4_RANGES.some((range) => inIpv4Range(octets, range))
}

/**
 * Extracts the embedded IPv4 address of an IPv6 literal that is really an
 * IPv4 address in disguise (IPv4-mapped ::ffff:a.b.c.d, IPv4-compatible
 * ::a.b.c.d, IPv4-translated ::ffff:0:a.b.c.d and NAT64 64:ff9b::/96).
 * Returns the four octets, or null when the literal is a genuine IPv6.
 */
function ipv6EmbeddedIpv4(groups) {
  const zeroPrefix = (count) => groups.slice(0, count).every((group) => group === 0)
  const lastTwo = () => [
    (groups[6] >> 8) & 0xff,
    groups[6] & 0xff,
    (groups[7] >> 8) & 0xff,
    groups[7] & 0xff,
  ]

  // ::ffff:a.b.c.d (IPv4-mapped, RFC 4291)
  if (zeroPrefix(5) && groups[5] === 0xffff) return lastTwo()
  // ::a.b.c.d (deprecated IPv4-compatible, RFC 4291)
  if (zeroPrefix(6)) return lastTwo()
  // ::ffff:0:a.b.c.d (IPv4-translated, RFC 2765). The 0xffff sits at index 4
  // with a following zero, so the embedded IPv4 name lives in the low 32 bits.
  if (zeroPrefix(4) && groups[4] === 0xffff && groups[5] === 0) {
    return lastTwo()
  }
  // 64:ff9b::/96 (NAT64, RFC 6052)
  if (
    groups[0] === 0x0064 &&
    groups[1] === 0xff9b &&
    groups[2] === 0 &&
    groups[3] === 0 &&
    groups[4] === 0 &&
    groups[5] === 0
  ) {
    return lastTwo()
  }
  return null
}

/** True when an IPv6 address is loopback, ULA, link-local or maps to a blocked IPv4. */
export function isBlockedIpv6(ip) {
  const groups = parseIpv6(ip)
  if (!groups) return true

  const embedded = ipv6EmbeddedIpv4(groups)
  if (embedded) {
    if (embedded.length === 4) return isBlockedIpv4(embedded.join('.'))
    // IPv4-translated only carries the low 16 bits; treat anything with a
    // non-public high half as blocked so the range fails closed.
    return isBlockedIpv4(`0.0.${embedded[0]}.${embedded[1]}`) || embedded[0] !== 0
  }

  const first = groups[0] >> 8
  const second = groups[0] & 0xff

  // :: (unspecified)
  if (groups.every((group) => group === 0)) return true
  // ::1 (loopback)
  if (groups.slice(0, 7).every((group) => group === 0) && groups[7] === 1) return true
  // fc00::/7 unique-local
  if ((first & 0xfe) === 0xfc) return true
  // fe80::/10 link-local
  if (first === 0xfe && (second & 0xc0) === 0x80) return true
  // ff00::/8 multicast
  if (first === 0xff) return true
  // 2001:db8::/32 documentation
  if (groups[0] === 0x2001 && groups[1] === 0x0db8) return true

  return false
}

/** True when an address literal (v4 or v6) must never be connected to. */
export function isBlockedIpAddress(ip) {
  if (typeof ip !== 'string') return true
  const text = ip.trim().toLowerCase()
  if (!text) return true
  if (text.indexOf(':') !== -1) {
    return isBlockedIpv6(text.replace(/^\[|\]$/g, ''))
  }
  if (parseIpv4(text)) return isBlockedIpv4(text)
  // A bracketed literal without a colon is malformed.
  if (text.startsWith('[')) return true
  // A value made only of digits and dots is an attempted IPv4 literal that
  // failed to parse (too many octets, out-of-range octets, ...). Fail closed
  // instead of guessing it is a DNS name.
  if (/^[0-9.]+$/.test(text)) return true
  // Not an IP literal at all — the caller must resolve it instead.
  return false
}

/** True when the URL's host field is an IP literal of any kind. */
export function isIpLiteral(hostname) {
  const text = String(hostname || '')
    .trim()
    .toLowerCase()
    .replace(/^\[|\]$/g, '')
  if (!text) return false
  return Boolean(parseIpv4(text.replace(/\.$/, ''))) || text.indexOf(':') !== -1
}

/**
 * True when a *hostname as written in a URL* must never be connected to.
 *
 * This is the synchronous gate. It catches every numeric form of a private
 * address (decimal / hex / octal / short / dotted / IPv6 / IPv4-mapped) and
 * the reserved local hostnames, but it cannot judge a real DNS name — that
 * requires resolution, which `resolvePublicAddresses` performs.
 */
export function isBlockedHostname(hostname) {
  if (typeof hostname !== 'string') return true
  let text = hostname.trim().toLowerCase()
  if (!text) return true
  if (text.startsWith('[') && text.endsWith(']')) text = text.slice(1, -1)
  const zone = text.indexOf('%')
  if (zone !== -1) text = text.slice(0, zone)
  const trailingDot = text.endsWith('.')
  const normalized = trailingDot ? text.slice(0, -1) : text
  if (!normalized) return true

  if (BLOCKED_HOST_LABELS.has(normalized)) return true
  if (BLOCKED_HOST_SUFFIXES.some((suffix) => normalized.endsWith(suffix))) return true

  if (parseIpv4(normalized)) return isBlockedIpv4(normalized)
  if (normalized.indexOf(':') !== -1) return isBlockedIpv6(normalized)

  // Empty labels are never valid ("..", leading/trailing dot other than the
  // single fully-qualified root label handled above).
  if (normalized.split('.').some((label) => label === '')) return true

  return false
}

// ---------------------------------------------------------------------------
// URL validation
// ---------------------------------------------------------------------------

/**
 * Fallback for the one host form `new URL` refuses: an UNBRACKETED IPv6
 * literal such as "http://fc00::1/". WHATWG only accepts an IPv6 host between
 * square brackets, so the parser rejects the whole URL; we still refuse it with
 * the private-range message rather than the protocol message.
 *
 * Returns true when the URL authority is an IPv6 literal this module blocks.
 */
function authorityIsBlockedIpv6(text) {
  const match = /^[a-z][a-z0-9+.-]*:\/\/([^/?#]*)/i.exec(text)
  if (!match) return false
  let authority = match[1]
  const at = authority.lastIndexOf('@')
  if (at !== -1) authority = authority.slice(at + 1)
  // A host:port pair has exactly one colon; an unbracketed IPv6 literal has
  // two or more, so with fewer than two there is nothing to inspect here.
  if ((authority.match(/:/g) || []).length < 2) return false
  const zone = authority.indexOf('%')
  const host = (zone === -1 ? authority : authority.slice(0, zone)).toLowerCase()
  return Boolean(parseIpv6(host)) && isBlockedIpv6(host)
}

/**
 * Synchronous URL gate used by `sanitizeUrl`.
 * Throws the historical messages so existing callers and tests keep working.
 */
export function assertSafeUrlString(input, { defaultProtocol = 'https:' } = {}) {
  if (typeof input !== 'string') {
    throw new Error('Only http/https protocols are allowed')
  }
  let trimmed = input.trim()
  if (trimmed === '') {
    throw new Error('Only http/https protocols are allowed')
  }

  // Reject non-HTTP/HTTPS protocols before URL parsing.
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) && !/^https?:\/\//i.test(trimmed)) {
    throw new Error('Only http/https protocols are allowed')
  }
  if (!/^https?:\/\//i.test(trimmed)) {
    trimmed = defaultProtocol + trimmed
  }

  let url
  try {
    url = new URL(trimmed)
  } catch {
    // An unbracketed IPv6 literal is a still-blocked destination, so report it
    // as a blocked host instead of a generic protocol error.
    if (authorityIsBlockedIpv6(trimmed)) {
      throw new NetworkSafetyError('blocked_host')
    }
    throw new Error('Only http/https protocols are allowed')
  }

  if (!ALLOWED_PROTOCOLS.includes(url.protocol)) {
    throw new Error('Only http/https protocols are allowed')
  }

  if (isBlockedHostname(url.hostname)) {
    throw new NetworkSafetyError('blocked_host')
  }

  return url.toString()
}

/**
 * Result-shaping variant of `assertSafeUrlString`: never throws, always
 * returns `{ ok, reason, url }`.
 */
export function checkUrlString(input, options = {}) {
  try {
    return { ok: true, url: assertSafeUrlString(input, options) }
  } catch (err) {
    const reason = err && err.reason ? err.reason : 'invalid_url'
    return { ok: false, reason }
  }
}

// ---------------------------------------------------------------------------
// DNS resolution
// ---------------------------------------------------------------------------

const NOT_FOUND_CODES = new Set(['ENOTFOUND', 'ENODATA', 'ENONAME', 'EAI_NONAME'])

async function resolveFamily(hostname, records) {
  if (typeof records !== 'function') return []
  try {
    const results = await records(hostname)
    return Array.isArray(results) ? results.filter((entry) => typeof entry === 'string') : []
  } catch (err) {
    if (err && NOT_FOUND_CODES.has(err.code)) return []
    throw err
  }
}

/**
 * Resolves a hostname and returns every address that must be validated.
 *
 * Returns the literal address for an IP literal (no DNS involved) and an
 * empty array for a name that does not exist at all.
 */
export async function resolveHostAddresses(hostname) {
  const text = String(hostname || '')
    .trim()
    .toLowerCase()
    .replace(/^\[|\]$/g, '')
  const zone = text.indexOf('%')
  const bare = (zone === -1 ? text : text.slice(0, zone)).replace(/\.$/, '')

  if (!bare) return []

  if (parseIpv4(bare)) return [bare]
  if (bare.indexOf(':') !== -1) {
    const groups = parseIpv6(bare)
    return groups ? [bare] : []
  }

  const [ipv4, ipv6] = await Promise.all([
    resolveFamily(bare, dns.promises && dns.promises.resolve4),
    resolveFamily(bare, dns.promises && dns.promises.resolve6),
  ])
  return ipv4.concat(ipv6)
}

/**
 * Resolves `hostname` and validates EVERY resolved address. This is the
 * anti-rebinding half of the guard: a public-looking name that resolves to a
 * private address is rejected, so `evil.example` -> 127.0.0.1 fails here.
 */
export async function resolvePublicAddresses(hostname, options) {
  const allowUnresolvable = Boolean(options && options.allowUnresolvable)
  const addresses = await resolveHostAddresses(hostname)

  if (addresses.length === 0) {
    if (allowUnresolvable) return []
    throw new NetworkSafetyError('dns_resolution_failed')
  }

  for (const address of addresses) {
    if (isBlockedIpAddress(address)) {
      throw new NetworkSafetyError('resolved_to_blocked_ip')
    }
  }

  return addresses
}

// ---------------------------------------------------------------------------
// Destination gate (resolve + validate in one step)
// ---------------------------------------------------------------------------

/**
 * Full gate for one request destination.
 *
 * 1. protocol allowlist
 * 2. hostname literal allowlist (no private / unusual IP forms, no metadata
 *    hostnames)
 * 3. resolve and validate every address the host currently resolves to
 *
 * Returns `{ ok: true, url, hostname, port, protocol, addresses }` or
 * `{ ok: false, reason }`.
 */
export async function checkDestination(rawUrl, options) {
  const checked = checkUrlString(rawUrl, options)
  if (!checked.ok) {
    return { ok: false, reason: checked.reason }
  }

  let url
  try {
    url = new URL(checked.url)
  } catch {
    return { ok: false, reason: 'invalid_url' }
  }

  const hostname = url.hostname.toLowerCase()
  let addresses
  try {
    addresses = await resolvePublicAddresses(hostname, options)
  } catch (err) {
    return { ok: false, reason: err && err.reason ? err.reason : 'dns_resolution_failed' }
  }

  return {
    ok: true,
    url: checked.url,
    hostname,
    port: url.port || (url.protocol === 'https:' ? '443' : '80'),
    protocol: url.protocol,
    addresses,
  }
}

// ---------------------------------------------------------------------------
// TOCTOU mitigation: bind the connection to the validated address
// ---------------------------------------------------------------------------

/**
 * Picks one address of the same family as the connection we are about to
 * open. Keeping the family aligned with `url.hostname`'s literal form means
 * the Host header, the TLS SNI and the certificate verification all still use
 * the original hostname — only the peer IP is pinned.
 */
export function pickPinnedAddress(destination) {
  const addresses = destination && destination.addresses
  if (!addresses || addresses.length === 0) return null
  const wantsIpv6 = destination.hostname && destination.hostname.indexOf(':') !== -1
  const matches = addresses.filter((address) =>
    wantsIpv6 ? address.indexOf(':') !== -1 : address.indexOf(':') === -1
  )
  return matches[0] || addresses[0] || null
}

/**
 * Builds a `dns.lookup` replacement (callback style, the contract Node's
 * net/http/https modules expect) that ONLY ever returns an address that has
 * already been validated. Threading this into an `http.Agent({ lookup })`
 * removes the DNS-rebinding window: the resolver is never consulted a second
 * time between validation and connect, so a record that flips to
 * 169.254.169.254 cannot win.
 */
export function createPinnedLookup(addresses) {
  const approved = Array.isArray(addresses) ? addresses.slice() : []
  return function pinnedLookup(_hostname, options, callback) {
    const cb = typeof options === 'function' ? options : callback
    const opts = typeof options === 'function' ? {} : options || {}

    if (approved.length === 0) {
      const err = new Error('networkSafety: no pre-validated address for this connection')
      Object.assign(err, { code: 'ENOTFOUND' })
      if (typeof cb === 'function') cb(err)
      return
    }

    const entries = approved.map((address) => ({
      address,
      family: address.indexOf(':') === -1 ? 4 : 6,
    }))
    if (typeof cb !== 'function') return
    if (opts.all) {
      cb(null, entries)
      return
    }
    cb(null, entries[0].address, entries[0].family)
  }
}

/**
 * The same pin, in the shape axios expects for its `lookup` config option:
 * axios normalizes it with `util.callbackify`, so it MUST return a promise
 * that resolves to an address string or an `{ address, family }` object.
 */
export function createPinnedAxiosLookup(addresses) {
  const approved = Array.isArray(addresses) ? addresses.slice() : []
  return function pinnedAxiosLookup(_hostname, _options) {
    if (approved.length === 0) {
      const err = new Error('networkSafety: no pre-validated address for this connection')
      Object.assign(err, { code: 'ENOTFOUND' })
      return Promise.reject(err)
    }
    const address = approved[0]
    return Promise.resolve({
      address,
      family: address.indexOf(':') === -1 ? 4 : 6,
    })
  }
}

/**
 * Expresses the pinned lookup as an http(s).Agent so callers that talk to
 * Node directly (rather than through axios) get the same guarantee.
 */
export function createPinnedAgent(destination) {
  const address = pickPinnedAddress(destination)
  if (!address) return null
  const lookup = createPinnedLookup([address])
  const options = { lookup, keepAlive: false }
  return destination.protocol === 'https:' ? new https.Agent(options) : new http.Agent(options)
}

// ---------------------------------------------------------------------------
// Pinned request: one connection, bound to the address that was validated
// ---------------------------------------------------------------------------

/** Statuses the fetch contract requires to be built with a null body. */
const NULL_BODY_STATUSES = new Set([101, 204, 205, 304])

/** Strips the brackets a URL keeps around an IPv6 literal. */
function bareHostname(hostname) {
  return String(hostname || '').replace(/^\[+/, '').replace(/\]+$/, '')
}

/** True when a host field is an IP literal rather than a DNS name. */
function isIpLiteralHostname(hostname) {
  const bare = bareHostname(hostname)
  if (bare.indexOf(':') !== -1) return true
  return Boolean(parseIpv4(bare))
}

/**
 * Builds an agent whose lookup can only ever return `address`, so the socket
 * is opened to a peer this process has already validated.
 */
function pinnedNodeAgent(useHttps, address) {
  const options = { lookup: createPinnedLookup([address]), keepAlive: false }
  return useHttps ? new https.Agent(options) : new http.Agent(options)
}

/** Accepts a plain object, a `Headers` or a `Map` and returns a plain object. */
function toPlainHeaders(headers) {
  if (!headers) return {}
  if (typeof headers.forEach === 'function' && typeof headers.keys === 'function') {
    const plain = {}
    headers.forEach((value, key) => {
      plain[String(key)] = value
    })
    return plain
  }
  return { ...headers }
}

/** Encodes the body shapes a server-side caller may hand to the pin. */
function encodeRequestBody(body) {
  if (body === undefined || body === null) return null
  if (typeof body === 'string') return Buffer.from(body)
  if (Buffer.isBuffer(body)) return body
  if (body instanceof Uint8Array) return Buffer.from(body)
  if (body instanceof ArrayBuffer) return Buffer.from(new Uint8Array(body))
  if (typeof body === 'object' && typeof FormData !== 'undefined' && body instanceof FormData) {
    // A form cannot be written raw — `String(formData)` would silently send
    // "[object FormData]". Callers serialize it first; see
    // `createUploadProxyPinnedFetch` in src/lib/uploadProxyTarget.js.
    throw new NetworkSafetyError('unsupported_body')
  }
  return body
}

function isStreamLike(body) {
  return Boolean(body) && typeof body.pipe === 'function'
}

/**
 * Builds a fetch-compatible request function whose single connection target is
 * the address `destination` was validated for. This is the half that closes
 * the TOCTOU / DNS-rebinding window for callers that use the platform `fetch`:
 * a plain `fetch(url)` re-resolves DNS between the check and the connect, so a
 * record that flips to 169.254.169.254 can win. The function returned here
 * never resolves a name at connect time — the pinned lookup hands back the
 * pre-validated address and nothing else.
 *
 * Guarantees:
 *   - TLS still verifies the *hostname*: SNI and the certificate identity are
 *     taken from the validated host, never from the pinned IP, so pinning the
 *     peer address cannot downgrade certificate checking.
 *   - The `Host` header keeps the original host (with port when non-default).
 *   - No redirect is ever followed: a 3xx is returned to the caller, exactly
 *     like `maxRedirects: 0` in axios.
 *   - Only the exact origin that was validated can be requested; any other
 *     URL is refused rather than resolved again.
 */
export function createPinnedFetch(destination) {
  const validatedUrl = destination && destination.url ? String(destination.url) : ''
  let base
  try {
    base = new URL(validatedUrl)
  } catch {
    return function refusedPinnedFetch() {
      return Promise.reject(new NetworkSafetyError('invalid_url'))
    }
  }

  const pinned = pickPinnedAddress(destination)
  if (!pinned) {
    return function refusedPinnedFetch() {
      return Promise.reject(new NetworkSafetyError('no_validated_address'))
    }
  }

  const useHttps = base.protocol === 'https:'
  const hostname = bareHostname(base.hostname)
  const port = Number(base.port) || (useHttps ? 443 : 80)
  const agent = pinnedNodeAgent(useHttps, pinned)
  // An IP literal must not be sent as SNI (RFC 6066 forbids it and Node warns),
  // and a literal hostname has no certificate name to verify anyway.
  const servername = useHttps && !isIpLiteralHostname(hostname) ? hostname : undefined

  return async function pinnedFetch(requestUrl, init) {
    const options = init || {}

    let target
    try {
      target = new URL(String(requestUrl), base)
    } catch {
      throw new NetworkSafetyError('invalid_url')
    }

    const targetPort = Number(target.port) || (target.protocol === 'https:' ? 443 : 80)
    if (
      target.protocol !== base.protocol ||
      bareHostname(target.hostname) !== hostname ||
      targetPort !== port
    ) {
      throw new NetworkSafetyError('pinned_fetch_refused_origin')
    }

    const method = String(options.method || 'GET').toUpperCase()
    const headers = toPlainHeaders(options.headers)
    // Host is taken from the validated url (host plus port when non-default)
    // unless the caller already set it in any casing.
    if (!Object.keys(headers).some((key) => key.toLowerCase() === 'host')) {
      headers.host = target.host
    }

    return await new Promise((resolve, reject) => {
      const finish = (res) => {
        const chunks = [Buffer.alloc(0)]
        res.on('data', (chunk) => chunks.push(Buffer.from(chunk)))
        res.on('end', () => {
          const body = Buffer.concat(chunks)
          const status = res.statusCode || 502

          const responseHeaders = new Headers()
          const rawHeaders = res.headers || {}
          for (const [key, value] of Object.entries(rawHeaders)) {
            if (Array.isArray(value)) {
              for (const item of value) responseHeaders.append(key, String(item))
            } else if (value !== undefined) {
              responseHeaders.append(key, String(value))
            }
          }

          // A real Response, so every caller keeps `ok`, `status`,
          // `headers.entries()`, `text()` and `json()`.
          const nullBody = NULL_BODY_STATUSES.has(status) || body.length === 0
          resolve(
            new Response(nullBody ? null : body, {
              status,
              statusText: res.statusMessage || '',
              headers: responseHeaders,
            }),
          )
        })
        res.on('error', reject)
      }

      const requestOptions = {
        protocol: base.protocol,
        hostname: base.hostname,
        port,
        path: `${target.pathname}${target.search}`,
        method,
        headers,
        agent,
        ...(servername ? { servername } : {}),
      }

      // The transport is chosen here rather than aliased above, so each call
      // goes through the real http/https module function directly.
      const request = useHttps
        ? https.request(requestOptions, finish)
        : http.request(requestOptions, finish)

      request.on('error', reject)

      const signal = options.signal
      if (signal && typeof signal.addEventListener === 'function') {
        if (signal.aborted) {
          request.destroy(new NetworkSafetyError('aborted'))
        } else {
          const onAbort = () => request.destroy(new NetworkSafetyError('aborted'))
          signal.addEventListener('abort', onAbort, { once: true })
          request.on('close', () => signal.removeEventListener('abort', onAbort))
        }
      }

      const body = encodeRequestBody(options.body)
      if (isStreamLike(body)) {
        body.pipe(request)
      } else if (body) {
        request.write(body)
      }
      request.end()
    })
  }
}

/** Per-request defaults that disable implicit redirect following. */
export function safeRequestDefaults() {
  return { maxRedirects: 0 }
}

/**
 * Axios config fragment for an already-checked destination: no automatic
 * redirects, and a lookup that can only ever return a validated address.
 */
export function safeRequestConfig(destination) {
  const pinned = pickPinnedAddress(destination)
  if (!pinned) {
    return { maxRedirects: 0 }
  }

  // axios consumes `lookup` through util.callbackify, so it must be a promise
  // returning function; the agents use the callback contract instead.
  return {
    maxRedirects: 0,
    lookup: createPinnedAxiosLookup([pinned]),
    httpAgent: new http.Agent({ lookup: createPinnedLookup([pinned]), keepAlive: false }),
    httpsAgent: new https.Agent({ lookup: createPinnedLookup([pinned]), keepAlive: false }),
  }
}

// ---------------------------------------------------------------------------
// Redirect handling
// ---------------------------------------------------------------------------

/**
 * True when a redirect Location is safe to follow next: absolute URL, http(s)
 * only, hostname literal check plus full resolve-and-validate.
 */
export async function isSafeRedirectTarget(location, options = {}) {
  const checked = await checkDestination(location, options)
  return checked.ok
}

/**
 * Validates a redirect Location and returns the next URL to fetch, or null
 * when the hop must be refused. Every hop pays the same protocol +
 * hostname + resolved-address price as the original request.
 */
export async function validateRedirect(location, currentUrl, options = {}) {
  if (typeof location !== 'string' || !location.trim()) return null

  let next
  try {
    next = new URL(location, currentUrl)
  } catch {
    return null
  }

  const checked = await checkDestination(next.toString(), options)
  if (!checked.ok) return null
  return checked
}

export function isRedirectStatus(status) {
  return REDIRECT_STATUSES.includes(Number(status))
}
