// @vitest-environment node
import { createECDH, randomBytes } from 'node:crypto'
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import ece from 'http_ece'
import { NextRequest } from '../shims/next-server'
import { generateVapidKeys } from '../../_push/webPush.js'

let authUserId: string | null = 'user-123'
const rpcCalls: Array<{ fn: string; args: Record<string, any> }> = []
const state = { subs: [] as Array<{ endpoint: string; p256dh: string; auth: string }>, list: [] as any[], failOn: null as null | string, saveCount: 1, removed: true }
const KEYS = generateVapidKeys()
const ENV: Record<string, string> = { VAPID_PUBLIC_KEY: KEYS.publicKey, VAPID_PRIVATE_KEY: KEYS.privateKey, VAPID_SUBJECT: 'mailto:owner@example.com' }
const saved: Record<string, string | undefined> = {}
const browser = () => { const e = createECDH('prime256v1'); e.generateKeys(); const auth = randomBytes(16); return { e, auth, sub: { endpoint: `https://fcm.googleapis.com/fcm/send/${randomBytes(8).toString('hex')}`, p256dh: e.getPublicKey().toString('base64url'), auth: auth.toString('base64url') } } }

beforeEach(() => {
  vi.resetModules(); authUserId = 'user-123'; rpcCalls.length = 0; Object.assign(state, { subs: [], list: [], failOn: null, saveCount: 1, removed: true })
  for (const k of [...Object.keys(ENV), 'PUSH_ENDPOINT_HOSTS']) { saved[k] = process.env[k]; delete process.env[k] }; Object.assign(process.env, ENV)
  vi.doMock('../shims/clerk-server', () => ({ auth: vi.fn(async () => ({ userId: authUserId })) }))
  vi.doMock('../src/lib/supabase', () => ({ createServerClient: vi.fn(() => ({ rpc: vi.fn(async (fn: string, args: Record<string, any>) => {
    rpcCalls.push({ fn, args })
    if (state.failOn === fn) return { data: null, error: { message: 'secret db detail' } }
    if (fn === 'push_subscriptions_list') return { data: state.list, error: null }
    if (fn === 'push_subscriptions_for_owner') return { data: state.subs, error: null }
    if (fn === 'push_subscription_save') return { data: state.saveCount, error: null }
    if (fn === 'push_subscription_remove') return { data: state.removed, error: null }
    return { data: null, error: null }
  }) })) }))
  vi.doMock('../src/server/personalizationLog', () => ({ logPersonalization: vi.fn(), createCorrelationId: vi.fn(() => 'corr-1'), sanitizeForLog: vi.fn((v: unknown) => v) }))
  vi.doMock('../src/server/envValidation', () => ({ requirePersonalizationEnv: vi.fn(() => ({ valid: true, missingRequired: [] })) }))
  vi.doMock('../lib/rateLimit', async () => await import('../lib/rateLimit'))
})
afterEach(() => { for (const k of [...Object.keys(ENV), 'PUSH_ENDPOINT_HOSTS']) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k] } vi.unstubAllGlobals(); vi.restoreAllMocks(); vi.clearAllMocks() })

const url = 'https://app.example.com/api/personalization/push'
const req = (method: string, body?: unknown) => new NextRequest(url, { method, body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body), headers: { 'content-type': 'application/json' } })
const load = async () => await import('../app/api/personalization/push/route')
const good = () => browser().sub
const subscribe = (sub: any, extra: Record<string, unknown> = {}) => ({ subscription: { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, ...extra })

describe('GET', () => {
  it('requires sign-in', async () => { authUserId = null; const { GET } = await load(); expect((await GET(req('GET'))).status).toBe(401); expect(rpcCalls).toHaveLength(0) })
  it('says whether push can work and hands out ONLY the public key; devices never include keys', async () => {
    state.list = [{ device_label: 'Laptop', created_at: '2026-11-01T00:00:00Z', last_success_at: null }]
    const { GET } = await load(); const res = await GET(req('GET')); const j = await res.json(); const text = JSON.stringify(j)
    expect(j).toMatchObject({ configured: true, publicKey: KEYS.publicKey, devices: [{ label: 'Laptop', createdAt: '2026-11-01T00:00:00Z', lastSuccessAt: null }] }); expect(text).not.toContain(KEYS.privateKey); expect(text).not.toMatch(/p256dh|endpoint|auth"/); expect(rpcCalls[0]).toEqual({ fn: 'push_subscriptions_list', args: { p_clerk_user_id: 'user-123' } })
  })
  it('not configured → configured:false with no key; a missing table still answers (storage unavailable) so the panel can explain', async () => {
    delete process.env.VAPID_PRIVATE_KEY; let j = await (await (await load()).GET(req('GET'))).json(); expect(j).toMatchObject({ configured: false, publicKey: null })
    Object.assign(process.env, ENV); vi.resetModules(); state.failOn = 'push_subscriptions_list'; const res = await (await load()).GET(req('GET')); j = await res.json(); expect(res.status).toBe(200); expect(j).toMatchObject({ configured: true, devices: [], storage: 'unavailable' }); expect(JSON.stringify(j)).not.toContain('secret db detail')
  })
})

describe('POST subscribe', () => {
  it('is disabled (503) without VAPID keys, and requires sign-in', async () => {
    delete process.env.VAPID_SUBJECT; expect((await (await load()).POST(req('POST', subscribe(good())))).status).toBe(503); expect(rpcCalls).toHaveLength(0)
    Object.assign(process.env, ENV); vi.resetModules(); authUserId = null; expect((await (await load()).POST(req('POST', subscribe(good())))).status).toBe(401)
  })
  it('saves the browser for the SESSION user with a cleaned label, and returns the device count', async () => {
    const sub = good(); state.saveCount = 3; const res = await (await load()).POST(req('POST', subscribe(sub, { deviceLabel: '  My\u0000 laptop  ', userId: 'evil', p_clerk_user_id: 'evil' })))
    expect(res.status).toBe(200); expect(await res.json()).toEqual({ ok: true, devices: 3 })
    expect(rpcCalls).toEqual([{ fn: 'push_subscription_save', args: { p_clerk_user_id: 'user-123', p_endpoint: sub.endpoint, p_p256dh: sub.p256dh, p_auth: sub.auth, p_device_label: 'My  laptop' } }])
  })
  it('refuses push addresses that are not real push services (the server would POST to them later)', async () => {
    const base = good(); const POST = (await load()).POST; let i = 0
    for (const endpoint of ['http://fcm.googleapis.com/x', 'https://169.254.169.254/latest/meta-data', 'https://127.0.0.1/x', 'https://localhost/x', 'https://evil.example.com/fcm', 'https://fcm.googleapis.com.evil.com/x', 'https://fcm.googleapis.com:8443/x', 'https://user:pw@fcm.googleapis.com/x', '', 'javascript:alert(1)']) {
      authUserId = `ssrf-${i += 1}`; const res = await POST(req('POST', subscribe({ ...base, endpoint }))); expect(res.status, endpoint).toBe(400); expect((await res.json()).error).toBe('INVALID_ENDPOINT')
    }
    expect(rpcCalls).toHaveLength(0)
  })
  it('refuses malformed keys and bodies; allows an operator-listed host', async () => {
    const POST = (await load()).POST; const s = good(); let i = 0; authUserId = 'k0'
    for (const bad of [{ ...s, p256dh: 'short' }, { ...s, auth: 'short' }, { ...s, p256dh: 'A'.repeat(87) + '!' }, { ...s, auth: 'a'.repeat(40) }]) { authUserId = `k${i += 1}`; expect((await POST(req('POST', subscribe(bad)))).status).toBe(400) }
    authUserId = 'b1'; expect((await POST(req('POST', '{nope'))).status).toBe(400); authUserId = 'b2'; expect((await POST(req('POST', '[]'))).status).toBe(400); authUserId = 'b3'; expect((await POST(req('POST', 'x'.repeat(9000)))).status).toBe(413); authUserId = 'b4'; expect((await POST(req('POST', {}))).status).toBe(400)
    expect(rpcCalls).toHaveLength(0)
    process.env.PUSH_ENDPOINT_HOSTS = 'push.corp.example'; vi.resetModules(); authUserId = 'op'; expect((await (await load()).POST(req('POST', subscribe({ ...s, endpoint: 'https://push.corp.example/x' })))).status).toBe(200)
  })
  it('a database failure is a 502 without internals', async () => { state.failOn = 'push_subscription_save'; const res = await (await load()).POST(req('POST', subscribe(good()))); expect(res.status).toBe(502); expect(JSON.stringify(await res.json())).not.toContain('secret db detail') })
  it('is rate limited (30 an hour per user)', async () => {
    const POST = (await load()).POST; authUserId = 'flood'; const codes: number[] = []; for (let i = 0; i < 32; i += 1) codes.push((await POST(req('POST', subscribe(good())))).status)
    expect(codes.slice(0, 30).every((c) => c === 200)).toBe(true); expect(codes.slice(30)).toEqual([429, 429])
  })
})

describe('POST test', () => {
  it('needs a device; then sends an encrypted test the device can read, and records the success', async () => {
    const POST = (await load()).POST; expect((await POST(req('POST', { test: true }))).status).toBe(409)
    const b = browser(); state.subs = [b.sub]; authUserId = 'tester'; const seen: any[] = []
    vi.stubGlobal('fetch', vi.fn(async (u: string, init: any) => { seen.push({ u, init, text: ece.decrypt(init.body, { version: 'aes128gcm', privateKey: b.e, authSecret: b.auth }).toString() }); return { status: 201 } }))
    const res = await POST(req('POST', { test: true })); const j = await res.json(); expect(res.status).toBe(200); expect(j).toMatchObject({ ok: true, sent: 1 }); expect(j.note).toMatch(/accepted the message/)
    expect(JSON.parse(seen[0].text)).toMatchObject({ title: 'Test notification', test: true, tag: 'test' }); expect(seen[0].u).toBe(b.sub.endpoint); expect(seen[0].init.headers.Topic).toBe('test'); expect(rpcCalls.find((c) => c.fn === 'push_subscription_report')!.args).toEqual({ p_gone: [], p_ok: [b.sub.endpoint] }); expect(rpcCalls.filter((c) => c.fn === 'push_subscriptions_for_owner').at(-1)!.args.p_clerk_user_id).toBe('tester') // the devices read are the session user's
  })
  it('a gone browser is forgotten and the owner is told to turn notifications on again; a failing push service is explained', async () => {
    const b = browser(); state.subs = [b.sub]; authUserId = 'gone'
    vi.stubGlobal('fetch', vi.fn(async () => ({ status: 410 }))); let res = await (await load()).POST(req('POST', { test: true })); expect(res.status).toBe(502); expect((await res.json()).message).toMatch(/no longer subscribed/); expect(rpcCalls.find((c) => c.fn === 'push_subscription_report')!.args.p_gone).toEqual([b.sub.endpoint])
    vi.resetModules(); authUserId = 'down'; vi.stubGlobal('fetch', vi.fn(async () => ({ status: 503 }))); res = await (await load()).POST(req('POST', { test: true })); expect((await res.json()).message).toMatch(/did not accept/)
  })
  it('never sends to a stored address that is not an allowed push service', async () => {
    state.subs = [{ ...browser().sub, endpoint: 'https://169.254.169.254/latest' }]; authUserId = 'poison'; const f = vi.fn(); vi.stubGlobal('fetch', f)
    const res = await (await load()).POST(req('POST', { test: true })); expect(res.status).toBe(502); expect(f).not.toHaveBeenCalled()
  })
})

describe('DELETE', () => {
  it('removes only the session user\'s own subscription, and reports whether one was removed', async () => {
    const { DELETE } = await load(); const res = await DELETE(req('DELETE', { endpoint: 'https://fcm.googleapis.com/fcm/send/abc', userId: 'evil' })); expect(await res.json()).toEqual({ ok: true, removed: true })
    expect(rpcCalls).toEqual([{ fn: 'push_subscription_remove', args: { p_clerk_user_id: 'user-123', p_endpoint: 'https://fcm.googleapis.com/fcm/send/abc' } }]); state.removed = false; expect(await (await DELETE(req('DELETE', { endpoint: 'https://x.example/y' }))).json()).toEqual({ ok: true, removed: false })
  })
  it('validates, requires sign-in, and does not leak database errors', async () => {
    const { DELETE } = await load(); expect((await DELETE(req('DELETE', {}))).status).toBe(400); expect((await DELETE(req('DELETE', { endpoint: 'x'.repeat(1100) }))).status).toBe(400); expect((await DELETE(req('DELETE', '{bad'))).status).toBe(400)
    state.failOn = 'push_subscription_remove'; const r = await DELETE(req('DELETE', { endpoint: 'https://a.example/b' })); expect(r.status).toBe(502); expect(JSON.stringify(await r.json())).not.toContain('secret db detail')
    vi.resetModules(); authUserId = null; expect((await (await load()).DELETE(req('DELETE', { endpoint: 'https://a.example/b' }))).status).toBe(401)
  })
})

describe('secrets', () => {
  it('the VAPID private key appears in no response of any method', async () => {
    const m = await load(); const out: string[] = []; authUserId = 'secrets'
    out.push(JSON.stringify(await (await m.GET(req('GET'))).json())); out.push(JSON.stringify(await (await m.POST(req('POST', subscribe({ ...good(), endpoint: 'http://bad' })))).json())); out.push(JSON.stringify(await (await m.POST(req('POST', { test: true }))).json())); out.push(JSON.stringify(await (await m.DELETE(req('DELETE', {}))).json()))
    for (const t of out) expect(t).not.toContain(KEYS.privateKey)
  })
})
