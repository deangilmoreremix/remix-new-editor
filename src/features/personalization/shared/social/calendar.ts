/**
 * Timezone-aware calendar math using only Date + Intl. A "plan" is a local
 * scheduling record; MuAPI publishing documents no schedule field, so nothing
 * here publishes anything by itself.
 */
export type CalendarView = 'day' | 'week' | 'month'

export interface ZonedParts { year: number; month: number; day: number; hour: number; minute: number; weekday: number }

const WEEKDAY: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }

export function isValidTimeZone(tz: string): boolean {
  try { new Intl.DateTimeFormat('en-US', { timeZone: tz }); return true } catch { return false }
}

export function localTimeZone(): string {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC' } catch { return 'UTC' }
}

export function zonedParts(ts: number, timeZone: string): ZonedParts {
  const f = new Intl.DateTimeFormat('en-US', { timeZone, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', weekday: 'short' })
  const o: Record<string, string> = {}
  for (const p of f.formatToParts(new Date(ts))) o[p.type] = p.value
  return { year: +o.year, month: +o.month, day: +o.day, hour: +o.hour % 24, minute: +o.minute, weekday: WEEKDAY[o.weekday] }
}

/** Offset (ms) of `timeZone` from UTC at instant `ts`. */
function tzOffset(ts: number, timeZone: string): number {
  const p = zonedParts(ts, timeZone)
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute) - Math.floor(ts / 60000) * 60000
}

/** The instant for a wall-clock time in a timezone (resolves DST by re-checking the offset). */
export function zonedToTimestamp(year: number, month: number, day: number, hour: number, minute: number, timeZone: string): number {
  const guess = Date.UTC(year, month - 1, day, hour, minute)
  const first = guess - tzOffset(guess, timeZone)
  return guess - tzOffset(first, timeZone)
}

export function dayKey(ts: number, timeZone: string): string {
  const p = zonedParts(ts, timeZone)
  return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`
}

export function formatInZone(ts: number, timeZone: string, opts: Intl.DateTimeFormatOptions = { dateStyle: 'medium', timeStyle: 'short' }, locale?: string): string {
  return new Intl.DateTimeFormat(locale, { timeZone, ...opts }).format(new Date(ts))
}

export function timeZoneLabel(ts: number, timeZone: string, locale?: string): string {
  return new Intl.DateTimeFormat(locale, { timeZone, timeZoneName: 'short' }).formatToParts(new Date(ts)).find((p) => p.type === 'timeZoneName')?.value || timeZone
}

/** Day keys (YYYY-MM-DD in `timeZone`) shown by a view anchored at `anchor`. Weeks start on `weekStart` (0=Sun). */
export function viewDays(view: CalendarView, anchor: number, timeZone: string, weekStart = 0): string[] {
  const p = zonedParts(anchor, timeZone)
  const base = Date.UTC(p.year, p.month - 1, p.day)
  const key = (ms: number) => new Date(ms).toISOString().slice(0, 10)
  const DAY = 86_400_000
  if (view === 'day') return [key(base)]
  if (view === 'week') {
    const start = base - ((p.weekday - weekStart + 7) % 7) * DAY
    return Array.from({ length: 7 }, (_, i) => key(start + i * DAY))
  }
  const first = Date.UTC(p.year, p.month - 1, 1)
  const lead = (new Date(first).getUTCDay() - weekStart + 7) % 7
  const daysIn = new Date(Date.UTC(p.year, p.month, 0)).getUTCDate()
  const total = Math.ceil((lead + daysIn) / 7) * 7
  return Array.from({ length: total }, (_, i) => key(first - lead * DAY + i * DAY))
}

export function shiftAnchor(view: CalendarView, anchor: number, dir: -1 | 1, timeZone: string): number {
  const p = zonedParts(anchor, timeZone)
  if (view === 'month') return zonedToTimestamp(p.year, p.month + dir, 1, p.hour, p.minute, timeZone)
  const step = view === 'week' ? 7 : 1
  return zonedToTimestamp(p.year, p.month, p.day + dir * step, p.hour, p.minute, timeZone)
}

// ---------------------------------------------------------------------------
// Plans (local schedule records)
// ---------------------------------------------------------------------------
export type PlanStatus = 'draft' | 'queued' | 'uploading' | 'processing' | 'published' | 'failed'

export interface PlanItem {
  id: string
  title: string
  platforms: string[]
  /** UTC ms. `null` = unscheduled draft. */
  scheduledAt: number | null
  status: PlanStatus
  mediaUrl?: string
  caption?: string
  /** Set once MuAPI accepted/published it; such a plan is never duplicated as publishable. */
  requestIds?: Record<string, string>
}

/** Plans sharing a platform within `windowMinutes` of each other. */
export function findConflicts(plans: PlanItem[], windowMinutes = 30): Array<[string, string]> {
  const sched = plans.filter((p) => p.scheduledAt !== null && p.status !== 'published' && p.status !== 'failed')
  const out: Array<[string, string]> = []
  for (let i = 0; i < sched.length; i++) {
    for (let j = i + 1; j < sched.length; j++) {
      if (Math.abs((sched[i].scheduledAt as number) - (sched[j].scheduledAt as number)) <= windowMinutes * 60_000 && sched[i].platforms.some((p) => sched[j].platforms.includes(p))) {
        out.push([sched[i].id, sched[j].id])
      }
    }
  }
  return out
}

/** Move a plan to another day, keeping its wall-clock time in `timeZone`. Published plans cannot move. */
export function rescheduleToDay(plan: PlanItem, targetDay: string, timeZone: string): PlanItem {
  if (plan.status === 'published') return plan
  const [y, m, d] = targetDay.split('-').map(Number)
  const p = plan.scheduledAt === null ? { hour: 9, minute: 0 } : zonedParts(plan.scheduledAt, timeZone)
  return { ...plan, scheduledAt: zonedToTimestamp(y, m, d, p.hour, p.minute, timeZone) }
}

export const isPast = (ts: number | null, now = Date.now()) => ts !== null && ts < now

export function plansByDay(plans: PlanItem[], timeZone: string): Map<string, PlanItem[]> {
  const map = new Map<string, PlanItem[]>()
  for (const p of plans) {
    if (p.scheduledAt === null) continue
    const k = dayKey(p.scheduledAt, timeZone)
    map.set(k, [...(map.get(k) || []), p].sort((a, b) => (a.scheduledAt as number) - (b.scheduledAt as number)))
  }
  return map
}

/** Queue buckets reuse the real publish statuses; 'draft' + a time = scheduled. */
export function queueBucket(p: PlanItem): 'drafts' | 'scheduled' | 'inProgress' | 'published' | 'failed' {
  if (p.status === 'published') return 'published'
  if (p.status === 'failed') return 'failed'
  if (p.status === 'uploading' || p.status === 'processing') return 'inProgress'
  if (p.status === 'queued' || p.scheduledAt !== null) return 'scheduled'
  return 'drafts'
}
