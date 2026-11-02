const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY

// Internal dispatch secret. The route handler forwards
// `x-internal-service-token`; this worker rejects calls that lack it or carry
// the wrong value. Mirrors assets.js, brands.js, campaigns.js,
// photo-studio.js. Anonymous end users can still trigger discovery — the
// secret authenticates the dispatch, not the end user.
// remix: falls back to PERSONALIZATION_DISCOVERY_SECRET, the same fallback the
// API applies in netlify/functions/_personalization/shims/env.ts, so the two
// sides always agree on the secret.
const INTERNAL_FUNCTION_SECRET =
  process.env.INTERNAL_FUNCTION_SECRET || process.env.PERSONALIZATION_DISCOVERY_SECRET || ''

function internalSecretOk(event) {
  // Fail closed: with no secret configured nothing can prove a dispatch came
  // from the route, so nothing is accepted.
  if (!INTERNAL_FUNCTION_SECRET) return false
  const headers = event.headers || {}
  const provided = headers['x-internal-service-token']
  if (provided === undefined || provided === null || provided === '') return false
  const a = Buffer.from(provided, 'utf8')
  const b = Buffer.from(INTERNAL_FUNCTION_SECRET, 'utf8')
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i]
  return diff === 0
}

// The Supabase client is created lazily so that importing this module never
// throws on a deployment with no Supabase env (and so the handler can be
// constructed in unit tests without a database).
let supabaseClient = null

function getSupabase() {
  if (!supabaseClient) {
    supabaseClient = createClient(supabaseUrl, serviceRole)
  }
  return supabaseClient
}

// ---------------------------------------------------------------------------
// Resource limits / timeouts
// ---------------------------------------------------------------------------

const BROWSER_FALLBACK_MAX_PAGES = 4
// Time budget for the static / sitemap / Crawlee layers inside the worker.
const FAST_DISCOVERY_BUDGET_MS = 20_000
const BROWSER_FALLBACK_MAX_CANDIDATES = 60
const BROWSER_FALLBACK_NAVIGATION_TIMEOUT = 5000
const BROWSER_FALLBACK_SCROLL_TIMEOUT = 2000
const BROWSER_FALLBACK_SCROLL_ATTEMPTS = 1
const BROWSER_FALLBACK_SCROLL_DELAY = 100
const BROWSER_FALLBACK_MAX_IMAGES_PER_PAGE = 40

/** Hard cap on the redirect hops a single navigation may take. */
const BROWSER_SSRF_MAX_REDIRECTS = 5
/** Maximum number of pages that may be open/navigating at the same time. */
const BROWSER_SSRF_MAX_CONCURRENT_PAGES = 2
/** Maximum number of in-flight resource requests allowed per browser context. */
const BROWSER_SSRF_MAX_INFLIGHT_REQUESTS = 64
/** Longest URL the gate will even consider. */
const BROWSER_SSRF_MAX_URL_LENGTH = 2048
/** How long a resolved DNS answer is trusted before it must be resolved again. */
const BROWSER_SSRF_DNS_TTL_MS = 30000
/** Overall wall-clock budget for one discovery run. */
const BROWSER_SSRF_RUN_BUDGET_MS = 60000

const SSRF_LIMITS = Object.freeze({
  maxRedirects: BROWSER_SSRF_MAX_REDIRECTS,
  maxConcurrentPages: BROWSER_SSRF_MAX_CONCURRENT_PAGES,
  maxInflightRequests: BROWSER_SSRF_MAX_INFLIGHT_REQUESTS,
  maxUrlLength: BROWSER_SSRF_MAX_URL_LENGTH,
  dnsTtlMs: BROWSER_SSRF_DNS_TTL_MS,
  runBudgetMs: BROWSER_SSRF_RUN_BUDGET_MS,
  maxPages: BROWSER_FALLBACK_MAX_PAGES,
  maxCandidates: BROWSER_FALLBACK_MAX_CANDIDATES,
  navigationTimeout: BROWSER_FALLBACK_NAVIGATION_TIMEOUT,
})

// ---------------------------------------------------------------------------
// Serverless Chromium bootstrap
// ---------------------------------------------------------------------------

let serverlessChromiumEnvironmentReady = false

async function ensureServerlessChromiumEnvironment() {
  if (serverlessChromiumEnvironmentReady) {
    return
  }
  try {
    const { setupLambdaEnvironment } = await import('@sparticuz/chromium')
    if (typeof setupLambdaEnvironment === 'function') {
      const { tmpdir } = require('node:os')
      const { join } = require('node:path')
      setupLambdaEnvironment(join(tmpdir(), 'al2023', 'lib'))
    }
  } catch {
    // ignore
  }
  serverlessChromiumEnvironmentReady = true
}

async function getChromiumExecutablePath() {
  await ensureServerlessChromiumEnvironment()
  try {
    const { default: Chromium } = await import('@sparticuz/chromium')
    if (process.platform !== 'darwin') {
      return await Chromium.executablePath()
    }
  } catch {
    // ignore
  }
  return undefined
}

/**
 * `resolverRules` is a `--host-resolver-rules` fragment produced by the SSRF
 * gate. It forces the browser process to connect to the address Node already
 * validated instead of resolving the name a second time, which closes part of
 * the DNS-rebinding window.
 */
async function getBrowserArgs(resolverRules) {
  await ensureServerlessChromiumEnvironment()
  try {
    const { default: Chromium } = await import('@sparticuz/chromium')
    const args = Array.isArray(Chromium.args) ? Chromium.args : []
    const filtered = args.filter((arg) => !arg.startsWith('--disable-features='))
    filtered.push('--disable-features=site-per-process')
    if (resolverRules) {
      filtered.push(`--host-resolver-rules=${resolverRules}`)
    }
    return filtered
  } catch {
    const fallback = [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--disable-extensions',
      '--disable-background-networking',
      '--disable-sync',
      '--disable-translate',
      '--metrics-recording-only',
      '--mute-audio',
      '--no-first-run',
      '--safebrowsing-disable-auto-update',
      '--disable-default-apps',
      '--disable-features=site-per-process',
    ]
    if (resolverRules) {
      fallback.push(`--host-resolver-rules=${resolverRules}`)
    }
    return fallback
  }
}

// ---------------------------------------------------------------------------
// Junk / ad filtering (unchanged behaviour — this is the multi-layered asset
// discovery filter, not a network filter)
// ---------------------------------------------------------------------------

const BLOCKED_RESOURCE_TYPES = ['media', 'font', 'stylesheet']

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

function isBlockedUrl(url) {
  return BLOCKED_URL_PATTERNS.some((pattern) => pattern.test(url))
}

function isLikelyJunk(url) {
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

// ---------------------------------------------------------------------------
// SSRF gate
//
// The discovery pipeline used to filter only *junk* and *social* paths. It
// never looked at where a socket was about to go, so any caller could make the
// server fetch internal URLs (169.254.169.254, RFC1918 hosts, IPv6 ULA, ...).
// Everything below is the destination gate: scheme, literal-address spelling,
// resolved address, redirect hops. It mirrors `src/server/browserDiscovery.ts`.
// ---------------------------------------------------------------------------

const { isIPv6 } = require('node:net')

// ---------------------------------------------------------------------------
// Centralized network-destination gate (src/lib/networkSafety.ts)
//
// That module is the single source of truth for "may this process open a
// connection to that destination?": protocol allowlist, literal-address
// classification, DNS resolve-and-validate, and the pinned lookup that closes
// the DNS-rebinding window. It is plain JavaScript inside a .ts wrapper, so
// this CommonJS function can load it directly.
//
// The load is deliberately defensive. Netlify bundles this function, and a
// bundler that refuses to follow a `../../` require into src/ must not take
// the handler down with it: when the module cannot be loaded, the local gate
// below (the same rules, with its own messages) keeps running, so a bundling
// surprise degrades to "one classifier instead of two" instead of to an open
// destination. When it *is* loaded, both classifiers have to agree before a
// destination is allowed.
// ---------------------------------------------------------------------------

let networkSafetyModule = null
let networkSafetyLoadAttempted = false

function loadNetworkSafety() {
  if (networkSafetyLoadAttempted) return networkSafetyModule
  networkSafetyLoadAttempted = true

  // remix: the shared SSRF helpers are bundled from the ported server tree.
  try {
    // eslint-disable-next-line global-require
    const loaded = require('./_personalization/src/lib/networkSafety')
    if (loaded && typeof loaded.isBlockedIpAddress === 'function') networkSafetyModule = loaded
  } catch {
    // The local gate below remains the fallback.
  }

  return networkSafetyModule
}

/** Agent A's centralized host-name verdict, or false when it is unavailable. */
function networkSafetyBlocksHostname(hostname) {
  const mod = loadNetworkSafety()
  if (!mod || typeof mod.isBlockedHostname !== 'function') return false
  try {
    return Boolean(mod.isBlockedHostname(hostname))
  } catch {
    return true // a classifier that throws must not be read as "allowed"
  }
}

/** Agent A's centralized address verdict, or false when it is unavailable. */
function networkSafetyBlocksAddress(address) {
  const mod = loadNetworkSafety()
  if (!mod || typeof mod.isBlockedIpAddress !== 'function') return false
  try {
    return Boolean(mod.isBlockedIpAddress(address))
  } catch {
    return true
  }
}

/**
 * Re-validates a redirect hop through Agent A's `validateRedirect`, which
 * resolves the Location against the URL the browser is currently on and then
 * runs the full protocol + hostname + resolved-address gate. Returns null when
 * the centralized module is unavailable (the caller falls back to the local
 * gate) and a destination object — or null — when it ran.
 */
async function networkSafetyValidateRedirect(location, currentUrl) {
  const mod = loadNetworkSafety()
  if (!mod || typeof mod.validateRedirect !== 'function') return null
  try {
    return await mod.validateRedirect(location, currentUrl)
  } catch {
    return null
  }
}

/** Agent A's pinned-resolver cache host → validated destination map. */
function networkSafetyPickPinnedAddress(destination) {
  const mod = loadNetworkSafety()
  if (!mod || typeof mod.pickPinnedAddress !== 'function') return null
  try {
    return mod.pickPinnedAddress(destination)
  } catch {
    return null
  }
}

function networkSafetyPinnedAgent(destination) {
  const mod = loadNetworkSafety()
  if (!mod || typeof mod.createPinnedAgent !== 'function') return null
  try {
    return mod.createPinnedAgent(destination)
  } catch {
    return null
  }
}

const ALLOWED_PROTOCOLS = new Set(['http:', 'https:'])

/**
 * Schemes that never open a socket. Permitted for *subresources* only; the
 * navigation target itself must be http/https.
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

class BrowserSsrfError extends Error {
  constructor(message, url, hostname = '') {
    super(message)
    this.name = 'BrowserSsrfError'
    this.url = url
    this.hostname = hostname
  }
}

// --- literal address parsing -------------------------------------------------

/**
 * Canonical dotted-quad IPv4 -> uint32.
 *
 * Returns null for every other spelling, including the smuggled forms
 * (`0177.0.0.1`, `0x7f.0.0.1`, `127.1`, `2130706433`). Those are rejected
 * outright rather than normalised, because a host name made only of integer
 * literals can never be a real DNS name.
 */
function parseCanonicalIpv4(hostname) {
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
function isNonCanonicalIpLiteral(hostname) {
  const parts = hostname.split('.')
  if (parts.length === 0 || parts.length > 4) return false
  return parts.every((part) => INTEGER_LITERAL_PART.test(part))
}

/**
 * IPv6 -> the eight 16-bit groups of the address (an embedded IPv4 tail is
 * folded into the last two groups). Groups rather than a 128-bit integer so
 * the prefix checks stay readable.
 */
function parseIpv6Groups(hostname) {
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
    ...Array(compressed ? missing : 0).fill('0'),
    ...tailGroups,
  ]
  if (groups.length !== 8) return null

  const parsed = []
  for (const group of groups) {
    if (!/^[0-9a-f]{1,4}$/i.test(group)) return null
    parsed.push(parseInt(group, 16))
  }
  return parsed
}

function ipv4ToString(value) {
  return [(value >>> 24) & 0xff, (value >>> 16) & 0xff, (value >>> 8) & 0xff, value & 0xff].join('.')
}

function unsafeVerdict(reason) {
  return { unsafe: true, reason }
}

const SAFE_VERDICT = { unsafe: false, reason: '' }

function classifyIpv4(value) {
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
function isIpv4TransitionPrefix(groups) {
  return groups.slice(0, 6).every((group) => group === 0 || group === 0xffff)
}

function classifyIpv6(groups) {
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
function findUnsafeHostReason(hostnameInput) {
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

  // Second opinion from the centralized gate. The local classifier above
  // exists to produce a human-readable reason; the allow/deny decision is
  // cross-checked against `src/lib/networkSafety.ts` so the two cannot drift
  // apart. Anything it rejects is rejected here too.
  if (networkSafetyBlocksHostname(hostname)) {
    return `the host name is not a public destination (networkSafety rejected ${hostname})`
  }

  return null
}

/** Re-checks a single address returned by the resolver. */
function findUnsafeAddressReason(address) {
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
function isIpLiteralHost(hostname) {
  return isIPv6(hostname) || parseCanonicalIpv4(hostname) !== null
}

// --- resolver with caching ---------------------------------------------------

/**
 * Wraps a resolver with a short-lived cache plus in-flight de-duplication, so
 * the per-subresource gate does not turn into a DNS thundering herd.
 */
function createCachingDnsResolver(resolver, ttlMs) {
  const ttl = typeof ttlMs === 'number' ? ttlMs : BROWSER_SSRF_DNS_TTL_MS
  const cache = new Map()
  const inFlight = new Map()

  return async (hostname) => {
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
      cache.set(hostname, { addresses, expiresAt: Date.now() + ttl })
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

/**
 * Production resolver. Delegates to `src/lib/networkSafety.ts` when it is
 * available, so the DNS phase of the gate (resolve4 + resolve6, then re-check
 * every answer) lives in exactly one place on this deployment. Falls back to
 * the local lookup only when the centralized module cannot be loaded.
 */
async function systemDnsResolver(hostname) {
  const mod = loadNetworkSafety()
  if (mod && typeof mod.resolvePublicAddresses === 'function') {
    return mod.resolvePublicAddresses(hostname)
  }
  const { lookup } = await import('node:dns/promises')
  const records = await lookup(hostname, { all: true })
  return records.map((record) => record.address)
}

const defaultDnsResolver = systemDnsResolver

// --- the gate itself ---------------------------------------------------------

/**
 * Validates a navigation target *before* a socket is opened.
 *
 * Rejects with `BrowserSsrfError` when the destination is not a verifiable
 * public http(s) destination. Never performs navigation itself.
 */
async function validateBrowserNavigationUrl(rawUrl, options = {}) {
  const input = typeof rawUrl === 'string' ? rawUrl.trim() : ''
  if (!input) throw new BrowserSsrfError('A navigation URL is required', String(rawUrl ?? ''))
  if (input.length > BROWSER_SSRF_MAX_URL_LENGTH) {
    throw new BrowserSsrfError(`The URL exceeds the ${BROWSER_SSRF_MAX_URL_LENGTH} character limit`, input)
  }

  let parsed
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

  const addresses = []

  // A host name (as opposed to an IP literal) has to be resolved and every
  // answer re-checked, because `internal.example.com` may point at 10.0.0.5.
  if (!isIpLiteralHost(hostname)) {
    const resolver = options.dnsResolver ?? defaultDnsResolver
    let resolved
    try {
      resolved = await resolver(hostname)
    } catch (err) {
      // The delegated resolver reports *why* it refused. Keep the historical
      // wording for an unresolvable name and be specific when the answer
      // itself was in a blocked range.
      if (err && err.reason === 'resolved_to_blocked_ip') {
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
      // centralized fail-closed decision.
      const addressReason = findUnsafeAddressReason(address)
      if (addressReason || networkSafetyBlocksAddress(address)) {
        throw new BrowserSsrfError(
          `Destination rejected: ${hostname} resolves to ${address} (${addressReason ?? 'blocked by networkSafety'})`,
          input,
          hostname,
        )
      }
      addresses.push(address)
    }
  }

  return {
    url: parsed.toString(),
    hostname,
    addresses,
    pinned: addresses.length > 0,
    protocol: parsed.protocol,
  }
}

/**
 * `--host-resolver-rules` fragment that forces Chromium to connect to the
 * address Node just validated, closing part of the DNS-rebinding window.
 *
 * The address comes from networkSafety's `pickPinnedAddress`, which keeps the
 * family aligned with the literal that was validated, so the Host header, the
 * SNI and the certificate verification all still use the original host name —
 * only the peer IP is pinned.
 */
function buildHostResolverRules(pins) {
  const rules = []

  for (const pin of pins) {
    if (!pin || !pin.hostname || !Array.isArray(pin.addresses) || pin.addresses.length === 0) continue
    if (isIpLiteralHost(pin.hostname)) continue // already an address, nothing to pin
    const pinned =
      networkSafetyPickPinnedAddress({ hostname: pin.hostname, addresses: pin.addresses }) ||
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
function redirectHopCount(request) {
  const seen = new Set()
  let hops = 0
  let current = request && typeof request.redirectedFrom === 'function' ? request.redirectedFrom() : null

  while (current) {
    if (seen.has(current)) {
      return BROWSER_SSRF_MAX_REDIRECTS + 1
    }
    seen.add(current)
    hops += 1
    if (hops > BROWSER_SSRF_MAX_REDIRECTS) return hops
    current = typeof current.redirectedFrom === 'function' ? current.redirectedFrom() : null
  }

  return hops
}

/** The URL a request was redirected *from*, when Playwright still has that hop. */
function redirectedFromUrl(request) {
  const parent = request && typeof request.redirectedFrom === 'function' ? request.redirectedFrom() : null
  if (!parent || typeof parent.url !== 'function') return undefined
  return parent.url()
}

function createSsrfGuard(options = {}) {
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

      let parsed
      try {
        parsed = new URL(rawUrl)
      } catch {
        return false
      }

      if (NON_NETWORK_SUBRESOURCE_SCHEMES.has(parsed.protocol)) return true
      if (!ALLOWED_PROTOCOLS.has(parsed.protocol)) return false

      // Hop 1: the local gate, driven through the (possibly injected)
      // resolver. This is the layer the hermetic test suite exercises.
      try {
        await validateBrowserNavigationUrl(parsed.toString(), { dnsResolver })
      } catch {
        return false
      }

      // Hop 2: the centralized redirect validator from networkSafety. It runs
      // the same protocol + hostname + resolve-and-validate price on the
      // destination *and* resolves the Location against the URL the browser is
      // currently on, which is what "re-validate every hop" means. It owns its
      // own DNS, so it is skipped when a resolver has been injected (tests),
      // where it would bypass the injected answers.
      if (!injected) {
        const redirectCheck = await networkSafetyValidateRedirect(rawUrl, currentUrl || rawUrl)
        if (redirectCheck === null) return false
      }

      return true
    },

    hostResolverRules(pins) {
      return buildHostResolverRules(pins)
    },
  }
}

// ---------------------------------------------------------------------------
// Clerk authentication (server-verified, required)
// ---------------------------------------------------------------------------

function getHeader(event, name) {
  const target = name.toLowerCase()

  const readFrom = (headers) => {
    if (!headers) return undefined
    for (const key of Object.keys(headers)) {
      if (key.toLowerCase() === target) return headers[key]
    }
    return undefined
  }

  return readFrom(event && event.headers) ?? readFrom(event && event.multiValueHeaders)
}

function parseCookieHeader(headerValue) {
  const jar = {}
  for (const part of String(headerValue || '').split(';')) {
    const separator = part.indexOf('=')
    if (separator === -1) continue
    const key = part.slice(0, separator).trim()
    const value = part.slice(separator + 1).trim()
    if (key) jar[key] = decodeURIComponent(value)
  }
  return jar
}

function extractSessionToken(event) {
  const authorization = getHeader(event, 'authorization')
  if (authorization) {
    const match = /^Bearer\s+(.+)$/i.exec(authorization.trim())
    if (match) return match[1].trim()
  }

  const cookies = parseCookieHeader(getHeader(event, 'cookie'))
  // Clerk writes the long-lived session JWT here. The short-lived
  // `__session` URL fragment form and the `__clerk_db_jwt` handshake value are
  // both unusable server-side, so only the cookie form is accepted.
  if (cookies.__session) return cookies.__session
  if (cookies.__client_uat) return cookies.__client_uat

  return null
}

/**
 * Verifies a Clerk session token server-side.
 *
 * Returns `{ userId }` on success and `{ error, status }` on failure. The token
 * signature and claims are checked against the Clerk instance, so a caller
 * cannot forge a session by setting a header.
 *
 * Every failure here is an *authentication* failure (401). A missing instance
 * secret in particular is never reported as a 500: that would read as
 * "transient, try again" when the truth is "this deployment cannot prove who
 * you are", and an unverified session must never drive user-specific
 * discovery.
 */
async function verifyClerkSessionToken(token) {
  if (!token) {
    // Discovery is free: no session token means an anonymous caller.
    // The job row already scopes ownership by IP (set at job creation),
    // so the worker drives the job under its existing clerk_user_id.
    return { userId: null }
  }

  // remix: verify with the shared Clerk JWKS verifier used by every remix
  // function (netlify/functions/_shared/clerkAuth.js) instead of @clerk/backend.
  let verifyClerkToken
  try {
    // eslint-disable-next-line global-require
    verifyClerkToken = require('./_shared/clerkAuth.js').verifyClerkToken
  } catch {
    return { error: 'Authentication service unavailable', status: 500 }
  }
  if (typeof verifyClerkToken !== 'function') {
    return { error: 'Authentication service unavailable', status: 500 }
  }

  try {
    const verified = await verifyClerkToken(token)
    if (!verified || !verified.userId) {
      return { error: 'Invalid session token', status: 401 }
    }
    return { userId: verified.userId, sessionId: (verified.claims && verified.claims.sid) || null }
  } catch {
    // Any verification failure is an authentication failure. The underlying
    // reason is deliberately not echoed back to the caller.
    return { error: 'Invalid session token', status: 401 }
  }
}

// ---------------------------------------------------------------------------
// Browser discovery
// ---------------------------------------------------------------------------

function classifyBrowserCandidateUrl(url) {
  const lower = url.toLowerCase()
  const rules = [
    { keywords: ['/logo', '/logos', '-logo.', '_logo.', '/brand/'], category: 'logo', confidence: 70 },
    { keywords: ['/team', '/staff', '/people', '/about-us', '/our-team'], category: 'team', confidence: 65 },
    { keywords: ['/product', '/products', '/shop', '/menu', '/catalog'], category: 'product', confidence: 65 },
    { keywords: ['/store', '/location', '/locations', '/find-us'], category: 'storefront', confidence: 60 },
    { keywords: ['/office', '/interior', '/showroom'], category: 'office', confidence: 60 },
    { keywords: ['/vehicle', '/truck', '/van', '/fleet'], category: 'branded_vehicle', confidence: 60 },
    { keywords: ['/project', '/projects', '/gallery', '/portfolio', '/completed'], category: 'completed_work', confidence: 60 },
    { keywords: ['/service', '/services', '/what-we-do'], category: 'service', confidence: 55 },
    { keywords: ['headshot', 'portrait', 'face', 'avatar'], category: 'person', confidence: 60 },
    { keywords: ['favicon', 'icon', 'sprite', 'pixel', '1x1', 'tracking', 'beacon'], category: 'irrelevant', confidence: 80 },
  ]

  for (const rule of rules) {
    if (rule.keywords.some((kw) => lower.includes(kw))) {
      return { category: rule.category, confidence: rule.confidence, recommended: rule.category !== 'irrelevant' }
    }
  }

  return { category: 'brand', confidence: 40, recommended: true }
}

function buildDiscoveredAssetsFromBrowserCandidates(candidates, maxImages) {
  const discoveredAssets = []
  const seen = new Set()

  for (const candidate of candidates.slice(0, maxImages || 60)) {
    if (discoveredAssets.length >= (maxImages || 60)) break

    const normalizedUrl = (candidate.url || '').trim()
    if (!normalizedUrl || seen.has(normalizedUrl)) continue
    seen.add(normalizedUrl)

    const classification = classifyBrowserCandidateUrl(normalizedUrl)
    if (!classification.recommended) continue

    discoveredAssets.push({
      id: `disc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      sourceUrl: normalizedUrl,
      previewUrl: normalizedUrl,
      category: classification.category,
      confidence: classification.confidence,
      qualityScore: classification.confidence,
      relevanceScore: classification.confidence,
      selected: classification.recommended,
      recommended: classification.recommended,
      rejected: false,
    })
  }

  return discoveredAssets
}

/**
 * Runs tasks with at most `limit` in flight. Page navigations stay sequential
 * by default; this exists so the concurrency cap is actually enforced rather
 * than merely documented.
 */
async function runWithConcurrencyLimit(limit, tasks) {
  const results = new Array(tasks.length)
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

async function collectBrowserCandidates(baseUrl, pages, pageTelemetry, existingBrowser, options = {}) {
  const ownsBrowser = !existingBrowser
  const guard = options.guard ?? createSsrfGuard()
  const allCandidates = []
  let pagesCrawled = 0

  // 1. The base URL and every page we were asked to open must clear the gate
  //    before a browser process is even started. A rejected base URL is a hard
  //    failure, never a silent skip.
  const baseTarget = await guard.validateNavigationTarget(baseUrl)

  const safePages = []
  for (const pageUrl of pages) {
    try {
      safePages.push((await guard.validateNavigationTarget(pageUrl)).url)
    } catch (err) {
      pageTelemetry.push({
        url: pageUrl,
        navigationStartedAt: new Date().toISOString(),
        navigationCompletedAt: null,
        navigationDurationMs: null,
        candidateCount: 0,
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }

  if (safePages.length === 0) {
    throw new BrowserSsrfError('No navigation target passed the SSRF gate', baseUrl, baseTarget.hostname)
  }

  const browser = existingBrowser || await chromiumLaunch(guard, baseTarget)
  let context = null

  try {
    context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (compatible; AssetDiscovery/1.0; +https://example.com/bot)',
      viewport: { width: 1280, height: 900 },
      // A registered service worker issues its own `fetch`es in a worker scope
      // that `context.route()` never sees. Blocking them closes the bypass: the
      // first page can no longer cache a worker that keeps talking to an
      // internal address after the run's checks are over.
      serviceWorkers: 'block',
    })

    let inflightRequests = 0
    let blockedSubrequests = 0

    // One interceptor for every request the context makes. This is the layer
    // that stops a *public* page from pulling images or scripts out of an
    // internal address: `context.route` sees subresources, and `page.goto`'s
    // own validation never would.
    await context.route('**/*', async (route, request) => {
      const resourceType = typeof request.resourceType === 'function' ? request.resourceType() : ''
      const url = typeof request.url === 'function' ? request.url() : ''

      // Cheap synchronous filters first, so the DNS gate is not consulted for
      // every tracker pixel on the page.
      if (isBlockedUrl(url) || BLOCKED_RESOURCE_TYPES.includes(resourceType)) {
        return route.abort()
      }

      // Redirect hops are counted here as a cheap budget, not as a guarantee:
      // Playwright does not invoke this interceptor for every hop of every
      // navigation (and not at all for service-worker fetches), so this counter
      // cannot be the thing that stops a public page 30x-ing into an internal
      // host. That is exactly why the allowlist proxy is mandatory — it is the
      // only layer that sees every socket the browser opens. The counter is
      // cycle-safe, so a chain that never terminates is refused as well.
      if (redirectHopCount(request) > BROWSER_SSRF_MAX_REDIRECTS) {
        blockedSubrequests++
        return route.abort()
      }

      // The full destination gate for this request. `currentUrl` is where the
      // browser is coming from, which is what makes this a redirect-aware check
      // rather than a plain URL check. Treat it as the best-effort layer; the
      // proxy re-runs the same gate per socket.
      if (!(await guard.isResourceRequestAllowed(url, redirectedFromUrl(request)))) {
        blockedSubrequests++
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

    const tasks = safePages.map((pageUrl) => async () => {
      const navStartedAt = new Date().toISOString()
      let navCompletedAt = null
      let navError = null
      let candidateCount = 0

      if (allCandidates.length >= BROWSER_FALLBACK_MAX_CANDIDATES) {
        return { url: pageUrl, navigationStartedAt: navStartedAt, navigationCompletedAt: null, navigationDurationMs: null, candidateCount: 0, error: null }
      }

      let page = null
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
          await page.waitForTimeout(500)
          let lastHeight = 0
          let attempts = 0
          while (attempts < BROWSER_FALLBACK_SCROLL_ATTEMPTS) {
            const currentHeight = await page.evaluate('document.documentElement.scrollHeight')
            if (currentHeight === lastHeight) break
            lastHeight = currentHeight
            await page.evaluate('window.scrollBy(0, window.innerHeight * 0.8)')
            await page.waitForTimeout(100)
            attempts++
          }
          await page.evaluate('window.scrollTo(0, 0)')

          await page.evaluate(`
            (function() {
              var win = window;
              if (!win.__discoveryCandidates) { win.__discoveryCandidates = []; }
              function walk(root) {
                var imgs = root.querySelectorAll('img');
                for (var i = 0; i < imgs.length; i++) {
                  var img = imgs[i];
                  var src = img.src || '', currentSrc = img.currentSrc || '';
                  var dataSrc = img.getAttribute('data-src') || '';
                  var dataSrcset = img.getAttribute('data-srcset') || '';
                  var srcset = img.getAttribute('srcset') || '';
                  if (src) win.__discoveryCandidates.push({ src: src, alt: img.alt || '' });
                  if (currentSrc && currentSrc !== src) win.__discoveryCandidates.push({ src: currentSrc, alt: img.alt || '' });
                  if (dataSrc) win.__discoveryCandidates.push({ src: dataSrc, alt: img.alt || '' });
                  if (dataSrcset) {
                    var entries = dataSrcset.split(',').map(function(s) { return s.trim().split(/\\s+/)[0]; }).filter(Boolean);
                    for (var j = 0; j < entries.length; j++) win.__discoveryCandidates.push({ src: entries[j], alt: img.alt || '' });
                  }
                  if (srcset) {
                    var srcEntries = srcset.split(',').map(function(s) { return s.trim().split(/\\s+/)[0]; }).filter(Boolean);
                    for (var k = 0; k < srcEntries.length; k++) win.__discoveryCandidates.push({ src: srcEntries[k], alt: img.alt || '' });
                  }
                }
                var pictures = root.querySelectorAll('picture');
                for (var p = 0; p < pictures.length; p++) {
                  var sources = pictures[p].querySelectorAll('source[srcset]');
                  for (var s = 0; s < sources.length; s++) {
                    var sourceSrcset = sources[s].getAttribute('srcset') || '';
                    var sourceEntries = sourceSrcset.split(',').map(function(x) { return x.trim().split(/\\s+/)[0]; }).filter(Boolean);
                    for (var e = 0; e < sourceEntries.length; e++) win.__discoveryCandidates.push({ src: sourceEntries[e] });
                  }
                }
                var allElements = root.querySelectorAll('[style]');
                for (var el = 0; el < allElements.length; el++) {
                  var bg = el.style.backgroundImage;
                  if (bg && bg.includes('url(')) {
                    var match = bg.match(/\\(["']?([^"')]+)["']?\\)/);
                    if (match && match[1]) win.__discoveryCandidates.push({ src: match[1] });
                  }
                }
              }
              walk(document);
            })()
          `)

          const raw = await page.evaluate(`
            (function() {
              var win = window;
              return win.__discoveryCandidates || [];
            })()
          `)
          const seen = new Set()
          const pageCandidates = []
          for (const item of raw) {
            if (!item.src || item.src.startsWith('data:')) continue
            let absolute
            try {
              absolute = new URL(item.src, pageUrl).toString()
            } catch {
              continue
            }
            if (seen.has(absolute)) continue
            if (isLikelyJunk(absolute)) continue
            seen.add(absolute)
            pageCandidates.push({ url: absolute, sourcePage: pageUrl, altText: item.alt })
          }
          candidateCount = pageCandidates.length
          allCandidates.push(...pageCandidates)
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

    const telemetry = await runWithConcurrencyLimit(BROWSER_SSRF_MAX_CONCURRENT_PAGES, tasks)
    for (const entry of telemetry) {
      pageTelemetry.push(entry)
    }
    if (blockedSubrequests > 0 && typeof options.onSubrequestsBlocked === 'function') {
      options.onSubrequestsBlocked(blockedSubrequests)
    }
  } finally {
    try {
      if (context) {
        await context.close()
      }
    } catch {
      // ignore context close errors
    }
    if (ownsBrowser && browser) {
      try {
        await browser.close()
      } catch {
        // ignore
      }
    }
  }

  return {
    candidates: allCandidates.slice(0, BROWSER_FALLBACK_MAX_CANDIDATES),
    pagesCrawled,
  }
}

/**
 * Launches Chromium with the validated destination pinned in
 * `--host-resolver-rules`. `headless: true` is deliberate and must stay.
 *
 * `proxyUrl`, when present, is the local allowlist proxy from
 * `startAllowlistProxy`: the network-level half of the guard, under which
 * every socket the browser opens is refused unless the destination has already
 * cleared the same gate, and the upstream connection is then opened through
 * networkSafety's pinned lookup.
 */
async function chromiumLaunch(guard, baseTarget, proxyUrl) {
  const { chromium } = require('playwright-core')
  const executablePath = await getChromiumExecutablePath()
  const args = await getBrowserArgs(guard.hostResolverRules([
    { hostname: baseTarget.hostname, addresses: baseTarget.addresses },
  ]))
  const launchOptions = {
    headless: true,
    executablePath,
    args,
  }
  if (proxyUrl) {
    launchOptions.proxy = { server: proxyUrl }
  }
  return chromium.launch(launchOptions)
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
// through networkSafety's pinned lookup, so the address that was validated is
// the address that is connected to.
//
// Limits, stated plainly:
//   * It is a process-local listener, so it protects this deployment's
//     Chromium; it is not a network ACL.
//   * The tunnel authorizes the host name at CONNECT time and cannot see
//     inside the TLS session afterwards, which is why the `context.route()`
//     interceptor is kept as well: defence in depth, not redundancy.
//   * Chromium resolves nothing itself once an explicit proxy is configured,
//     so `--host-resolver-rules` remains a second binding on top of the proxy
//     rather than a substitute for it. There is deliberately no proxy-less
//     fallback path any more: a run that cannot start its proxy fails closed.
// ---------------------------------------------------------------------------

/**
 * The address the proxy must connect to for a validated destination: the
 * pinned DNS answer, or the literal itself when the destination was already an
 * IP address (nothing to resolve, so the literal is the connection target).
 */
function pinnedAddressFor(destination) {
  return networkSafetyPickPinnedAddress(destination) || (isIpLiteralHost(destination.hostname) ? destination.hostname : null)
}

function shouldUseAllowlistProxy() {
  // Production is never allowed to switch the network layer off. The escape
  // hatch below is a development affordance only: running in production without
  // the proxy would leave nothing but `context.route()` between a page and an
  // internal address, and that interceptor is not consulted for redirect
  // targets or service-worker fetches. A run that cannot start its proxy fails
  // closed (see the handler below).
  if (process.env.NODE_ENV === 'production') return true
  if (process.env.BROWSER_DISCOVERY_ALLOWLIST_PROXY === '0') return false
  // Under Vitest the browser is replaced at the module boundary, so Chromium
  // never opens a socket and a listener would have no client to protect.
  if (process.env.VITEST || process.env.NODE_ENV === 'test') return false
  return true
}

async function startAllowlistProxy(guard) {
  const http = await import('node:http')
  const net = await import('node:net')

  const validated = new Map()
  let rejected = 0

  /** Runs the full gate for a host name and memoises the verdict. */
  const authorize = async (hostname) => {
    const key = String(hostname || '').toLowerCase()
    if (validated.has(key)) return validated.get(key)

    // The protocol of the probe is irrelevant for the DNS half of the gate:
    // http: and https: are both allowed and resolve to the same addresses.
    let destination = null
    try {
      destination = await guard.validateNavigationTarget(`https://${key}/`)
    } catch {
      destination = null
    }
    validated.set(key, destination)
    return destination
  }

  const server = http.createServer()

  // Plain HTTP. The request target arrives in absolute form, which is exactly
  // the destination that has to be authorized.
  server.on('request', (req, res) => {
    let target
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

    authorize(target.hostname).then((destination) => {
      if (!destination) {
        rejected += 1
        res.writeHead(403)
        res.end('blocked by the asset-discovery allowlist')
        return
      }
      // Only ever connect to the address the gate validated.
      const agent = networkSafetyPinnedAgent({ ...destination, protocol: 'http:' })
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

    authorize(hostname).then((destination) => {
      const address = destination ? pinnedAddressFor(destination) : null
      if (!destination || !address) {
        rejected += 1
        clientSocket.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n')
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

  await new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => resolve())
  })

  const address = server.address()
  const port = address && typeof address === 'object' ? address.port : 0

  return {
    url: `http://127.0.0.1:${port}`,
    rejected: () => rejected,
    close: async () => {
      await new Promise((resolve) => {
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

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

function corsHeaders(statusContentType) {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  }
}

function jsonResponse(statusCode, payload) {
  return {
    statusCode,
    headers: corsHeaders(),
    body: JSON.stringify(payload),
  }
}

/**
 * The static HTTP → sitemap → Crawlee/Cheerio layers.
 *
 * remix bundles this function with esbuild (netlify.toml), which compiles the
 * TypeScript source directly, so no prebuild step is needed.
 */
function loadFastDiscovery() {
  // eslint-disable-next-line global-require
  return require('./_personalization/src/server/fastDiscovery')
}

/** Browser escalation is opt-in: it only runs when the flag is exactly 'true'. */
function isBrowserDiscoveryEnabled() {
  return process.env.ENABLE_BROWSER_DISCOVERY === 'true'
}

/**
 * Builds the discovery handler.
 *
 * The dependencies are injectable purely so the unit tests can run hermetically
 * (no live Clerk call, no real database, no Chromium launch). Netlify always
 * receives `handler` with the production defaults below.
 */
function createBrowserDiscoveryHandler(overrides = {}) {
  const deps = {
    verifySessionToken: verifyClerkSessionToken,
    createSsrfGuard,
    getSupabase,
    loadFastDiscovery,
    isBrowserDiscoveryEnabled,
    ...overrides,
  }

  return async function handler(event) {
    if (event.httpMethod === 'OPTIONS') {
      return {
        statusCode: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-internal-service-token',
        },
        body: '',
      }
    }

    if (event.httpMethod !== 'POST') {
      return { statusCode: 405, headers: corsHeaders(), body: JSON.stringify({ error: 'Method not allowed' }) }
    }

    // Internal dispatch authentication. Anonymous end users can trigger
    // discovery (it is free), but the dispatch itself must carry the shared
    // secret so the worker cannot be invoked directly from the browser.
    if (!INTERNAL_FUNCTION_SECRET) {
      console.error('[personalization-browser-discovery] INTERNAL_FUNCTION_SECRET is not set; refusing every dispatch')
      return jsonResponse(503, { error: 'Discovery worker is not configured', code: 'INTERNAL_SECRET_NOT_CONFIGURED' })
    }
    if (!internalSecretOk(event)) {
      return jsonResponse(401, { error: 'Internal dispatch secret required', code: 'INTERNAL_SECRET_REQUIRED' })
    }

    // 1. Server-verified authentication. No session, no discovery.
    const auth = await deps.verifySessionToken(extractSessionToken(event))
    if (auth.error) {
      return jsonResponse(auth.status || 401, { error: auth.error })
    }

    let body
    try {
      body = JSON.parse(event.body || '{}')
    } catch {
      return jsonResponse(400, { error: 'Request body must be valid JSON' })
    }

    const { jobId, priorityPages } = body

    if (!jobId) {
      return jsonResponse(400, { error: 'jobId is required' })
    }

    const supabase = deps.getSupabase()

    // Free-layer results live outside the try so that every failure path below
    // can still save them.
    let fastAssets = []
    let fastNeedsBrowser = true
    let fastProviderUsed = 'NONE'
    let fastProviderAttempts = []
    let fastPagesCrawled = 0
    let fastRawCandidates = 0
    let fastDuration = 0
    let fastCandidates = []
    let fastSocialProfiles = []
    let fastError = null

    // Saves the free-layer assets as a complete job. Used when the browser
    // phase is skipped or fails: those assets are valid on their own.
    const saveFreeLayerResult = async (extraTelemetry = {}, browserError = undefined) => {
      const finalResult = {
        provider: fastProviderUsed,
        candidates: fastCandidates,
        discoveredAssets: fastAssets,
        pagesCrawled: fastPagesCrawled,
        rawCandidates: fastRawCandidates,
        duration: fastDuration,
        socialProfiles: fastSocialProfiles,
        providerAttempts: fastProviderAttempts,
        ...(browserError ? { browserError } : {}),
      }
      const { error: saveError } = await supabase
        .from('lead_finder_discovery_jobs')
        .update({
          status: 'complete',
          completed_at: new Date().toISOString(),
          browser_result_json: null,
          final_result_json: finalResult,
          telemetry_json: {
            freeLayersOnly: true,
            providerUsed: fastProviderUsed,
            providerAttempts: fastProviderAttempts,
            pagesCrawled: fastPagesCrawled,
            rawCandidates: fastRawCandidates,
            durationMs: fastDuration,
            ...extraTelemetry,
            ...(auth.userId ? { clerkUserId: auth.userId } : {}),
          },
        })
        .eq('id', jobId)
      // Never report a completion that was not stored.
      if (saveError) throw new Error(`Failed to save discovery result: ${saveError.message}`)
    }

    try {
      const { data: job, error: fetchError } = await supabase
        .from('lead_finder_discovery_jobs')
        .select('*')
        .eq('id', jobId)
        .single()

      if (fetchError || !job) {
        return jsonResponse(404, { error: 'Job not found' })
      }

      // The website URL is loaded from the verified job row, never trusted
      // from the request body. The row was created by the route handler after
      // its own SSRF validation, so the stored URL is already safe to fetch.
      const websiteUrl = job.website_url

      // 2. The destination gate runs before any navigation is scheduled.
      const guard = deps.createSsrfGuard()
      let baseTarget
      try {
        baseTarget = await guard.validateNavigationTarget(websiteUrl)
      } catch (err) {
        const reason = err instanceof Error ? err.message : String(err)
        console.warn(`[personalization-browser-discovery] rejected destination ${websiteUrl}: ${reason}`)
        await supabase
          .from('lead_finder_discovery_jobs')
          .update({
            status: 'error',
            completed_at: new Date().toISOString(),
            error_code: 'SSRF_BLOCKED',
            error_message: reason,
          })
          .eq('id', jobId)
        return jsonResponse(400, { error: reason, code: 'SSRF_BLOCKED' })
      }

      const pages = Array.isArray(priorityPages) && priorityPages.length > 0
        ? priorityPages.slice(0, BROWSER_FALLBACK_MAX_PAGES)
        : [websiteUrl]

      // Authorization, not just authentication: the session is verified, and
      // the job it is about to drive must belong to that same user. A row that
      // carries no owner column (legacy rows written before ownership was
      // recorded) stays readable — refusing them would break existing jobs
      // rather than close a hole.
      const jobOwner = job.clerk_user_id || job.user_id || job.owner_id || null
      if (jobOwner && auth.userId && jobOwner !== auth.userId) {
        return jsonResponse(403, { error: 'This discovery job belongs to another user' })
      }
      // Anonymous callers can only drive their own IP-scoped jobs. The route
      // handler creates anonymous jobs as `anon-<ip>`. Its dispatch is
      // server-to-server, so the request's own IP is the route's egress
      // address; the route forwards the owner in `x-discovery-job-owner`
      // instead. That header can be trusted because every request reaching
      // this point proved itself with INTERNAL_FUNCTION_SECRET (checked
      // above). Without a forwarded owner the caller is identified by its IP,
      // derived exactly as the route derives it (no port stripping, which
      // would also truncate every IPv6 address).
      if (!auth.userId) {
        const headers = event.headers || {}
        // Only an anonymous owner can be forwarded: a job that belongs to a
        // signed-in user always needs that user's verified session.
        const claimedOwner = headers['x-discovery-job-owner'] || ''
        const forwardedOwner = /^anon(-|$)/.test(claimedOwner) ? claimedOwner : ''
        const callerIp = headers['x-forwarded-for']?.split(',')[0].trim() || headers['x-real-ip'] || ''
        const expectedOwner = forwardedOwner || (callerIp ? `anon-${callerIp}` : 'anon')
        if (jobOwner !== expectedOwner) {
          return jsonResponse(403, { error: 'This discovery job belongs to another caller' })
        }
      }

      const startedAt = new Date().toISOString()
      await supabase
        .from('lead_finder_discovery_jobs')
        .update({ status: 'running', started_at: startedAt })
        .eq('id', jobId)

      // --- Full discovery pipeline, run out of band -------------------------
      // Static HTTP → sitemap → Crawlee/Cheerio always run first. They are
      // free, fast, and need no browser. The browser phase is an escalation
      // that only runs when they could not produce enough useful assets.
      // Results from the free layers are always preserved, even when the
      // browser phase fails or is disabled.
      try {
        const { runFastDiscovery } = deps.loadFastDiscovery()
        const fastResult = await runFastDiscovery({
          websiteUrl,
          maxPages: BROWSER_FALLBACK_MAX_PAGES,
          maxImages: BROWSER_FALLBACK_MAX_IMAGES_PER_PAGE,
          // Bounded so a site with many slow images still leaves time for the
          // browser phase and the final write before the status route's 75s
          // stale-job watchdog gives up on the job.
          deadlineAt: Date.now() + FAST_DISCOVERY_BUDGET_MS,
        })
        fastAssets = fastResult.fastAssets || []
        fastNeedsBrowser = Boolean(fastResult.needsBrowser)
        fastProviderUsed = fastResult.result?.providerUsed || 'NONE'
        fastProviderAttempts = fastResult.result?.providerAttempts || []
        fastPagesCrawled = fastResult.result?.pagesCrawled || 0
        fastRawCandidates = fastResult.result?.rawCandidates || 0
        fastDuration = fastResult.result?.duration || 0
        fastCandidates = fastResult.result?.candidates || []
        fastSocialProfiles = fastResult.result?.socialProfiles || []
      } catch (err) {
        fastError = err instanceof Error ? err.message : String(err)
        console.error('[personalization-browser-discovery] Fast discovery failed:', fastError)
      }

      // The free layers answered on their own — save the assets and return.
      // No browser is launched, no page is navigated.
      if (!fastNeedsBrowser && fastAssets.length > 0) {
        await saveFreeLayerResult()
        return jsonResponse(200, { ok: true, jobId, staticOnly: true })
      }

      // Browser escalation is switched off: what the free layers found (which
      // may be nothing) is the result.
      if (!deps.isBrowserDiscoveryEnabled()) {
        // The only enabled phase failed: that is an error, not "found nothing".
        if (fastError) {
          await supabase
            .from('lead_finder_discovery_jobs')
            .update({
              status: 'error',
              completed_at: new Date().toISOString(),
              error_code: 'FAST_DISCOVERY_FAILED',
              error_message: fastError,
            })
            .eq('id', jobId)
          return jsonResponse(500, { error: fastError, code: 'FAST_DISCOVERY_FAILED' })
        }
        await saveFreeLayerResult({ browserSkipped: 'ENABLE_BROWSER_DISCOVERY is not true' })
        return jsonResponse(200, { ok: true, jobId, staticOnly: true, browserSkipped: true })
      }

      const browserRuntimeMode = process.platform === 'darwin' ? 'local-mac' : 'netlify-linux'
      const browserAvailable = true
      const browserExecutableResolved = await getChromiumExecutablePath() || 'playwright-managed'
      const browserLaunchStartedAt = new Date().toISOString()

      let browserLaunchedAt = null
      let browserCandidates = 0
      let browserOnlyCandidates = 0
      let browserDurationMs = 0
      let browserErrorCode = null
      let browserErrorMessage = null
      let finalResult = null
      const pageTelemetry = []

      let browser = null
      let allowlistProxy = null
      try {
        // Network-level half of the guard: every socket the browser opens is
        // forced through a local proxy that re-validates the destination. This
        // layer is mandatory — `context.route()` is not called for redirect
        // targets or service-worker fetches, so continuing without the proxy
        // would reopen the SSRF path it exists to close. A proxy that cannot be
        // started therefore fails the run (fail closed) instead of warning and
        // carrying on with the request-level interceptor only.
        if (shouldUseAllowlistProxy()) {
          allowlistProxy = await startAllowlistProxy(guard)
        }

        browser = await chromiumLaunch(guard, baseTarget, allowlistProxy ? allowlistProxy.url : undefined)
        browserLaunchedAt = new Date().toISOString()

        const { candidates, pagesCrawled } = await collectBrowserCandidates(
          websiteUrl,
          pages,
          pageTelemetry,
          browser,
          { guard },
        )

        browserCandidates = candidates.length
        // Fast-layer candidates are deduplicated against browser candidates by
        // the caller of buildDiscoveredAssetsFromBrowserCandidates; here we
        // track how many of the browser candidates were new (not already found
        // by the free layers).
        const browserOnlyCandidates = candidates.length
        const browserCompletedAt = new Date().toISOString()
        browserDurationMs = new Date(browserCompletedAt).getTime() - new Date(browserLaunchStartedAt).getTime()

        const browserAssets = buildDiscoveredAssetsFromBrowserCandidates(candidates, 60)

        // Merge free-layer assets with browser assets. Free-layer assets are
        // always preserved — even when the browser phase fails or finds
        // nothing, the static/sitemap/Crawlee results survive.
        const seenUrls = new Set((fastAssets || []).map((a) => a.previewUrl || a.sourceUrl))
        const mergedAssets = [
          ...(fastAssets || []),
          ...(browserAssets.filter((a) => !seenUrls.has(a.previewUrl || a.sourceUrl))),
        ]

        finalResult = {
          provider: mergedAssets.length > 0 ? (fastAssets.length > 0 ? 'SMARTVIDEO_STATIC_BROWSER' : 'SMARTVIDEO_BROWSER') : 'NONE',
          candidates: [...fastCandidates, ...candidates],
          discoveredAssets: mergedAssets,
          pagesCrawled: fastPagesCrawled + pagesCrawled,
          rawCandidates: fastRawCandidates + candidates.length,
          duration: fastDuration + browserDurationMs,
          socialProfiles: [...fastSocialProfiles, ...(pageTelemetry || [])],
          providerAttempts: [...fastProviderAttempts, 'SMARTVIDEO_BROWSER'],
        }

        await supabase
          .from('lead_finder_discovery_jobs')
          .update({
            status: 'complete',
            completed_at: browserCompletedAt,
            browser_result_json: finalResult,
            final_result_json: finalResult,
            telemetry_json: {
              browserRuntimeMode,
              browserAvailable,
              browserExecutableResolved,
              browserLaunchStartedAt,
              browserLaunchedAt,
              pagesRequested: pages.length,
              pagesCrawled: fastPagesCrawled + pagesCrawled,
              perPage: pageTelemetry,
              browserCandidates,
              browserOnlyCandidates,
              browserDurationMs,
              freeLayerAssets: fastAssets.length,
              providerUsed: finalResult.provider,
              providerAttempts: finalResult.providerAttempts,
              durationMs: fastDuration + browserDurationMs,
              ...(auth.userId ? { clerkUserId: auth.userId } : {}),
            },
          })
          .eq('id', jobId)
      } catch (err) {
        const errorCompletedAt = new Date().toISOString()
        browserDurationMs = new Date(errorCompletedAt).getTime() - new Date(browserLaunchStartedAt).getTime()
        browserErrorCode = err?.code || 'BROWSER_LAUNCH_FAILED'
        browserErrorMessage = err instanceof Error ? err.message : String(err)

        if (fastAssets.length > 0) {
          await saveFreeLayerResult({
            browserFailed: true,
            browserErrorCode,
            browserErrorMessage,
            browserDurationMs,
            perPage: pageTelemetry,
          }, browserErrorMessage)
          return jsonResponse(200, { ok: true, jobId, staticOnly: true, browserFailed: true })
        }

        await supabase
          .from('lead_finder_discovery_jobs')
          .update({
            status: 'error',
            completed_at: errorCompletedAt,
            error_code: browserErrorCode,
            error_message: browserErrorMessage,
            telemetry_json: {
              browserRuntimeMode,
              browserAvailable,
              browserExecutableResolved,
              browserLaunchStartedAt,
              browserLaunchedAt,
              pagesRequested: (priorityPages || []).length || 1,
              pagesCrawled: 0,
              perPage: pageTelemetry,
              browserCandidates: 0,
              browserOnlyCandidates: 0,
              browserDurationMs,
              browserErrorCode,
              browserErrorMessage,
              ...(auth.userId ? { clerkUserId: auth.userId } : {}),
            },
          })
          .eq('id', jobId)
      } finally {
        if (browser) {
          try {
            await browser.close()
          } catch {
            // ignore
          }
        }
        // The allowlist proxy is torn down with the run that created it: it
        // exists only to serve this browser, and leaving a listener bound to a
        // stale guard would keep rejected hosts memoised for the next job.
        if (allowlistProxy) {
          try {
            await allowlistProxy.close()
          } catch {
            // ignore proxy close errors
          }
          allowlistProxy = null
        }
      }

      return jsonResponse(200, { ok: true, jobId })
    } catch (err) {
      const errorCode = err?.code || 'BACKGROUND_FUNCTION_ERROR'
      const errorMessage = err instanceof Error ? err.message : String(err)

      // An unexpected failure does not discard the free-layer assets. Static,
      // sitemap and Crawlee results are valid on their own, so they are saved
      // as complete and the error is surfaced as a warning.
      if (fastAssets.length > 0) {
        try {
          await saveFreeLayerResult({ browserFailed: true, browserErrorCode: errorCode, browserErrorMessage: errorMessage }, errorMessage)
          return jsonResponse(200, { ok: true, jobId, staticOnly: true, browserFailed: true })
        } catch {
          // fall through and record the error instead
        }
      }

      try {
        await supabase
          .from('lead_finder_discovery_jobs')
          .update({
            status: 'error',
            completed_at: new Date().toISOString(),
            error_code: errorCode,
            error_message: errorMessage,
          })
          .eq('id', jobId)
      } catch {
        // ignore supabase update error
      }

      return jsonResponse(500, { error: errorMessage, code: errorCode })
    }
  }
}

module.exports.handler = createBrowserDiscoveryHandler()

// Exported alongside the handler so the SSRF gate can also be unit-tested
// without a browser or a network connection.
module.exports.createBrowserDiscoveryHandler = createBrowserDiscoveryHandler
module.exports.validateBrowserNavigationUrl = validateBrowserNavigationUrl
module.exports.findUnsafeHostReason = findUnsafeHostReason
module.exports.createSsrfGuard = createSsrfGuard
module.exports.buildHostResolverRules = buildHostResolverRules
module.exports.redirectHopCount = redirectHopCount
module.exports.BrowserSsrfError = BrowserSsrfError
module.exports.SSRF_LIMITS = SSRF_LIMITS
// Exported so the fail-closed contract of the network layer can be asserted
// directly (production must not be able to disable the proxy, and a proxy that
// fails to start must abort the run).
module.exports.shouldUseAllowlistProxy = shouldUseAllowlistProxy
module.exports.startAllowlistProxy = startAllowlistProxy
