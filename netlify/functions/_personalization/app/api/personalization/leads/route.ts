import { NextRequest, NextResponse } from '../../../../shims/next-server'
import { auth } from '../../../../shims/clerk-server'
import { createServerClient } from '../../../../src/lib/supabase'
import { logPersonalization, createCorrelationId } from '../../../../src/server/personalizationLog'
import { requirePersonalizationEnv } from '../../../../src/server/envValidation'
import { rateLimit, rateLimit429, resolveRateLimitKey } from '../../../../lib/rateLimit'
import { isLeadStage } from '../../../../src/shared/personalization/leadStages'
import type { BusinessDiscoveryRecord } from '../../../../src/shared/personalization/types'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const MAX_NOTES_LENGTH = 5_000

function isValidBusiness(value: unknown): value is BusinessDiscoveryRecord {
  if (!value || typeof value !== 'object') return false
  const record = value as Record<string, unknown>
  return typeof record.id === 'string' && record.id.length > 0
    && typeof record.name === 'string' && record.name.length > 0
}

export async function GET(req: NextRequest) {
  const correlationId = createCorrelationId(req)
  const startTime = Date.now()

  try {
    const envCheck = requirePersonalizationEnv()
    if (!envCheck.valid) {
      logPersonalization({
        route: '/api/personalization/leads',
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
        route: '/api/personalization/leads',
        stage: 'auth',
        httpStatus: 401,
        safeErrorCode: 'UNAUTHENTICATED',
        safeMessage: 'No authenticated user',
        correlationId,
      })
      return NextResponse.json({ error: 'UNAUTHENTICATED' }, { status: 401 })
    }

    const supabase = createServerClient()

    const { data, error } = await supabase.rpc('lead_finder_leads_list', { p_clerk_user_id: userId })

    if (error) {
      logPersonalization({
        route: '/api/personalization/leads',
        stage: 'db-list',
        provider: 'supabase',
        httpStatus: 502,
        safeErrorCode: 'DB_LIST_FAILED',
        safeMessage: error.message,
        correlationId,
        durationMs: Date.now() - startTime,
      })
      return NextResponse.json({ error: error.message, correlationId }, { status: 502 })
    }

    logPersonalization({
      route: '/api/personalization/leads',
      stage: 'db-list',
      provider: 'supabase',
      httpStatus: 200,
      correlationId,
      durationMs: Date.now() - startTime,
    })

    return NextResponse.json({ ok: true, leads: data || [] })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    logPersonalization({
      route: '/api/personalization/leads',
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

export async function POST(req: NextRequest) {
  const correlationId = createCorrelationId(req)
  const startTime = Date.now()

  try {
    const envCheck = requirePersonalizationEnv()
    if (!envCheck.valid) {
      logPersonalization({
        route: '/api/personalization/leads',
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
        route: '/api/personalization/leads',
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

    let body: unknown
    try {
      body = await req.json()
    } catch {
      logPersonalization({
        route: '/api/personalization/leads',
        stage: 'parse-body',
        httpStatus: 400,
        safeErrorCode: 'INVALID_JSON',
        safeMessage: 'Invalid JSON body',
        correlationId,
      })
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const payload = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>

    if (!isValidBusiness(payload.business)) {
      logPersonalization({
        route: '/api/personalization/leads',
        stage: 'validation',
        httpStatus: 400,
        safeErrorCode: 'INVALID_BUSINESS',
        safeMessage: 'Missing or invalid business object',
        correlationId,
      })
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
    }

    if (payload.stage !== undefined && !isLeadStage(payload.stage)) {
      logPersonalization({
        route: '/api/personalization/leads',
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
        route: '/api/personalization/leads',
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
        route: '/api/personalization/leads',
        stage: 'validation',
        httpStatus: 400,
        safeErrorCode: 'INVALID_STARRED',
        safeMessage: 'Starred must be a boolean',
        correlationId,
      })
      return NextResponse.json({ error: 'Invalid starred' }, { status: 400 })
    }

    for (const field of ['niche', 'location'] as const) {
      if (payload[field] !== undefined && typeof payload[field] !== 'string') {
        logPersonalization({
          route: '/api/personalization/leads',
          stage: 'validation',
          httpStatus: 400,
          safeErrorCode: `INVALID_${field.toUpperCase()}`,
          safeMessage: `${field} must be a string`,
          correlationId,
        })
        return NextResponse.json({ error: `Invalid ${field}` }, { status: 400 })
      }
    }

    const supabase = createServerClient()

    // The identity is always taken from auth(), never from the body: the
    // SECURITY DEFINER RPC owns the ownership check, and a caller-supplied
    // p_clerk_user_id would bypass it.
    const { data: lead, error } = await supabase.rpc('lead_finder_leads_upsert', {
      p_id: null,
      p_clerk_user_id: userId,
      p_business_id: (payload.business as BusinessDiscoveryRecord).id,
      p_business: payload.business as never,
      p_stage: payload.stage ?? null,
      p_notes: payload.notes ?? null,
      p_starred: payload.starred ?? null,
      p_niche: payload.niche ?? null,
      p_location: payload.location ?? null,
    })

    if (error) {
      logPersonalization({
        route: '/api/personalization/leads',
        stage: 'db-upsert',
        provider: 'supabase',
        httpStatus: 502,
        safeErrorCode: 'DB_UPSERT_FAILED',
        safeMessage: error.message,
        correlationId,
        durationMs: Date.now() - startTime,
      })
      return NextResponse.json({ error: error.message, correlationId }, { status: 502 })
    }

    logPersonalization({
      route: '/api/personalization/leads',
      stage: 'db-upsert',
      provider: 'supabase',
      httpStatus: 200,
      correlationId,
      durationMs: Date.now() - startTime,
    })

    return NextResponse.json({ ok: true, lead })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    logPersonalization({
      route: '/api/personalization/leads',
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
