import { describe, it, expect, vi, beforeAll } from 'vitest';

// The function module builds a Supabase client at import time and the finders call out to the network: stub both.
vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    auth: { getUser: async () => ({ data: { user: null }, error: { message: 'no' } }) },
    from: () => ({ select: () => ({ eq: () => ({ gte: async () => ({ count: 0, error: null }) }) }) }),
  }),
}));
vi.mock('../../netlify/functions/_businessDiscovery.js', () => ({ findNearbyBusinesses: vi.fn(async () => ({ businesses: [{ name: 'Smith Roofing' }] })) }));
vi.mock('../../netlify/functions/_personalizationAssets.js', () => ({
  discoverBusinessAssetsFreeFirst: vi.fn(async () => ({ discoveredAssets: [] })),
  researchBusinessWebsite: vi.fn(async () => ({ name: 'Smith' })),
  downloadPersonalizationImage: vi.fn(), mirrorPersonalizationAsset: vi.fn(),
}));

let mod;
beforeAll(async () => {
  process.env.SUPABASE_URL = 'http://localhost'; process.env.SUPABASE_SERVICE_ROLE_KEY = 'x';
  mod = await import('../../netlify/functions/personalizer-api.js');
});

const call = (path, extra = {}) => mod.handler({ httpMethod: 'POST', path: `/api/personalizer${path}`, headers: { 'x-nf-client-connection-ip': extra.ip || '203.0.113.7', ...(extra.headers || {}) }, body: JSON.stringify(extra.body || {}) });

describe('personalizer-api: the free finders are open, everything else is not', () => {
  it('lets a signed-out visitor use Business Finder, research and Asset Finder', async () => {
    expect((await call('/find-businesses', { body: { location: 'Fort Lauderdale, FL' } })).statusCode).toBe(200);
    expect((await call('/research-business', { body: { websiteUrl: 'https://example.com' } })).statusCode).toBe(200);
    expect((await call('/discover-assets', { body: { websiteUrl: 'https://example.com' } })).statusCode).toBe(200);
  });

  it('still requires sign-in for scan, generate, import, download and vision', async () => {
    for (const p of ['/scan', '/generate', '/import-asset', '/download-image', '/image-analyze']) {
      expect((await call(p, { ip: '203.0.113.50', body: {} })).statusCode, p).toBe(401);
    }
  });

  it('rate limits signed-out visitors per network address, independently of each other', async () => {
    const codes = [];
    for (let i = 0; i < 12; i++) codes.push((await call('/find-businesses', { ip: '198.51.100.9', body: { location: 'Miami, FL' } })).statusCode);
    expect(codes.slice(0, 10).every((c) => c === 200)).toBe(true);
    expect(codes.slice(10)).toEqual([429, 429]);
    expect((await call('/find-businesses', { ip: '198.51.100.10', body: { location: 'Miami, FL' } })).statusCode).toBe(200);   // another visitor is unaffected
  });

  it('a bad token does not lock a visitor out of the free finders (they are treated as signed out)', async () => {
    expect((await call('/find-businesses', { ip: '192.0.2.77', headers: { authorization: 'Bearer nonsense' }, body: { location: 'Miami, FL' } })).statusCode).toBe(200);
  });
});
