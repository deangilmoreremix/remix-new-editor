/**
 * Quiet-hours form <-> retarget_preferences.quiet_hours jsonb.
 * Stored shape: { start: 'HH:MM', end: 'HH:MM', timeZone: IANA, utcOffsetMinutes }. `timeZone` is what the server
 * uses (DST-aware); `utcOffsetMinutes` (the zone's offset at save time) is kept for older readers.
 * `summary` (boolean, absent = true): send one summary push when quiet hours end instead of dropping what was held.
 * Quiet hours affect push and e-mail: alerts always appear in the app. start === end means "off".
 */
export const QUIET_DEFAULTS = Object.freeze({ start: '22:00', end: '07:00' });
export const COMMON_TIME_ZONES = Object.freeze([
  'UTC', 'America/New_York', 'America/Chicago', 'America/Denver', 'America/Phoenix', 'America/Los_Angeles', 'America/Anchorage', 'Pacific/Honolulu',
  'America/Toronto', 'America/Mexico_City', 'America/Sao_Paulo', 'Europe/London', 'Europe/Paris', 'Europe/Berlin', 'Europe/Madrid', 'Europe/Moscow',
  'Africa/Cairo', 'Africa/Johannesburg', 'Asia/Dubai', 'Asia/Kolkata', 'Asia/Bangkok', 'Asia/Singapore', 'Asia/Shanghai', 'Asia/Tokyo', 'Australia/Sydney', 'Pacific/Auckland',
]);
export const QUIET_NOTE_SUMMARY = 'During quiet hours push notifications are held and sent as one summary when quiet hours end. Alerts still appear in the app right away.';
export const QUIET_NOTE_DROPPED = 'During quiet hours push notifications are not sent and no summary follows. Alerts still appear in the app right away.';
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

export const isHHMM = (s) => typeof s === 'string' && HHMM.test(s);

export function isValidTimeZone(tz) {
  if (typeof tz !== 'string' || !tz) return false;
  try { new Intl.DateTimeFormat('en-US', { timeZone: tz }); return true; } catch { return false; }
}

export function browserTimeZone() {
  try { const z = Intl.DateTimeFormat().resolvedOptions().timeZone; return isValidTimeZone(z) ? z : 'UTC'; } catch { return 'UTC'; }
}

/** Zone offset from UTC in minutes at `date` (DST-aware), or 0 for an invalid zone. */
export function zoneOffsetMinutes(tz, date = new Date()) {
  if (!isValidTimeZone(tz)) return 0;
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }).formatToParts(date);
  const n = (t) => Number(parts.find((p) => p.type === t)?.value);
  const asUtc = Date.UTC(n('year'), n('month') - 1, n('day'), n('hour') % 24, n('minute'), n('second'));
  return Math.round((asUtc - Math.floor(date.getTime() / 1000) * 1000) / 60000);
}

/** Option list for the zone <select>: every supported zone when the browser can list them, else a short common list; always includes the extra zones given. */
export function timeZoneOptions(extra = [], env = Intl) {
  let base = COMMON_TIME_ZONES;
  try { const all = env.supportedValuesOf?.('timeZone'); if (Array.isArray(all) && all.length) base = all; } catch { /* short list */ }
  const set = new Set(base);
  for (const z of extra) if (isValidTimeZone(z)) set.add(z);
  return [...set];
}

/** jsonb -> form values. Missing/invalid -> disabled with defaults and the browser zone. */
export function quietToForm(quiet, zone = browserTimeZone()) {
  const q = quiet && isHHMM(quiet.start) && isHHMM(quiet.end) ? quiet : null;
  return {
    enabled: !!q,
    start: q ? q.start : QUIET_DEFAULTS.start,
    end: q ? q.end : QUIET_DEFAULTS.end,
    timeZone: q && isValidTimeZone(q.timeZone) ? q.timeZone : zone,
    summary: !q || q.summary !== false, // old rows have no key: treated as true
  };
}

/** Form values -> { value, error, same }. Unchecked -> value null. start === end is kept but flagged (it never mutes anything). */
export function quietFromForm({ enabled, start, end, timeZone, summary = true } = {}, now = new Date()) {
  if (!enabled) return { value: null, error: null, same: false };
  if (!isHHMM(start) || !isHHMM(end)) return { value: null, error: 'Enter quiet hours as times like 22:00.', same: false };
  const tz = isValidTimeZone(timeZone) ? timeZone : browserTimeZone();
  return { value: { start, end, timeZone: tz, utcOffsetMinutes: zoneOffsetMinutes(tz, now), summary: summary !== false }, error: null, same: start === end };
}

/** Normalise quiet_hours for saving: drops anything malformed; keeps timeZone / utcOffsetMinutes only when valid. */
export function cleanQuietHours(q) {
  if (!q || !isHHMM(q.start) || !isHHMM(q.end)) return null;
  const out = { start: q.start, end: q.end };
  if (isValidTimeZone(q.timeZone)) out.timeZone = q.timeZone;
  if (q.utcOffsetMinutes !== null && q.utcOffsetMinutes !== '' && Number.isFinite(Number(q.utcOffsetMinutes))) out.utcOffsetMinutes = Math.round(Number(q.utcOffsetMinutes));
  if (typeof q.summary === 'boolean') out.summary = q.summary;
  return out;
}
