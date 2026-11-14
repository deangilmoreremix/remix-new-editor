/**
 * app/api/demo/download-image/route.ts: the public (no sign-in) image download
 * used by the free demo's on-device background removal.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from '../../../shims/next-server'

const quota = vi.hoisted(() => ({ consume: vi.fn() }))
const download = vi.hoisted(() => ({ fn: vi.fn() }))

vi.mock('../../../src/server/personalizationLog', () => ({
  logPersonalization: vi.fn(),
  createCorrelationId: vi.fn(() => 'cid'),
  sanitizeForLog: vi.fn((s: unknown) => s),
}))
vi.mock('../../../lib/rateLimit', () => ({
  resolveRateLimitKey: (_u?: string | null, ip?: string | null) => ip || 'anon',
}))
vi.mock('../../../src/server/demoRateLimit', () => {
  class DemoQuotaStoreError extends Error {
    readonly code = 'DEMO_QUOTA_STORE_UNAVAILABLE'
  }
  return { consumeDemoQuota: quota.consume, DemoQuotaStoreError }
})
vi.mock('../../../src/server/downloadImage', () => {
  class BlockedTargetError extends Error {}
  return { downloadImageAsDataUrl: download.fn, BlockedTargetError }
})

import { POST } from '../../../app/api/demo/download-image/route'
import { DemoQuotaStoreError } from '../../../src/server/demoRateLimit'
import { BlockedTargetError } from '../../../src/server/downloadImage'

function call(body: unknown, headers: Record<string, string> = {}) {
  return POST(
    new NextRequest('https://go.example.test/api/demo/download-image', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-forwarded-for': '203.0.113.9', ...headers },
      body: typeof body === 'string' ? body : JSON.stringify(body),
    }),
  )
}

beforeEach(() => {
  quota.consume.mockReset().mockResolvedValue({ allowed: true, remaining: 100, retryAfterMs: 0 })
  download.fn.mockReset().mockResolvedValue('data:image/png;base64,AAAA')
})

describe('POST /api/demo/download-image', () => {
  it('needs no sign-in and returns data URLs for public images', async () => {
    const res = await call({ urls: ['https://shop.example/logo.png'] })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      ok: true,
      results: [{ url: 'https://shop.example/logo.png', dataUrl: 'data:image/png;base64,AAAA', ok: true }],
    })
    expect(quota.consume).toHaveBeenCalledWith('img:203.0.113.9', expect.any(Object))
  })

  it('rejects a cross-site caller before doing anything', async () => {
    const res = await call({ urls: ['https://shop.example/a.png'] }, { 'sec-fetch-site': 'cross-site' })
    expect(res.status).toBe(403)
    expect(quota.consume).not.toHaveBeenCalled()
    expect(download.fn).not.toHaveBeenCalled()
  })

  it('rejects a foreign Origin', async () => {
    const res = await call({ urls: ['https://shop.example/a.png'] }, { origin: 'https://evil.example' })
    expect(res.status).toBe(403)
  })

  it('refuses private and metadata destinations without fetching', async () => {
    for (const url of ['http://127.0.0.1/a.png', 'http://169.254.169.254/latest', 'http://10.0.0.5/x.png', 'file:///etc/passwd']) {
      const res = await call({ urls: [url] })
      expect(res.status).toBe(400)
    }
    expect(download.fn).not.toHaveBeenCalled()
  })

  it('allows at most 5 URLs, strings only, and needs at least one', async () => {
    const six = Array.from({ length: 6 }, (_, i) => `https://shop.example/${i}.png`)
    expect((await call({ urls: six })).status).toBe(400)
    expect((await call({ urls: [42] })).status).toBe(400)
    expect((await call({ urls: [] })).status).toBe(400)
    expect((await call('not json')).status).toBe(400)
  })

  it('answers 429 with Retry-After when the shared quota is spent', async () => {
    quota.consume.mockResolvedValue({ allowed: false, remaining: 0, retryAfterMs: 90_000 })
    const res = await call({ urls: ['https://shop.example/a.png'] })
    expect(res.status).toBe(429)
    expect(res.headers.get('Retry-After')).toBe('90')
    expect(download.fn).not.toHaveBeenCalled()
  })

  it('fails closed (503) when the quota store cannot answer', async () => {
    quota.consume.mockRejectedValue(new DemoQuotaStoreError())
    const res = await call({ urls: ['https://shop.example/a.png'] })
    expect(res.status).toBe(503)
    expect(download.fn).not.toHaveBeenCalled()
  })

  it('reports a failed image per URL and a blocked redirect hop as 400', async () => {
    download.fn.mockRejectedValueOnce(new Error('Invalid content type: text/html'))
    const res = await call({ urls: ['https://shop.example/page'] })
    expect((await res.json()).results[0]).toMatchObject({ ok: false, error: 'Invalid content type: text/html' })

    download.fn.mockRejectedValueOnce(new BlockedTargetError('private hop'))
    expect((await call({ urls: ['https://shop.example/r'] })).status).toBe(400)
  })
})
