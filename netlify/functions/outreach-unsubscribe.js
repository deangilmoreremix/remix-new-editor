/**
 * Netlify function: outreach-unsubscribe (public, no sign-in)
 *
 *   GET  /api/outreach-unsubscribe?t=<token>   → a confirmation page (it does NOT unsubscribe: mail scanners and link previewers
 *                                                  fetch links, and must not silently unsubscribe people)
 *   POST /api/outreach-unsubscribe?t=<token>   → records the suppression. Used by the confirmation form AND by mail clients'
 *                                                  one-click unsubscribe (RFC 8058: body `List-Unsubscribe=One-Click`).
 *
 * The token is a signed capability (see shared/personalization/email/unsubscribe.ts): HMAC-SHA256 over {owner, address hash, issued-at}.
 * Nothing is written unless the signature verifies, so nobody can unsubscribe an address they hold no token for. The address itself is
 * never in the link and never stored (only its hash). Suppression is per sender.
 *
 * Needs OUTREACH_UNSUBSCRIBE_SECRET (>= 16 chars), SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY. Fails closed (503) without them.
 */
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

const MAX_BODY = 2048;
const TOKEN_MAX_AGE_DAYS = 730;
const sha = (...p) => createHash('sha256').update(p.join(':')).digest('hex');

const b64u = (buf) => Buffer.from(buf).toString('base64url');

/** Same format and rules as the browser/Web Crypto implementation (unsubscribe.ts); Node's crypto here keeps the function dependency-free. */
export function verifyToken(secret, token, now = Date.now()) {
  if (!secret || secret.length < 16) return { ok: false, reason: 'unconfigured' };
  if (typeof token !== 'string' || token.length > 600 || !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token)) return { ok: false, reason: 'malformed' };
  const [body, sig] = token.split('.');
  const expected = createHmac('sha256', secret).update(body).digest();
  let given;
  try { given = Buffer.from(sig, 'base64url'); } catch { return { ok: false, reason: 'malformed' }; }
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return { ok: false, reason: 'bad-signature' };
  let p;
  try { p = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')); } catch { return { ok: false, reason: 'malformed' }; }
  if (!p || typeof p.o !== 'string' || !p.o || typeof p.h !== 'string' || !/^[a-f0-9]{64}$/.test(p.h) || !Number.isFinite(p.t)) return { ok: false, reason: 'malformed' };
  if (now / 1000 - p.t > TOKEN_MAX_AGE_DAYS * 86400 || p.t > now / 1000 + 300) return { ok: false, reason: 'expired' };
  return { ok: true, owner: p.o, hash: p.h };
}
export const _b64u = b64u;

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const page = (statusCode, title, bodyHtml) => ({
  statusCode,
  headers: {
    'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer', 'X-Content-Type-Options': 'nosniff',
    'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'",
  },
  body: `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${esc(title)}</title><style>body{font:16px/1.5 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;margin:0;background:#f3f4f6;color:#111827}main{max-width:460px;margin:12vh auto;background:#fff;border-radius:12px;padding:28px}button{background:#111827;color:#fff;border:0;border-radius:8px;padding:12px 20px;font-size:16px;cursor:pointer}p{margin:0 0 16px}</style></head><body><main><h1 style="font-size:20px;margin:0 0 12px">${esc(title)}</h1>${bodyHtml}</main></body></html>`,
});

const config = (env) => {
  const url = String(env.SUPABASE_URL || env.VITE_SUPABASE_URL || '').replace(/\/$/, '');
  const key = env.SUPABASE_SERVICE_ROLE_KEY || '';
  const secret = env.OUTREACH_UNSUBSCRIBE_SECRET || '';
  return url && key && secret.length >= 16 ? { url, key, secret, salt: env.ANALYTICS_HASH_SALT || 'smartvideo-outreach-v1' } : null;
};

async function rpc(cfg, fetchImpl, name, args) {
  const res = await fetchImpl(`${cfg.url}/rest/v1/rpc/${name}`, {
    method: 'POST', headers: { apikey: cfg.key, Authorization: `Bearer ${cfg.key}`, 'Content-Type': 'application/json' }, body: JSON.stringify(args),
  });
  if (!res.ok) throw new Error(`rpc ${name} failed (HTTP ${res.status})`);
  return res.json();
}

export async function handle({ method, token, body = '', contentType = '', ip = 'unknown' }, { fetchImpl = fetch, env = process.env, now = Date.now() } = {}) {
  const cfg = config(env);
  if (!cfg) return page(503, 'Unsubscribe is not available', '<p>This page is not set up yet. Please reply to the email and ask to be removed.</p>');
  if (method !== 'GET' && method !== 'POST') return page(405, 'Not allowed', '<p>Use the link from the email.</p>');
  const v = verifyToken(cfg.secret, token, now);
  if (!v.ok) return page(400, 'This link is not valid', '<p>The unsubscribe link is damaged or has expired. Please reply to the email and ask to be removed.</p>');

  if (method === 'GET') {
    return page(200, 'Unsubscribe from these emails?', `<p>Press the button to stop receiving emails from this sender.</p><form method="post" action="?t=${esc(token)}"><button type="submit">Unsubscribe</button></form>`);
  }
  // POST: either the confirmation form (empty / urlencoded body) or a one-click request. Only a tiny, known body is accepted.
  if (String(body).length > MAX_BODY) return page(413, 'Too large', '<p>Request too large.</p>');
  const oneClick = /(^|&)List-Unsubscribe=One-Click(&|$)/.test(String(body)) && /x-www-form-urlencoded/i.test(contentType);
  try {
    const limit = await rpc(cfg, fetchImpl, 'rate_limit_check', { p_scope: 'outreach-unsubscribe', p_key: sha(cfg.salt, ip).slice(0, 24), p_limit: 30, p_window_seconds: 60 }).catch(() => null);
    if (limit && limit.allowed === false) return page(429, 'Too many requests', '<p>Please wait a minute and try again.</p>');
    await rpc(cfg, fetchImpl, 'email_suppression_add', { p_owner: v.owner, p_hash: v.hash, p_reason: 'unsubscribed', p_source: oneClick ? 'one-click' : 'link' });
  } catch (err) {
    console.error('[outreach-unsubscribe] could not record:', err?.message);
    return page(502, 'Something went wrong', '<p>We could not record your request. Please try again, or reply to the email and ask to be removed.</p>');
  }
  return page(200, 'You are unsubscribed', '<p>You will not receive further emails from this sender. This can take a few minutes to take effect everywhere.</p>');
}

export async function handler(event) {
  const h = event.headers || {};
  const raw = event.isBase64Encoded ? Buffer.from(event.body || '', 'base64').toString('utf8') : (event.body || '');
  const ip = h['x-nf-client-connection-ip'] || h['x-forwarded-for']?.split(',')[0]?.trim() || 'unknown';
  return handle({ method: event.httpMethod, token: event.queryStringParameters?.t, body: raw, contentType: h['content-type'] || '', ip });
}
