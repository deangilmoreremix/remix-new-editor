/**
 * website-builder-session.test.js
 *
 * The Smart Website Builder SSO endpoint: paid SmartVideo (Clerk) users get a
 * one-time Supabase magic-link token; everyone else is refused. Clerk's
 * Backend API and the Supabase admin client are faked, so no network is used.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  createHandler,
  claimsHaveFeature,
  primaryVerifiedEmail,
} from '../website-builder-session.js';

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

function fakeAdmin({ existing = true, suspended = false } = {}) {
  let userExists = existing;
  const generateLink = vi.fn(async () => (userExists
    ? { data: { user: { id: 'auth-uuid-1' }, properties: { hashed_token: 'hash-abc', action_link: 'https://secret' } }, error: null }
    : { data: null, error: { status: 404, message: 'User not found' } }));
  const createUser = vi.fn(async () => { userExists = true; return { data: { user: { id: 'auth-uuid-1' } }, error: null }; });
  const single = vi.fn(async () => ({ data: { suspended }, error: null }));
  const upsert = vi.fn(() => ({ select: () => ({ single }) }));
  const client = { auth: { admin: { generateLink, createUser } }, from: vi.fn(() => ({ upsert })) };
  return { client, generateLink, createUser, upsert };
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
  it('issues a token for a paid user (Clerk Billing feature)', async () => {
    const admin = fakeAdmin();
    const handler = createHandler({ fetchImpl: fakeFetch(clerkUser()), createAdminClient: () => admin.client });
    const res = await call(handler, { userId: 'user_123', claims: { fea: 'u:smartvideo_full_access' } });
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ token_hash: 'hash-abc', type: 'email', email: 'dean@example.com' });
    expect(JSON.stringify(res.body)).not.toContain('https://secret');
    expect(admin.createUser).not.toHaveBeenCalled();
    expect(admin.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'auth-uuid-1', email: 'dean@example.com', clerk_user_id: 'user_123', full_name: 'Dean R' }),
      { onConflict: 'id' },
    );
  });

  it('accepts legacy_access customers', async () => {
    const admin = fakeAdmin();
    const handler = createHandler({
      fetchImpl: fakeFetch(clerkUser({ public_metadata: { legacy_access: true } })),
      createAdminClient: () => admin.client,
    });
    expect((await call(handler)).statusCode).toBe(200);
  });

  it('creates the Supabase auth user on first visit', async () => {
    const admin = fakeAdmin({ existing: false });
    const handler = createHandler({ fetchImpl: fakeFetch(clerkUser()), createAdminClient: () => admin.client });
    const res = await call(handler, { userId: 'user_123', claims: { fea: 'u:smartvideo_full_access' } });
    expect(res.statusCode).toBe(200);
    expect(admin.createUser).toHaveBeenCalledWith(expect.objectContaining({ email: 'dean@example.com', email_confirm: true }));
    expect(admin.generateLink).toHaveBeenCalledTimes(2);
  });

  it('refuses unpaid users with 402 and never touches Supabase', async () => {
    const admin = fakeAdmin();
    const handler = createHandler({ fetchImpl: fakeFetch(clerkUser()), createAdminClient: () => admin.client });
    const res = await call(handler);
    expect(res.statusCode).toBe(402);
    expect(res.body.error).toBe('upgrade_required');
    expect(admin.generateLink).not.toHaveBeenCalled();
  });

  it('refuses unverified email addresses', async () => {
    const admin = fakeAdmin();
    const user = clerkUser({
      public_metadata: { legacy_access: true },
      email_addresses: [{ id: 'em_1', email_address: 'victim@example.com', verification: { status: 'unverified' } }],
    });
    const handler = createHandler({ fetchImpl: fakeFetch(user), createAdminClient: () => admin.client });
    const res = await call(handler);
    expect(res.statusCode).toBe(403);
    expect(admin.generateLink).not.toHaveBeenCalled();
  });

  it('refuses suspended builder profiles', async () => {
    const admin = fakeAdmin({ suspended: true });
    const handler = createHandler({ fetchImpl: fakeFetch(clerkUser({ public_metadata: { legacy_access: true } })), createAdminClient: () => admin.client });
    expect((await call(handler)).statusCode).toBe(403);
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
