// tests/unit/clerk-auth-deno.unit.spec.ts
//
// Unit tests for supabase/functions/_shared/clerkAuth.ts — the Clerk auth +
// SmartVideo entitlement gate shared by the Supabase edge functions.
//
// Contract under test:
//   - no/invalid/expired/mismatched token -> unauthenticated (null identity)
//   - verified user with publicMetadata.legacy_access === true -> entitled
//   - verified user with the 'smartvideo_full_access' feature claim -> entitled
//   - verified user with neither -> denied (requireEntitlement renders 403)
//   - requireEntitlement returns 401 AUTH_REQUIRED / 403 PAYMENT_REQUIRED
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

const { verifyClerkToken, requireEntitlement, PAID_FEATURE } = await import(
  '../../supabase/functions/_shared/clerkAuth.ts'
);

const ENTITLED_USER_ID = 'user_test_123';

function authRequest(token, url = 'https://fn.test/webhook') {
  return new Request(url, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
}

describe('clerkAuth (Deno edge helper)', () => {
  afterAll(() => {});

  it('exports the SmartVideo billing feature slug', () => {
    expect(PAID_FEATURE).toBe('smartvideo_full_access');
  });

  it('returns null identity when no Authorization header is present', async () => {
    const restore = withClerkEnv({
      CLERK_ISSUER_URL: TEST_ISSUER,
      CLERK_SECRET_KEY: 'sk_test_123',
    });
    installClerkFetchRouter({ users: { [ENTITLED_USER_ID]: clerkUser() } });
    expect(await verifyClerkToken(authRequest(null))).toBeNull();
    restore();
  });

  it('returns null identity for a malformed token', async () => {
    const restore = withClerkEnv({
      CLERK_ISSUER_URL: TEST_ISSUER,
      CLERK_SECRET_KEY: 'sk_test_123',
    });
    installClerkFetchRouter({});
    expect(await verifyClerkToken(authRequest('not-a-jwt'))).toBeNull();
    restore();
  });

  it('returns null identity when the signature was made by another key', async () => {
    const restore = withClerkEnv({
      CLERK_ISSUER_URL: TEST_ISSUER,
      CLERK_SECRET_KEY: 'sk_test_123',
    });
    installClerkFetchRouter({});
    const forged = await signClerkToken({}, { signWithOtherKey: true });
    expect(await verifyClerkToken(authRequest(forged))).toBeNull();
    restore();
  });

  it('returns null identity for a non-RS256 algorithm', async () => {
    const restore = withClerkEnv({
      CLERK_ISSUER_URL: TEST_ISSUER,
      CLERK_SECRET_KEY: 'sk_test_123',
    });
    installClerkFetchRouter({});
    const wrongAlg = await signClerkToken({}, { header: { alg: 'HS256' } });
    expect(await verifyClerkToken(authRequest(wrongAlg))).toBeNull();
    restore();
  });

  it('returns null identity for an expired token', async () => {
    const restore = withClerkEnv({
      CLERK_ISSUER_URL: TEST_ISSUER,
      CLERK_SECRET_KEY: 'sk_test_123',
    });
    installClerkFetchRouter({});
    const expired = await signClerkToken({ exp: Math.floor(Date.now() / 1000) - 600 });
    expect(await verifyClerkToken(authRequest(expired))).toBeNull();
    restore();
  });

  it('returns null identity when the issuer claim does not match', async () => {
    const restore = withClerkEnv({
      CLERK_ISSUER_URL: TEST_ISSUER,
      CLERK_SECRET_KEY: 'sk_test_123',
    });
    installClerkFetchRouter({});
    const wrongIss = await signClerkToken({}, { iss: 'https://evil.example.com' });
    expect(await verifyClerkToken(authRequest(wrongIss))).toBeNull();
    restore();
  });

  it('fails closed when no Clerk issuer is configured', async () => {
    const restore = withClerkEnv({ CLERK_SECRET_KEY: 'sk_test_123' });
    installClerkFetchRouter({});
    const token = await signClerkToken({});
    expect(await verifyClerkToken(authRequest(token))).toBeNull();
    restore();
  });

  it('entitles a user whose publicMetadata.legacy_access is true', async () => {
    const restore = withClerkEnv({
      CLERK_ISSUER_URL: TEST_ISSUER,
      CLERK_SECRET_KEY: 'sk_test_123',
    });
    const fetchMock = installClerkFetchRouter({
      users: { [ENTITLED_USER_ID]: clerkUser(ENTITLED_USER_ID, { legacyAccess: true }) },
    });
    const token = await signClerkToken({ sub: ENTITLED_USER_ID });
    const identity = await verifyClerkToken(authRequest(token));
    expect(identity).toMatchObject({
      userId: ENTITLED_USER_ID,
      email: 'buyer@example.com',
      legacyAccess: true,
      featureFullAccess: false,
    });
    expect(
      fetchMock.mock.calls.some(([url]) => String(url).includes('api.clerk.com/v1/users/'))
    ).toBe(true);
    restore();
  });

  it("entitles a user carrying the 'smartvideo_full_access' feature claim", async () => {
    const restore = withClerkEnv({
      CLERK_ISSUER_URL: TEST_ISSUER,
      CLERK_SECRET_KEY: 'sk_test_123',
    });
    const fetchMock = installClerkFetchRouter({
      users: { [ENTITLED_USER_ID]: clerkUser() },
    });
    const token = await signClerkToken({
      features: ['smartvideo_full_access', 'something_else'],
    });
    const identity = await verifyClerkToken(authRequest(token));
    expect(identity).toMatchObject({
      userId: ENTITLED_USER_ID,
      featureFullAccess: true,
      legacyAccess: false,
    });
    // The billing feature claim is authoritative — no Backend API lookup.
    expect(
      fetchMock.mock.calls.some(([url]) => String(url).includes('api.clerk.com/v1/users/'))
    ).toBe(false);
    restore();
  });

  it('accepts feature claims shaped as { slug } objects', async () => {
    const restore = withClerkEnv({
      CLERK_ISSUER_URL: TEST_ISSUER,
      CLERK_SECRET_KEY: 'sk_test_123',
    });
    installClerkFetchRouter({ users: {} });
    const token = await signClerkToken({ features: [{ slug: 'smartvideo_full_access' }] });
    const identity = await verifyClerkToken(authRequest(token));
    expect(identity?.featureFullAccess).toBe(true);
    restore();
  });

  it('denies an authenticated user with neither entitlement (403 shape)', async () => {
    const restore = withClerkEnv({
      CLERK_ISSUER_URL: TEST_ISSUER,
      CLERK_SECRET_KEY: 'sk_test_123',
    });
    installClerkFetchRouter({ users: { [ENTITLED_USER_ID]: clerkUser() } });
    const token = await signClerkToken({ sub: ENTITLED_USER_ID });
    const identity = await verifyClerkToken(authRequest(token));
    expect(identity).toMatchObject({
      userId: ENTITLED_USER_ID,
      legacyAccess: false,
      featureFullAccess: false,
    });
    const denial = await requireEntitlement(authRequest(token));
    expect(denial).not.toBeNull();
    expect(denial?.status).toBe(403);
    const body = await denial?.json();
    expect(body.error).toBe('PAYMENT_REQUIRED');
    expect(body.upgradeRequired).toBe(true);
    restore();
  });

  it('fails closed when the Clerk Backend API lookup fails', async () => {
    const restore = withClerkEnv({
      CLERK_ISSUER_URL: TEST_ISSUER,
      CLERK_SECRET_KEY: 'sk_test_123',
    });
    // No user in the router -> 404 from the Backend API.
    installClerkFetchRouter({ users: {} });
    const token = await signClerkToken({ sub: 'user_missing' });
    const identity = await verifyClerkToken(authRequest(token));
    expect(identity).toMatchObject({ legacyAccess: false, featureFullAccess: false });
    const denial = await requireEntitlement(authRequest(token));
    expect(denial?.status).toBe(403);
    restore();
  });

  it('renders 401 AUTH_REQUIRED for unauthenticated requests', async () => {
    const restore = withClerkEnv({
      CLERK_ISSUER_URL: TEST_ISSUER,
      CLERK_SECRET_KEY: 'sk_test_123',
    });
    installClerkFetchRouter({});
    const denial = await requireEntitlement(authRequest(null));
    expect(denial?.status).toBe(401);
    const body = await denial?.json();
    expect(body.error).toBe('AUTH_REQUIRED');
    restore();
  });

  it('returns null (entitled) path for a paying user', async () => {
    const restore = withClerkEnv({
      CLERK_ISSUER_URL: TEST_ISSUER,
      CLERK_SECRET_KEY: 'sk_test_123',
    });
    installClerkFetchRouter({
      users: { [ENTITLED_USER_ID]: clerkUser(ENTITLED_USER_ID, { legacyAccess: true }) },
    });
    const token = await signClerkToken({ sub: ENTITLED_USER_ID });
    expect(await requireEntitlement(authRequest(token))).toBeNull();
    restore();
  });

  it('returns null identity when the JWKS fetch fails', async () => {
    const restore = withClerkEnv({
      CLERK_ISSUER_URL: 'https://clerk-jwks-down.test',
      CLERK_SECRET_KEY: 'sk_test_123',
    });
    global.fetch = vi.fn(async (url) => {
      const u = String(url);
      if (u.endsWith('/.well-known/jwks.json')) {
        return { ok: false, status: 500, statusText: 'Server Error', json: async () => ({}) };
      }
      throw new Error(`Unexpected fetch to ${u}`);
    });
    const token = await signClerkToken({}, { iss: 'https://clerk-jwks-down.test' });
    expect(await verifyClerkToken(authRequest(token))).toBeNull();
    restore();
  });
});
