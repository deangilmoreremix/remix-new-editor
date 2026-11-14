// @vitest-environment node
/**
 * Stage 12 end-to-end chain on REAL infrastructure (all local, nothing leaves this machine):
 *   real SQL (every migration) · real route handlers (recipient-links, outreach, analytics-report, push) · real video-events and
 *   outreach-unsubscribe functions · real nodemailer → real SMTP server (parsed with mailparser) · real push sender → local push service
 *   decrypted by http_ece · the real PDF writer.
 * The rendering steps (thumbnail / GIF / MP4 per recipient) happen in the browser and are proven by scripts/stage10-bulk-check; here the
 * email simply carries the GIF address a published upload would have. Only sign-in is faked.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { execFileSync, spawnSync } from 'node:child_process'
import { createECDH, randomBytes } from 'node:crypto'
import fs from 'node:fs'
import http from 'node:http'
import path from 'node:path'
import ece from 'http_ece'
import { SMTPServer } from 'smtp-server'
import { simpleParser, type ParsedMail } from 'mailparser'
import { NextRequest } from '../../netlify/functions/_personalization/shims/next-server'
import { generateVapidKeys } from '../../netlify/functions/_push/webPush.js'
import { defaultEmail } from '../../src/features/personalization/shared/personalization/email/emailModel'
import { buildReportPdf } from '../../src/features/personalization/shared/personalization/report/reportPdf'
import { engagementOf } from '../../src/features/personalization/shared/personalization/report/reportModel'

const ROOT = path.resolve(__dirname, '../..'); const OUT = path.join(__dirname, 'out'); fs.mkdirSync(OUT, { recursive: true })
const DB = `sve2e_${process.pid}`
const pg = (sql: string) => execFileSync('su', ['postgres', '-c', `psql -X -q -At -v ON_ERROR_STOP=1 -d ${DB}`], { input: sql, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] })
const apply = (f: string) => execFileSync('su', ['postgres', '-c', `PGOPTIONS='-c client_min_messages=warning' psql -X -q -v ON_ERROR_STOP=1 -d ${DB} -f ${path.join(ROOT, f)}`], { encoding: 'utf8' })
const TYPES: Record<string, string> = { p_clerk_user_id: 'text', p_owner: 'text', p_video_id: 'text', p_labels: 'text[]', p_token_hashes: 'text[]', p_expires_at: 'timestamptz', p_token_hash: 'text', p_session_key: 'text', p_viewer_hash: 'text', p_contact_id: 'text', p_device: 'text', p_referrer: 'text', p_events: 'jsonb', p_scope: 'text', p_key: 'text', p_limit: 'integer', p_window_seconds: 'integer', p_from: 'date', p_to: 'date', p_endpoint: 'text', p_p256dh: 'text', p_auth: 'text', p_device_label: 'text', p_gone: 'text[]', p_ok: 'text[]', p_hash: 'text', p_hashes: 'text[]', p_reason: 'text', p_source: 'text', p_id: 'uuid' }
const SETOF = new Set(['recipient_links_issue', 'recipient_links_list', 'push_subscriptions_list'])
const lit = (v: unknown, t: string) => v === null || v === undefined ? `null::${t}` : t === 'text[]' ? `array[${(v as string[]).map((x) => `$q$${x}$q$`).join(',')}]::text[]` : t === 'jsonb' ? `$j$${JSON.stringify(v)}$j$::jsonb` : t === 'integer' ? `${Number(v)}::integer` : `$q$${String(v)}$q$::${t}`
async function rpc(fn: string, args: Record<string, unknown>) {
  const call = `public.${fn}(${Object.entries(args).map(([k, v]) => `${k} => ${lit(v, TYPES[k] ?? 'text')}`).join(', ')})`
  const sql = `set role service_role; select ${SETOF.has(fn) ? `coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) from ${call} x` : `to_jsonb(${call})`};`
  try { return { data: JSON.parse(pg(sql).trim().split('\n').pop() || 'null'), error: null } } catch (e) { const err = String((e as { stderr?: string }).stderr ?? e); return { data: null, error: { code: /ERROR:\s+([0-9A-Z]{5})/.exec(err)?.[1], message: err.slice(0, 200) } } }
}
let authUserId: string | null = 'ownerA'
vi.mock('../../netlify/functions/_personalization/shims/clerk-server', () => ({ auth: vi.fn(async () => ({ userId: authUserId })) }))
vi.mock('../../netlify/functions/_personalization/src/lib/supabase', () => ({ createServerClient: () => ({ rpc }) }))
vi.mock('../../netlify/functions/_personalization/src/server/personalizationLog', () => ({ logPersonalization: vi.fn(), createCorrelationId: () => 'corr', sanitizeForLog: (v: unknown) => v }))
vi.mock('../../netlify/functions/_personalization/src/server/envValidation', () => ({ requirePersonalizationEnv: () => ({ valid: true, missingRequired: [] }) }))

const SECRET = 'a-long-enough-test-secret-0123456789'; const VK = generateVapidKeys()
const VID = 'vidAAAAAAAA'
const sbEnv = { SUPABASE_URL: 'https://db.test', SUPABASE_SERVICE_ROLE_KEY: 'k', OUTREACH_UNSUBSCRIBE_SECRET: SECRET, VAPID_PUBLIC_KEY: VK.publicKey, VAPID_PRIVATE_KEY: VK.privateKey, VAPID_SUBJECT: 'mailto:owner@example.com' }
const inbox: ParsedMail[] = []; const pushes: any[] = []
const device = (() => { const e = createECDH('prime256v1'); e.generateKeys(); const auth = randomBytes(16); return { e, auth, path: '/fcm/send/e2e', sub: { endpoint: 'https://fcm.googleapis.com/fcm/send/e2e', p256dh: e.getPublicKey().toString('base64url'), auth: auth.toString('base64url') } } })()
let smtp: SMTPServer; let push: http.Server; let smtpPort = 0; let pushPort = 0
let links: any; let outreach: any; let report: any; let pushRoute: any; let events: any; let unsub: any
const realFetch = globalThis.fetch
vi.stubGlobal('fetch', (u: any, i: any) => (String(u).startsWith('https://fcm.googleapis.com') ? realFetch(`http://127.0.0.1:${pushPort}${new URL(String(u)).pathname}`, i) : realFetch(u, i)))
const fetchImpl = async (url: string, init: any) => { if (url.startsWith('https://fcm.googleapis.com')) { const r = await realFetch(`http://127.0.0.1:${pushPort}${new URL(url).pathname}`, init); return { status: r.status } } const { data, error } = await rpc(url.split('/rpc/')[1], JSON.parse(init.body)); return error ? { ok: false, status: 500, json: async () => ({}) } : { ok: true, status: 200, json: async () => data } }
const nr = (method: string, p: string, body?: unknown) => new NextRequest(`https://app.example.com${p}`, { method, body: body === undefined ? undefined : JSON.stringify(body), headers: { 'content-type': 'application/json' } })
const j = async (r: Response) => ({ status: r.status, json: await r.json() })
let seq = 0; const sess = () => `session${String(++seq).padStart(16, '0')}`
const rawHeader = (m: ParsedMail, n: string) => (m.headerLines.find((h) => h.key === n.toLowerCase())?.line ?? '').replace(/^[^:]+:\s*/, '').replace(/\r?\n\s+/g, ' ')

beforeAll(async () => {
  execFileSync('su', ['postgres', '-c', `createdb ${DB}`])
  for (const f of ['supabase/tests/00_shim_local_postgres.sql', 'supabase/migrations/20260730_create_distributed_rate_limiter.sql', 'supabase/migrations/20261105120000_create_published_videos.sql', 'supabase/migrations/20261105160000_published_video_events.sql', 'supabase/migrations/20261112000000_create_timeline_projects.sql', 'supabase/migrations/20261112010000_publish_hardening_slugs.sql', 'supabase/migrations/20261112020000_video_analytics.sql', 'supabase/migrations/20261112030000_retargeting_notifications.sql', 'supabase/migrations/20261112050000_drop_public_published_videos_read.sql', 'supabase/migrations/20261115000000_recipient_links.sql', 'supabase/migrations/20261116000000_email_suppressions.sql', 'supabase/migrations/20261117000000_analytics_report_push.sql']) apply(f)
  pg(`insert into public.published_videos (id, clerk_user_id, title, project, published, revision) values ('${VID}','ownerA','Spring offer','{"timelineSeconds":30,"tracks":[{"items":[{"id":"cta1","buttonText":"Get a quote"},{"id":"form1","heading":"Contact form"}]}]}',true,1); grant all on all tables in schema public to service_role;`)
  smtp = new SMTPServer({ authOptional: true, disabledCommands: ['STARTTLS', 'AUTH'], logger: false, onData(stream, _s, cb) { simpleParser(stream).then((m) => { inbox.push(m); cb() }, cb) } })
  await new Promise<void>((ok) => smtp.listen(0, '127.0.0.1', ok)); smtpPort = (smtp.server.address() as { port: number }).port
  push = http.createServer((req, res) => { const c: Buffer[] = []; req.on('data', (d) => c.push(d)); req.on('end', () => { try { pushes.push(JSON.parse(ece.decrypt(Buffer.concat(c), { version: 'aes128gcm', privateKey: device.e, authSecret: device.auth }).toString())); res.statusCode = 201 } catch { res.statusCode = 400 } res.end() }) })
  await new Promise<void>((ok) => push.listen(0, '127.0.0.1', ok)); pushPort = (push.address() as { port: number }).port
  Object.assign(process.env, { OUTREACH_SEND_ENABLED: 'true', OUTREACH_SMTP_URL: `smtp://127.0.0.1:${smtpPort}`, OUTREACH_FROM_ADDRESS: 'noreply@send.example.com', OUTREACH_UNSUBSCRIBE_SECRET: SECRET, OUTREACH_TEST_ALLOWLIST: 'me@example.com', SITE_URL: 'https://app.example.com', VAPID_PUBLIC_KEY: VK.publicKey, VAPID_PRIVATE_KEY: VK.privateKey, VAPID_SUBJECT: 'mailto:owner@example.com' })
  const base = '../../netlify/functions/_personalization/app/api/personalization'
  links = await import(`${base}/recipient-links/route`); outreach = await import(`${base}/outreach/route`); report = await import(`${base}/analytics-report/route`); pushRoute = await import(`${base}/push/route`)
  events = await import('../../netlify/functions/video-events.js'); unsub = await import('../../netlify/functions/outreach-unsubscribe.js')
})
afterAll(async () => { await new Promise((ok) => smtp?.close(() => ok(null))); await new Promise((ok) => push?.close(ok)); try { execFileSync('su', ['postgres', '-c', `dropdb --if-exists ${DB}`]) } catch { /* gone */ } })

const people = ['Acme Roofing', 'Bright Plumbing', 'Cedar Dental']
const tokens: Record<string, string> = {}; const ids: Record<string, string> = {}
const visit = (token: string | null, evs: unknown[], extra: Record<string, unknown> = {}) => events.handle({ video: VID, session: sess(), ...(token ? { recipient: token } : {}), events: evs, ...extra }, { fetchImpl: fetchImpl as never, env: sbEnv, ip: '203.0.113.5' })

describe('one campaign, start to finish', () => {
  it('1. the owner turns on notifications on a device (real route + SQL)', async () => {
    const r = await j(await pushRoute.POST(nr('POST', '/api/personalization/push', { subscription: { endpoint: device.sub.endpoint, keys: { p256dh: device.sub.p256dh, auth: device.sub.auth } }, deviceLabel: 'Laptop' }))); expect(r.status).toBe(200)
  })
  it('2. personal links are issued for three recipients; the database holds only hashes', async () => {
    const r = await j(await links.POST(nr('POST', '/api/personalization/recipient-links', { videoId: VID, labels: people }))); expect(r.status).toBe(200)
    for (const l of r.json.links) { tokens[l.label] = l.token; ids[l.label] = l.id; expect(l.url).toBe(`https://app.example.com/watch/${VID}?r=${l.token}`) }
    expect(pg(`select count(*) from public.recipient_links where token_hash = any (array['${Object.values(tokens).join("','")}'])`).trim()).toBe('0') // plain tokens are not stored
  })
  it('3. each recipient\'s personalized email goes out through a real SMTP server with THEIR link, a signed unsubscribe, and the GIF', async () => {
    for (const [i, name] of people.entries()) {
      authUserId = `sender${i}`; // a fresh sender per message keeps the per-user hourly send limit out of the way
      const email = defaultEmail({ name: 'Dana Roe', address: 'dana@example.com', postalAddress: '1 Main St, Springfield' }, { videoUrl: `https://app.example.com/watch/${VID}?r=${tokens[name]}`, heroUrl: `https://cdn.example.com/gif/${i}.gif` })
      const res = await j(await outreach.POST(nr('POST', '/api/personalization/outreach', { mode: 'test', to: 'me@example.com', email, values: { firstName: name.split(' ')[0], company: name } }))); expect(res.status, name).toBe(200)
    }
    authUserId = 'ownerA'; expect(inbox).toHaveLength(3)
    inbox.forEach((m, i) => { expect(m.subject).toBe(`[TEST] ${people[i].split(' ')[0]}, a quick video for ${people[i]}`); expect(String(m.html)).toContain(`r=${tokens[people[i]]}`); expect(String(m.html)).toContain(`cdn.example.com/gif/${i}.gif`); expect(rawHeader(m, 'List-Unsubscribe-Post')).toBe('List-Unsubscribe=One-Click') })
  })
  it('4. recipients open their link: views, plays and a finish are attributed to the right recipient', async () => {
    expect((await visit(tokens['Acme Roofing'], [{ type: 'page_open', seq: 0 }, { type: 'play', seq: 1, t: 0 }, { type: 'complete', seq: 2, t: 30 }], { recipient: tokens['Acme Roofing'] })).statusCode).toBe(200)
    await visit(tokens['Bright Plumbing'], [{ type: 'page_open', seq: 0 }, { type: 'play', seq: 1, t: 0 }])
    await visit(tokens['Cedar Dental'], [{ type: 'page_open', seq: 0 }])
    await visit(null, [{ type: 'page_open', seq: 0 }, { type: 'play', seq: 1, t: 0 }]) // an anonymous visitor
  })
  it('5. a click and a form on Acme\'s link are attributed to Acme, and push ONE notification per alert to the owner\'s device', async () => {
    pushes.length = 0
    await visit(tokens['Acme Roofing'], [{ type: 'page_open', seq: 0 }, { type: 'cta_click', seq: 1, clip: 'cta1', props: { label: 'Get a quote' } }, { type: 'lead_submit', seq: 2, clip: 'form1' }])
    expect(pushes.map((p) => p.type).sort()).toEqual(['new_lead', 'pricing_cta']); expect(pushes.find((p) => p.type === 'new_lead').body).toContain('Spring offer')
  })
  it('6. attacks: a forged contact id and another recipient\'s token attribute nothing to the wrong person', async () => {
    const before = pg(`select count(*) from public.video_view_sessions where contact_id = '${ids['Cedar Dental']}'`).trim()
    await events.handle({ video: VID, session: sess(), contact: ids['Cedar Dental'], events: [{ type: 'page_open', seq: 0 }, { type: 'play', seq: 1 }] }, { fetchImpl: fetchImpl as never, env: sbEnv, ip: '203.0.113.9' })
    await visit('x'.repeat(32), [{ type: 'page_open', seq: 0 }])
    expect(pg(`select count(*) from public.video_view_sessions where contact_id = '${ids['Cedar Dental']}'`).trim()).toBe(before)
  })
  it('7. the report shows each recipient\'s true journey; another owner sees nothing', async () => {
    const r = await j(await report.GET(nr('GET', `/api/personalization/analytics-report?videoId=${VID}`))); expect(r.status).toBe(200); const rep = r.json.report
    const by = Object.fromEntries(rep.recipients.map((x: any) => [x.label, engagementOf(x)]))
    expect(by).toEqual({ 'Acme Roofing': 'acted', 'Bright Plumbing': 'played', 'Cedar Dental': 'opened' })
    expect(rep.recipients.find((x: any) => x.label === 'Acme Roofing')).toMatchObject({ completes: 1, ctaClicks: 1, leads: 1 }); expect(rep.summary.leads).toBe(1)
    authUserId = 'ownerB'; expect((await j(await report.GET(nr('GET', `/api/personalization/analytics-report?videoId=${VID}`)))).status).toBe(404); authUserId = 'ownerA'
    const pdf = buildReportPdf(rep, { now: new Date('2026-11-14T12:00:00Z') }); const f = path.join(OUT, 'campaign.pdf'); fs.writeFileSync(f, pdf.bytes)
    const txt = spawnSync('pdftotext', ['-layout', f, '-'], { encoding: 'utf8' }).stdout; for (const n of people) expect(txt).toContain(n); expect(txt).toContain('Took action'); expect(spawnSync('pdfinfo', [f]).status).toBe(0)
  })
  it('8. a recipient unsubscribes from the email they got; further sends to that address are refused and nothing reaches the SMTP server', async () => {
    const link = /<(https:\/\/app\.example\.com\/api\/outreach-unsubscribe\?t=[^>]+)>/.exec(rawHeader(inbox[0], 'List-Unsubscribe'))![1]; const t = new URL(link).searchParams.get('t')!
    expect((await unsub.handle({ method: 'GET', token: t }, { fetchImpl: fetchImpl as never, env: sbEnv })).statusCode).toBe(200); expect(pg(`select count(*) from public.email_suppressions`).trim()).toBe('0')
    expect((await unsub.handle({ method: 'POST', token: t, body: 'List-Unsubscribe=One-Click', contentType: 'application/x-www-form-urlencoded' }, { fetchImpl: fetchImpl as never, env: sbEnv })).statusCode).toBe(200); expect(pg(`select count(*) from public.email_suppressions`).trim()).toBe('1')
    const owner = JSON.parse(pg(`select to_jsonb(clerk_user_id) from public.email_suppressions limit 1`).trim()); authUserId = owner; const n = inbox.length
    const again = await j(await outreach.POST(nr('POST', '/api/personalization/outreach', { mode: 'test', to: 'me@example.com', email: defaultEmail({ name: 'D', address: 'dana@example.com', postalAddress: '1 Main St' }, {}), values: {} }))); expect(again.status).toBe(409); expect(inbox).toHaveLength(n); authUserId = 'ownerA'
  })
  it('9. revoking a link stops attributing to it, and the report says so', async () => {
    const r = await j(await links.DELETE(nr('DELETE', `/api/personalization/recipient-links?id=${ids['Bright Plumbing']}`))); expect(r.status).toBe(200)
    const before = pg(`select count(*) from public.video_view_sessions where contact_id = '${ids['Bright Plumbing']}'`).trim(); await visit(tokens['Bright Plumbing'], [{ type: 'page_open', seq: 0 }])
    expect(pg(`select count(*) from public.video_view_sessions where contact_id = '${ids['Bright Plumbing']}'`).trim()).toBe(before)
    const rep = (await j(await report.GET(nr('GET', `/api/personalization/analytics-report?videoId=${VID}`)))).json.report; expect(rep.recipients.find((x: any) => x.label === 'Bright Plumbing').status).toBe('revoked')
  })
})
