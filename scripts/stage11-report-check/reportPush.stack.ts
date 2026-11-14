// @vitest-environment node
/**
 * Stage 11 full-stack check. Real SQL (all migrations incl. analytics + notifications + this stage), the real video-events handler, the real
 * report and push routes, the real sender, and a real local HTTP "push service" that decrypts each message with Mozilla's http_ece.
 * Only sign-in is faked. Nothing leaves this machine.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { execFileSync, spawnSync } from 'node:child_process'
import { createECDH, randomBytes } from 'node:crypto'
import fs from 'node:fs'
import http from 'node:http'
import path from 'node:path'
import ece from 'http_ece'
import { NextRequest } from '../../netlify/functions/_personalization/shims/next-server'
import { generateVapidKeys } from '../../netlify/functions/_push/webPush.js'
import { buildReportPdf } from '../../src/features/personalization/shared/personalization/report/reportPdf'
import { normalizeReport } from '../../src/features/personalization/shared/personalization/report/reportModel'

const ROOT = path.resolve(__dirname, '../..'); const OUT = path.join(__dirname, 'out'); fs.mkdirSync(OUT, { recursive: true })
const DB = `svrep_${process.pid}`
const pg = (sql: string) => execFileSync('su', ['postgres', '-c', `psql -X -q -At -v ON_ERROR_STOP=1 -d ${DB}`], { input: sql, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] })
const apply = (f: string) => execFileSync('su', ['postgres', '-c', `PGOPTIONS='-c client_min_messages=warning' psql -X -q -v ON_ERROR_STOP=1 -d ${DB} -f ${path.join(ROOT, f)}`], { encoding: 'utf8' })
const TYPES: Record<string, string> = { p_clerk_user_id: 'text', p_video_id: 'text', p_labels: 'text[]', p_token_hashes: 'text[]', p_expires_at: 'timestamptz', p_token_hash: 'text', p_session_key: 'text', p_viewer_hash: 'text', p_contact_id: 'text', p_device: 'text', p_referrer: 'text', p_events: 'jsonb', p_scope: 'text', p_key: 'text', p_limit: 'integer', p_window_seconds: 'integer', p_from: 'date', p_to: 'date', p_endpoint: 'text', p_p256dh: 'text', p_auth: 'text', p_device_label: 'text', p_gone: 'text[]', p_ok: 'text[]' }
const SETOF = new Set(['recipient_links_issue', 'push_subscriptions_list'])
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

const K = generateVapidKeys()
const VAPID = { VAPID_PUBLIC_KEY: K.publicKey, VAPID_PRIVATE_KEY: K.privateKey, VAPID_SUBJECT: 'mailto:owner@example.com' }
const sbEnv = { SUPABASE_URL: 'https://db.test', SUPABASE_SERVICE_ROLE_KEY: 'k', ...VAPID }
const VID = 'vidAAAAAAAA'
const browser = () => { const e = createECDH('prime256v1'); e.generateKeys(); const auth = randomBytes(16); return { e, auth, path: `/fcm/send/${randomBytes(6).toString('hex')}`, sub: { endpoint: '', p256dh: e.getPublicKey().toString('base64url'), auth: auth.toString('base64url') } } }
const devices = [browser(), browser()]; devices.forEach((d) => { d.sub.endpoint = `https://fcm.googleapis.com${d.path}` })
const received: Array<{ device: number; payload: any; headers: http.IncomingHttpHeaders }> = []
let server: http.Server; let port = 0; let events: typeof import('../../netlify/functions/video-events.js'); let reportRoute: any; let pushRoute: any
/** The "network": Supabase RPCs go to SQL; the allowed push host goes to the local push service. */
const fetchImpl = async (url: string, init: any) => {
  if (url.startsWith('https://fcm.googleapis.com')) { const r = await fetch(`http://127.0.0.1:${port}${new URL(url).pathname}`, init); return { status: r.status } }
  const { data, error } = await rpc(url.split('/rpc/')[1], JSON.parse(init.body)); return error ? { ok: false, status: 500, json: async () => ({}) } : { ok: true, status: 200, json: async () => data }
}
const visit = (session: string, evs: unknown[], extra: Record<string, unknown> = {}) => events.handle({ video: VID, session, events: evs, ...extra }, { fetchImpl: fetchImpl as never, env: sbEnv, ip: '203.0.113.5' })
const get = async (q: string) => { const r = await reportRoute.GET(new NextRequest(`https://app.example.com/api/personalization/analytics-report?${q}`, { method: 'GET' })); return { status: r.status, json: await r.json() } }
const post = async (body: unknown) => { const r = await pushRoute.POST(new NextRequest('https://app.example.com/api/personalization/push', { method: 'POST', body: JSON.stringify(body), headers: { 'content-type': 'application/json' } })); return { status: r.status, json: await r.json() } }
const realFetch = globalThis.fetch
vi.stubGlobal('fetch', (u: any, i: any) => (String(u).startsWith('https://fcm.googleapis.com') ? realFetch(`http://127.0.0.1:${port}${new URL(String(u)).pathname}`, i) : realFetch(u, i))) // the routes' own sender reaches the local push service
let seq = 0; const sess = () => `session${String(++seq).padStart(16, '0')}`

beforeAll(async () => {
  execFileSync('su', ['postgres', '-c', `createdb ${DB}`])
  for (const f of ['supabase/tests/00_shim_local_postgres.sql', 'supabase/migrations/20260730_create_distributed_rate_limiter.sql', 'supabase/migrations/20261105120000_create_published_videos.sql', 'supabase/migrations/20261105160000_published_video_events.sql', 'supabase/migrations/20261112000000_create_timeline_projects.sql', 'supabase/migrations/20261112010000_publish_hardening_slugs.sql', 'supabase/migrations/20261112020000_video_analytics.sql', 'supabase/migrations/20261112030000_retargeting_notifications.sql', 'supabase/migrations/20261112050000_drop_public_published_videos_read.sql', 'supabase/migrations/20261115000000_recipient_links.sql', 'supabase/migrations/20261117000000_analytics_report_push.sql']) apply(f)
  pg(`insert into public.published_videos (id, clerk_user_id, title, project, published, revision) values ('${VID}','ownerA','Spring offer','{"timelineSeconds":30,"tracks":[{"items":[{"id":"cta1","buttonText":"Get a quote"},{"id":"form1","heading":"Contact form"}]}]}',true,1),('vidBBBBBBBB','ownerB','B video','{"timelineSeconds":30}',true,1); grant all on all tables in schema public to service_role;`)
  server = http.createServer((req, res) => { const chunks: Buffer[] = []; req.on('data', (c) => chunks.push(c)); req.on('end', () => { const i = devices.findIndex((d) => d.path === req.url); if (i < 0) { res.statusCode = 410; return res.end() } try { received.push({ device: i, payload: JSON.parse(ece.decrypt(Buffer.concat(chunks), { version: 'aes128gcm', privateKey: devices[i].e, authSecret: devices[i].auth }).toString()), headers: req.headers }); res.statusCode = 201 } catch { res.statusCode = 400 } res.end() }) })
  await new Promise<void>((ok) => server.listen(0, '127.0.0.1', ok)); port = (server.address() as { port: number }).port
  Object.assign(process.env, VAPID)
  events = await import('../../netlify/functions/video-events.js'); reportRoute = await import('../../netlify/functions/_personalization/app/api/personalization/analytics-report/route'); pushRoute = await import('../../netlify/functions/_personalization/app/api/personalization/push/route')
})
afterAll(async () => { await new Promise((ok) => server?.close(ok)); try { execFileSync('su', ['postgres', '-c', `dropdb --if-exists ${DB}`]) } catch { /* gone */ } })

describe('report, end to end on real SQL', () => {
  it('a scripted visitor session through the real handler appears in the report with exactly those numbers', async () => {
    authUserId = 'ownerA'
    const issued = await rpc('recipient_links_issue', { p_clerk_user_id: 'ownerA', p_video_id: VID, p_labels: ['Acme Roofing'], p_token_hashes: ['a'.repeat(64)], p_expires_at: null })
    const linkId = (issued.data as any)[0].id
    await events.handle({ video: VID, session: sess(), events: [{ type: 'page_open', seq: 0 }, { type: 'play', seq: 1, t: 0 }, { type: 'complete', seq: 2, t: 30 }, { type: 'cta_click', seq: 3, clip: 'cta1', props: { label: 'Get a quote' } }] }, { fetchImpl: (async (u: string, i: any) => (u.includes('recipient_link_resolve') ? { ok: true, status: 200, json: async () => linkId } : fetchImpl(u, i))) as never, env: { ...sbEnv, VAPID_PUBLIC_KEY: '' }, ip: '203.0.113.5' }).catch(() => null)
    await visit(sess(), [{ type: 'page_open', seq: 0 }, { type: 'play', seq: 1, t: 0 }])
    await visit(sess(), [{ type: 'page_open', seq: 0 }])
    const s = (await get(`videoId=${VID}`)).json.report.summary
    expect(s).toMatchObject({ pageVisits: 3, plays: 2, completedSessions: 1 }); expect(s.ctaClicks).toBeGreaterThanOrEqual(1)
  })
  it('retrying the same batch changes nothing; another owner cannot read the report (404, same as missing)', async () => {
    const before = (await get(`videoId=${VID}`)).json.report.summary; const s = sess(); const evs = [{ type: 'page_open', seq: 0 }, { type: 'play', seq: 1 }]
    await visit(s, evs); const once = (await get(`videoId=${VID}`)).json.report.summary; await visit(s, evs); await visit(s, evs); const thrice = (await get(`videoId=${VID}`)).json.report.summary
    expect(once.pageVisits).toBe(before.pageVisits + 1); expect(thrice).toEqual(once)
    authUserId = 'ownerB'; expect((await get(`videoId=${VID}`)).status).toBe(404); expect((await get('videoId=vidNOPENOPE')).status).toBe(404); authUserId = 'ownerA'
  })
  it('the PDF made from the real report is a valid file whose text carries the real numbers (poppler + pypdf strict)', async () => {
    const report = normalizeReport({ ...(await get(`videoId=${VID}`)).json.report, __typed: true } as never) ?? null
    const typed = (await get(`videoId=${VID}`)).json.report
    const pdf = buildReportPdf(typed, { now: new Date('2026-11-13T12:00:00Z') }); const f = path.join(OUT, 'report.pdf'); fs.writeFileSync(f, pdf.bytes); void report
    const info = spawnSync('pdfinfo', [f], { encoding: 'utf8' }); expect(info.status).toBe(0); expect(info.stdout).toMatch(new RegExp(`Pages:\\s+${pdf.pages}`))
    const txt = spawnSync('pdftotext', ['-layout', f, '-'], { encoding: 'utf8' }).stdout; expect(txt).toContain('Video results'); expect(txt).toContain('Spring offer'); expect(txt).toContain('Acme Roofing'); expect(txt).toMatch(new RegExp(`Page visits[\\s\\S]{0,200}?\\b${typed.summary.pageVisits}\\b`))
    expect(spawnSync('python3', ['-I', '-c', 'import pypdf,sys;pypdf.PdfReader(sys.argv[1],strict=True);print("ok")', f], { encoding: 'utf8' }).stdout.trim()).toBe('ok')
  })
})

describe('push, end to end', () => {
  it('saving devices goes through the real route and SQL; a non-push address is refused', async () => {
    authUserId = 'ownerA'
    for (const d of devices) expect((await post({ subscription: { endpoint: d.sub.endpoint, keys: { p256dh: d.sub.p256dh, auth: d.sub.auth } }, deviceLabel: 'Test' })).status).toBe(200)
    expect((await post({ subscription: { endpoint: 'https://169.254.169.254/x', keys: { p256dh: devices[0].sub.p256dh, auth: devices[0].sub.auth } } })).status).toBe(400)
    expect(JSON.parse(pg(`select count(*) from public.push_subscriptions where clerk_user_id = 'ownerA'`).trim())).toBe(2)
  })
  it('a lead pushes ONE alert to BOTH devices; the payload decrypts to the real alert; a retry pushes nothing more', async () => {
    received.length = 0; const s = sess(); const evs = [{ type: 'page_open', seq: 0 }, { type: 'lead_submit', seq: 1, clip: 'form1' }]
    expect((await visit(s, evs)).statusCode).toBe(200)
    // two unpushed alerts exist for this owner: the pricing click from the first test (made while push was off, still under 10 minutes old) and this lead
    expect(received).toHaveLength(4); expect(new Set(received.map((r) => r.device))).toEqual(new Set([0, 1])); expect(new Set(received.map((r) => r.payload.type))).toEqual(new Set(['new_lead', 'pricing_cta']))
    const p = received.find((r) => r.payload.type === 'new_lead')!.payload
    expect(p).toMatchObject({ title: 'New lead captured', type: 'new_lead' }); expect(p.body).toContain('Spring offer'); expect(received[0].headers.authorization).toMatch(/^vapid t=/); expect(received[0].headers['content-encoding']).toBe('aes128gcm')
    await visit(s, evs); expect(received).toHaveLength(4) // the retry pushes nothing more
    expect(JSON.parse(pg(`select count(*) from public.owner_notifications where pushed_at is not null`).trim())).toBeGreaterThanOrEqual(1)
  })
  it('parallel claims never push the same alert twice (SKIP LOCKED + claim in one statement)', async () => {
    received.length = 0
    for (let i = 0; i < 3; i += 1) await events.handle({ video: VID, session: sess(), events: [{ type: 'page_open', seq: 0 }, { type: 'lead_submit', seq: 1, clip: 'form1' }] }, { fetchImpl: (async (u: string, init: any) => (u.includes('push_claim_for_video') || u.startsWith('https://fcm') ? { ok: true, status: 200, json: async () => ({ notifications: [], subscriptions: [] }) } : fetchImpl(u, init))) as never, env: sbEnv, ip: '203.0.113.5' })
    const total = JSON.parse(pg(`select count(*) from public.owner_notifications where pushed_at is null and type = 'new_lead'`).trim())
    expect(total).toBe(3)
    const claims = await Promise.all([1, 2, 3, 4].map(() => rpc('push_claim_for_video', { p_video_id: VID, p_limit: 10 })))
    const ids = claims.flatMap((c) => ((c.data as any)?.notifications ?? []).map((n: any) => n.id)); expect(ids).toHaveLength(3); expect(new Set(ids).size).toBe(3)
  })
  it('the test button sends to the owner\'s devices; a gone device (410) is forgotten', async () => {
    received.length = 0; const t = await post({ test: true }); expect(t.json).toMatchObject({ ok: true, sent: 2 }); expect(received.every((r) => r.payload.test === true && r.payload.title === 'Test notification')).toBe(true)
    pg(`update public.push_subscriptions set endpoint = 'https://fcm.googleapis.com/fcm/send/gone', endpoint_hash = encode(sha256('https://fcm.googleapis.com/fcm/send/gone'::bytea), 'hex') where endpoint like '%${devices[0].path}'`)
    const t2 = await post({ test: true }); expect(t2.json).toMatchObject({ ok: true, sent: 1 }); expect(JSON.parse(pg(`select count(*) from public.push_subscriptions`).trim())).toBe(1)
  })
  it('another owner\'s activity never pushes to this owner', async () => {
    received.length = 0; await events.handle({ video: 'vidBBBBBBBB', session: sess(), events: [{ type: 'page_open', seq: 0 }, { type: 'lead_submit', seq: 1 }] }, { fetchImpl: fetchImpl as never, env: sbEnv, ip: '203.0.113.5' }); expect(received).toHaveLength(0)
  })
})
