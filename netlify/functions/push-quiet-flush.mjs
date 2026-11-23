/**
 * Netlify scheduled function: push-quiet-flush (every 15 minutes, service role, server only).
 *
 * Pushes that arrive during an owner's quiet hours are recorded in public.owner_push_deferred by push-dispatch.
 * Once quiet hours end this job sends ONE summary push ("While you were away: 3 new leads, 2 retarget alerts...")
 * to the owner's devices and removes the rows it included. It also drains the owner e-mail queue, so e-mails that
 * were delayed by quiet hours go out soon after they end (a no-op unless an e-mail provider is configured).
 * Safe to overlap and to re-run; before the migration is applied it reports `table_unavailable` and does nothing.
 * See docs/push-notifications.md.
 */
import { flushQuietSummaries } from './_shared/pushSummary.js';
import { getEmailAdapter, drainEmailQueue, alertsUrl } from './_shared/emailAdapter.js';
import { emailDb } from './_shared/ownerEmail.js';
import { rest, supabaseConfig } from './_shared/supabaseRest.js';

export const config = { schedule: '*/15 * * * *' };

async function drainEmail({ env, fetchImpl, now, adapter }) {
  const cfg = supabaseConfig(env);
  if (!adapter.configured || !cfg.url || !cfg.key) return { reason: 'not_configured' };
  const res = await drainEmailQueue({ adapter, db: emailDb(rest(cfg, fetchImpl)), now, url: alertsUrl(env) });
  delete res.outcomes; // per-row ids stay out of the job summary
  return res;
}

/** Exported for tests. Never throws; returns a JSON summary of counts. */
export async function run({ env = process.env, fetchImpl = fetch, webpush, now = new Date(), adapter = getEmailAdapter(env, { fetchImpl }) } = {}) {
  let result;
  try { result = await flushQuietSummaries({ env, fetchImpl, webpush, now }); } catch { result = { ok: false, error: 'flush_failed' }; }
  try { result.email = await drainEmail({ env, fetchImpl, now, adapter }); } catch { result.email = { error: 'drain_failed' }; }
  return result;
}

export default async () => {
  const result = await run();
  console.log('[push-quiet-flush]', JSON.stringify(result));
  return new Response(JSON.stringify(result), { status: result.ok ? 200 : 500, headers: { 'Content-Type': 'application/json' } });
};
