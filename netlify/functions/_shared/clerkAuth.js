// netlify/functions/_shared/clerkAuth.js
//
// Server-side Clerk session verification for Netlify functions.
//
// Verifies the Clerk session JWT from the `Authorization: Bearer <token>`
// header against the Clerk JWKS of the instance derived from the environment
// (CLERK_SECRET_KEY / CLERK_PUBLISHABLE_KEY / VITE_CLERK_PUBLISHABLE_KEY).
//
// The Clerk JWKS endpoint is verified with `jose` (already a transitive
// dependency via the Supabase SDK — no new dependency added). The
// @clerk/backend package is intentionally NOT used: it is not a direct
// dependency of this app.
//
// Exports:
//   verifyClerkToken(token) -> { userId, workspaceId, claims } | null
//   withClerkAuth(handler)  -> (event, context) => netlify response
//                              (401 JSON on missing/invalid token; attaches
//                              `auth` to the request event)
//   corsHeaders() / handleCors(event) — house CORS pattern (matches
//                              intelligence-api.js)

import { createRemoteJWKSet, jwtVerify } from 'jose';

// ─── Instance / JWKS resolution ──────────────────────────────────────────────

function decodeClerkKey(key, prefix) {
  if (!key || !key.startsWith(prefix)) return null;
  const b64 = key.slice(prefix.length);
  try {
    // Clerk keys are base64 of "<frontend-api-domain>" (publishable) or
    // "<frontend-api-domain>$<secret>" (secret). The domain is the first
    // segment either way.
    const decoded = Buffer.from(b64, 'base64').toString('utf8');
    return decoded.split('$')[0] || null;
  } catch {
    return null;
  }
}

function hostFromClerkKey(key) {
  if (!key) return null;
  // pk_live_/pk_test_/sk_live_/sk_test_ prefixes are all supported.
  const match = key.match(/^(?:pk|sk)_([a-z]+)_/);
  if (!match) return null;
  return decodeClerkKey(key, `${key.slice(0, 3)}${match[1]}_`);
}

/**
 * Resolve the Clerk JWKS URL for this deployment. Order:
 *   1. CLERK_JWKS_URL (explicit override)
 *   2. CLERK_ISSUER (issuer base; appends /.well-known/jwks.json)
 *   3. Frontend API host encoded in CLERK_PUBLISHABLE_KEY / VITE_CLERK_PUBLISHABLE_KEY
 *   4. Frontend API host encoded in CLERK_SECRET_KEY
 */
export function resolveJwksUrl() {
  const env = process.env || {};

  if (env.CLERK_JWKS_URL) return env.CLERK_JWKS_URL;

  if (env.CLERK_ISSUER) {
    return `${env.CLERK_ISSUER.replace(/\/+$/, '')}/.well-known/jwks.json`;
  }

  const publishable = env.CLERK_PUBLISHABLE_KEY || env.VITE_CLERK_PUBLISHABLE_KEY;
  const secret = env.CLERK_SECRET_KEY;

  for (const key of [publishable, secret]) {
    const host = hostFromClerkKey(key);
    if (host) return `https://${host}/.well-known/jwks.json`;
  }

  return null;
}

let jwksCache = null;
function getJwks() {
  const url = resolveJwksUrl();
  if (!url) return null;
  if (!jwksCache) jwksCache = createRemoteJWKSet(new URL(url));
  return jwksCache;
}

// ─── Token verification ──────────────────────────────────────────────────────

/**
 * Verify a Clerk session JWT.
 * @returns {Promise<{userId: string, workspaceId: string, claims: object}|null>}
 *   null when the token is missing/invalid or the instance is not configured.
 *   Never logs the token itself.
 */
export async function verifyClerkToken(token) {
  if (!token || typeof token !== 'string') return null;

  const env = process.env || {};
  const jwks = getJwks();
  if (!jwks) {
    console.error('[clerkAuth] Clerk instance not configured (missing CLERK_PUBLISHABLE_KEY / CLERK_SECRET_KEY / CLERK_JWKS_URL)');
    return null;
  }

  // Issuer check only when we know the instance frontend API origin.
  let issuer = null;
  if (env.CLERK_ISSUER) issuer = env.CLERK_ISSUER;
  else {
    const jwksUrl = resolveJwksUrl();
    if (jwksUrl) issuer = jwksUrl.replace(/\/\.well-known\/jwks\.json$/, '');
  }

  try {
    const verifyOptions = issuer ? { issuer } : {};
    const { payload } = await jwtVerify(token, jwks, verifyOptions);
    const claims = payload || {};
    const userId = claims.sub;
    if (!userId) {
      console.error('[clerkAuth] Clerk token has no subject claim');
      return null;
    }
    // Workspace claim: the active Clerk organization when present, else the
    // caller's personal workspace.
    const workspaceId = claims.org_id || claims.workspace_id || 'personal';
    return { userId, workspaceId, claims };
  } catch (err) {
    console.error('[clerkAuth] Clerk token verification failed:', err?.message || err);
    return null;
  }
}

// ─── Supabase access-token claim contract ────────────────────────────────────

/**
 * Validate the claims of a Supabase access token (the payload
 * netlify/functions/supabase-token.js mints).
 *
 * The contract shared by the token function and the browser client:
 *   sub          — verified Clerk user id (required, non-empty)
 *   workspace_id — Clerk org id or 'personal' (defaults to 'personal')
 *   exp          — expiry in seconds since the epoch (optional)
 *
 * @returns {{ok: true, sub: string, workspaceId: string, expiresAt: number|null}
 *          | {ok: false, error: string}}
 */
export function validateSupabaseTokenClaims(claims) {
  if (!claims || typeof claims !== 'object') {
    return { ok: false, error: 'claims required' };
  }
  const sub = claims.sub;
  if (typeof sub !== 'string' || !sub) {
    return { ok: false, error: 'missing subject claim' };
  }
  const workspaceId = typeof claims.workspace_id === 'string' && claims.workspace_id
    ? claims.workspace_id
    : 'personal';
  let expiresAt = null;
  if (claims.exp !== undefined) {
    const exp = Number(claims.exp);
    if (!Number.isFinite(exp) || exp <= 0) {
      return { ok: false, error: 'invalid expiry claim' };
    }
    expiresAt = exp * 1000;
  }
  return { ok: true, sub, workspaceId, expiresAt };
}

// ─── CORS (house pattern — see netlify/functions/intelligence-api.js) ────────

export function corsHeaders() {
  return {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': process.env.ALLOWED_ORIGINS || '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type, X-User-Key',
    'Access-Control-Max-Age': '86400',
  };
}

/**
 * Handle preflight + CORS consistently with the other Netlify functions.
 * Returns a finished response for OPTIONS requests, otherwise null.
 */
export function handleCors(event) {
  if (event?.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders(), body: '' };
  }
  return null;
}

// ─── Auth wrapper ────────────────────────────────────────────────────────────

function getHeader(headers, name) {
  if (!headers) return undefined;
  const key = Object.keys(headers).find((k) => k.toLowerCase() === name.toLowerCase());
  return key ? headers[key] : undefined;
}

function extractBearerToken(event) {
  const authHeader = getHeader(event?.headers, 'authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  return authHeader.slice('Bearer '.length).trim();
}

function jsonResponse(statusCode, body) {
  return { statusCode, headers: corsHeaders(), body: JSON.stringify(body) };
}

/**
 * Wrap a Netlify handler with Clerk session authentication.
 *
 * - Responds 200 to OPTIONS preflight (handleCors pattern).
 * - Responds 401 JSON when the Authorization: Bearer token is missing or
 *   does not verify against the Clerk JWKS.
 * - On success attaches `auth` ({ userId, workspaceId, claims }) to the
 *   request event before invoking the wrapped handler, and merges the
 *   house CORS headers into its response.
 */
export function withClerkAuth(handler) {
  return async (event, context) => {
    const preflight = handleCors(event);
    if (preflight) return preflight;

    const token = extractBearerToken(event);
    if (!token) {
      return jsonResponse(401, { error: 'Missing or invalid authorization header' });
    }

    const auth = await verifyClerkToken(token);
    if (!auth) {
      return jsonResponse(401, { error: 'Invalid or expired session' });
    }

    event.auth = auth;

    const response = await handler(event, context);
    return {
      ...response,
      headers: { ...corsHeaders(), ...(response?.headers || {}) },
    };
  };
}
