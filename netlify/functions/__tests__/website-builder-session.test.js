/**
 * website-builder-session.test.js
 *
 * The Smart Website Builder SSO endpoint: any signed-in SmartVideo (Clerk)
 * user with a verified email gets a one-time Supabase magic-link token. Clerk's
 * Backend API and the Supabase admin client are faked, so no network is used.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  createHandler,
  claimsHaveFeature,
  primaryVerifiedEmail,
  loginProof,
} from '../website-builder-session.js';

const SECRET = 'test-login-secret';
const ENV = { SUPABASE_URL: 'https://db.test', SUPABASE_SERVICE_ROLE_KEY: 'service', CLERK_SECRET_KEY: 'sk_test' };

function clerkUser(overrides = {}) {
  return {
    id: 'user_123',
    first_name: 'Dean',
    last_name: 'R',
    image_url: 'https://img.test/a.png',
    primary_email_address_id: 'em_1',
    email_addresses: [{ id: 'em_1', email_address: 'Dean@Example.com', verification: { status: 'verified' } }],
    public_metadata: {},
    ...overrides,
  };
}

function fakeFetch(user, status = 200) {
  return vi.fn(async () => ({ ok: status === 200, status, json: async () => user }));
}

/**
 * Fake Supabase admin client that mimics the behaviours that matter here:
 * - createUser fails with email_exists when the address already has a login;
 * - createUser runs the database's on_auth_user_created trigger, which
 *   rejects the login (production error: null clerk_id) unless
 *   user_metadata.wb_login_proof is HMAC(login_secret, lower(email)).
 *   app_metadata is written AFTER the row exists, so it is ignored here, as
 *   in real Supabase;
 * - generateLink({ type: 'magiclink' }) SILENTLY CREATES an unknown user with
 *   no proof, which the same trigger rejects, so `autoCreatedUnmarked` must
 *   stay false.
 * `profile` is the existing wb_profiles row for this Clerk user, if any.
 */
function fakeAdmin({ profile = null, authUserExists = false, suspended = false } = {}) {
  const state = { authUserExists: authUserExists || !!profile, autoCreatedUnmarked: false, triggerRejected: false };
  const createUser = vi.fn(async (args) => {
    if (state.authUserExists) {
      return { data: null, error: { status: 422, code: 'email_exists', message: 'A user with this email address has already been registered' } };
    }
    if (args?.user_metadata?.wb_login_proof !== loginProof(SECRET, args?.email)) {
      state.triggerRejected = true;
      return { data: null, error: { status: 500, message: 'Database error creating new user' } };
    }
    state.authUserExists = true;
    return { data: { user: { id: 'auth-uuid-1' } }, error: null };
  });
  const generateLink = vi.fn(async () => {
    if (!state.authUserExists) {
      state.authUserExists = true;
      state.autoCreatedUnmarked = true;
    }
    return { data: { user: { id: 'auth-uuid-1' }, properties: { hashed_token: 'hash-abc', action_link: 'https://secret' } }, error: null };
  });
  const maybeSingle = vi.fn(async () => ({ data: profile, error: null }));
  const eq = vi.fn(() => ({ maybeSingle }));
  const single = vi.fn(async () => ({ data: { suspended }, error: null }));
  const upsert = vi.fn(() => ({ select: () => ({ single }) }));
  const configMaybeSingle = vi.fn(async () => ({ data: { value: SECRET }, error: null }));
  const from = vi.fn((table) => (table === 'wb_private_config'
    ? { select: () => ({ eq: () => ({ maybeSingle: configMaybeSingle }) }) }
    : { select: () => ({ eq }), upsert }));
  const client = { auth: { admin: { generateLink, createUser } }, from };
  return { client, generateLink, createUser, upsert, eq, state, from, configMaybeSingle };
}

function call(handler, auth = { userId: 'user_123', claims: {} }) {
  return handler({ httpMethod: 'POST', auth }).then((r) => ({ ...r, body: JSON.parse(r.body) }));
}

let saved;
beforeEach(() => { saved = { ...process.env }; Object.assign(process.env, ENV); });
afterEach(() => { process.env = saved; });

describe('claimsHaveFeature', () => {
  it('reads scoped features from the fea claim', () => {
    expect(claimsHaveFeature({ fea: 'u:smartvideo_full_access' })).toBe(true);
    expect(claimsHaveFeature({ fea: 'o:other,u:smartvideo_full_access' })).toBe(true);
    expect(claimsHaveFeature({ fea: 'u:smartvideo_full_access_lite' })).toBe(false);
    expect(claimsHaveFeature({})).toBe(false);
  });
});

describe('primaryVerifiedEmail', () => {
  it('returns the lower-cased primary address only when verified', () => {
    expect(primaryVerifiedEmail(clerkUser())).toBe('dean@example.com');
    expect(primaryVerifiedEmail(clerkUser({
      email_addresses: [{ id: 'em_1', email_address: 'x@y.com', verification: { status: 'unverified' } }],
    }))).toBeNull();
  });
});

describe('website-builder-session handler', () => {
  const RETURNING = { id: 'auth-uuid-1', email: 'dean@example.com' };

  it('first visit: creates the login WITH the server-made proof before asking for a link', async () => {
    const admin = fakeAdmin();
    const handler = createHandler({ fetchImpl: fakeFetch(clerkUser()), createAdminClient: () => admin.client });
    const res = await call(handler);
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ token_hash: 'hash-abc', type: 'email', email: 'dean@example.com' });
    expect(JSON.stringify(res.body)).not.toContain('https://secret');
    expect(admin.createUser).toHaveBeenCalledWith({
      email: 'dean@example.com',
      email_confirm: true,
      user_metadata: {
        wb_login_proof: loginProof(SECRET, 'dean@example.com'),
        clerk_user_id: 'user_123',
        full_name: 'Dean R',
        avatar_url: 'https://img.test/a.png',
      },
      app_metadata: { clerk_user_id: 'user_123', source: 'smart-website-builder' },
    });
    expect(admin.from).toHaveBeenCalledWith('wb_private_config');
    expect(admin.state.triggerRejected).toBe(false);
    // The regression: the user must never be created implicitly by generateLink.
    expect(admin.state.autoCreatedUnmarked).toBe(false);
    expect(admin.createUser.mock.invocationCallOrder[0]).toBeLessThan(admin.generateLink.mock.invocationCallOrder[0]);
    expect(admin.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'auth-uuid-1', email: 'dean@example.com', clerk_user_id: 'user_123', full_name: 'Dean R' }),
      { onConflict: 'id' },
    );
  });

  it('proof is per email address and cannot be forged without the secret', () => {
    expect(loginProof(SECRET, 'Dean@Example.com')).toBe(loginProof(SECRET, 'dean@example.com'));
    expect(loginProof(SECRET, 'a@example.com')).not.toBe(loginProof(SECRET, 'b@example.com'));
    expect(loginProof('another-secret', 'a@example.com')).not.toBe(loginProof(SECRET, 'a@example.com'));
    expect(loginProof(SECRET, 'a@example.com')).toMatch(/^[0-9a-f]{64}$/);
  });

  it('fails with session_failed (and never leaves a half-made login) if the login secret is missing', async () => {
    const admin = fakeAdmin();
    admin.configMaybeSingle.mockResolvedValueOnce({ data: null, error: null });
    const handler = createHandler({ fetchImpl: fakeFetch(clerkUser()), createAdminClient: () => admin.client });
    const res = await call(handler);
    expect(res.statusCode).toBe(500);
    expect(res.body.error).toBe('session_failed');
    expect(admin.createUser).not.toHaveBeenCalled();
    expect(admin.generateLink).not.toHaveBeenCalled();
  });

  it('reuses an address that already has a Supabase login from another app', async () => {
    const admin = fakeAdmin({ authUserExists: true });
    const handler = createHandler({ fetchImpl: fakeFetch(clerkUser()), createAdminClient: () => admin.client });
    const res = await call(handler);
    expect(res.statusCode).toBe(200);
    expect(admin.createUser).toHaveBeenCalledTimes(1);
    expect(admin.generateLink).toHaveBeenCalledTimes(1);
  });

  it('returning user: matched by Clerk id, no createUser, stored email is kept', async () => {
    const admin = fakeAdmin({ profile: { id: 'auth-uuid-1', email: 'old@example.com' } });
    const handler = createHandler({ fetchImpl: fakeFetch(clerkUser()), createAdminClient: () => admin.client });
    const res = await call(handler);
    expect(res.statusCode).toBe(200);
    expect(res.body.email).toBe('old@example.com');
    expect(admin.eq).toHaveBeenCalledWith('clerk_user_id', 'user_123');
    expect(admin.createUser).not.toHaveBeenCalled();
    expect(admin.generateLink).toHaveBeenCalledWith({ type: 'magiclink', email: 'old@example.com' });
  });

  it('issues a token for a free (unpaid) SmartVideo user too', async () => {
    const admin = fakeAdmin({ profile: RETURNING });
    const handler = createHandler({ fetchImpl: fakeFetch(clerkUser()), createAdminClient: () => admin.client });
    const res = await call(handler);
    expect(res.statusCode).toBe(200);
    expect(res.body.token_hash).toBe('hash-abc');
  });

  it('refuses unverified email addresses', async () => {
    const admin = fakeAdmin();
    const user = clerkUser({
      email_addresses: [{ id: 'em_1', email_address: 'victim@example.com', verification: { status: 'unverified' } }],
    });
    const handler = createHandler({ fetchImpl: fakeFetch(user), createAdminClient: () => admin.client });
    const res = await call(handler);
    expect(res.statusCode).toBe(403);
    expect(admin.createUser).not.toHaveBeenCalled();
    expect(admin.generateLink).not.toHaveBeenCalled();
  });

  it('refuses suspended builder profiles', async () => {
    const admin = fakeAdmin({ profile: RETURNING, suspended: true });
    const handler = createHandler({ fetchImpl: fakeFetch(clerkUser()), createAdminClient: () => admin.client });
    expect((await call(handler)).statusCode).toBe(403);
  });

  it('returns session_failed (500) when Supabase cannot create the login', async () => {
    const admin = fakeAdmin();
    admin.createUser.mockResolvedValueOnce({ data: null, error: { status: 500, message: 'Database error creating new user' } });
    const handler = createHandler({ fetchImpl: fakeFetch(clerkUser()), createAdminClient: () => admin.client });
    const res = await call(handler);
    expect(res.statusCode).toBe(500);
    expect(res.body.error).toBe('session_failed');
  });

  it('returns 401 without a verified Clerk identity', async () => {
    const handler = createHandler({ fetchImpl: fakeFetch(clerkUser()), createAdminClient: () => fakeAdmin().client });
    expect((await call(handler, {})).statusCode).toBe(401);
  });

  it('returns 503 when not configured', async () => {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    const handler = createHandler({ fetchImpl: fakeFetch(clerkUser()), createAdminClient: () => fakeAdmin().client });
    expect((await call(handler)).statusCode).toBe(503);
  });
});
