/**
 * Owner e-mail delivery behind an adapter. The only provider is Resend (resendAdapter.js), used when
 * RESEND_API_KEY and ALERT_EMAIL_FROM are both set; otherwise the NOOP adapter reports `configured: false`:
 * notifications stay in-app and nothing is queued.
 *
 * Adapter contract:
 *   { name, configured: boolean,
 *     resolveRecipient(ownerId): Promise<string|null|{ transient: true }>,   // null = no usable address (skip); { transient: true } = could not be looked up now (retry)
 *     send({ to, subject, text, html?, idempotencyKey? }): Promise<{ ok: boolean, error?: string, retryable?: boolean }> }
 *
 * The queue, retry, quiet-hours and dedupe logic below is provider-independent and unit-tested against a fake adapter.
 */
import { buildAlertEmail, alertsUrl } from './alertEmail.js';
import { createResendAdapter } from './resendAdapter.js';

export { alertsUrl };
export const NOOP_ADAPTER = Object.freeze({
  name: 'none',
  configured: false,
  resolveRecipient: async () => null,
  send: async () => ({ ok: false, error: 'not_configured', retryable: false }),
});

export function getEmailAdapter(env = process.env, { fetchImpl = globalThis.fetch } = {}) {
  const apiKey = String(env?.RESEND_API_KEY || '').trim();
  const from = String(env?.ALERT_EMAIL_FROM || '').trim();
  if (!apiKey || !from) return NOOP_ADAPTER;
  return createResendAdapter({ apiKey, from, clerkSecret: env.CLERK_SECRET_KEY, fetchImpl });
}

export const MAX_ATTEMPTS = 5;
export const backoffMs = (attempt) => Math.min(6 * 3600_000, 60_000 * 4 ** Math.max(0, attempt - 1)); // 1m, 4m, 16m, ~1h, 4h...

/** Minutes since local midnight in an IANA zone (DST-aware), or null when the zone is missing/invalid. Never throws. */
function zoneMinutes(timeZone, now) {
  if (typeof timeZone !== 'string' || !timeZone) return null;
  try {
    const parts = new Intl.DateTimeFormat('en-US', { timeZone, hourCycle: 'h23', hour: '2-digit', minute: '2-digit' }).formatToParts(now);
    const h = Number(parts.find((p) => p.type === 'hour')?.value);
    const m = Number(parts.find((p) => p.type === 'minute')?.value);
    return Number.isFinite(h) && Number.isFinite(m) ? (h % 24) * 60 + m : null;
  } catch { return null; }
}

/**
 * Quiet hours { start: 'HH:MM', end: 'HH:MM', timeZone?: IANA, utcOffsetMinutes?: number } (overnight ranges allowed).
 * Local time comes from `timeZone` when it is valid (so DST is right), else from the fixed `utcOffsetMinutes`, else UTC.
 */
export function inQuietHours(quiet, now = new Date()) {
  if (!quiet || !/^\d\d:\d\d$/.test(quiet.start || '') || !/^\d\d:\d\d$/.test(quiet.end || '')) return false;
  let cur = zoneMinutes(quiet.timeZone, now);
  if (cur === null) {
    const offset = Number(quiet.utcOffsetMinutes) || 0;
    const local = new Date(now.getTime() + offset * 60_000);
    cur = local.getUTCHours() * 60 + local.getUTCMinutes();
  }
  const toMin = (s) => Number(s.slice(0, 2)) * 60 + Number(s.slice(3));
  const a = toMin(quiet.start);
  const b = toMin(quiet.end);
  if (a === b) return false;
  return a < b ? cur >= a && cur < b : cur >= a || cur < b;
}

/**
 * Queue e-mails for recent in-app notifications whose owners opted in.
 * db: { recentNotifications(sinceIso), preferences(ownerIds), queuedIds(ids), enqueue(rows) }
 */
export async function enqueueNotificationEmails({ adapter, db, now = new Date(), sinceHours = 24, types }) {
  if (!adapter?.configured) return { queued: 0, reason: 'not_configured' };
  const since = new Date(now.getTime() - sinceHours * 3600_000).toISOString();
  const notes = (await db.recentNotifications(since)).filter((n) => !types || types.includes(n.type)); // `types`: only these (the daily job passes the digests; alerts are e-mailed right away)
  if (!notes.length) return { queued: 0 };
  const prefs = await db.preferences([...new Set(notes.map((n) => n.clerk_user_id))]);
  const already = new Set(await db.queuedIds(notes.map((n) => n.id)));
  const rows = notes
    .filter((n) => !already.has(n.id) && prefs[n.clerk_user_id]?.email === true)
    .filter((n) => n.type !== 'daily_digest' || prefs[n.clerk_user_id]?.digest_frequency !== 'off')
    .filter((n) => { const t = prefs[n.clerk_user_id]?.enabled_types; return !Array.isArray(t) || t.includes(n.type); }) // a type the owner switched off is never e-mailed
    .map((n) => ({ notification_id: n.id, clerk_user_id: n.clerk_user_id }));
  if (rows.length) await db.enqueue(rows);
  return { queued: rows.length };
}

/**
 * Send due queue rows with retries. db: { due(nowIso, limit), mark(id, patch), notification(id), preferences(ids), claim?(id, nowIso, leaseIso) }
 * Quiet hours delay delivery; failures back off and stop after MAX_ATTEMPTS.
 * `rows` (optional) drains exactly those queue rows instead of asking the db for due ones.
 * `claim` (optional) is an atomic lease: it returns false when another run already took the row, which makes
 * concurrent drains (immediate path + scheduled jobs) safe. A claimed row that is never marked is due again after LEASE_MS.
 * `outcomes` maps queue row id -> sent | delayed | skipped | retry | failed | contended.
 */
export const LEASE_MS = 10 * 60_000;
export async function drainEmailQueue({ adapter, db, now = new Date(), limit = 50, rows, url }) {
  if (!adapter?.configured) return { sent: 0, failed: 0, delayed: 0, reason: 'not_configured' };
  const due = rows || await db.due(now.toISOString(), limit);
  const prefs = await db.preferences([...new Set(due.map((r) => r.clerk_user_id))]);
  const out = { sent: 0, failed: 0, delayed: 0, skipped: 0, contended: 0, outcomes: {} };
  for (const row of due) {
    if (inQuietHours(prefs[row.clerk_user_id]?.quiet_hours, now)) {
      await db.mark(row.id, { next_attempt_at: new Date(now.getTime() + 30 * 60_000).toISOString() });
      out.delayed += 1; out.outcomes[row.id] = 'delayed'; continue;
    }
    if (db.claim && !(await db.claim(row.id, now.toISOString(), new Date(now.getTime() + LEASE_MS).toISOString()))) { out.contended += 1; out.outcomes[row.id] = 'contended'; continue; }
    const note = await db.notification(row.notification_id);
    // The owner may have switched e-mail (or this alert type) off while the row waited, e.g. through quiet hours: use the CURRENT preferences.
    const p = prefs[row.clerk_user_id];
    if (note && p && (p.email !== true || (Array.isArray(p.enabled_types) && !p.enabled_types.includes(note.type)) || (note.type === 'daily_digest' && p.digest_frequency === 'off'))) {
      await db.mark(row.id, { status: 'skipped', last_error: 'pref_off' }); out.skipped += 1; out.outcomes[row.id] = 'skipped'; continue;
    }
    const to = note ? await adapter.resolveRecipient(row.clerk_user_id).catch(() => null) : null;
    if (note && to?.transient === true) { // Clerk could not be asked right now: retry like a failed send instead of skipping for good
      const tries = row.attempts + 1;
      const last = tries >= MAX_ATTEMPTS;
      await db.mark(row.id, { attempts: tries, last_error: 'recipient_lookup_failed', ...(last ? { status: 'failed' } : { next_attempt_at: new Date(now.getTime() + backoffMs(tries)).toISOString() }) });
      out.failed += 1; out.outcomes[row.id] = last ? 'failed' : 'retry'; continue;
    }
    if (!note || !to) { await db.mark(row.id, { status: 'skipped', last_error: !note ? 'notification_missing' : 'no_recipient' }); out.skipped += 1; out.outcomes[row.id] = 'skipped'; continue; }
    const attempts = row.attempts + 1;
    let res;
    try {
      res = await adapter.send({ to, ...buildAlertEmail(note, url ? { url } : undefined), idempotencyKey: row.notification_id });
    } catch (err) {
      res = { ok: false, error: String(err?.message || err).slice(0, 200), retryable: true };
    }
    if (res.ok) { await db.mark(row.id, { status: 'sent', attempts, sent_at: now.toISOString(), last_error: null }); out.sent += 1; out.outcomes[row.id] = 'sent'; continue; }
    const final = res.retryable === false || attempts >= MAX_ATTEMPTS;
    await db.mark(row.id, {
      attempts, last_error: String(res.error || 'send_failed').slice(0, 200),
      ...(final ? { status: 'failed' } : { next_attempt_at: new Date(now.getTime() + backoffMs(attempts)).toISOString() }),
    });
    out.failed += 1; out.outcomes[row.id] = final ? 'failed' : 'retry';
  }
  return out;
}
