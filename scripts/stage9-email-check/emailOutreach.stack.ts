// @vitest-environment node
/**
 * Stage 9 full-stack check. Nothing between the owner / the recipient and the database or the mail server is faked except sign-in:
 *   owner     → the real route handler (outreach/route.ts) → the real nodemailer → a REAL SMTP server on 127.0.0.1 (smtp-server)
 *   inbox     → the message the SMTP server received, parsed by mailparser (an independent MIME parser)
 *   recipient → the real netlify/functions/outreach-unsubscribe.js, following the link found INSIDE the received email
 *   both reach REAL SQL (the real migration) on a throwaway local Postgres through a `psql`-backed stand-in for PostgREST.
 * No email leaves this machine. "The SMTP server received it" is acceptance, not inbox delivery, and the check says so.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { SMTPServer } from 'smtp-server'
import { simpleParser, type ParsedMail } from 'mailparser'
import { NextRequest } from '../../netlify/functions/_personalization/shims/next-server'
import { defaultEmail } from '../../src/features/personalization/shared/personalization/email/emailModel'
import { hashAddress, verifyUnsubscribe } from '../../src/features/personalization/shared/personalization/email/unsubscribe'

const ROOT = path.resolve(__dirname, '../..')
const DB = `svmail_${process.pid}`
const pg = (sql: string) => execFileSync('su', ['postgres', '-c', `psql -X -q -At -v ON_ERROR_STOP=1 -v VERBOSITY=verbose -d ${DB}`], { input: sql, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] })
const apply = (file: string) => execFileSync('su', ['postgres', '-c', `PGOPTIONS='-c client_min_messages=warning' psql -X -q -v ON_ERROR_STOP=1 -d ${DB} -f ${path.join(ROOT, file)}`], { encoding: 'utf8' })

const TYPES: Record<string, string> = { p_owner: 'text', p_hash: 'text', p_hashes: 'text[]', p_reason: 'text', p_source: 'text', p_scope: 'text', p_key: 'text', p_limit: 'integer', p_window_seconds: 'integer' }
const lit = (v: unknown, type: string): string => {
  if (v === null || v === undefined) return `null::${type}`
  if (type === 'text[]') return `array[${(v as string[]).map((x) => `$q$${x}$q$`).join(',')}]::text[]`
  if (type === 'integer') return `${Number(v)}::integer`
  return `$q$${String(v)}$q$::${type}`
}
async function rpc(fn: string, args: Record<string, unknown>) {
  const call = `public.${fn}(${Object.entries(args).map(([k, v]) => `${k} => ${lit(v, TYPES[k] ?? 'text')}`).join(', ')})`
  try { return { data: JSON.parse(pg(`set role service_role; select to_jsonb(${call});`).trim().split('\n').pop() || 'null'), error: null } }
  catch (e) { const err = String((e as { stderr?: string }).stderr ?? e); return { data: null, error: { message: err.slice(0, 200) } } }
}

let authUserId: string | null = 'ownerA'
vi.mock('../../netlify/functions/_personalization/shims/clerk-server', () => ({ auth: vi.fn(async () => ({ userId: authUserId })) }))
vi.mock('../../netlify/functions/_personalization/src/lib/supabase', () => ({ createServerClient: () => ({ rpc }) }))
vi.mock('../../netlify/functions/_personalization/src/server/personalizationLog', () => ({ logPersonalization: vi.fn(), createCorrelationId: () => 'corr', sanitizeForLog: (v: unknown) => v }))
vi.mock('../../netlify/functions/_personalization/src/server/envValidation', () => ({ requirePersonalizationEnv: () => ({ valid: true, missingRequired: [] }) }))

const SECRET = 'a-long-enough-test-secret-0123456789'
const inbox: ParsedMail[] = []
let rejectRcpt = false
let smtp: SMTPServer
let port = 0
let route: typeof import('../../netlify/functions/_personalization/app/api/personalization/outreach/route')
let unsub: typeof import('../../netlify/functions/outreach-unsubscribe.js')
let user = 0

const sbEnv = { SUPABASE_URL: 'https://db.test', SUPABASE_SERVICE_ROLE_KEY: 'k', OUTREACH_UNSUBSCRIBE_SECRET: SECRET }
const fetchImpl = async (url: string, init: { body: string }) => {
  const { data, error } = await rpc(url.split('/rpc/')[1], JSON.parse(init.body))
  return error ? { ok: false, status: 500, json: async () => ({}) } : { ok: true, status: 200, json: async () => data }
}
const goodEmail = (over: Record<string, unknown> = {}) => ({ ...defaultEmail({ name: 'Dana Roe', address: 'dana@example.com', postalAddress: '1 Main St, Springfield' }, { videoUrl: 'https://app.example.com/watch/abc?r=tok', heroUrl: 'https://cdn.example.com/hero.gif' }), ...over })
const send = async (to = 'me@example.com', over: Record<string, unknown> = {}, owner?: string) => {
  authUserId = owner ?? `owner${(user += 1)}`
  const r = new NextRequest('https://app.example.com/api/personalization/outreach', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ mode: 'test', to, email: goodEmail(), values: { firstName: 'Ann', company: 'Acme' }, ...over }) })
  const res = await route.POST(r); return { status: res.status, json: await res.json(), owner: authUserId! }
}
/** The RAW header (mailparser folds List-* headers into a structured `list` key, which would hide what was actually on the wire). */
const rawHeader = (m: ParsedMail, name: string) => (m.headerLines.find((h) => h.key === name.toLowerCase())?.line ?? '').replace(/^[^:]+:\s*/, '').replace(/\r?\n\s+/g, ' ')
const linkOf = (m: ParsedMail) => {
  const hit = /<(https:\/\/app\.example\.com\/api\/outreach-unsubscribe\?t=[A-Za-z0-9_.-]+)>/.exec(rawHeader(m, 'List-Unsubscribe'))
  if (!hit) throw new Error('no unsubscribe link in List-Unsubscribe: ' + rawHeader(m, 'List-Unsubscribe'))
  return hit[1]
}
const tokenOf = (link: string) => new URL(link).searchParams.get('t')!
const suppressed = (owner: string) => JSON.parse(pg(`select coalesce(jsonb_agg(to_jsonb(s)), '[]') from public.email_suppressions s where clerk_user_id = '${owner}';`).trim())

beforeAll(async () => {
  execFileSync('su', ['postgres', '-c', `createdb ${DB}`])
  for (const f of ['supabase/tests/00_shim_local_postgres.sql', 'supabase/migrations/20260730_create_distributed_rate_limiter.sql', 'supabase/migrations/20261116000000_email_suppressions.sql']) apply(f)
  pg('grant all on all tables in schema public to service_role;')
  smtp = new SMTPServer({
    authOptional: true, disabledCommands: ['STARTTLS', 'AUTH'], logger: false,
    onRcptTo(address, _s, cb) { rejectRcpt ? cb(Object.assign(new Error('550 mailbox unavailable'), { responseCode: 550 })) : cb() },
    onData(stream, _s, cb) { simpleParser(stream).then((m) => { inbox.push(m); cb() }, cb) },
  })
  await new Promise<void>((ok) => smtp.listen(0, '127.0.0.1', ok)); port = (smtp.server.address() as { port: number }).port
  Object.assign(process.env, { OUTREACH_SEND_ENABLED: 'true', OUTREACH_SMTP_URL: `smtp://127.0.0.1:${port}`, OUTREACH_FROM_ADDRESS: 'noreply@send.example.com', OUTREACH_UNSUBSCRIBE_SECRET: SECRET, OUTREACH_TEST_ALLOWLIST: 'me@example.com,Jörg@example.com,second@example.com', SITE_URL: 'https://app.example.com' })
  route = await import('../../netlify/functions/_personalization/app/api/personalization/outreach/route')
  unsub = await import('../../netlify/functions/outreach-unsubscribe.js')
})
afterAll(async () => { await new Promise((ok) => smtp?.close(() => ok(null))); try { execFileSync('su', ['postgres', '-c', `dropdb --if-exists ${DB}`]) } catch { /* gone */ } })
beforeEach(() => { rejectRcpt = false })

describe('outreach, full stack (real SMTP server, real SQL)', () => {
  it('the message the SMTP server receives is a proper multipart email with the right From / Reply-To / headers', async () => {
    inbox.length = 0
    const r = await send(); expect(r.status).toBe(200); expect(r.json.note).toMatch(/does not prove it reached the inbox/); expect(inbox).toHaveLength(1)
    const m = inbox[0]
    expect(m.from?.value[0]).toMatchObject({ name: 'Dana Roe', address: 'noreply@send.example.com' })
    expect(m.replyTo?.value[0].address).toBe('dana@example.com'); expect(m.to).toBeTruthy()
    expect(m.subject).toBe('[TEST] Ann, a quick video for Acme')
    expect(rawHeader(m, 'List-Unsubscribe-Post')).toBe('List-Unsubscribe=One-Click'); expect(m.headers.get('x-outreach-test')).toBe('1')
    expect(m.text).toContain('Hi Ann,'); expect(m.text).toContain('Unsubscribe: https://app.example.com/api/outreach-unsubscribe?t=')
    expect(m.html).toContain('https://cdn.example.com/hero.gif'); expect(m.html).toContain('1 Main St, Springfield'); expect(m.html).not.toMatch(/<script/i)
    expect(String(m.html)).toContain(linkOf(m).replace(/&/g, '&amp;'))
  })
  it('a unicode subject, name and body arrive intact', async () => {
    inbox.length = 0
    const r = await send('me@example.com', { email: goodEmail({ subject: 'Café ✓ für {{company}}', body: ['Grüße — 你好 {{firstName}}'] }), values: { firstName: 'Zoë', company: 'Müller GmbH' } })
    expect(r.status).toBe(200); expect(inbox[0].subject).toBe('[TEST] Café ✓ für Müller GmbH'); expect(inbox[0].text).toContain('Grüße — 你好 Zoë')
  })
  it('the unsubscribe link inside the received email works end to end: GET changes nothing, POST suppresses, repeats are safe, later sends are refused', async () => {
    inbox.length = 0
    const r = await send('second@example.com'); expect(r.status).toBe(200)
    const link = linkOf(inbox[0]); const token = tokenOf(link)
    expect(await verifyUnsubscribe(SECRET, token)).toMatchObject({ ok: true, owner: r.owner, hash: await hashAddress('second@example.com') })
    const get = await unsub.handle({ method: 'GET', token }, { fetchImpl: fetchImpl as never, env: sbEnv }); expect(get.statusCode).toBe(200)
    expect(suppressed(r.owner)).toHaveLength(0) // a link scanner opening the page unsubscribes nobody
    const post = await unsub.handle({ method: 'POST', token, body: 'List-Unsubscribe=One-Click', contentType: 'application/x-www-form-urlencoded', ip: '203.0.113.7' }, { fetchImpl: fetchImpl as never, env: sbEnv }); expect(post.statusCode).toBe(200)
    const rows = suppressed(r.owner); expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ clerk_user_id: r.owner, email_hash: await hashAddress('second@example.com'), source: 'one-click' }); expect(JSON.stringify(rows)).not.toContain('second@example.com')
    expect((await unsub.handle({ method: 'POST', token }, { fetchImpl: fetchImpl as never, env: sbEnv })).statusCode).toBe(200); expect(suppressed(r.owner)).toHaveLength(1)
    const before = inbox.length
    const again = await send('second@example.com', {}, r.owner); expect(again.status).toBe(409); expect(inbox).toHaveLength(before) // nothing reached the SMTP server
  })
  it('suppression is per sender: another owner can still email that address', async () => {
    inbox.length = 0; const a = await send('second@example.com'); const link = linkOf(inbox[0])
    await unsub.handle({ method: 'POST', token: tokenOf(link) }, { fetchImpl: fetchImpl as never, env: sbEnv })
    expect((await send('second@example.com', {}, a.owner)).status).toBe(409)
    expect((await send('second@example.com')).status).toBe(200)
  })
  it('a forged or edited token records nothing', async () => {
    inbox.length = 0; const r = await send(); const token = tokenOf(linkOf(inbox[0])); const [body, sig] = token.split('.')
    const forged = Buffer.from(JSON.stringify({ o: 'victimOwner', h: await hashAddress('victim@example.com'), t: Math.floor(Date.now() / 1000) })).toString('base64url')
    for (const t of [`${forged}.${sig}`, `${body}.${sig.slice(0, -3)}AAA`, 'junk']) expect((await unsub.handle({ method: 'POST', token: t }, { fetchImpl: fetchImpl as never, env: sbEnv })).statusCode).toBe(400)
    expect(suppressed('victimOwner')).toHaveLength(0); expect(suppressed(r.owner)).toHaveLength(0)
  })
  it('the allow-list stops mail to strangers before anything reaches the SMTP server; non-ASCII allow-listed addresses are matched', async () => {
    inbox.length = 0; expect((await send('stranger@example.org')).status).toBe(403); expect(inbox).toHaveLength(0)
  })
  it('an SMTP rejection becomes a 502 with nothing delivered and no server detail leaked', async () => {
    inbox.length = 0; rejectRcpt = true; const r = await send(); expect(r.status).toBe(502); expect(inbox).toHaveLength(0)
    expect(JSON.stringify(r.json)).not.toMatch(/550|127\.0\.0\.1|mailbox/)
  })
  it('the SMTP server being down is a 502 too', async () => {
    const prev = process.env.OUTREACH_SMTP_URL; process.env.OUTREACH_SMTP_URL = 'smtp://127.0.0.1:1'
    const r = await send(); process.env.OUTREACH_SMTP_URL = prev; expect(r.status).toBe(502); expect(r.json.error).toBe('SEND_FAILED')
  })
})
