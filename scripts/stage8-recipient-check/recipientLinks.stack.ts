// @vitest-environment node
/**
 * Stage 8 full-stack check. NOTHING between the owner/visitor and the database is faked except the transport:
 *   owner  → the real route handlers (recipient-links/route.ts)                 (auth() is the only mocked piece: signed-in user)
 *   visitor→ the real netlify/functions/video-events.js `handle`
 *   both reach REAL SQL (the real migrations, the real ingest_video_events) on a throwaway local Postgres through a `psql`-backed
 *   stand-in for PostgREST's `/rpc/<function>`.
 * It proves the attack paths of the old `?c=` scheme are closed, not just that the happy path works.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import path from 'node:path'
import { NextRequest } from '../../netlify/functions/_personalization/shims/next-server'

const ROOT = path.resolve(__dirname, '../..')
const DB = `svstack_${process.pid}`
const pg = (sql: string, db = DB) => execFileSync('su', ['postgres', '-c', `psql -X -q -At -v ON_ERROR_STOP=1 -v VERBOSITY=verbose -d ${db}`], { input: sql, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], maxBuffer: 1 << 26 })
const apply = (file: string) => execFileSync('su', ['postgres', '-c', `PGOPTIONS='-c client_min_messages=warning' psql -X -q -v ON_ERROR_STOP=1 -d ${DB} -f ${path.join(ROOT, file)}`], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })

const TYPES: Record<string, string> = {
  p_clerk_user_id: 'text', p_video_id: 'text', p_labels: 'text[]', p_token_hashes: 'text[]', p_expires_at: 'timestamptz', p_id: 'uuid', p_token_hash: 'text',
  p_session_key: 'text', p_viewer_hash: 'text', p_contact_id: 'text', p_device: 'text', p_referrer: 'text', p_events: 'jsonb', p_scope: 'text', p_key: 'text', p_limit: 'integer', p_window_seconds: 'integer',
}
const SET_RETURNING = new Set(['recipient_links_issue', 'recipient_links_list'])
const lit = (v: unknown, type: string): string => {
  if (v === null || v === undefined) return `null::${type}`
  if (type === 'text[]') return `array[${(v as string[]).map((x) => `$q$${x}$q$`).join(',')}]::text[]`
  if (type === 'jsonb') return `$j$${JSON.stringify(v)}$j$::jsonb`
  if (type === 'integer') return `${Number(v)}::integer`
  return `$q$${String(v)}$q$::${type}`
}
export async function rpc(fn: string, args: Record<string, unknown>): Promise<{ data: unknown; error: null | { code?: string; message: string } }> {
  const call = `public.${fn}(${Object.entries(args).map(([k, v]) => `${k} => ${lit(v, TYPES[k] ?? 'text')}`).join(', ')})`
  const sql = `set role service_role; select ${SET_RETURNING.has(fn) ? `coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) from ${call} x` : `to_jsonb(${call})`};`
  try { return { data: JSON.parse(pg(sql).trim().split('\n').pop() || 'null'), error: null } }
  catch (e) { const err = String((e as { stderr?: string }).stderr ?? e); const m = /ERROR:\s+([0-9A-Z]{5}):\s*(.*)/.exec(err); return { data: null, error: { code: m?.[1], message: m?.[2] ?? err.slice(0, 200) } } }
}
const sha = (t: string) => createHash('sha256').update(t).digest('hex')

let authUserId: string | null = 'userA'
vi.mock('../../netlify/functions/_personalization/shims/clerk-server', () => ({ auth: vi.fn(async () => ({ userId: authUserId })) }))
vi.mock('../../netlify/functions/_personalization/src/lib/supabase', () => ({ createServerClient: () => ({ rpc }) }))
vi.mock('../../netlify/functions/_personalization/src/server/personalizationLog', () => ({ logPersonalization: vi.fn(), createCorrelationId: () => 'corr', sanitizeForLog: (v: unknown) => v }))
vi.mock('../../netlify/functions/_personalization/src/server/envValidation', () => ({ requirePersonalizationEnv: () => ({ valid: true, missingRequired: [] }) }))

const A_VIDEO = 'vidAAAAAAAA', B_VIDEO = 'vidBBBBBBBB'
const base = 'https://app.example.com/api/personalization/recipient-links'
const req = (method: string, body?: unknown, q = '') => new NextRequest(`${base}${q}`, { method, body: body === undefined ? undefined : JSON.stringify(body), headers: { 'content-type': 'application/json' } })
let route: typeof import('../../netlify/functions/_personalization/app/api/personalization/recipient-links/route')
let events: typeof import('../../netlify/functions/video-events.js')
const fetchImpl = async (url: string, init: { body: string }) => {
  const fn = url.split('/rpc/')[1]; const { data, error } = await rpc(fn, JSON.parse(init.body))
  return error ? { ok: false, status: 500, json: async () => ({}) } : { ok: true, status: 200, json: async () => data }
}
const env = { SUPABASE_URL: 'https://db.test', SUPABASE_SERVICE_ROLE_KEY: 'k' }
const visit = (video: string, body: Record<string, unknown>, session = 'sessionAAAAAAAAAAAA01') => events.handle({ video, session, events: [{ type: 'page_open', seq: 0 }], ...body }, { fetchImpl: fetchImpl as never, env, ip: '203.0.113.5' })
const owner = async (user: string, videoId: string) => { authUserId = user; const r = await route.GET(req('GET', undefined, `?videoId=${videoId}`)); return { status: r.status, json: await r.json() } }
let seq = 0
const sess = () => `session${String(++seq).padStart(16, '0')}`

beforeAll(async () => {
  execFileSync('su', ['postgres', '-c', `createdb ${DB}`])
  for (const f of ['supabase/tests/00_shim_local_postgres.sql', 'supabase/migrations/20260730_create_distributed_rate_limiter.sql', 'supabase/migrations/20261105120000_create_published_videos.sql', 'supabase/migrations/20261105160000_published_video_events.sql', 'supabase/migrations/20261112000000_create_timeline_projects.sql', 'supabase/migrations/20261112010000_publish_hardening_slugs.sql', 'supabase/migrations/20261112020000_video_analytics.sql', 'supabase/migrations/20261112050000_drop_public_published_videos_read.sql', 'supabase/migrations/20261115000000_recipient_links.sql']) apply(f)
  pg(`insert into public.published_videos (id, clerk_user_id, title, project, published, revision) values ('${A_VIDEO}','userA','A video','{"timelineSeconds":30}',true,1),('${B_VIDEO}','userB','B video','{"timelineSeconds":30}',true,1);
      grant all on all tables in schema public to service_role;`)
  route = await import('../../netlify/functions/_personalization/app/api/personalization/recipient-links/route')
  events = await import('../../netlify/functions/video-events.js')
})
afterAll(() => { try { execFileSync('su', ['postgres', '-c', `dropdb --if-exists ${DB}`]) } catch { /* already gone */ } })
beforeEach(() => { authUserId = 'userA' })

describe('recipient links, full stack', () => {
  let tokens: Record<string, string> = {}; let ids: Record<string, string> = {}

  it('the owner issues links through the real route; the database holds only hashes', async () => {
    const res = await route.POST(req('POST', { videoId: A_VIDEO, labels: ['Acme Roofing', 'Bright Plumbing', 'Cedar Dental'] })); expect(res.status).toBe(200)
    const j = await res.json(); expect(j.links).toHaveLength(3)
    for (const l of j.links) { tokens[l.label] = l.token; ids[l.label] = l.id; expect(l.url).toBe(`https://app.example.com/watch/${A_VIDEO}?r=${l.token}`) }
    expect(new Set(Object.values(tokens)).size).toBe(3)
    const stored = pg(`select string_agg(token_hash, ',') from public.recipient_links`).trim()
    for (const t of Object.values(tokens)) { expect(stored).toContain(sha(t)); expect(stored).not.toContain(t) }
    expect(pg(`select count(*) from public.recipient_links where token_hash ~ '^[A-Za-z0-9_-]{32}$'`).trim()).toBe('0') // nothing token-shaped is stored
  })

  it('a visitor with a valid token is attributed to THEIR link; the owner sees exact counts', async () => {
    const s = sess()
    expect((await visit(A_VIDEO, { recipient: tokens['Acme Roofing'], events: [{ type: 'page_open', seq: 0 }, { type: 'play', seq: 1, t: 0 }, { type: 'cta_click', seq: 2, props: { label: 'Book' } }, { type: 'lead_submit', seq: 3 }] }, s)).statusCode).toBe(200)
    expect((await visit(A_VIDEO, { recipient: tokens['Bright Plumbing'], events: [{ type: 'page_open', seq: 0 }] }, sess())).statusCode).toBe(200)
    const { status, json } = await owner('userA', A_VIDEO); expect(status).toBe(200)
    const by = Object.fromEntries(json.links.map((l: any) => [l.label, l]))
    expect(by['Acme Roofing']).toMatchObject({ views: 1, plays: 1, ctaClicks: 1, leads: 1, status: 'live' }); expect(by['Bright Plumbing']).toMatchObject({ views: 1, plays: 0, ctaClicks: 0, leads: 0 }); expect(by['Cedar Dental']).toMatchObject({ views: 0, leads: 0 })
    expect(JSON.stringify(json)).not.toMatch(new RegExp(Object.values(tokens).join('|'))) // the list never contains a token or its hash
    expect(JSON.stringify(json)).not.toMatch(/token_hash|[a-f0-9]{64}/)
  })

  it('retrying a batch does not double count', async () => {
    const s = sess(); const body = { recipient: tokens['Cedar Dental'], events: [{ type: 'page_open', seq: 0 }, { type: 'cta_click', seq: 1 }] }
    await visit(A_VIDEO, body, s); await visit(A_VIDEO, body, s); await visit(A_VIDEO, body, s)
    const by = Object.fromEntries((await owner('userA', A_VIDEO)).json.links.map((l: any) => [l.label, l])); expect(by['Cedar Dental']).toMatchObject({ views: 1, ctaClicks: 1 })
  })

  it('ATTACK: the old forgeable ?c=<contactId> attributes nothing — not even the real link id, and not a guessed one', async () => {
    const before = JSON.stringify((await owner('userA', A_VIDEO)).json.links.map((l: any) => [l.label, l.views, l.leads]))
    for (const forged of [ids['Acme Roofing'], 'c_acme', ids['Bright Plumbing']]) await visit(A_VIDEO, { contact: forged, events: [{ type: 'page_open', seq: 0 }, { type: 'lead_submit', seq: 1 }] }, sess())
    expect(JSON.stringify((await owner('userA', A_VIDEO)).json.links.map((l: any) => [l.label, l.views, l.leads]))).toBe(before)
    expect(pg(`select count(*) from public.video_view_sessions where video_id='${A_VIDEO}' and contact_id is not null and contact_id !~ '^[0-9a-f-]{36}$'`).trim()).toBe('0') // no client-chosen id was ever stored
  })

  it('ATTACK: made-up, truncated, other-video and plain-hash tokens attribute nothing, and still do not break the view', async () => {
    const forged = ['x'.repeat(32), tokens['Acme Roofing'].slice(0, 31) + (tokens['Acme Roofing'].endsWith('A') ? 'B' : 'A'), sha(tokens['Acme Roofing']).slice(0, 32), tokens['Acme Roofing'].slice(0, 20)]
    for (const t of forged) expect((await visit(A_VIDEO, { recipient: t, events: [{ type: 'lead_submit', seq: 0 }] }, sess())).statusCode).toBe(200)
    // a REAL token of video A presented on video B's page
    expect((await visit(B_VIDEO, { recipient: tokens['Acme Roofing'], events: [{ type: 'lead_submit', seq: 0 }] }, sess())).statusCode).toBe(200)
    expect(pg(`select count(*) from public.video_view_sessions where contact_id is not null and video_id='${B_VIDEO}'`).trim()).toBe('0')
    const by = Object.fromEntries((await owner('userA', A_VIDEO)).json.links.map((l: any) => [l.label, l])); expect(by['Acme Roofing'].leads).toBe(1) // unchanged
  })

  it('ATTACK: another user cannot list, revoke or issue for this video through the routes', async () => {
    const { status, json } = await owner('userB', A_VIDEO); expect(status).toBe(200); expect(json.links).toEqual([]) // sees nothing
    authUserId = 'userB'; expect((await route.DELETE(req('DELETE', undefined, `?id=${ids['Acme Roofing']}`))).status).toBe(404)
    expect((await route.POST(req('POST', { videoId: A_VIDEO, labels: ['Sneaky'] }))).status).toBe(404)
    authUserId = null; expect((await route.GET(req('GET', undefined, `?videoId=${A_VIDEO}`))).status).toBe(401)
    const live = await owner('userA', A_VIDEO); expect(live.json.links.find((l: any) => l.label === 'Acme Roofing').status).toBe('live')
    expect(pg(`select count(*) from public.recipient_links where label = 'Sneaky'`).trim()).toBe('0')
  })

  it('revoking stops attribution immediately; the history stays; the label can be re-issued with a NEW token', async () => {
    authUserId = 'userA'; expect((await route.DELETE(req('DELETE', undefined, `?id=${ids['Bright Plumbing']}`))).status).toBe(200)
    await visit(A_VIDEO, { recipient: tokens['Bright Plumbing'], events: [{ type: 'page_open', seq: 0 }, { type: 'lead_submit', seq: 1 }] }, sess())
    const by = Object.fromEntries((await owner('userA', A_VIDEO)).json.links.map((l: any) => [l.label, l])); expect(by['Bright Plumbing']).toMatchObject({ status: 'revoked', views: 1, leads: 0 })
    expect((await route.DELETE(req('DELETE', undefined, `?id=${ids['Bright Plumbing']}`))).status).toBe(404) // revoking twice
    const again = await (await route.POST(req('POST', { videoId: A_VIDEO, labels: ['Bright Plumbing'] }))).json(); expect(again.links[0].token).not.toBe(tokens['Bright Plumbing'])
    await visit(A_VIDEO, { recipient: again.links[0].token, events: [{ type: 'page_open', seq: 0 }] }, sess())
    expect((await owner('userA', A_VIDEO)).json.links.filter((l: any) => l.label === 'Bright Plumbing' && l.status === 'live')[0].views).toBe(1)
  })

  it('an expired link stops attributing', async () => {
    const r = await (await route.POST(req('POST', { videoId: A_VIDEO, labels: ['Short lived'], expiresInDays: 1 }))).json(); const t = r.links[0].token
    await visit(A_VIDEO, { recipient: t, events: [{ type: 'page_open', seq: 0 }] }, sess())
    pg(`update public.recipient_links set created_at = now() - interval '2 days', expires_at = now() - interval '1 minute' where label = 'Short lived'`)
    await visit(A_VIDEO, { recipient: t, events: [{ type: 'page_open', seq: 0 }] }, sess())
    const l = (await owner('userA', A_VIDEO)).json.links.find((x: any) => x.label === 'Short lived'); expect(l).toMatchObject({ status: 'expired', views: 1 })
  })

  it('duplicate names, limits and bad input are refused cleanly by the real stack', async () => {
    const dup = await route.POST(req('POST', { videoId: A_VIDEO, labels: ['  acme roofing '] })); expect(dup.status).toBe(409); expect((await dup.json()).error).toBe('DUPLICATE_LABEL')
    expect((await route.POST(req('POST', { videoId: 'nope0000', labels: ['x'] }))).status).toBe(404); expect((await route.POST(req('POST', { videoId: A_VIDEO, labels: [''] }))).status).toBe(400)
    expect((await route.POST(req('POST', { videoId: A_VIDEO, labels: ['Past'], expiresInDays: 1000 }))).status).toBe(200) // clamped to 2 years by the server, not an error
  })
})
