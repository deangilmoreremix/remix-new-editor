/**
 * Owner e-mail delivery behind an adapter. NO provider is wired in this
 * project (and none may be added without authorisation), so the default adapter
 * reports `configured: false`: notifications stay in-app and nothing is queued.
 *
 * Adapter contract:
 *   { name, configured: boolean,
 *     resolveRecipient(ownerId): Promise<string|null>,
 *     send({ to, subject, text }): Promise<{ ok: boolean, error?: string, retryable?: boolean }> }
 *
 * To add a provider later, implement this interface and return it from
 * getEmailAdapter(); the queue, retry, quiet-hours and dedupe logic below is
 * provider-independent and unit-tested against a fake adapter.
 */
export const NOOP_ADAPTER = Object.freeze({
  name: 'none',
  configured: false,
  resolveRecipient: async () => null,
  send: async () => ({ ok: false, error: 'not_configured', retryable: false }),
});

export function getEmailAdapter(/* env */) {
  return NOOP_ADAPTER;
}

export const MAX_ATTEMPTS = 5;
export const backoffMs = (attempt) => Math.min(6 * 3600_000, 60_000 * 4 ** Math.max(0, attempt - 1)); // 1m, 4m, 16m, ~1h, 4h...

/** Quiet hours { start: 'HH:MM', end: 'HH:MM', utcOffsetMinutes?: number } (overnight ranges allowed). */
export function inQuietHours(quiet, now = new Date()) {
  if (!quiet || !/^\d\d:\d\d$/.test(quiet.start || '') || !/^\d\d:\d\d$/.test(quiet.end || '')) return false;
  const offset = Number(quiet.utcOffsetMinutes) || 0;
  const local = new Date(now.getTime() + offset * 60_000);
  const cur = local.getUTCHours() * 60 + local.getUTCMinutes();
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
export async function enqueueNotificationEmails({ adapter, db, now = new Date(), sinceHours = 24 }) {
  if (!adapter?.configured) return { queued: 0, reason: 'not_configured' };
  const since = new Date(now.getTime() - sinceHours * 3600_000).toISOString();
  const notes = await db.recentNotifications(since);
  if (!notes.length) return { queued: 0 };
  const prefs = await db.preferences([...new Set(notes.map((n) => n.clerk_user_id))]);
  const already = new Set(await db.queuedIds(notes.map((n) => n.id)));
  const rows = notes
    .filter((n) => !already.has(n.id) && prefs[n.clerk_user_id]?.email === true)
    .filter((n) => n.type !== 'daily_digest' || prefs[n.clerk_user_id]?.digest_frequency !== 'off')
    .map((n) => ({ notification_id: n.id, clerk_user_id: n.clerk_user_id }));
  if (rows.length) await db.enqueue(rows);
  return { queued: rows.length };
}

/**
 * Send due queue rows with retries. db: { due(nowIso, limit), mark(id, patch), notification(id), preferences(ids) }
 * Quiet hours delay delivery; failures back off and stop after MAX_ATTEMPTS.
 */
export async function drainEmailQueue({ adapter, db, now = new Date(), limit = 50 }) {
  if (!adapter?.configured) return { sent: 0, failed: 0, delayed: 0, reason: 'not_configured' };
  const due = await db.due(now.toISOString(), limit);
  const prefs = await db.preferences([...new Set(due.map((r) => r.clerk_user_id))]);
  const out = { sent: 0, failed: 0, delayed: 0, skipped: 0 };
  for (const row of due) {
    if (inQuietHours(prefs[row.clerk_user_id]?.quiet_hours, now)) {
      await db.mark(row.id, { next_attempt_at: new Date(now.getTime() + 30 * 60_000).toISOString() });
      out.delayed += 1; continue;
    }
    const note = await db.notification(row.notification_id);
    const to = note ? await adapter.resolveRecipient(row.clerk_user_id).catch(() => null) : null;
    if (!note || !to) { await db.mark(row.id, { status: 'skipped', last_error: !note ? 'notification_missing' : 'no_recipient' }); out.skipped += 1; continue; }
    const attempts = row.attempts + 1;
    let res;
    try {
      res = await adapter.send({ to, subject: note.title, text: `${note.summary}${note.suggestion ? `\n\n${note.suggestion}` : ''}` });
    } catch (err) {
      res = { ok: false, error: String(err?.message || err).slice(0, 200), retryable: true };
    }
    if (res.ok) { await db.mark(row.id, { status: 'sent', attempts, sent_at: now.toISOString(), last_error: null }); out.sent += 1; continue; }
    const final = res.retryable === false || attempts >= MAX_ATTEMPTS;
    await db.mark(row.id, {
      attempts, last_error: String(res.error || 'send_failed').slice(0, 200),
      ...(final ? { status: 'failed' } : { next_attempt_at: new Date(now.getTime() + backoffMs(attempts)).toISOString() }),
    });
    out.failed += 1;
  }
  return out;
}
