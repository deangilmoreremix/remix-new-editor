// netlify/functions/guest-token.js
//
// Guest identity for visitors who publish without an account.
//
// A guest is a private random id (`guest_` + 22 URL-safe chars). The browser
// keeps a long-lived *credential* (proof it is that guest) and trades it for a
// short-lived Supabase JWT, exactly like netlify/functions/supabase-token.js does
// for a Clerk session:
//
//   { sub: 'guest_xxxxxxxxxxxxxxxxxxxxxx', role: 'authenticated', guest: true }
//
// Every existing RLS policy keys on `auth.jwt() ->> 'sub'`, so published videos,
// personal links, leads and analytics work for a guest with no other change.
//
//   POST {}                          -> new guest: { token, credential, sub, expires_in }
//   POST { credential }              -> same guest, fresh token (and a fresh credential
//                                       when the old one is near its end)
//
// Keys: the Supabase token is signed with SUPABASE_JWT_SECRET (the database checks
// it). The credential is signed with a DIFFERENT key derived from it,
// HMAC(SUPABASE_JWT_SECRET, "guest-credential-v1"), so a credential is never a
// valid Supabase token and vice versa, and no new environment variable is needed.
//
// Making a guest is rate limited per IP through the shared database limiter
// (rate_limit_check, service role): the per-guest quotas in the database are only
// as strong as the cost of making another guest. IPs are only used as a hashed key.
//
// Required environment (Netlify): SUPABASE_JWT_SECRET, SUPABASE_SERVICE_ROLE_KEY,
// SUPABASE_URL (or VITE_SUPABASE_URL).
import { createHash, createHmac, randomBytes } from 'node:crypto';
import { SignJWT, jwtVerify } from 'jose';

export const TOKEN_TTL_SECONDS = 60 * 60;
export const CREDENTIAL_TTL_SECONDS = 180 * 24 * 60 * 60;
const RENEW_WITHIN_SECONDS = 30 * 24 * 60 * 60;
export const MAX_BODY = 4096;
export const GUEST_ID_RE = /^guest_[A-Za-z0-9_-]{22}$/;
const CREDENTIAL_ISSUER = 'smartvideo-guest';
/** New guests allowed per IP. */
export const CREATE_LIMITS = Object.freeze([
  { scope: 'smartvideo-guest-hour', limit: 10, windowSeconds: 3600 },
  { scope: 'smartvideo-guest-day', limit: 30, windowSeconds: 86400 },
]);

const json = (statusCode, body) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  body: JSON.stringify(body),
});
const fail = (statusCode, error, message) => json(statusCode, { ok: false, error, message });

const bytes = (buf) => new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);

/** The two signing keys, or null when the Supabase JWT secret is not configured. */
export function guestKeys(env = process.env) {
  const secret = env.SUPABASE_JWT_SECRET;
  if (!secret) return null;
  return {
    tokenKey: bytes(Buffer.from(secret, 'utf8')),
    credentialKey: bytes(createHmac('sha256', secret).update('guest-credential-v1').digest()),
  };
}

export const newGuestId = (random = () => randomBytes(16)) => `guest_${random().toString('base64url')}`;

export async function mintToken(guestId, keys, nowSeconds = Math.floor(Date.now() / 1000)) {
  return new SignJWT({ workspace_id: 'personal', role: 'authenticated', guest: true })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setSubject(guestId)
    .setAudience('authenticated')
    .setIssuedAt(nowSeconds)
    .setExpirationTime(nowSeconds + TOKEN_TTL_SECONDS)
    .sign(keys.tokenKey);
}

export async function mintCredential(guestId, keys, nowSeconds = Math.floor(Date.now() / 1000)) {
  return new SignJWT({ typ: 'guest-credential' })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setSubject(guestId)
    .setIssuer(CREDENTIAL_ISSUER)
    .setIssuedAt(nowSeconds)
    .setExpirationTime(nowSeconds + CREDENTIAL_TTL_SECONDS)
    .sign(keys.credentialKey);
}

/** { guestId, expiresAt (seconds) } for a valid credential, else null. Also used by guest-claim. */
export async function verifyCredential(credential, keys, nowSeconds = Math.floor(Date.now() / 1000)) {
  if (typeof credential !== 'string' || credential.length > 2048) return null;
  try {
    const { payload } = await jwtVerify(credential, keys.credentialKey, {
      algorithms: ['HS256'], issuer: CREDENTIAL_ISSUER, currentDate: new Date(nowSeconds * 1000),
    });
    if (payload.typ !== 'guest-credential' || !GUEST_ID_RE.test(String(payload.sub || ''))) return null;
    return { guestId: payload.sub, expiresAt: Number(payload.exp) };
  } catch {
    return null;
  }
}

const sha = (...parts) => createHash('sha256').update(parts.join(':')).digest('hex');

function limiterConfig(env) {
  const url = String(env.SUPABASE_URL || env.VITE_SUPABASE_URL || '').replace(/\/$/, '');
  const key = env.SUPABASE_SERVICE_ROLE_KEY || '';
  return url && key ? { url, key, salt: env.GUEST_HASH_SALT || 'smartvideo-guest-v1' } : null;
}

/** True when this IP has made too many guests. Fails open if the limiter itself is unavailable. */
async function tooManyGuests(cfg, fetchImpl, ip) {
  const key = sha(cfg.salt, ip).slice(0, 32);
  try {
    const results = await Promise.all(CREATE_LIMITS.map(async ({ scope, limit, windowSeconds }) => {
      const res = await fetchImpl(`${cfg.url}/rest/v1/rpc/rate_limit_check`, {
        method: 'POST',
        headers: { apikey: cfg.key, Authorization: `Bearer ${cfg.key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ p_scope: scope, p_key: key, p_limit: limit, p_window_seconds: windowSeconds }),
      });
      if (!res.ok) throw new Error(`rate_limit_check failed (HTTP ${res.status})`);
      return res.json();
    }));
    return results.some((r) => r && r.allowed === false);
  } catch (err) {
    console.warn('[guest-token] rate limiter unavailable:', err?.message);
    return false;
  }
}

export async function handle(body, { ip = 'unknown', fetchImpl = fetch, env = process.env, nowSeconds = Math.floor(Date.now() / 1000) } = {}) {
  const keys = guestKeys(env);
  if (!keys) return fail(503, 'not_configured', 'Guest access is not configured');
  if (!body || typeof body !== 'object' || Array.isArray(body)) return fail(400, 'bad_request', 'Body must be a JSON object');

  // Returning guest.
  if (body.credential !== undefined) {
    const proof = await verifyCredential(body.credential, keys, nowSeconds);
    if (!proof) return fail(401, 'invalid_credential', 'This guest session is no longer valid');
    const out = { ok: true, sub: proof.guestId, token: await mintToken(proof.guestId, keys, nowSeconds), expires_in: TOKEN_TTL_SECONDS };
    // Slide the credential forward while the guest is still around.
    if (proof.expiresAt - nowSeconds < RENEW_WITHIN_SECONDS) out.credential = await mintCredential(proof.guestId, keys, nowSeconds);
    return json(200, out);
  }

  // New guest: needs the limiter's database access, and is limited per IP.
  const cfg = limiterConfig(env);
  if (!cfg) return fail(503, 'not_configured', 'Guest access is not configured');
  if (await tooManyGuests(cfg, fetchImpl, ip)) return fail(429, 'rate_limited', 'Too many new guest sessions from here — try again later');
  const guestId = newGuestId();
  return json(200, {
    ok: true,
    sub: guestId,
    token: await mintToken(guestId, keys, nowSeconds),
    credential: await mintCredential(guestId, keys, nowSeconds),
    expires_in: TOKEN_TTL_SECONDS,
  });
}

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: {}, body: '' };
  if (event.httpMethod !== 'POST') return fail(405, 'method_not_allowed', 'Use POST');
  const raw = event.isBase64Encoded ? Buffer.from(event.body || '', 'base64').toString('utf8') : (event.body || '');
  if (raw.length > MAX_BODY) return fail(413, 'too_large', 'Request too large');
  let body;
  try { body = JSON.parse(raw || '{}'); } catch { return fail(400, 'bad_request', 'Body must be JSON'); }
  const h = event.headers || {};
  const ip = h['x-nf-client-connection-ip'] || h['x-forwarded-for']?.split(',')[0]?.trim() || 'unknown';
  return handle(body, { ip });
}
