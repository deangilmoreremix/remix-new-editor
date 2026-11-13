// @vitest-environment node
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from '../shims/next-server'

let authUserId: string | null = 'user-123'
const rpcCalls: Array<{ fn: string; args: Record<string, unknown> }> = []
const state = {
  list: [] as Record<string, unknown>[],
  saveRow: null as Record<string, unknown> | null,
  saveError: null as { code?: string; message: string } | null,
  deleteResult: true as boolean,
  error: null as { code?: string; message: string } | null,
}

const GEOMETRY = { aspectRatio: '16:9', layers: [{ id: 'headline', kind: 'headline', x: 0.3, y: 0.3, scale: 0.1, opacity: 1, visible: true, rotation: 15 }] }
const row = (over: Record<string, unknown> = {}) => ({
  id: '11111111-1111-4111-8111-111111111111', clerk_user_id: 'user-123', name: 'Corner', layout: GEOMETRY,
  created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-02T00:00:00Z', ...over,
})

beforeEach(() => {
  vi.resetModules()
  authUserId = 'user-123'
  rpcCalls.length = 0
  Object.assign(state, { list: [row()], saveRow: row(), saveError: null, deleteResult: true, error: null })
  vi.doMock('../shims/clerk-server', () => ({ auth: vi.fn(async () => ({ userId: authUserId })) }))
  vi.doMock('../src/lib/supabase', () => ({
    createServerClient: vi.fn(() => ({
      rpc: vi.fn(async (fn: string, args: Record<string, unknown>) => {
        rpcCalls.push({ fn, args })
        if (state.error) return { data: null, error: state.error }
        if (fn === 'personalization_saved_layouts_list') return { data: state.list, error: null }
        if (fn === 'personalization_saved_layouts_save') return state.saveError ? { data: null, error: state.saveError } : { data: state.saveRow, error: null }
        if (fn === 'personalization_saved_layouts_delete') return { data: state.deleteResult, error: null }
        return { data: null, error: null }
      }),
    })),
  }))
  vi.doMock('../src/server/personalizationLog', () => ({ logPersonalization: vi.fn(), createCorrelationId: vi.fn(() => 'corr-1'), sanitizeForLog: vi.fn((v: unknown) => v) }))
  vi.doMock('../src/server/envValidation', () => ({ requirePersonalizationEnv: vi.fn(() => ({ valid: true, missingRequired: [] })) }))
  vi.doMock('../lib/rateLimit', async () => await import('../lib/rateLimit'))
})
afterEach(() => { vi.restoreAllMocks(); vi.clearAllMocks() })

const req = (method: string, body?: unknown, url = 'http://localhost/api/personalization/layouts') =>
  new NextRequest(url, { method, body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body), headers: { 'content-type': 'application/json' } })

describe('GET /api/personalization/layouts', () => {
  it('requires a signed-in user', async () => {
    authUserId = null
    const { GET } = await import('../app/api/personalization/layouts/route')
    expect((await GET(req('GET'))).status).toBe(401)
    expect(rpcCalls).toHaveLength(0)
  })
  it('lists the caller\'s layouts using the SESSION user id', async () => {
    const { GET } = await import('../app/api/personalization/layouts/route')
    const res = await GET(req('GET'))
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.layouts).toHaveLength(1)
    expect(data.layouts[0]).toMatchObject({ id: row().id, name: 'Corner', aspectRatio: '16:9' })
    expect(data.layouts[0].layers[0]).toMatchObject({ id: 'headline', rotation: 15 })
    expect(rpcCalls[0]).toEqual({ fn: 'personalization_saved_layouts_list', args: { p_clerk_user_id: 'user-123' } })
  })
  it('drops rows whose stored layout is corrupt instead of failing the whole list', async () => {
    state.list = [row(), row({ id: '22222222-2222-4222-8222-222222222222', name: 'Broken', layout: { nope: true } })]
    const { GET } = await import('../app/api/personalization/layouts/route')
    expect((await (await GET(req('GET'))).json()).layouts.map((l: { name: string }) => l.name)).toEqual(['Corner'])
  })
  it('hides database error details', async () => {
    state.error = { message: 'relation "secret_table" does not exist' }
    const { GET } = await import('../app/api/personalization/layouts/route')
    const res = await GET(req('GET'))
    expect(res.status).toBe(502)
    expect(JSON.stringify(await res.json())).not.toContain('secret_table')
  })
})

describe('POST /api/personalization/layouts', () => {
  const good = { name: 'Corner', layout: GEOMETRY }
  it('requires a signed-in user', async () => {
    authUserId = null
    const { POST } = await import('../app/api/personalization/layouts/route')
    expect((await POST(req('POST', good))).status).toBe(401)
    expect(rpcCalls).toHaveLength(0)
  })
  it('saves, using the session user id even when the body names someone else', async () => {
    const { POST } = await import('../app/api/personalization/layouts/route')
    const res = await POST(req('POST', { ...good, clerk_user_id: 'evil', userId: 'evil', layout: { ...GEOMETRY, clerk_user_id: 'evil' } }))
    expect(res.status).toBe(200)
    expect((await res.json()).layout).toMatchObject({ name: 'Corner' })
    expect(rpcCalls[0].fn).toBe('personalization_saved_layouts_save')
    expect(rpcCalls[0].args.p_clerk_user_id).toBe('user-123')
    expect(JSON.stringify(rpcCalls[0].args)).not.toContain('evil')
  })
  it('stores GEOMETRY ONLY: text, urls, pictures and unknown fields never reach the database', async () => {
    const { POST } = await import('../app/api/personalization/layouts/route')
    const dirty = {
      name: 'Dirty',
      layout: {
        aspectRatio: '9:16', secret: 'top-secret',
        layers: [{ id: 'logo', kind: 'logo', x: 0.1, y: 0.1, scale: 0.2, opacity: 1, visible: true, text: 'Acme private text', imageUrl: 'https://x/secret.png', apiKey: 'sk-123' }],
        sourceTransform: { x: 0.2, y: 0.4, zoom: 2 },
      },
    }
    expect((await POST(req('POST', dirty))).status).toBe(200)
    const stored = JSON.stringify(rpcCalls[0].args.p_layout)
    for (const leaked of ['top-secret', 'Acme private text', 'secret.png', 'sk-123']) expect(stored).not.toContain(leaked)
    expect(rpcCalls[0].args.p_layout).toMatchObject({ aspectRatio: '9:16', sourceTransform: { x: 0.2, y: 0.4, zoom: 2 } })
  })
  it.each([
    ['not JSON', '{nope'],
    ['no name', { layout: GEOMETRY }],
    ['blank name', { name: '   ', layout: GEOMETRY }],
    ['no layers', { name: 'x', layout: { aspectRatio: '16:9', layers: [] } }],
    ['only design layers', { name: 'x', layout: { layers: [{ id: 'd', kind: 'design' }] } }],
    ['layout is not an object', { name: 'x', layout: 'string' }],
  ])('rejects %s with 400 and never calls the database', async (_label, body) => {
    const { POST } = await import('../app/api/personalization/layouts/route')
    expect((await POST(req('POST', body as never))).status).toBe(400)
    expect(rpcCalls).toHaveLength(0)
  })
  it('rejects an oversized body with 413', async () => {
    const { POST } = await import('../app/api/personalization/layouts/route')
    expect((await POST(req('POST', { name: 'x', layout: GEOMETRY, pad: 'x'.repeat(70_000) }))).status).toBe(413)
    expect(rpcCalls).toHaveLength(0)
  })
  it('maps the per-user cap to 409', async () => {
    state.saveError = { code: '53400', message: 'layout limit (30) reached' }
    const { POST } = await import('../app/api/personalization/layouts/route')
    const res = await POST(req('POST', good))
    expect(res.status).toBe(409)
    expect((await res.json()).error).toBe('LAYOUT_LIMIT_REACHED')
  })
  it('hides database error details on failure', async () => {
    state.saveError = { code: 'XX000', message: 'internal: password authentication failed for user "svc"' }
    const { POST } = await import('../app/api/personalization/layouts/route')
    const res = await POST(req('POST', good))
    expect(res.status).toBe(502)
    expect(JSON.stringify(await res.json())).not.toContain('password')
  })
  it('rate limits a user after 30 writes a minute', async () => {
    authUserId = 'rate-limited-user'
    const { POST } = await import('../app/api/personalization/layouts/route')
    let last = 0
    for (let i = 0; i < 31; i++) last = (await POST(req('POST', good))).status
    expect(last).toBe(429)
  })
})

describe('DELETE /api/personalization/layouts', () => {
  const id = '11111111-1111-4111-8111-111111111111'
  const del = (q: string) => req('DELETE', undefined, `http://localhost/api/personalization/layouts${q}`)
  it('requires a signed-in user', async () => {
    authUserId = null
    const { DELETE } = await import('../app/api/personalization/layouts/route')
    expect((await DELETE(del(`?id=${id}`))).status).toBe(401)
    expect(rpcCalls).toHaveLength(0)
  })
  it('rejects a missing or malformed id without touching the database', async () => {
    const { DELETE } = await import('../app/api/personalization/layouts/route')
    for (const q of ['', '?id=', '?id=1', `?id=${id}x`, "?id=' or 1=1 --"]) expect((await DELETE(del(q))).status).toBe(400)
    expect(rpcCalls).toHaveLength(0)
  })
  it('deletes with the session user id', async () => {
    const { DELETE } = await import('../app/api/personalization/layouts/route')
    expect((await DELETE(del(`?id=${id}`))).status).toBe(200)
    expect(rpcCalls[0]).toEqual({ fn: 'personalization_saved_layouts_delete', args: { p_id: id, p_clerk_user_id: 'user-123' } })
  })
  it('answers 404 for a layout that is missing or not yours (no existence leak)', async () => {
    state.deleteResult = false
    const { DELETE } = await import('../app/api/personalization/layouts/route')
    const res = await DELETE(del(`?id=${id}`))
    expect(res.status).toBe(404)
    expect((await res.json()).error).toBe('NOT_FOUND')
  })
})
