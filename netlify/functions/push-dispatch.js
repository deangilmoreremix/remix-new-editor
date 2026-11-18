/**
 * Netlify function: push-dispatch (called by the database, not by browsers)
 *
 *   POST /.netlify/functions/push-dispatch   header x-push-secret: <PUSH_DISPATCH_SECRET>
 *   { notification_id }  ->  200 { sent, failed?, removed?, reason?, email? } · 401 · 405 · 400
 *
 * A trigger on public.owner_notifications calls this through pg_net. It sends a Web Push
 * (VAPID) to the owner's subscribed devices when they opted in and, independently, an e-mail when
 * Email alerts is on and a provider is configured (`email` is a status string, never an address).
 * See docs/push-notifications.md.
 */
import { dispatchPush, safeEqual } from './_shared/pushAdapter.js';

const json = (statusCode, body) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  body: JSON.stringify(body),
});

export async function handle(event, { env = process.env, fetchImpl = fetch, webpush, now, emailAdapter } = {}) {
  if (event.httpMethod !== 'POST') return json(405, { ok: false, error: 'method_not_allowed' });
  const h = event.headers || {};
  const given = h['x-push-secret'] ?? h['X-Push-Secret'];
  if (!env.PUSH_DISPATCH_SECRET || !safeEqual(String(given || ''), env.PUSH_DISPATCH_SECRET)) return json(401, { ok: false, error: 'unauthorized' });
  let body;
  try {
    const raw = event.isBase64Encoded ? Buffer.from(event.body || '', 'base64').toString('utf8') : (event.body || '');
    if (raw.length > 2048) return json(400, { ok: false, error: 'bad_request' });
    body = JSON.parse(raw || '{}');
  } catch { return json(400, { ok: false, error: 'bad_request' }); }
  try {
    const result = await dispatchPush({ notificationId: body?.notification_id, env, fetchImpl, webpush, now, emailAdapter });
    return json(200, result);
  } catch (err) {
    console.error('[push-dispatch] failed:', String(err?.message || err).slice(0, 200));
    return json(500, { ok: false, error: 'dispatch_failed' });
  }
}

export const handler = (event) => handle(event);
