import { NextRequest, NextResponse } from '../../../../shims/next-server'
import { auth } from '../../../../shims/clerk-server'
import { createServerClient } from '../../../../src/lib/supabase'
import { logPersonalization, createCorrelationId } from '../../../../src/server/personalizationLog'
import { requirePersonalizationEnv } from '../../../../src/server/envValidation'
import { rateLimit, rateLimit429, resolveRateLimitKey } from '../../../../lib/rateLimit'
// @ts-expect-error — plain ES module shared with the video-events function (dependency-free)
import { buildPayload, isAllowedPushEndpoint, sendOne, vapidConfig } from '../../../../../_push/webPush.js'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * Owner push notifications (Stage 11, opt-in).
 *
 *   GET             -> { configured, publicKey, devices: [{ label, createdAt, lastSuccessAt }] }
 *   POST { subscription: { endpoint, keys: { p256dh, auth } }, deviceLabel? }  -> { ok, devices }   save this browser
 *   POST { test: true }                                                           -> { ok, sent }      send a test to the caller's devices
 *   DELETE { endpoint }                                                           -> { ok }          forget this browser
 *
 * Needs VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY / VAPID_SUBJECT in the server environment (see scripts/make-vapid-keys.mjs). Without them
 * GET says `configured: false` and the writes answer 503: nothing is stored that could never be used. The public key is not a secret and
 * is served here so the frontend needs no configuration; the private key never leaves the server.
 * SSRF: the server later POSTs to the endpoint a browser gives, so only https URLs on a known push service are accepted.
 */
const ROUTE = '/api/personalization/push'
const MAX_BODY_BYTES = 8 * 1024
const B64U = /^[A-Za-z0-9_-]+$/

async function guard(req: NextRequest): Promise<{ userId: string; correlationId: string } | Response> {
  const correlationId = createCorrelationId(req)
  if (!requirePersonalizationEnv().valid) return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'UNAUTHENTICATED' }, { status: 401 })
  return { userId, correlationId }
}
const readJson = async (req: NextRequest): Promise<{ ok: true; body: Record<string, any> } | { ok: false; res: Response }> => {
  let text: string
  try { text = await req.text() } catch { return { ok: false, res: NextResponse.json({ error: 'INVALID_BODY' }, { status: 400 }) } }
  if (text.length > MAX_BODY_BYTES) return { ok: false, res: NextResponse.json({ error: 'PAYLOAD_TOO_LARGE' }, { status: 413 }) }
  try { const body = JSON.parse(text); return body && typeof body === 'object' && !Array.isArray(body) ? { ok: true, body } : { ok: false, res: NextResponse.json({ error: 'INVALID_BODY' }, { status: 400 }) } } catch { return { ok: false, res: NextResponse.json({ error: 'INVALID_BODY' }, { status: 400 }) } }
}
const env = () => process.env as Record<string, string | undefined>

export async function GET(req: NextRequest) {
  const g = await guard(req); if (g instanceof Response) return g
  const cfg = vapidConfig(env())
  const { data, error } = await createServerClient().rpc('push_subscriptions_list', { p_clerk_user_id: g.userId })
  if (error) {
    // The table may not exist yet (migration not applied): the panel still needs to know whether push could ever work.
    logPersonalization({ route: ROUTE, stage: 'list', provider: 'supabase', httpStatus: 200, safeErrorCode: 'DB_PUSH_LIST_FAILED', safeMessage: String(error.message ?? '').slice(0, 200), correlationId: g.correlationId })
    return NextResponse.json({ configured: Boolean(cfg), publicKey: cfg?.publicKey ?? null, devices: [], storage: 'unavailable' }, { headers: { 'Cache-Control': 'no-store' } })
  }
  const devices = (Array.isArray(data) ? data : []).map((d: any) => ({ label: d.device_label ?? null, createdAt: d.created_at, lastSuccessAt: d.last_success_at ?? null }))
  return NextResponse.json({ configured: Boolean(cfg), publicKey: cfg?.publicKey ?? null, devices }, { headers: { 'Cache-Control': 'no-store' } })
}

export async function POST(req: NextRequest) {
  const g = await guard(req); if (g instanceof Response) return g
  const { userId, correlationId } = g
  const cfg = vapidConfig(env())
  if (!cfg) return NextResponse.json({ error: 'NOT_CONFIGURED', message: 'Notifications are not set up on this server.' }, { status: 503 })
  const limit = rateLimit(resolveRateLimitKey(userId, null), { windowMs: 3_600_000, max: 30 })
  if (!limit.allowed) return rateLimit429(limit.retryAfterMs)
  const parsed = await readJson(req); if (!parsed.ok) return parsed.res
  const body = parsed.body
  const db = createServerClient()

  if (body.test === true) {
    const { data, error } = await db.rpc('push_subscriptions_for_owner', { p_clerk_user_id: userId })
    if (error) { logPersonalization({ route: ROUTE, stage: 'test-list', provider: 'supabase', httpStatus: 502, safeErrorCode: 'DB_PUSH_LIST_FAILED', safeMessage: String(error.message ?? '').slice(0, 200), correlationId }); return NextResponse.json({ error: 'Could not read your devices', correlationId }, { status: 502 }) }
    const subs = (Array.isArray(data) ? data : []).slice(0, 10)
    if (subs.length === 0) return NextResponse.json({ error: 'NO_DEVICES', message: 'Turn notifications on in this browser first.' }, { status: 409 })
    const payload = buildPayload({ title: 'Test notification', summary: 'Notifications are working. You will see alerts like this when someone uses your video.' }, { test: true })
    const results = await Promise.all(subs.map((sub: any) => sendOne({ sub, payload, vapid: cfg, env: env(), topic: 'test', ttl: 300 }).then((r: any) => ({ sub, r }))))
    const gone = results.filter((x: any) => x.r.status === 'gone').map((x: any) => x.sub.endpoint); const ok = results.filter((x: any) => x.r.status === 'sent').map((x: any) => x.sub.endpoint)
    if (gone.length || ok.length) await db.rpc('push_subscription_report', { p_gone: gone, p_ok: ok })
    const sent = ok.length
    if (sent === 0) return NextResponse.json({ error: 'SEND_FAILED', message: gone.length ? 'This browser is no longer subscribed. Turn notifications on again.' : 'The push service did not accept the message. Try again later.', sent: 0, gone: gone.length }, { status: 502 })
    return NextResponse.json({ ok: true, sent, note: 'The push service accepted the message. It should appear on your device in a moment.' })
  }

  const sub = body.subscription as { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } } | undefined
  const endpoint = typeof sub?.endpoint === 'string' ? sub.endpoint : ''; const p256dh = typeof sub?.keys?.p256dh === 'string' ? sub.keys.p256dh : ''; const authKey = typeof sub?.keys?.auth === 'string' ? sub.keys.auth : ''
  if (!isAllowedPushEndpoint(endpoint, env())) return NextResponse.json({ error: 'INVALID_ENDPOINT', message: 'That browser\'s push address is not one this server will send to.' }, { status: 400 })
  if (!B64U.test(p256dh) || !B64U.test(authKey) || p256dh.length < 80 || p256dh.length > 100 || authKey.length < 20 || authKey.length > 32) return NextResponse.json({ error: 'INVALID_KEYS' }, { status: 400 })
  const label = typeof body.deviceLabel === 'string' ? body.deviceLabel.replace(/[\u0000-\u001F\u007F]/g, ' ').trim().slice(0, 60) : '' // eslint-disable-line no-control-regex
  const saved = await db.rpc('push_subscription_save', { p_clerk_user_id: userId, p_endpoint: endpoint, p_p256dh: p256dh, p_auth: authKey, p_device_label: label || null })
  if (saved.error) {
    logPersonalization({ route: ROUTE, stage: 'save', provider: 'supabase', httpStatus: 502, safeErrorCode: 'DB_PUSH_SAVE_FAILED', safeMessage: String(saved.error.message ?? '').slice(0, 200), correlationId })
    return NextResponse.json({ error: 'Could not save this browser', correlationId }, { status: 502 })
  }
  return NextResponse.json({ ok: true, devices: Number(saved.data) || 1 })
}

export async function DELETE(req: NextRequest) {
  const g = await guard(req); if (g instanceof Response) return g
  const parsed = await readJson(req); if (!parsed.ok) return parsed.res
  const endpoint = typeof parsed.body.endpoint === 'string' ? parsed.body.endpoint : ''
  if (!endpoint || endpoint.length > 1000) return NextResponse.json({ error: 'INVALID_ENDPOINT' }, { status: 400 })
  const { data, error } = await createServerClient().rpc('push_subscription_remove', { p_clerk_user_id: g.userId, p_endpoint: endpoint })
  if (error) { logPersonalization({ route: ROUTE, stage: 'remove', provider: 'supabase', httpStatus: 502, safeErrorCode: 'DB_PUSH_REMOVE_FAILED', safeMessage: String(error.message ?? '').slice(0, 200), correlationId: g.correlationId }); return NextResponse.json({ error: 'Could not remove this browser', correlationId: g.correlationId }, { status: 502 }) }
  return NextResponse.json({ ok: true, removed: data === true })
}
