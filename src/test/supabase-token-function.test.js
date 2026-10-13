// Token exchange endpoint (blocker A step 1).
//
// netlify/functions/supabase-token.js must:
//   - reject every request without a valid Clerk session (401 / OPTIONS 200),
//   - otherwise return a Supabase-compatible JWT that is signed with
//     SUPABASE_JWT_SECRET (HS256) and whose claims carry the VERIFIED Clerk
//     identity: sub = Clerk user id, workspace_id = org id or 'personal'.
//
// The Clerk JWKS is served by a local harness, so the verification is real
// (no mocks of the auth path) and the JWT signature is re-verified with jose
// to prove it is minted with the configured secret.

import { describe, test, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import { jwtVerify, SignJWT } from 'jose';
import { createClerkJwksHarness } from './helpers/clerkJwksHarness.js';

const JWT_SECRET = 'test-only-supabase-jwt-secret';
let harness;

function decodeToken(token) {
  const payload = token.split('.')[1];
  return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
}

/**
 * HS256 key material in this module's realm (see the matching helper in
 * netlify/functions/supabase-token.js — jose rejects a cross-realm
 * Uint8Array under jsdom).
 */
function secretKey() {
  const encoded = new TextEncoder().encode(JWT_SECRET);
  return new Uint8Array(encoded.buffer, encoded.byteOffset, encoded.byteLength);
}

beforeAll(async () => {
  harness = await createClerkJwksHarness();
  process.env.SUPABASE_JWT_SECRET = JWT_SECRET;
  harness.start();
});

afterAll(async () => {
  delete process.env.SUPABASE_JWT_SECRET;
  await harness.stop();
});

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('supabase-token', () => {
  test('answers OPTIONS preflight without a Clerk session', async () => {
    const { handler } = await import('../../netlify/functions/supabase-token.js');
    const response = await handler({ httpMethod: 'OPTIONS', headers: {} });
    expect(response.statusCode).toBe(200);
  });

  test('401s requests without a Bearer token', async () => {
    const { handler } = await import('../../netlify/functions/supabase-token.js');
    const response = await handler({ httpMethod: 'GET', headers: {} });
    expect(response.statusCode).toBe(401);
    expect(JSON.parse(response.body).error).toMatch(/authorization/i);
  });

  test('401s a tampered Clerk token (no token can be minted from it)', async () => {
    const { handler } = await import('../../netlify/functions/supabase-token.js');
    const token = await harness.mintToken({ subject: 'user_2xKd9Qm4' });
    const [header, payload, signature] = token.split('.');
    const claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    claims.sub = 'user_attacker';
    const tampered = Buffer.from(JSON.stringify(claims)).toString('base64url');

    const response = await handler({
      httpMethod: 'GET',
      headers: { Authorization: `Bearer ${header}.${tampered}.${signature}` },
    });
    expect(response.statusCode).toBe(401);
  });

  test('mints a Supabase JWT whose sub is the verified Clerk user id', async () => {
    const { handler } = await import('../../netlify/functions/supabase-token.js');
    const token = await harness.mintToken({ subject: 'user_clerk_42', workspaceId: 'org_42Acme' });

    const response = await handler({
      httpMethod: 'GET',
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(typeof body.token).toBe('string');
    expect(body.token_type).toBe('Bearer');
    expect(body.expires_in).toBeGreaterThan(0);

    const payload = decodeToken(body.token);
    expect(payload.sub).toBe('user_clerk_42');
    expect(payload.workspace_id).toBe('org_42Acme');
    expect(payload.role).toBe('authenticated');
    expect(payload.exp).toBeGreaterThan(Math.floor(Date.now() / 1000));

    // The database will only trust this token if it is signed with the
    // Supabase JWT secret — verify it exactly as PostgREST would.
    const verified = await jwtVerify(body.token, secretKey());
    expect(verified.payload.sub).toBe('user_clerk_42');
    expect(verified.payload.workspace_id).toBe('org_42Acme');
  });

  test('defaults workspace_id to personal when the Clerk session has no org', async () => {
    const { handler } = await import('../../netlify/functions/supabase-token.js');
    const token = await harness.mintToken({ subject: 'user_personalOnly', workspaceId: null });

    const response = await handler({
      httpMethod: 'GET',
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(200);
    expect(decodeToken(JSON.parse(response.body).token).workspace_id).toBe('personal');
  });

  test('rejects a token signed by another Clerk instance', async () => {
    const { handler } = await import('../../netlify/functions/supabase-token.js');
    const token = await harness.mintToken({ key: harness.foreignKey.privateKey });

    const response = await handler({
      httpMethod: 'GET',
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(response.statusCode).toBe(401);
  });

  test('503s (instead of minting an untrusted token) when the JWT secret is unset', async () => {
    const { handler } = await import('../../netlify/functions/supabase-token.js');
    delete process.env.SUPABASE_JWT_SECRET;
    const token = await harness.mintToken();

    const response = await handler({
      httpMethod: 'GET',
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(503);
    // The body carries the failure reason only — no token material at all.
    // (The reason wording itself contains the word "token", so assert on the
    // absence of a token field rather than a substring of the message.)
    const deniedBody = JSON.parse(response.body);
    expect(deniedBody.error).toMatch(/not configured/i);
    expect(deniedBody).not.toHaveProperty('token');
    expect(response.body).not.toMatch(/"token"\s*:/);

    // Restore for the remaining suites in other files.
    process.env.SUPABASE_JWT_SECRET = JWT_SECRET;
  });

  test('the minted token cannot be confused with a Clerk session token', async () => {
    const { handler } = await import('../../netlify/functions/supabase-token.js');
    const token = await harness.mintToken({ subject: 'user_roundtrip' });
    const response = await handler({
      httpMethod: 'GET',
      headers: { Authorization: `Bearer ${token}` },
    });
    const supabaseToken = JSON.parse(response.body).token;

    // Presenting the minted token back to the exchange (as if it were a
    // Clerk session) must not produce a new token: it is not Clerk-signed.
    const replay = await handler({
      httpMethod: 'GET',
      headers: { Authorization: `Bearer ${supabaseToken}` },
    });
    expect(replay.statusCode).toBe(401);
  });
});
