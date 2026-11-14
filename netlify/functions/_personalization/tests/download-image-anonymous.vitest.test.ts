// @vitest-environment node
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { NextRequest } from '../shims/next-server'

// The route needs a configured server; the auth shim reports "signed out".
beforeEach(() => {
  vi.resetModules()
  vi.doMock('../src/server/envValidation', () => ({ validatePersonalizationEnv: () => ({ valid: true, missingRequired: [] }) }))
  vi.doMock('../shims/clerk-server', () => ({ auth: async () => ({ userId: null }) }))
})

const call = async (body: unknown, ip = '203.0.113.5') => {
  const { POST } = await import('../app/api/personalization/download-image/route')
  return POST(new NextRequest('https://app.test/api/personalization/download-image', {
    method: 'POST', headers: { 'content-type': 'application/json', 'x-forwarded-for': ip }, body: JSON.stringify(body),
  }))
}

describe('download-image is open to signed-out demo visitors, and stays safe', () => {
  it('does not ask a signed-out visitor to sign in (a bad request is a 400, not a 401)', async () => {
    expect((await call({})).status).toBe(400)
  })

  it('refuses private, metadata and loopback targets before fetching anything', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    for (const url of ['http://169.254.169.254/latest/meta-data', 'http://127.0.0.1/a.png', 'http://localhost/a.png', 'http://10.0.0.5/a.png']) {
      expect((await call({ urls: [url] })).status, url).toBe(400)
    }
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('caps the batch at 20 URLs', async () => {
    expect((await call({ urls: Array.from({ length: 21 }, (_, i) => `https://example.com/${i}.png`) })).status).toBe(400)
  })

  it('rate limits per network address (30 per minute), not one shared anonymous bucket', async () => {
    const codes: number[] = []
    for (let i = 0; i < 31; i++) codes.push((await call({}, '198.51.100.20')).status)
    expect(codes.slice(0, 30).every((c) => c === 400)).toBe(true)
    expect(codes[30]).toBe(429)
    expect((await call({}, '198.51.100.21')).status).toBe(400)
  })
})
