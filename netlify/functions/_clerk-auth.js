// netlify/functions/_clerk-auth.js
//
// Clerk authentication + SmartVideo entitlement gate for Netlify functions.
// Node ESM (node:crypto + global fetch only — no new dependencies).
//
// Enforcement contract (identical semantics in every gated function):
//   1. The request MUST carry a Clerk session token
//      (`Authorization: Bearer <token from session.getToken()>`).
//      Missing/invalid/expired -> HTTP 401 { error: 'AUTH_REQUIRED' }.
//   2. The signed-in user MUST be entitled to SmartVideo AI:
//        - user.publicMetadata.legacy_access === true (legacy purchases), OR
//        - the Clerk Billing feature 'smartvideo_full_access' present in the
//          verified session-token claims.
//      Authenticated but unpaid -> HTTP 403
//      { error: 'PAYMENT_REQUIRED', upgradeRequired: true }.
//   3. Deny BEFORE any provider call or server-key use.
//
// Env vars read:
//   CLERK_ISSUER_URL          (preferred) e.g. https://<app>.clerk.accounts.dev
//   CLERK_PUBLISHABLE_KEY     (fallback)  pk_test_/pk_live_ ... -> issuer decoded
//   VITE_CLERK_PUBLISHABLE_KEY (last resort, if deployed to the edge env)
//   CLERK_SECRET_KEY          required to resolve publicMetadata via the Clerk
//                             Backend API (unless the billing feature claim is
//                             already present in the token).
//
// Usage:
//   const denial = await requireClerkEntitlement(event, headers);
//   if (denial) return denial;   // rendered 401/403 response
//   // ...proceed: provider calls, server keys, etc.

import crypto from 'node:crypto';

/** Clerk Billing feature slug that grants full SmartVideo access. */
export const PAID_FEATURE = 'smartvideo_full_access';

const CLERK_API_BASE = 'https://api.clerk.com/v1';
const JWKS_TTL_MS = 10 * 60 * 1000; // Clerk rotates rarely; cache briefly.
const CLOCK_SKEW_SEC = 60;

function readEnv(name) {
  return process.env[name] || undefined;
}

function base64UrlDecode(input) {
  return Buffer.from(input.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
}

function decodeJwtPart(part) {
  try {
    return JSON.parse(base64UrlDecode(part).toString('utf8'));
  } catch {
    return null;
  }
}

/** Bearer token from the (possibly lowercased) Netlify event headers. */
export function extractBearerToken(headers) {
  if (!headers) return null;
  const key = Object.keys(headers).find((k) => k.toLowerCase() === 'authorization');
  const header = key ? headers[key] : undefined;
  if (!header || typeof header !== 'string') return null;
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  const token = match ? match[1].trim() : '';
  return token || null;
}

/** Decode the Clerk frontend API host out of a pk_test_/pk_live_ key. */
function issuerFromPublishableKey(pk) {
  try {
    const decoded = base64UrlDecode(pk.replace(/^pk_(test|live)_/, '')).toString('utf8');
    const host = decoded.replace(/\$$/, '').trim();
    if (!host) return null;
    return host.startsWith('http') ? host : `https://${host}`;
  } catch {
    return null;
  }
}

/**
 * Resolve the Clerk issuer (JWT `iss` + JWKS host).
 * Order: CLERK_ISSUER_URL -> CLERK_PUBLISHABLE_KEY -> VITE_CLERK_PUBLISHABLE_KEY.
 * Returns null when unconfigured — callers fail closed in that case.
 */
export function getClerkIssuer() {
  const configured = readEnv('CLERK_ISSUER_URL');
  if (configured) return configured.replace(/\/+$/, '');
  const publishableKey =
    readEnv('CLERK_PUBLISHABLE_KEY') || readEnv('VITE_CLERK_PUBLISHABLE_KEY');
  if (publishableKey) return issuerFromPublishableKey(publishableKey);
  return null;
}

// Keyed by issuer so a rotated/failed instance never poisons another.
const jwksCache = new Map();

async function fetchJwks(issuer) {
  const now = Date.now();
  const cached = jwksCache.get(issuer);
  if (cached && cached.expiresAt > now) return cached.keys;
  const res = await fetch(`${issuer}/.well-known/jwks.json`);
  if (!res.ok) throw new Error(`JWKS fetch failed with HTTP ${res.status}`);
  const body = await res.json();
  const keys = Array.isArray(body.keys) ? body.keys : [];
  if (keys.length === 0) throw new Error('JWKS response contained no keys');
  jwksCache.set(issuer, { keys, expiresAt: now + JWKS_TTL_MS });
  return keys;
}

function featureEntryMatches(entry) {
  if (typeof entry === 'string') return entry === PAID_FEATURE;
  if (entry && typeof entry === 'object' && typeof entry.slug === 'string') {
    return entry.slug === PAID_FEATURE;
  }
  return false;
}

// Clerk Billing surfaces the user's enabled features on the session token
// (`features` claim) as an array of slugs or { slug } objects.
function hasFeatureClaim(claims) {
  const features = claims.features;
  if (Array.isArray(features)) return features.some(featureEntryMatches);
  return featureEntryMatches(features);
}

function emailFromClaims(claims) {
  if (typeof claims.email === 'string') return claims.email;
  if (typeof claims.email_address === 'string') return claims.email_address;
  return null;
}

/**
 * Resolve legacy_access via the Clerk Backend API user object. Fails closed
 * ({ legacyAccess: false }) when CLERK_SECRET_KEY is missing or the lookup
 * errors. The user's primary email is returned when available.
 */
async function fetchLegacyAccess(userId) {
  const secret = readEnv('CLERK_SECRET_KEY');
  if (!secret) {
    console.error(
      '[clerk-auth] CLERK_SECRET_KEY is not set; cannot resolve publicMetadata.legacy_access — denying (fail closed).'
    );
    return { legacyAccess: false, email: null };
  }
  try {
    const res = await fetch(`${CLERK_API_BASE}/users/${encodeURIComponent(userId)}`, {
      headers: { Authorization: `Bearer ${secret}` },
    });
    if (!res.ok) {
      console.error(`[clerk-auth] Clerk user lookup failed: HTTP ${res.status} — denying (fail closed).`);
      return { legacyAccess: false, email: null };
    }
    const user = await res.json();
    const legacyAccess = user?.public_metadata?.legacy_access === true;
    const primaryEmail =
      user?.email_addresses?.find((e) => e.id === user.primary_email_address_id)
        ?.email_address ?? null;
    return { legacyAccess, email: primaryEmail };
  } catch (err) {
    console.error('[clerk-auth] Clerk user lookup error:', err);
    return { legacyAccess: false, email: null };
  }
}

/**
 * Verify the Clerk session token and resolve the entitlement state.
 * Returns null when the request is unauthenticated (no token, malformed,
 * wrong algorithm, bad/expired signature, issuer mismatch, or no issuer
 * configured). Never throws.
 *
 * @param {object} event Netlify function event (headers are read from it).
 * @returns {Promise<{userId: string, email: string|null, legacyAccess: boolean, featureFullAccess: boolean}|null>}
 */
export async function verifyClerkAuth(event) {
  const token = extractBearerToken(event?.headers);
  if (!token) return null;

  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [rawHeader, rawPayload, rawSignature] = parts;

  const header = decodeJwtPart(rawHeader);
  const claims = decodeJwtPart(rawPayload);
  if (!header || !claims || typeof claims.sub !== 'string') return null;
  if (header.alg !== 'RS256') {
    console.error('[clerk-auth] Unexpected JWT alg:', header.alg);
    return null;
  }

  const nowSec = Math.floor(Date.now() / 1000);
  if (typeof claims.exp === 'number' && claims.exp < nowSec - CLOCK_SKEW_SEC) return null;
  if (typeof claims.nbf === 'number' && claims.nbf > nowSec + CLOCK_SKEW_SEC) return null;

  const issuer = getClerkIssuer();
  if (!issuer) {
    console.error(
      '[clerk-auth] No Clerk issuer configured (set CLERK_ISSUER_URL or CLERK_PUBLISHABLE_KEY) — denying.'
    );
    return null;
  }
  if (typeof claims.iss === 'string' && claims.iss.replace(/\/+$/, '') !== issuer) {
    console.error('[clerk-auth] JWT issuer mismatch:', claims.iss);
    return null;
  }

  const featureFullAccess = hasFeatureClaim(claims);

  let signatureValid;
  try {
    const keys = await fetchJwks(issuer);
    const kid = typeof header.kid === 'string' ? header.kid : null;
    const jwk = keys.find((k) => k.kid === kid) || (kid ? undefined : keys[0]);
    if (!jwk) {
      console.error('[clerk-auth] No JWKS key matched token kid:', kid);
      return null;
    }
    const publicKey = crypto.createPublicKey({ key: jwk, format: 'jwk' });
    const signingInput = Buffer.from(`${rawHeader}.${rawPayload}`, 'utf8');
    signatureValid = crypto.verify(
      'sha256',
      signingInput,
      publicKey,
      base64UrlDecode(rawSignature)
    );
  } catch (err) {
    console.error('[clerk-auth] JWT verification error:', err);
    return null;
  }
  if (!signatureValid) {
    console.error('[clerk-auth] JWT signature verification failed');
    return null;
  }

  const userId = claims.sub;
  const email = emailFromClaims(claims);

  // Billing feature claim is authoritative and avoids the Backend API call.
  if (featureFullAccess) {
    return { userId, email, legacyAccess: false, featureFullAccess: true };
  }

  const legacyResult = await fetchLegacyAccess(userId);
  return {
    userId,
    email: email || legacyResult.email,
    legacyAccess: legacyResult.legacyAccess,
    featureFullAccess: false,
  };
}

function denialResponse(error, message, statusCode, extra, headers) {
  return {
    statusCode,
    headers: {
      ...(headers || {}),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ error, message, ...(extra || {}) }),
  };
}

/**
 * Auth-only gate (no entitlement check) for cheap endpoints such as stock
 * search. Returns a rendered 401 response for unauthenticated callers, or
 * null when the request carries a verified Clerk session token.
 */
export async function requireClerkAuth(event, headers) {
  const identity = await verifyClerkAuth(event);
  if (!identity) {
    return denialResponse(
      'AUTH_REQUIRED',
      'Authentication required. Sign in and try again.',
      401,
      undefined,
      headers
    );
  }
  return null;
}

/**
 * Entitlement gate for Netlify handlers.
 * Returns a rendered 401/403 response when the request must be denied, or
 * null when the caller is authenticated AND entitled (safe to proceed).
 */
export async function requireClerkEntitlement(event, headers) {
  const identity = await verifyClerkAuth(event);
  if (!identity) {
    return denialResponse(
      'AUTH_REQUIRED',
      'Authentication required. Sign in and try again.',
      401,
      undefined,
      headers
    );
  }
  if (!identity.legacyAccess && !identity.featureFullAccess) {
    return denialResponse(
      'PAYMENT_REQUIRED',
      'SmartVideo AI purchase required.',
      403,
      { upgradeRequired: true },
      headers
    );
  }
  return null;
}
