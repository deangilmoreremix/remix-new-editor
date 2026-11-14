/** Browser client for the results report (Stage 11). Never throws: every outcome is a typed result with a plain message. */
import { normalizeReport, type Report } from './reportModel'

export const REPORT_API = '/api/personalization/analytics-report'
export type ReportFailure = 'unauthenticated' | 'not-found' | 'invalid' | 'rate-limited' | 'unavailable' | 'error'
export type ReportResult = { ok: true; report: Report } | { ok: false; reason: ReportFailure; message: string }

const MESSAGES: Record<ReportFailure, string> = {
  unauthenticated: 'Sign in to see your results.',
  'not-found': 'That video was not found in your account. Check the address, and that you published it from this account.',
  invalid: 'That video address or period could not be used.',
  'rate-limited': 'Too many requests. Wait a minute and try again.',
  unavailable: 'Results are not available on this server yet.',
  error: 'Something went wrong while building the report. Nothing was changed.',
}
const fail = (reason: ReportFailure, message?: string): ReportResult => ({ ok: false, reason, message: message ?? MESSAGES[reason] })

export const isoDay = (d: Date) => d.toISOString().slice(0, 10)
/** The last `days` UTC days up to and including today. */
export function lastDays(days: number, now = new Date()): { from: string; to: string } {
  const to = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())); const from = new Date(to.getTime() - (Math.max(1, days) - 1) * 86_400_000)
  return { from: isoDay(from), to: isoDay(to) }
}

export async function fetchReport(videoId: string, period: { from?: string; to?: string } = {}, fetchFn: typeof fetch = fetch): Promise<ReportResult> {
  const q = new URLSearchParams({ videoId }); if (period.from) q.set('from', period.from); if (period.to) q.set('to', period.to)
  let res: { status: number; json: Record<string, any> | null }
  try {
    const r = await fetchFn(`${REPORT_API}?${q}`, { method: 'GET', credentials: 'same-origin' })
    let json: Record<string, any> | null = null; try { json = await r.json() } catch { json = null }
    res = { status: r.status, json }
  } catch { return fail('unavailable', 'Could not reach the server.') }
  if (res.status === 200 && res.json?.ok === true) { const report = normalizeReport(res.json.report ? toRaw(res.json.report) : null); return report ? { ok: true, report } : fail('error') }
  if (res.status === 401 || res.status === 403) return fail('unauthenticated')
  if (res.status === 404) return res.json?.error === 'NOT_FOUND' ? fail('not-found') : fail('unavailable')
  if (res.status === 400) return fail('invalid', typeof res.json?.message === 'string' ? res.json.message : undefined)
  if (res.status === 429) return fail('rate-limited')
  if (res.status === 405 || res.status === 501) return fail('unavailable')
  return fail('error')
}
/** The route already returns the typed report; this keeps the client tolerant of either shape. */
function toRaw(r: any): unknown { return r && r.summary && 'pageVisits' in r.summary ? fromTyped(r) : r }
function fromTyped(r: Report): unknown {
  const s = r.summary
  return {
    video: r.video, period: r.period, generated_at: r.generatedAt,
    summary: { page_visits: s.pageVisits, plays: s.plays, sessions: s.sessions, unique_viewers: s.uniqueViewers, sessions_without_viewer_id: s.sessionsWithoutViewerId, completed_sessions: s.completedSessions, completion_rate: s.completionRate, watch_seconds: s.watchSeconds, avg_watch_seconds: s.avgWatchSeconds, avg_percent_watched: s.avgPercentWatched, repeat_view_rate: s.repeatViewRate, new_sessions: s.newSessions, returning_sessions: s.returningSessions, cta_clicks: s.ctaClicks, call_clicks: s.callClicks, overlay_clicks: s.overlayClicks, product_selects: s.productSelects, leads: s.leads, lead_conversion_rate: s.leadConversionRate, cta_conversion_rate: s.ctaConversionRate, errors: s.errors },
    daily: r.daily.map((d) => ({ day: d.day, page_visits: d.pageVisits, plays: d.plays, unique_viewers: d.uniqueViewers, completes: d.completes, cta_clicks: d.ctaClicks, leads: d.leads })),
    retention: r.retention, cta: r.cta.map((c) => ({ type: c.type, clip_id: c.clipId, label: c.label, sessions: c.sessions, eligible_sessions: c.eligibleSessions })),
    recipients: r.recipients.map((x) => ({ id: x.id, label: x.label, status: x.status, views: x.views, plays: x.plays, completes: x.completes, cta_clicks: x.ctaClicks, leads: x.leads, last_seen: x.lastSeen })),
  }
}
