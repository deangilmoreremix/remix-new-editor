/**
 * Netlify function: video-events (public, no sign-in)
 *
 * Collects first-party analytics from the hosted player (/watch/<id>,
 * /v/<business>/<slug>). It is the ONLY writer of analytics tables:
 *
 *   POST /api/video-events
 *   { video, session, viewer?, contact?, ref?, events: [{ type, seq, t?, clip?, section?, props? }] }
 *   → 200 { ok, accepted, duplicates }
 *   → 400 invalid · 404 unknown/unpublished video · 413 too large · 429 rate limited
 *
 * What it guarantees:
 *   - event types come from a fixed allowlist; payloads are size-limited and
 *     re-shaped (unknown keys dropped) before they reach the database
 *   - the video, its owner and its published revision are resolved in the
 *     database — a client can never name an owner, a revision or a score
 *   - unknown or unpublished videos are rejected
 *   - idempotent: (session, seq) is unique, so retried batches never double count
 *   - abuse control: shared database rate limits per client, session and video
 *   - privacy: the random viewer id is hashed with a server salt before it is
 *     stored; IP addresses are used only to derive a hashed rate-limit key
 *
 * The service-role key stays on the server (SUPABASE_SERVICE_ROLE_KEY).
 */
import { createHash } from 'node:crypto';

export const EVENT_TYPES = Object.freeze([
  'page_open', 'play', 'pause', 'resume', 'complete',
  'progress_25', 'progress_50', 'progress_75', 'progress_90',
  'replay', 'section_rewatch', 'cta_click', 'product_select', 'call_click',
  'overlay_click', 'lead_submit', 'error',
  // Stage 7 (heatmap analytics): routed to ingest_video_heat_events(), not to the legacy event table.
  'heat_click', 'cta_impression', 'scroll_depth',
]);
export const HEAT_TYPES = Object.freeze(['heat_click', 'cta_impression', 'scroll_depth', 'watch_buckets']);
const HEAT = new Set(HEAT_TYPES);
export const CTA_KINDS = Object.freeze(['book_call', 'visit_website', 'call_now', 'get_offer', 'contact', 'lead_capture', 'other']);
const VIEWPORTS = new Set(['mobile', 'tablet', 'desktop']);
const TYPES = new Set([...EVENT_TYPES, 'watch', 'watch_buckets']);
export const MAX_BODY = 8192;
export const MAX_EVENTS = 25;
const VIDEO = /^[A-Za-z0-9_-]{8,32}$/;
const SESSION = /^[A-Za-z0-9_-]{16,64}$/;
const CONTACT = /^[A-Za-z0-9_-]{1,80}$/;
const HOST = /^[A-Za-z0-9.-]{1,120}$/;

const json = (statusCode, body) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  body: JSON.stringify(body),
});
const fail = (statusCode, error, message) => json(statusCode, { ok: false, error, message });

const num = (v, max) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= max ? Math.round(v * 1000) / 1000 : null);
const str = (v, n = 80) => (typeof v === 'string' && v.length ? v.slice(0, n) : null);

const unit = (v) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 1 ? Math.round(v * 10000) / 10000 : null);

/** Heat events carry a small, fixed props shape: normalized coordinates and CTA ids only. Never text, never form values. */
function normalizeHeat(e) {
  const p = e.props && typeof e.props === 'object' && !Array.isArray(e.props) ? e.props : {};
  const props = {};
  if (VIEWPORTS.has(p.vp)) props.vp = p.vp;
  if (e.type === 'heat_click') {
    const x = unit(p.x); const y = unit(p.y);
    if (x == null || y == null) return null;
    props.x = x; props.y = y;
    props.pb = Number.isInteger(p.pb) && p.pb >= 1 && p.pb <= 40 ? p.pb : 1;
    const cta = str(p.cta);
    if (cta) {
      props.cta = cta;
      props.kind = CTA_KINDS.includes(p.kind) ? p.kind : 'other';
      const label = str(p.label);
      if (label) props.label = label;
    }
  } else if (e.type === 'cta_impression') {
    const cta = str(p.cta);
    if (!cta) return null;
    props.cta = cta;
    props.kind = CTA_KINDS.includes(p.kind) ? p.kind : 'other';
    const label = str(p.label);
    if (label) props.label = label;
  } else if (e.type === 'scroll_depth') {
    if (![25, 50, 75, 100].includes(p.v)) return null;
    props.v = p.v;
  } else { // watch_buckets: [[firstSecond, lastSecond], ...] seconds played (aggregated, never per tick)
    if (!Array.isArray(p.r) || !p.r.length || p.r.length > 30) return null;
    let total = 0;
    const r = [];
    for (const pair of p.r) {
      if (!Array.isArray(pair) || pair.length !== 2 || !Number.isInteger(pair[0]) || !Number.isInteger(pair[1])) return null;
      const [a, b] = pair;
      if (a < 0 || b < a || b > 3599) return null;
      total += b - a + 1;
      r.push([a, b]);
    }
    if (total > 600) return null;
    props.r = r;
  }
  return { type: e.type, seq: e.seq, props };
}

/** Re-shape one client event; returns null when invalid. */
export function normalizeEvent(e) {
  if (!e || typeof e !== 'object' || !TYPES.has(e.type)) return null;
  if (!Number.isInteger(e.seq) || e.seq < 0 || e.seq > 999999) return null;
  if (HEAT.has(e.type)) return normalizeHeat(e);
  if (e.type === 'watch') {
    const t0 = num(e.t0, 86400);
    const t1 = num(e.t1, 86400);
    return t0 != null && t1 != null && t1 > t0 && t1 - t0 <= 120 ? { type: 'watch', seq: e.seq, t0, t1 } : null;
  }
  const out = { type: e.type, seq: e.seq };
  const t = num(e.t, 86400);
  if (t != null) out.t = t;
  const clip = str(e.clip);
  if (clip) out.clip = clip;
  const section = str(e.section);
  if (section) out.section = section;
  if (e.props && typeof e.props === 'object' && !Array.isArray(e.props)) {
    const props = {};
    const label = str(e.props.label);
    if (label) props.label = label;
    if (typeof e.props.pricing === 'boolean') props.pricing = e.props.pricing;
    const reason = str(e.props.reason);
    if (reason) props.reason = reason;
    if (Object.keys(props).length) out.props = props;
  }
  return out;
}

export function deviceClass(ua = '') {
  if (/ipad|tablet/i.test(ua)) return 'tablet';
  if (/mobi|android|iphone|ipod/i.test(ua)) return 'mobile';
  return 'desktop';
}

const sha = (...parts) => createHash('sha256').update(parts.join(':')).digest('hex');

function config(env) {
  const url = String(env.SUPABASE_URL || env.VITE_SUPABASE_URL || '').replace(/\/$/, '');
  const key = env.SUPABASE_SERVICE_ROLE_KEY || '';
  return url && key ? { url, key, salt: env.ANALYTICS_HASH_SALT || 'smartvideo-analytics-v1' } : null;
}

async function rpc(cfg, fetchImpl, name, args) {
  const res = await fetchImpl(`${cfg.url}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: { apikey: cfg.key, Authorization: `Bearer ${cfg.key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(args),
  });
  if (!res.ok) throw new Error(`rpc ${name} failed (HTTP ${res.status})`);
  return res.json();
}

/** Shared (database) limits. Fails open if the limiter itself is unavailable. */
async function limited(cfg, fetchImpl, checks) {
  try {
    const results = await Promise.all(checks.map(([scope, key, limit]) =>
      rpc(cfg, fetchImpl, 'rate_limit_check', { p_scope: scope, p_key: key, p_limit: limit, p_window_seconds: 60 })));
    return results.some((r) => r && r.allowed === false);
  } catch (err) {
    console.warn('[video-events] rate limiter unavailable:', err?.message);
    return false;
  }
}

export async function handle(body, { ip = 'unknown', ua = '', fetchImpl = fetch, env = process.env } = {}) {
  const cfg = config(env);
  if (!cfg) return fail(503, 'not_configured', 'Analytics is not configured');
  if (!body || typeof body !== 'object') return fail(400, 'bad_request', 'Body must be a JSON object');
  if (!VIDEO.test(String(body.video || ''))) return fail(400, 'bad_request', 'Invalid video');
  if (!SESSION.test(String(body.session || ''))) return fail(400, 'bad_request', 'Invalid session');
  if (!Array.isArray(body.events) || !body.events.length || body.events.length > MAX_EVENTS) {
    return fail(400, 'bad_request', `Send 1-${MAX_EVENTS} events`);
  }
  const events = body.events.map(normalizeEvent).filter(Boolean);
  if (!events.length) return fail(400, 'bad_request', 'No valid events');

  const viewer = typeof body.viewer === 'string' && SESSION.test(body.viewer) ? sha(cfg.salt, body.viewer).slice(0, 32) : null;
  const contact = typeof body.contact === 'string' && CONTACT.test(body.contact) ? body.contact : null;
  const referrer = typeof body.ref === 'string' && HOST.test(body.ref) ? body.ref : null;

  if (await limited(cfg, fetchImpl, [
    ['video-events-client', sha(cfg.salt, ip, body.video).slice(0, 24), 120],
    ['video-events-session', sha(cfg.salt, body.session).slice(0, 24), 60],
    ['video-events-video', body.video, 1200],
  ])) return fail(429, 'rate_limited', 'Too many events, slow down');

  const legacy = events.filter((e) => !HEAT.has(e.type));
  const heat = events.filter((e) => HEAT.has(e.type));
  let result;
  try {
    // Always runs (even for a heat-only batch): it resolves the video and creates the session row the heat events hang off.
    result = await rpc(cfg, fetchImpl, 'ingest_video_events', {
      p_video_id: body.video,
      p_session_key: body.session,
      p_viewer_hash: viewer,
      p_contact_id: contact,
      p_device: deviceClass(ua),
      p_referrer: referrer,
      p_events: legacy,
    });
    if (result?.ok && heat.length) {
      const h = await rpc(cfg, fetchImpl, 'ingest_video_heat_events', {
        p_video_id: body.video, p_session_key: body.session, p_events: heat,
      });
      if (!h?.ok) return fail(400, h?.error || 'bad_request', 'Rejected');
      result = { ...result, accepted: (result.accepted || 0) + (h.accepted || 0), duplicates: (result.duplicates || 0) + (h.duplicates || 0) };
    }
  } catch (err) {
    console.error('[video-events] ingest failed:', err?.message);
    return fail(502, 'ingest_failed', 'Could not record events');
  }
  if (!result?.ok) {
    return result?.error === 'unknown_video'
      ? fail(404, 'unknown_video', 'Unknown video')
      : fail(400, result?.error || 'bad_request', 'Rejected');
  }
  return json(200, { ok: true, accepted: result.accepted, duplicates: result.duplicates });
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
  return handle(body, { ip, ua: h['user-agent'] || '' });
}
