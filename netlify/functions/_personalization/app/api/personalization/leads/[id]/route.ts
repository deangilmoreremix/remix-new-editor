import { NextRequest, NextResponse } from '../../../../../shims/next-server'
import { auth } from '../../../../../shims/clerk-server'
import { createServerClient } from '../../../../../src/lib/supabase'
import { logPersonalization, createCorrelationId } from '../../../../../src/server/personalizationLog'
import { requirePersonalizationEnv } from '../../../../../src/server/envValidation'
import { rateLimit, rateLimit429, resolveRateLimitKey } from '../../../../../lib/rateLimit'
import { isLeadStage } from '../../../../../src/shared/personalization/leadStages'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const MAX_NOTES_LENGTH = 5_000
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

type RouteContext = { params: Promise<{ id: string }> }

export async function PATCH(req: NextRequest, context: RouteContext) {
  const correlationId = createCorrelationId(req)
  const startTime = Date.now()

  try {
    const envCheck = requirePersonalizationEnv()
    if (!envCheck.valid) {
      logPersonalization({
        route: '/api/personalization/leads/[id]',
        stage: 'env-validation',
        httpStatus: 500,
        safeErrorCode: 'ENV_MISSING',
        safeMessage: `Missing required env vars: ${envCheck.missingRequired.join(', ')}`,
        correlationId,
      })
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
    }

    const { userId } = await auth()
    if (!userId) {
      logPersonalization({
        route: '/api/personalization/leads/[id]',
        stage: 'auth',
        httpStatus: 401,
        safeErrorCode: 'UNAUTHENTICATED',
        safeMessage: 'No authenticated user',
        correlationId,
      })
      return NextResponse.json({ error: 'UNAUTHENTICATED' }, { status: 401 })
    }

    const limit = rateLimit(resolveRateLimitKey(userId, null), { windowMs: 60_000, max: 30 })
    if (!limit.allowed) return rateLimit429(limit.retryAfterMs)

    const { id } = await context.params
    if (!UUID_PATTERN.test(id)) {
      logPersonalization({
        route: '/api/personalization/leads/[id]',
        stage: 'validation',
        httpStatus: 400,
        safeErrorCode: 'INVALID_LEAD_ID',
        safeMessage: 'Lead id must be a uuid',
        correlationId,
      })
      return NextResponse.json({ error: 'Invalid lead id' }, { status: 400 })
    }

    let body: unknown
    try {
      body = await req.json()
    } catch {
      logPersonalization({
        route: '/api/personalization/leads/[id]',
        stage: 'parse-body',
        httpStatus: 400,
        safeErrorCode: 'INVALID_JSON',
        safeMessage: 'Invalid JSON body',
        correlationId,
      })
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const payload = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>

    if (payload.stage !== undefined && !isLeadStage(payload.stage)) {
      logPersonalization({
        route: '/api/personalization/leads/[id]',
        stage: 'validation',
        httpStatus: 400,
        safeErrorCode: 'INVALID_STAGE',
        safeMessage: 'Unknown lead stage',
        correlationId,
      })
      return NextResponse.json({ error: 'Invalid stage' }, { status: 400 })
    }

    if (payload.notes !== undefined && (typeof payload.notes !== 'string' || payload.notes.length > MAX_NOTES_LENGTH)) {
      logPersonalization({
        route: '/api/personalization/leads/[id]',
        stage: 'validation',
        httpStatus: 400,
        safeErrorCode: 'INVALID_NOTES',
        safeMessage: 'Notes must be a string of at most 5000 characters',
        correlationId,
      })
      return NextResponse.json({ error: 'Invalid notes' }, { status: 400 })
    }

    if (payload.starred !== undefined && typeof payload.starred !== 'boolean') {
      logPersonalization({
        route: '/api/personalization/leads/[id]',
        stage: 'validation',
        httpStatus: 400,
        safeErrorCode: 'INVALID_STARRED',
        safeMessage: 'Starred must be a boolean',
        correlationId,
      })
      return NextResponse.json({ error: 'Invalid starred' }, { status: 400 })
    }

    if (
      payload.stage === undefined &&
      payload.notes === undefined &&
      payload.starred === undefined
    ) {
      logPersonalization({
        route: '/api/personalization/leads/[id]',
        stage: 'validation',
        httpStatus: 400,
        safeErrorCode: 'EMPTY_PATCH',
        safeMessage: 'No updatable field provided',
        correlationId,
      })
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
    }

    const supabase = createServerClient()

    // p_business_id/p_business stay null so the RPC preserves the stored
    // snapshot; only the fields present in the body are passed through.
    const { data: lead, error } = await supabase.rpc('lead_finder_leads_upsert', {
      p_id: id,
      p_clerk_user_id: userId,
      p_business_id: null,
      p_business: null,
      p_stage: payload.stage ?? null,
      p_notes: payload.notes ?? null,
      p_starred: payload.starred ?? null,
      p_niche: null,
      p_location: null,
    })

    if (error) {
      // 42501 is the RPC's "not owned by caller" error: report 404 so a caller
      // probing another user's id cannot distinguish it from absent.
      const notOwned = error.code === '42501'
      logPersonalization({
        route: '/api/personalization/leads/[id]',
        stage: 'db-update',
        provider: 'supabase',
        httpStatus: notOwned ? 404 : 502,
        safeErrorCode: notOwned ? 'LEAD_NOT_FOUND' : 'DB_UPDATE_FAILED',
        safeMessage: error.message,
        correlationId,
        durationMs: Date.now() - startTime,
      })
      return NextResponse.json(
        { error: notOwned ? 'Lead not found' : error.message, correlationId },
        { status: notOwned ? 404 : 502 }
      )
    }

    logPersonalization({
      route: '/api/personalization/leads/[id]',
      stage: 'db-update',
      provider: 'supabase',
      httpStatus: 200,
      correlationId,
      durationMs: Date.now() - startTime,
    })

    return NextResponse.json({ ok: true, lead })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    logPersonalization({
      route: '/api/personalization/leads/[id]',
      stage: 'unhandled',
      httpStatus: 500,
      safeErrorCode: 'UNEXPECTED_ERROR',
      safeMessage: message,
      correlationId,
      durationMs: Date.now() - startTime,
    })
    return NextResponse.json({ error: message, correlationId }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, context: RouteContext) {
  const correlationId = createCorrelationId(req)
  const startTime = Date.now()

  try {
    const envCheck = requirePersonalizationEnv()
    if (!envCheck.valid) {
      logPersonalization({
        route: '/api/personalization/leads/[id]',
        stage: 'env-validation',
        httpStatus: 500,
        safeErrorCode: 'ENV_MISSING',
        safeMessage: `Missing required env vars: ${envCheck.missingRequired.join(', ')}`,
        correlationId,
      })
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
    }

    const { userId } = await auth()
    if (!userId) {
      logPersonalization({
        route: '/api/personalization/leads/[id]',
        stage: 'auth',
        httpStatus: 401,
        safeErrorCode: 'UNAUTHENTICATED',
        safeMessage: 'No authenticated user',
        correlationId,
      })
      return NextResponse.json({ error: 'UNAUTHENTICATED' }, { status: 401 })
    }

    const limit = rateLimit(resolveRateLimitKey(userId, null), { windowMs: 60_000, max: 30 })
    if (!limit.allowed) return rateLimit429(limit.retryAfterMs)

    const { id } = await context.params
    if (!UUID_PATTERN.test(id)) {
      logPersonalization({
        route: '/api/personalization/leads/[id]',
        stage: 'validation',
        httpStatus: 400,
        safeErrorCode: 'INVALID_LEAD_ID',
        safeMessage: 'Lead id must be a uuid',
        correlationId,
      })
      return NextResponse.json({ error: 'Invalid lead id' }, { status: 400 })
    }

    const supabase = createServerClient()

    // Ownership is asserted inside the function; a row owned by another user
    // deletes zero rows and reports false, which the route treats as 404.
    const { data: deleted, error } = await supabase.rpc('lead_finder_leads_delete', {
      p_id: id,
      p_clerk_user_id: userId,
    })

    if (error) {
      logPersonalization({
        route: '/api/personalization/leads/[id]',
        stage: 'db-delete',
        provider: 'supabase',
        httpStatus: 502,
        safeErrorCode: 'DB_DELETE_FAILED',
        safeMessage: error.message,
        correlationId,
        durationMs: Date.now() - startTime,
      })
      return NextResponse.json({ error: error.message, correlationId }, { status: 502 })
    }

    if (!deleted) {
      logPersonalization({
        route: '/api/personalization/leads/[id]',
        stage: 'db-delete',
        provider: 'supabase',
        httpStatus: 404,
        safeErrorCode: 'LEAD_NOT_FOUND',
        safeMessage: 'No lead deleted for this owner',
        correlationId,
        durationMs: Date.now() - startTime,
      })
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 })
    }

    logPersonalization({
      route: '/api/personalization/leads/[id]',
      stage: 'db-delete',
      provider: 'supabase',
      httpStatus: 200,
      correlationId,
      durationMs: Date.now() - startTime,
    })

    return NextResponse.json({ ok: true, deleted: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    logPersonalization({
      route: '/api/personalization/leads/[id]',
      stage: 'unhandled',
      httpStatus: 500,
      safeErrorCode: 'UNEXPECTED_ERROR',
      safeMessage: message,
      correlationId,
      durationMs: Date.now() - startTime,
    })
    return NextResponse.json({ error: message, correlationId }, { status: 500 })
  }
}
