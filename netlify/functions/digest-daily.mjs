/**
 * Netlify scheduled function: daily owner-notification jobs (no extra worker).
 * Runs with the service role (server only) once a day:
 *   - build daily (and, on Mondays, weekly) digest notifications
 *   - detect rising interests / follow-up opportunities
 *   - prune raw analytics older than 90 days
 *   - queue + send owner e-mails ONLY if an e-mail adapter is configured
 *     (none is by default, so this step reports `not_configured` and stays in-app)
 * Idempotent: notifications are de-duplicated by key, so a re-run is harmless.
 */
import { getEmailAdapter, enqueueNotificationEmails, drainEmailQueue } from './_shared/emailAdapter.js';

export const config = { schedule: '17 6 * * *' };

const rest = (cfg, fetchImpl) => async (path, { method = 'GET', body, prefer } = {}) => {
  const res = await fetchImpl(`${cfg.url}/rest/v1/${path}`, {
    method,
    headers: { apikey: cfg.key, Authorization: `Bearer ${cfg.key}`, 'Content-Type': 'application/json', ...(prefer ? { Prefer: prefer } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${method} ${path.split('?')[0]} failed (HTTP ${res.status})`);
  const text = await res.text();
  return text ? JSON.parse(text) : null;
};

export function emailDb(call) {
  const inList = (ids) => `in.(${ids.map((i) => `"${String(i).replace(/"/g, '')}"`).join(',')})`;
  return {
    recentNotifications: (since) => call(`owner_notifications?select=id,clerk_user_id,type,title,summary,suggestion&created_at=gte.${encodeURIComponent(since)}&limit=500`),
    preferences: async (ids) => {
      if (!ids.length) return {};
      const rows = await call(`retarget_preferences?select=clerk_user_id,email,digest_frequency,quiet_hours&clerk_user_id=${inList(ids)}`);
      return Object.fromEntries((rows || []).map((r) => [r.clerk_user_id, r]));
    },
    queuedIds: async (ids) => (ids.length ? (await call(`notification_email_queue?select=notification_id&notification_id=${inList(ids)}`)).map((r) => r.notification_id) : []),
    enqueue: (rows) => call('notification_email_queue?on_conflict=notification_id', { method: 'POST', body: rows, prefer: 'resolution=ignore-duplicates' }),
    due: (nowIso, limit) => call(`notification_email_queue?select=*&status=eq.pending&next_attempt_at=lte.${encodeURIComponent(nowIso)}&order=next_attempt_at.asc&limit=${limit}`),
    mark: (id, patch) => call(`notification_email_queue?id=eq.${id}`, { method: 'PATCH', body: patch }),
    notification: async (id) => (await call(`owner_notifications?select=id,title,summary,suggestion&id=eq.${id}&limit=1`))?.[0] || null,
  };
}

/** Exported for tests: runs every job and reports what happened. */
export async function run({ env = process.env, fetchImpl = fetch, now = new Date(), adapter = getEmailAdapter(env) } = {}) {
  const cfg = { url: String(env.SUPABASE_URL || env.VITE_SUPABASE_URL || '').replace(/\/$/, ''), key: env.SUPABASE_SERVICE_ROLE_KEY || '' };
  if (!cfg.url || !cfg.key) return { ok: false, error: 'not_configured' };
  const call = rest(cfg, fetchImpl);
  const rpc = (name, args = {}) => call(`rpc/${name}`, { method: 'POST', body: args });
  const result = { ok: true, jobs: {} };
  const step = async (name, fn) => { try { result.jobs[name] = await fn(); } catch (err) { result.jobs[name] = { error: String(err.message || err) }; result.ok = false; } };

  await step('daily_digests', () => rpc('build_daily_digests', { p_weekly: false }));
  if (now.getUTCDay() === 1) await step('weekly_digests', () => rpc('build_daily_digests', { p_weekly: true }));
  await step('interest_surges', () => rpc('detect_interest_surges'));
  await step('prune', () => rpc('prune_video_analytics', { p_raw_days: 90 }));
  const db = emailDb(call);
  await step('email_enqueue', () => enqueueNotificationEmails({ adapter, db, now }));
  await step('email_drain', () => drainEmailQueue({ adapter, db, now }));
  return result;
}

export default async () => {
  const result = await run();
  console.log('[digest-daily]', JSON.stringify(result));
  return new Response(JSON.stringify(result), { status: result.ok ? 200 : 500, headers: { 'Content-Type': 'application/json' } });
};
