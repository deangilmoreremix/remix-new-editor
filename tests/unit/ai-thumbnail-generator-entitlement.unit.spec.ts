// tests/unit/ai-thumbnail-generator-entitlement.unit.spec.ts
//
// Unit tests for the Clerk auth + entitlement gate in
// supabase/functions/ai-thumbnail-generator/index.ts.
//
// Covers:
//   - 401 AUTH_REQUIRED: no token / invalid token (deny before any key use)
//   - 403 PAYMENT_REQUIRED (upgradeRequired): verified but unpaid user —
//     including the 'generate' action whose MuAPI path would otherwise fall
//     back to the server MUAPI_API_KEY (~handleGenerateMuapi)
//   - allowed: legacy_access user / smartvideo_full_access feature claim
//   - the verified Clerk token is forwarded to muapi-proxy on the server-side
//     hop (Authorization: Bearer <clerk token>)
//
// No real provider endpoints are contacted — global fetch is routed by the
// test helper.

import { describe, it, expect, afterAll } from 'vitest';
import {
  installClerkFetchRouter,
  signClerkToken,
  clerkUser,
  withClerkEnv,
  TEST_ISSUER,
  jsonResponse,
} from './clerk-auth-test-utils.js';

// Module-level env reads happen at import time.
process.env.SUPABASE_URL = 'https://proj.supabase.co';
process.env.OPENAI_API_KEY = 'sk-test-openai';

const { handleThumbnailRequest } = await import(
  '../../supabase/functions/ai-thumbnail-generator/index.ts'
);

const USER_ID = 'user_test_123';

function event(token, body) {
  return new Request('https://fn.test/thumbnails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
}

function proxyRouter({ legacyAccess = true }) {
  return installClerkFetchRouter({
    users: { [USER_ID]: clerkUser(USER_ID, { legacyAccess }) },
    extra: {
      // The server-side hop to muapi-proxy.
      'supabase.co/functions/v1/muapi-proxy': (url, init) => {
        proxyCalls.push({ url: String(url), init });
        return jsonResponse({ images: [{ b64: 'abc123' }] });
      },
    },
  });
}

let proxyCalls = [];

describe('ai-thumbnail-generator entitlement gate', () => {
  afterAll(() => {});

  it('returns 401 AUTH_REQUIRED when no Authorization token is present', async () => {
    const restore = withClerkEnv({
      CLERK_ISSUER_URL: TEST_ISSUER,
      CLERK_SECRET_KEY: 'sk_test_123',
    });
    proxyCalls = [];
    const fetchMock = proxyRouter({ legacyAccess: true });
    const res = await handleThumbnailRequest(
      event(null, { action: 'platform', platformKey: 'youtube' })
    );
    expect(res.status).toBe(401);
    expect((await res.json()).error).toBe('AUTH_REQUIRED');
    expect(proxyCalls).toHaveLength(0);
    expect(fetchMock).toBeDefined();
    restore();
  });

  it('returns 401 AUTH_REQUIRED for an invalid-signature token', async () => {
    const restore = withClerkEnv({
      CLERK_ISSUER_URL: TEST_ISSUER,
      CLERK_SECRET_KEY: 'sk_test_123',
    });
    proxyCalls = [];
    proxyRouter({ legacyAccess: true });
    const forged = await signClerkToken({ sub: USER_ID }, { signWithOtherKey: true });
    const res = await handleThumbnailRequest(event(forged, { action: 'platform', platformKey: 'youtube' }));
    expect(res.status).toBe(401);
    expect((await res.json()).error).toBe('AUTH_REQUIRED');
    restore();
  });

  it('returns 403 PAYMENT_REQUIRED for an unpaid user before any server-key use', async () => {
    const restore = withClerkEnv({
      CLERK_ISSUER_URL: TEST_ISSUER,
      CLERK_SECRET_KEY: 'sk_test_123',
    });
    proxyCalls = [];
    const fetchMock = proxyRouter({ legacyAccess: false });
    const token = await signClerkToken({ sub: USER_ID });

    // 'generate' with a non-OpenAI model is the handleGenerateMuapi path that
    // falls back to the server MUAPI_API_KEY.
    const res = await handleThumbnailRequest(
      event(token, { action: 'generate', prompt: 'a thumbnail', model: 'flux-dev-image' })
    );
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe('PAYMENT_REQUIRED');
    expect(body.upgradeRequired).toBe(true);
    expect(proxyCalls).toHaveLength(0);
    expect(
      fetchMock.mock.calls.some(([url]) => String(url).includes('api.clerk.com/v1/users/'))
    ).toBe(true);
    restore();
  });

  it('allows a legacy_access user and forwards the Clerk token to muapi-proxy', async () => {
    const restore = withClerkEnv({
      CLERK_ISSUER_URL: TEST_ISSUER,
      CLERK_SECRET_KEY: 'sk_test_123',
    });
    // Server-key fallback configured — the MuAPI path would spend it without
    // the entitlement gate in front.
    process.env.MUAPI_API_KEY = 'sk-test-muapi';
    proxyCalls = [];
    proxyRouter({ legacyAccess: true });
    const token = await signClerkToken({ sub: USER_ID });
    const res = await handleThumbnailRequest(
      event(token, { action: 'generate', prompt: 'a thumbnail', model: 'flux-dev-image' })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.candidates)).toBe(true);
    expect(body.candidates[0].b64_json).toBe('abc123');
    expect(proxyCalls).toHaveLength(1);
    expect(proxyCalls[0].init.headers.Authorization).toBe(`Bearer ${token}`);
    expect(String(proxyCalls[0].init.body)).toContain('muapi_api_key');
    delete process.env.MUAPI_API_KEY;
    restore();
  });

  it('allows a user carrying the smartvideo_full_access feature claim', async () => {
    const restore = withClerkEnv({
      CLERK_ISSUER_URL: TEST_ISSUER,
      CLERK_SECRET_KEY: 'sk_test_123',
    });
    proxyCalls = [];
    proxyRouter({ legacyAccess: false });
    const token = await signClerkToken({
      sub: USER_ID,
      features: ['smartvideo_full_access'],
    });
    const res = await handleThumbnailRequest(
      event(token, { action: 'platform', platformKey: 'youtube' })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.specs).toBeTruthy();
    expect(body.platform).toBe('youtube');
    restore();
  });

  it('still answers OPTIONS preflight without a token', async () => {
    const restore = withClerkEnv({
      CLERK_ISSUER_URL: TEST_ISSUER,
      CLERK_SECRET_KEY: 'sk_test_123',
    });
    proxyCalls = [];
    proxyRouter({ legacyAccess: true });
    const res = await handleThumbnailRequest(
      new Request('https://fn.test/thumbnails', { method: 'OPTIONS' })
    );
    expect(res.status).toBe(200);
    restore();
  });
});
