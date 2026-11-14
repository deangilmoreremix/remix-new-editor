// @vitest-environment node
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from '../shims/next-server'

let authUserId: string | null = 'user-123'
const rpcCalls: Array<{ fn: string; args: Record<string, any> }> = []
const state = { prepare: true as boolean, register: null as string | null, list: [] as any[], remove: null as string | null, error: null as null | { code?: string; message: string }, size: 4096 as number | null }
const fetchCalls: Array<{ url: string; method: string }> = []
const VID = 'vidAAAAAAAA'; const LINK = '11111111-1111-4111-8111-111111111111'
const PATH = `${VID}/${LINK}/${'a'.repeat(32)}.mp4`
const saved: Record<string, string | undefined> = {}

beforeEach(() => {
  vi.resetModules(); authUserId = 'user-123'; rpcCalls.length = 0; fetchCalls.length = 0; Object.assign(state, { prepare: true, register: null, list: [], remove: null, error: null, size: 4096 })
  for (const k of ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']) saved[k] = process.env[k]; Object.assign(process.env, { SUPABASE_URL: 'https://db.test', SUPABASE_SERVICE_ROLE_KEY: 'service-secret' })
  vi.doMock('../shims/clerk-server', () => ({ auth: vi.fn(async () => ({ userId: authUserId })) }))
  vi.doMock('../src/lib/supabase', () => ({ createServerClient: vi.fn(() => ({ rpc: vi.fn(async (fn: string, args: Record<string, any>) => {
    rpcCalls.push({ fn, args }); if (state.error) return { data: null, error: state.error }
    if (fn === 'recipient_video_prepare') return { data: state.prepare, error: null }; if (fn === 'recipient_video_register') return { data: state.register, error: null }
    if (fn === 'recipient_videos_list') return { data: state.list, error: null }; if (fn === 'recipient_video_remove') return { data: state.remove, error: null }; return { data: null, error: null }
  }) })) }))
  vi.doMock('../src/server/personalizationLog', () => ({ logPersonalization: vi.fn(), createCorrelationId: vi.fn(() => 'corr-1'), sanitizeForLog: vi.fn((v: unknown) => v) }))
  vi.doMock('../src/server/envValidation', () => ({ requirePersonalizationEnv: vi.fn(() => ({ valid: true, missingRequired: [] })) }))
  vi.doMock('../lib/rateLimit', async () => await import('../lib/rateLimit'))
  vi.stubGlobal('fetch', vi.fn(async (url: string, init: any) => {
    fetchCalls.push({ url, method: init?.method ?? 'GET' })
    if (url.includes('/object/upload/sign/')) return { ok: true, json: async () => ({ url: `/object/upload/sign/recipient-videos/${decodeURIComponent(url.split('/object/upload/sign/recipient-videos/')[1])}?token=t` }) }
    if (url.includes('/object/info/')) return state.size ? { ok: true, json: async () => ({ size: state.size }) } : { ok: false, status: 404 }
    if (init?.method === 'DELETE') return { ok: true, status: 200 }
    return { ok: false, status: 404 }
  }))
})
afterEach(() => { for (const k of ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k] } vi.unstubAllGlobals(); vi.restoreAllMocks(); vi.clearAllMocks() })

const base = 'https://app.example.com/api/personalization/recipient-videos'
const req = (method: string, body?: unknown, q = '') => new NextRequest(`${base}${q}`, { method, body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body), headers: { 'content-type': 'application/json' } })
const load = async () => await import('../app/api/personalization/recipient-videos/route')
const up = (over: Record<string, unknown> = {}) => ({ action: 'upload-url', videoId: VID, linkId: LINK, contentType: 'video/mp4', bytes: 5000, ...over })

describe('upload-url', () => {
  it('requires sign-in and is disabled (503) without storage configuration', async () => {
    authUserId = null; expect((await (await load()).POST(req('POST', up()))).status).toBe(401); expect(rpcCalls).toHaveLength(0)
    authUserId = 'user-123'; delete process.env.SUPABASE_SERVICE_ROLE_KEY; expect((await (await load()).POST(req('POST', up()))).status).toBe(503)
  })
  it('checks ownership in the database as the SESSION user, then mints a server-made path and a signed URL', async () => {
    const res = await (await load()).POST(req('POST', up({ userId: 'evil', p_owner: 'evil', path: '../../etc/passwd' }))); const j = await res.json()
    expect(res.status).toBe(200); expect(rpcCalls).toEqual([{ fn: 'recipient_video_prepare', args: { p_owner: 'user-123', p_video_id: VID, p_link_id: LINK } }])
    expect(j.path).toMatch(new RegExp(`^${VID}/${LINK}/[0-9a-f]{32}\\.mp4$`)); expect(j.uploadUrl).toContain('/storage/v1/object/upload/sign/recipient-videos/'); expect(JSON.stringify(j)).not.toContain('service-secret'); expect(j.path).not.toContain('..')
    const again = await (await (await load()).POST(req('POST', up()))).json(); expect(again.path).not.toBe(j.path)
  })
  it('a link that is not yours (or is revoked) is a plain 404 and no URL is signed', async () => {
    state.prepare = false; const res = await (await load()).POST(req('POST', up())); expect(res.status).toBe(404); expect(fetchCalls).toHaveLength(0)
  })
  it('validates ids, type, size and the body before any database call', async () => {
    const POST = (await load()).POST
    for (const bad of [up({ videoId: 'x' }), up({ linkId: 'nope' }), up({ contentType: 'video/x-flv' }), up({ contentType: undefined }), up({ bytes: 0 }), up({ bytes: 209715201 }), up({ bytes: '5000' }), up({ bytes: 1.5 }), up({ action: 'bogus' }), []]) expect((await POST(req('POST', bad))).status, JSON.stringify(bad)).toBe(400)
    expect((await POST(req('POST', '{nope'))).status).toBe(400); expect((await POST(req('POST', 'x'.repeat(5000)))).status).toBe(413); expect(rpcCalls).toHaveLength(0)
  })
  it('database errors are a 502 with a correlation id and no internals', async () => { state.error = { message: 'secret db detail' }; const res = await (await load()).POST(req('POST', up())); expect(res.status).toBe(502); const t = JSON.stringify(await res.json()); expect(t).not.toContain('secret db detail'); expect(t).toContain('corr-1') })
})

describe('register', () => {
  const reg = (over: Record<string, unknown> = {}) => ({ action: 'register', videoId: VID, linkId: LINK, path: PATH, ...over })
  it('reads the size from Storage (not the client), records it for the session user, and deletes the file it replaced', async () => {
    state.register = `${VID}/${LINK}/${'b'.repeat(32)}.mp4`; const res = await (await load()).POST(req('POST', reg({ bytes: 1 }))); expect(await res.json()).toEqual({ ok: true, bytes: 4096 })
    expect(rpcCalls[0]).toEqual({ fn: 'recipient_video_register', args: { p_owner: 'user-123', p_video_id: VID, p_link_id: LINK, p_path: PATH, p_type: 'video/mp4', p_bytes: 4096 } })
    expect(fetchCalls.some((c) => c.method === 'DELETE' && c.url.endsWith(`${'b'.repeat(32)}.mp4`))).toBe(true)
  })
  it('refuses a path of another link/video or off-scheme, and an object that was never uploaded', async () => {
    const POST = (await load()).POST
    for (const path of [`${VID}/22222222-2222-4222-8222-222222222222/${'a'.repeat(32)}.mp4`, `vidBBBBBBBB/${LINK}/${'a'.repeat(32)}.mp4`, '../../x.mp4', `${PATH}/..`, undefined]) expect((await POST(req('POST', reg({ path })))).status).toBe(400)
    state.size = null; expect((await POST(req('POST', reg()))).status).toBe(409); state.size = 209715201; expect((await POST(req('POST', reg()))).status).toBe(409); expect(rpcCalls).toHaveLength(0)
  })
  it('a link that is not yours is 404 (the database says so)', async () => { state.error = { code: 'P0002', message: 'link not found' }; expect((await (await load()).POST(req('POST', reg()))).status).toBe(404) })
})

describe('list and delete', () => {
  it('lists only the session user\'s videos, shaped for the panel', async () => {
    state.list = [{ recipient_link_id: LINK, bytes: '5000', content_type: 'video/mp4', created_at: '2026-11-14T00:00:00Z' }]
    const res = await (await load()).GET(req('GET', undefined, `?videoId=${VID}&userId=evil`)); expect(await res.json()).toEqual({ ok: true, videos: [{ linkId: LINK, bytes: 5000, contentType: 'video/mp4', createdAt: '2026-11-14T00:00:00Z' }] }); expect(rpcCalls[0].args).toEqual({ p_owner: 'user-123', p_video_id: VID })
    expect((await (await load()).GET(req('GET', undefined, '?videoId=x'))).status).toBe(400)
  })
  it('delete removes the record and then the object; "not yours" removes nothing', async () => {
    state.remove = PATH; expect(await (await (await load()).DELETE(req('DELETE', undefined, `?linkId=${LINK}`))).json()).toEqual({ ok: true, removed: true }); expect(fetchCalls.some((c) => c.method === 'DELETE')).toBe(true)
    fetchCalls.length = 0; state.remove = null; expect(await (await (await load()).DELETE(req('DELETE', undefined, `?linkId=${LINK}`))).json()).toEqual({ ok: true, removed: false }); expect(fetchCalls).toHaveLength(0)
    expect((await (await load()).DELETE(req('DELETE', undefined, '?linkId=nope'))).status).toBe(400); authUserId = null; expect((await (await load()).DELETE(req('DELETE', undefined, `?linkId=${LINK}`))).status).toBe(401)
  })
})
