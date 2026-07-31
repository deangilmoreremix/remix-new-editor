/**
 * auth.js — Supabase JWT verification middleware for the Express backend.
 *
 * Verifies a Bearer token from the `Authorization` header by calling
 * `${SUPABASE_URL}/auth/v1/user` with the token. The endpoint returns the
 * user record (id, email, ...) if the JWT is valid.
 *
 * Environment variables:
 *   - SUPABASE_URL         (required)  e.g. https://xxxx.supabase.co
 *   - SUPABASE_ANON_KEY    (recommended) sent as the `apikey` header
 *   - SUPABASE_SERVICE_KEY (optional)   used instead of the anon key when
 *                                       available; lets the server call
 *                                       the auth endpoint from a non-browser
 *                                       context (the JWT still drives auth).
 *
 * Exports:
 *   - auth          : strict middleware — rejects with 401 if no/invalid token
 *   - optionalAuth  : attaches req.user if a valid token is present, otherwise
 *                     calls next() so the route can decide
 *
 * Both middlewares add a `req.requestId` (UUID) for correlation logging
 * and include it in 4xx/5xx responses.
 */

import crypto from 'node:crypto';

const SUPABASE_URL = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || '';
const AUTH_VERIFY_TIMEOUT_MS = Number(process.env.AUTH_VERIFY_TIMEOUT_MS || 5000);

// Pick the strongest key available for the outbound call.
const API_KEY = SUPABASE_SERVICE_KEY || SUPABASE_ANON_KEY;

function log(level, event, fields = {}) {
  const line = JSON.stringify({ ts: new Date().toISOString(), level, event, ...fields });
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
}

function extractToken(req) {
  const header = req.headers.authorization || req.headers.Authorization || '';
  if (!header.startsWith('Bearer ')) return null;
  const token = header.slice(7).trim();
  return token || null;
}

async function verifySupabaseToken(token) {
  if (!SUPABASE_URL) {
    return { ok: false, status: 500, reason: 'SUPABASE_URL not configured' };
  }
  if (!API_KEY) {
    return { ok: false, status: 500, reason: 'SUPABASE_ANON_KEY not configured' };
  }
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), AUTH_VERIFY_TIMEOUT_MS);
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: API_KEY,
      },
      signal: ctrl.signal,
    });
    if (!res.ok) {
      return { ok: false, status: res.status, reason: `Supabase auth returned ${res.status}` };
    }
    const user = await res.json();
    if (!user || !user.id) {
      return { ok: false, status: 502, reason: 'Supabase auth returned no user' };
    }
    return { ok: true, user: { id: user.id, email: user.email || null } };
  } catch (err) {
    const reason = err.name === 'AbortError'
      ? `Supabase auth timed out after ${AUTH_VERIFY_TIMEOUT_MS}ms`
      : `Supabase auth call failed: ${err.message}`;
    return { ok: false, status: 502, reason };
  } finally {
    clearTimeout(timer);
  }
}

function assignRequestId(req, res) {
  const requestId = crypto.randomUUID();
  req.requestId = requestId;
  res.setHeader('X-Request-Id', requestId);
  return requestId;
}

export async function auth(req, res, next) {
  const requestId = assignRequestId(req, res);
  const token = extractToken(req);
  if (!token) {
    log('warn', 'auth.rejected', { requestId, reason: 'missing_or_malformed_authorization_header' });
    return res.status(401).json({ error: 'Unauthorized', requestId });
  }
  const result = await verifySupabaseToken(token);
  if (!result.ok) {
    log('warn', 'auth.rejected', { requestId, reason: result.reason, status: result.status });
    // Token was present but invalid/expired/unverifiable — still 401 to the client.
    return res.status(401).json({ error: 'Unauthorized', requestId });
  }
  req.user = result.user;
  log('info', 'auth.verified', { requestId, userId: result.user.id });
  next();
}

export async function optionalAuth(req, _res, next) {
  const requestId = assignRequestId(req, _res);
  const token = extractToken(req);
  if (!token) {
    log('info', 'auth.skipped', { requestId, reason: 'no_token' });
    return next();
  }
  const result = await verifySupabaseToken(token);
  if (!result.ok) {
    log('warn', 'auth.rejected', { requestId, reason: result.reason, status: result.status });
    return next();
  }
  req.user = result.user;
  log('info', 'auth.verified', { requestId, userId: result.user.id });
  next();
}

export default auth;
