// tests/unit/muapi-proxy-entitlement.unit.spec.ts
//
// Unit tests for the Clerk auth + entitlement gate in
// supabase/functions/muapi-proxy/index.ts.
//
// Covers:
//   - 401 AUTH_REQUIRED: no token, malformed token, bad signature, expired,
//     issuer mismatch, no issuer configured (JSON and multipart upload paths)
//   - 403 PAYMENT_REQUIRED (upgradeRequired): verified but unpaid user, with
//     proof that no upstream MuAPI call is made
//   - allowed: legacy_access user and smartvideo_full_access feature claim,
//     with the MuAPI key forwarded upstream
//   - dev-only 'dev' placeholder key keeps its existing behavior (both the
//     x-api-key header and body forms)
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

const { handleMuapiRequest } = await import(
  '../../supabase/functions/muapi-proxy/index.ts'
);

const USER_ID = 'user_test_123';

function muapiSuccess() {
  // A prediction without a completion status skips the output-integrity gate.
  return { id: 'pred_test_1', outputs: ['https://cdn.muapi.ai/out.png'] };
}

function routerConfig() {
  return {
    users: { [USER_ID]: clerkUser(USER_ID, { legacyAccess: true }) },
    extra: {
      'api.muapi.ai': () => jsonResponse(muapiSuccess()),
    },
  };
}

function jsonRequest(token, body, apiKeyHeader) {
  return new Request('https://fn.test/generate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(apiKeyHeader ? { 'x-api-key': apiKeyHeader } : {}),
    },
    body: JSON.stringify(body),
  });
}

function multipartRequest(token) {
  return new Request('https://fn.test/upload', {
    method: 'POST',
    headers: {
      'Content-Type': 'multipart/form-data; boundary=----probe',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      'x-endpoint': 'flux-dev-image',
    },
    body: '------probe\r\nContent-Disposition: form-data; name="file"\r\n\r\nnot-a-real-file\r\n------probe--\r\n',
  });
}

function muapiCalls(fetchMock) {
  return fetchMock.mock.calls.filter(([url]) => String(url).includes('api.muapi.ai'));
}

describe('muapi-proxy entitlement gate', () => {
  afterAll(() => {});

  it('returns 401 AUTH_REQUIRED when no Authorization token is present', async () => {
    const restore = withClerkEnv({
      CLERK_ISSUER_URL: TEST_ISSUER,
      CLERK_SECRET_KEY: 'sk_test_123',
      ALLOWED_ORIGINS: 'https://app.test',
    });
    const fetchMock = installClerkFetchRouter(routerConfig());
    const res = await handleMuapiRequest(
      jsonRequest(null, { endpoint: 'flux-dev-image', params: {} }, 'muapi_real_key')
    );
    expect(res.status).toBe(401);
    expect((await res.json()).error).toBe('AUTH_REQUIRED');
    expect(muapiCalls(fetchMock)).toHaveLength(0);
    restore();
  });

  it('returns 401 AUTH_REQUIRED for an invalid-signature token', async () => {
    const restore = withClerkEnv({
      CLERK_ISSUER_URL: TEST_ISSUER,
      CLERK_SECRET_KEY: 'sk_test_123',
      ALLOWED_ORIGINS: 'https://app.test',
    });
    const fetchMock = installClerkFetchRouter(routerConfig());
    const forged = await signClerkToken({ sub: USER_ID }, { signWithOtherKey: true });
    const res = await handleMuapiRequest(
      jsonRequest(forged, { endpoint: 'flux-dev-image', params: {} }, 'muapi_real_key')
    );
    expect(res.status).toBe(401);
    expect((await res.json()).error).toBe('AUTH_REQUIRED');
    expect(muapiCalls(fetchMock)).toHaveLength(0);
    restore();
  });

  it('returns 401 AUTH_REQUIRED for an expired token', async () => {
    const restore = withClerkEnv({
      CLERK_ISSUER_URL: TEST_ISSUER,
      CLERK_SECRET_KEY: 'sk_test_123',
      ALLOWED_ORIGINS: 'https://app.test',
    });
    const fetchMock = installClerkFetchRouter(routerConfig());
    const expired = await signClerkToken({ sub: USER_ID, exp: Math.floor(Date.now() / 1000) - 600 });
    const res = await handleMuapiRequest(
      jsonRequest(expired, { endpoint: 'flux-dev-image', params: {} }, 'muapi_real_key')
    );
    expect(res.status).toBe(401);
    expect(muapiCalls(fetchMock)).toHaveLength(0);
    restore();
  });

  it('returns 401 AUTH_REQUIRED for multipart uploads without a token', async () => {
    const restore = withClerkEnv({
      CLERK_ISSUER_URL: TEST_ISSUER,
      CLERK_SECRET_KEY: 'sk_test_123',
      ALLOWED_ORIGINS: 'https://app.test',
    });
    const fetchMock = installClerkFetchRouter(routerConfig());
    const res = await handleMuapiRequest(
      new Request('https://fn.test/upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'multipart/form-data; boundary=----probe',
          'x-api-key': 'muapi_real_key',
          'x-endpoint': 'flux-dev-image',
        },
        body: '------probe--\r\n',
      })
    );
    expect(res.status).toBe(401);
    expect((await res.json()).error).toBe('AUTH_REQUIRED');
    expect(muapiCalls(fetchMock)).toHaveLength(0);
    restore();
  });

  it('returns 403 PAYMENT_REQUIRED (upgradeRequired) for an unpaid user and makes no upstream call', async () => {
    const restore = withClerkEnv({
      CLERK_ISSUER_URL: TEST_ISSUER,
      CLERK_SECRET_KEY: 'sk_test_123',
      ALLOWED_ORIGINS: 'https://app.test',
    });
    const fetchMock = installClerkFetchRouter({
      users: { [USER_ID]: clerkUser(USER_ID, { legacyAccess: false }) },
      extra: { 'api.muapi.ai': () => jsonResponse(muapiSuccess()) },
    });
    const token = await signClerkToken({ sub: USER_ID });
    const res = await handleMuapiRequest(
      jsonRequest(token, { endpoint: 'flux-dev-image', params: {} }, 'muapi_real_key')
    );
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe('PAYMENT_REQUIRED');
    expect(body.upgradeRequired).toBe(true);
    expect(muapiCalls(fetchMock)).toHaveLength(0);
    restore();
  });

  it('allows a paying (legacy_access) user and forwards the MuAPI key upstream', async () => {
    const restore = withClerkEnv({
      CLERK_ISSUER_URL: TEST_ISSUER,
      CLERK_SECRET_KEY: 'sk_test_123',
      ALLOWED_ORIGINS: 'https://app.test',
    });
    const fetchMock = installClerkFetchRouter(routerConfig());
    const token = await signClerkToken({ sub: USER_ID });
    const res = await handleMuapiRequest(
      jsonRequest(token, { endpoint: 'flux-dev-image', params: { prompt: 'a cat' } }, 'muapi_real_key')
    );
    expect(res.status).toBe(200);
    expect((await res.json()).id).toBe('pred_test_1');
    const calls = muapiCalls(fetchMock);
    expect(calls).toHaveLength(1);
    expect(String(calls[0][0])).toBe('https://api.muapi.ai/api/v1/flux-dev-image');
    expect(calls[0][1].headers['x-api-key']).toBe('muapi_real_key');
    restore();
  });

  it('allows a user whose token carries the smartvideo_full_access feature claim (no backend lookup)', async () => {
    const restore = withClerkEnv({
      CLERK_ISSUER_URL: TEST_ISSUER,
      CLERK_SECRET_KEY: 'sk_test_123',
      ALLOWED_ORIGINS: 'https://app.test',
    });
    const fetchMock = installClerkFetchRouter({
      users: {},
      extra: { 'api.muapi.ai': () => jsonResponse(muapiSuccess()) },
    });
    const token = await signClerkToken({
      sub: USER_ID,
      features: ['smartvideo_full_access'],
    });
    const res = await handleMuapiRequest(
      jsonRequest(token, { endpoint: 'latentsync-video', params: {} }, 'muapi_real_key')
    );
    expect(res.status).toBe(200);
    expect(
      fetchMock.mock.calls.some(([url]) => String(url).includes('api.clerk.com/v1/users/'))
    ).toBe(false);
    restore();
  });

  it('preserves the dev-only "dev" placeholder key path (x-api-key header)', async () => {
    const restore = withClerkEnv({
      ENVIRONMENT: 'development',
      CLERK_ISSUER_URL: TEST_ISSUER,
      CLERK_SECRET_KEY: 'sk_test_123',
      ALLOWED_ORIGINS: 'https://app.test',
    });
    const fetchMock = installClerkFetchRouter(routerConfig());
    const res = await handleMuapiRequest(
      jsonRequest(null, { endpoint: 'flux-dev-image', params: {} }, 'dev')
    );
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('Development placeholder key not supported');
    expect(muapiCalls(fetchMock)).toHaveLength(0);
    restore();
  });

  it('preserves the dev-only "dev" placeholder key path (request body field)', async () => {
    const restore = withClerkEnv({
      ENVIRONMENT: 'development',
      CLERK_ISSUER_URL: TEST_ISSUER,
      CLERK_SECRET_KEY: 'sk_test_123',
      ALLOWED_ORIGINS: 'https://app.test',
    });
    installClerkFetchRouter(routerConfig());
    const res = await handleMuapiRequest(
      jsonRequest(null, { endpoint: 'flux-dev-image', params: {}, muapi_api_key: 'dev' })
    );
    expect(res.status).toBe(401);
    expect((await res.json()).error).toBe('Development placeholder key not supported');
    restore();
  });

  it('keeps denying the "dev" placeholder key in non-development environments', async () => {
    const restore = withClerkEnv({
      CLERK_ISSUER_URL: TEST_ISSUER,
      CLERK_SECRET_KEY: 'sk_test_123',
      ALLOWED_ORIGINS: 'https://app.test',
    });
    installClerkFetchRouter(routerConfig());
    const res = await handleMuapiRequest(
      jsonRequest(null, { endpoint: 'flux-dev-image', params: {} }, 'dev')
    );
    expect(res.status).toBe(401);
    expect((await res.json()).error).toBe('AUTH_REQUIRED');
    restore();
  });

  it('keeps the OPTIONS preflight working without a token', async () => {
    const restore = withClerkEnv({
      CLERK_ISSUER_URL: TEST_ISSUER,
      CLERK_SECRET_KEY: 'sk_test_123',
      ALLOWED_ORIGINS: 'https://app.test',
    });
    installClerkFetchRouter(routerConfig());
    const res = await handleMuapiRequest(
      new Request('https://fn.test/generate', { method: 'OPTIONS' })
    );
    expect(res.status).toBe(200);
    restore();
  });
});
