// @vitest-environment node
/* global AbortSignal */
/* eslint-disable no-control-regex */
import { createECDH, createPublicKey, createVerify, randomBytes } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import ece from 'http_ece';
import { MAX_PLAINTEXT, allowedHosts, b64u, buildPayload, encryptPayload, fromB64u, generateVapidKeys, isAllowedPushEndpoint, pushForVideo, sendOne, vapidAuthorization, vapidConfig } from '../_push/webPush.js';

const subject = 'mailto:owner@example.com';
const vapidEnv = () => { const k = generateVapidKeys(); return { VAPID_PUBLIC_KEY: k.publicKey, VAPID_PRIVATE_KEY: k.privateKey, VAPID_SUBJECT: subject, PUSH_ENDPOINT_HOSTS: 'push.test.example' }; };
/** A "browser": owns the subscription keys, so tests can decrypt what the server sends. */
const browser = (host = 'fcm.googleapis.com') => { const ecdh = createECDH('prime256v1'); ecdh.generateKeys(); const auth = randomBytes(16); return { ecdh, auth, sub: { endpoint: `https://${host}/fcm/send/${b64u(randomBytes(12))}`, p256dh: b64u(ecdh.getPublicKey()), auth: b64u(auth) } }; };
const open = (b, body) => ece.decrypt(body, { version: 'aes128gcm', privateKey: b.ecdh, authSecret: b.auth }).toString('utf8');

describe('push endpoint allow-list (the server POSTs to a URL the browser supplied)', () => {
  it('accepts the real push services, including subdomains', () => {
    for (const ok of ['https://fcm.googleapis.com/fcm/send/abc', 'https://updates.push.services.mozilla.com/wpush/v2/abc', 'https://updates-autopush.stage.mozaws.net.push.services.mozilla.com/x', 'https://web.push.apple.com/Qabc', 'https://wns2-par02p.notify.windows.com/?token=abc', 'https://android.googleapis.com/gcm/send/abc'])
      expect(isAllowedPushEndpoint(ok), ok).toBe(true);
  });
  it('refuses everything that could reach somewhere else', () => {
    const bad = ['http://fcm.googleapis.com/x', 'https://169.254.169.254/latest/meta-data', 'https://127.0.0.1/x', 'https://[::1]/x', 'https://10.0.0.5/x', 'https://localhost/x', 'https://2130706433/x',
      'https://fcm.googleapis.com.evil.com/x', 'https://evilfcm.googleapis.com.attacker.io/x', 'https://notfcm.googleapis.org/x', 'https://evil.com/fcm.googleapis.com', 'https://fcm.googleapis.com@evil.com/x', 'https://user:pw@fcm.googleapis.com/x',
      'https://fcm.googleapis.com:8443/x', 'ftp://fcm.googleapis.com/x', 'javascript:alert(1)', 'https://fcm.googleapis.com/x y', '', null, undefined, 5, 'https://' + 'a'.repeat(1100) + '.push.apple.com/x', 'https://push.apple.com.', 'https://a..push.apple.com/x', 'https://-x.push.apple.com/x'];
    for (const b of bad) expect(isAllowedPushEndpoint(b), String(b).slice(0, 50)).toBe(false);
  });
  it('lets the operator add their own push hosts, but only valid hostnames', () => {
    expect(isAllowedPushEndpoint('https://push.corp.example/x')).toBe(false); expect(isAllowedPushEndpoint('https://push.corp.example/x', { PUSH_ENDPOINT_HOSTS: 'push.corp.example' })).toBe(true)
    expect(allowedHosts({ PUSH_ENDPOINT_HOSTS: '10.0.0.1, ,localhost,*.evil.com,ok.example' })).toEqual(expect.arrayContaining(['ok.example'])); expect(allowedHosts({ PUSH_ENDPOINT_HOSTS: '10.0.0.1,localhost,*.evil.com' }).some((h) => /evil|10\.|localhost/.test(h))).toBe(false);
  });
});

describe('VAPID configuration and header (RFC 8292)', () => {
  it('needs a matching key pair and a mailto: or https: subject; anything else is simply "not configured"', () => {
    const e = vapidEnv(); expect(vapidConfig(e)).toMatchObject({ subject }); expect(vapidConfig({})).toBeNull();
    expect(vapidConfig({ ...e, VAPID_PRIVATE_KEY: generateVapidKeys().privateKey })).toBeNull(); // not a pair
    for (const bad of ['', 'owner@example.com', 'http://x.example', 'mailto:nope']) expect(vapidConfig({ ...e, VAPID_SUBJECT: bad }), bad).toBeNull();
    expect(vapidConfig({ ...e, VAPID_PUBLIC_KEY: 'short' })).toBeNull(); expect(vapidConfig({ ...e, VAPID_PRIVATE_KEY: '!!!' })).toBeNull(); expect(vapidConfig({ ...e, VAPID_SUBJECT: 'https://app.example.com' })).not.toBeNull();
  });
  it('signs an ES256 JWT that verifies with the PUBLIC key alone, for this endpoint\'s origin, expiring within 12 hours', () => {
    const cfg = vapidConfig(vapidEnv()); const now = Date.UTC(2026, 10, 13, 12, 0, 0)
    const h = vapidAuthorization(cfg, 'https://fcm.googleapis.com/fcm/send/abc', now); const m = /^vapid t=([\w-]+\.[\w-]+\.[\w-]+), k=([\w-]+)$/.exec(h); expect(m).not.toBeNull()
    const [head, claims, sig] = m[1].split('.'); expect(m[2]).toBe(cfg.publicKey)
    expect(JSON.parse(fromB64u(head).toString())).toEqual({ typ: 'JWT', alg: 'ES256' }); const c = JSON.parse(fromB64u(claims).toString())
    expect(c).toEqual({ aud: 'https://fcm.googleapis.com', exp: Math.floor(now / 1000) + 43200, sub: subject })
    const pub = fromB64u(cfg.publicKey); const key = createPublicKey({ key: { kty: 'EC', crv: 'P-256', x: b64u(pub.subarray(1, 33)), y: b64u(pub.subarray(33)) }, format: 'jwk' })
    const verify = (data, s) => createVerify('SHA256').update(data).verify({ key, dsaEncoding: 'ieee-p1363' }, fromB64u(s))
    expect(fromB64u(sig).length).toBe(64); expect(verify(`${head}.${claims}`, sig)).toBe(true)
    expect(verify(`${head}.${b64u(JSON.stringify({ ...c, aud: 'https://evil.example' }))}`, sig)).toBe(false) // a changed audience invalidates it
  });
});

describe('message encryption (RFC 8291), checked by an independent implementation', () => {
  it('decrypts with Mozilla\'s http_ece to exactly what was sent, for ASCII, unicode and empty payloads', () => {
    for (const text of ['hello', 'Neue Anfrage ✓ — 你好 🎉', '', JSON.stringify({ title: 'New lead', body: 'x'.repeat(1500) })]) {
      const b = browser(); const body = encryptPayload({ ...b.sub, plaintext: text }); expect(open(b, body)).toBe(text)
    }
  });
  it('has the header the standard requires: salt, record size 4096, a 65-byte sender key', () => {
    const b = browser(); const body = encryptPayload({ ...b.sub, plaintext: 'x' })
    expect(body.readUInt32BE(16)).toBe(4096); expect(body[20]).toBe(65); expect(body[21]).toBe(4); expect(body.length).toBe(16 + 4 + 1 + 65 + 1 + 1 + 16)
  });
  it('uses a fresh key and salt every time, and only the intended browser can read it', () => {
    const a = browser(); const other = browser(); const m1 = encryptPayload({ ...a.sub, plaintext: 'same' }); const m2 = encryptPayload({ ...a.sub, plaintext: 'same' })
    expect(m1.equals(m2)).toBe(false); expect(m1.subarray(0, 16).equals(m2.subarray(0, 16))).toBe(false); expect(m1.subarray(21, 86).equals(m2.subarray(21, 86))).toBe(false)
    expect(() => open(other, m1)).toThrow(); expect(open(a, m1)).toBe('same')
  });
  it('a modified message does not decrypt (authenticated)', () => {
    const b = browser(); const body = encryptPayload({ ...b.sub, plaintext: 'secret' })
    for (const i of [body.length - 1, 90, 5]) { const t = Buffer.from(body); t[i] ^= 1; expect(() => open(b, t), `byte ${i}`).toThrow() }
  });
  it('refuses bad subscription keys and oversized payloads instead of sending garbage', () => {
    const b = browser(); const bad = [{ ...b.sub, p256dh: 'AAAA' }, { ...b.sub, p256dh: b64u(Buffer.alloc(65, 1)) }, { ...b.sub, auth: b64u(randomBytes(8)) }, { ...b.sub, p256dh: b64u(Buffer.concat([Buffer.from([2]), randomBytes(64)])) }]
    for (const s of bad) expect(() => encryptPayload({ ...s, plaintext: 'x' })).toThrow()
    expect(() => encryptPayload({ ...b.sub, plaintext: 'x'.repeat(MAX_PLAINTEXT + 1) })).toThrow(/too large/); expect(() => encryptPayload({ ...b.sub, plaintext: 'x'.repeat(MAX_PLAINTEXT) })).not.toThrow()
  });
  it('matches the standard\'s key schedule for a pinned key and salt (same inputs, same bytes), and decrypts', () => {
    const b = browser(); const es = createECDH('prime256v1'); es.generateKeys(); const salt = randomBytes(16)
    const one = encryptPayload({ ...b.sub, plaintext: 'pinned', ephemeral: es, salt }); const two = encryptPayload({ ...b.sub, plaintext: 'pinned', ephemeral: es, salt })
    expect(one.equals(two)).toBe(true); expect(open(b, one)).toBe('pinned')
  });
});

describe('sendOne', () => {
  const cfg = () => vapidConfig(vapidEnv()); const env = { PUSH_ENDPOINT_HOSTS: 'push.test.example' }
  const fetchReturning = (status) => vi.fn(async () => ({ status }));
  it('POSTs the encrypted body with the standard headers, never follows redirects, and bounds the wait', async () => {
    const b = browser(); const f = fetchReturning(201)
    const r = await sendOne({ sub: b.sub, payload: '{"hi":1}', vapid: cfg(), fetchImpl: f, topic: 'new_lead', ttl: 600 })
    expect(r).toEqual({ status: 'sent', httpStatus: 201 }); const [url, init] = f.mock.calls[0]
    expect(url).toBe(b.sub.endpoint); expect(init).toMatchObject({ method: 'POST', redirect: 'manual' }); expect(init.signal).toBeInstanceOf(AbortSignal)
    expect(init.headers).toMatchObject({ 'Content-Encoding': 'aes128gcm', 'Content-Type': 'application/octet-stream', TTL: '600', Urgency: 'normal', Topic: 'new_lead' }); expect(init.headers.Authorization).toMatch(/^vapid t=.+, k=.+$/)
    expect(open(b, init.body)).toBe('{"hi":1}')
  });
  it('maps responses: 404/410 = gone, other errors = failed, a network error = failed (never throws)', async () => {
    const b = browser(); const run = (f) => sendOne({ sub: b.sub, payload: 'x', vapid: cfg(), fetchImpl: f })
    expect((await run(fetchReturning(410))).status).toBe('gone'); expect((await run(fetchReturning(404))).status).toBe('gone')
    for (const s of [400, 401, 403, 413, 429, 500, 503]) expect((await run(fetchReturning(s))).status, String(s)).toBe('failed')
    expect(await run(vi.fn(async () => { throw new Error('ECONNRESET 10.0.0.1') }))).toEqual({ status: 'failed', reason: 'network' })
  });
  it('rejects without any network call: disallowed endpoints, bad keys, oversized payloads; and drops an invalid Topic', async () => {
    const f = vi.fn(); const b = browser()
    expect((await sendOne({ sub: { ...b.sub, endpoint: 'https://169.254.169.254/x' }, payload: 'x', vapid: cfg(), fetchImpl: f })).reason).toBe('endpoint-not-allowed')
    expect((await sendOne({ sub: { ...b.sub, p256dh: 'AAAA' }, payload: 'x', vapid: cfg(), fetchImpl: f })).status).toBe('rejected'); expect((await sendOne({ sub: b.sub, payload: 'x'.repeat(5000), vapid: cfg(), fetchImpl: f })).status).toBe('rejected')
    expect(f).not.toHaveBeenCalled()
    const g = fetchReturning(201); await sendOne({ sub: b.sub, payload: 'x', vapid: cfg(), fetchImpl: g, topic: 'bad topic!' }); expect(g.mock.calls[0][1].headers.Topic).toBeUndefined()
    expect(isAllowedPushEndpoint(browser('push.test.example').sub.endpoint, env)).toBe(true)
  });
});

describe('buildPayload', () => {
  it('keeps owner text short and clean, links only inside the app, and marks tests', () => {
    const p = JSON.parse(buildPayload({ id: '11111111-1111-4111-8111-111111111111', type: 'new_lead', title: 'New\u0000 lead' + 'x'.repeat(200), summary: 'A viewer\nsubmitted a form' + 'y'.repeat(500), video_id: 'vidAAAAAAAA' }))
    expect(p.title.length).toBe(80); expect(p.title).not.toMatch(/\u0000/); expect(p.body.length).toBe(200); expect(p.body).not.toMatch(/\n/); expect(p.url).toBe('/?notification=11111111-1111-4111-8111-111111111111'); expect(p.tag).toBe('new_lead:vidAAAAAAAA'); expect(p.test).toBe(false)
    expect(JSON.parse(buildPayload({ title: 'Test' }, { test: true }))).toMatchObject({ test: true, tag: 'test', url: '/' }); expect(JSON.parse(buildPayload({ id: '../../x?y=1&z', title: 't' })).url).toBe('/?notification=..%2F..%2Fx%3Fy%3D1%26z')
    expect(Buffer.byteLength(buildPayload({ title: '€'.repeat(500), summary: '€'.repeat(500), type: 'x'.repeat(100), video_id: 'v'.repeat(100) }))).toBeLessThanOrEqual(MAX_PLAINTEXT)
  });
});

describe('pushForVideo', () => {
  const note = (i, over = {}) => ({ id: `1111111${i}-1111-4111-8111-111111111111`, type: 'new_lead', title: `New lead ${i}`, summary: `Summary ${i}`, video_id: 'vidAAAAAAAA', ...over });
  /** A fake database: claim returns the alerts once; the browsers hold the keys. */
  const world = (nBrowsers = 2, notes = [note(1), note(2)]) => {
    const browsers = Array.from({ length: nBrowsers }, () => browser()); let pending = notes; const calls = []
    const rpc = vi.fn(async (name, args) => { calls.push([name, args]); if (name === 'rate_limit_check') return { allowed: true }; if (name === 'push_claim_for_video') { const n = pending; pending = []; return { notifications: n, subscriptions: n.length ? browsers.map((b) => b.sub) : [] } } return null })
    return { browsers, rpc, calls }
  };
  it('does nothing (and touches nothing) when VAPID is not configured', async () => {
    const w = world(); expect(await pushForVideo({ videoId: 'vidAAAAAAAA', rpc: w.rpc, env: {}, fetchImpl: vi.fn() })).toEqual({ skipped: 'not-configured', sent: 0 }); expect(w.rpc).not.toHaveBeenCalled()
  });
  it('claims once, sends every alert to every device, and each device can read exactly its alerts', async () => {
    const w = world(); const seen = []; const fetchImpl = vi.fn(async (url, init) => { const b = w.browsers.find((x) => x.sub.endpoint === url); seen.push([b, JSON.parse(open(b, init.body))]); return { status: 201 } })
    const r = await pushForVideo({ videoId: 'vidAAAAAAAA', rpc: w.rpc, env: vapidEnv(), fetchImpl }); expect(r).toMatchObject({ sent: 4, gone: 0, failed: 0 })
    expect(seen).toHaveLength(4); expect(seen.map(([, p]) => p.title).sort()).toEqual(['New lead 1', 'New lead 1', 'New lead 2', 'New lead 2'])
    expect(w.calls.filter(([n]) => n === 'push_claim_for_video')).toHaveLength(1); expect(w.calls.find(([n]) => n === 'push_subscription_report')[1].p_ok.sort()).toEqual(w.browsers.map((b) => b.sub.endpoint).sort())
    // a second event for the same video finds nothing left to push: at-most-once
    expect(await pushForVideo({ videoId: 'vidAAAAAAAA', rpc: w.rpc, env: vapidEnv(), fetchImpl })).toEqual({ sent: 0 }); expect(fetchImpl).toHaveBeenCalledTimes(4)
  });
  it('forgets devices the push service says are gone, and keeps counting the rest', async () => {
    const w = world(2, [note(1)]); const dead = w.browsers[0].sub.endpoint
    const r = await pushForVideo({ videoId: 'v', rpc: w.rpc, env: vapidEnv(), fetchImpl: vi.fn(async (url) => ({ status: url === dead ? 410 : 201 })) })
    expect(r).toMatchObject({ sent: 1, gone: 1 }); expect(w.calls.find(([n]) => n === 'push_subscription_report')[1]).toEqual({ p_gone: [dead], p_ok: [w.browsers[1].sub.endpoint] })
  });
  it('never sends to a stored endpoint that is not an allowed push service (a poisoned row)', async () => {
    const w = world(1, [note(1)]); const evil = { ...w.browsers[0].sub, endpoint: 'https://169.254.169.254/latest' }
    const rpc = vi.fn(async (name) => (name === 'push_claim_for_video' ? { notifications: [note(1)], subscriptions: [evil, w.browsers[0].sub] } : { allowed: true })); const fetchImpl = vi.fn(async () => ({ status: 201 }))
    const r = await pushForVideo({ videoId: 'v', rpc, env: vapidEnv(), fetchImpl }); expect(r).toMatchObject({ sent: 1, rejected: 1 }); expect(fetchImpl.mock.calls.map((c) => c[0])).toEqual([w.browsers[0].sub.endpoint])
  });
  it('is rate limited per video (no claim, no sending) and survives a database failure without throwing', async () => {
    const f = vi.fn(); expect(await pushForVideo({ videoId: 'v', rpc: vi.fn(async () => ({ allowed: false })), env: vapidEnv(), fetchImpl: f })).toEqual({ skipped: 'rate-limited', sent: 0 })
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {}); expect(await pushForVideo({ videoId: 'v', rpc: vi.fn(async () => { throw new Error('db down'); }), env: vapidEnv(), fetchImpl: f })).toEqual({ skipped: 'error', sent: 0 }); warn.mockRestore(); expect(f).not.toHaveBeenCalled()
  });
  it('caps the fan-out: at most 10 devices per alert', async () => {
    const w = world(14, [note(1)]); const f = vi.fn(async () => ({ status: 201 })); const r = await pushForVideo({ videoId: 'v', rpc: w.rpc, env: vapidEnv(), fetchImpl: f }); expect(r.sent).toBe(10); expect(f).toHaveBeenCalledTimes(10)
  });
});
