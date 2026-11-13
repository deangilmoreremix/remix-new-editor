// @vitest-environment node
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from '../shims/next-server'
import { hashRecipientToken, isRecipientToken, looksRandom } from '../../../../src/features/personalization/shared/personalization/publish/recipientToken'

let authUserId: string | null = 'user-123'
const rpcCalls: Array<{ fn: string; args: Record<string, any> }> = []
const state = { list: [] as Record<string, unknown>[], issueError: null as { code?: string; message: string } | null, revokeResult: true as boolean, error: null as { code?: string; message: string } | null, issueRows: null as null | Array<{ id: string; label: string }> }
const VID = 'vidAAAAAAAA'
const lrow = (over: Record<string, unknown> = {}) => ({ id: '11111111-1111-4111-8111-111111111111', label: 'Acme', created_at: '2026-01-01T00:00:00Z', expires_at: null, revoked_at: null, views: '3', plays: 2, completes: 1, cta_clicks: 1, leads: 0, last_seen: '2026-01-02T00:00:00Z', ...over })

beforeEach(() => {
  vi.resetModules(); authUserId = 'user-123'; rpcCalls.length = 0
  Object.assign(state, { list: [lrow()], issueError: null, revokeResult: true, error: null, issueRows: null })
  vi.doMock('../shims/clerk-server', () => ({ auth: vi.fn(async () => ({ userId: authUserId })) }))
  vi.doMock('../src/lib/supabase', () => ({
    createServerClient: vi.fn(() => ({
      rpc: vi.fn(async (fn: string, args: Record<string, any>) => {
        rpcCalls.push({ fn, args })
        if (state.error) return { data: null, error: state.error }
        if (fn === 'recipient_links_list') return { data: state.list, error: null }
        if (fn === 'recipient_links_issue') return state.issueError ? { data: null, error: state.issueError } : { data: state.issueRows ?? (args.p_labels as string[]).map((label, i) => ({ id: `00000000-0000-4000-8000-00000000000${i}`, label })), error: null }
        if (fn === 'recipient_links_revoke') return { data: state.revokeResult, error: null }
        return { data: null, error: null }
      }),
    })),
  }))
  vi.doMock('../src/server/personalizationLog', () => ({ logPersonalization: vi.fn(), createCorrelationId: vi.fn(() => 'corr-1'), sanitizeForLog: vi.fn((v: unknown) => v) }))
  vi.doMock('../src/server/envValidation', () => ({ requirePersonalizationEnv: vi.fn(() => ({ valid: true, missingRequired: [] })) }))
  vi.doMock('../lib/rateLimit', async () => await import('../lib/rateLimit'))
})
afterEach(() => { vi.restoreAllMocks(); vi.clearAllMocks() })

const base = 'https://app.example.com/api/personalization/recipient-links'
const req = (method: string, body?: unknown, url = base) => new NextRequest(url, { method, body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body), headers: { 'content-type': 'application/json' } })
const load = async () => await import('../app/api/personalization/recipient-links/route')

describe('GET', () => {
  it('requires sign-in', async () => { authUserId = null; const { GET } = await load(); expect((await GET(req('GET', undefined, `${base}?videoId=${VID}`))).status).toBe(401); expect(rpcCalls).toHaveLength(0) })
  it('rejects a bad video id before touching the database', async () => { const { GET } = await load(); for (const v of ['', 'x', "a'; drop table", 'a'.repeat(40)]) expect((await GET(req('GET', undefined, `${base}?videoId=${encodeURIComponent(v)}`))).status).toBe(400); expect(rpcCalls).toHaveLength(0) })
  it('lists with the SESSION user id; maps counts; NEVER returns a hash or token', async () => {
    const { GET } = await load(); const res = await GET(req('GET', undefined, `${base}?videoId=${VID}&userId=evil&p_clerk_user_id=evil`)); expect(res.status).toBe(200)
    expect(rpcCalls[0]).toEqual({ fn: 'recipient_links_list', args: { p_clerk_user_id: 'user-123', p_video_id: VID } })
    const text = JSON.stringify(await res.json()); const j = JSON.parse(text); expect(j.links[0]).toMatchObject({ label: 'Acme', status: 'live', views: 3, plays: 2, completes: 1, ctaClicks: 1, leads: 0 }); expect(text).not.toMatch(/token|hash/i)
  })
  it('status: revoked and expired are reported', async () => {
    state.list = [lrow({ revoked_at: '2026-01-03T00:00:00Z' }), lrow({ id: '22222222-2222-4222-8222-222222222222', label: 'Old', expires_at: '2020-01-01T00:00:00Z' })]
    const { GET } = await load(); const j = await (await GET(req('GET', undefined, `${base}?videoId=${VID}`))).json(); expect(j.links.map((l: any) => l.status)).toEqual(['revoked', 'expired'])
  })
  it('a database error is a 502 with a correlation id and no internals', async () => { state.error = { message: 'secret detail' }; const { GET } = await load(); const res = await GET(req('GET', undefined, `${base}?videoId=${VID}`)); expect(res.status).toBe(502); expect(JSON.stringify(await res.json())).not.toContain('secret detail') })
})

describe('POST (issue)', () => {
  it('requires sign-in and valid JSON', async () => {
    authUserId = null; const { POST } = await load(); expect((await POST(req('POST', { videoId: VID, labels: ['a'] }))).status).toBe(401); authUserId = 'user-123'
    expect((await POST(req('POST', '{not json'))).status).toBe(400); expect((await POST(req('POST', 'x'.repeat(70_000)))).status).toBe(413)
  })
  it('validates the video, labels and expiry before any database call', async () => {
    const { POST } = await load()
    for (const bad of [{ labels: ['a'] }, { videoId: 'x', labels: ['a'] }, { videoId: VID }, { videoId: VID, labels: [] }, { videoId: VID, labels: [''] }, { videoId: VID, labels: ['a', 'A'] }, { videoId: VID, labels: ['x'.repeat(81)] }, { videoId: VID, labels: [5] }, { videoId: VID, labels: ['a'], expiresInDays: 'soon' }, { videoId: VID, labels: ['a'], expiresInDays: -3 }]) expect((await POST(req('POST', bad))).status, JSON.stringify(bad)).toBe(400)
    expect((await POST(req('POST', { videoId: VID, labels: Array.from({ length: 201 }, (_, i) => `r${i}`) }))).status).toBe(400); expect(rpcCalls).toHaveLength(0)
  })
  it('issues tokens SERVER-side: the database gets only hashes; the response carries each token and URL once, no-store', async () => {
    const { POST } = await load(); const res = await POST(req('POST', { videoId: VID, labels: ['Acme Roofing', 'Bright Plumbing'], expiresInDays: 30 })); expect(res.status).toBe(200); expect(res.headers.get('Cache-Control')).toBe('no-store')
    const j = await res.json(); expect(j.links).toHaveLength(2)
    const call = rpcCalls[0]; expect(call.fn).toBe('recipient_links_issue'); expect(call.args.p_clerk_user_id).toBe('user-123'); expect(call.args.p_video_id).toBe(VID); expect(call.args.p_labels).toEqual(['Acme Roofing', 'Bright Plumbing'])
    expect(new Date(call.args.p_expires_at).getTime()).toBeGreaterThan(Date.now() + 29 * 86_400_000)
    for (const [i, l] of j.links.entries()) {
      expect(isRecipientToken(l.token)).toBe(true); expect(looksRandom(l.token)).toBe(true); expect(l.url).toBe(`https://app.example.com/watch/${VID}?r=${l.token}`)
      expect(call.args.p_token_hashes[i]).toBe(await hashRecipientToken(l.token)); expect(JSON.stringify(call.args)).not.toContain(l.token) // the plain token never reaches the database
    }
    expect(new Set(j.links.map((l: any) => l.token)).size).toBe(2)
  })
  it('ignores any user id the client sends', async () => { const { POST } = await load(); await POST(req('POST', { videoId: VID, labels: ['a'], clerkUserId: 'evil', userId: 'evil', p_clerk_user_id: 'evil' })); expect(rpcCalls[0].args.p_clerk_user_id).toBe('user-123') })
  it('tokens differ across calls (fresh randomness each time)', async () => {
    const { POST } = await load(); const a = await (await POST(req('POST', { videoId: VID, labels: ['a'] }))).json(); const b = await (await POST(req('POST', { videoId: VID, labels: ['a'] }))).json(); expect(a.links[0].token).not.toBe(b.links[0].token)
  })
  it('maps database refusals: not yours/missing → 404 (no leak), limit → 409, duplicate → 409, bad request → 400, other → 502', async () => {
    const { POST } = await load()
    for (const [code, status, name] of [['P0002', 404, 'NOT_FOUND'], ['53400', 409, 'LINK_LIMIT_REACHED'], ['23505', 409, 'DUPLICATE_LABEL'], ['22023', 400, 'INVALID_REQUEST'], ['XX000', 502, undefined]] as const) {
      state.issueError = { code, message: 'internal detail' }; const res = await POST(req('POST', { videoId: VID, labels: ['a'] })); expect(res.status, code).toBe(status); const j = await res.json(); if (name) expect(j.error).toBe(name); expect(JSON.stringify(j)).not.toContain('internal detail')
    }
  })
  it('a short or unmatched read-back is an error, never a half-answer', async () => {
    const { POST } = await load(); state.issueRows = [{ id: '1', label: 'only one' }]; expect((await POST(req('POST', { videoId: VID, labels: ['a', 'b'] }))).status).toBe(502)
    state.issueRows = [{ id: '1', label: 'zzz' }]; expect((await POST(req('POST', { videoId: VID, labels: ['a'] }))).status).toBe(502)
  })
  it('is rate limited per user', async () => { const { POST } = await load(); let last = 200; for (let i = 0; i < 14; i++) last = (await POST(req('POST', { videoId: VID, labels: [`l${i}`] }))).status; expect(last).toBe(429) })
})

describe('DELETE (revoke)', () => {
  const U = '11111111-1111-4111-8111-111111111111'
  it('requires sign-in; validates the id', async () => { authUserId = null; const { DELETE } = await load(); expect((await DELETE(req('DELETE', undefined, `${base}?id=${U}`))).status).toBe(401); authUserId = 'user-123'; for (const id of ['', 'nope', `${U}x`]) expect((await DELETE(req('DELETE', undefined, `${base}?id=${id}`))).status).toBe(400) })
  it('revokes with the SESSION user id; 404 when not found or not yours', async () => {
    const { DELETE } = await load(); expect((await DELETE(req('DELETE', undefined, `${base}?id=${U}&userId=evil`))).status).toBe(200); expect(rpcCalls[0]).toEqual({ fn: 'recipient_links_revoke', args: { p_id: U, p_clerk_user_id: 'user-123' } })
    state.revokeResult = false; expect((await DELETE(req('DELETE', undefined, `${base}?id=${U}`))).status).toBe(404)
  })
  it('a database error is a 502', async () => { state.error = { message: 'boom' }; const { DELETE } = await load(); expect((await DELETE(req('DELETE', undefined, `${base}?id=${U}`))).status).toBe(502) })
})
