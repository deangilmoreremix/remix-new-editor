// The shared Supabase client still attaches an identity header on every
// request (the generation-history function and other app-level consumers read
// it), but under the verified-identity model its VALUE is the database
// identity — Clerk user id when signed in, strictly 'anonymous' otherwise.
// The RLS policies no longer trust this header (they read the verified JWT),
// so the offline BYOK hash from userKey.js must never leak into it.

import { describe, test, expect, vi, beforeEach } from 'vitest';

vi.mock('../lib/apiKeyManager.js', () => ({
  apiKeyManager: {
    getMuapiKey: () => 'test-muapi-key',
    hasMuapiKey: () => true,
    getKey: () => 'test-muapi-key',
  },
}));

// The offline BYOK hash exists (a MuAPI key is configured) — prove it is NOT
// what the shared client sends.
vi.mock('../lib/userKey.js', () => ({
  getUserKey: () => 'user_offlinehash',
}));

function setClerkUser(user) {
  globalThis.window.Clerk = user ? { user: { id: user } } : {};
}

describe('shared Supabase client identity header', () => {
  beforeEach(() => {
    setClerkUser(null);
  });

  test('signed-in callers send their Clerk user id', async () => {
    setClerkUser('user-clerk-42');
    const { supabase } = await import('../lib/supabase.js');
    supabase.from('media');
    supabase.storage.from('uploads');
    expect(supabase.rest.headers['x-user-key']).toBe('user-clerk-42');
    expect(supabase.storage.headers['x-user-key']).toBe('user-clerk-42');
  });

  test('signed-out callers are strictly anonymous — never the offline BYOK hash', async () => {
    setClerkUser(null);
    const { supabase } = await import('../lib/supabase.js');
    supabase.from('media');
    supabase.storage.from('uploads');
    expect(supabase.rest.headers['x-user-key']).toBe('anonymous');
    expect(supabase.storage.headers['x-user-key']).toBe('anonymous');
    expect(supabase.rest.headers['x-user-key']).not.toBe('user_offlinehash');
  });

  test('refreshSupabaseUserHeader follows a sign-in change', async () => {
    const { supabase, refreshSupabaseUserHeader } = await import('../lib/supabase.js');
    setClerkUser('user-clerk-1');
    refreshSupabaseUserHeader();
    expect(supabase.rest.headers['x-user-key']).toBe('user-clerk-1');
    setClerkUser('user-clerk-2');
    refreshSupabaseUserHeader();
    expect(supabase.rest.headers['x-user-key']).toBe('user-clerk-2');
    setClerkUser(null);
    refreshSupabaseUserHeader();
    expect(supabase.rest.headers['x-user-key']).toBe('anonymous');
  });
});
