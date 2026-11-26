/**
 * Netlify scheduled function: scheduled-publish (every minute, service role, server only).
 * Publishes due auto_publish rows of public.scheduled_posts to MuAPI with the owner's stored (encrypted) key,
 * resumes interrupted jobs, retries transient failures with backoff and records every result.
 * See netlify/functions/_shared/scheduledPublish.js for the duplicate-protection rules.
 */
import { rest, supabaseConfig } from './_shared/supabaseRest.js';
import { runTick } from './_shared/scheduledPublish.js';

export const config = { schedule: '* * * * *' };

export default async () => {
  const cfg = supabaseConfig();
  if (!cfg.url || !cfg.key) return new Response(JSON.stringify({ ok: false, error: 'not_configured' }), { status: 200 });
  const result = await runTick({ call: rest(cfg, fetch) });
  console.log('[scheduled-publish]', JSON.stringify(result));
  return new Response(JSON.stringify({ ok: !result.error, ...result }), { status: 200, headers: { 'Content-Type': 'application/json' } });
};
