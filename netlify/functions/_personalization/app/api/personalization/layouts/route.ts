import { NextRequest, NextResponse } from '../../../../shims/next-server'
import { auth } from '../../../../shims/clerk-server'
import { createServerClient } from '../../../../src/lib/supabase'
import { logPersonalization, createCorrelationId } from '../../../../src/server/personalizationLog'
import { requirePersonalizationEnv } from '../../../../src/server/envValidation'
import { rateLimit, rateLimit429, resolveRateLimitKey } from '../../../../lib/rateLimit'
// The SAME normalizer the editor uses (pure, no React): client and server cannot disagree on what a layout is.
import { normalizeSavedLayouts } from '../../../../../../../src/features/personalization/shared/personalization/guided/savedLayouts'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * Saved layouts (Stage 1) — a user's reusable layer arrangements. GEOMETRY ONLY: the payload is rebuilt from the
 * normalizer's output, so text, URLs, pictures and any unknown field a client sends are dropped, never stored.
 *
 *   GET     -> { ok, layouts }           the caller's layouts (max 30), newest first
 *   POST    -> { ok, layout }            body { name, layout } — saves/replaces by name (case-insensitive)
 *   DELETE  -> { ok }                    ?id=<uuid> — owner only; 404 for "missing" AND "not yours" (no existence leak)
 *
 * Ownership: the Clerk user id comes from the verified session (`auth()`), never from the request. The table's RLS and
 * the security-definer RPCs enforce it again. Migration: supabase/migrations/20261114000000_personalization_saved_layouts.sql.
 */
const ROUTE = '/api/personalization/layouts'
const MAX_BODY_BYTES = 64 * 1024
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

interface Row { id: string; name: string; layout: unknown; created_at: string; updated_at: string }

function toSavedLayout(row: Row) {
  const parsed = normalizeSavedLayouts([{ ...(row.layout as object), id: row.id, name: row.name, createdAt: Date.parse(row.updated_at) || 0 }])
  return parsed[0] ?? null
}

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

export async function GET(req: NextRequest) {
  const g = await guard(req, 'list')
  if (g instanceof Response) return g
  const { userId, correlationId } = g
  const { data, error } = await createServerClient().rpc('personalization_saved_layouts_list', { p_clerk_user_id: userId })
  if (error) {
    logPersonalization({ route: ROUTE, stage: 'db-list', provider: 'supabase', httpStatus: 502, safeErrorCode: 'DB_LIST_FAILED', safeMessage: error.message, correlationId })
    return NextResponse.json({ error: 'Could not load layouts', correlationId }, { status: 502 })
  }
  const layouts = ((data ?? []) as Row[]).map(toSavedLayout).filter((l): l is NonNullable<typeof l> => l !== null)
  return NextResponse.json({ ok: true, layouts })
}

export async function POST(req: NextRequest) {
  const g = await guard(req, 'save')
  if (g instanceof Response) return g
  const { userId, correlationId } = g

  const limit = rateLimit(resolveRateLimitKey(userId, null), { windowMs: 60_000, max: 30 })
  if (!limit.allowed) return rateLimit429(limit.retryAfterMs)

  let text: string
  try { text = await req.text() } catch { return NextResponse.json({ error: 'INVALID_BODY' }, { status: 400 }) }
  if (text.length > MAX_BODY_BYTES) return NextResponse.json({ error: 'PAYLOAD_TOO_LARGE' }, { status: 413 })
  let body: { name?: unknown; layout?: unknown }
  try { body = JSON.parse(text) } catch { return NextResponse.json({ error: 'INVALID_BODY' }, { status: 400 }) }

  const name = typeof body?.name === 'string' ? body.name.trim() : ''
  const parsed = normalizeSavedLayouts([{ ...(body?.layout && typeof body.layout === 'object' ? (body.layout as object) : {}), id: 'incoming', name }])
  if (!name || parsed.length !== 1) {
    logPersonalization({ route: ROUTE, stage: 'validate', httpStatus: 400, safeErrorCode: 'INVALID_LAYOUT', safeMessage: 'Layout failed validation', correlationId })
    return NextResponse.json({ error: 'INVALID_LAYOUT' }, { status: 400 })
  }
  // Rebuild from the normalizer's output: only known geometry fields are ever persisted.
  const { aspectRatio, layers, sourceTransform, websiteMotion } = parsed[0]
  const stored = { aspectRatio, layers, ...(sourceTransform ? { sourceTransform } : {}), ...(websiteMotion ? { websiteMotion } : {}) }

  const { data, error } = await createServerClient().rpc('personalization_saved_layouts_save', { p_clerk_user_id: userId, p_name: parsed[0].name, p_layout: stored })
  if (error) {
    if (error.code === '53400') return NextResponse.json({ error: 'LAYOUT_LIMIT_REACHED' }, { status: 409 })
    logPersonalization({ route: ROUTE, stage: 'db-save', provider: 'supabase', httpStatus: 502, safeErrorCode: 'DB_SAVE_FAILED', safeMessage: error.message, correlationId })
    return NextResponse.json({ error: 'Could not save layout', correlationId }, { status: 502 })
  }
  const layout = data ? toSavedLayout(data as Row) : null
  if (!layout) return NextResponse.json({ error: 'Could not read back the saved layout', correlationId }, { status: 502 })
  return NextResponse.json({ ok: true, layout })
}

export async function DELETE(req: NextRequest) {
  const g = await guard(req, 'delete')
  if (g instanceof Response) return g
  const { userId, correlationId } = g

  const limit = rateLimit(resolveRateLimitKey(userId, null), { windowMs: 60_000, max: 30 })
  if (!limit.allowed) return rateLimit429(limit.retryAfterMs)

  const id = new URL(req.url).searchParams.get('id') ?? ''
  if (!UUID.test(id)) return NextResponse.json({ error: 'INVALID_ID' }, { status: 400 })
  const { data, error } = await createServerClient().rpc('personalization_saved_layouts_delete', { p_id: id, p_clerk_user_id: userId })
  if (error) {
    logPersonalization({ route: ROUTE, stage: 'db-delete', provider: 'supabase', httpStatus: 502, safeErrorCode: 'DB_DELETE_FAILED', safeMessage: error.message, correlationId })
    return NextResponse.json({ error: 'Could not delete layout', correlationId }, { status: 502 })
  }
  if (data !== true) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })
  return NextResponse.json({ ok: true })
}
