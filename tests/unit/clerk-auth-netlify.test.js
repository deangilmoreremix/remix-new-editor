// tests/unit/clerk-auth-netlify.test.js
//
// Unit tests for netlify/functions/_clerk-auth.js — the Clerk auth +
// SmartVideo entitlement gate shared by the Netlify functions.
//
// Contract under test:
//   - no/invalid/expired token                   -> 401 AUTH_REQUIRED
//   - verified user, no entitlement              -> 403 PAYMENT_REQUIRED (upgradeRequired)
//   - verified user, publicMetadata.legacy_access -> allowed (null gate result)
//   - verified user, smartvideo_full_access claim -> allowed (null gate result)
//
// No real Clerk or provider endpoints are contacted — global fetch is routed
// by the test helper.

import { describe, it, expect, afterAll } from 'vitest';
import {
  installClerkFetchRouter,
  signClerkToken,
  clerkUser,
  withClerkEnv,
  TEST_ISSUER,
} from './clerk-auth-test-utils.js';

const { verifyClerkAuth, requireClerkEntitlement, requireClerkAuth, PAID_FEATURE } = await import(
  '../../netlify/functions/_clerk-auth.js'
);

const ENTITLED_USER_ID = 'user_test_123';

function netlifyEvent(token) {
  return {
    httpMethod: 'POST',
    headers: token ? { authorization: `Bearer ${token}` } : {},
    body: JSON.stringify({ tool: 'llm_chat' }),
  };
}

describe('clerk-auth (Netlify helper)', () => {
  afterAll(() => {});

  it('exports the SmartVideo billing feature slug', () => {
    expect(PAID_FEATURE).toBe('smartvideo_full_access');
  });

  it('returns null identity when no Authorization header is present', async () => {
    const restore = withClerkEnv({
      CLERK_ISSUER_URL: TEST_ISSUER,
      CLERK_SECRET_KEY: 'sk_test_123',
    });
    installClerkFetchRouter({ users: {} });
    expect(await verifyClerkAuth(netlifyEvent(null))).toBeNull();
    restore();
  });

  it('returns null identity for an invalid signature', async () => {
    const restore = withClerkEnv({
      CLERK_ISSUER_URL: TEST_ISSUER,
      CLERK_SECRET_KEY: 'sk_test_123',
    });
    installClerkFetchRouter({});
    const forged = await signClerkToken({}, { signWithOtherKey: true });
    expect(await verifyClerkAuth(netlifyEvent(forged))).toBeNull();
    restore();
  });

  it('returns null identity for an expired token', async () => {
    const restore = withClerkEnv({
      CLERK_ISSUER_URL: TEST_ISSUER,
      CLERK_SECRET_KEY: 'sk_test_123',
    });
    installClerkFetchRouter({});
    const expired = await signClerkToken({ exp: Math.floor(Date.now() / 1000) - 600 });
    expect(await verifyClerkAuth(netlifyEvent(expired))).toBeNull();
    restore();
  });

  it('renders 401 AUTH_REQUIRED for unauthenticated requests', async () => {
    const restore = withClerkEnv({
      CLERK_ISSUER_URL: TEST_ISSUER,
      CLERK_SECRET_KEY: 'sk_test_123',
    });
    installClerkFetchRouter({});
    const denial = await requireClerkEntitlement(netlifyEvent(null), {
      'Access-Control-Allow-Origin': '*',
    });
    expect(denial.statusCode).toBe(401);
    const body = JSON.parse(denial.body);
    expect(body.error).toBe('AUTH_REQUIRED');
    expect(denial.headers['Content-Type']).toBe('application/json');
    expect(denial.headers['Access-Control-Allow-Origin']).toBe('*');
    restore();
  });

  it('renders 403 PAYMENT_REQUIRED for an authenticated but unpaid user', async () => {
    const restore = withClerkEnv({
      CLERK_ISSUER_URL: TEST_ISSUER,
      CLERK_SECRET_KEY: 'sk_test_123',
    });
    installClerkFetchRouter({ users: { [ENTITLED_USER_ID]: clerkUser() } });
    const token = await signClerkToken({ sub: ENTITLED_USER_ID });
    const denial = await requireClerkEntitlement(netlifyEvent(token));
    expect(denial.statusCode).toBe(403);
    const body = JSON.parse(denial.body);
    expect(body.error).toBe('PAYMENT_REQUIRED');
    expect(body.upgradeRequired).toBe(true);
    restore();
  });

  it('allows a user whose publicMetadata.legacy_access is true', async () => {
    const restore = withClerkEnv({
      CLERK_ISSUER_URL: TEST_ISSUER,
      CLERK_SECRET_KEY: 'sk_test_123',
    });
    const fetchMock = installClerkFetchRouter({
      users: { [ENTITLED_USER_ID]: clerkUser(ENTITLED_USER_ID, { legacyAccess: true }) },
    });
    const token = await signClerkToken({ sub: ENTITLED_USER_ID });
    expect(await requireClerkEntitlement(netlifyEvent(token))).toBeNull();
    expect(
      fetchMock.mock.calls.some(([url]) => String(url).includes('api.clerk.com/v1/users/'))
    ).toBe(true);
    restore();
  });

  it("allows a user carrying the 'smartvideo_full_access' feature claim", async () => {
    const restore = withClerkEnv({
      CLERK_ISSUER_URL: TEST_ISSUER,
      CLERK_SECRET_KEY: 'sk_test_123',
    });
    const fetchMock = installClerkFetchRouter({
      users: { [ENTITLED_USER_ID]: clerkUser() },
    });
    const token = await signClerkToken({
      sub: ENTITLED_USER_ID,
      features: ['smartvideo_full_access'],
    });
    const identity = await verifyClerkAuth(netlifyEvent(token));
    expect(identity).toMatchObject({
      userId: ENTITLED_USER_ID,
      featureFullAccess: true,
    });
    expect(await requireClerkEntitlement(netlifyEvent(token))).toBeNull();
    // Feature claim short-circuits the Backend API lookup.
    expect(
      fetchMock.mock.calls.some(([url]) => String(url).includes('api.clerk.com/v1/users/'))
    ).toBe(false);
    restore();
  });

  it('requireClerkAuth denies only unauthenticated callers (auth-only gate)', async () => {
    const restore = withClerkEnv({
      CLERK_ISSUER_URL: TEST_ISSUER,
      CLERK_SECRET_KEY: 'sk_test_123',
    });
    installClerkFetchRouter({ users: { [ENTITLED_USER_ID]: clerkUser() } });

    const noAuth = await requireClerkAuth(netlifyEvent(null));
    expect(noAuth.statusCode).toBe(401);
    expect(JSON.parse(noAuth.body).error).toBe('AUTH_REQUIRED');

    // An unpaid but signed-in user passes the auth-only gate (stock search).
    const unpaidToken = await signClerkToken({ sub: ENTITLED_USER_ID });
    expect(await requireClerkAuth(netlifyEvent(unpaidToken))).toBeNull();
    restore();
  });

  it('fails closed when no Clerk issuer is configured', async () => {
    const restore = withClerkEnv({ CLERK_SECRET_KEY: 'sk_test_123' });
    installClerkFetchRouter({});
    const token = await signClerkToken({});
    expect(await verifyClerkAuth(netlifyEvent(token))).toBeNull();
    restore();
  });
});
