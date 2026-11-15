/**
 * SSRF regression tests for app/api/personalization/download-image/route.ts
 * and src/server/downloadImage.ts.
 *
 * The guard is the centralized `src/lib/networkSafety.ts` validator:
 *   - the route pre-flight (`assertSafeUrlString`) rejects literal private /
 *     loopback / link-local / metadata / CGNAT / ULA / unspecified /
 *     IPv4-mapped / alternate-encoding destinations before any fetch;
 *   - `downloadImageAsDataUrl` re-validates every hop with the async
 *     DNS-resolving `checkDestination` gate, pins the connection to the
 *     validated address (`safeRequestConfig`), and follows redirects
 *     manually so no hop is ever fetched unchecked.
 *
 * DNS is mocked (same idiom as researchProviderSsrf.test.ts) so the suite is
 * deterministic; axios is spied so no real request is ever issued.
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

vi.mock('../../../shims/clerk-server', () => ({
  auth: vi.fn(async () => ({ userId: 'user-123' })),
}))

// The route is now gated by requireApiEntitlement, which calls the
// Supabase-backed resolveSmartVideoAccessForUser. Stub it at the module
// boundary (the tests/proxy-routes.vitest.test.ts idiom) so the entitled path
// is exercised without a Supabase env; the entitlement-gate case below flips
// it to hasSmartVideoGo:false to assert the 403.
vi.mock('../../../tests/stubs/resolveAccess', () => ({
  resolveSmartVideoAccessForUser: vi.fn(async () => ({ hasSmartVideoGo: true })),
}))

vi.mock('../../../src/server/personalizationLog', () => ({
  logPersonalization: vi.fn(),
  createCorrelationId: vi.fn(() => 'test-correlation-id'),
  sanitizeForLog: vi.fn((s: unknown) => s),
}))

vi.mock('../../../src/server/envValidation', () => ({
  validatePersonalizationEnv: vi.fn(),
}))

// Hoisted entitlement mocks. vi.clearAllMocks() in beforeEach() would wipe
// `mockResolvedValue` set in a factory, so the mock is hoisted and the
// allow/deny return value is configured via the hoisted allow helper.
const entitlementMocks = vi.hoisted(() => ({
  allowed: true as boolean,
}))

vi.mock('../../../tests/stubs/apiRequireEntitlement', () => ({
  requireApiEntitlement: vi.fn(async () =>
    entitlementMocks.allowed ? { allowed: true } : { allowed: false, status: 403 }
  ),
  entitlementForbiddenResponse: vi.fn().mockReturnValue(
    new Response(JSON.stringify({ error: 'PAYMENT_REQUIRED' }), { status: 403 })
  ),
}))

// Real route + REAL downloadImage + REAL networkSafety: only DNS, axios,
// Clerk and the logging/env seams are mocked.
import { POST } from '../../../app/api/personalization/download-image/route'
import { downloadImageAsDataUrl } from '../../../src/server/downloadImage'
import { resolveSmartVideoAccessForUser } from '../../../tests/stubs/resolveAccess'
import { NextRequest } from '../../../shims/next-server'
import { validatePersonalizationEnv } from '../../../src/server/envValidation'
import axios from 'axios'

const PNG_BODY = Buffer.from('fake-png')

function imageResponse() {
  return {
    status: 200,
    headers: { 'content-type': 'image/png' },
    data: PNG_BODY,
  }
}

function redirectResponse(location: string) {
  return {
    status: 302,
    headers: { location },
    data: Buffer.alloc(0),
  }
}

async function post(urls: string[]) {
  const req = new NextRequest('http://localhost/api/personalization/download-image', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ urls }),
  })
  return await POST(req)
}

describe('download-image route SSRF regression', () => {
  let axiosGet: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    mockResolve4.mockReset()
    mockResolve6.mockReset()
    // Default: every hostname resolves to a public address.
    mockResolve4.mockResolvedValue(['93.184.216.34'])
    mockResolve6.mockResolvedValue([])
    // Default: every test in this file is a paid user. The free-user tests
    // flip entitlementMocks.allowed to false for the duration of one test.
    entitlementMocks.allowed = true
    vi.mocked(validatePersonalizationEnv).mockReturnValue({ valid: true } as any)
    // Default: entitled caller so the entitlement gate opens.
    vi.mocked(resolveSmartVideoAccessForUser).mockResolvedValue({ hasSmartVideoGo: true } as any)
    axiosGet = vi.spyOn(axios, 'get').mockReset()
    axiosGet.mockResolvedValue(imageResponse())
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  // -----------------------------------------------------------------------
  // No entitlement gate: download-image is free for the demo experience
  // -----------------------------------------------------------------------

  it('MUST NOT reject with PAYMENT_REQUIRED when authenticated but unentitled (free demo route)', async () => {
    vi.mocked(resolveSmartVideoAccessForUser).mockResolvedValue({ hasSmartVideoGo: false } as any)

    const res = await post(['https://example.com/image.png'])
    expect(res.status).not.toBe(403)
    expect(res.status).not.toBe(401)
    // Discovery/download machinery runs because there is no entitlement gate.
    expect(axiosGet).toHaveBeenCalled()
  })

  // -----------------------------------------------------------------------
  // MUST REJECT: literal private / metadata / loopback / alternate encodings
  // -----------------------------------------------------------------------

  it.each([
    ['loopback IPv4', 'http://127.0.0.1/secret.png'],
    ['cloud metadata IP', 'http://169.254.169.254/latest/meta-data/'],
    ['RFC1918 10/8', 'http://10.0.0.1/secret.png'],
    ['RFC1918 172.16/12', 'http://172.20.10.5/secret.png'],
    ['RFC1918 192.168/16', 'http://192.168.1.1/secret.png'],
    ['CGNAT 100.64/10', 'http://100.64.0.1/secret.png'],
    ['unspecified 0.0.0.0', 'http://0.0.0.0/secret.png'],
    ['IPv6 loopback', 'http://[::1]/secret.png'],
    ['IPv4-mapped loopback', 'http://[::ffff:127.0.0.1]/secret.png'],
    ['alternate encoding (decimal for 127.0.0.1)', 'http://2130706433/'],
    ['alternate encoding (hex for 127.0.0.1)', 'http://0x7f000001/'],
  ])('MUST REJECT %s with 400 and never fetch', async (_label, url) => {
    const res = await post([url])
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/not allowed/)
    // No request may be issued to a blocked destination.
    expect(axiosGet).not.toHaveBeenCalled()
  })

  it('MUST REJECT a non-HTTP(S) protocol (sanitizeUrl) before any fetch', async () => {
    // The route's protocol allowlist rejects this before the SSRF pre-flight;
    // either way the answer is a 400 with no network request.
    const res = await post(['file:///etc/passwd'])
    expect(res.status).toBe(400)
    expect(axiosGet).not.toHaveBeenCalled()
  })

  it('MUST REJECT internal hostnames before any DNS lookup', async () => {
    const res = await post(['http://metadata.google.internal/latest/meta-data/'])
    expect(res.status).toBe(400)
    expect(mockResolve4).not.toHaveBeenCalled()
    expect(axiosGet).not.toHaveBeenCalled()
  })

  it('MUST REJECT a hostname that resolves to a private address (DNS rebinding)', async () => {
    mockResolve4.mockResolvedValue(['10.0.0.5'])

    const res = await post(['https://sneaky.example.com/image.png'])

    expect(res.status).toBe(400)
    expect(axiosGet).not.toHaveBeenCalled()
  })

  // -----------------------------------------------------------------------
  // Mixed arrays: one bad URL must fail the whole request
  // -----------------------------------------------------------------------

  it('MUST REJECT mixed array if any URL is private', async () => {
    const res = await post([
      'https://example.com/image.png',
      'http://10.0.0.1/secret.png',
    ])
    expect(res.status).toBe(400)
    expect(axiosGet).not.toHaveBeenCalled()
  })

  // -----------------------------------------------------------------------
  // MUST PERMIT: valid public URLs
  // -----------------------------------------------------------------------

  it('MUST PERMIT a valid public HTTPS URL', async () => {
    const res = await post(['https://example.com/image.png'])
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.ok).toBe(true)
    expect(body.results[0].ok).toBe(true)
    expect(body.results[0].dataUrl).toBe('data:image/png;base64,ZmFrZS1wbmc=')
    expect(axiosGet).toHaveBeenCalledTimes(1)
  })

  // -----------------------------------------------------------------------
  // Redirects: every hop is re-validated
  // -----------------------------------------------------------------------

  it('follows a safe redirect and returns the data URL', async () => {
    axiosGet
      .mockResolvedValueOnce(redirectResponse('http://cdn.example.com/image.png'))
      .mockResolvedValueOnce(imageResponse())

    const res = await post(['https://example.com/redirect.png'])
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.results[0].ok).toBe(true)
    expect(body.results[0].dataUrl).toBe('data:image/png;base64,ZmFrZS1wbmc=')
    expect(axiosGet).toHaveBeenCalledTimes(2)
  })

  it('MUST REJECT a redirect to a private IP: the second hop is never fetched', async () => {
    axiosGet.mockResolvedValueOnce(redirectResponse('http://127.0.0.1/secret.png'))

    const res = await post(['https://example.com/redirect.png'])

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/not allowed/)
    // Only the first (public) hop was requested.
    expect(axiosGet).toHaveBeenCalledTimes(1)
  })

  it('rejects too many redirects (bounded loop)', async () => {
    axiosGet.mockImplementation(async () => redirectResponse('http://cdn.example.com/next.png'))

    const res = await post(['https://example.com/loop.png'])

    expect(res.status).toBe(400)
    expect(axiosGet).toHaveBeenCalledTimes(6)
  })

  // -----------------------------------------------------------------------
  // Unreachable (not blocked): a dead public host is a per-image failure
  // -----------------------------------------------------------------------

  it('reports an unresolvable public host as a per-result ok:false, not a block', async () => {
    const notFound = Object.assign(new Error('getaddrinfo ENOTFOUND dead.example.com'), {
      code: 'ENOTFOUND',
    })
    mockResolve4.mockRejectedValue(notFound)
    mockResolve6.mockRejectedValue(notFound)

    const res = await post(['https://dead.example.com/image.png'])

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.ok).toBe(true)
    expect(body.results[0].ok).toBe(false)
    expect(body.results[0].error).toMatch(/Unreachable/)
    expect(axiosGet).not.toHaveBeenCalled()
  })
})

describe('downloadImageAsDataUrl guards', () => {
  let axiosGet: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    mockResolve4.mockReset()
    mockResolve6.mockReset()
    mockResolve4.mockResolvedValue(['93.184.216.34'])
    mockResolve6.mockResolvedValue([])
    axiosGet = vi.spyOn(axios, 'get').mockReset()
    // Restore the entitled-caller default in case a prior test flipped it.
    vi.mocked(resolveSmartVideoAccessForUser).mockResolvedValue({ hasSmartVideoGo: true } as any)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('rejects a metadata-IP target before any request', async () => {
    await expect(
      downloadImageAsDataUrl('http://169.254.169.254/latest/meta-data/'),
    ).rejects.toThrow(/not allowed/)
    expect(axiosGet).not.toHaveBeenCalled()
  })

  it('returns a data URL for a public image', async () => {
    axiosGet.mockResolvedValue(imageResponse())
    const dataUrl = await downloadImageAsDataUrl('https://example.com/image.png')
    expect(dataUrl).toBe('data:image/png;base64,ZmFrZS1wbmc=')
  })

  it('caps the body while it streams in (maxContentLength) and maps the abort to a friendly size error', async () => {
    axiosGet.mockResolvedValue(imageResponse())
    await downloadImageAsDataUrl('https://example.com/image.png', 1024)
    expect(axiosGet.mock.calls[0][1]).toMatchObject({ maxContentLength: 1024, maxBodyLength: 1024 })

    axiosGet.mockRejectedValue(new Error('maxContentLength size of 1024 exceeded'))
    await expect(downloadImageAsDataUrl('https://example.com/huge.png', 1024)).rejects.toThrow(/larger than/)
  })

  it('rejects a non-image content type', async () => {
    axiosGet.mockResolvedValue({
      status: 200,
      headers: { 'content-type': 'text/html' },
      data: Buffer.from('<html></html>'),
    })
    await expect(
      downloadImageAsDataUrl('https://example.com/page.html'),
    ).rejects.toThrow(/Invalid content type/)
  })
})
