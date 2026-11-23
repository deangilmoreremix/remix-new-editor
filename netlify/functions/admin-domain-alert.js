/**
 * Netlify function: admin-domain-alert (called by the database, not by browsers)
 *
 *   POST /.netlify/functions/admin-domain-alert   header x-push-secret: <PUSH_DISPATCH_SECRET>
 *   { alert_id }  ->  200 { sent, skipped, failed, reason? } · 400 · 401 · 405
 *
 * A trigger on public.video_owner_profiles records a custom_domain_alerts row when an owner saves a domain and calls
 * this through pg_net. It e-mails the addresses in ADMIN_ALERT_EMAIL (see _shared/domainAlert.js). The body carries
 * only an id; the domain and owner are read from the database. Responses are counts, never addresses.
 * See docs/custom-domain-admin-alerts.md.
 */
import { safeEqual } from './_shared/pushAdapter.js';
import { sendDomainAlerts } from './_shared/domainAlert.js';

const json = (statusCode, body) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  body: JSON.stringify(body),
});

export async function handle(event, { env = process.env, fetchImpl = fetch, adapter, now } = {}) {
  if (event.httpMethod !== 'POST') return json(405, { ok: false, error: 'method_not_allowed' });
  const h = event.headers || {};
  const given = h['x-push-secret'] ?? h['X-Push-Secret'];
  if (!env.PUSH_DISPATCH_SECRET || !safeEqual(String(given || ''), env.PUSH_DISPATCH_SECRET)) return json(401, { ok: false, error: 'unauthorized' });
  let id;
  try {
    const raw = event.isBase64Encoded ? Buffer.from(event.body || '', 'base64').toString('utf8') : (event.body || '');
    if (raw.length > 2048) return json(400, { ok: false, error: 'bad_request' });
    id = JSON.parse(raw || '{}')?.alert_id;
  } catch { return json(400, { ok: false, error: 'bad_request' }); }
  if (!Number.isSafeInteger(id) || id <= 0) return json(400, { ok: false, error: 'bad_request' });
  try {
    return json(200, { ok: true, ...(await sendDomainAlerts({ ids: [id], env, fetchImpl, adapter, now })) });
  } catch (err) {
    console.error('[admin-domain-alert] failed:', String(err?.message || err).slice(0, 200));
    return json(500, { ok: false, error: 'alert_failed' });
  }
}

export const handler = (event) => handle(event);
