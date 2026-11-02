// @vitest-environment node
/**
 * Dispatcher + auth shim for netlify/functions/personalization-api.mts, the
 * Netlify home of the OpenHiggsBolt personalization / lead-finder routes.
 */
import { describe, it, expect, vi } from 'vitest'

vi.mock('../_shared/clerkAuth.js', () => ({
  verifyClerkToken: vi.fn(async (token) => (token === 'good-token' ? { userId: 'user_123', claims: { sid: 'sess_1' } } : null)),
}))

const { default: handler } = await import('../personalization-api.mts')
const { auth } = await import('../_personalization/shims/clerk-server')
const { requestContext } = await import('../_personalization/shims/requestContext')

const call = (method, path, init = {}) =>
  handler(new Request(`http://localhost${path}`, { method, ...init }), { waitUntil() {} })

describe('personalization-api dispatcher', () => {
  it('returns 404 for unknown routes', async () => {
    const res = await call('GET', '/api/personalization/nope')
    expect(res.status).toBe(404)
  })

  it('returns 405 with Allow for a known route and wrong method', async () => {
    const res = await call('POST', '/api/personalization/leads/abc')
    expect(res.status).toBe(405)
    expect(res.headers.get('allow')).toBe('PATCH, DELETE')
  })

  it('acknowledges /api/video/record', async () => {
    const res = await call('POST', '/api/video/record', { body: '{}' })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true, recorded: false })
  })

  it('validates find-businesses input before any network call', async () => {
    const res = await call('POST', '/api/personalization/find-businesses', {
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ niche: 'not-a-niche', location: 'Austin, TX' }),
    })
    expect(res.status).toBe(400)
  })
})

describe('Clerk auth() shim', () => {
  const withRequest = (headers, fn) =>
    requestContext.run({ request: new Request('http://localhost/x', { headers }) }, fn)

  it('resolves the user from a verified bearer token', async () => {
    const result = await withRequest({ authorization: 'Bearer good-token' }, () => auth())
    expect(result).toEqual({ userId: 'user_123', sessionId: 'sess_1' })
  })

  it('accepts the __session cookie', async () => {
    const result = await withRequest({ cookie: 'a=b; __session=good-token' }, () => auth())
    expect(result.userId).toBe('user_123')
  })

  it('treats a missing or invalid token as signed out', async () => {
    expect((await withRequest({}, () => auth())).userId).toBeNull()
    expect((await withRequest({ authorization: 'Bearer bad' }, () => auth())).userId).toBeNull()
  })
})

describe('/api/proxy/openai-enhance', () => {
  it('requires a signed-in user', async () => {
    const res = await call('POST', '/api/proxy/openai-enhance', {
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ prompt: 'a dentist promo' }),
    })
    expect(res.status).toBe(401)
  })

  it('accepts chat messages and returns the completion text', async () => {
    const realFetch = globalThis.fetch
    const upstream = vi.fn(async (_url, init) => {
      const sent = JSON.parse(init.body)
      expect(sent.messages).toEqual([{ role: 'user', content: 'hi' }])
      expect(init.headers.Authorization).toBe('Bearer sk-user-key-1234567890')
      return new Response(JSON.stringify({ choices: [{ message: { content: ' personalized ' } }] }), { status: 200 })
    })
    globalThis.fetch = upstream
    try {
      const res = await call('POST', '/api/proxy/openai-enhance', {
        headers: {
          'content-type': 'application/json',
          authorization: 'Bearer good-token',
          'x-openai-key': 'sk-user-key-1234567890',
        },
        body: JSON.stringify({ mode: 'chat', messages: [{ role: 'user', content: 'hi' }] }),
      })
      expect(res.status).toBe(200)
      expect((await res.json()).text).toBe('personalized')
      expect(upstream).toHaveBeenCalledTimes(1)
    } finally {
      globalThis.fetch = realFetch
    }
  })

  it('rejects malformed chat messages', async () => {
    const res = await call('POST', '/api/proxy/openai-enhance', {
      headers: { 'content-type': 'application/json', authorization: 'Bearer good-token', 'x-openai-key': 'sk-user-key-1234567890' },
      body: JSON.stringify({ mode: 'chat', messages: [{ role: 'tool', content: 1 }] }),
    })
    expect(res.status).toBe(400)
  })
})

describe('client IP normalisation', () => {
  it("replaces caller-supplied forwarding headers with Netlify's connection IP", async () => {
    const { withTrustedClientIp } = await import('../personalization-api.mts')
    const req = withTrustedClientIp(
      new Request('http://localhost/api/personalization/leads', {
        method: 'POST',
        headers: { 'x-forwarded-for': '6.6.6.6, 10.0.0.1', 'x-real-ip': '6.6.6.6', 'x-nf-client-connection-ip': '203.0.113.7' },
        body: '{"a":1}',
      }),
    )
    expect(req.headers.get('x-forwarded-for')).toBe('203.0.113.7')
    expect(req.headers.get('x-real-ip')).toBe('203.0.113.7')
    expect(await req.text()).toBe('{"a":1}')
  })

  it('leaves the request untouched off Netlify', async () => {
    const { withTrustedClientIp } = await import('../personalization-api.mts')
    const original = new Request('http://localhost/x', { headers: { 'x-forwarded-for': '1.2.3.4' } })
    expect(withTrustedClientIp(original)).toBe(original)
  })
})
