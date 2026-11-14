/**
 * Web Push sender (Stage 11), dependency-free: RFC 8291 message encryption (aes128gcm) and RFC 8292 VAPID, on node:crypto.
 *
 * Why not the `web-push` package: it is MPL-2.0 and pulls four dependencies; the protocol is a published standard built from primitives
 * Node already ships (ECDH P-256, HKDF-SHA256, AES-128-GCM, ECDSA P-256). The encryption is checked in tests against an independent
 * implementation (Mozilla's `http_ece`), not only against itself.
 *
 * Security properties:
 *   - The server POSTs to an endpoint URL the BROWSER supplied, which is a server-side request forgery vector. Endpoints must be https,
 *     port 443, no credentials, a hostname (never an IP) that belongs to a known push service (or PUSH_ENDPOINT_HOSTS), and redirects are
 *     never followed. The check runs when a subscription is saved AND again before every send.
 *   - Alerts are claimed in the database before sending (push_claim_for_video): at-most-once, never a duplicate.
 *   - Sending is best effort with short timeouts; it must never break event ingestion.
 *   - The VAPID private key stays in the function environment; it is never sent anywhere or logged.
 */
/* global AbortSignal */
import { createCipheriv, createECDH, createPrivateKey, createSign, hkdfSync, randomBytes } from 'node:crypto';

export const b64u = (buf) => Buffer.from(buf).toString('base64url');
export const fromB64u = (s) => Buffer.from(String(s), 'base64url');

// ---------------------------------------------------------------- endpoint allowlist
const BUILT_IN_HOSTS = [
  'fcm.googleapis.com', 'android.googleapis.com',                       // Chrome, Edge, Opera, Brave (FCM)
  'push.services.mozilla.com',                                           // Firefox (updates.push.services.mozilla.com and regional hosts)
  'push.apple.com',                                                      // Safari / iOS web apps (web.push.apple.com)
  'notify.windows.com',                                                  // legacy Edge (WNS)
];
const HOSTNAME = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/;
const IPISH = /^[0-9.]+$|:/;

export function allowedHosts(env = {}) {
  const extra = String(env.PUSH_ENDPOINT_HOSTS || '').split(',').map((h) => h.trim().toLowerCase()).filter((h) => HOSTNAME.test(h) && !IPISH.test(h));
  return [...BUILT_IN_HOSTS, ...extra];
}
/** true only for an https URL on port 443 whose host is (a subdomain of) a known push service. */
export function isAllowedPushEndpoint(endpoint, env = {}) {
  if (typeof endpoint !== 'string' || endpoint.length > 1000 || /[\s<>"]/.test(endpoint)) return false;
  let u;
  try { u = new URL(endpoint); } catch { return false; }
  if (u.protocol !== 'https:' || u.username || u.password || (u.port && u.port !== '443')) return false;
  const host = u.hostname.toLowerCase();
  if (IPISH.test(host) || !HOSTNAME.test(host)) return false;
  return allowedHosts(env).some((h) => host === h || host.endsWith(`.${h}`));
}

// ---------------------------------------------------------------- VAPID
/** { publicKey, privateKey, subject } or null when push is not configured. Throws nothing: a bad configuration is "not configured". */
export function vapidConfig(env = process.env) {
  const publicKey = String(env.VAPID_PUBLIC_KEY || '').trim(); const privateKey = String(env.VAPID_PRIVATE_KEY || '').trim(); const subject = String(env.VAPID_SUBJECT || '').trim();
  if (!publicKey || !privateKey || !/^(mailto:[^\s@]+@[^\s@]+\.[^\s@]+|https:\/\/[^\s]+)$/.test(subject)) return null;
  try {
    const pub = fromB64u(publicKey); const priv = fromB64u(privateKey);
    if (pub.length !== 65 || pub[0] !== 4 || priv.length !== 32) return null;
    const ecdh = createECDH('prime256v1'); ecdh.setPrivateKey(priv);
    if (!ecdh.getPublicKey().equals(pub)) return null; // the two keys are not a pair
    return { publicKey, privateKey, subject };
  } catch { return null; }
}
/** Makes a key pair for the owner to put in their environment (used by `node scripts/make-vapid-keys.mjs`). */
export function generateVapidKeys() {
  const ecdh = createECDH('prime256v1'); ecdh.generateKeys();
  return { publicKey: b64u(ecdh.getPublicKey()), privateKey: b64u(ecdh.getPrivateKey()) };
}

function vapidJwt(cfg, audience, now) {
  const header = b64u(JSON.stringify({ typ: 'JWT', alg: 'ES256' }));
  const claims = b64u(JSON.stringify({ aud: audience, exp: Math.floor(now / 1000) + 12 * 3600, sub: cfg.subject }));
  const pub = fromB64u(cfg.publicKey);
  const key = createPrivateKey({ key: { kty: 'EC', crv: 'P-256', d: cfg.privateKey, x: b64u(pub.subarray(1, 33)), y: b64u(pub.subarray(33, 65)) }, format: 'jwk' });
  const sig = createSign('SHA256').update(`${header}.${claims}`).sign({ key, dsaEncoding: 'ieee-p1363' });
  return `${header}.${claims}.${b64u(sig)}`;
}
export const vapidAuthorization = (cfg, endpoint, now = Date.now()) => `vapid t=${vapidJwt(cfg, new URL(endpoint).origin, now)}, k=${cfg.publicKey}`;

// ---------------------------------------------------------------- RFC 8291 message encryption
export const MAX_PLAINTEXT = 2000;
/**
 * @param {{ p256dh: string, auth: string, plaintext: Buffer|string, ephemeral?: import('node:crypto').ECDH, salt?: Buffer }} o
 * `ephemeral` and `salt` exist only so tests can pin them; production uses fresh random values for every message.
 */
export function encryptPayload({ p256dh, auth, plaintext, ephemeral, salt }) {
  const uaPublic = fromB64u(p256dh); const authSecret = fromB64u(auth);
  if (uaPublic.length !== 65 || uaPublic[0] !== 4) throw new Error('The subscription public key is not a P-256 point.');
  if (authSecret.length !== 16) throw new Error('The subscription auth secret must be 16 bytes.');
  const data = Buffer.isBuffer(plaintext) ? plaintext : Buffer.from(String(plaintext), 'utf8');
  if (data.length > MAX_PLAINTEXT) throw new Error('The notification is too large.');
  const as = ephemeral ?? (() => { const e = createECDH('prime256v1'); e.generateKeys(); return e; })();
  const asPublic = as.getPublicKey(); const secret = as.computeSecret(uaPublic); // throws for a point that is not on the curve
  const s = salt ?? randomBytes(16);
  const ikm = Buffer.from(hkdfSync('sha256', secret, authSecret, Buffer.concat([Buffer.from('WebPush: info\0'), uaPublic, asPublic]), 32));
  const cek = Buffer.from(hkdfSync('sha256', ikm, s, Buffer.from('Content-Encoding: aes128gcm\0'), 16));
  const nonce = Buffer.from(hkdfSync('sha256', ikm, s, Buffer.from('Content-Encoding: nonce\0'), 12));
  const cipher = createCipheriv('aes-128-gcm', cek, nonce);
  const body = Buffer.concat([cipher.update(Buffer.concat([data, Buffer.from([2])])), cipher.final(), cipher.getAuthTag()]); // 0x02: the last (only) record
  const rs = Buffer.alloc(4); rs.writeUInt32BE(4096);
  return Buffer.concat([s, rs, Buffer.from([asPublic.length]), asPublic, body]);
}

// ---------------------------------------------------------------- sending
/** @returns {Promise<{ status: 'sent'|'gone'|'failed'|'rejected', httpStatus?: number, reason?: string }>} */
export async function sendOne({ sub, payload, vapid, env = {}, fetchImpl = fetch, ttl = 3600, topic, urgency = 'normal', timeoutMs = 3000, now = Date.now() }) {
  if (!isAllowedPushEndpoint(sub?.endpoint, env)) return { status: 'rejected', reason: 'endpoint-not-allowed' };
  let body;
  try { body = encryptPayload({ p256dh: sub.p256dh, auth: sub.auth, plaintext: payload }); } catch (e) { return { status: 'rejected', reason: String(e.message).slice(0, 80) }; }
  const headers = { 'Content-Encoding': 'aes128gcm', 'Content-Type': 'application/octet-stream', TTL: String(ttl), Urgency: urgency, Authorization: vapidAuthorization(vapid, sub.endpoint, now) };
  if (topic && /^[A-Za-z0-9_-]{1,32}$/.test(topic)) headers.Topic = topic;
  try {
    const res = await fetchImpl(sub.endpoint, { method: 'POST', headers, body, redirect: 'manual', signal: AbortSignal.timeout(timeoutMs) });
    if (res.status >= 200 && res.status < 300) return { status: 'sent', httpStatus: res.status };
    if (res.status === 404 || res.status === 410) return { status: 'gone', httpStatus: res.status };
    return { status: 'failed', httpStatus: res.status };
  } catch { return { status: 'failed', reason: 'network' }; }
}

/** The JSON the service worker shows. Owner-facing text only; encrypted end to end, so the push service never sees it. */
export function buildPayload(n, { test = false } = {}) {
  const clip = (v, max) => String(v ?? '').replace(/[\u0000-\u001F\u007F]/g, ' ').trim().slice(0, max); // eslint-disable-line no-control-regex
  return JSON.stringify({ v: 1, title: clip(n.title, 80) || 'SmartVideo', body: clip(n.summary, 200), type: clip(n.type, 32), tag: test ? 'test' : `${clip(n.type, 24)}:${clip(n.video_id, 16)}`, url: n.id ? `/?notification=${encodeURIComponent(clip(n.id, 40))}` : '/', test });
}

/**
 * Claims the not-yet-pushed alerts of this video's owner and sends them to the owner's subscriptions. Best effort, never throws.
 * @param {{ videoId: string, rpc: (name: string, args: object) => Promise<any>, env?: object, fetchImpl?: typeof fetch, now?: number }} o
 */
export async function pushForVideo({ videoId, rpc, env = process.env, fetchImpl = fetch, now = Date.now() }) {
  const vapid = vapidConfig(env);
  if (!vapid) return { skipped: 'not-configured', sent: 0 };
  try {
    const limit = await rpc('rate_limit_check', { p_scope: 'video-push', p_key: String(videoId).slice(0, 32), p_limit: 12, p_window_seconds: 60 });
    if (!limit || limit.allowed === false) return { skipped: 'rate-limited', sent: 0 };
    const claim = await rpc('push_claim_for_video', { p_video_id: videoId, p_limit: 3 });
    const notes = Array.isArray(claim?.notifications) ? claim.notifications : []; const subs = (Array.isArray(claim?.subscriptions) ? claim.subscriptions : []).slice(0, 10);
    if (!notes.length || !subs.length) return { sent: 0 };
    const jobs = notes.flatMap((n) => subs.map((sub) => sendOne({ sub, payload: buildPayload(n), vapid, env, fetchImpl, topic: String(n.type || '').slice(0, 32), now }).then((r) => ({ sub, r }))));
    const results = await Promise.all(jobs);
    const gone = [...new Set(results.filter((x) => x.r.status === 'gone').map((x) => x.sub.endpoint))];
    const ok = [...new Set(results.filter((x) => x.r.status === 'sent').map((x) => x.sub.endpoint))];
    if (gone.length || ok.length) await rpc('push_subscription_report', { p_gone: gone, p_ok: ok }).catch(() => null);
    return { sent: results.filter((x) => x.r.status === 'sent').length, gone: gone.length, failed: results.filter((x) => x.r.status === 'failed').length, rejected: results.filter((x) => x.r.status === 'rejected').length };
  } catch (err) {
    console.warn('[push] could not push alerts:', err?.message);
    return { skipped: 'error', sent: 0 };
  }
}
