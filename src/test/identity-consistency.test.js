// Identity consistency across every writer path (blocker B).
//
// The same signed-in user must resolve to ONE owner id everywhere:
// authContext.js, supabase.js (client request identity),
// hybrid-supabase.js (offline sync writer) and muapiStudioMedia.js (studio
// bridge). Before this fix some paths wrote a hashed 'user_xxx' key from
// userKey.js while others wrote the Clerk user id, so a signed-in user's own
// rows became invisible/unwritable.
//
// This suite asserts the agreement for both identity kinds:
//   - signed in (Clerk session present): every path produces the Clerk id,
//     even when a BYOK key is stored (the hash fallback must never win)
//   - anonymous: every path produces the shared local identity

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';

// Deterministic local identity for the anonymous case (userKey.js is the
// last hop: offlineStorage user id → hashed BYOK key → 'anonymous').
const localIdentity = { value: 'anonymous' };

vi.mock('../lib/userKey.js', () => ({
  getUserKey: () => localIdentity.value,
}));

// offline-storage instantiates an IndexedDB service at module scope; the
// mock keeps the suite hermetic (offlineStorage is only read for the
// current user id inside these paths).
vi.mock('../lib/offline-storage.js', () => ({
  offlineStorage: {
    getCurrentUserId: () => 'anonymous',
    exportData: async () => ({ projects: [], media: [], generations: [] }),
    saveMedia: async () => ({}),
    saveProject: async () => ({}),
    saveGeneration: async () => ({}),
    loadMedia: async () => null,
    loadProject: async () => null,
    listMedia: async () => [],
    listProjects: async () => [],
    listGenerations: async () => [],
    deleteProject: async () => {},
  },
}));

import { getAuthContext, getAuthContextSync } from '../lib/authContext.js';
import { getUserKey } from '../lib/supabase.js';
import { getUserKey as getHybridUserKey } from '../lib/hybrid-supabase.js';
import { getMuapiAuthContext } from '../lib/muapiStudioMedia.js';

function signedIn(clerkId = 'user_2xKd9Qm4') {
  window.Clerk = {
    loaded: true,
    user: { id: clerkId },
    session: { getToken: async () => 'clerk-session-jwt' },
  };
}

function signedOut() {
  window.Clerk = { loaded: true, user: null };
}

beforeEach(() => {
  localIdentity.value = 'anonymous';
  signedOut();
});

afterEach(() => {
  delete window.Clerk;
  vi.restoreAllMocks();
});

describe('identity — signed-in callers', () => {
  test('authContext, supabase client, hybrid client and studio bridge all resolve the Clerk user id', async () => {
    signedIn('user_clerk_42');

    const syncCtx = getAuthContextSync();
    const asyncCtx = await getAuthContext();

    expect(syncCtx.userId).toBe('user_clerk_42');
    expect(asyncCtx.userId).toBe('user_clerk_42');
    expect(await getUserKey()).toBe('user_clerk_42');
    expect(await getHybridUserKey()).toBe('user_clerk_42');
    expect((await getMuapiAuthContext()).userId).toBe('user_clerk_42');
  });

  test('a stored BYOK key never overrides the Clerk identity (no user_xxx drift)', async () => {
    // Simulate the local hash fallback being available while signed in.
    localIdentity.value = 'user_1a2b3c4d5e';
    signedIn('user_clerk_42');

    const ctx = getAuthContextSync();
    expect(await getUserKey()).toBe('user_clerk_42');
    expect(await getHybridUserKey()).toBe('user_clerk_42');
    expect((await getMuapiAuthContext()).userId).toBe('user_clerk_42');
    // The hashed key exists locally but is not the owner identity.
    expect(localIdentity.value).not.toBe(ctx.userId);
  });

  test('signed-out callers resolve the shared local identity on every path', async () => {
    localIdentity.value = 'anonymous';
    const ctx = getAuthContextSync();
    expect(ctx.userId).toBe('anonymous');
    expect(ctx.isAnonymous).toBe(true);
    expect(await getUserKey()).toBe('anonymous');
    expect(await getHybridUserKey()).toBe('anonymous');
    expect((await getMuapiAuthContext()).userId).toBe('anonymous');
  });

  test('sign-out switches the request identity back to the local identity', async () => {
    signedIn('user_clerk_42');
    expect(await getUserKey()).toBe('user_clerk_42');
    signedOut();
    expect(await getUserKey()).toBe('anonymous');
  });

  test('the token-exchange identity matches the client identity contract', async () => {
    // netlify/functions/supabase-token.js mints sub from the verified Clerk
    // session; assert the client contract those claims must satisfy.
    signedIn('user_clerk_42');
    const { validateSupabaseTokenClaims } = await import('../../netlify/functions/_shared/clerkAuth.js');
    const ctx = getAuthContextSync();
    const claims = validateSupabaseTokenClaims({
      sub: ctx.userId,
      workspace_id: ctx.workspaceId,
      role: 'authenticated',
    });
    expect(claims.ok).toBe(true);
    expect(claims.sub).toBe('user_clerk_42');
    expect(claims.workspaceId).toBe('personal');
  });
});
