import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Signed-in session whose token exchange fails: the reason must be reported, not swallowed.
describe('getSupabaseAccessToken failure reasons', () => {
  beforeEach(() => {
    vi.resetModules();
    try { sessionStorage.clear(); } catch { /* ignore */ }
    window.Clerk = { user: { id: 'user_1' }, session: { getToken: async () => 'clerk-jwt' } };
  });
  afterEach(() => { delete window.Clerk; vi.unstubAllGlobals(); });

  const run = async (response) => {
    vi.stubGlobal('fetch', vi.fn(async () => response));
    const m = await import('../supabase.js');
    const token = await m.getSupabaseAccessToken({ forceRefresh: true });
    return { token, reason: m.getTokenExchangeFailure() };
  };

  it('503 names the missing SUPABASE_JWT_SECRET', async () => {
    const r = await run({ ok: false, status: 503, json: async () => ({}) });
    expect(r.token).toBeNull();
    expect(r.reason).toMatch(/SUPABASE_JWT_SECRET/);
  });

  it('401 points at the Clerk configuration', async () => {
    const r = await run({ ok: false, status: 401, json: async () => ({}) });
    expect(r.reason).toMatch(/Clerk/);
  });

  it('404 says the function is not deployed', async () => {
    const r = await run({ ok: false, status: 404, json: async () => ({}) });
    expect(r.reason).toMatch(/not deployed/);
  });

  it('success returns the token and clears the reason', async () => {
    const payload = btoa(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 }));
    const r = await run({ ok: true, status: 200, json: async () => ({ token: `h.${payload}.s`, expires_in: 3600 }) });
    expect(r.token).toBeTruthy();
    expect(r.reason).toBeNull();
  });
});
