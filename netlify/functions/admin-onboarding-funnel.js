/**
 * Netlify function: admin-onboarding-funnel (signed-in admins only)
 *
 *   GET /api/admin/onboarding-funnel?from=YYYY-MM-DD&to=YYYY-MM-DD
 *   → 200 { ok: true, funnel: [...], ... }   (the onboarding_funnel() report)
 *   → 400 bad range · 401 no/invalid session · 403 not an admin · 405 · 502 · 503 not configured
 *
 * Closed by default: the verified Clerk user id must be listed in ADMIN_CLERK_USER_IDS (comma separated). A missing or
 * empty list, or an id that is not on it, gets the same 403, so nothing about the report leaks. The report is read
 * with the service key (the SQL function is service_role only); nothing is returned for anyone else.
 */
import { withClerkAuth } from './_shared/clerkAuth.js';

const DAY = 86_400_000;
const MAX_RANGE_DAYS = 366;

const json = (statusCode, body) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  body: JSON.stringify(body),
});
const fail = (statusCode, error, message) => json(statusCode, { ok: false, error, message });

export const adminIds = (env) => String(env.ADMIN_CLERK_USER_IDS || '').split(',').map((s) => s.trim()).filter(Boolean);

function parseDate(v, endOfDay) {
  if (v == null || v === '') return null;
  const s = String(v);
  if (!/^\d{4}-\d{2}-\d{2}([T ][0-9:.]+(Z|[+-]\d{2}:?\d{2})?)?$/.test(s)) return NaN;
  const d = new Date(s.length === 10 ? `${s}T00:00:00Z` : s);
  if (Number.isNaN(d.getTime())) return NaN;
  // A plain date as the end means "through that day".
  return s.length === 10 && endOfDay ? new Date(d.getTime() + DAY) : d;
}

/** Resolves ?from & ?to to a validated [from, to) range; defaults to the last 30 days. */
export function resolveRange(query = {}, now = new Date()) {
  const to = parseDate(query.to, true);
  const from = parseDate(query.from, false);
  if (Number.isNaN(to) || Number.isNaN(from)) return { error: 'Dates must look like 2026-11-01' };
  const end = to || now;
  const start = from || new Date(end.getTime() - 30 * DAY);
  if (start >= end) return { error: 'The start must be before the end' };
  if (end.getTime() - start.getTime() > MAX_RANGE_DAYS * DAY) return { error: `Pick a range of at most ${MAX_RANGE_DAYS} days` };
  return { from: start, to: end };
}

function config(env) {
  const url = String(env.SUPABASE_URL || env.VITE_SUPABASE_URL || '').replace(/\/$/, '');
  const key = env.SUPABASE_SERVICE_ROLE_KEY || '';
  return url && key ? { url, key } : null;
}

export async function handle({ method = 'GET', userId = '', query = {} } = {}, { env = process.env, fetchImpl = fetch, now = new Date() } = {}) {
  if (method !== 'GET') return fail(405, 'method_not_allowed', 'Use GET');
  const admins = adminIds(env);
  if (!userId || !admins.includes(userId)) return fail(403, 'forbidden', 'Not available');
  const cfg = config(env);
  if (!cfg) return fail(503, 'not_configured', 'Not configured');
  const range = resolveRange(query, now);
  if (range.error) return fail(400, 'bad_range', range.error);
  let res;
  try {
    res = await fetchImpl(`${cfg.url}/rest/v1/rpc/onboarding_funnel`, {
      method: 'POST',
      headers: { apikey: cfg.key, Authorization: `Bearer ${cfg.key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_from: range.from.toISOString(), p_to: range.to.toISOString() }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const report = await res.json();
    if (!report || report.ok !== true) return fail(502, 'report_failed', 'Could not build the report');
    return json(200, report);
  } catch (err) {
    console.error('[admin-onboarding-funnel] report failed:', err?.message);
    return fail(502, 'report_failed', 'Could not build the report');
  }
}

export const handler = withClerkAuth(async (event) => handle({
  method: event.httpMethod,
  userId: event.auth?.userId || '',
  query: event.queryStringParameters || {},
}));
