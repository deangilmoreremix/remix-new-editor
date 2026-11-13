import { describe, expect, it, vi } from 'vitest'
import { checkEmail, defaultEmail, hasBlockingProblems, isEmailAddress, isSafeUrl, mergeEmail, mergeFields, normalizeEmail, toPlainText, unfilledFields, type OutreachEmail } from '../emailModel'
import { htmlProblems, renderEmail } from '../renderEmail'
import { buildEml, encodeWord } from '../eml'
import { hashAddress, listUnsubscribeHeaders, normalizeAddress, planRecipients, safeEqual, signUnsubscribe, TOKEN_MAX_AGE_DAYS, unsubscribeUrl, verifyUnsubscribe } from '../unsubscribe'
import { OUTREACH_API, sendTestEmail } from '../outreachClient'

const SECRET = 'a-long-enough-test-secret-0123456789'
const ready = (over: Partial<OutreachEmail> = {}): OutreachEmail => normalizeEmail({
  ...defaultEmail({ name: 'Dana Roe', address: 'dana@example.com', postalAddress: '1 Main St, Springfield' }, { videoUrl: 'https://app.example.com/watch/abc?r=tok', heroUrl: 'https://cdn.example.com/hero.gif', unsubscribeUrl: 'https://app.example.com/api/outreach-unsubscribe?t=x' }),
  ...over,
})

describe('email model', () => {
  it('validates urls and addresses strictly', () => {
    expect(isSafeUrl('https://a.example/x?y=1')).toBe(true)
    for (const bad of ['javascript:alert(1)', 'data:text/html,x', 'ftp://x.y', 'https://a b', 'https://a"onload=1', '', null, 5]) expect(isSafeUrl(bad)).toBe(false)
    expect(isEmailAddress('a@b.co')).toBe(true)
    for (const bad of ['a@b', 'a b@c.de', 'a@b.c', '<a@b.com>', 'a@b.com, c@d.com', 'a@b.com\nBcc: x@y.com']) expect(isEmailAddress(bad)).toBe(false)
  })
  it('normalizes hostile input: strips unsafe urls, newlines and caps lengths', () => {
    const e = normalizeEmail({ subject: 'Hi\nBcc: x@y.com', body: ['a', '', 'b'], cta: { label: 'Go', url: 'javascript:alert(1)' }, hero: { url: 'data:image/gif;base64,AAAA', alt: 'x' }, unsubscribeUrl: 'javascript:x', sender: { postalAddress: 'A\nB' } })
    expect(e.subject).toBe('Hi Bcc: x@y.com')
    expect(e.body).toEqual(['a', 'b'])
    expect(e.cta).toBeUndefined(); expect(e.hero).toBeUndefined(); expect(e.unsubscribeUrl).toBe('')
    expect(e.sender.postalAddress).toBe('A, B')
    expect(normalizeEmail(null).body).toEqual([])
    expect(normalizeEmail({ body: Array.from({ length: 40 }, () => 'x') }).body).toHaveLength(12)
  })
  it('merges fields as text only; unknown fields stay visible and are reported', () => {
    expect(mergeFields('Hi {{ firstName }} at {{company}} {{nope}}', { firstName: ' Ann ', company: '' })).toBe('Hi Ann at {{company}} {{nope}}')
    const e = ready()
    expect(unfilledFields(e).sort()).toEqual(['company', 'firstName'])
    const m = mergeEmail(e, { firstName: 'Ann', company: 'Acme' })
    expect(m.subject).toBe('Ann, a quick video for Acme'); expect(unfilledFields(m)).toEqual([])
    expect(mergeFields('{{a}}', { a: 'x'.repeat(500) })).toHaveLength(200)
  })
  it('checks block on what must exist and warn on what hurts delivery', () => {
    expect(hasBlockingProblems(checkEmail(ready()))).toBe(false)
    const ids = (e: OutreachEmail) => checkEmail(e).filter((c) => c.level === 'error').map((c) => c.id).sort()
    expect(ids(normalizeEmail({}))).toEqual(['body-missing', 'postal-address', 'sender-address', 'sender-name', 'subject-missing', 'unsubscribe-missing'])
    expect(ids(ready({ unsubscribeUrl: '' }))).toEqual(['unsubscribe-missing'])
    expect(ids(ready({ sender: { name: 'x', address: 'x@y.com', postalAddress: '' } }))).toEqual(['postal-address'])
    expect(ids(ready({ hero: { url: 'https://c.example/h.gif', alt: '' } }))).toEqual(['hero-alt'])
    const warns = checkEmail(ready({ subject: 'ACT NOW FREE MONEY WINNER!!!', preheader: '' })).filter((c) => c.level === 'warn').map((c) => c.id)
    expect(warns).toEqual(expect.arrayContaining(['subject-caps', 'subject-spammy', 'preheader-missing']))
  })
  it('plain text carries the links, sender, postal address and unsubscribe', () => {
    const t = toPlainText(mergeEmail(ready(), { firstName: 'Ann', company: 'Acme' }))
    expect(t).toContain('Hi Ann,'); expect(t).toContain('Watch your video: https://app.example.com/watch/abc?r=tok')
    expect(t).toContain('1 Main St, Springfield'); expect(t).toContain('Unsubscribe: https://app.example.com/api/outreach-unsubscribe?t=x')
    expect(t).not.toMatch(/<[a-z]/i)
  })
})

describe('rendered HTML', () => {
  it('renders a complete, safe email with the GIF linked to the video and a real unsubscribe link', async () => {
    const r = await renderEmail(mergeEmail(ready(), { firstName: 'Ann', company: 'Acme' }))
    expect(r.blocked).toBe(false)
    expect(r.html).toMatch(/^<!DOCTYPE html/i)
    expect(r.html).toContain('href="https://app.example.com/watch/abc?r=tok"')
    expect(r.html).toMatch(/<img[^>]*alt="A short personal video for Acme"[^>]*src="https:\/\/cdn\.example\.com\/hero\.gif"/)
    expect(r.html).toContain('api/outreach-unsubscribe?t=x'); expect(r.html).toContain('1 Main St, Springfield')
    expect(htmlProblems(r.html)).toEqual([])
    expect(r.htmlBytes).toBeLessThan(102 * 1024 * 0.8)
  })
  it('hostile merge values are escaped as text, never become markup', async () => {
    const evil = '<script>alert(1)</script><img src=x onerror=alert(1)>"\'>'
    const r = await renderEmail(mergeEmail(ready(), { firstName: evil, company: evil }))
    expect(htmlProblems(r.html)).toEqual([])
    expect(r.html).not.toContain('<script>'); expect(r.html).not.toContain('<img src=x')
    expect(r.html).toContain('&lt;script&gt;')
  })
  it('is blocked when something required is missing, and refuses unsafe urls instead of emitting them', async () => {
    const r = await renderEmail(ready({ unsubscribeUrl: '' }))
    expect(r.blocked).toBe(true)
    const j = await renderEmail(normalizeEmail({ ...ready(), cta: { label: 'x', url: 'javascript:alert(1)' } }))
    expect(j.html).not.toMatch(/javascript:/i)
  })
  it('warns when the HTML approaches the Gmail clipping size', async () => {
    const big = ready({ body: Array.from({ length: 12 }, () => 'word '.repeat(240)) })
    const r = await renderEmail(big)
    expect(r.htmlBytes).toBeGreaterThan(0)
    if (r.htmlBytes > 102 * 1024 * 0.8) expect(r.checks.some((c) => c.id === 'html-heavy')).toBe(true)
  })
  it('htmlProblems finds each class of unsafe or broken markup', () => {
    expect(htmlProblems('<script>x</script>')).toHaveLength(1)
    expect(htmlProblems('<a onclick="x" href="https://a.b">')).toContain('contains an inline event handler')
    expect(htmlProblems('<a href="javascript:x">')).toEqual(expect.arrayContaining(['contains a javascript:/data: URL']))
    expect(htmlProblems('<iframe></iframe>')).toContain('contains an iframe, object, embed or form')
    expect(htmlProblems('<img src="https://a.b/c.gif">')).toContain('has an image without alt text')
    expect(htmlProblems('<a href="ftp://a.b">')[0]).toMatch(/not http/)
    expect(htmlProblems('<a href="https://a.b/?x=1&amp;y=2">ok</a>')).toEqual([])
  })
})

describe('.eml', () => {
  const base = { from: { name: 'Dana Roe', address: 'dana@example.com' }, to: 'ann@example.com', subject: 'Hello', html: '<p>Hi</p>', text: 'Hi', date: new Date('2026-11-01T00:00:00Z'), boundary: 'BND' }
  it('builds multipart/alternative with base64 parts that decode back', () => {
    const eml = buildEml({ ...base, html: '<p>héllo ✓</p>' })
    expect(eml).toMatch(/Content-Type: multipart\/alternative; boundary="BND"/)
    const parts = eml.split('--BND').slice(1, 3)
    const dec = (p: string) => Buffer.from(p.split('\r\n\r\n')[1].replace(/\s+/g, ''), 'base64').toString('utf8')
    expect(dec(parts[0])).toBe('Hi'); expect(dec(parts[1])).toBe('<p>héllo ✓</p>')
    expect(eml.trimEnd().endsWith('--BND--')).toBe(true)
    expect(eml.split('\r\n').every((l) => l.length <= 998)).toBe(true)
  })
  it('encodes non-ASCII subjects (RFC 2047) and cannot be header-injected', () => {
    expect(encodeWord('Hello')).toBe('Hello')
    expect(encodeWord('Café ✓')).toMatch(/^=\?UTF-8\?B\?[A-Za-z0-9+/=]+\?=$/)
    const eml = buildEml({ ...base, subject: 'Hi\r\nBcc: evil@x.com', to: 'a@b.com\r\nBcc: evil@x.com', headers: { 'X-Ok': 'v\r\nBcc: evil@x.com', 'bad header': 'x' } })
    const head = eml.split('\r\n\r\n')[0].split('\r\n')
    expect(head.some((l) => /^Bcc:/i.test(l))).toBe(false)
    expect(head.some((l) => l.startsWith('bad header'))).toBe(false)
  })
})

describe('unsubscribe tokens', () => {
  const owner = 'user_123'
  it('round-trips and carries a hash, not the address', async () => {
    const hash = await hashAddress(' Ann@Example.com ')
    expect(hash).toBe(await hashAddress('ann@example.com')); expect(hash).toMatch(/^[a-f0-9]{64}$/)
    const t = await signUnsubscribe(SECRET, { owner, hash })
    expect(t).not.toContain('ann'); expect(t.length).toBeLessThan(600)
    const v = await verifyUnsubscribe(SECRET, t)
    expect(v).toMatchObject({ ok: true, owner, hash })
  })
  it('rejects tampering, wrong secret, malformed input, expiry and future-dated tokens', async () => {
    const hash = await hashAddress('a@b.co')
    const t = await signUnsubscribe(SECRET, { owner, hash })
    const [body, sig] = t.split('.')
    const forged = Buffer.from(JSON.stringify({ o: 'someone_else', h: hash, t: Math.floor(Date.now() / 1000) })).toString('base64url')
    expect(await verifyUnsubscribe(SECRET, `${forged}.${sig}`)).toEqual({ ok: false, reason: 'bad-signature' })
    expect(await verifyUnsubscribe(SECRET, `${body}.${sig.slice(0, -2)}AA`)).toEqual({ ok: false, reason: 'bad-signature' })
    expect(await verifyUnsubscribe(SECRET + 'x', t)).toEqual({ ok: false, reason: 'bad-signature' })
    for (const bad of ['', 'abc', 'a.b.c', null, 5, {}, 'x'.repeat(700), '!!.??']) expect((await verifyUnsubscribe(SECRET, bad as unknown)).ok).toBe(false)
    expect(await verifyUnsubscribe('short', t)).toEqual({ ok: false, reason: 'unconfigured' })
    const old = await signUnsubscribe(SECRET, { owner, hash, issuedAt: Math.floor(Date.now() / 1000) - (TOKEN_MAX_AGE_DAYS + 1) * 86400 })
    expect(await verifyUnsubscribe(SECRET, old)).toEqual({ ok: false, reason: 'expired' })
    const future = await signUnsubscribe(SECRET, { owner, hash, issuedAt: Math.floor(Date.now() / 1000) + 3600 })
    expect(await verifyUnsubscribe(SECRET, future)).toEqual({ ok: false, reason: 'expired' })
    await expect(signUnsubscribe('short', { owner, hash })).rejects.toThrow()
    await expect(signUnsubscribe(SECRET, { owner, hash: 'nothex' })).rejects.toThrow()
  })
  it('compares in constant shape and builds the url and one-click headers', async () => {
    expect(safeEqual(new Uint8Array([1, 2, 3]), new Uint8Array([1, 2, 3]))).toBe(true)
    expect(safeEqual(new Uint8Array([1, 2, 3]), new Uint8Array([1, 2, 4]))).toBe(false)
    expect(safeEqual(new Uint8Array([1, 2]), new Uint8Array([1, 2, 0]))).toBe(false)
    expect(unsubscribeUrl('https://app.example.com/x/y', 'a.b')).toBe('https://app.example.com/api/outreach-unsubscribe?t=a.b')
    const h = listUnsubscribeHeaders('https://u.example/x', 'unsub@example.com')
    expect(h['List-Unsubscribe']).toBe('<https://u.example/x>, <mailto:unsub@example.com?subject=unsubscribe>')
    expect(h['List-Unsubscribe-Post']).toBe('List-Unsubscribe=One-Click')
    expect(normalizeAddress(' A@B.Com ')).toBe('a@b.com')
  })
  it('plans recipients: invalid, duplicate (case-insensitive) and suppressed addresses are never in the allowed list', async () => {
    const sup = [await hashAddress('gone@example.com')]
    const plan = await planRecipients([{ email: 'a@example.com' }, { email: 'A@Example.com' }, { email: 'gone@example.com' }, { email: 'nope' }, { email: 'b@example.com', values: { firstName: 'B' } }], sup, isEmailAddress)
    expect(plan.allowed.map((r) => r.email)).toEqual(['a@example.com', 'b@example.com'])
    expect(plan.suppressed.map((r) => r.email)).toEqual(['gone@example.com'])
    expect(plan.duplicates).toEqual(['a@example.com']); expect(plan.invalid).toHaveLength(1)
  })
})

describe('outreach client', () => {
  const mk = (status: number, body: unknown) => vi.fn(async () => ({ status, json: async () => body })) as unknown as typeof fetch
  const send = (f: typeof fetch) => sendTestEmail('me@example.com', ready(), { firstName: 'A' }, f)
  it('sends only the test mode with same-origin credentials and returns the honest note', async () => {
    const f = mk(200, { ok: true, messageId: '<id@x>', note: 'Accepted by the mail server.' })
    expect(await send(f)).toEqual({ ok: true, messageId: '<id@x>', note: 'Accepted by the mail server.' })
    const [url, init] = (f as unknown as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(url).toBe(OUTREACH_API); expect(init.credentials).toBe('same-origin')
    expect(JSON.parse(init.body)).toMatchObject({ mode: 'test', to: 'me@example.com' })
  })
  it('maps every status to a typed, human result and never throws', async () => {
    const reasons: Array<[number, unknown, string]> = [[401, {}, 'unauthenticated'], [503, {}, 'not-configured'], [403, {}, 'not-allowed'], [409, {}, 'suppressed'], [429, {}, 'rate-limited'], [400, { error: 'EMAIL_NOT_READY' }, 'not-ready'], [400, {}, 'invalid'], [501, {}, 'unavailable'], [500, {}, 'failed'], [200, { ok: false }, 'failed']]
    for (const [s, b, reason] of reasons) { const r = await send(mk(s, b)); expect(r.ok).toBe(false); if (!r.ok) { expect(r.reason).toBe(reason); expect(r.message.length).toBeGreaterThan(10) } }
    const nr = await send(mk(400, { error: 'EMAIL_NOT_READY', checks: [{ id: 'subject-missing', message: 'Add a subject line.' }] }))
    expect(!nr.ok && nr.checks).toEqual([{ id: 'subject-missing', message: 'Add a subject line.' }])
    const down = await send((async () => { throw new Error('offline') }) as unknown as typeof fetch)
    expect(down).toMatchObject({ ok: false, reason: 'unavailable' })
    expect(await send(vi.fn(async () => ({ status: 502, json: async () => { throw new Error('bad') } })) as unknown as typeof fetch)).toMatchObject({ ok: false, reason: 'failed' })
  })
})
