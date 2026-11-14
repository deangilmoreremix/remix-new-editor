// @vitest-environment node
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from '../shims/next-server'

let authUserId: string | null = 'user-123'
const rpcCalls: Array<{ fn: string; args: Record<string, any> }> = []
const state = { data: null as unknown, error: null as null | { code?: string; message: string } }
const goodData = () => ({
  video: { id: 'abcdefgh12', title: 'Spring offer', published: true }, period: { from: '2026-10-15', to: '2026-11-13' },
  summary: { page_visits: '12', plays: 9, sessions: 8, unique_viewers: 5, sessions_without_viewer_id: 2, completed_sessions: 4, completion_rate: 0.5, watch_seconds: 300, avg_watch_seconds: 37.5, avg_percent_watched: 0.6, repeat_view_rate: null, new_sessions: 6, returning_sessions: 2, cta_clicks: 3, call_clicks: 1, overlay_clicks: 0, product_selects: 0, leads: 2, lead_conversion_rate: 0.25, cta_conversion_rate: 0.375, errors: 0 },
  daily: [{ day: '2026-11-13', page_visits: 7, plays: 5, unique_viewers: 4, completes: 2, cta_clicks: 2, leads: 1 }], retention: [], cta: [],
  recipients: [{ id: 'r1', label: 'Acme', status: 'live', views: 2, plays: 2, completes: 1, cta_clicks: 1, leads: 1, last_seen: null }], generated_at: '2026-11-13T19:50:00Z',
})

beforeEach(() => {
  vi.resetModules(); authUserId = 'user-123'; rpcCalls.length = 0; Object.assign(state, { data: goodData(), error: null })
  vi.doMock('../shims/clerk-server', () => ({ auth: vi.fn(async () => ({ userId: authUserId })) }))
  vi.doMock('../src/lib/supabase', () => ({ createServerClient: vi.fn(() => ({ rpc: vi.fn(async (fn: string, args: Record<string, any>) => { rpcCalls.push({ fn, args }); return state.error ? { data: null, error: state.error } : { data: state.data, error: null } }) })) }))
  vi.doMock('../src/server/personalizationLog', () => ({ logPersonalization: vi.fn(), createCorrelationId: vi.fn(() => 'corr-1'), sanitizeForLog: vi.fn((v: unknown) => v) }))
  vi.doMock('../src/server/envValidation', () => ({ requirePersonalizationEnv: vi.fn(() => ({ valid: true, missingRequired: [] })) }))
  vi.doMock('../lib/rateLimit', async () => await import('../lib/rateLimit'))
})
afterEach(() => { vi.restoreAllMocks(); vi.clearAllMocks() })

const base = 'https://app.example.com/api/personalization/analytics-report'
const req = (q = '?videoId=abcdefgh12') => new NextRequest(`${base}${q}`, { method: 'GET' })
const load = async () => (await import('../app/api/personalization/analytics-report/route')).GET

describe('analytics-report route', () => {
  it('requires sign-in and touches nothing without it', async () => { authUserId = null; expect((await (await load())(req())).status).toBe(401); expect(rpcCalls).toHaveLength(0) })
  it('validates the video id and the period before any database call', async () => {
    const GET = await load(); authUserId = 'validator'
    for (const q of ['', '?videoId=', '?videoId=short', "?videoId=a'; drop table x", `?videoId=${'a'.repeat(40)}`]) expect((await GET(req(q))).status, q).toBe(400)
    for (const q of ['&from=yesterday', '&to=2026-13-40', '&from=2026-02-30', '&from=2026-11-13&to=2026-11-01', '&from=2024-01-01&to=2026-11-13', '&from=2026-11-01&to=nope']) { const r = await GET(req(`?videoId=abcdefgh12${q}`)); expect(r.status, q).toBe(400); expect((await r.json()).error).toBe('INVALID_PERIOD') }
    expect(rpcCalls).toHaveLength(0)
  })
  it('asks the database as the SESSION user (a user id in the request is ignored) and passes the period through', async () => {
    const GET = await load(); const res = await GET(req('?videoId=abcdefgh12&from=2026-10-15&to=2026-11-13&userId=evil&p_clerk_user_id=evil&clerk_user_id=evil'))
    expect(res.status).toBe(200); expect(rpcCalls).toEqual([{ fn: 'analytics_report', args: { p_clerk_user_id: 'user-123', p_video_id: 'abcdefgh12', p_from: '2026-10-15', p_to: '2026-11-13' } }])
    await (await load())(req()); expect(rpcCalls[1].args).toMatchObject({ p_from: null, p_to: null })
  })
  it('accepts the longest allowed period and a leap day', async () => {
    const GET = await load(); authUserId = 'p1'
    expect((await GET(req('?videoId=abcdefgh12&from=2025-11-13&to=2026-11-13'))).status).toBe(200); authUserId = 'p2'; expect((await GET(req('?videoId=abcdefgh12&from=2024-02-29&to=2024-03-01'))).status).toBe(200)
  })
  it('returns the shaped report (camelCase, real numbers) with no-store caching', async () => {
    const res = await (await load())(req()); const j = await res.json()
    expect(res.headers.get('Cache-Control')).toBe('no-store'); expect(j.ok).toBe(true); expect(j.report.summary).toMatchObject({ pageVisits: 12, uniqueViewers: 5, repeatViewRate: null }); expect(j.report.recipients[0]).toMatchObject({ label: 'Acme', ctaClicks: 1 })
    expect(JSON.stringify(j)).not.toMatch(/token|hash|clerk_user_id|user-123/i)
  })
  it('a video that is not yours reads as 404, the same as a video that does not exist', async () => { state.data = null; const res = await (await load())(req()); expect(res.status).toBe(404); expect((await res.json()).error).toBe('NOT_FOUND') })
  it('database problems are a 502 with a correlation id and no internals; a bad period from the database is a 400', async () => {
    state.error = { message: 'secret detail host=db.internal' }; let res = await (await load())(req()); expect(res.status).toBe(502); const t = JSON.stringify(await res.json()); expect(t).not.toContain('secret detail'); expect(t).toContain('corr-1')
    vi.resetModules(); state.error = { code: '22023', message: 'analytics_report: from is after to' }; res = await (await load())(req()); expect(res.status).toBe(400)
    vi.resetModules(); state.error = null; state.data = { nonsense: true }; res = await (await load())(req()); expect(res.status).toBe(502)
  })
  it('is rate limited per user', async () => {
    const GET = await load(); authUserId = 'busy'; const codes: number[] = []
    for (let i = 0; i < 32; i += 1) codes.push((await GET(req())).status)
    expect(codes.slice(0, 30).every((c) => c === 200)).toBe(true); expect(codes.slice(30)).toEqual([429, 429])
  })
})
