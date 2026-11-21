import { NextRequest, NextResponse } from '../../../../shims/next-server'
import { mapRpcError, validateBusinessId, validateFeedback, validateReason } from '../../../../src/server/finderContinuity/validate'
import { readJson, withFinderUser } from '../../../../src/server/finderContinuity/withFinderUser'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const ROUTE = '/api/personalization/lead-feedback'

/** The caller's own "looks wrong" flags (newest first, at most 500). Never other users'. */
export async function GET(req: NextRequest) {
  return withFinderUser(req, ROUTE, { writes: false }, async ({ userId, supabase, log, correlationId }) => {
    const { data, error } = await supabase.rpc('finder_lead_feedback_list', { p_clerk_user_id: userId })
    if (error) {
      const m = mapRpcError(error)
      log('db-list', m.status, m.code, error.message)
      return NextResponse.json({ error: m.message, code: m.code, correlationId }, { status: m.status })
    }
    log('db-list', 200)
    return NextResponse.json({ ok: true, flags: data ?? [] })
  })
}

/** Flags one business for the caller. The same flag twice is a no-op. Max 500 per user. */
export async function POST(req: NextRequest) {
  return withFinderUser(req, ROUTE, { writes: true }, async ({ userId, supabase, log, correlationId }) => {
    const parsed = await readJson(req)
    if (!parsed.ok) {
      log('parse-body', 400, 'INVALID_JSON', 'Invalid JSON body')
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }
    const v = validateFeedback(parsed.body)
    if (!v.ok) {
      log('validate', 400, 'INVALID_BODY', v.error)
      return NextResponse.json({ error: v.error }, { status: 400 })
    }
    const { data, error } = await supabase.rpc('finder_lead_feedback_add', {
      p_clerk_user_id: userId, p_business_id: v.value.businessId, p_reason: v.value.reason, p_note: v.value.note,
    })
    if (error) {
      const m = mapRpcError(error)
      log('db-add', m.status, m.code, error.message)
      return NextResponse.json({ error: m.message, code: m.code, correlationId }, { status: m.status })
    }
    log('db-add', 200)
    return NextResponse.json({ ok: true, flag: data })
  })
}

/** Removes one flag (undo): DELETE ?businessId=...&reason=... */
export async function DELETE(req: NextRequest) {
  return withFinderUser(req, ROUTE, { writes: true }, async ({ userId, supabase, log, correlationId }) => {
    const params = new URL(req.url).searchParams
    const businessId = validateBusinessId(params.get('businessId'))
    const reason = validateReason(params.get('reason'))
    if (!businessId || !reason) {
      log('validate', 400, 'INVALID_PARAMS', 'businessId and a valid reason are required')
      return NextResponse.json({ error: 'businessId and a valid reason are required' }, { status: 400 })
    }
    const { data, error } = await supabase.rpc('finder_lead_feedback_delete', { p_clerk_user_id: userId, p_business_id: businessId, p_reason: reason })
    if (error) {
      const m = mapRpcError(error)
      log('db-delete', m.status, m.code, error.message)
      return NextResponse.json({ error: m.message, code: m.code, correlationId }, { status: m.status })
    }
    if (!data) {
      log('db-delete', 404, 'NOT_FOUND')
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    log('db-delete', 200)
    return NextResponse.json({ ok: true })
  })
}
