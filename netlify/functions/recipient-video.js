/**
 * Netlify function: recipient-video (public, no sign-in)
 *
 *   GET /api/recipient-video?video=<id>&r=<recipient token>   → { ok, url, contentType, expiresIn }   (404 when there is none)
 *
 * Gives a recipient a short-lived signed URL for THEIR personalized video in the private bucket, and only while their personal link is
 * live (not revoked, not expired) and the token is for THIS video. The token is hashed here and resolved in the database; unknown, revoked,
 * expired, other-video and made-up tokens all answer the same 404, so the endpoint cannot be used to learn which tokens exist.
 * Rate limited per client. The URL is never cached and the response carries no referrer.
 */
import { createHash } from 'node:crypto';
import { DOWNLOAD_SECONDS, signDownload } from './_storage/signedUrls.js';

const VIDEO_ID = /^[A-Za-z0-9_-]{8,32}$/;
const TOKEN = /^[A-Za-z0-9_-]{32}$/;
const sha = (...p) => createHash('sha256').update(p.join(':')).digest('hex');
const HEADERS = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer', 'X-Content-Type-Options': 'nosniff' };
const json = (statusCode, body) => ({ statusCode, headers: HEADERS, body: JSON.stringify(body) });
const NONE = () => json(404, { ok: false, error: 'not_found' });

const config = (env) => {
  const url = String(env.SUPABASE_URL || env.VITE_SUPABASE_URL || '').replace(/\/$/, ''); const key = env.SUPABASE_SERVICE_ROLE_KEY || '';
  return url && key ? { url, key, salt: env.ANALYTICS_HASH_SALT || 'smartvideo-events-v1' } : null;
};
async function rpc(cfg, fetchImpl, name, args) {
  const res = await fetchImpl(`${cfg.url}/rest/v1/rpc/${name}`, { method: 'POST', headers: { apikey: cfg.key, Authorization: `Bearer ${cfg.key}`, 'Content-Type': 'application/json' }, body: JSON.stringify(args) });
  if (!res.ok) throw new Error(`rpc ${name} failed (HTTP ${res.status})`);
  return res.json();
}

export async function handle({ video, token, ip = 'unknown' }, { fetchImpl = fetch, env = process.env } = {}) {
  const cfg = config(env);
  if (!cfg) return json(503, { ok: false, error: 'not_configured' });
  if (!VIDEO_ID.test(String(video ?? '')) || !TOKEN.test(String(token ?? ''))) return NONE(); // malformed: no database call
  try {
    const limit = await rpc(cfg, fetchImpl, 'rate_limit_check', { p_scope: 'recipient-video', p_key: sha(cfg.salt, ip).slice(0, 24), p_limit: 30, p_window_seconds: 60 }).catch(() => null);
    if (limit && limit.allowed === false) return json(429, { ok: false, error: 'rate_limited' });
    const hit = await rpc(cfg, fetchImpl, 'recipient_video_resolve', { p_video_id: video, p_token_hash: createHash('sha256').update(token).digest('hex') });
    if (!hit || typeof hit.object_path !== 'string') return NONE();
    const url = await signDownload(cfg, hit.object_path, DOWNLOAD_SECONDS, fetchImpl);
    return json(200, { ok: true, url, contentType: hit.content_type, expiresIn: DOWNLOAD_SECONDS });
  } catch (err) {
    console.error('[recipient-video] failed:', err?.message);
    return json(502, { ok: false, error: 'unavailable' });
  }
}

export async function handler(event) {
  if (event.httpMethod !== 'GET') return json(405, { ok: false, error: 'method_not_allowed' });
  const h = event.headers || {}; const q = event.queryStringParameters || {};
  const ip = h['x-nf-client-connection-ip'] || h['x-forwarded-for']?.split(',')[0]?.trim() || 'unknown';
  return handle({ video: q.video, token: q.r, ip });
}
