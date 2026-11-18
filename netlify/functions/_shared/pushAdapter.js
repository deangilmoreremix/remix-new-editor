/**
 * Web Push dispatch core (testable: `webpush`, `fetchImpl` and `env` are injected).
 *
 * Flow: owner_notifications INSERT -> DB trigger (pg_net) -> push-dispatch function
 * -> this module -> push service of each of the owner's subscribed devices.
 * Never logs endpoints, keys or payload bodies.
 */
import { timingSafeEqual, createHash } from 'node:crypto';
import { inQuietHours } from './emailAdapter.js';

export const MAX_FAILURES = 5;
export const NO_PUSH_TYPES = Object.freeze(['daily_digest']);
export const CATEGORY_BY_TYPE = Object.freeze({
  new_lead: 'New lead',
  high_interest: 'Retarget',
  followup_opportunity: 'Retarget',
  interest_surge: 'Retarget',
  returning_engagement: 'Retarget',
  milestone: 'Video',
  pricing_cta: 'Video',
  contact_cta: 'Video',
});
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

const rest = (cfg, fetchImpl) => async (path, { method = 'GET', body } = {}) => {
  const res = await fetchImpl(`${cfg.url}/rest/v1/${path}`, {
    method,
    headers: { apikey: cfg.key, Authorization: `Bearer ${cfg.key}`, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${method} ${path.split('?')[0]} failed (HTTP ${res.status})`);
  const text = await res.text();
  return text ? JSON.parse(text) : null;
};

async function loadWebPush(injected) {
  if (injected) return injected;
  const mod = await import('web-push');
  return mod.default || mod;
}

/**
 * Dispatch one notification. Returns { sent, failed, removed, reason? }; never throws for
 * configuration or gating problems (only for database errors, so the caller can report 500).
 */
export async function dispatchPush({ notificationId, env = process.env, fetchImpl = fetch, webpush, now = new Date() } = {}) {
  const vapid = { pub: env.VAPID_PUBLIC_KEY, priv: env.VAPID_PRIVATE_KEY, subject: env.VAPID_SUBJECT };
  if (!vapid.pub || !vapid.priv || !vapid.subject) return { sent: 0, reason: 'not_configured' };
  const cfg = { url: String(env.SUPABASE_URL || env.VITE_SUPABASE_URL || '').replace(/\/$/, ''), key: env.SUPABASE_SERVICE_ROLE_KEY || '' };
  if (!cfg.url || !cfg.key) return { sent: 0, reason: 'not_configured' };
  if (!UUID.test(String(notificationId || ''))) return { sent: 0, reason: 'bad_notification_id' };

  const call = rest(cfg, fetchImpl);
  const note = (await call(`owner_notifications?select=id,clerk_user_id,video_id,type,title,summary,dedupe_key&id=eq.${notificationId}&limit=1`))?.[0];
  if (!note) return { sent: 0, reason: 'notification_not_found' };
  if (NO_PUSH_TYPES.includes(note.type) || !CATEGORY_BY_TYPE[note.type]) return { sent: 0, reason: 'type_not_pushed' };

  const owner = encodeURIComponent(note.clerk_user_id);
  // select=* on purpose: push_types may not exist until its (optional) migration is applied; an absent column reads as NULL.
  const prefs = (await call(`retarget_preferences?select=*&clerk_user_id=eq.${owner}&limit=1`))?.[0];
  if (!prefs) return { sent: 0, reason: 'no_preferences' };
  if (prefs.push !== true) return { sent: 0, reason: 'push_disabled' };
  if (!Array.isArray(prefs.enabled_types) || !prefs.enabled_types.includes(note.type)) return { sent: 0, reason: 'type_disabled' };
  // push_types: NULL/absent = push every enabled type (legacy); an array = only the types also listed there.
  if (Array.isArray(prefs.push_types) && !prefs.push_types.includes(note.type)) return { sent: 0, reason: 'type_push_disabled' };
  if (inQuietHours(prefs.quiet_hours, now)) return { sent: 0, reason: 'quiet_hours' };

  const subs = await call(`owner_push_subscriptions?select=id,endpoint,p256dh,auth,failure_count&clerk_user_id=eq.${owner}&limit=50`);
  if (!subs?.length) return { sent: 0, reason: 'no_subscriptions' };

  const wp = await loadWebPush(webpush);
  wp.setVapidDetails(vapid.subject, vapid.pub, vapid.priv);
  const body = JSON.stringify(buildPayload(note));
  const out = { sent: 0, failed: 0, removed: 0 };

  await Promise.all(subs.map(async (s) => {
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
