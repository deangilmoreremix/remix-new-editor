import { beforeEach, describe, expect, it, vi } from 'vitest';

const getSession = vi.fn(async () => ({
  data: { session: { access_token: 'test-access-token' } },
}));

vi.mock('../lib/supabase.js', () => ({
  supabase: {
    auth: { getSession },
  },
}));

import { findBusinesses } from '../lib/personalization/businessDiscoveryService.js';
import { discoverBusinessAssets } from '../lib/personalization/assetDiscoveryService.js';
import { analyzePersonalizationImages } from '../lib/personalization/visionService.js';

describe('personalization authenticated service clients', () => {
  beforeEach(() => {
    getSession.mockClear();
    vi.restoreAllMocks();
  });

  it('uses the shared Supabase session for business discovery', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ businesses: [] }),
    });

    await findBusinesses({
      niche: 'general-business',
      location: 'Fort Lauderdale, FL',
      radiusMiles: 10,
      limit: 5,
    });

    expect(getSession).toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/personalizer/find-businesses',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer test-access-token',
        }),
      }),
    );
  });

  it('uses the shared Supabase session for website asset discovery', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ discoveredAssets: [] }),
    });

    await discoverBusinessAssets({ websiteUrl: 'https://example.com' });

    expect(getSession).toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/personalizer/discover-assets',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer test-access-token',
        }),
      }),
    );
  });

  it('uses the shared Supabase session for paid Vision analysis', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ analyses: [{ id: 'asset-1', category: 'logo' }] }),
    });

    const analyses = await analyzePersonalizationImages({
      images: [{
        id: 'asset-1',
        imageUrl: 'https://example.com/logo.png',
        categoryHint: 'logo',
      }],
    });

    expect(analyses).toHaveLength(1);
    expect(getSession).toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/personalizer/image-analyze',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer test-access-token',
        }),
      }),
    );
  });
});
