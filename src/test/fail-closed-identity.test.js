// Fail-closed identity guard (security regression suite).
//
// The `x-user-key` header is client-controlled and is no longer trusted by any
// RLS policy, so a signed-in caller whose verified Supabase token cannot be
// obtained must NOT silently degrade to that header identity — a broken token
// exchange would otherwise turn authenticated writes into unauthenticated
// ones. Conversely, durable Asset Library saves require a real account so the
// shared 'anonymous' owner never pools permanent files.

import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';

const BYOK_KEY = 'test-muapi-key-abc';

vi.mock('../lib/apiKeyManager.js', () => ({
  apiKeyManager: {
    getMuapiKey: () => 'test-muapi-key-abc',
    hasMuapiKey: () => true,
    getKey: () => 'test-muapi-key-abc',
  },
}));

const offline = { id: 'anonymous' };
vi.mock('../lib/offline-storage.js', () => ({
  offlineStorage: {
    getCurrentUserId: () => offline.id,
  },
}));

vi.mock('../lib/userKey.js', () => ({
  getUserKey: () => 'user_offlinehash',
}));

function signedIn(userId = 'user-clerk-1') {
  globalThis.window.Clerk = {
    loaded: true,
    user: { id: userId },
    session: { getToken: async () => 'clerk-session-jwt' },
  };
}

function signedOut() {
  globalThis.window.Clerk = { loaded: true, user: null };
}

describe('assertVerifiedWriteIdentity', () => {
  beforeEach(() => {
    vi.resetModules();
    signedOut();
    globalThis.fetch = vi.fn(async () => ({
      ok: true,
      json: async () => ({ token: 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1c2VyLWNsZXJrLTEifQ.sig', expires_in: 3600 }),
    }));
  });

  afterEach(() => {
    delete window.Clerk;
  });

  test('anonymous callers are a no-op (no exchange, no throw)', async () => {
    const { assertVerifiedWriteIdentity } = await import('../lib/supabase.js');
    await expect(assertVerifiedWriteIdentity('anonymous')).resolves.toBeUndefined();
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  test('signed-in caller with a working exchange resolves and attaches the bearer token', async () => {
    signedIn();
    const { assertVerifiedWriteIdentity, supabase } = await import('../lib/supabase.js');
    await expect(assertVerifiedWriteIdentity('user-clerk-1')).resolves.toBeUndefined();
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    // The proxy attaches the verified identity on the next client access.
    supabase.from('media');
    expect(supabase.rest.headers.Authorization).toMatch(/^Bearer /);
    expect(supabase.rest.headers['x-user-key']).toBe('user-clerk-1');
  });

  test('signed-in caller with a FAILED exchange throws SECURE_SESSION_UNAVAILABLE (fail closed)', async () => {
    signedIn();
    globalThis.fetch = vi.fn(async () => ({ ok: false, status: 500, json: async () => ({}) }));
    const { assertVerifiedWriteIdentity, supabase } = await import('../lib/supabase.js');
    await expect(assertVerifiedWriteIdentity('user-clerk-1')).rejects.toMatchObject({
      code: 'SECURE_SESSION_UNAVAILABLE',
    });
    // No usable bearer identity is attached — the write must not proceed.
    supabase.from('media');
    expect(supabase.rest.headers.Authorization).toBeUndefined();
  });

  test('signed-in caller with no Clerk session token also fails closed', async () => {
    globalThis.window.Clerk = { loaded: true, user: { id: 'user-clerk-1' }, session: { getToken: async () => null } };
    const { assertVerifiedWriteIdentity } = await import('../lib/supabase.js');
    await expect(assertVerifiedWriteIdentity('user-clerk-1')).rejects.toMatchObject({
      code: 'SECURE_SESSION_UNAVAILABLE',
    });
  });
});

describe('saveAsset fail-closed wiring', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  test('propagates SECURE_SESSION_UNAVAILABLE and writes nothing', async () => {
    vi.doMock('../lib/supabase.js', () => ({
      supabase: {
        storage: { from: () => ({ upload: vi.fn(), remove: vi.fn(), getPublicUrl: vi.fn() }) },
        from: () => ({ select: () => ({ eq: () => ({ order: async () => ({ data: [], error: null }) }) }) }),
      },
      isSupabaseConfigured: () => true,
      getUserKey: async () => 'user-clerk-1',
      primeSupabaseIdentity: vi.fn(async () => null),
      assertVerifiedWriteIdentity: vi.fn(async () => {
        const err = new Error('Secure session unavailable');
        err.code = 'SECURE_SESSION_UNAVAILABLE';
        throw err;
      }),
    }));
    const { saveAsset } = await import('../lib/assetLibrary.js');
    const file = new File(['x'.repeat(2048)], 'clip.mp4', { type: 'video/mp4' });
    await expect(saveAsset(file, { userId: 'user-clerk-1', workspaceId: 'personal' })).rejects.toMatchObject({
      code: 'SECURE_SESSION_UNAVAILABLE',
    });
  });
});
