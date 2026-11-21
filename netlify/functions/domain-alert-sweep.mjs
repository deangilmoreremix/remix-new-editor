/* global process, fetch, console, Response */
/**
 * Netlify scheduled function: domain-alert-sweep (every 15 minutes, service role, server only).
 *
 * The database calls admin-domain-alert right after an owner saves a custom domain, but that call is fire and
 * forget. This job re-sends any alert that is still unsent (older than two minutes, fewer than 8 attempts), so an
 * outage at that moment or a missing ADMIN_ALERT_EMAIL later fixed still ends in an e-mail.
 * Safe to overlap and to re-run: e-mails carry a stable idempotency key. Before the migration is applied it reports
 * `table_unavailable` and does nothing. See docs/custom-domain-admin-alerts.md.
 */
import { sendDomainAlerts } from './_shared/domainAlert.js';

export const config = { schedule: '*/15 * * * *' };

/** Exported for tests. Never throws; returns a JSON summary of counts. */
export async function run({ env = process.env, fetchImpl = fetch, adapter, now = new Date() } = {}) {
  try { return { ok: true, ...(await sendDomainAlerts({ sweep: true, env, fetchImpl, adapter, now })) }; } catch { return { ok: false, error: 'sweep_failed' }; }
}

export default async () => {
  const result = await run();
  console.log('[domain-alert-sweep]', JSON.stringify(result));
  return new Response(JSON.stringify(result), { status: result.ok ? 200 : 500, headers: { 'Content-Type': 'application/json' } });
};
