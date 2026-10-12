// netlify/functions/personalization-discovery.js
//
// Server-side website asset discovery for the Personalization Hub.
//
// This function is a thin, authenticated bridge over the EXISTING discovery
// engine (src/components/personalize/discovery/). The engine is Node-only
// — its SSRF guard resolves DNS with node:dns and hashes with node:crypto —
// so it must run here on the server and must never be imported by browser
// code. Nothing in the engine is reimplemented; it is imported as-is via a
// dynamic `import()` (which also keeps it out of any client bundle).
//
// Routes (all under /.netlify/functions/personalization-discovery):
//   POST   { url }                     → start a job  → { jobId, status: 'pending' }
//   POST   { action: 'cancel', jobId } → cancel a job → { jobId, status: 'cancelled' }
//   GET    ?jobId=xxx                  → poll status  → { jobId, status, found, errors, assets }
//   DELETE ?jobId=xxx                  → cancel a job → { jobId, status: 'cancelled' }
//
// Status values: pending | running | done | failed | cancelled | unknown.
//   `unknown` means the engine's in-process store no longer knows the job
//   AND the durable row is still non-terminal (cold instance) — the client
//   is expected to re-submit the URL.
//
// Auth (there is deliberately NO unauthenticated path):
//   - Browser callers send their Supabase session token as
//     `Authorization: Bearer <access_token>`; it is verified server-side
//     with the service-role client's auth.getUser(token) — exactly how
//     personalizer-api.js verifies requests. Clerk session verification was
//     not used because @clerk/backend is NOT a dependency of this repo (only
//     the browser-side @clerk/* packages are), and adding one is out of
//     scope; no browser secret is ever exposed for auth.
//   - Server-to-server callers may instead send the internal shared secret
//     `X-Discovery-Secret: <PERSONALIZATION_DISCOVERY_SECRET>`, following the
//     MAIGRET_WORKER_SECRET precedent in netlify.toml.
//
// SSRF: the engine already validates every URL (and every redirect hop).
// As defence in depth this function ALSO re-validates the submitted URL with
// the engine's own `validateUrl` BEFORE enqueuing, caps URL length, and
// rejects non-http(s) schemes, so a bad URL never reaches the job store.
//
// Durability: the engine's job store is an in-process Map (per its spec), so
// job state is per-instance. This function additionally mirrors job records
// into the Supabase table `personalization_discovery_jobs` (service-role
// only; no anon/authenticated RLS policies):
//   - a job that reached a terminal state is still returned after the engine
//     garbage-collects it (60s TTL) or after an instance rotation;
//   - a job whose durable row is still pending/running but whose engine
//     record is gone returns status `unknown`. Discovery does NOT resume
//     across instances — the client re-submits.

import crypto from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

/** Matches the engine's urlSafety.MAX_URL_LENGTH; enforced pre-enqueue. */
const MAX_URL_LENGTH = 2048;

/** How often the in-process watcher mirrors engine state to the durable row. */
const WATCH_INTERVAL_MS = 1000;
/** Stop watching after this long; the durable row keeps the last known state. */
const WATCH_MAX_MS = 100_000;

/** Terminal engine statuses (the engine reports 'completed', we report 'done'). */
const ENGINE_TERMINAL_STATUSES = new Set(['completed', 'failed', 'cancelled']);
/** Statuses that end a client's polling loop. */
const TERMINAL_STATUSES = new Set(['done', 'failed', 'cancelled', 'unknown']);

/** Discovery result categories, in engine order, with their library role. */
const DISCOVERY_CATEGORIES = Object.freeze([
  Object.freeze({ key: 'logos', role: 'logo' }),
  Object.freeze({ key: 'products', role: 'product_reference' }),
  Object.freeze({ key: 'brandReferences', role: 'brand_reference' }),
  Object.freeze({ key: 'urls', role: 'saved_reference' }),
]);

/* ---------- Supabase (lazy; missing config disables the durable layer) ───── */

let supabaseClient = null;

/**
 * Service-role client, created lazily so the module still loads (and the
 * in-process happy path still works) when Supabase env vars are absent.
 * @returns {ReturnType<typeof createClient> | null}
 */
function getSupabase() {
  if (supabaseClient) return supabaseClient;
  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return null;
  try {
    supabaseClient = createClient(url, serviceKey);
  } catch (err) {
    console.error('[personalization-discovery] Supabase client init failed:', err.message);
    supabaseClient = null;
  }
  return supabaseClient;
}

/* ---------- Engine (cached dynamic import; mocked in tests) ─────────────── */

let enginePromise = null;

/**
 * The discovery engine's job API. The specifier is a literal (not a
 * computed variable) so bundlers and vitest's module runner can trace it;
 * it is a dynamic `import()` so the Node-only module is only ever loaded
 * on the server, never in a client bundle.
 *
 * @returns {Promise<typeof import('../../src/components/personalize/discovery/index.js')>}
 */
function loadEngine() {
  if (!enginePromise) {
    enginePromise = import('../../src/components/personalize/discovery/index.js');
  }
  return enginePromise;
}

/**
 * The engine's SSRF guard (`validateUrl` lives on urlSafety.js, not on the
 * job API). Re-validated here before enqueueing — defence in depth.
 *
 * @returns {Promise<typeof import('../../src/components/personalize/discovery/urlSafety.js')>}
 */
function loadUrlSafety() {
  return import('../../src/components/personalize/discovery/urlSafety.js');
}

/* ---------- Durable job records (best-effort Supabase mirror) ───────────── */

/**
 * Upsert the last known state of a job. Failures are logged and swallowed:
 * the in-process engine store remains the happy path, durability is a
 * fallback, never a blocker.
 */
async function persistJobRecord(record) {
  const supabase = getSupabase();
  if (!supabase) return;
  try {
    const { error } = await supabase
      .from('personalization_discovery_jobs')
      .upsert(
        {
          id: record.jobId,
          user_id: record.userId ?? null,
          url: record.url,
          status: record.status,
          found: record.found ?? null,
          errors: record.errors ?? [],
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'id' },
      );
    if (error) console.error('[personalization-discovery] durable upsert failed:', error.message);
  } catch (err) {
    console.error('[personalization-discovery] durable upsert threw:', err.message);
  }
}

/** Load a durable job row (null when Supabase is not configured or absent). */
async function loadDurableJob(jobId) {
  const supabase = getSupabase();
  if (!supabase) return null;
  try {
    const { data, error } = await supabase
      .from('personalization_discovery_jobs')
      .select('id, user_id, url, status, found, errors')
      .eq('id', jobId)
      .maybeSingle();
    if (error) {
      console.error('[personalization-discovery] durable read failed:', error.message);
      return null;
    }
    return data || null;
  } catch (err) {
    console.error('[personalization-discovery] durable read threw:', err.message);
    return null;
  }
}

/* ---------- In-process watcher (mirrors engine state while warm) ────────── */

/** @type {Map<string, ReturnType<typeof setInterval>>} */
const watchers = new Map();

/**
 * While this instance stays warm, mirror the engine's job state into the
 * durable row when the job reaches a terminal state. On a cold instance
 * this simply never runs — the durable row then stays at its last write and
 * a GET reports `unknown` for non-terminal jobs (documented limit).
 */
function watchJob(jobId, url, userId, engine) {
  if (watchers.has(jobId)) return;
  const startedAt = Date.now();
  const timer = setInterval(async () => {
    let status;
    try {
      status = engine.getJobStatus(jobId);
    } catch {
      stopWatching(jobId);
      return;
    }
    if (!ENGINE_TERMINAL_STATUSES.has(status.status)) {
      if (Date.now() - startedAt > WATCH_MAX_MS) stopWatching(jobId);
      return;
    }
    stopWatching(jobId);
    await persistJobRecord({
      jobId,
      url,
      userId,
      status: toApiStatus(status.status),
      found: status.found ?? null,
      errors: status.errors ?? [],
    });
  }, WATCH_INTERVAL_MS);
  // Never hold the invocation's event loop open just for the watcher.
  if (typeof timer.unref === 'function') timer.unref();
  watchers.set(jobId, timer);
}

function stopWatching(jobId) {
  const timer = watchers.get(jobId);
  if (timer) {
    clearInterval(timer);
    watchers.delete(jobId);
  }
}

/* ---------- Helpers ─────────────────────────────────────────────────────── */

/** Case-insensitive header lookup (Netlify may lowercase header keys). */
function getHeader(headers, name) {
  if (!headers) return undefined;
  const key = Object.keys(headers).find((k) => k.toLowerCase() === name.toLowerCase());
  return key ? headers[key] : undefined;
}

function corsHeaders() {
  return {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': process.env.ALLOWED_ORIGINS || '*',
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type, X-Discovery-Secret',
    'Access-Control-Max-Age': '86400',
  };
}

function jsonResponse(statusCode, body) {
  return { statusCode, headers: corsHeaders(), body: JSON.stringify(body) };
}

/** Engine status → API status ('completed' is reported as 'done'). */
function toApiStatus(engineStatus) {
  return engineStatus === 'completed' ? 'done' : engineStatus;
}

/** Flatten the engine's `found` buckets into a tagged asset list. */
function flattenAssets(found) {
  const out = [];
  for (const category of DISCOVERY_CATEGORIES) {
    const urls = found && Array.isArray(found[category.key]) ? found[category.key] : [];
    for (const url of urls) {
      if (typeof url === 'string') out.push({ url, category: category.key, role: category.role });
    }
  }
  return out;
}

/** Length-safe, timing-safe shared-secret comparison ("" never matches). */
function secretsMatch(provided, expected) {
  if (typeof provided !== 'string' || typeof expected !== 'string') return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length === 0 || a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

/**
 * Verify the caller. Returns `{ userId }` for Supabase-session callers,
 * `{ userId: null }` for the internal shared-secret path, or `{ error }`.
 * Fails closed: any doubt rejects the request.
 */
async function verifyAuth(event) {
  const expectedSecret = process.env.PERSONALIZATION_DISCOVERY_SECRET;
  const providedSecret = getHeader(event.headers, 'x-discovery-secret');
  if (expectedSecret && secretsMatch(providedSecret, expectedSecret)) {
    return { userId: null };
  }

  const authHeader = getHeader(event.headers, 'authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { error: 'Missing or invalid authorization header' };
  }
  const token = authHeader.slice('Bearer '.length).trim();
  if (!token) return { error: 'Missing or invalid authorization header' };

  const supabase = getSupabase();
  if (!supabase) return { error: 'Auth backend not configured' };
  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) return { error: 'Invalid or expired token' };
    return { userId: user.id };
  } catch {
    return { error: 'Token verification failed' };
  }
}

function parseJsonBody(event) {
  if (!event.body) return {};
  const raw = typeof event.body === 'string' ? event.body : event.body.toString();
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/** Build the GET response body for a job in any known state. */
function jobResponse(jobId, status, found, errors) {
  return {
    jobId,
    status,
    found: found ?? null,
    errors: Array.isArray(errors) ? errors : [],
    assets: flattenAssets(found),
  };
}

/* ---------- Route handlers ──────────────────────────────────────────────── */

async function handleStart(event, auth) {
  const body = parseJsonBody(event);
  if (body === null) return jsonResponse(400, { error: 'Invalid JSON body' });

  const url = typeof body.url === 'string' ? body.url.trim() : '';
  if (!url) return jsonResponse(400, { error: 'url is required' });

  // Defence in depth BEFORE the engine sees the URL: length + scheme gates
  // are cheap and do not need DNS.
  if (url.length > MAX_URL_LENGTH) {
    return jsonResponse(400, { error: 'UNSAFE_URL', reason: `URL exceeds ${MAX_URL_LENGTH} chars` });
  }
  if (!/^https?:\/\//i.test(url)) {
    return jsonResponse(400, {
      error: 'UNSAFE_URL',
      reason: 'URL must start with http:// or https:// — only public web pages can be discovered',
    });
  }

  // Full engine re-validation (private IPs, blocked hostnames, DNS rebind
  // resolution, userinfo, social domains). The reason is surfaced verbatim.
  let validation;
  try {
    const urlSafety = await loadUrlSafety();
    validation = await urlSafety.validateUrl(url);
  } catch (err) {
    console.error('[personalization-discovery] validateUrl failed:', err.message);
    return jsonResponse(500, { error: 'URL validation failed on the server' });
  }
  if (!validation || !validation.safe) {
    return jsonResponse(400, {
      error: 'UNSAFE_URL',
      reason: (validation && validation.reason) || 'URL rejected by the safety check',
    });
  }

  const engine = await loadEngine();
  const submitted = engine.discoverAssets(url);
  if (submitted && submitted.error) {
    const statusCode = submitted.error === 'JOB_LIMIT_REACHED' ? 429 : 400;
    return jsonResponse(statusCode, { error: submitted.error, message: submitted.message });
  }

  const jobId = submitted.jobId;
  await persistJobRecord({
    jobId,
    userId: auth.userId,
    url,
    status: 'pending',
    found: null,
    errors: [],
  });
  watchJob(jobId, url, auth.userId, engine);

  return jsonResponse(200, { jobId, status: 'pending' });
}

async function handleStatus(event, auth) {
  const jobId = event.queryStringParameters?.jobId;
  if (!jobId) return jsonResponse(400, { error: 'jobId is required' });

  const engine = await loadEngine();
  let status;
  try {
    status = engine.getJobStatus(jobId);
  } catch (err) {
    console.error('[personalization-discovery] getJobStatus failed:', err.message);
    return jsonResponse(500, { error: 'Job status unavailable' });
  }

  if (status.status !== 'not_found') {
    return jsonResponse(200, jobResponse(jobId, toApiStatus(status.status), status.found, status.errors));
  }

  // Engine no longer knows this job (GC'd after its 60s TTL, or a different
  // instance). Fall back to the durable record.
  const row = await loadDurableJob(jobId);
  if (!row) {
    return jsonResponse(404, { error: 'Unknown jobId', jobId, status: 'not_found' });
  }
  if (row.user_id && auth.userId && row.user_id !== auth.userId) {
    // Never leak another caller's job state.
    return jsonResponse(404, { error: 'Unknown jobId', jobId, status: 'not_found' });
  }
  if (!TERMINAL_STATUSES.has(row.status)) {
    // Durable row is pending/running but the engine lost the job: the
    // instance rotated. The client re-submits.
    return jsonResponse(200, jobResponse(jobId, 'unknown', null, []));
  }
  return jsonResponse(200, jobResponse(jobId, row.status, row.found, row.errors));
}

async function handleCancel(event, auth, jobId) {
  if (!jobId) return jsonResponse(400, { error: 'jobId is required' });

  const engine = await loadEngine();
  const row = await loadDurableJob(jobId);
  if (row && row.user_id && auth.userId && row.user_id !== auth.userId) {
    // Never leak another caller's job state.
    return jsonResponse(404, { error: 'Unknown jobId', jobId, status: 'not_found' });
  }

  let cancelled;
  try {
    cancelled = engine.cancelJob(jobId) === true;
  } catch (err) {
    console.error('[personalization-discovery] cancelJob failed:', err.message);
    return jsonResponse(500, { error: 'Cancel failed' });
  }
  if (!cancelled) {
    // Either unknown to this instance, or already terminal. Answer from the
    // durable record when we have one so a finished job reports its outcome.
    if (row && TERMINAL_STATUSES.has(row.status) && row.status !== 'cancelled') {
      return jsonResponse(200, jobResponse(jobId, row.status, row.found, row.errors));
    }
    return jsonResponse(404, { error: 'Unknown or already finished job', jobId, status: 'not_found' });
  }

  stopWatching(jobId);
  await persistJobRecord({
    jobId,
    userId: auth.userId ?? row?.user_id ?? null,
    url: row?.url || '',
    status: 'cancelled',
    found: null,
    errors: [],
  });
  return jsonResponse(200, { jobId, status: 'cancelled' });
}

/* ---------- Handler ─────────────────────────────────────────────────────── */

export async function handler(event) {
  const headers = corsHeaders();

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  const auth = await verifyAuth(event);
  if (auth.error) {
    return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorized', reason: auth.error }) };
  }

  try {
    if (event.httpMethod === 'GET') {
      return await handleStatus(event, auth);
    }

    if (event.httpMethod === 'DELETE') {
      const body = parseJsonBody(event);
      const jobId = event.queryStringParameters?.jobId
        || (body && typeof body === 'object' ? body.jobId : undefined);
      return await handleCancel(event, auth, jobId);
    }

    if (event.httpMethod === 'POST') {
      const body = parseJsonBody(event);
      if (body === null) return jsonResponse(400, { error: 'Invalid JSON body' });
      if (body && body.action === 'cancel') {
        return await handleCancel(event, auth, body.jobId);
      }
      return await handleStart(event, auth);
    }

    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  } catch (err) {
    // Log the real error for operators; never leak internals to the client.
    console.error('[personalization-discovery] handler error:', err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'An internal error occurred. Please try again later.' }) };
  }
}

export default handler;
