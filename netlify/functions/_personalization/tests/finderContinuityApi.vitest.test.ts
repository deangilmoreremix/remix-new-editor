import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from '../shims/next-server'

let authUserId: string | null = 'user-123'
let rpcResult: { data: unknown; error: { code?: string; message: string } | null } = { data: [], error: null }
const rpcCalls: Array<{ fn: string; args: Record<string, unknown> | undefined }> = []

beforeEach(() => {
  vi.resetModules()
  authUserId = 'user-123'
  rpcResult = { data: [], error: null }
  rpcCalls.length = 0
  vi.doMock('../shims/clerk-server', () => ({ auth: vi.fn(async () => ({ userId: authUserId })) }))
  vi.doMock('../src/lib/supabase', () => ({
    createServerClient: vi.fn(() => ({ rpc: vi.fn(async (fn: string, args?: Record<string, unknown>) => { rpcCalls.push({ fn, args }); return rpcResult }) })),
  }))
  vi.doMock('../src/server/personalizationLog', () => ({ logPersonalization: vi.fn(), createCorrelationId: vi.fn(() => 'corr-1'), sanitizeForLog: vi.fn((v: unknown) => v) }))
  vi.doMock('../src/server/envValidation', () => ({ requirePersonalizationEnv: vi.fn(() => ({ valid: true, missingRequired: [] })) }))
  vi.doMock('../lib/rateLimit', async () => await import('../lib/rateLimit'))
})
afterEach(() => { vi.restoreAllMocks(); vi.clearAllMocks() })

const req = (path: string, method = 'GET', body?: unknown, search = '') =>
  new NextRequest(`http://localhost/api/personalization/${path}${search}`, { method, body: body !== undefined ? JSON.stringify(body) : undefined, headers: { 'content-type': 'application/json' } })
const goodSearch = { name: 'Tampa pizza', niche: 'restaurants-food', location: 'Tampa, FL', radiusMiles: 25, includeChains: false }
const ID = '123e4567-e89b-12d3-a456-426614174000'

describe('saved-searches route', () => {
  it('401s every method when signed out and never touches the database', async () => {
    authUserId = null
    const m = await import('../app/api/personalization/saved-searches/route')
    expect((await m.GET(req('saved-searches'))).status).toBe(401)
    expect((await m.POST(req('saved-searches', 'POST', goodSearch))).status).toBe(401)
    expect((await m.DELETE(req('saved-searches', 'DELETE', undefined, `?id=${ID}`))).status).toBe(401)
    expect(rpcCalls).toEqual([])
  })
  it('lists for the signed-in user only (identity comes from auth, never the request)', async () => {
    rpcResult = { data: [{ id: ID, name: 'Tampa pizza' }], error: null }
    const { GET } = await import('../app/api/personalization/saved-searches/route')
    const res = await GET(req('saved-searches', 'GET', undefined, '?userId=someone-else'))
    expect(res.status).toBe(200)
    expect((await res.json()).searches).toHaveLength(1)
    expect(rpcCalls).toEqual([{ fn: 'finder_saved_searches_list', args: { p_clerk_user_id: 'user-123' } }])
  })
  it('saves with validated values and the caller identity', async () => {
    rpcResult = { data: { id: ID, ...goodSearch }, error: null }
    const { POST } = await import('../app/api/personalization/saved-searches/route')
    const res = await POST(req('saved-searches', 'POST', { ...goodSearch, clerk_user_id: 'evil', p_clerk_user_id: 'evil' }))
    expect(res.status).toBe(200)
    expect(rpcCalls[0]).toEqual({ fn: 'finder_saved_searches_save', args: { p_clerk_user_id: 'user-123', p_name: 'Tampa pizza', p_niche: 'restaurants-food', p_location: 'Tampa, FL', p_radius_miles: 25, p_include_chains: false } })
  })
  it('400s bad bodies before any database call', async () => {
    const { POST } = await import('../app/api/personalization/saved-searches/route')
    for (const bad of [{ ...goodSearch, niche: 'nope' }, { ...goodSearch, radiusMiles: 999 }, { ...goodSearch, name: '' }]) {
      expect((await POST(req('saved-searches', 'POST', bad))).status).toBe(400)
    }
    const raw = new NextRequest('http://localhost/api/personalization/saved-searches', { method: 'POST', body: '{not json', headers: { 'content-type': 'application/json' } })
    expect((await POST(raw)).status).toBe(400)
    expect(rpcCalls).toEqual([])
  })
  it('maps the cap error to 409 and hides raw database messages', async () => {
    rpcResult = { data: null, error: { code: '54000', message: 'finder_saved_searches_save: limit of 25 saved searches reached' } }
    const { POST } = await import('../app/api/personalization/saved-searches/route')
    const res = await POST(req('saved-searches', 'POST', goodSearch))
    expect(res.status).toBe(409)
    expect((await res.json()).code).toBe('LIMIT_REACHED')
    rpcResult = { data: null, error: { code: 'XX000', message: 'internal secret detail' } }
    const bad = await POST(req('saved-searches', 'POST', goodSearch))
    expect(bad.status).toBe(502)
    expect(JSON.stringify(await bad.json())).not.toContain('secret')
  })
  it('deletes by uuid; 400 on a bad id; 404 when nothing was deleted', async () => {
    const { DELETE } = await import('../app/api/personalization/saved-searches/route')
    expect((await DELETE(req('saved-searches', 'DELETE', undefined, '?id=nope'))).status).toBe(400)
    rpcResult = { data: true, error: null }
    expect((await DELETE(req('saved-searches', 'DELETE', undefined, `?id=${ID}`))).status).toBe(200)
    expect(rpcCalls[0]).toEqual({ fn: 'finder_saved_searches_delete', args: { p_clerk_user_id: 'user-123', p_id: ID } })
    rpcResult = { data: false, error: null }
    expect((await DELETE(req('saved-searches', 'DELETE', undefined, `?id=${ID}`))).status).toBe(404)
  })
})

describe('lead-feedback route', () => {
  it('401s when signed out', async () => {
    authUserId = null
    const m = await import('../app/api/personalization/lead-feedback/route')
    expect((await m.GET(req('lead-feedback'))).status).toBe(401)
    expect((await m.POST(req('lead-feedback', 'POST', { businessId: 'b', reason: 'closed' }))).status).toBe(401)
    expect(rpcCalls).toEqual([])
  })
  it('lists only the caller\'s flags', async () => {
    rpcResult = { data: [{ business_id: 'b1', reason: 'closed' }], error: null }
    const { GET } = await import('../app/api/personalization/lead-feedback/route')
    const res = await GET(req('lead-feedback'))
    expect((await res.json()).flags).toHaveLength(1)
    expect(rpcCalls[0]).toEqual({ fn: 'finder_lead_feedback_list', args: { p_clerk_user_id: 'user-123' } })
  })
  it('adds a flag with a fixed reason and rejects unknown reasons / long notes', async () => {
    rpcResult = { data: { business_id: 'b1', reason: 'is_a_chain' }, error: null }
    const { POST } = await import('../app/api/personalization/lead-feedback/route')
    expect((await POST(req('lead-feedback', 'POST', { businessId: 'b1', reason: 'is_a_chain', note: 'a franchise' }))).status).toBe(200)
    expect(rpcCalls[0]).toEqual({ fn: 'finder_lead_feedback_add', args: { p_clerk_user_id: 'user-123', p_business_id: 'b1', p_reason: 'is_a_chain', p_note: 'a franchise' } })
    rpcCalls.length = 0
    expect((await POST(req('lead-feedback', 'POST', { businessId: 'b1', reason: 'spam' }))).status).toBe(400)
    expect((await POST(req('lead-feedback', 'POST', { businessId: 'b1', reason: 'other', note: 'x'.repeat(281) }))).status).toBe(400)
    expect(rpcCalls).toEqual([])
  })
  it('maps the 500-flag cap to 409', async () => {
    rpcResult = { data: null, error: { code: '54000', message: 'limit of 500 flags reached' } }
    const { POST } = await import('../app/api/personalization/lead-feedback/route')
    expect((await POST(req('lead-feedback', 'POST', { businessId: 'b1', reason: 'closed' }))).status).toBe(409)
  })
  it('undoes a flag via DELETE with validated params', async () => {
    const { DELETE } = await import('../app/api/personalization/lead-feedback/route')
    expect((await DELETE(req('lead-feedback', 'DELETE', undefined, '?businessId=b1&reason=nope'))).status).toBe(400)
    expect((await DELETE(req('lead-feedback', 'DELETE', undefined, '?reason=closed'))).status).toBe(400)
    rpcResult = { data: true, error: null }
    expect((await DELETE(req('lead-feedback', 'DELETE', undefined, '?businessId=b1&reason=closed'))).status).toBe(200)
    expect(rpcCalls[0]).toEqual({ fn: 'finder_lead_feedback_delete', args: { p_clerk_user_id: 'user-123', p_business_id: 'b1', p_reason: 'closed' } })
    rpcResult = { data: false, error: null }
    expect((await DELETE(req('lead-feedback', 'DELETE', undefined, '?businessId=b1&reason=closed'))).status).toBe(404)
  })
})
