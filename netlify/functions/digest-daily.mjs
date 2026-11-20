/**
 * Netlify scheduled function: daily owner-notification jobs (no extra worker).
 * Runs with the service role (server only) once a day:
 *   - build daily (and, on Mondays, weekly) digest notifications
 *   - detect rising interests / follow-up opportunities
 *   - prune raw analytics older than 90 days
 *   - queue + send owner e-mails ONLY if an e-mail adapter is configured
 *     (RESEND_API_KEY + ALERT_EMAIL_FROM; without them this step reports `not_configured` and stays in-app).
 *     Alerts are e-mailed right away by push-dispatch. This sweep sends the digests, retries what is left, and RECOVERS alerts from the
 *     last 24 hours that never reached the queue (push-dispatch is a one-shot call from the database trigger; if it failed before
 *     enqueuing, nothing else would ever e-mail that alert). Already-queued notifications are skipped, so nothing is sent twice.
 * Idempotent: notifications are de-duplicated by key, so a re-run is harmless.
 */
import { getEmailAdapter, enqueueNotificationEmails, drainEmailQueue, alertsUrl } from './_shared/emailAdapter.js';
import { emailDb } from './_shared/ownerEmail.js';
import { rest, supabaseConfig } from './_shared/supabaseRest.js';

export const config = { schedule: '17 6 * * *' };

// Alerts younger than RECOVERY_MIN_AGE_MINUTES are left to the immediate path, so each daily window must reach back one day PLUS that gap: an alert
// created 5 minutes before today's sweep is skipped today and must still be inside tomorrow's window (24 h 5 min back).
export const RECOVERY_MIN_AGE_MINUTES = 15;
export const RECOVERY_LOOKBACK_HOURS = 24 + 1;

export { emailDb };

/** Exported for tests: runs every job and reports what happened. */
export async function run({ env = process.env, fetchImpl = fetch, now = new Date(), adapter = getEmailAdapter(env, { fetchImpl }) } = {}) {
  const cfg = supabaseConfig(env);
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
  await step('email_enqueue', () => enqueueNotificationEmails({ adapter, db, now, sinceHours: RECOVERY_LOOKBACK_HOURS, minAgeMinutes: RECOVERY_MIN_AGE_MINUTES })); // digests, plus alerts the immediate path missed
  await step('email_drain', async () => { const res = await drainEmailQueue({ adapter, db, now, url: alertsUrl(env) }); delete res.outcomes; return res; });
  return result;
}

export default async () => {
  const result = await run();
  console.log('[digest-daily]', JSON.stringify(result));
  return new Response(JSON.stringify(result), { status: result.ok ? 200 : 500, headers: { 'Content-Type': 'application/json' } });
};
