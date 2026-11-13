import { NextRequest, NextResponse } from '../../../../shims/next-server'
import { auth } from '../../../../shims/clerk-server'
import { createServerClient } from '../../../../src/lib/supabase'
import { logPersonalization, createCorrelationId } from '../../../../src/server/personalizationLog'
import { requirePersonalizationEnv } from '../../../../src/server/envValidation'
import { rateLimit, rateLimit429, resolveRateLimitKey } from '../../../../lib/rateLimit'
// The SAME pure module the editor uses: client and server cannot disagree on what a token, a label or a link looks like.
import {
  MAX_ISSUE_BATCH, buildRecipientUrl, expiryFromDays, generateRecipientToken, hashRecipientToken, isVideoId, planLabels,
} from '../../../../../../../src/features/personalization/shared/personalization/publish/recipientToken'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * Recipient links (Stage 8) — server-issued, unguessable per-recipient tokens for personalized watch pages.
 *
 *   GET     ?videoId=<id>                -> { ok, links }   the caller's links for that video with view/click/lead counts
 *   POST    { videoId, labels[], expiresInDays? }
 *                                         -> { ok, links: [{ id, label, token, url }] }
 *   DELETE  ?id=<uuid>                   -> { ok }          revoke (owner only; 404 for missing AND not-yours)
 *
 * The token is made HERE (192 random bits), hashed, and only the hash is stored. It is returned exactly once in the POST response
 * and cannot be recovered later: the owner keeps the links, or revokes and re-issues. Ownership comes from the verified Clerk
 * session (`auth()`), never from the request; the RPCs and RLS enforce it again.
 * Migration: supabase/migrations/20261115000000_recipient_links.sql (NOT applied anywhere by this change).
 */
const ROUTE = '/api/personalization/recipient-links'
const MAX_BODY_BYTES = 64 * 1024
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

async function guard(req: NextRequest, stage: string): Promise<{ userId: string; correlationId: string } | Response> {
  const correlationId = createCorrelationId(req)
  const envCheck = requirePersonalizationEnv()
  if (!envCheck.valid) {
    logPersonalization({ route: ROUTE, stage: 'env-validation', httpStatus: 500, safeErrorCode: 'ENV_MISSING', safeMessage: `Missing required env vars: ${envCheck.missingRequired.join(', ')}`, correlationId })
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
  }
  const { userId } = await auth()
  if (!userId) {
    logPersonalization({ route: ROUTE, stage: `${stage}-auth`, httpStatus: 401, safeErrorCode: 'UNAUTHENTICATED', safeMessage: 'No authenticated user', correlationId })
    return NextResponse.json({ error: 'UNAUTHENTICATED' }, { status: 401 })
  }
  return { userId, correlationId }
}

const siteBase = (req: NextRequest): string => {
  const env = (typeof process !== 'undefined' ? process.env : {}) as Record<string, string | undefined>
  for (const v of [env.SITE_URL, env.URL, env.VITE_SITE_URL]) { try { if (v && /^https?:\/\//.test(v)) return new URL(v).origin } catch { /* try the next */ } }
  return new URL(req.url).origin
}

interface ListRow { id: string; label: string; created_at: string; expires_at: string | null; revoked_at: string | null; views: number | string; plays: number | string; completes: number | string; cta_clicks: number | string; leads: number | string; last_seen: string | null }
const n = (v: unknown) => Number(v) || 0
const toLink = (r: ListRow) => ({
  id: r.id, label: r.label, createdAt: r.created_at, expiresAt: r.expires_at, revokedAt: r.revoked_at,
  status: r.revoked_at ? 'revoked' : r.expires_at && Date.parse(r.expires_at) <= Date.now() ? 'expired' : 'live',
  views: n(r.views), plays: n(r.plays), completes: n(r.completes), ctaClicks: n(r.cta_clicks), leads: n(r.leads), lastSeen: r.last_seen,
})

export async function GET(req: NextRequest) {
  const g = await guard(req, 'list')
  if (g instanceof Response) return g
  const { userId, correlationId } = g
  const videoId = new URL(req.url).searchParams.get('videoId') ?? ''
  if (!isVideoId(videoId)) return NextResponse.json({ error: 'INVALID_VIDEO' }, { status: 400 })
  const { data, error } = await createServerClient().rpc('recipient_links_list', { p_clerk_user_id: userId, p_video_id: videoId })
  if (error) {
    logPersonalization({ route: ROUTE, stage: 'db-list', provider: 'supabase', httpStatus: 502, safeErrorCode: 'DB_LIST_FAILED', safeMessage: error.message, correlationId })
    return NextResponse.json({ error: 'Could not load links', correlationId }, { status: 502 })
  }
  return NextResponse.json({ ok: true, links: ((data ?? []) as ListRow[]).map(toLink) })
}

export async function POST(req: NextRequest) {
  const g = await guard(req, 'issue')
  if (g instanceof Response) return g
  const { userId, correlationId } = g

  const limit = rateLimit(resolveRateLimitKey(userId, null), { windowMs: 60_000, max: 12 })
  if (!limit.allowed) return rateLimit429(limit.retryAfterMs)

  let text: string
  try { text = await req.text() } catch { return NextResponse.json({ error: 'INVALID_BODY' }, { status: 400 }) }
  if (text.length > MAX_BODY_BYTES) return NextResponse.json({ error: 'PAYLOAD_TOO_LARGE' }, { status: 413 })
  let body: { videoId?: unknown; labels?: unknown; expiresInDays?: unknown }
  try { body = JSON.parse(text) } catch { return NextResponse.json({ error: 'INVALID_BODY' }, { status: 400 }) }

  if (!isVideoId(body?.videoId)) return NextResponse.json({ error: 'INVALID_VIDEO' }, { status: 400 })
  if (!Array.isArray(body.labels) || body.labels.length === 0) return NextResponse.json({ error: 'INVALID_LABELS', message: 'Send at least one label.' }, { status: 400 })
  if (body.labels.length > MAX_ISSUE_BATCH * 2) return NextResponse.json({ error: 'TOO_MANY_LABELS' }, { status: 400 })
  const plan = planLabels(body.labels)
  if (plan.tooMany) return NextResponse.json({ error: 'TOO_MANY_LABELS', message: `At most ${MAX_ISSUE_BATCH} links at a time.` }, { status: 400 })
  if (plan.problems.length > 0 || plan.labels.length === 0) return NextResponse.json({ error: 'INVALID_LABELS', problems: plan.problems }, { status: 400 })
  if (body.expiresInDays !== undefined && body.expiresInDays !== null && (typeof body.expiresInDays !== 'number' || !Number.isFinite(body.expiresInDays) || body.expiresInDays <= 0)) {
    return NextResponse.json({ error: 'INVALID_EXPIRY' }, { status: 400 })
  }
  const expiresAt = expiryFromDays(body.expiresInDays as number | null | undefined)

  const tokens = plan.labels.map(() => generateRecipientToken())
  const hashes = await Promise.all(tokens.map(hashRecipientToken))
  const { data, error } = await createServerClient().rpc('recipient_links_issue', {
    p_clerk_user_id: userId, p_video_id: body.videoId, p_labels: plan.labels, p_token_hashes: hashes, p_expires_at: expiresAt,
  })
  if (error) {
    if (error.code === 'P0002') return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })
    if (error.code === '53400') return NextResponse.json({ error: 'LINK_LIMIT_REACHED' }, { status: 409 })
    if (error.code === '22023') return NextResponse.json({ error: 'INVALID_REQUEST' }, { status: 400 })
    if (error.code === '23505') return NextResponse.json({ error: 'DUPLICATE_LABEL', message: 'A live link already exists for one of these names. Revoke it first, or use a different name.' }, { status: 409 })
    logPersonalization({ route: ROUTE, stage: 'db-issue', provider: 'supabase', httpStatus: 502, safeErrorCode: 'DB_ISSUE_FAILED', safeMessage: error.message, correlationId })
    return NextResponse.json({ error: 'Could not create the links', correlationId }, { status: 502 })
  }
  const rows = (data ?? []) as Array<{ id: string; label: string }>
  if (rows.length !== plan.labels.length) return NextResponse.json({ error: 'Could not read back the links', correlationId }, { status: 502 })
  const base = siteBase(req)
  const byLabel = new Map(rows.map((r) => [r.label.toLowerCase(), r.id]))
  const links = plan.labels.map((label, i) => ({ id: byLabel.get(label.toLowerCase()) ?? null, label, token: tokens[i], url: buildRecipientUrl(base, body.videoId as string, tokens[i]) }))
  if (links.some((l) => !l.id)) return NextResponse.json({ error: 'Could not match the links', correlationId }, { status: 502 })
  // The tokens are shown once: never cache this response.
  return NextResponse.json({ ok: true, links }, { headers: { 'Cache-Control': 'no-store' } })
}

export async function DELETE(req: NextRequest) {
  const g = await guard(req, 'revoke')
  if (g instanceof Response) return g
  const { userId, correlationId } = g
  const limit = rateLimit(resolveRateLimitKey(userId, null), { windowMs: 60_000, max: 60 })
  if (!limit.allowed) return rateLimit429(limit.retryAfterMs)
  const id = new URL(req.url).searchParams.get('id') ?? ''
  if (!UUID.test(id)) return NextResponse.json({ error: 'INVALID_ID' }, { status: 400 })
  const { data, error } = await createServerClient().rpc('recipient_links_revoke', { p_id: id, p_clerk_user_id: userId })
  if (error) {
    logPersonalization({ route: ROUTE, stage: 'db-revoke', provider: 'supabase', httpStatus: 502, safeErrorCode: 'DB_REVOKE_FAILED', safeMessage: error.message, correlationId })
    return NextResponse.json({ error: 'Could not revoke the link', correlationId }, { status: 502 })
  }
  if (data !== true) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })
  return NextResponse.json({ ok: true })
}
