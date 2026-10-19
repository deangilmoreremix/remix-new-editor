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

// ─── supabase.js: created with the Clerk accessToken callback ──────────────

describe('supabase.js — Clerk third-party auth client wiring', () => {
  it('is created with an accessToken callback that returns the Clerk token', async () => {
    const createCalls = [];
    vi.doMock('@supabase/supabase-js', () => ({
      createClient: vi.fn((url, key, options) => {
        createCalls.push({ url, key, options });
        return {
          auth: { getSession: async () => ({ data: { session: null } }) },
          storage: { from: () => ({ upload: async () => ({}), getPublicUrl: () => ({ data: { publicUrl: null } }) }) },
        };
      }),
    }));
    vi.resetModules();
    const { supabase } = await import('../supabase.js');

    // The main client is created WITH the Clerk accessToken callback.
    const main = createCalls.find((c) => c.options?.auth?.accessToken);
    expect(main, 'createClient must be called with auth.accessToken').toBeTruthy();
    expect(typeof main.options.auth.accessToken).toBe('function');

    // ...and that callback resolves the Clerk session token.
    const token = await main.options.auth.accessToken();
    expect(token).toBe('clerk-session-jwt');
    expect(clerkState.getTokenCalls).toContain(null); // plain session token, no template

    // A real Supabase Auth client is grafted so supabase.auth.getSession()
    // keeps working for the existing Supabase-session flows.
    expect(supabase).toBeTruthy();
    const { data } = await supabase.auth.getSession();
    expect(data.session).toBeNull();

    // Signed out, the callback falls back to the (null) Supabase session,
    // i.e. the anon key — never a forged Clerk token.
    signOut();
    expect(await main.options.auth.accessToken()).toBeNull();

    vi.doUnmock('@supabase/supabase-js');
    vi.resetModules();
  });
});
