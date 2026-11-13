/**
 * Unit tests for app/api/personalization/resolve-website/route.ts.
 *
 * Offline: the resolver module the route dynamic-imports is mocked at the
 * module boundary, and '../../../lib/rateLimit' is stubbed (it lives in the repo-root
 * lib/ directory, which the vitest alias does not resolve — same idiom as
 * researchBusinessRoute.test.ts).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from '../../../shims/next-server'

vi.mock('../../../src/server/personalizationLog', () => ({
  logPersonalization: vi.fn(),
  createCorrelationId: vi.fn(() => 'cid-test'),
  sanitizeForLog: vi.fn((s: unknown) => s),
}))

const mocks = vi.hoisted(() => ({
  resolveBusinessWebsite: vi.fn(),
  rateLimit: vi.fn(() => ({ allowed: true, retryAfterMs: 60_000 })),
}))

vi.mock('../../../src/server/businessDiscovery/websiteResolver', () => ({
  resolveBusinessWebsite: mocks.resolveBusinessWebsite,
}))

vi.mock('../../../lib/rateLimit', () => ({
  resolveRateLimitKey: (userId?: string | null, clientIp?: string | null) => userId || clientIp || 'anon',
  rateLimit: mocks.rateLimit,
  rateLimit429: vi.fn(() => new Response('rate limited', { status: 429 })),
}))

import { POST } from '../../../app/api/personalization/resolve-website/route'

function request(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/personalization/resolve-website', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-real-ip': '203.0.113.7' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/personalization/resolve-website', () => {
  beforeEach(() => {
    mocks.resolveBusinessWebsite.mockReset()
    mocks.rateLimit.mockClear()
    mocks.rateLimit.mockReturnValue({ allowed: true, retryAfterMs: 60_000 })
  })

  it('returns the verified website', async () => {
    mocks.resolveBusinessWebsite.mockResolvedValue({
      website: 'https://joespizza.com',
      confidence: 'high',
      evidence: ['phone number found on page'],
    })
    const res = await POST(request({ name: "Joe's Pizza", city: 'Austin', phone: '512-555-0199' }))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      ok: true,
      website: 'https://joespizza.com',
      confidence: 'high',
      evidence: ['phone number found on page'],
    })
    expect(mocks.resolveBusinessWebsite).toHaveBeenCalledWith({
      name: "Joe's Pizza",
      city: 'Austin',
      region: undefined,
      postalCode: undefined,
      phone: '512-555-0199',
      email: undefined,
    })
  })

  it('answers website: null (200) when nothing verifies', async () => {
    mocks.resolveBusinessWebsite.mockResolvedValue(null)
    const res = await POST(request({ name: "Joe's Pizza" }))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true, website: null })
  })

  it('requires a business name', async () => {
    const res = await POST(request({ city: 'Austin' }))
    expect(res.status).toBe(400)
    expect(mocks.resolveBusinessWebsite).not.toHaveBeenCalled()
  })

  it('caps over-long fields and ignores non-string values', async () => {
    mocks.resolveBusinessWebsite.mockResolvedValue(null)
    await POST(request({ name: 'x'.repeat(500), phone: 12345 }))
    const arg = mocks.resolveBusinessWebsite.mock.calls[0][0]
    expect(arg.name.length).toBe(200)
    expect(arg.phone).toBeUndefined()
  })

  it('is rate limited per client IP', async () => {
    mocks.rateLimit.mockReturnValue({ allowed: false, retryAfterMs: 1000 })
    const res = await POST(request({ name: "Joe's Pizza" }))
    expect(res.status).toBe(429)
    expect(mocks.rateLimit).toHaveBeenCalledWith('resolve-website:203.0.113.7', expect.objectContaining({ max: 10 }))
  })

  it('hides internals on an unexpected failure', async () => {
    mocks.resolveBusinessWebsite.mockRejectedValue(new Error('boom: internal detail'))
    const res = await POST(request({ name: "Joe's Pizza" }))
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(JSON.stringify(body)).not.toContain('internal detail')
  })
})
