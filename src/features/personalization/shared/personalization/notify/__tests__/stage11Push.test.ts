// @vitest-environment node
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { describe, expect, it, vi } from 'vitest'
import { PUSH_API, PUSH_SW_SCOPE, PUSH_SW_URL, disablePush, enablePush, loadServerInfo, localState, pushSupport, sendTestPush, urlBase64ToBytes, type PushEnv } from '../pushClient'

// ---------------------------------------------------------------- the worker, run in a sandbox with a fake `self`
const SW_SOURCE = fs.readFileSync(path.resolve(__dirname, '../../../../../../../public/push/sw.js'), 'utf8')
function worker(origin = 'https://app.example.com') {
  const handlers: Record<string, (e: any) => void> = {}
  const shown: Array<{ title: string; options: any }> = []; const opened: string[] = []; const claimed: string[] = []
  const state = { windows: [] as any[] }
  const self: any = {
    location: { origin }, addEventListener: (t: string, fn: (e: any) => void) => { handlers[t] = fn },
    registration: { showNotification: vi.fn(async (title: string, options: any) => { shown.push({ title, options }) }) },
    clients: { matchAll: vi.fn(async () => state.windows), openWindow: vi.fn(async (u: string) => { opened.push(u) }), claim: vi.fn(async () => { claimed.push('claim') }) },
    skipWaiting: vi.fn(),
  }
  vm.runInNewContext(SW_SOURCE, { self, URL, Promise, JSON, String }, { filename: 'push-sw.js' })
  const fire = async (type: string, e: any) => { const waits: Promise<unknown>[] = []; handlers[type]({ ...e, waitUntil: (p: Promise<unknown>) => waits.push(p) }); await Promise.all(waits) }
  const push = (data: unknown) => fire('push', { data: data === undefined ? null : { json: () => (typeof data === 'string' && data.startsWith('RAW:') ? JSON.parse('{bad') : data), text: () => (typeof data === 'string' ? data.replace(/^RAW:/, '') : '') } })
  return { self, handlers, shown, opened, claimed, state, fire, push }
}

describe('push worker', () => {
  it('shows exactly what the server sent, clipped and cleaned, linking only into this site', async () => {
    const w = worker(); await w.push({ v: 1, title: 'New lead captured', body: 'A viewer submitted a form.', tag: 'new_lead:abc', url: '/?notification=1111' })
    expect(w.shown).toEqual([{ title: 'New lead captured', options: { body: 'A viewer submitted a form.', data: { url: '/?notification=1111' }, tag: 'new_lead:abc' } }])
    const x = worker(); await x.push({ title: 'T'.repeat(300) + '\u0000x', body: 'b\nb'.repeat(200), tag: 'g'.repeat(200) }); expect(x.shown[0].title).toHaveLength(80); expect(x.shown[0].options.body).toHaveLength(200); expect(x.shown[0].options.body).not.toMatch(/\n/); expect(x.shown[0].options.tag).toHaveLength(60)
  })
  it('always shows something (the browser requires it), even for an empty, unreadable or odd message', async () => {
    for (const data of [undefined, 'RAW:plain words', 'RAW:', [], 5, null, { title: 7, body: {} }]) { const w = worker(); await w.push(data as never); expect(w.shown, JSON.stringify(data)).toHaveLength(1); expect(typeof w.shown[0].title).toBe('string'); expect(w.shown[0].title.length).toBeGreaterThan(0) }
    const w = worker(); await w.push(undefined); expect(w.shown[0].title).toBe('SmartVideo'); const p = worker(); await p.push('RAW:plain words'); expect(p.shown[0].options.body).toBe('plain words')
  })
  it('a message can never point the owner at another site or run script', async () => {
    for (const url of ['https://evil.example/x', '//evil.example/x', 'javascript:alert(1)', 'data:text/html,x', 'http://app.example.com.evil.com/', 5, null, '\\\\evil\\x']) { const w = worker(); await w.push({ title: 't', url }); const got = w.shown[0].options.data.url; expect(got.startsWith('/') && !got.startsWith('//'), String(url)).toBe(true); expect(got, String(url)).not.toMatch(/evil|javascript|data:/) }
    const ok = worker(); await ok.push({ title: 't', url: 'https://app.example.com/watch/abc?x=1#y' }); expect(ok.shown[0].options.data.url).toBe('/watch/abc?x=1#y')
  })
  it('clicking closes the notification and focuses an existing window of this site, sending it to the target', async () => {
    const w = worker(); const nav = vi.fn(async () => 'navigated'); const win = { url: 'https://app.example.com/editor', focus: vi.fn(async () => ({ navigate: nav })) }
    w.state.windows = [{ url: 'https://other.example/', focus: vi.fn() }, win]; const close = vi.fn()
    await w.fire('notificationclick', { notification: { close, data: { url: '/?notification=1' } } })
    expect(close).toHaveBeenCalled(); expect(win.focus).toHaveBeenCalled(); expect(nav).toHaveBeenCalledWith('https://app.example.com/?notification=1'); expect(w.opened).toEqual([])
  })
  it('with no window of this site open it opens one; the target is re-checked at click time', async () => {
    const w = worker(); w.state.windows = [{ url: 'https://other.example/', focus: vi.fn() }]
    await w.fire('notificationclick', { notification: { close: vi.fn(), data: { url: '/watch/abc' } } }); expect(w.opened).toEqual(['https://app.example.com/watch/abc'])
    const x = worker(); await x.fire('notificationclick', { notification: { close: vi.fn(), data: { url: 'https://evil.example/phish' } } }); expect(x.opened).toEqual(['https://app.example.com/'])
    const y = worker(); await y.fire('notificationclick', { notification: { close: vi.fn() } }); expect(y.opened).toEqual(['https://app.example.com/'])
  })
  it('takes over promptly and does nothing else: no fetch handler, so it cannot interfere with the app\'s own worker', () => {
    const w = worker(); expect(Object.keys(w.handlers).sort()).toEqual(['activate', 'install', 'notificationclick', 'push']); w.handlers.install({}); expect(w.self.skipWaiting).toHaveBeenCalled()
    expect(SW_SOURCE).not.toMatch(/addEventListener\(\s*['"]fetch['"]/); expect(PUSH_SW_URL).toBe('/push/sw.js'); expect(PUSH_SW_SCOPE).toBe('/push/')
  })
})

// ---------------------------------------------------------------- the client, with a fake browser
const KEY_BYTES = Uint8Array.from({ length: 65 }, (_, i) => (i === 0 ? 4 : (i * 7) % 256)); const KEY = Buffer.from(KEY_BYTES).toString('base64url')
function fakeBrowser(over: { permission?: NotificationPermission; request?: NotificationPermission | 'throw'; existing?: { key?: Uint8Array } | null; subscribeFails?: boolean; fetch?: (url: string, init: any) => any; support?: Partial<Record<'secure' | 'sw' | 'push' | 'notif', boolean>>; ua?: string } = {}) {
  const log: string[] = []
  let current: any = over.existing === undefined || over.existing === null ? null : { endpoint: 'https://fcm.googleapis.com/fcm/send/old', options: { applicationServerKey: (over.existing.key ?? KEY_BYTES).buffer.slice(0) }, toJSON: () => ({ endpoint: 'https://fcm.googleapis.com/fcm/send/old', keys: { p256dh: 'p'.repeat(87), auth: 'a'.repeat(22) } }), unsubscribe: vi.fn(async () => { log.push('unsubscribe-old'); current = null; return true }) }
  const made = () => ({ endpoint: 'https://fcm.googleapis.com/fcm/send/new', options: {}, toJSON: () => ({ endpoint: 'https://fcm.googleapis.com/fcm/send/new', keys: { p256dh: 'P'.repeat(87), auth: 'A'.repeat(22) } }), unsubscribe: vi.fn(async () => { log.push('unsubscribe-new'); current = null; return true }) })
  const pushManager = { getSubscription: vi.fn(async () => current), subscribe: vi.fn(async (opts: any) => { log.push('subscribe'); if (over.subscribeFails) throw new Error('boom'); current = made(); (current as any).opts = opts; return current }) }
  const reg = { pushManager }
  const sw = { register: vi.fn(async (u: string, o: any) => { log.push(`register ${u} ${o.scope}`); return reg }), ready: Promise.resolve(reg), getRegistration: vi.fn(async () => reg) }
  const Notification = { permission: over.permission ?? 'default', requestPermission: vi.fn(async () => { log.push('prompt'); if (over.request === 'throw') throw new Error('x'); (Notification as any).permission = over.request ?? 'granted'; return over.request ?? 'granted' }) }
  const fetchFn = vi.fn(async (url: string, init: any) => { log.push(`fetch ${init?.method ?? 'GET'}`); return over.fetch ? over.fetch(url, init) : { status: 200, json: async () => ({ ok: true, devices: 2 }) } })
  const sup = { secure: true, sw: true, push: true, notif: true, ...over.support }
  const env: PushEnv = { isSecureContext: sup.secure, navigator: { serviceWorker: sup.sw ? (sw as unknown as ServiceWorkerContainer) : undefined, userAgent: over.ua ?? 'Chrome' }, Notification: sup.notif ? (Notification as never) : undefined, PushManager: sup.push ? {} : undefined, fetchFn: fetchFn as never }
  return { env, log, pushManager, sw, Notification, fetchFn, current: () => current }
}

describe('pushSupport', () => {
  it('names what is missing, with iPhone guidance', () => {
    expect(pushSupport(fakeBrowser().env)).toEqual({ ok: true })
    expect(pushSupport(fakeBrowser({ support: { secure: false } }).env)).toMatchObject({ ok: false, reason: 'insecure' }); expect(pushSupport(fakeBrowser({ support: { sw: false } }).env)).toMatchObject({ reason: 'no-service-worker' })
    expect(pushSupport(fakeBrowser({ support: { notif: false } }).env)).toMatchObject({ reason: 'no-notifications' }); const ios = pushSupport(fakeBrowser({ support: { push: false }, ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)' }).env); expect(ios).toMatchObject({ reason: 'no-push' }); expect((ios as any).message).toMatch(/Home Screen/)
    expect((pushSupport(fakeBrowser({ support: { push: false } }).env) as any).message).not.toMatch(/Home Screen/)
  })
  it('decodes the server key', () => { expect([...urlBase64ToBytes(KEY)]).toEqual([...KEY_BYTES]); expect(urlBase64ToBytes('')).toEqual(new Uint8Array()) })
})

describe('loadServerInfo and localState', () => {
  it('maps the server answer, hides nothing it should not trust, and explains failures', async () => {
    const ok = await loadServerInfo({ fetchFn: vi.fn(async () => ({ status: 200, json: async () => ({ configured: true, publicKey: KEY, devices: [{ label: 'Laptop', createdAt: '2026-11-01', lastSuccessAt: null, secret: 'x' }, { label: 5 }] }) })) as never })
    expect(ok).toEqual({ ok: true, info: { configured: true, publicKey: KEY, devices: [{ label: 'Laptop', createdAt: '2026-11-01', lastSuccessAt: null }, { label: null, createdAt: '', lastSuccessAt: null }] } })
    expect(await loadServerInfo({ fetchFn: vi.fn(async () => ({ status: 401, json: async () => ({}) })) as never })).toMatchObject({ ok: false, reason: 'unauthenticated' }); expect(await loadServerInfo({ fetchFn: vi.fn(async () => { throw new Error('offline') }) as never })).toMatchObject({ ok: false, reason: 'unavailable' })
    expect(await loadServerInfo({ fetchFn: vi.fn(async () => ({ status: 500, json: async () => { throw new Error('bad') } })) as never })).toMatchObject({ ok: false, reason: 'unavailable' })
    const na = await loadServerInfo({ fetchFn: vi.fn(async () => ({ status: 200, json: async () => ({ configured: false, publicKey: null, devices: [], storage: 'unavailable' }) })) as never }); expect(na).toMatchObject({ ok: true, info: { configured: false, publicKey: null, storage: 'unavailable' } })
  })
  it('reports this browser\'s permission and subscription without prompting', async () => {
    const a = fakeBrowser({ permission: 'granted', existing: {} }); expect(await localState(a.env)).toEqual({ permission: 'granted', subscribed: true }); expect(a.Notification.requestPermission).not.toHaveBeenCalled()
    expect(await localState(fakeBrowser({ permission: 'denied' }).env)).toEqual({ permission: 'denied', subscribed: false }); expect(await localState(fakeBrowser({ support: { push: false } }).env)).toEqual({ permission: 'unsupported', subscribed: false })
  })
})

describe('enablePush', () => {
  it('asks permission FIRST (before any network call), registers the worker in its own scope, subscribes with the server key, and tells the server', async () => {
    const b = fakeBrowser(); const r = await enablePush(KEY, b.env, 'My laptop')
    expect(r).toEqual({ ok: true, devices: 2 }); expect(b.log).toEqual(['prompt', `register ${PUSH_SW_URL} ${PUSH_SW_SCOPE}`, 'subscribe', 'fetch POST'])
    const opts = (b.current() as any).opts; expect(opts.userVisibleOnly).toBe(true); expect([...new Uint8Array(opts.applicationServerKey)]).toEqual([...KEY_BYTES])
    const [url, init] = b.fetchFn.mock.calls[0]; expect(url).toBe(PUSH_API); expect(init).toMatchObject({ method: 'POST', credentials: 'same-origin' }); expect(JSON.parse(init.body)).toEqual({ subscription: { endpoint: 'https://fcm.googleapis.com/fcm/send/new', keys: { p256dh: 'P'.repeat(87), auth: 'A'.repeat(22) } }, deviceLabel: 'My laptop' })
  })
  it('does not even prompt when there is no server key or the browser cannot do it', async () => {
    const a = fakeBrowser(); expect(await enablePush(null, a.env)).toMatchObject({ ok: false, reason: 'not-configured' }); expect(a.Notification.requestPermission).not.toHaveBeenCalled()
    const b = fakeBrowser({ support: { sw: false } }); expect(await enablePush(KEY, b.env)).toMatchObject({ ok: false, reason: 'unsupported' }); expect(b.Notification.requestPermission).not.toHaveBeenCalled()
  })
  it('explains a blocked permission and a dismissed prompt, and subscribes to nothing', async () => {
    const denied = fakeBrowser({ permission: 'denied' }); const r = await enablePush(KEY, denied.env); expect(r).toMatchObject({ ok: false, reason: 'denied' }); expect((r as any).message).toMatch(/site settings/); expect(denied.pushManager.subscribe).not.toHaveBeenCalled(); expect(denied.Notification.requestPermission).not.toHaveBeenCalled()
    const refused = fakeBrowser({ request: 'denied' }); expect(await enablePush(KEY, refused.env)).toMatchObject({ reason: 'denied' }); const closed = fakeBrowser({ request: 'default' }); expect(await enablePush(KEY, closed.env)).toMatchObject({ reason: 'dismissed' }); expect(closed.pushManager.subscribe).not.toHaveBeenCalled()
    expect(await enablePush(KEY, fakeBrowser({ request: 'throw' }).env)).toMatchObject({ reason: 'failed' })
  })
  it('reuses a subscription made for the same key, and replaces one made for another key (rotated keys can never receive)', async () => {
    const same = fakeBrowser({ permission: 'granted', existing: {} }); await enablePush(KEY, same.env); expect(same.pushManager.subscribe).not.toHaveBeenCalled(); expect(same.log).not.toContain('unsubscribe-old')
    const other = fakeBrowser({ permission: 'granted', existing: { key: Uint8Array.from({ length: 65 }, () => 9) } }); const r = await enablePush(KEY, other.env); expect(r.ok).toBe(true); expect(other.log.slice(0, 4)).toEqual([`register ${PUSH_SW_URL} ${PUSH_SW_SCOPE}`, 'unsubscribe-old', 'subscribe', 'fetch POST'])
  })
  it('maps every server answer and failure, and undoes the browser side when the server refuses the address', async () => {
    const run = (status: number, json: unknown = {}) => { const b = fakeBrowser({ permission: 'granted', fetch: () => ({ status, json: async () => json }) }); return enablePush(KEY, b.env).then((r) => ({ r, b })) }
    expect((await run(401)).r).toMatchObject({ reason: 'unauthenticated' }); expect((await run(503)).r).toMatchObject({ reason: 'not-configured' }); expect((await run(500)).r).toMatchObject({ reason: 'failed' }); expect((await run(200, { ok: false })).r).toMatchObject({ reason: 'failed' })
    const bad = await run(400, { error: 'INVALID_ENDPOINT' }); expect(bad.r).toMatchObject({ reason: 'rejected' }); expect(bad.b.log).toContain('unsubscribe-new')
    expect(await enablePush(KEY, fakeBrowser({ permission: 'granted', subscribeFails: true }).env)).toMatchObject({ reason: 'failed' }); expect(await enablePush(KEY, fakeBrowser({ permission: 'granted', fetch: () => { throw new Error('offline') } }).env)).toMatchObject({ reason: 'failed' })
  })
})

describe('disablePush and sendTestPush', () => {
  it('tells the server which device to forget, then unsubscribes the browser; says so when the server could not be told', async () => {
    const b = fakeBrowser({ permission: 'granted', existing: {} }); const r = await disablePush(b.env); expect(r).toMatchObject({ ok: true, message: 'Notifications are off in this browser.' })
    expect(b.log).toEqual(['fetch DELETE', 'unsubscribe-old']); expect(JSON.parse(b.fetchFn.mock.calls[0][1].body)).toEqual({ endpoint: 'https://fcm.googleapis.com/fcm/send/old' })
    const off = fakeBrowser({ permission: 'granted', existing: {}, fetch: () => { throw new Error('offline') } }); expect((await disablePush(off.env)).message).toMatch(/server could not be told/); expect(off.log).toContain('unsubscribe-old')
    expect(await disablePush(fakeBrowser().env)).toEqual({ ok: true, message: 'Notifications are already off in this browser.' })
  })
  it('maps test results to plain messages', async () => {
    const t = (status: number, json: unknown) => sendTestPush({ fetchFn: vi.fn(async () => ({ status, json: async () => json })) as never })
    expect(await t(200, { ok: true, sent: 2, note: 'Accepted.' })).toEqual({ ok: true, sent: 2, note: 'Accepted.' }); expect(await t(409, { message: 'Turn notifications on in this browser first.' })).toEqual({ ok: false, message: 'Turn notifications on in this browser first.' })
    expect(await t(429, {})).toMatchObject({ ok: false }); expect((await t(401, {}) as any).message).toMatch(/Sign in/); expect((await t(502, {}) as any).message).toBe('The test could not be sent.'); expect(await sendTestPush({ fetchFn: vi.fn(async () => { throw new Error('x') }) as never })).toEqual({ ok: false, message: 'Could not reach the server.' })
  })
})
