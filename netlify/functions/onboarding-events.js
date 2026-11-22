/**
 * Netlify function: onboarding-events (public; an optional Clerk Bearer token adds the signed-in user)
 *
 * First-party funnel analytics for the app-wide onboarding (src/lib/onboarding/telemetry.js). It is the only writer of
 * public.onboarding_events for browser events (the 'signup' event comes from clerk-webhook.js):
 *
 *   POST /api/onboarding-events
 *   { anon, session, ref?, events: [{ event, seq, step?, sub?, props? }] }
 *   → 200 { ok, accepted, duplicates } · 400 invalid · 413 too large · 429 rate limited · 503 not configured
 *
 * Guarantees:
 *   - events come from a fixed allowlist and are re-shaped (unknown keys dropped); `props` only carries choice ids
 *     (never company, website, job title or free text); a browser can never send 'signup'
 *   - the Clerk user id is resolved here from a verified token, never taken from the body
 *   - idempotent ((session, seq) is unique); shared database rate limits per client and per session, fail-open
 *   - the browser id is hashed with a server salt; IP addresses only derive a hashed rate-limit key
 */
import { createHash } from 'node:crypto';

export const EVENT_TYPES = Object.freeze(['start', 'step_view', 'step_answer', 'back', 'skip_step', 'complete', 'leave', 'open_studio', 'key_saved', 'key_tested']);
const TYPES = new Set(EVENT_TYPES);
const SUBS = new Set(['type', 'tools', 'ready']);
const DEVICES = new Set(['mobile', 'tablet', 'desktop']);
export const MAX_BODY = 8192;
export const MAX_EVENTS = 25;
const ID = /^[A-Za-z0-9_-]{16,64}$/;
const HOST = /^[A-Za-z0-9.-]{1,120}$/;
const CHOICE = /^[a-z0-9][a-z0-9_.:+-]{0,39}$/; // a choice id such as "ai-video", "2-5", "100+", "outreach"
const FIELDS = new Set(['goal', 'team', 'volume', 'company', 'website', 'jobTitle', 'heard', 'videoTypes', 'tools', 'primary']);
// Answers that are free text are only counted ("was it filled in"), never sent.
const FREE_TEXT_FIELDS = new Set(['company', 'website', 'jobTitle']);
const TO = new Set(['academy', 'studio', 'apps', 'image', 'settings']);
const PROVIDERS = new Set(['muapi']);

const json = (statusCode, body) => ({ statusCode, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, body: JSON.stringify(body) });
const fail = (statusCode, error, message) => json(statusCode, { ok: false, error, message });

const choice = (v) => (typeof v === 'string' && CHOICE.test(v) ? v : null);
const choices = (v, max = 40) => (Array.isArray(v) ? [...new Set(v.map(choice).filter(Boolean))].slice(0, max) : null);

/** Re-shape one event's props to the small fixed shape per event type. */
function shapeProps(event, p) {
  const o = {};
  if (event === 'start') {
    if (typeof p.redo === 'boolean') o.redo = p.redo;
    if (Number.isInteger(p.resumedAtStep) && p.resumedAtStep >= 1 && p.resumedAtStep <= 6) o.resumedAtStep = p.resumedAtStep;
  } else if (event === 'step_answer') {
    if (!FIELDS.has(p.field)) return null;
    o.field = p.field;
    if (FREE_TEXT_FIELDS.has(p.field)) o.filled = p.filled === true;
    else if (Array.isArray(p.value)) { const v = choices(p.value); if (!v) return null; o.value = v; }
    else { const v = choice(p.value); if (!v) return null; o.value = v; }
  } else if (event === 'complete') {
    for (const k of ['goal', 'team', 'volume', 'heard', 'primary']) { const v = choice(p[k]); if (v) o[k] = v; }
    const types = choices(p.types, 8); if (types) o.types = types;
    const tools = choices(p.tools, 40); if (tools) o.tools = tools;
    for (const k of ['company', 'website', 'jobTitle']) if (typeof p[k] === 'boolean') o[k] = p[k];
  } else if (event === 'leave' || event === 'skip_step') {
    if (TO.has(p.to)) o.to = p.to;
    if (Number.isInteger(p.atStep) && p.atStep >= 1 && p.atStep <= 6) o.atStep = p.atStep;
  } else if (event === 'open_studio') {
    const v = choice(p.studio); if (!v) return null; o.studio = v;
  } else if (event === 'key_saved') {
    if (PROVIDERS.has(p.provider)) o.provider = p.provider;
  } else if (event === 'key_tested') {
    if (typeof p.ok === 'boolean') o.ok = p.ok;
  } else if (event === 'back') {
    if (Number.isInteger(p.from) && p.from >= 1 && p.from <= 6) o.from = p.from;
  }
  return o;
}

/** Re-shape one client event; returns null when invalid. */
export function normalizeEvent(e) {
  if (!e || typeof e !== 'object' || !TYPES.has(e.event)) return null;
  if (!Number.isInteger(e.seq) || e.seq < 0 || e.seq > 999999) return null;
  const out = { event: e.event, seq: e.seq };
  if (e.step != null) {
    if (!Number.isInteger(e.step) || e.step < 1 || e.step > 6) return null;
    out.step = e.step;
  }
  if (e.sub != null) {
    if (!SUBS.has(e.sub)) return null;
    out.sub_step = e.sub;
  }
  const raw = e.props && typeof e.props === 'object' && !Array.isArray(e.props) ? e.props : {};
  const props = shapeProps(e.event, raw);
  if (props === null) return null;
  if (Object.keys(props).length) out.props = props;
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
  if (!res.ok) throw Object.assign(new Error(`rpc ${name} failed (HTTP ${res.status})`), { status: res.status });
  return res.json();
}

/** Shared (database) limits. Fails open if the limiter itself is unavailable. */
async function limited(cfg, fetchImpl, checks) {
  try {
    const results = await Promise.all(checks.map(([scope, key, limit]) =>
      rpc(cfg, fetchImpl, 'rate_limit_check', { p_scope: scope, p_key: key, p_limit: limit, p_window_seconds: 60 })));
    return results.some((r) => r && r.allowed === false);
  } catch (err) {
    console.warn('[onboarding-events] rate limiter unavailable:', err?.message);
    return false;
  }
}

async function defaultVerify(token) {
  const { verifyClerkToken } = await import('./_shared/clerkAuth.js');
  return verifyClerkToken(token);
}

export async function handle(body, { ip = 'unknown', ua = '', token = '', fetchImpl = fetch, env = process.env, verify = defaultVerify } = {}) {
  const cfg = config(env);
  if (!cfg) return fail(503, 'not_configured', 'Analytics is not configured');
  if (!body || typeof body !== 'object') return fail(400, 'bad_request', 'Body must be a JSON object');
  if (!ID.test(String(body.anon || ''))) return fail(400, 'bad_request', 'Invalid anon id');
  if (!ID.test(String(body.session || ''))) return fail(400, 'bad_request', 'Invalid session');
  if (!Array.isArray(body.events) || !body.events.length || body.events.length > MAX_EVENTS) {
    return fail(400, 'bad_request', `Send 1-${MAX_EVENTS} events`);
  }
  const events = body.events.map(normalizeEvent).filter(Boolean);
  if (!events.length) return fail(400, 'bad_request', 'No valid events');

  const anon = sha(cfg.salt, body.anon).slice(0, 32);
  const referrer = typeof body.ref === 'string' && HOST.test(body.ref) ? body.ref : null;

  if (await limited(cfg, fetchImpl, [
    ['onboarding-ip', sha(cfg.salt, ip).slice(0, 24), 120],
    ['onboarding-session', sha(cfg.salt, body.session).slice(0, 24), 60],
  ])) return fail(429, 'rate_limited', 'Too many events, slow down');

  // The user id only ever comes from a verified token; a bad or missing token just means "anonymous".
  let userId = null;
  if (token) {
    try { userId = (await verify(token))?.userId || null; } catch { userId = null; }
  }

  let result;
  try {
    result = await rpc(cfg, fetchImpl, 'ingest_onboarding_events', {
      p_anon_hash: anon,
      p_session_key: body.session,
      p_clerk_user_id: userId,
      p_device: DEVICES.has(deviceClass(ua)) ? deviceClass(ua) : null,
      p_referrer: referrer,
      p_events: events,
    });
  } catch (err) {
    console.error('[onboarding-events] ingest failed:', err?.message);
    return fail(502, 'ingest_failed', 'Could not record events');
  }
  if (!result?.ok) return fail(400, result?.error || 'bad_request', 'Rejected');
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
  const auth = h.authorization || h.Authorization || '';
  const token = /^Bearer\s+(\S+)$/i.exec(auth)?.[1] || '';
  return handle(body, { ip, ua: h['user-agent'] || '', token });
}
