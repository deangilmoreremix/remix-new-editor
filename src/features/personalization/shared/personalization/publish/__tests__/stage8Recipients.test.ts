/**
 * Stage 8 — recipient tokens and the browser client: token shape/entropy/hash, label planning, URLs, CSV safety, query parsing,
 * expiry, and the client's mapping of every server answer to a message the owner can act on.
 */
import { describe, expect, it, vi } from 'vitest'
import {
  HASH_PATTERN, MAX_EXPIRY_DAYS, MAX_ISSUE_BATCH, TOKEN_LENGTH, buildRecipientUrl, expiryFromDays, generateRecipientToken, hashRecipientToken, isRecipientToken, isVideoId,
  linksToCsv, looksRandom, planLabels, recipientFromSearch,
} from '../recipientToken'
import { issueRecipientLinks, listRecipientLinks, parseVideoId, revokeRecipientLink } from '../recipientLinksClient'

const VID = 'vidAAAAAAAA'
const res = (status: number, json: unknown) => vi.fn(async () => ({ status, json: async () => json })) as unknown as typeof fetch
const resText = (status: number) => vi.fn(async () => ({ status, json: async () => { throw new Error('not json') } })) as unknown as typeof fetch

describe('tokens', () => {
  it('are 32 URL-safe characters from 192 bits of randomness, and differ every time', () => {
    const seen = new Set<string>()
    for (let i = 0; i < 500; i++) { const t = generateRecipientToken(); expect(t).toHaveLength(TOKEN_LENGTH); expect(isRecipientToken(t)).toBe(true); expect(looksRandom(t)).toBe(true); seen.add(t) }
    expect(seen.size).toBe(500)
  })
  it('use every one of the 64 symbols roughly equally (no obvious bias) and never pad or use +/', () => {
    const counts = new Map<string, number>(); let total = 0
    for (let i = 0; i < 2000; i++) for (const c of generateRecipientToken()) { counts.set(c, (counts.get(c) ?? 0) + 1); total++ }
    expect(counts.size).toBe(64); const expected = total / 64; for (const [, n] of counts) { expect(n).toBeGreaterThan(expected * 0.8); expect(n).toBeLessThan(expected * 1.2) }
    for (const c of counts.keys()) expect(c).toMatch(/[A-Za-z0-9_-]/)
  })
  it('encode exactly the bytes the random source gave (injectable) and refuse a short source', () => {
    expect(generateRecipientToken(() => new Uint8Array(24))).toBe('A'.repeat(32)); expect(generateRecipientToken(() => new Uint8Array(24).fill(255))).toBe('_'.repeat(32))
    expect(() => generateRecipientToken(() => new Uint8Array(8))).toThrow(/wrong number of bytes/)
  })
  it('validation: only well-formed tokens pass; hostile values do not', () => {
    for (const bad of ['', 'short', 'x'.repeat(33), 'x'.repeat(31) + '+', 'x'.repeat(31) + '=', "x'; drop table a; --xxxxxxxxxxxxxxx", null, undefined, 5, {}, 'x'.repeat(31) + '\n']) expect(isRecipientToken(bad as never), String(bad)).toBe(false)
    expect(looksRandom('A'.repeat(32))).toBe(false); expect(looksRandom('ab'.repeat(16))).toBe(false)
  })
  it('hash is sha-256 hex of the token (matches the published test vector), stable, refuses non-tokens', async () => {
    const t = 'Abcdefghijklmnopqrstuvwxyz012345'; const h = await hashRecipientToken(t); expect(h).toMatch(HASH_PATTERN); expect(await hashRecipientToken(t)).toBe(h)
    const { createHash } = await import('node:crypto'); expect(h).toBe(createHash('sha256').update(t).digest('hex'))
    expect(await hashRecipientToken('B' + t.slice(1))).not.toBe(h); await expect(hashRecipientToken('nope')).rejects.toThrow(/Not a recipient token/)
  })
})

describe('labels, urls, csv, expiry', () => {
  it('planLabels trims, collapses spaces, drops empties/duplicates/too-long with reasons, flags oversize batches', () => {
    const p = planLabels(['  Acme   Roofing ', 'acme roofing', '', '   ', 'x'.repeat(81), 'Bright', 7 as never])
    expect(p.labels).toEqual(['Acme Roofing', 'Bright']); expect(p.problems.map((x) => x.reason)).toEqual(['duplicate', 'empty', 'empty', 'too-long', 'empty']); expect(p.tooMany).toBe(false)
    expect(planLabels(Array.from({ length: MAX_ISSUE_BATCH + 1 }, (_, i) => `r${i}`)).tooMany).toBe(true)
  })
  it('buildRecipientUrl puts the token in ?r= only and refuses bad input', () => {
    const t = generateRecipientToken(); const u = new URL(buildRecipientUrl('https://app.example.com/some/page?x=1', VID, t))
    expect(u.pathname).toBe(`/watch/${VID}`); expect(u.searchParams.get('r')).toBe(t); expect(u.search).toBe(`?r=${t}`); expect(u.hash).toBe('')
    expect(() => buildRecipientUrl('https://a.com', '../x', t)).toThrow(/video id/); expect(() => buildRecipientUrl('https://a.com', VID, 'nope')).toThrow(/token/); expect(() => buildRecipientUrl('javascript:alert(1)', VID, t)).toThrow()
    expect(isVideoId('short')).toBe(false); expect(isVideoId(VID)).toBe(true)
  })
  it('recipientFromSearch accepts a good token and ignores everything else (including the legacy ?c=)', () => {
    const t = generateRecipientToken(); expect(recipientFromSearch(`?c=c_acme&r=${t}`)).toBe(t); expect(recipientFromSearch('?c=c_acme')).toBeNull(); expect(recipientFromSearch('?r=short')).toBeNull(); expect(recipientFromSearch(`?r=${t}x`)).toBeNull(); expect(recipientFromSearch('')).toBeNull(); expect(recipientFromSearch(null as never)).toBeNull()
  })
  it('expiry: days → ISO date, clamped to two years, null for none/invalid', () => {
    const now = Date.UTC(2026, 0, 1)
    expect(expiryFromDays(30, now)).toBe(new Date(now + 30 * 86_400_000).toISOString()); expect(expiryFromDays(100000, now)).toBe(new Date(now + MAX_EXPIRY_DAYS * 86_400_000).toISOString())
    for (const v of [null, undefined, 0, -1, NaN, Infinity]) expect(expiryFromDays(v as never, now)).toBeNull()
  })
  it('CSV: quotes values, doubles quotes, and neutralises spreadsheet formulas', () => {
    const csv = linksToCsv([{ label: 'Acme, "Roofing"', url: 'https://a/b?r=x' }, { label: '=HYPERLINK("http://evil")', url: '+cmd' }, { label: '@SUM(A1)', url: '-1' }])
    expect(csv.split('\n')[0]).toBe('label,url'); expect(csv).toContain('"Acme, ""Roofing"""'); expect(csv).toContain(`"'=HYPERLINK(""http://evil"")"`); expect(csv).toContain(`"'+cmd"`); expect(csv).toContain(`"'@SUM(A1)"`); expect(csv.endsWith('\n')).toBe(true)
  })
})

describe('browser client', () => {
  it('parseVideoId reads a bare id or a watch/embed address, and nothing else', () => {
    expect(parseVideoId(VID)).toBe(VID); expect(parseVideoId(` https://app.example.com/watch/${VID}?r=abc `)).toBe(VID); expect(parseVideoId(`https://x.com/embed/${VID}#t`)).toBe(VID)
    for (const bad of ['', 'nope', 'https://x.com/other/vidAAAAAAAA', 'https://x.com/watch/short', 'javascript:alert(1)', 5 as never]) expect(parseVideoId(bad)).toBeNull()
  })
  it('list: ok, bad address (no network), and each failure mapped', async () => {
    const ok = res(200, { ok: true, links: [{ id: '1', label: 'A', status: 'live' }] }); const r = await listRecipientLinks(VID, ok); expect(r).toMatchObject({ ok: true }); expect((ok as any).mock.calls[0][0]).toBe(`/api/personalization/recipient-links?videoId=${VID}`)
    const none = vi.fn() as unknown as typeof fetch; expect(await listRecipientLinks('x', none)).toMatchObject({ ok: false, reason: 'invalid' }); expect(none).not.toHaveBeenCalled()
    expect(await listRecipientLinks(VID, res(401, {}))).toMatchObject({ ok: false, reason: 'unauthenticated' }); expect(await listRecipientLinks(VID, res(404, { error: 'NOT_FOUND' }))).toMatchObject({ reason: 'not-found' }); expect(await listRecipientLinks(VID, res(404, {}))).toMatchObject({ reason: 'unavailable' })
    expect(await listRecipientLinks(VID, resText(200))).toMatchObject({ reason: 'unavailable' }); expect(await listRecipientLinks(VID, res(502, {}))).toMatchObject({ reason: 'error' }); expect(await listRecipientLinks(VID, vi.fn(async () => { throw new Error('offline') }) as unknown as typeof fetch)).toMatchObject({ reason: 'unavailable' })
  })
  it('issue: validates locally first, sends only the cleaned names, maps every answer', async () => {
    const f = vi.fn() as unknown as typeof fetch
    expect(await issueRecipientLinks(VID, [], {}, f)).toMatchObject({ reason: 'invalid', message: expect.stringMatching(/at least one/i) }); expect(await issueRecipientLinks(VID, ['a', 'A'], {}, f)).toMatchObject({ reason: 'invalid', message: expect.stringMatching(/repeated/) })
    expect(await issueRecipientLinks('bad', ['a'], {}, f)).toMatchObject({ reason: 'invalid' }); expect(f).not.toHaveBeenCalled()
    const t = generateRecipientToken(); const ok = res(200, { ok: true, links: [{ id: 'i', label: 'Acme', token: t, url: 'u' }] })
    expect(await issueRecipientLinks(VID, [' Acme '], { expiresInDays: 30 }, ok)).toMatchObject({ ok: true }); const body = JSON.parse((ok as any).mock.calls[0][1].body); expect(body).toEqual({ videoId: VID, labels: ['Acme'], expiresInDays: 30 })
    expect(await issueRecipientLinks(VID, ['a'], {}, res(409, { error: 'DUPLICATE_LABEL', message: 'A live link already exists' }))).toMatchObject({ reason: 'duplicate', message: expect.stringMatching(/already exists/) })
    expect(await issueRecipientLinks(VID, ['a'], {}, res(409, { error: 'LINK_LIMIT_REACHED' }))).toMatchObject({ reason: 'limit' }); expect(await issueRecipientLinks(VID, ['a'], {}, res(404, { error: 'NOT_FOUND' }))).toMatchObject({ reason: 'not-found' })
    expect(await issueRecipientLinks(VID, ['a'], {}, res(429, {}))).toMatchObject({ reason: 'rate-limited' }); expect(await issueRecipientLinks(VID, ['a'], {}, res(200, { ok: true, links: [] }))).toMatchObject({ reason: 'error' }) // short answer is an error
  })
  it('revoke: ok, already gone, errors', async () => {
    expect(await revokeRecipientLink('id', res(200, { ok: true }))).toMatchObject({ ok: true }); expect(await revokeRecipientLink('id', res(404, {}))).toMatchObject({ reason: 'not-found' }); expect(await revokeRecipientLink('id', res(500, {}))).toMatchObject({ reason: 'error' }); expect(await revokeRecipientLink('id', vi.fn(async () => { throw new Error('x') }) as unknown as typeof fetch)).toMatchObject({ reason: 'unavailable' })
  })
})
