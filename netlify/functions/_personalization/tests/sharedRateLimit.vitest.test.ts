// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from '../shims/next-server'

beforeEach(() => vi.resetModules())

const reply = (over: Record<string, unknown> = {}) => ({ data: { allowed: true, count: 3, limit: 10, reset_at: new Date(Date.now() + 90_000).toISOString(), ...over }, error: null })

describe('rateLimitShared', () => {
  it('counts in the database with the scope, key, limit and window', async () => {
    const { rateLimitShared } = await import('../lib/rateLimit')
    const rpc = vi.fn(async () => reply())
    const r = await rateLimitShared({ rpc }, 'motion-studio-capture', 'user-1', { windowMs: 600_000, max: 10 })
    expect(rpc).toHaveBeenCalledWith('rate_limit_check', { p_scope: 'motion-studio-capture', p_key: 'user-1', p_limit: 10, p_window_seconds: 600 })
    expect(r).toMatchObject({ allowed: true, remaining: 7, retryAfterMs: 0, source: 'database' })
  })
  it('refuses when the database says the limit is exceeded and reports when to retry', async () => {
    const { rateLimitShared } = await import('../lib/rateLimit')
    const r = await rateLimitShared({ rpc: async () => reply({ allowed: false, count: 11 }) }, 's', 'k', { windowMs: 600_000, max: 10 })
    expect(r.allowed).toBe(false)
    expect(r.remaining).toBe(0)
    expect(r.retryAfterMs).toBeGreaterThan(60_000)
    expect(r.retryAfterMs).toBeLessThanOrEqual(90_000)
    expect(r.source).toBe('database')
  })
  it('is shared: two separate callers of the same user see ONE count (unlike the per-process limiter)', async () => {
    const { rateLimitShared } = await import('../lib/rateLimit')
    let count = 0
    const rpc = async () => { count += 1; return reply({ allowed: count <= 2, count }) }
    const a = { rpc } // "instance A"
    const b = { rpc } // "instance B" — same database
    const results = [await rateLimitShared(a, 's', 'u', { windowMs: 60_000, max: 2 }), await rateLimitShared(b, 's', 'u', { windowMs: 60_000, max: 2 }), await rateLimitShared(a, 's', 'u', { windowMs: 60_000, max: 2 })]
    expect(results.map((r) => r.allowed)).toEqual([true, true, false])
  })
  it.each([
    ['an RPC error', async () => ({ data: null, error: { message: 'boom' } })],
    ['a thrown exception', async () => { throw new Error('network') }],
    ['a malformed reply', async () => ({ data: { allowed: 'yes' }, error: null })],
    ['an empty reply', async () => ({ data: null, error: null })],
  ])('falls back to the in-process limiter on %s — and still enforces a limit (never fails open)', async (_label, rpc) => {
    const { rateLimitShared } = await import('../lib/rateLimit')
    const out = []
    for (let i = 0; i < 4; i++) out.push(await rateLimitShared({ rpc } as never, 'fallback-scope', 'u', { windowMs: 60_000, max: 3 }))
    expect(out.map((r) => r.allowed)).toEqual([true, true, true, false])
    expect(out.every((r) => r.source === 'memory')).toBe(true)
  })
  it('falls back to memory when there is no client at all, with separate buckets per scope and key', async () => {
    const { rateLimitShared } = await import('../lib/rateLimit')
    for (let i = 0; i < 2; i++) await rateLimitShared(null, 'a', 'u', { windowMs: 60_000, max: 2 })
    expect((await rateLimitShared(null, 'a', 'u', { windowMs: 60_000, max: 2 })).allowed).toBe(false)
    expect((await rateLimitShared(null, 'a', 'other-user', { windowMs: 60_000, max: 2 })).allowed).toBe(true)
    expect((await rateLimitShared(null, 'b', 'u', { windowMs: 60_000, max: 2 })).allowed).toBe(true)
  })
})

describe('capture route quota', () => {
  const setup = async (rpcResult: unknown) => {
    const capture = vi.fn(async () => { throw new Error('a browser must NOT be launched when the user is over quota') })
    vi.doMock('../app/api/motion-studio/lib/auth', () => ({ requireMotionStudioUser: vi.fn(async () => ({ ok: true, userId: 'user-9', bypass: false })) }))
    vi.doMock('../src/lib/supabase', () => ({ createServerClient: vi.fn(() => ({ rpc: vi.fn(async () => rpcResult) })) }))
    vi.doMock('../src/server/browserDiscovery', async (orig) => ({ ...(await orig<object>()), capturePageScreenshots: capture }))
    const { POST } = await import('../app/api/motion-studio/capture/route')
    return { POST, capture }
  }
  const req = () => new NextRequest('http://localhost/api/motion-studio/capture', { method: 'POST', body: JSON.stringify({ url: 'https://acme.example' }), headers: { 'content-type': 'application/json' } })

  it('answers 429 with Retry-After from the shared count, before launching a browser', async () => {
    const { POST, capture } = await setup(reply({ allowed: false, count: 11 }))
    const res = await POST(req())
    expect(res.status).toBe(429)
    expect(Number(res.headers.get('Retry-After'))).toBeGreaterThan(0)
    expect(capture).not.toHaveBeenCalled()
  })
})
