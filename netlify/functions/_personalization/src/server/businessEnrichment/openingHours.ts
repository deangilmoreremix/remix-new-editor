/**
 * OpenStreetMap `opening_hours` → "open now?".
 *
 * Supports the common subset: `24/7`, day lists/ranges (`Mo-Fr`, `Sa,Su`, `Mo,We-Fr`) with one or more time ranges
 * (`09:00-17:00,18:00-22:00`, ranges may cross midnight), `off`/`closed`, and several rules joined by `;`.
 * Anything else (public holidays, sunrise/sunset, week numbers, month ranges, comments) makes the result UNKNOWN —
 * we never guess. The business's own time zone is derived from its US state; without one the answer is unknown,
 * because comparing a Florida shop's hours to the viewer's clock would be wrong.
 */

const DAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'] as const
const DAY_INDEX: Record<string, number> = Object.fromEntries(DAYS.map((d, i) => [d, i]))

export type OpenStatus = { state: 'open' | 'closed'; nextChange?: string } | { state: 'unknown' }

interface Rule { days: number[]; ranges: Array<[number, number]> | 'off' }

/** US state/territory → IANA time zone (the dominant zone; a few split states use the larger part). */
const STATE_TZ: Record<string, string> = {
  AL: 'America/Chicago', AK: 'America/Anchorage', AZ: 'America/Phoenix', AR: 'America/Chicago', CA: 'America/Los_Angeles', CO: 'America/Denver',
  CT: 'America/New_York', DE: 'America/New_York', DC: 'America/New_York', FL: 'America/New_York', GA: 'America/New_York', HI: 'Pacific/Honolulu',
  ID: 'America/Boise', IL: 'America/Chicago', IN: 'America/Indiana/Indianapolis', IA: 'America/Chicago', KS: 'America/Chicago', KY: 'America/New_York',
  LA: 'America/Chicago', ME: 'America/New_York', MD: 'America/New_York', MA: 'America/New_York', MI: 'America/Detroit', MN: 'America/Chicago',
  MS: 'America/Chicago', MO: 'America/Chicago', MT: 'America/Denver', NE: 'America/Chicago', NV: 'America/Los_Angeles', NH: 'America/New_York',
  NJ: 'America/New_York', NM: 'America/Denver', NY: 'America/New_York', NC: 'America/New_York', ND: 'America/Chicago', OH: 'America/New_York',
  OK: 'America/Chicago', OR: 'America/Los_Angeles', PA: 'America/New_York', RI: 'America/New_York', SC: 'America/New_York', SD: 'America/Chicago',
  TN: 'America/Chicago', TX: 'America/Chicago', UT: 'America/Denver', VT: 'America/New_York', VA: 'America/New_York', WA: 'America/Los_Angeles',
  WV: 'America/New_York', WI: 'America/Chicago', WY: 'America/Denver', PR: 'America/Puerto_Rico',
}

export function timeZoneForRegion(region?: string): string | null {
  const key = (region ?? '').trim().toUpperCase()
  return STATE_TZ[key] ?? null
}

const toMin = (hhmm: string): number | null => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm)
  if (!m) return null
  const h = Number(m[1]), mm = Number(m[2])
  if (h > 24 || mm > 59 || (h === 24 && mm !== 0)) return null
  return h * 60 + mm
}

function parseDays(spec: string): number[] | null {
  const out = new Set<number>()
  for (const part of spec.split(',')) {
    const r = /^([A-Z][a-z])(?:-([A-Z][a-z]))?$/.exec(part.trim())
    if (!r || !(r[1] in DAY_INDEX)) return null
    const a = DAY_INDEX[r[1]]
    if (!r[2]) { out.add(a); continue }
    if (!(r[2] in DAY_INDEX)) return null
    const b = DAY_INDEX[r[2]]
    for (let d = a; ; d = (d + 1) % 7) { out.add(d); if (d === b) break }
  }
  return [...out]
}

export function parseOpeningHours(raw: string | undefined): Rule[] | '24/7' | null {
  const text = (raw ?? '').trim()
  if (!text) return null
  if (/^24\/7$/i.test(text)) return '24/7'
  if (/(PH|SH|sunrise|sunset|week|\[|"|\bJan\b|\bFeb\b|\bMar\b|\bApr\b|\bMay\b|\bJun\b|\bJul\b|\bAug\b|\bSep\b|\bOct\b|\bNov\b|\bDec\b|\+|\|\|)/.test(text)) return null
  const rules: Rule[] = []
  for (const chunk of text.split(';')) {
    const c = chunk.trim()
    if (!c) continue
    const m = /^((?:[A-Z][a-z](?:-[A-Z][a-z])?)(?:\s*,\s*[A-Z][a-z](?:-[A-Z][a-z])?)*)?\s*(.*)$/.exec(c)
    if (!m) return null
    const days = m[1] ? parseDays(m[1]) : [0, 1, 2, 3, 4, 5, 6]
    if (!days) return null
    const rest = m[2].trim()
    if (/^(off|closed)$/i.test(rest)) { rules.push({ days, ranges: 'off' }); continue }
    if (!rest) return null
    const ranges: Array<[number, number]> = []
    for (const rr of rest.split(',')) {
      const t = /^(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})$/.exec(rr.trim())
      if (!t) return null
      const a = toMin(t[1]), b = toMin(t[2])
      if (a === null || b === null) return null
      ranges.push([a, b])
    }
    rules.push({ days, ranges })
  }
  return rules.length ? rules : null
}

/** Local weekday (0=Sun) and minutes-since-midnight in `timeZone` at instant `at`. */
function localParts(at: Date, timeZone: string): { day: number; minutes: number } | null {
  try {
    const parts = new Intl.DateTimeFormat('en-US', { timeZone, weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(at)
    const wd = parts.find((p) => p.type === 'weekday')?.value ?? ''
    const h = Number(parts.find((p) => p.type === 'hour')?.value)
    const m = Number(parts.find((p) => p.type === 'minute')?.value)
    const day = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(wd)
    if (day < 0 || Number.isNaN(h) || Number.isNaN(m)) return null
    return { day, minutes: h * 60 + m }
  } catch { return null }
}

export function openStatus(raw: string | undefined, region: string | undefined, at: Date = new Date()): OpenStatus {
  const parsed = parseOpeningHours(raw)
  if (!parsed) return { state: 'unknown' }
  if (parsed === '24/7') return { state: 'open' }
  const tz = timeZoneForRegion(region)
  if (!tz) return { state: 'unknown' }
  const now = localParts(at, tz)
  if (!now) return { state: 'unknown' }

  // Later rules override earlier ones for the same day (OSM semantics), so evaluate in order and keep the last match.
  const covers = (day: number, minutes: number, prevDay: boolean): boolean | null => {
    let result: boolean | null = null
    for (const rule of parsed) {
      if (!rule.days.includes(day)) continue
      if (rule.ranges === 'off') { result = false; continue }
      let hit = false
      for (const [a, b] of rule.ranges) {
        if (!prevDay && a <= b && minutes >= a && minutes < b) hit = true
        // a range that crosses midnight (e.g. 18:00-02:00) is open after `a` today and before `b` the next day
        if (a > b) { if (!prevDay && minutes >= a) hit = true; if (prevDay && minutes < b) hit = true }
        if (!prevDay && a === b) hit = hit || false
      }
      result = hit
    }
    return result
  }
  const today = covers(now.day, now.minutes, false)
  const yesterdaySpill = covers((now.day + 6) % 7, now.minutes, true)
  const open = today === true || yesterdaySpill === true
  return { state: open ? 'open' : 'closed' }
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const clock = (min: number): string => {
  const h24 = Math.floor(min / 60) % 24
  const m = min % 60
  const h = h24 % 12 === 0 ? 12 : h24 % 12
  return `${h}${m ? `:${String(m).padStart(2, '0')}` : ''} ${h24 < 12 ? 'am' : 'pm'}`
}
function dayLabel(days: number[]): string {
  const set = [...new Set(days)].sort((a, b) => a - b)
  if (set.length === 7) return 'daily'
  // Mon-first ordering so Mon–Sat reads as a range.
  const order = set.map((d) => (d + 6) % 7).sort((a, b) => a - b)
  const contiguous = order.every((d, i) => i === 0 || d === order[i - 1] + 1)
  const name = (monFirst: number) => DAY_NAMES[(monFirst + 1) % 7]
  if (order.length > 2 && contiguous) return `${name(order[0])}–${name(order[order.length - 1])}`
  return order.map(name).join(', ')
}

/**
 * Short human wording for published hours, e.g. "Mon–Sat 9 am–5 pm". Returns null
 * whenever the hours can't be parsed or are too complex to summarise faithfully
 * (callers then show nothing rather than a guess).
 */
export function describeHours(raw: string | undefined): string | null {
  const parsed = parseOpeningHours(raw)
  if (!parsed) return null
  if (parsed === '24/7') return 'open 24/7'
  const open = parsed.filter((r) => r.ranges !== 'off')
  if (open.length === 0 || open.length > 2) return null
  const parts: string[] = []
  for (const rule of open) {
    if (rule.ranges === 'off' || rule.ranges.length !== 1) return null
    const [a, b] = rule.ranges[0]
    parts.push(`${dayLabel(rule.days)} ${clock(a)}–${clock(b)}`)
  }
  return parts.join(', ')
}
