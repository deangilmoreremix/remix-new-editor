import { beforeEach, describe, expect, it, vi } from 'vitest'

const fetchMock = vi.fn()
vi.stubGlobal('fetch', fetchMock)

const USER = '11111111-1111-4111-8111-111111111111'
const ACCOUNT = 'a'.repeat(32)
const TOKEN = 'cf-secret-token-0123456789abcdef-WXYZ'

function jsonResponse(body: unknown, ok = true, status = 200) {
  return { ok, status, json: async () => body, text: async () => JSON.stringify(body) }
}
function makeRes() {
  const res = {
    statusCode: 0,
    body: undefined as unknown,
    status(code: number) { res.statusCode = code; return res },
    json(body: unknown) { res.body = body },
  }
  return res
}
const req = (method: string, body?: unknown) => ({ method, headers: { authorization: 'Bearer t' }, body })

/** In-memory stand-in for Supabase auth + the wb_cloudflare_credentials table + Cloudflare. */
function stub(opts: { cf?: 'ok' | 'unauthorized' | 'badaccount' } = {}) {
  let row: { user_id: string; account_id: string; token_enc: string; token_last4: string } | null = null
  const calls: Array<{ url: string; init?: RequestInit }> = []
  fetchMock.mockImplementation(async (url: unknown, init?: RequestInit) => {
    const u = String(url)
    calls.push({ url: u, init })
    if (u.includes('/auth/v1/user')) return jsonResponse({ id: USER, email: 'a@b.dev' })
    if (u.startsWith('https://api.cloudflare.com/')) {
      const mode = opts.cf ?? 'ok'
      if (mode === 'ok') return jsonResponse({ success: true, result: [] })
      return jsonResponse({ success: false }, false, mode === 'unauthorized' ? 403 : 404)
    }
    if (u.includes('/rest/v1/wb_cloudflare_credentials')) {
      const method = init?.method || 'GET'
      if (method === 'POST') { row = JSON.parse(String(init?.body)); return jsonResponse({}) }
      if (method === 'DELETE') { row = null; return jsonResponse({}) }
      return jsonResponse(row ? [row] : [])
    }
    return jsonResponse({ error: 'unexpected ' + u }, false, 404)
  })
  return { calls, getRow: () => row }
}

describe('api/cloudflare', () => {
  beforeEach(() => {
    vi.resetModules()
    fetchMock.mockReset()
    process.env.SUPABASE_URL = 'https://test.supabase.co'
    process.env.SUPABASE_ANON_KEY = 'anon'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service'
    process.env.KEY_ENCRYPTION_SECRET = 'x'.repeat(48)
  })

  it('401 without a session', async () => {
    fetchMock.mockResolvedValue(jsonResponse({}, false, 401))
    const { default: handler } = await import('../../../api/cloudflare')
    const res = makeRes()
    await handler(req('GET'), res)
    expect(res.statusCode).toBe(401)
  })

  it('GET reports not connected, then connected after POST, never returning the token', async () => {
    const db = stub()
    const { default: handler } = await import('../../../api/cloudflare')

    let res = makeRes()
    await handler(req('GET'), res)
    expect(res.body).toEqual({ configured: true, connected: false, accountId: null, tokenLast4: null })

    res = makeRes()
    await handler(req('POST', { accountId: ACCOUNT, token: TOKEN }), res)
    expect(res.statusCode).toBe(200)
    expect(res.body).toEqual({ configured: true, connected: true, accountId: ACCOUNT, tokenLast4: 'WXYZ' })
    expect(JSON.stringify(res.body)).not.toContain(TOKEN)

    // Encrypted at rest: the stored value is ciphertext, and it decrypts back with the user's key.
    const stored = db.getRow()!
    expect(stored.token_enc).not.toContain(TOKEN)
    expect(stored.token_enc.startsWith('senc:')).toBe(true)
    const { decryptForUser } = await import('../../../api/_shared')
    expect(decryptForUser(stored.token_enc, USER)).toBe(TOKEN)

    res = makeRes()
    await handler(req('GET'), res)
    expect(JSON.stringify(res.body)).not.toContain(TOKEN)
  })

  it('validates against the saved account on Cloudflare before storing', async () => {
    const db = stub()
    const { default: handler } = await import('../../../api/cloudflare')
    await handler(req('POST', { accountId: ACCOUNT, token: TOKEN }), makeRes())
    const cf = db.calls.find((c) => c.url.startsWith('https://api.cloudflare.com/'))!
    expect(cf.url).toBe(`https://api.cloudflare.com/client/v4/accounts/${ACCOUNT}/pages/projects?per_page=1`)
    expect((cf.init!.headers as Record<string, string>).Authorization).toBe(`Bearer ${TOKEN}`)
  })

  it('rejects a bad token and a wrong account without storing anything', async () => {
    for (const mode of ['unauthorized', 'badaccount'] as const) {
      const db = stub({ cf: mode })
      vi.resetModules()
      const { default: handler } = await import('../../../api/cloudflare')
      const res = makeRes()
      await handler(req('POST', { accountId: ACCOUNT, token: TOKEN }), res)
      expect(res.statusCode).toBe(400)
      expect((res.body as { error: string }).error).toBe('cloudflare_rejected')
      expect(db.getRow()).toBeNull()
    }
  })

  it('400 for malformed input without calling Cloudflare', async () => {
    const db = stub()
    const { default: handler } = await import('../../../api/cloudflare')
    for (const body of [{}, { accountId: 'short', token: TOKEN }, { accountId: ACCOUNT, token: 'tiny' }, { accountId: ACCOUNT, token: 'has space in it 0123456789' }]) {
      const res = makeRes()
      await handler(req('POST', body), res)
      expect(res.statusCode).toBe(400)
    }
    expect(db.calls.some((c) => c.url.startsWith('https://api.cloudflare.com/'))).toBe(false)
  })

  it('DELETE disconnects', async () => {
    const db = stub()
    const { default: handler } = await import('../../../api/cloudflare')
    await handler(req('POST', { accountId: ACCOUNT, token: TOKEN }), makeRes())
    const res = makeRes()
    await handler(req('DELETE'), res)
    expect(res.body).toMatchObject({ connected: false })
    expect(db.getRow()).toBeNull()
  })

  it('503 on write and configured:false on read when server secrets are missing', async () => {
    stub()
    delete process.env.KEY_ENCRYPTION_SECRET
    const { default: handler } = await import('../../../api/cloudflare')
    let res = makeRes()
    await handler(req('GET'), res)
    expect(res.body).toMatchObject({ configured: false, connected: false })
    res = makeRes()
    await handler(req('POST', { accountId: ACCOUNT, token: TOKEN }), res)
    expect(res.statusCode).toBe(503)
  })
})

describe('api/deploy uses the caller\'s own Cloudflare account', () => {
  beforeEach(() => {
    vi.resetModules()
    fetchMock.mockReset()
    process.env.SUPABASE_URL = 'https://test.supabase.co'
    process.env.SUPABASE_ANON_KEY = 'anon'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service'
    process.env.KEY_ENCRYPTION_SECRET = 'x'.repeat(48)
    process.env.CLOUDFLARE_API_TOKEN = 'platform-token-must-never-be-used'
    process.env.CLOUDFLARE_ACCOUNT_ID = 'b'.repeat(32)
  })

  const deployReq = { method: 'POST', headers: { authorization: 'Bearer t' }, body: { projectId: 'proj1', html: '<p>hi</p>' } }

  it('409 cloudflare_not_connected when nothing is saved (and the platform env token is ignored)', async () => {
    fetchMock.mockImplementation(async (url: unknown) => {
      const u = String(url)
      if (u.includes('/auth/v1/user')) return jsonResponse({ id: USER })
      if (u.includes('/rest/v1/wb_projects')) return jsonResponse([{ cf_pages_project_name: null, title: 'T' }])
      if (u.includes('/rest/v1/wb_cloudflare_credentials')) return jsonResponse([])
      return jsonResponse({}, false, 500)
    })
    const { default: handler } = await import('../../../api/deploy')
    const res = makeRes()
    await handler(deployReq as never, res as never)
    expect(res.statusCode).toBe(409)
    expect((res.body as { error: string }).error).toBe('cloudflare_not_connected')
    expect(fetchMock.mock.calls.some(([u]) => String(u).startsWith('https://api.cloudflare.com/'))).toBe(false)
  })

  it('403 for someone else\'s project, before touching credentials', async () => {
    fetchMock.mockImplementation(async (url: unknown) => {
      const u = String(url)
      if (u.includes('/auth/v1/user')) return jsonResponse({ id: USER })
      if (u.includes('/rest/v1/wb_projects')) return jsonResponse([])
      return jsonResponse({}, false, 500)
    })
    const { default: handler } = await import('../../../api/deploy')
    const res = makeRes()
    await handler(deployReq as never, res as never)
    expect(res.statusCode).toBe(403)
    expect(fetchMock.mock.calls.some(([u]) => String(u).includes('wb_cloudflare_credentials'))).toBe(false)
  })

  it('deploys with the user\'s decrypted token, not the environment\'s', async () => {
    const { encryptForUser } = await import('../../../api/_shared')
    const enc = encryptForUser(TOKEN, USER)
    fetchMock.mockImplementation(async (url: unknown) => {
      const u = String(url)
      if (u.includes('/auth/v1/user')) return jsonResponse({ id: USER })
      if (u.includes('/rest/v1/wb_projects')) return jsonResponse([{ cf_pages_project_name: 'my-site', title: 'T' }])
      if (u.includes('/rest/v1/wb_cloudflare_credentials')) return jsonResponse([{ account_id: ACCOUNT, token_enc: enc }])
      // Fail the first Cloudflare call: enough to see whose credentials the deploy used.
      if (u.startsWith('https://api.cloudflare.com/')) return jsonResponse({ success: false, errors: [{ message: 'stop' }] }, false, 400)
      return jsonResponse({}, false, 500)
    })
    const { default: handler } = await import('../../../api/deploy')
    const res = makeRes()
    await handler(deployReq as never, res as never)
    expect(res.statusCode).toBe(500)
    const cfCalls = fetchMock.mock.calls.filter(([u]) => String(u).startsWith('https://api.cloudflare.com/'))
    expect(cfCalls.length).toBeGreaterThan(0)
    for (const [u, init] of cfCalls) {
      expect(String(u)).toContain(`/accounts/${ACCOUNT}/`)
      const h = (init?.headers ?? {}) as Record<string, string>
      expect(h.Authorization).toBe(`Bearer ${TOKEN}`)
    }
  })
})
