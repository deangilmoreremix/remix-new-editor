import { NextRequest, NextResponse } from '../../../../shims/next-server'
import { auth } from '../../../../shims/clerk-server'
import { createServerClient } from '../../../../src/lib/supabase'
import { logPersonalization, createCorrelationId } from '../../../../src/server/personalizationLog'
import { requirePersonalizationEnv } from '../../../../src/server/envValidation'
import { rateLimit, rateLimit429, resolveRateLimitKey } from '../../../../lib/rateLimit'
import { normalizeReport } from '../../../../../../../src/features/personalization/shared/personalization/report/reportModel'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * Results report (Stage 11).
 *
 *   GET ?videoId=<id>[&from=YYYY-MM-DD&to=YYYY-MM-DD]  -> { ok, report }
 *
 * Ownership comes from the verified Clerk session (`auth()`), never from the request. The database function checks it again and returns
 * null for a video that is not the caller's: that answers 404, exactly as for a video that does not exist. The period defaults to the
 * last 30 days and is limited to 366 days. The response is shaped by the same pure module the dashboard and the PDF use.
 * Migration: supabase/migrations/20261117000000_analytics_report_push.sql (NOT applied anywhere by this change).
 */
const ROUTE = '/api/personalization/analytics-report'
const VIDEO_ID = /^[A-Za-z0-9_-]{8,32}$/
const DAY = /^\d{4}-\d{2}-\d{2}$/
const validDay = (v: string) => DAY.test(v) && !Number.isNaN(Date.parse(`${v}T00:00:00Z`)) && new Date(`${v}T00:00:00Z`).toISOString().slice(0, 10) === v

export async function GET(req: NextRequest) {
  const correlationId = createCorrelationId(req)
  const envCheck = requirePersonalizationEnv()
  if (!envCheck.valid) return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'UNAUTHENTICATED' }, { status: 401 })
  const limit = rateLimit(resolveRateLimitKey(userId, null), { windowMs: 60_000, max: 30 })
  if (!limit.allowed) return rateLimit429(limit.retryAfterMs)

  const url = new URL(req.url)
  const videoId = url.searchParams.get('videoId') ?? ''
  const from = url.searchParams.get('from'); const to = url.searchParams.get('to')
  if (!VIDEO_ID.test(videoId)) return NextResponse.json({ error: 'INVALID_VIDEO_ID' }, { status: 400 })
  if ((from !== null && !validDay(from)) || (to !== null && !validDay(to))) return NextResponse.json({ error: 'INVALID_PERIOD', message: 'Dates must look like 2026-11-13.' }, { status: 400 })
  if (from && to && from > to) return NextResponse.json({ error: 'INVALID_PERIOD', message: 'The start date is after the end date.' }, { status: 400 })
  if (from && to && (Date.parse(to) - Date.parse(from)) / 86_400_000 > 365) return NextResponse.json({ error: 'INVALID_PERIOD', message: 'Choose a period of at most 366 days.' }, { status: 400 })

  const { data, error } = await createServerClient().rpc('analytics_report', { p_clerk_user_id: userId, p_video_id: videoId, p_from: from, p_to: to })
  if (error) {
    const code = (error as { code?: string }).code
    if (code === '22023') return NextResponse.json({ error: 'INVALID_PERIOD', message: 'That period cannot be used.' }, { status: 400 })
    logPersonalization({ route: ROUTE, stage: 'report', provider: 'supabase', httpStatus: 502, safeErrorCode: 'DB_REPORT_FAILED', safeMessage: String(error.message ?? '').slice(0, 200), correlationId })
    return NextResponse.json({ error: 'Could not build the report', correlationId }, { status: 502 })
  }
  if (data === null || data === undefined) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })
  const report = normalizeReport(data)
  if (!report) return NextResponse.json({ error: 'Could not read the report', correlationId }, { status: 502 })
  return NextResponse.json({ ok: true, report }, { headers: { 'Cache-Control': 'no-store' } })
}
