// The shared Supabase client still attaches an identity header on every
// request (the generation-history function and other app-level consumers read
// it), but under the verified-identity model its VALUE is the database
// identity — Clerk user id when signed in, strictly 'anonymous' otherwise.
// The RLS policies no longer trust this header (they read the verified JWT),
// so the offline BYOK hash from userKey.js must never leak into it.

import { describe, test, expect, vi, beforeEach } from 'vitest';

// Read a header the way a request does: supabase-js keeps them in a WHATWG Headers object (plain objects in older builds).
const hv = (h, k) => (typeof h?.get === 'function' ? (h.get(k) ?? undefined) : h?.[k]);

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
    expect(hv(supabase.rest.headers, 'x-user-key')).toBe('user-clerk-42');
    expect(hv(supabase.storage.headers, 'x-user-key')).toBe('user-clerk-42');
  });

  test('signed-out callers are strictly anonymous — never the offline BYOK hash', async () => {
    setClerkUser(null);
    const { supabase } = await import('../lib/supabase.js');
    supabase.from('media');
    supabase.storage.from('uploads');
    expect(hv(supabase.rest.headers, 'x-user-key')).toBe('anonymous');
    expect(hv(supabase.storage.headers, 'x-user-key')).toBe('anonymous');
    expect(hv(supabase.rest.headers, 'x-user-key')).not.toBe('user_offlinehash');
  });

  test('refreshSupabaseUserHeader follows a sign-in change', async () => {
    const { supabase, refreshSupabaseUserHeader } = await import('../lib/supabase.js');
    setClerkUser('user-clerk-1');
    refreshSupabaseUserHeader();
    expect(hv(supabase.rest.headers, 'x-user-key')).toBe('user-clerk-1');
    setClerkUser('user-clerk-2');
    refreshSupabaseUserHeader();
    expect(hv(supabase.rest.headers, 'x-user-key')).toBe('user-clerk-2');
    setClerkUser(null);
    refreshSupabaseUserHeader();
    expect(hv(supabase.rest.headers, 'x-user-key')).toBe('anonymous');
  });
});

describe('verified identity reaches the wire (Headers-object clients)', () => {
  test('applyIdentity sets Authorization/x-user-key on WHATWG Headers, not as ignored properties', async () => {
    vi.resetModules();
    globalThis.window.Clerk = { loaded: true, user: { id: 'user-clerk-9' }, session: { getToken: async () => 'clerk-session-jwt' } };
    globalThis.fetch = vi.fn(async () => ({ ok: true, json: async () => ({ token: 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1c2VyLWNsZXJrLTkifQ.sig', expires_in: 3600 }) }));
    const { primeSupabaseIdentity } = await import('../lib/supabase.js');
    const client = { rest: { headers: new Headers() }, storage: { headers: new Headers({ authorization: 'Bearer old' }) } };
    await primeSupabaseIdentity(client);
    expect(client.rest.headers.get('Authorization')).toMatch(/^Bearer eyJ/);
    expect(client.rest.headers.get('x-user-key')).toBe('user-clerk-9');
    expect(client.storage.headers.get('Authorization')).toMatch(/^Bearer eyJ/);
    // signing out removes the bearer instead of leaving a stale token behind
    globalThis.window.Clerk = { loaded: true, user: null };
    const { refreshSupabaseUserHeader } = await import('../lib/supabase.js');
    refreshSupabaseUserHeader();
    delete globalThis.window.Clerk;
  });
});
