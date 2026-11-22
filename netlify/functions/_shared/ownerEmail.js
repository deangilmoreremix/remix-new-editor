/**
 * Owner e-mail alerts: the PostgREST db for the e-mail queue (shared by the scheduled jobs) and the immediate
 * path used by push-dispatch. Both go through the same queue + drainEmailQueue, so retries, backoff, attempts,
 * quiet-hours delay and dedupe (unique notification_id) behave the same everywhere. Never logs addresses.
 */
import { drainEmailQueue } from './emailAdapter.js';
import { inList } from './supabaseRest.js';

export function emailDb(call) {
  return {
    recentNotifications: (since) => call(`owner_notifications?select=id,clerk_user_id,type,title,summary,suggestion,created_at&created_at=gte.${encodeURIComponent(since)}&limit=500`),
    preferences: async (ids) => {
      if (!ids.length) return {};
      const rows = await call(`retarget_preferences?select=clerk_user_id,email,enabled_types,digest_frequency,quiet_hours&clerk_user_id=${inList(ids)}`);
      return Object.fromEntries((rows || []).map((r) => [r.clerk_user_id, r]));
    },
    queuedIds: async (ids) => (ids.length ? (await call(`notification_email_queue?select=notification_id&notification_id=${inList(ids)}`)).map((r) => r.notification_id) : []),
    enqueue: (rows) => call('notification_email_queue?on_conflict=notification_id', { method: 'POST', body: rows, prefer: 'resolution=ignore-duplicates' }),
    due: (nowIso, limit) => call(`notification_email_queue?select=*&status=eq.pending&next_attempt_at=lte.${encodeURIComponent(nowIso)}&order=next_attempt_at.asc&limit=${limit}`),
    mark: (id, patch) => call(`notification_email_queue?id=eq.${id}`, { method: 'PATCH', body: patch }),
    // Atomic lease: only one concurrent drain can move a due pending row's next_attempt_at into the future.
    claim: async (id, nowIso, leaseIso) => {
      const rows = await call(`notification_email_queue?id=eq.${id}&status=eq.pending&next_attempt_at=lte.${encodeURIComponent(nowIso)}`, { method: 'PATCH', body: { next_attempt_at: leaseIso }, prefer: 'return=representation' });
      return Array.isArray(rows) && rows.length > 0;
    },
    notification: async (id) => (await call(`owner_notifications?select=id,type,title,summary,suggestion&id=eq.${id}&limit=1`))?.[0] || null,
  };
}

const OUTCOME_STATUS = Object.freeze({
  sent: 'sent', delayed: 'queued_quiet_hours', retry: 'queued_retry', failed: 'failed', skipped: 'skipped_no_recipient', contended: 'queued',
});

/**
 * Enqueue and immediately attempt one notification's e-mail. Returns a status string, never an address:
 * not_configured | skipped_email_off | skipped_digest | skipped_type_disabled | skipped_duplicate |
 * sent | queued_quiet_hours | queued_retry | queued | failed | skipped_no_recipient.
 * A second call for the same notification inserts nothing (unique notification_id) and so never sends again.
 */
export async function sendAlertEmailNow({ adapter, call, note, prefs, now = new Date(), url }) {
  if (!adapter?.configured) return 'not_configured';
  if (prefs?.email !== true) return 'skipped_email_off';
  if (note.type === 'daily_digest') return 'skipped_digest';
  if (!Array.isArray(prefs.enabled_types) || !prefs.enabled_types.includes(note.type)) return 'skipped_type_disabled';
  const inserted = await call('notification_email_queue?on_conflict=notification_id', {
    method: 'POST',
    body: [{ notification_id: note.id, clerk_user_id: note.clerk_user_id, next_attempt_at: now.toISOString() }],
    prefer: 'resolution=ignore-duplicates,return=representation',
  });
  if (!Array.isArray(inserted) || !inserted.length) return 'skipped_duplicate';
  const db = { ...emailDb(call), notification: async () => note, preferences: async () => ({ [note.clerk_user_id]: prefs }) };
  const res = await drainEmailQueue({ adapter, db, now, rows: inserted, url });
  return OUTCOME_STATUS[res.outcomes?.[inserted[0].id]] || 'queued';
}
