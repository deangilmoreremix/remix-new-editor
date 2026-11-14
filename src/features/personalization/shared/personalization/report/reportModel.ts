/**
 * The results report (Stage 11): one shape shared by the server route, the dashboard and the PDF. Pure.
 *
 * Honesty rules baked in here:
 *   - the funnel is BY RECIPIENT only (links made → opened → played → finished → took action), because that is the one chain whose steps
 *     count the same thing; page visits, plays and clicks are different units and are shown as separate, defined figures
 *   - rates are null (shown as "—") when there is nothing to divide by, never 0%
 *   - "unique viewers" counts only browsers that allowed an id: the report says so, and says how many sessions had none
 *   - observations are plain facts computed from the numbers; nothing is predicted or advised
 */
import { toCsv } from '../bulk/csv'

export interface ReportSummary {
  pageVisits: number; plays: number; sessions: number; uniqueViewers: number; sessionsWithoutViewerId: number; completedSessions: number
  completionRate: number | null; watchSeconds: number; avgWatchSeconds: number | null; avgPercentWatched: number | null; repeatViewRate: number | null
  newSessions: number; returningSessions: number; ctaClicks: number; callClicks: number; overlayClicks: number; productSelects: number; leads: number
  leadConversionRate: number | null; ctaConversionRate: number | null; errors: number
}
export interface ReportDay { day: string; pageVisits: number; plays: number; uniqueViewers: number; completes: number; ctaClicks: number; leads: number }
export interface ReportRecipient { id: string; label: string; status: 'live' | 'revoked' | 'expired'; views: number; plays: number; completes: number; ctaClicks: number; leads: number; lastSeen: string | null }
export interface Report {
  video: { id: string; title: string; published: boolean }
  period: { from: string; to: string }
  summary: ReportSummary; daily: ReportDay[]
  retention: Array<{ bucket: number; viewers: number; base: number }>
  cta: Array<{ type: string; clipId: string; label: string; sessions: number; eligibleSessions: number }>
  recipients: ReportRecipient[]
  generatedAt: string
}

const num = (v: unknown): number => { const x = typeof v === 'string' && v.trim() !== '' ? Number(v) : v; return typeof x === 'number' && Number.isFinite(x) ? x : 0 }
const rate = (v: unknown): number | null => (v === null || v === undefined || v === '' || !Number.isFinite(Number(v)) ? null : Number(v))
// eslint-disable-next-line no-control-regex
const str = (v: unknown, max: number): string => (typeof v === 'string' ? v.replace(/[\u0000-\u001F\u007F]/g, ' ').trim().slice(0, max) : '')
const DAY = /^\d{4}-\d{2}-\d{2}$/
const isRaw = (v: unknown): v is Record<string, any> => Boolean(v) && typeof v === 'object' && !Array.isArray(v)

/** Turns the database's JSON (snake_case, numbers sometimes as strings) into a Report, or null when it is not a report at all. */
export function normalizeReport(raw: unknown): Report | null {
  if (!isRaw(raw) || !isRaw(raw.video) || !isRaw(raw.summary) || !isRaw(raw.period)) return null
  const id = str(raw.video.id, 40); const from = str(raw.period.from, 10); const to = str(raw.period.to, 10)
  if (!id || !DAY.test(from) || !DAY.test(to)) return null
  const s = raw.summary
  const list = (v: unknown, max: number): Array<Record<string, any>> => (Array.isArray(v) ? v.filter(isRaw).slice(0, max) : [])
  return {
    video: { id, title: str(raw.video.title, 120) || 'Untitled video', published: raw.video.published === true },
    period: { from, to },
    summary: {
      pageVisits: num(s.page_visits), plays: num(s.plays), sessions: num(s.sessions), uniqueViewers: num(s.unique_viewers), sessionsWithoutViewerId: num(s.sessions_without_viewer_id), completedSessions: num(s.completed_sessions),
      completionRate: rate(s.completion_rate), watchSeconds: num(s.watch_seconds), avgWatchSeconds: rate(s.avg_watch_seconds), avgPercentWatched: rate(s.avg_percent_watched), repeatViewRate: rate(s.repeat_view_rate),
      newSessions: num(s.new_sessions), returningSessions: num(s.returning_sessions), ctaClicks: num(s.cta_clicks), callClicks: num(s.call_clicks), overlayClicks: num(s.overlay_clicks), productSelects: num(s.product_selects), leads: num(s.leads),
      leadConversionRate: rate(s.lead_conversion_rate), ctaConversionRate: rate(s.cta_conversion_rate), errors: num(s.errors),
    },
    daily: list(raw.daily, 400).filter((d) => DAY.test(str(d.day, 10))).map((d) => ({ day: str(d.day, 10), pageVisits: num(d.page_visits), plays: num(d.plays), uniqueViewers: num(d.unique_viewers), completes: num(d.completes), ctaClicks: num(d.cta_clicks), leads: num(d.leads) })),
    retention: list(raw.retention, 200).map((r) => ({ bucket: num(r.bucket), viewers: num(r.viewers), base: num(r.base) })),
    cta: list(raw.cta, 50).map((c) => ({ type: str(c.type, 30), clipId: str(c.clip_id, 80), label: str(c.label, 80), sessions: num(c.sessions), eligibleSessions: num(c.eligible_sessions) })),
    recipients: list(raw.recipients, 500).map((r) => ({
      id: str(r.id, 40), label: str(r.label, 80), status: r.status === 'revoked' || r.status === 'expired' ? r.status : 'live',
      views: num(r.views), plays: num(r.plays), completes: num(r.completes), ctaClicks: num(r.cta_clicks), leads: num(r.leads), lastSeen: typeof r.last_seen === 'string' ? str(r.last_seen, 40) : null,
    })),
    generatedAt: str(raw.generated_at, 40),
  }
}

// ---------------------------------------------------------------- recipients
export type Engagement = 'not-opened' | 'opened' | 'played' | 'finished' | 'acted'
export const ENGAGEMENT_ORDER: Engagement[] = ['not-opened', 'opened', 'played', 'finished', 'acted']
export const ENGAGEMENT_TEXT: Record<Engagement, string> = { 'not-opened': 'Not opened', opened: 'Opened', played: 'Watched some', finished: 'Watched to the end', acted: 'Took action' }
/** The furthest step this recipient reached. */
export function engagementOf(r: Pick<ReportRecipient, 'views' | 'plays' | 'completes' | 'ctaClicks' | 'leads'>): Engagement {
  if (r.ctaClicks > 0 || r.leads > 0) return 'acted'
  if (r.completes > 0) return 'finished'
  if (r.plays > 0) return 'played'
  if (r.views > 0) return 'opened'
  return 'not-opened'
}
export interface FunnelStep { id: 'made' | 'opened' | 'played' | 'finished' | 'acted'; label: string; count: number; ofMade: number | null }
/** Only live links count: a revoked or expired link cannot be opened, so it is not an unanswered invitation. Revoked links that WERE used still count as reached. */
export function recipientFunnel(recipients: ReportRecipient[]): FunnelStep[] {
  const reached = (min: Engagement) => recipients.filter((r) => ENGAGEMENT_ORDER.indexOf(engagementOf(r)) >= ENGAGEMENT_ORDER.indexOf(min)).length
  const made = recipients.length; const frac = (n: number) => (made > 0 ? n / made : null)
  const steps: Array<[FunnelStep['id'], string, number]> = [['made', 'Personal links made', made], ['opened', 'Opened the page', reached('opened')], ['played', 'Pressed play', reached('played')], ['finished', 'Watched to the end', reached('finished')], ['acted', 'Took action (button or form)', reached('acted')]]
  return steps.map(([id, label, count]) => ({ id, label, count, ofMade: frac(count) }))
}

export interface Tile { id: string; label: string; value: string; note: string }
export const pct = (v: number | null, digits = 0): string => (v === null ? '—' : `${(v * 100).toFixed(digits)}%`)
export const duration = (sec: number | null): string => { if (sec === null) return '—'; const s = Math.round(sec); return s >= 60 ? `${Math.floor(s / 60)} min ${String(s % 60).padStart(2, '0')} s` : `${s} s` }
/** Defined figures: each says what it counts, so no number is mistaken for another. */
export function tiles(r: Report): Tile[] {
  const s = r.summary
  return [
    { id: 'visits', label: 'Page visits', value: String(s.pageVisits), note: 'Times the page was opened (once per visit).' },
    { id: 'sessions', label: 'Viewers who pressed play', value: String(s.sessions), note: 'Visits where playback started.' },
    { id: 'completed', label: 'Watched to the end', value: String(s.completedSessions), note: `${pct(s.completionRate)} of the visits that pressed play.` },
    { id: 'avg-watched', label: 'Average share watched', value: pct(s.avgPercentWatched), note: s.avgWatchSeconds === null ? 'Of the video, for visits that pressed play.' : `About ${duration(s.avgWatchSeconds)} per visit.` },
    { id: 'unique', label: 'Different viewers', value: String(s.uniqueViewers), note: s.sessionsWithoutViewerId > 0 ? `Counts only browsers that allowed an id; ${s.sessionsWithoutViewerId} visit${s.sessionsWithoutViewerId === 1 ? ' had' : 's had'} none, so the real number can be higher.` : 'Browsers are counted once, by a private random id.' },
    { id: 'cta', label: 'Button clicks', value: String(s.ctaClicks), note: `${pct(s.ctaConversionRate)} of the visits that pressed play (a repeat click on the same button counts once per visit).` },
    { id: 'leads', label: 'Form submissions', value: String(s.leads), note: `${pct(s.leadConversionRate)} of the visits that pressed play.` },
  ]
}

/** Plain facts from the numbers. Nothing predicted, nothing advised. */
export function observations(r: Report): string[] {
  const out: string[] = []; const s = r.summary
  if (s.pageVisits === 0 && s.plays === 0) out.push('Nobody has opened the video in this period.')
  else {
    out.push(`${s.pageVisits} visit${s.pageVisits === 1 ? '' : 's'}, ${s.sessions} that pressed play and ${s.completedSessions} that watched to the end.`)
    if (s.uniqueViewers > 0 || s.sessionsWithoutViewerId > 0) out.push(s.sessionsWithoutViewerId > 0 ? `${s.uniqueViewers} different viewer${s.uniqueViewers === 1 ? '' : 's'} could be told apart; ${s.sessionsWithoutViewerId} visit${s.sessionsWithoutViewerId === 1 ? '' : 's'} came from browsers that did not allow an id.` : `${s.uniqueViewers} different viewer${s.uniqueViewers === 1 ? '' : 's'}.`)
  }
  const f = recipientFunnel(r.recipients)
  if (f[0].count > 0) {
    out.push(`${f[1].count} of ${f[0].count} personal links ${f[1].count === 1 ? 'was' : 'were'} opened, ${f[2].count} pressed play, ${f[3].count} watched to the end and ${f[4].count} took action.`)
    const never = r.recipients.filter((x) => engagementOf(x) === 'not-opened' && x.status === 'live').length
    if (never > 0) out.push(`${never} live link${never === 1 ? ' has' : 's have'} not been opened.`)
    const top = [...r.recipients].sort((a, b) => b.plays - a.plays || b.views - a.views)[0]
    if (top && top.plays > 0) out.push(`Most plays: ${top.label} (${top.plays}).`)
  }
  if (r.retention.length >= 2 && r.retention[0].base > 0) {
    const first = r.retention[0]; const last = r.retention[r.retention.length - 1]
    out.push(`${Math.round((last.viewers / (first.viewers || 1)) * 100)}% of the viewers who started were still watching at the end.`)
  }
  if (s.errors > 0) out.push(`${s.errors} playback error${s.errors === 1 ? ' was' : 's were'} reported.`)
  return out
}

const CTA_TYPE_TEXT: Record<string, string> = { cta_click: 'Button', call_click: 'Call button', product_select: 'Product choice', overlay_click: 'Overlay', lead_submit: 'Form submission' }
/** A readable name for a button row: the label the owner gave it, else what kind of action it is. */
export const ctaName = (c: { type: string; clipId: string; label: string }): string => c.label || `${CTA_TYPE_TEXT[c.type] ?? 'Action'}${c.clipId ? ` (${c.clipId})` : ''}`

export const REPORT_DEFINITIONS: string[] = [
  'A visit is one opening of the page by one browser. A "viewer who pressed play" is a visit where playback started.',
  'Different viewers counts only browsers that allowed a private random id; visits without one are never counted as people.',
  'Button clicks and form submissions come from the hosted player. Views by someone who blocks analytics, or whose browser sends Do Not Track, are not recorded.',
  'Per-recipient numbers are exact for the personal link that was opened; a link that was forwarded counts for the original recipient.',
  'Days are UTC days.',
]

// ---------------------------------------------------------------- CSV
export function recipientsCsv(r: Report): string {
  const rows: string[][] = [['recipient', 'link_status', 'furthest_step', 'opens', 'plays', 'finished', 'button_clicks', 'form_submissions', 'last_seen']]
  for (const x of r.recipients) rows.push([x.label, x.status, ENGAGEMENT_TEXT[engagementOf(x)], String(x.views), String(x.plays), String(x.completes), String(x.ctaClicks), String(x.leads), x.lastSeen ?? ''])
  return toCsv(rows)
}
export function dailyCsv(r: Report): string {
  return toCsv([['day', 'page_visits', 'plays', 'different_viewers', 'finished', 'button_clicks', 'form_submissions'], ...r.daily.map((d) => [d.day, String(d.pageVisits), String(d.plays), String(d.uniqueViewers), String(d.completes), String(d.ctaClicks), String(d.leads)])])
}
