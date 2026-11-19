/**
 * Web Push dispatch core (testable: `webpush`, `fetchImpl` and `env` are injected).
 *
 * Flow: owner_notifications INSERT -> DB trigger (pg_net) -> push-dispatch function
 * -> this module -> push service of each of the owner's subscribed devices, and (independently)
 * the owner's e-mail through the queue in ownerEmail.js.
 * Never logs endpoints, keys, addresses or payload bodies.
 */
import { timingSafeEqual, createHash } from 'node:crypto';
import { inQuietHours, getEmailAdapter, alertsUrl } from './emailAdapter.js';
import { sendAlertEmailNow } from './ownerEmail.js';
import { rest, supabaseConfig } from './supabaseRest.js';
import { CATEGORY_BY_TYPE } from './alertTypes.js';

export { CATEGORY_BY_TYPE };
export const MAX_FAILURES = 5;
export const NO_PUSH_TYPES = Object.freeze(['daily_digest']);
export const DEEP_LINK = '/#/timeline';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_PAYLOAD_BYTES = 3000;

/** Constant-time string compare (hashes first so lengths never leak). */
export function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || !a || !b) return false;
  const ha = createHash('sha256').update(a).digest();
  const hb = createHash('sha256').update(b).digest();
  return timingSafeEqual(ha, hb);
}

const clip = (s, n) => {
  const t = String(s ?? '').replace(/\s+/g, ' ').trim();
  return t.length > n ? `${t.slice(0, n - 1)}…` : t;
};

/** Payload for the service worker. Only the notification title/summary leave the server. */
export function buildPayload(note) {
  const category = CATEGORY_BY_TYPE[note.type] || 'Alert';
  const payload = {
    title: clip(`${category}: ${note.title}`, 120),
    body: clip(note.summary, 200),
    tag: clip(note.dedupe_key || note.type, 100),
    type: note.type,
    notificationId: note.id,
    videoId: note.video_id || null,
    url: DEEP_LINK,
  };
  // Hard cap well under the 4KB Web Push limit.
  while (Buffer.byteLength(JSON.stringify(payload)) > MAX_PAYLOAD_BYTES && payload.body.length > 20) payload.body = clip(payload.body, payload.body.length - 40);
  return payload;
}

async function loadWebPush(injected) {
  if (injected) return injected;
  const mod = await import('web-push');
  return mod.default || mod;
}

export const vapidFrom = (env) => (env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY && env.VAPID_SUBJECT
  ? { pub: env.VAPID_PUBLIC_KEY, priv: env.VAPID_PRIVATE_KEY, subject: env.VAPID_SUBJECT } : null);

/** A web-push client with the VAPID details set. */
export async function prepareWebPush(vapid, injected) {
  const wp = await loadWebPush(injected);
  wp.setVapidDetails(vapid.subject, vapid.pub, vapid.priv);
  return wp;
}

/** Why this owner's push preferences block `type`, or null. push_types NULL/absent = push every enabled type (legacy). */
export function pushTypeBlock(prefs, type) {
  if (!Array.isArray(prefs.enabled_types) || !prefs.enabled_types.includes(type)) return 'type_disabled';
  if (Array.isArray(prefs.push_types) && !prefs.push_types.includes(type)) return 'type_push_disabled';
  return null;
}

export const loadSubscriptions = (call, ownerId) => call(`owner_push_subscriptions?select=id,endpoint,p256dh,auth,failure_count&clerk_user_id=eq.${encodeURIComponent(ownerId)}&limit=50`);

/**
 * Whether a stored push endpoint may be connected to. The owner supplies it, and this function makes the request from the
 * server, so it must be a public https address: no credentials, the standard port, a real domain name, and never an IP
 * address, localhost or an internal-looking name (those could reach the server's own network).
 */
export function isSafePushEndpoint(raw) {
  let u;
  try { u = new URL(String(raw ?? '')); } catch { return false; }
  if (u.protocol !== 'https:' || u.username || u.password) return false;
  if (u.port && u.port !== '443') return false;
  const host = u.hostname.toLowerCase();
  if (!host.includes('.') || host.endsWith('.')) return false;                 // single-label names and trailing-dot forms
  if (host.startsWith('[') || host.includes(':')) return false;                // IPv6 literals
  if (/^\d+(\.\d+){0,3}$/.test(host)) return false;                            // IPv4 literals (the URL parser normalises 0x7f.1, 2130706433, ...)
  if (host === 'localhost' || /\.(localhost|local|internal|lan|home|corp|intranet)$/.test(host)) return false;
  return true;
}

/** Send one JSON payload to every subscription; prunes gone (404/410) endpoints and counts other failures. Returns { sent, failed, removed }. */
export async function sendToSubscriptions({ call, wp, subs, payload, now = new Date() }) {
  const body = JSON.stringify(payload);
  const out = { sent: 0, failed: 0, removed: 0 };
  await Promise.all(subs.map(async (s) => {
    if (!isSafePushEndpoint(s.endpoint)) {          // never connect to it; a subscription like this is removed
      out.removed += 1;
      await call(`owner_push_subscriptions?id=eq.${s.id}`, { method: 'DELETE' }).catch(() => {});
      return;
    }
    try {
      await wp.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, body, { TTL: 3600, urgency: 'normal' });
      out.sent += 1;
      await call(`owner_push_subscriptions?id=eq.${s.id}`, { method: 'PATCH', body: { last_success_at: now.toISOString(), failure_count: 0 } }).catch(() => {});
    } catch (err) {
      const status = Number(err?.statusCode);
      if (status === 404 || status === 410) {
        out.removed += 1;
        await call(`owner_push_subscriptions?id=eq.${s.id}`, { method: 'DELETE' }).catch(() => {});
        return;
      }
      out.failed += 1;
      const failures = (Number(s.failure_count) || 0) + 1;
      await call(`owner_push_subscriptions?id=eq.${s.id}`, failures >= MAX_FAILURES ? { method: 'DELETE' } : { method: 'PATCH', body: { failure_count: failures } }).catch(() => {});
    }
  }));
  return out;
}

/**
 * Remember a push that quiet hours held back, for the "while you were away" summary (push-quiet-flush).
 * Returns false (and changes nothing) when the table is not there yet: the caller then keeps the old drop behaviour.
 */
export async function deferQuietPush(call, note) {
  try {
    await call('owner_push_deferred?on_conflict=notification_id', {
      method: 'POST',
      body: [{ clerk_user_id: note.clerk_user_id, notification_id: note.id, type: note.type }],
      prefer: 'resolution=ignore-duplicates,return=minimal',
    });
    return true;
  } catch { return false; }
}

/** Web Push half of a dispatch. Returns { sent, failed?, removed?, reason? }. */
async function pushPart({ note, prefs, vapid, call, webpush, now }) {
  if (!vapid) return { sent: 0, reason: 'not_configured' };
  if (prefs.push !== true) return { sent: 0, reason: 'push_disabled' };
  const blocked = pushTypeBlock(prefs, note.type);
  if (blocked) return { sent: 0, reason: blocked };
  if (inQuietHours(prefs.quiet_hours, now)) {
    const held = prefs.quiet_hours?.summary !== false && await deferQuietPush(call, note);
    return { sent: 0, reason: held ? 'quiet_hours_deferred' : 'quiet_hours' };
  }
  const subs = await loadSubscriptions(call, note.clerk_user_id);
  if (!subs?.length) return { sent: 0, reason: 'no_subscriptions' };
  return sendToSubscriptions({ call, wp: await prepareWebPush(vapid, webpush), subs, payload: buildPayload(note), now });
}

/** E-mail half of a dispatch: a status string, never an address. Errors are reported, not thrown. */
async function emailPart({ note, prefs, adapter, call, env, now }) {
  try { return await sendAlertEmailNow({ adapter, call, note, prefs, now, url: alertsUrl(env) }); } catch (err) {
    console.error('[push-dispatch] email failed:', String(err?.message || err).slice(0, 120));
    return 'error';
  }
}

/**
 * Dispatch one notification: Web Push and e-mail are independent (either can be off while the other is on).
 * Returns { sent, failed?, removed?, reason?, email? }; never throws for configuration or gating problems
 * (only for push database errors, so the caller can report 500 after the e-mail half has run).
 */
export async function dispatchPush({ notificationId, env = process.env, fetchImpl = fetch, webpush, now = new Date(), emailAdapter } = {}) {
  const vapid = vapidFrom(env);
  const adapter = emailAdapter || getEmailAdapter(env, { fetchImpl });
  if (!vapid && !adapter.configured) return { sent: 0, reason: 'not_configured' };
  const cfg = supabaseConfig(env);
  if (!cfg.url || !cfg.key) return { sent: 0, reason: 'not_configured' };
  if (!UUID.test(String(notificationId || ''))) return { sent: 0, reason: 'bad_notification_id' };
  const skipEmail = (status) => (adapter.configured ? status : 'not_configured');

  const call = rest(cfg, fetchImpl);
  const note = (await call(`owner_notifications?select=id,clerk_user_id,video_id,type,title,summary,suggestion,dedupe_key&id=eq.${notificationId}&limit=1`))?.[0];
  if (!note) return { sent: 0, reason: 'notification_not_found' };
  if (NO_PUSH_TYPES.includes(note.type) || !CATEGORY_BY_TYPE[note.type]) return { sent: 0, reason: 'type_not_pushed', email: skipEmail(note.type === 'daily_digest' ? 'skipped_digest' : 'skipped_type') };

  // select=* on purpose: push_types may not exist until its (optional) migration is applied; an absent column reads as NULL.
  const prefs = (await call(`retarget_preferences?select=*&clerk_user_id=eq.${encodeURIComponent(note.clerk_user_id)}&limit=1`))?.[0];
  if (!prefs) return { sent: 0, reason: 'no_preferences', email: skipEmail('skipped_no_preferences') };

  const [push, email] = await Promise.allSettled([
    pushPart({ note, prefs, vapid, call, webpush, now }),
    emailPart({ note, prefs, adapter, call, env, now }),
  ]);
  if (push.status === 'rejected') throw push.reason;
  return { ...push.value, email: email.value };
}
