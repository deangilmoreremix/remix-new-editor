// Regression: identity headers must reach the request on BOTH header shapes.
// Current supabase-js exposes `client.rest.headers` as a real `Headers` instance;
// assigning `headers.Authorization = ...` is silently ignored there, which made every
// "signed-in" request go out with the anonymous key (RLS never saw the user).
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../lib/apiKeyManager.js', () => ({ apiKeyManager: { getMuapiKey: () => 'k', hasMuapiKey: () => true, getKey: () => 'k' } }));
vi.mock('../lib/offline-storage.js', () => ({ offlineStorage: { getCurrentUserId: () => 'anonymous' } }));
vi.mock('../lib/userKey.js', () => ({ getUserKey: () => 'user_offlinehash' }));

const TOKEN = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1c2VyLWNsZXJrLTEiLCJleHAiOjk5OTk5OTk5OTl9.sig';

describe('primeSupabaseIdentity with the SDK header shapes', () => {
  beforeEach(() => {
    vi.resetModules();
    globalThis.window.Clerk = { loaded: true, user: { id: 'user-clerk-1' }, session: { getToken: async () => 'clerk-session-jwt' } };
    globalThis.fetch = vi.fn(async () => ({ ok: true, json: async () => ({ token: TOKEN, expires_in: 3600 }) }));
    sessionStorage.getItem.mockReturnValue?.(null);
  });
  afterEach(() => { delete window.Clerk; });

  test('Headers instances (current supabase-js) receive Authorization and x-user-key', async () => {
    const { primeSupabaseIdentity } = await import('../lib/supabase.js');
    const client = { rest: { headers: new Headers({ apikey: 'anon' }) }, storage: { headers: new Headers() } };
    await primeSupabaseIdentity(client);
    expect(client.rest.headers.get('Authorization')).toBe(`Bearer ${TOKEN}`);
    expect(client.rest.headers.get('x-user-key')).toBe('user-clerk-1');
    expect(client.storage.headers.get('Authorization')).toBe(`Bearer ${TOKEN}`);
    expect(client.rest.headers.get('apikey')).toBe('anon'); // existing headers untouched
  });

  test('plain objects (older SDKs) still work', async () => {
    const { primeSupabaseIdentity } = await import('../lib/supabase.js');
    const client = { rest: { headers: { apikey: 'anon' } }, storage: { headers: {} } };
    await primeSupabaseIdentity(client);
    expect(client.rest.headers.Authorization).toBe(`Bearer ${TOKEN}`);
    expect(client.rest.headers['x-user-key']).toBe('user-clerk-1');
  });

  test('a signed-out caller clears a stale Authorization on a Headers client', async () => {
    const { primeSupabaseIdentity } = await import('../lib/supabase.js');
    const client = { rest: { headers: new Headers({ Authorization: 'Bearer stale' }) } };
    window.Clerk = { loaded: true, user: null };
    await primeSupabaseIdentity(client);
    expect(client.rest.headers.has('Authorization')).toBe(false);
    expect(client.rest.headers.get('x-user-key')).toBe('anonymous');
  });

  test('a real supabase-js client really carries the header on the wire', async () => {
    const { createClient } = await import('@supabase/supabase-js');
    const { primeSupabaseIdentity } = await import('../lib/supabase.js');
    const seen = [];
    const client = createClient('http://db.test', 'anon-key', { global: { fetch: async (url, init) => { seen.push(new Headers(init?.headers)); return new Response('[]', { status: 200, headers: { 'Content-Type': 'application/json' } }); } } });
    await primeSupabaseIdentity(client);
    await client.from('timeline_projects').select('id');
    expect(seen[0].get('Authorization')).toBe(`Bearer ${TOKEN}`);
  });
});
