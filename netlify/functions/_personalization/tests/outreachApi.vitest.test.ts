// @vitest-environment node
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from '../shims/next-server'
import { defaultEmail } from '../../../../src/features/personalization/shared/personalization/email/emailModel'
import { verifyUnsubscribe, hashAddress } from '../../../../src/features/personalization/shared/personalization/email/unsubscribe'

const SECRET = 'a-long-enough-test-secret-0123456789'
let authUserId: string | null = 'user-123'
const sent: Array<Record<string, any>> = []
const rpcCalls: Array<{ fn: string; args: Record<string, any> }> = []
const state = { suppressed: [] as string[], dbError: false, smtpFails: false }
const goodEmail = () => defaultEmail({ name: 'Dana Roe', address: 'dana@example.com', postalAddress: '1 Main St, Springfield' }, { videoUrl: 'https://app.example.com/watch/abc?r=tok', heroUrl: 'https://cdn.example.com/hero.gif' })
const ENV = { OUTREACH_SEND_ENABLED: 'true', OUTREACH_SMTP_URL: 'smtp://127.0.0.1:2525', OUTREACH_FROM_ADDRESS: 'noreply@send.example.com', OUTREACH_UNSUBSCRIBE_SECRET: SECRET, OUTREACH_TEST_ALLOWLIST: 'Me@Example.com, other@example.com', SITE_URL: 'https://app.example.com' }
const KEYS = [...Object.keys(ENV), 'URL', 'VITE_SITE_URL']
let saved: Record<string, string | undefined> = {}

beforeEach(() => {
  vi.resetModules(); authUserId = 'user-123'; sent.length = 0; rpcCalls.length = 0; Object.assign(state, { suppressed: [], dbError: false, smtpFails: false })
  saved = Object.fromEntries(KEYS.map((k) => [k, process.env[k]])); for (const k of KEYS) delete process.env[k]; Object.assign(process.env, ENV)
  vi.doMock('../shims/clerk-server', () => ({ auth: vi.fn(async () => ({ userId: authUserId })) }))
  vi.doMock('../src/lib/supabase', () => ({
    createServerClient: vi.fn(() => ({
      rpc: vi.fn(async (fn: string, args: Record<string, any>) => {
        rpcCalls.push({ fn, args })
        if (state.dbError) return { data: null, error: { message: 'secret db detail' } }
        return { data: fn === 'email_suppression_check' ? state.suppressed : null, error: null }
      }),
    })),
  }))
  vi.doMock('../src/server/personalizationLog', () => ({ logPersonalization: vi.fn(), createCorrelationId: vi.fn(() => 'corr-1'), sanitizeForLog: vi.fn((v: unknown) => v) }))
  vi.doMock('../src/server/envValidation', () => ({ requirePersonalizationEnv: vi.fn(() => ({ valid: true, missingRequired: [] })) }))
  vi.doMock('../lib/rateLimit', async () => await import('../lib/rateLimit'))
  vi.doMock('nodemailer', () => ({
    createTransport: (url: string) => ({ sendMail: async (m: Record<string, any>) => { if (state.smtpFails) throw new Error('connect ECONNREFUSED 10.0.0.1:2525 password=hunter2'); sent.push({ ...m, smtp: url }); return { messageId: '<m1@test>', accepted: [m.to], rejected: [], response: '250 OK' } } }),
  }))
})
afterEach(() => { for (const k of KEYS) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k] } vi.restoreAllMocks(); vi.clearAllMocks() })

const URL_ = 'https://app.example.com/api/personalization/outreach'
const req = (body?: unknown) => new NextRequest(URL_, { method: 'POST', body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body), headers: { 'content-type': 'application/json' } })
const load = async () => (await import('../app/api/personalization/outreach/route')).POST
const test = (over: Record<string, unknown> = {}) => ({ mode: 'test', to: 'me@example.com', email: goodEmail(), values: { firstName: 'Ann', company: 'Acme' }, ...over })

describe('outreach test-send route: gates', () => {
  it('requires sign-in', async () => { authUserId = null; expect((await (await load())(req(test()))).status).toBe(401); expect(sent).toHaveLength(0) })
  it('is disabled (503) unless every setting is present', async () => {
    for (const k of ['OUTREACH_SEND_ENABLED', 'OUTREACH_SMTP_URL', 'OUTREACH_FROM_ADDRESS', 'OUTREACH_UNSUBSCRIBE_SECRET']) {
      Object.assign(process.env, ENV); delete process.env[k]; vi.resetModules()
      expect((await (await load())(req(test()))).status, k).toBe(503)
    }
    Object.assign(process.env, ENV, { OUTREACH_SEND_ENABLED: 'yes' }); vi.resetModules(); expect((await (await load())(req(test()))).status).toBe(503)
    Object.assign(process.env, ENV, { OUTREACH_UNSUBSCRIBE_SECRET: 'short' }); vi.resetModules(); expect((await (await load())(req(test()))).status).toBe(503)
    expect(sent).toHaveLength(0)
  })
  it('refuses list sending (501), unknown modes, bad bodies and recipients', async () => {
    const POST = await load(); authUserId = 'shape-user'
    expect((await POST(req(test({ mode: 'send' })))).status).toBe(501)
    expect((await POST(req(test({ mode: 'blast' })))).status).toBe(400)
    expect((await POST(req('{nope'))).status).toBe(400)
    expect((await POST(req('x'.repeat(70_000)))).status).toBe(413)
    // the limiter counts every request, valid or not, so each bad recipient uses its own user
    let n = 0
    for (const to of ['', 'nope', 'a@b.com, c@d.com', 'me@example.com\nBcc: x@y.com', 5]) { authUserId = `bad-recipient-${n += 1}`; expect((await POST(req(test({ to })))).status, String(to)).toBe(400) }
    expect(sent).toHaveLength(0)
  })
  it('only mails addresses on the allow-list (case-insensitive), so it cannot become an open relay', async () => {
    const POST = await load()
    expect((await POST(req(test({ to: 'stranger@example.org' })))).status).toBe(403)
    expect((await POST(req(test({ to: 'ME@EXAMPLE.COM' })))).status).toBe(200)
    expect(sent.map((m) => m.to)).toEqual(['me@example.com'])
  })
  it('allows only five test sends an hour per user', async () => {
    const POST = await load(); const codes: number[] = []
    for (let i = 0; i < 7; i += 1) codes.push((await POST(req(test()))).status)
    expect(codes).toEqual([200, 200, 200, 200, 200, 429, 429]); expect(sent).toHaveLength(5)
  })
})

describe('outreach test-send route: what is sent', () => {
  it('From is OUR configured address, Reply-To the owner, subject marked [TEST], with signed unsubscribe + one-click headers', async () => {
    const res = await (await load())(req(test())); const j = await res.json()
    expect(res.status).toBe(200); expect(j).toMatchObject({ ok: true, messageId: '<m1@test>' }); expect(j.note).toMatch(/does not prove it reached the inbox/)
    const m = sent[0]
    expect(m.from).toEqual({ name: 'Dana Roe', address: 'noreply@send.example.com' }); expect(m.replyTo).toBe('dana@example.com'); expect(m.smtp).toBe('smtp://127.0.0.1:2525')
    expect(m.subject).toBe('[TEST] Ann, a quick video for Acme')
    expect(m.headers['List-Unsubscribe-Post']).toBe('List-Unsubscribe=One-Click')
    const link = /<(https:\/\/app\.example\.com\/api\/outreach-unsubscribe\?t=[^>]+)>/.exec(m.headers['List-Unsubscribe'])![1]
    expect(m.html).toContain(link.replace(/&/g, '&amp;')); expect(m.text).toContain(link)
    const v = await verifyUnsubscribe(SECRET, new URL(link).searchParams.get('t'))
    expect(v).toMatchObject({ ok: true, owner: 'user-123', hash: await hashAddress('me@example.com') })
    expect(JSON.stringify(j)).not.toContain(SECRET)
  })
  it('ignores a client-supplied unsubscribe link and sender spoof attempts', async () => {
    const email = { ...goodEmail(), unsubscribeUrl: 'https://evil.example/u', sender: { name: 'CEO', address: 'ceo@bank.com', postalAddress: '1 Main St' } }
    await (await load())(req(test({ email })))
    expect(sent[0].html).not.toContain('evil.example'); expect(sent[0].from.address).toBe('noreply@send.example.com')
  })
  it('refuses content that is not ready (400 with the errors) and sends nothing', async () => {
    const res = await (await load())(req(test({ email: { ...goodEmail(), sender: { name: 'D', address: 'dana@example.com', postalAddress: '' }, body: [] } })))
    const j = await res.json(); expect(res.status).toBe(400); expect(j.error).toBe('EMAIL_NOT_READY'); expect(j.checks.map((c: any) => c.id).sort()).toEqual(['body-missing', 'postal-address']); expect(sent).toHaveLength(0)
  })
  it('hostile merge values are text in the sent HTML', async () => {
    await (await load())(req(test({ values: { firstName: '<script>alert(1)</script>', company: 'Acme' } })))
    expect(sent[0].html).not.toContain('<script>'); expect(sent[0].html).toContain('&lt;script&gt;')
  })
})

describe('outreach test-send route: suppression and failures', () => {
  it('never mails a suppressed address, tests included (409), checking by hash for THIS owner', async () => {
    state.suppressed = [await hashAddress('me@example.com')]
    const res = await (await load())(req(test())); expect(res.status).toBe(409); expect(sent).toHaveLength(0)
    expect(rpcCalls[0]).toEqual({ fn: 'email_suppression_check', args: { p_owner: 'user-123', p_hashes: [await hashAddress('me@example.com')] } })
    expect(JSON.stringify(rpcCalls)).not.toContain('me@example.com')
  })
  it('fails closed when the suppression list cannot be read (502, no send, no internals)', async () => {
    state.dbError = true; const res = await (await load())(req(test())); expect(res.status).toBe(502); expect(sent).toHaveLength(0); expect(JSON.stringify(await res.json())).not.toContain('secret db detail')
  })
  it('an SMTP failure is a 502 that does not leak the server address or credentials', async () => {
    state.smtpFails = true; const res = await (await load())(req(test())); const t = JSON.stringify(await res.json())
    expect(res.status).toBe(502); expect(t).toContain('Nothing was sent'); expect(t).not.toMatch(/hunter2|10\.0\.0\.1|ECONNREFUSED/)
  })
})
