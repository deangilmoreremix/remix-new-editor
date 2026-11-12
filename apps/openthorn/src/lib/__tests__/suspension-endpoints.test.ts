import { beforeEach, describe, expect, it, vi } from 'vitest'

// A builder suspension must stop a session that already exists: the real endpoint
// handlers must answer 401 for a valid Supabase token whose wb_profiles row is suspended.
const fetchMock = vi.fn()
vi.stubGlobal('fetch', fetchMock)
const USER_ID = '11111111-1111-4111-8111-111111111111'
const ok = (body: unknown) => ({ ok: true, status: 200, json: async () => body, text: async () => JSON.stringify(body) })

function res() {
  const r: { code?: number; body?: unknown; status: (n: number) => typeof r; json: (b: unknown) => void; setHeader: () => void; end: () => void } = {
    status(n) { r.code = n; return r }, json(b) { r.body = b }, setHeader() {}, end() {},
  }
  return r
}

describe('suspended sessions are refused by the builder endpoints', () => {
  beforeEach(() => {
    vi.resetModules(); fetchMock.mockReset()
    process.env.SUPABASE_URL = 'https://t.supabase.co'; process.env.SUPABASE_ANON_KEY = 'anon'; process.env.SUPABASE_SERVICE_ROLE_KEY = 'svc'
    process.env.KEY_ENCRYPTION_SECRET = Buffer.alloc(48, 7).toString('base64')
  })
  const route = (url: string, suspended: boolean) => {
    fetchMock.mockImplementation(async (u: string) =>
      String(u).includes('/auth/v1/user') ? ok({ id: USER_ID }) : String(u).includes('select=suspended') ? ok([{ suspended }]) : ok([]))
  }
  for (const name of ['deploy', 'provider-keys']) {
    it(`${name}: 401 when suspended`, async () => {
      route(name, true)
      const handler = (await import(`../../../api/${name}`)).default
      const r = res()
      await handler({ method: 'POST', headers: { authorization: 'Bearer t' }, body: { projectId: 'p', html: '<p/>' }, url: '/', query: {} }, r)
      expect(r.code).toBe(401)
    })
    it(`${name}: not 401 for a normal session`, async () => {
      route(name, false)
      const handler = (await import(`../../../api/${name}`)).default
      const r = res()
      await handler({ method: 'POST', headers: { authorization: 'Bearer t' }, body: { projectId: 'p', html: '<p/>' }, url: '/', query: {} }, r)
      expect(r.code).not.toBe(401)
    })
  }
})
