/**
 * clerkSupabaseAuth.test.js
 *
 * Clerk-verified identity for the personalization seam + the Clerk->Supabase
 * third-party-auth client wiring. Mock depth convention (from
 * src/lib/__tests__/): `../supabase.js` and `../clerkInit.js` are SIBLINGS
 * of this file — src/lib/clerkInit.js is `../clerkInit.js`, NOT
 * `../../lib/clerkInit.js`.
 *
 * Everything below is asserted against mocked modules; no network, no real
 * Clerk instance, no Supabase credentials (there are none in this repo).
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// ─── Mocked Clerk instance (via the mocked clerkInit sibling) ──────────────

const clerkState = vi.hoisted(() => ({
  userId: 'user_2verifiedclerkid',
  getTokenCalls: [],
  getTokenResult: 'clerk-session-jwt',
  throwOnGetToken: false,
  clerkAvailable: true,
}));

vi.mock('../clerkInit.js', () => ({
  getClerkInstance: () => {
    if (!clerkState.clerkAvailable) return null;
    const signedIn = Boolean(clerkState.userId);
    return {
      loaded: true,
      user: signedIn ? { id: clerkState.userId } : null,
      session: signedIn
        ? {
            user: { id: clerkState.userId },
            getToken: async (options) => {
              clerkState.getTokenCalls.push(options ?? null);
              if (clerkState.throwOnGetToken) throw new Error('ClerkOfflineError');
              return clerkState.getTokenResult;
            },
          }
        : null,
    };
  },
  ensureClerkLoaded: async () => {},
}));

const auth = await import('../personalizationAuth.js');

// ─── Clerk session state helpers ───────────────────────────────────────────

function actAs(userId) {
  clerkState.userId = userId;
  clerkState.getTokenCalls = [];
  clerkState.getTokenResult = 'clerk-session-jwt';
  clerkState.throwOnGetToken = false;
  clerkState.clerkAvailable = true;
}

function signOut() {
  actAs(null);
}

function clerkUnavailable() {
  clerkState.userId = null;
  clerkState.clerkAvailable = false;
}

beforeEach(() => {
  actAs('user_2verifiedclerkid');
});

// ─── getPersonalizationUserId: the VERIFIED Clerk id ───────────────────────

describe('getPersonalizationUserId — verified Clerk identity', () => {
  it('returns the Clerk session user id when a session exists', () => {
    expect(auth.getPersonalizationUserId()).toBe('user_2verifiedclerkid');
  });

  it('returns null when signed out (no shared anonymous bucket)', () => {
    signOut();
    expect(auth.getPersonalizationUserId()).toBeNull();
  });

  it('returns null when Clerk is not instantiated', () => {
    clerkUnavailable();
    expect(auth.getPersonalizationUserId()).toBeNull();
  });

  it('exposes readiness/signed-in only for a verified identity', () => {
    expect(auth.isPersonalizationAuthReady()).toBe(true);
    expect(auth.isPersonalizationSignedIn()).toBe(true);
    signOut();
    expect(auth.isPersonalizationAuthReady()).toBe(false);
    expect(auth.isPersonalizationSignedIn()).toBe(false);
  });
});

// ─── withPersonalizationOwner: ownership can never be forged ───────────────

describe('withPersonalizationOwner — only the verified id is ever stamped', () => {
  it('stamps the verified Clerk id', () => {
    const entry = auth.withPersonalizationOwner({ id: 'x1', sourceType: 'image' });
    expect(entry[auth.PERSONALIZATION_OWNER_FIELD]).toBe('user_2verifiedclerkid');
    expect(entry.clerkUserId).toBe('user_2verifiedclerkid');
    expect(auth.getPersonalizationOwner(entry)).toBe('user_2verifiedclerkid');
  });

  it('refuses to trust a caller-supplied (spoofed) foreign owner', () => {
    const spoofed = auth.withPersonalizationOwner({
      id: 'x2',
      clerk_user_id: 'someone-else',
      clerkUserId: 'someone-else',
    });
    expect(spoofed[auth.PERSONALIZATION_OWNER_FIELD]).toBe('user_2verifiedclerkid');
    expect(spoofed.clerkUserId).toBe('user_2verifiedclerkid');
    expect(spoofed[auth.PERSONALIZATION_OWNER_FIELD]).not.toBe('someone-else');
  });

  it('stamps no owner at all when signed out (never a fake id)', () => {
    signOut();
    const entry = auth.withPersonalizationOwner({ id: 'x3', clerk_user_id: 'someone-else' });
    expect(entry[auth.PERSONALIZATION_OWNER_FIELD]).toBeNull();
    expect(entry.clerkUserId).toBeNull();
  });

  it('never stamps a MuAPI-key hash or a client-supplied identity source', () => {
    const entry = auth.withPersonalizationOwner({ id: 'x4' });
    // The id comes from the Clerk session, nothing else.
    expect(entry[auth.PERSONALIZATION_OWNER_FIELD]).toBe(auth.getPersonalizationUserId());
    expect(entry[auth.PERSONALIZATION_OWNER_FIELD]).toBe('user_2verifiedclerkid');
  });
});

// ─── Access checks ─────────────────────────────────────────────────────────

describe('ownership checks', () => {
  it('canAccess only for rows owned by the verified id', () => {
    expect(auth.canAccess({ clerk_user_id: 'user_2verifiedclerkid' })).toBe(true);
    expect(auth.canAccess({ clerk_user_id: 'user_2someoneelse' })).toBe(false);
    // case- and whitespace-insensitive match
    expect(auth.canAccess({ clerk_user_id: '  USER_2VERIFIEDCLERKID  ' })).toBe(true);
  });

  it('a signed-out session can never access a signed-in user\'s row', () => {
    const row = { id: 'a', clerk_user_id: 'user_2verifiedclerkid' };
    expect(auth.canAccess(row)).toBe(true);
    signOut();
    expect(auth.canAccess(row)).toBe(false);
    expect(auth.filterPersonalizationEntries([row])).toEqual([]);
    expect(() => auth.assertOwner(row, 'update')).toThrow(/denied/i);
  });

  it('filterPersonalizationEntries drops foreign rows', () => {
    const visible = auth.filterPersonalizationEntries([
      { id: 'a', clerk_user_id: 'user_2verifiedclerkid' },
      { id: 'b', clerk_user_id: 'user_2someoneelse' },
    ]);
    expect(visible.map((e) => e.id)).toEqual(['a']);
  });

  it('getPersonalizationStorageKey namespaces by the verified id (signed-out gets its own bucket)', () => {
    expect(auth.getPersonalizationStorageKey('base')).toBe('base:user_2verifiedclerkid');
    signOut();
    expect(auth.getPersonalizationStorageKey('base')).toBe('base:signed-out');
  });
});

// ─── getPersonalizationAccessToken ─────────────────────────────────────────

describe('getPersonalizationAccessToken', () => {
  it('defaults to the plain Clerk session token (docs-prescribed third-party auth)', async () => {
    const token = await auth.getPersonalizationAccessToken();
    expect(token).toBe('clerk-session-jwt');
    // No JWT template: the current Clerk->Supabase integration verifies the
    // session token itself (docs: supabase.com/docs/guides/auth/third-party/clerk).
    expect(clerkState.getTokenCalls).toEqual([null]);
  });

  it('requests the `supabase` template when explicitly asked (legacy path)', async () => {
    const token = await auth.getPersonalizationAccessToken({ template: 'supabase' });
    expect(token).toBe('clerk-session-jwt');
    expect(clerkState.getTokenCalls[clerkState.getTokenCalls.length - 1]).toEqual({ template: 'supabase' });
  });

  it('returns null when signed out', async () => {
    signOut();
    expect(await auth.getPersonalizationAccessToken()).toBeNull();
    expect(clerkState.getTokenCalls).toEqual([]);
  });

  it('returns null (never throws) when Clerk is unavailable or offline', async () => {
    clerkUnavailable();
    expect(await auth.getPersonalizationAccessToken()).toBeNull();
    actAs('user_2verifiedclerkid');
    clerkState.throwOnGetToken = true;
    expect(await auth.getPersonalizationAccessToken()).toBeNull();
    clerkState.throwOnGetToken = false;
    clerkState.getTokenResult = null;
    expect(await auth.getPersonalizationAccessToken()).toBeNull();
  });
});

// ─── assertVerifiedIdentity ────────────────────────────────────────────────

describe('assertVerifiedIdentity', () => {
  it('resolves the verified id plus a fresh token', async () => {
    const identity = await auth.assertVerifiedIdentity();
    expect(identity).toEqual({
      userId: 'user_2verifiedclerkid',
      token: 'clerk-session-jwt',
      verified: true,
    });
  });

  it('throws when signed out — writes are refused, not attributed', async () => {
    signOut();
    await expect(auth.assertVerifiedIdentity()).rejects.toThrow(/no verified clerk session/i);
  });

  it('throws when a token cannot be minted for the verified session', async () => {
    clerkState.throwOnGetToken = true;
    await expect(auth.assertVerifiedIdentity()).rejects.toThrow(/could not mint/i);
  });
});

// ─── Fail-closed writes (signed out) ───────────────────────────────────────

describe('fail-closed: signed-out sessions cannot write', () => {
  it('refuses every write path when no verified identity exists', async () => {
    signOut();
    // 1. the only persistable owner is the verified id — there is none:
    const entry = auth.withPersonalizationOwner({ id: 'w1' });
    expect(entry[auth.PERSONALIZATION_OWNER_FIELD]).toBeNull();
    // 2. the persistence gate throws instead of guessing an owner:
    await expect(auth.assertVerifiedIdentity()).rejects.toThrow(/no verified clerk session/i);
    // 3. no identity token is available to send anywhere:
    expect(await auth.getPersonalizationAccessToken()).toBeNull();
    // 4. nothing owned by another user is reachable:
    expect(auth.canAccess({ clerk_user_id: 'user_2verifiedclerkid' })).toBe(false);
  });
});

// ─── supabase.js: Clerk-verified minted Supabase JWT (fail-closed) ─────────
//
// supabase.js does NOT pass an `accessToken` callback to createClient. The
// verified identity is a Supabase JWT minted by netlify/functions/supabase-token
// (sub = the verified Clerk user id) and attached as `Authorization: Bearer`
// by the header-injecting proxy. Signed-out callers never receive a bearer;
// a failed exchange fails closed for verified writes.

describe('supabase.js — Clerk-verified minted-token client wiring', () => {
  it('creates a plain client, sends the minted Supabase JWT as Authorization, and fails closed when the exchange is unavailable', async () => {
    const MINTED = 'minted-supabase-jwt';
    const originalFetch = globalThis.fetch;
    const createCalls = [];
    vi.doMock('@supabase/supabase-js', () => ({
      createClient: vi.fn((url, key, options) => {
        createCalls.push({ url, key, options });
        return {
          rest: { headers: {} },
          storage: {
            headers: {},
            from: () => ({ upload: async () => ({}), getPublicUrl: () => ({ data: { publicUrl: null } }) }),
          },
          from: () => ({}),
          auth: { getSession: async () => ({ data: { session: null } }) },
        };
      }),
    }));

    const signInAs = (userId) => {
      window.Clerk = {
        loaded: true,
        user: { id: userId },
        session: { getToken: async () => 'clerk-session-jwt' },
      };
    };

    try {
      // ── 1. Signed in, token exchange succeeds ─────────────────────────────
      signInAs('user_2verifiedclerkid');
      globalThis.fetch = vi.fn(async () => ({
        ok: true,
        json: async () => ({ token: MINTED, expires_in: 3600 }),
      }));
      window.sessionStorage.clear();
      vi.resetModules();
      const { supabase, rawClient, primeSupabaseIdentity, getSupabaseAccessToken, assertVerifiedWriteIdentity } =
        await import('../supabase.js');

      // No Clerk accessToken callback: the minted-token path is the only
      // source of Authorization.
      expect(createCalls).toHaveLength(1);
      expect(createCalls[0].options.auth.accessToken).toBeUndefined();

      // The Clerk session token is presented to the token exchange, which
      // returns the minted Supabase JWT.
      expect(await primeSupabaseIdentity(rawClient)).toBe(MINTED);
      expect(globalThis.fetch).toHaveBeenCalledTimes(1);
      const [endpoint, init] = globalThis.fetch.mock.calls[0];
      expect(String(endpoint)).toMatch(/supabase-token/);
      expect(init.headers.Authorization).toBe('Bearer clerk-session-jwt');

      // Requests carry the minted bearer plus the verified x-user-key.
      expect(rawClient.rest.headers.Authorization).toBe(`Bearer ${MINTED}`);
      expect(rawClient.rest.headers['x-user-key']).toBe('user_2verifiedclerkid');
      expect(rawClient.storage.headers.Authorization).toBe(`Bearer ${MINTED}`);

      // The header-injecting proxy re-applies the bearer on every access.
      delete rawClient.rest.headers.Authorization;
      supabase.from('media');
      expect(rawClient.rest.headers.Authorization).toBe(`Bearer ${MINTED}`);

      // A real Supabase Auth client is still grafted for existing flows.
      const { data } = await supabase.auth.getSession();
      expect(data.session).toBeNull();

      // The verified-write gate passes when a minted token exists.
      await expect(assertVerifiedWriteIdentity('user_2verifiedclerkid')).resolves.toBeUndefined();
      expect(await getSupabaseAccessToken()).toBe(MINTED);

      // ── 2. Signed out: no forged bearer, anonymous scope only ─────────────
      window.Clerk = { loaded: true, user: null };
      globalThis.fetch.mockClear();
      expect(await primeSupabaseIdentity(rawClient)).toBeNull();
      expect(rawClient.rest.headers.Authorization).toBeUndefined();
      expect(rawClient.rest.headers['x-user-key']).toBe('anonymous');
      expect(globalThis.fetch).not.toHaveBeenCalled();
      await expect(assertVerifiedWriteIdentity('anonymous')).resolves.toBeUndefined();

      // ── 3. Fail closed: signed in, exchange unavailable ───────────────────
      signInAs('user_2verifiedclerkid');
      globalThis.fetch = vi.fn(async () => ({ ok: false, status: 500, json: async () => ({}) }));
      window.sessionStorage.clear();
      vi.resetModules();
      const failClosed = await import('../supabase.js');
      expect(await failClosed.primeSupabaseIdentity(failClosed.rawClient)).toBeNull();
      expect(failClosed.rawClient.rest.headers.Authorization).toBeUndefined();
      await expect(failClosed.assertVerifiedWriteIdentity('user_2verifiedclerkid'))
        .rejects.toMatchObject({ code: 'SECURE_SESSION_UNAVAILABLE' });
    } finally {
      delete window.Clerk;
      globalThis.fetch = originalFetch;
      vi.doUnmock('@supabase/supabase-js');
      vi.resetModules();
    }
  });
});
