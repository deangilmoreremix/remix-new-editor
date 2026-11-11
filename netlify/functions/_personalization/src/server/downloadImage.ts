/**
 * Server-side helper: download an image from a public URL and return it as a
 * base64 data URL so the client can upload it through the existing
 * `uploadAsset()` / `uploadFile()` lifecycle.
 *
 * SSRF: every URL — the initial one and every redirect hop — is validated
 * against the centralized `src/lib/networkSafety.ts` gate (protocol
 * allowlist, hostname literal checks for every private / metadata / ULA /
 * link-local / unspecified form, and DNS resolution that validates EVERY
 * address the host currently resolves to, so DNS rebinding is rejected).
 * The validated address is pinned to the outbound connection via
 * `safeRequestConfig`, so a DNS answer that flips between validation and
 * connect cannot move the socket to a private peer. axios' own redirect
 * following is disabled (`maxRedirects: 0` via the pin) and redirects are
 * followed manually so every hop pays the same validation price.
 *
 * Blocked destinations throw a `BlockedTargetError` (message carries the
 * "not allowed" substring the route maps to HTTP 400). A hostname that does
 * not resolve is "unreachable", not "blocked", and surfaces as a plain
 * `Error` so the caller's per-image mapping reports it as `ok: false`.
 */

import axios, { type AxiosResponse } from 'axios'
import {
  checkDestination,
  safeRequestConfig,
  REDIRECT_STATUSES,
  MAX_REDIRECT_HOPS,
} from '../lib/networkSafety'

const REQUEST_TIMEOUT = 15_000

/**
 * The route maps a thrown error message with `/not allowed|Private|Invalid/i`
 * to HTTP 400, so every blocked target carries one of those substrings: an
 * unsafe URL is a caller mistake, never an internal failure.
 */
const BLOCKED_URL_MESSAGE = 'Blocked URL: private/unsafe target'

export class BlockedTargetError extends Error {
  readonly blockedTarget = true
}

function blockedTargetError(reason: string): BlockedTargetError {
  return new BlockedTargetError(`${BLOCKED_URL_MESSAGE} (${reason}) is not allowed`)
}

/**
 * Reasons from `checkDestination` that mean the URL points at a destination
 * a caller is never allowed to reach → `BlockedTargetError` (→ HTTP 400).
 * `dns_resolution_failed` is intentionally excluded: a hostname that does
 * not resolve is "unreachable", not "blocked".
 */
const BLOCK_REASONS = new Set(['blocked_host', 'resolved_to_blocked_ip', 'invalid_url'])

/**
 * `networkSafety` already blocks `0.0.0.0` and `::` via the IPv4 `0/8` and
 * IPv6 "unspecified" rules, but keeping this pre-check makes the intent
 * explicit and protects against any future regression in those rules.
 */
function isUnspecifiedAddress(hostname: string): boolean {
  const bare = hostname.startsWith('[') && hostname.endsWith(']')
    ? hostname.slice(1, -1)
    : hostname
  return bare === '0.0.0.0' || bare === '::'
}

/**
 * Full SSRF validation of an already-absolute URL. Resolves the host and
 * validates every returned address so DNS-rebinding (a public hostname whose
 * A-record flips to a private IP) is caught. Throws `BlockedTargetError`
 * for prohibited destinations and a plain `Error` for unreachable hosts.
 */
async function guardUrl(rawUrl: string): Promise<void> {
  const destination = await checkDestination(rawUrl, {})
  if (!destination.ok) {
    const reason = destination.reason || 'blocked'
    if (BLOCK_REASONS.has(reason)) {
      throw blockedTargetError(reason)
    }
    throw new Error(`Unreachable: ${reason}`)
  }
  if (isUnspecifiedAddress(destination.hostname)) {
    throw blockedTargetError(`unspecified address ${destination.hostname}`)
  }
}

function redirectLocationOf(response: AxiosResponse): string {
  if (!response || !REDIRECT_STATUSES.includes(response.status)) return ''
  const rawLocation: unknown = response.headers?.location
  return typeof rawLocation === 'string' ? rawLocation.trim() : ''
}

/**
 * Fetches `startUrl` with axios' redirect following disabled and each hop
 * re-validated and pinned. A blocked hop throws `BlockedTargetError`; every
 * fetch-level failure (DNS, connect, timeout) propagates as a plain `Error`
 * for the caller to report as a per-image failure.
 */
async function fetchWithValidatedRedirects(startUrl: string): Promise<{
  response: AxiosResponse
  finalUrl: string
}> {
  let currentUrl = startUrl

  for (let redirects = 0; redirects <= MAX_REDIRECT_HOPS; redirects++) {
    // Re-validate every hop (the initial URL included) and pin the connection
    // to the address the gate just validated.
    const destination = await checkDestination(currentUrl, {})
    if (!destination.ok) {
      const reason = destination.reason || 'blocked'
      if (BLOCK_REASONS.has(reason)) {
        throw blockedTargetError(`redirect to ${reason}`)
      }
      throw new Error(`Unreachable redirect: ${reason}`)
    }
    if (isUnspecifiedAddress(destination.hostname)) {
      throw blockedTargetError(`unspecified address ${destination.hostname}`)
    }
    const pin = safeRequestConfig(destination)

    const response = await axios.get(currentUrl, {
      responseType: 'arraybuffer',
      timeout: REQUEST_TIMEOUT,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; AssetDiscovery/1.0; +https://example.com/bot)',
      },
      // 3xx must come back as a response so the manual loop can re-validate
      // the next hop instead of letting axios follow it unchecked.
      validateStatus: (status: number) => status >= 200 && status < 400,
      ...pin,
    })

    const location = redirectLocationOf(response)
    if (!location) {
      return { response, finalUrl: currentUrl }
    }
    if (redirects === MAX_REDIRECT_HOPS) {
      throw blockedTargetError('too many redirects')
    }

    let nextUrl: string
    try {
      nextUrl = new URL(location, currentUrl).toString()
    } catch {
      throw blockedTargetError('malformed redirect Location header')
    }
    // The next iteration re-validates `nextUrl` (and re-pins) before any
    // request is issued to it.
    currentUrl = nextUrl
  }

  throw blockedTargetError('too many redirects')
}

export async function downloadImageAsDataUrl(url: string, maxBytes = 5 * 1024 * 1024): Promise<string> {
  // Pre-flight before any fetch: an unsafe initial URL never reaches axios.
  await guardUrl(url)

  const { response } = await fetchWithValidatedRedirects(url)

  const buffer = Buffer.from(response.data)
  if (buffer.length > maxBytes) {
    throw new Error(`This image is larger than ${Math.round(maxBytes / (1024 * 1024))} MB, so it cannot be edited here. Upload a smaller copy instead.`)
  }

  const contentType = String(response.headers['content-type'] || 'application/octet-stream')
  if (!contentType.startsWith('image/')) {
    throw new Error(`Invalid content type: ${contentType}`)
  }

  const base64 = buffer.toString('base64')
  return `data:${contentType};base64,${base64}`
}
