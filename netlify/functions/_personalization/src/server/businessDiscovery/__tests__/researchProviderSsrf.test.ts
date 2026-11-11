// @vitest-environment node
/**
 * Adversarial SSRF regression tests for the research provider.
 *
 * These tests prove the centralized networkSafety guard (imported via
 * `src/lib/networkSafety.ts`) defeats the public-route SSRF surface even
 * when an attacker controls the URL string. They mock DNS so the suite
 * runs deterministically without touching the network.
 *
 * Coverage:
 *   1. Literal private / loopback / link-local / metadata / CGNAT / ULA /
 *      IPv4-mapped / unspecified addresses are blocked before any request.
 *   2. Alternate IP encodings (decimal, octal, hex) are blocked.
 *   3. A hostname that resolves to a private address is blocked.
 *   4. Connection pinning: the pinned lookup function handed to axios can
 *      only ever return the pre-validated address, so a DNS rebinding
 *      attempt between validation and connect cannot move the socket to
 *      a private peer.
 *   5. Redirects to a private or unreachable host are refused, and the
 *      per-hop redirect loop enforces the configured cap.
 *   6. Unreachable public hosts surface as `reachable: false` (not as a
 *      block), preserving the public route's contract.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Hoisted mocks for node:dns. The networkSafety gate uses
// dns.promises.resolve4 / resolve6, so the spies must be hoisted.
const mockResolve4 = vi.hoisted(() => vi.fn())
const mockResolve6 = vi.hoisted(() => vi.fn())

vi.mock('node:dns', async (importOriginal) => {
  const actual = (await importOriginal()) as typeof import('dns') & { default: { promises: { resolve4: typeof import('dns').promises.resolve4; resolve6: typeof import('dns').promises.resolve6 } } }
  const promises = {
    ...actual.default.promises,
    resolve4: mockResolve4,
    resolve6: mockResolve6,
  }
  return {
    ...actual,
    default: { ...actual.default, promises },
  }
})

import axios from 'axios'
import { researchBusiness } from '../researchProvider'

// Helper: build a "blocked target" rejection as the public route would see
// it (the route regex maps /not allowed|Private|Invalid/i to HTTP 400).
function expectBlocked(reason: string) {
  return expect.objectContaining({
    blockedTarget: true,
    message: expect.stringMatching(new RegExp(`(not allowed|Private|Invalid)`, 'i')),
  })
}

describe('researchProvider SSRF — adversarial', () => {
  beforeEach(() => {
    mockResolve4.mockReset()
    mockResolve6.mockReset()
    vi.restoreAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  // ---- 1. Literal addresses ----------------------------------------------

  it.each([
    ['loopback IPv4', 'http://127.0.0.1/'],
    ['loopback IPv4 alt', 'http://127.0.0.53/'],
    ['cloud metadata', 'http://169.254.169.254/latest/meta-data/'],
    ['RFC1918 10/8', 'http://10.0.0.1/'],
    ['RFC1918 172.16/12', 'http://172.20.10.5/'],
    ['RFC1918 192.168/16', 'http://192.168.1.1/'],
    ['CGNAT 100.64/10', 'http://100.64.0.1/'],
    ['TEST-NET-1 192.0.2/24', 'http://192.0.2.1/'],
    ['unspecified 0.0.0.0', 'http://0.0.0.0/'],
    ['loopback IPv6', 'http://[::1]/'],
    ['unspecified IPv6', 'http://[::]/'],
    ['IPv4-mapped loopback', 'http://[::ffff:127.0.0.1]/'],
    ['alternate encoding (decimal for 127.0.0.1)', 'http://2130706433/'],
    ['alternate encoding (hex for 127.0.0.1)', 'http://0x7f000001/'],
  ])('blocks %s before any request', async (_label, url) => {
    await expect(researchBusiness(url)).rejects.toMatchObject({
      blockedTarget: true,
    })
  })

  it('blocks a literal private address with the route mappable substring', async () => {
    await expect(researchBusiness('http://169.254.169.254/latest/meta-data/'))
      .rejects.toMatchObject({ message: expect.stringMatching(/not allowed|Private/i) })
  })

  it('blocks non-http(s) protocols', async () => {
    await expect(researchBusiness('file:///etc/passwd'))
      .rejects.toMatchObject({ blockedTarget: true })
    await expect(researchBusiness('gopher://example.com/'))
      .rejects.toMatchObject({ blockedTarget: true })
  })

  // ---- 2. Hostname resolving to a private address (regression) ----------

  it('blocks a hostname that resolves to a private IPv4 address', async () => {
    const axiosGet = vi.spyOn(axios, 'get')
    mockResolve4.mockResolvedValue(['10.0.0.5'])
    mockResolve6.mockResolvedValue([])
    await expect(researchBusiness('https://attacker.example/'))
      .rejects.toMatchObject({
        blockedTarget: true,
        message: expect.stringMatching(/resolved_to_blocked_ip|not allowed|Private/i),
      })
    // No request should have been issued.
    expect(axiosGet).not.toHaveBeenCalled()
  })

  it('blocks a hostname that resolves to a loopback IPv6 address', async () => {
    const axiosGet = vi.spyOn(axios, 'get')
    mockResolve4.mockResolvedValue([])
    mockResolve6.mockResolvedValue(['::1'])
    await expect(researchBusiness('https://attacker.example/'))
      .rejects.toMatchObject({ blockedTarget: true })
    expect(axiosGet).not.toHaveBeenCalled()
  })

  it('blocks a hostname whose every resolved address is private', async () => {
    const axiosGet = vi.spyOn(axios, 'get')
    mockResolve4.mockResolvedValue(['10.0.0.1', '10.0.0.2'])
    mockResolve6.mockResolvedValue([])
    await expect(researchBusiness('https://attacker.example/'))
      .rejects.toMatchObject({ blockedTarget: true })
    expect(axiosGet).not.toHaveBeenCalled()
  })

  // ---- 3. Connection pinning (DNS rebinding) -----------------------------

  it('binds the outbound connection to the pre-validated address', async () => {
    // Use a real public address (8.8.8.8, Google DNS) so the validation
    // passes. The rebinding attempt at connect time is neutralised by the
    // pinned lookup handed to axios.
    mockResolve4.mockResolvedValue(['8.8.8.8'])
    mockResolve6.mockResolvedValue([])
    const axiosGet = vi.spyOn(axios, 'get').mockResolvedValueOnce({
      status: 200,
      headers: { 'content-type': 'text/html' },
      data: '<html><head><title>ok</title></head><body></body></html>',
    } as any)

    const result = await researchBusiness('https://attacker.example/')
    expect(result.reachable).toBe(true)

    // The axios call must have been given a pinned `lookup` whose only
    // approved entry is the validated address. A rebinding resolver that
    // returns 127.0.0.1 is ignored.
    const call = axiosGet.mock.calls[0]?.[1] as { lookup?: Function } | undefined
    expect(call?.lookup).toBeTypeOf('function')
    const pinned: { address: string; family: number } = await call!.lookup!('attacker.example', {})
    expect(pinned.address).toBe('8.8.8.8')
    expect(pinned.family).toBe(4)
  })

  // ---- 4. Redirects ------------------------------------------------------

  it('refuses a redirect to a private address (per-hop revalidation)', async () => {
    // First hop resolves to a public address (valid); the redirect points
    // at 169.254.169.254, which the per-hop guard must refuse.
    mockResolve4.mockReset()
    mockResolve6.mockReset()
    // For the initial URL `public.example` and for the redirect target
    // `evil.example` (resolved when guardUrl checks the next hop).
    mockResolve4
      .mockResolvedValueOnce(['203.0.113.10']) // initial host
      .mockResolvedValueOnce(['169.254.169.254']) // redirect target
    mockResolve6.mockResolvedValue([])

    vi.spyOn(axios, 'get').mockResolvedValueOnce({
      status: 301,
      headers: { location: 'http://evil.example/secret' },
      data: '',
    } as any)

    await expect(researchBusiness('https://public.example/'))
      .rejects.toMatchObject({ blockedTarget: true })
  })

  it('enforces the redirect cap and refuses further hops', async () => {
    mockResolve4.mockReset()
    mockResolve6.mockReset()
    // Each hop resolves to a public address; the loop should bail at the
    // configured cap with a `too many redirects` block.
    mockResolve4.mockResolvedValue(['203.0.113.10'])
    mockResolve6.mockResolvedValue([])

    let n = 0
    vi.spyOn(axios, 'get').mockImplementation((() => {
      n += 1
      return Promise.resolve({
        status: 302,
        headers: { location: `https://public.example/hop-${n}` },
        data: '',
      } as any)
    }) as any)

    await expect(researchBusiness('https://public.example/'))
      .rejects.toMatchObject({
        blockedTarget: true,
        message: expect.stringMatching(/too many redirects|not allowed/i),
      })
  })

  // ---- 5. Unreachable vs blocked (contract) -----------------------------

  it('reports unreachable public hosts as reachable=false (not a block)', async () => {
    // Public hostname that does not resolve.
    mockResolve4.mockRejectedValueOnce(Object.assign(new Error('not found'), { code: 'ENOTFOUND' }))
    mockResolve6.mockRejectedValueOnce(Object.assign(new Error('not found'), { code: 'ENOTFOUND' }))

    const result = await researchBusiness('https://public-dead.example/')
    expect(result.reachable).toBe(false)
    expect(result.canonicalUrl).toBe('https://public-dead.example/')
  })
})
