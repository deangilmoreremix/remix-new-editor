// netlify/functions/supabase-token.js
//
// Verified-identity token exchange for the browser Supabase client.
//
// The app talks to Supabase with the public anon key, so the browser cannot
// present a trusted identity to Postgres RLS on its own. This endpoint
// exchanges a *verified* Clerk session JWT for a short-lived
// Supabase-compatible JWT whose claims carry that verified identity:
//
//   { sub: <clerk user id>, workspace_id: <clerk org id | 'personal'>, role: 'authenticated' }
//
// The client sends the minted token as `Authorization: Bearer <token>` on
// every Supabase request, and the RLS policies (see
// supabase/migrations/*_tighten_identity_rls.sql) resolve the row owner from
// `auth.jwt() ->> 'sub'`. That claim is trustworthy because the database
// verifies the token signature with SUPABASE_JWT_SECRET and only this
// function (which holds the Clerk JWKS verification + the secret) can mint
// one — a spoofed `x-user-key` header can no longer forge it.
//
// Callers without a Clerk session (anonymous local usage) skip this endpoint
// entirely and keep the header-based 'anonymous' fallback identity.
//
// Required environment (Netlify):
//   SUPABASE_JWT_SECRET                                  — Supabase project JWT secret (server-only, never exposed to the browser)
//   CLERK_PUBLISHABLE_KEY / CLERK_SECRET_KEY / CLERK_JWKS_URL — used by netlify/functions/_shared/clerkAuth.js to locate the Clerk JWKS

import { SignJWT } from 'jose';
import { validateSupabaseTokenClaims, withClerkAuth } from './_shared/clerkAuth.js';

const TOKEN_TTL_SECONDS = 60 * 60; // 1 hour — refreshed client-side well before expiry

/**
 * HMAC key material for SUPABASE_JWT_SECRET.
 *
 * `TextEncoder` is not guaranteed to belong to the same realm as the
 * `Uint8Array` global this module resolves (jsdom test environments), and
 * jose's HS256 path validates `key instanceof Uint8Array` — a cross-realm
 * instance is rejected even though it *is* a Uint8Array. Re-viewing the bytes
 * through the module's own `Uint8Array` constructor keeps the key valid under
 * Node (Netlify) and in the test environment alike.
 */
function secretBytes(secret) {
  const encoded = new TextEncoder().encode(secret);
  return new Uint8Array(encoded.buffer, encoded.byteOffset, encoded.byteLength);
}

function jsonResponse(statusCode, body) {
  return { statusCode, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
}

/**
 * Mint the Supabase-compatible JWT for the verified Clerk identity
 * attached to the request by withClerkAuth.
 */
async function issueSupabaseToken(event) {
  const auth = event?.auth;
  const userId = auth?.userId;
  const workspaceId = auth?.workspaceId || 'personal';
  if (!userId) {
    return jsonResponse(401, { error: 'Invalid or expired session' });
  }

  // Shared claim contract (verified clerkAuth.js) — fail closed on a bad one.
  const claims = validateSupabaseTokenClaims({ sub: userId, workspace_id: workspaceId });
  if (!claims.ok) {
    console.error('[supabase-token] unusable identity claims:', claims.error);
    return jsonResponse(401, { error: 'Invalid or expired session' });
  }

  const secret = process.env.SUPABASE_JWT_SECRET;
  if (!secret) {
    // Fail closed: without the signing secret there is no verified-identity
    // path, and the caller must keep using the anonymous-header fallback.
    console.error('[supabase-token] SUPABASE_JWT_SECRET is not configured');
    return jsonResponse(503, { error: 'Identity token exchange is not configured' });
  }

  const expiresIn = TOKEN_TTL_SECONDS;
  const token = await new SignJWT({
    workspace_id: workspaceId,
    role: 'authenticated',
  })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setSubject(userId)
    .setAudience('authenticated')
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + expiresIn)
    .sign(secretBytes(secret));

  return jsonResponse(200, {
    token,
    token_type: 'Bearer',
    expires_in: expiresIn,
    sub: userId,
    workspace_id: workspaceId,
  });
}

// withClerkAuth handles OPTIONS preflight and 401s for a missing/invalid
// Clerk session before the token is minted.
export const handler = withClerkAuth(issueSupabaseToken);
