// @vitest-environment node
/**
 * The MCP runs the app's real Lead Finder / discovery route handlers as the key's owner. These tests run those real handlers
 * (Supabase and network faked) and check that: the injected user is what they see, nothing else can change it, only allow-listed
 * routes run, and an unsigned caller is refused.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// The routes validate (and cache) their configuration on first use, so it must be present before anything is imported.
vi.hoisted(() => {
  Object.assign(process.env, { NEXT_PUBLIC_SUPABASE_URL: 'https://x.supabase.co', SUPABASE_URL: 'https://x.supabase.co', NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon'.repeat(10), SUPABASE_SERVICE_ROLE_KEY: 'k'.repeat(40), INTERNAL_FUNCTION_SECRET: 's'.repeat(32) });
});

const rpc = vi.fn();
vi.mock('../../netlify/functions/_personalization/src/lib/supabase', () => ({
  createServerClient: () => ({ rpc: (...a) => rpc(...a), from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null }) }) }) }) }),
}));
vi.mock('../../netlify/functions/_shared/clerkAuth.js', () => ({ verifyClerkToken: vi.fn(async () => ({ userId: 'attacker_from_header', claims: {} })) }));

const { runPersonalizationRoute, resolveRoute, ALLOWED_ROUTES } = await import('../../netlify/functions/_shared/personalizationRun.mts');

beforeEach(() => { rpc.mockReset(); });

describe('route allow-list', () => {
  it('resolves only the Lead Finder / discovery routes', () => {
    for (const p of ['/leads', '/leads/abc_123', '/find-businesses', '/research-business', '/discover-assets', '/discover-assets/status', '/enrich-business', '/resolve-website', '/demo/discover']) expect(resolveRoute(p), p).toBeTruthy();
    for (const p of ['/project', '/image-edit', '/record', '/persist-edited-asset', '/leads/a/b', '/leads/a b', '/leads/..', '/constructor', '/__proto__', '/hasOwnProperty', '']) expect(resolveRoute(p), p).toBeNull();
    expect(ALLOWED_ROUTES).toContain('/leads/:id');
  });
});

describe('runPersonalizationRoute', () => {
  it('refuses with no signed-in owner and for unknown routes / methods', async () => {
    expect((await runPersonalizationRoute({ method: 'GET', path: '/leads' }, undefined)).statusCode).toBe(401);
    expect((await runPersonalizationRoute({ method: 'GET', path: '/project' }, { userId: 'u1' })).statusCode).toBe(404);
    expect((await runPersonalizationRoute({ method: 'DELETE', path: '/leads' }, { userId: 'u1' })).statusCode).toBe(405);
  });

  it('lists leads for the injected owner, ignoring any identity the request carries', async () => {
    rpc.mockResolvedValue({ data: [{ id: 'l1', stage: 'New' }], error: null });
    const out = await runPersonalizationRoute({ method: 'GET', path: '/leads' }, { userId: 'owner_1' });
    expect(out.statusCode).toBe(200);
    expect(rpc).toHaveBeenCalledWith('lead_finder_leads_list', { p_clerk_user_id: 'owner_1' });
    expect(JSON.stringify(rpc.mock.calls)).not.toContain('attacker_from_header');
  });

  it('runs the real validation: a bad stage and a bad business are 400 before the database', async () => {
    const bad = await runPersonalizationRoute({ method: 'POST', path: '/leads', body: { business: { id: 'b1', name: 'Acme' }, stage: 'Nope' } }, { userId: 'owner_1' });
    expect(bad.statusCode).toBe(400);
    expect(JSON.parse(bad.body).error).toMatch(/stage/i);
    const bad2 = await runPersonalizationRoute({ method: 'POST', path: '/leads', body: { business: { id: '' } } }, { userId: 'owner_1' });
    expect(bad2.statusCode).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
  });

  it('validates find-businesses and discovery inputs without any network call', async () => {
    const niche = await runPersonalizationRoute({ method: 'POST', path: '/find-businesses', body: { niche: 'not-a-niche', location: 'Austin, TX' } }, { userId: 'owner_1' });
    expect(niche.statusCode).toBe(400);
    expect(JSON.parse(niche.body).error).toMatch(/Supported niches/i);
    const noLoc = await runPersonalizationRoute({ method: 'POST', path: '/find-businesses', body: { niche: 'dentist' } }, { userId: 'owner_1' });
    expect(noLoc.statusCode).toBe(400);
    const noUrl = await runPersonalizationRoute({ method: 'POST', path: '/discover-assets', body: {} }, { userId: 'owner_1' });
    expect(noUrl.statusCode).toBe(400);
    const noJob = await runPersonalizationRoute({ method: 'GET', path: '/discover-assets/status' }, { userId: 'owner_1' });
    expect(noJob.statusCode).toBe(400);
  });

  it('updates only what is allowed on a lead', async () => {
    const r = await runPersonalizationRoute({ method: 'PATCH', path: '/leads/abc', body: {} }, { userId: 'owner_1' });
    expect(r.statusCode).toBe(400);
    const r2 = await runPersonalizationRoute({ method: 'PATCH', path: '/leads/abc', body: { starred: 'yes' } }, { userId: 'owner_1' });
    expect(r2.statusCode).toBe(400);
  });
});
