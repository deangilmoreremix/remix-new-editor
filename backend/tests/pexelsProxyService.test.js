// @vitest-environment node

import request from 'supertest';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';

function mount(router, prefix = '') {
  const r = express();
  r.use(express.json());
  r.use(prefix, router);
  return r;
}

const mockPhotoResponse = {
  photos: [{
    id: 123,
    width: 1000,
    height: 800,
    url: 'https://www.pexels.com/photo/123/',
    photographer: 'Test Photographer',
    photographer_url: 'https://www.pexels.com/@test',
    photographer_id: 1,
    avg_color: '#ffffff',
    src: { original: 'https://images.pexels.com/photos/123/pexels-photo-123.jpeg' },
    alt: 'Test Photo',
  }],
  total_results: 1,
  page: 1,
  per_page: 1,
};

function createAxiosMock(data, status = 200, headers = {}) {
  return vi.fn(() => Promise.resolve({ status, data, headers }));
}

async function loadService(axiosMock) {
  vi.doMock('axios', () => ({ default: axiosMock }));
  const mod = await import('../services/pexelsProxyService.js');
  return mod.default;
}

describe('pexelsProxyService', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.resetModules();
    process.env.PEXELS_API_KEY = 'test-server-key';
  });

  it('returns 500 when no Pexels API key is configured', async () => {
    delete process.env.PEXELS_API_KEY;
    const service = await loadService(createAxiosMock(mockPhotoResponse));
    const res = await request(mount(service, '/api/pexels')).get('/api/pexels/photos/search?query=nature');
    expect(res.status).toBe(500);
    expect(res.body.ok).toBe(false);
    expect(res.body.error.message).toMatch(/No Pexels API key/);
  });

  it('forwards search params and returns mocked photo data', async () => {
    const service = await loadService(createAxiosMock(mockPhotoResponse));
    const res = await request(mount(service, '/api/pexels')).get('/api/pexels/photos/search?query=nature&per_page=1');
    expect(res.status).toBe(200);
    expect(res.body.photos).toHaveLength(1);
    expect(res.body.photos[0].id).toBe(123);
  });

  it('returns 429 when upstream returns rate limit', async () => {
    const service = await loadService(createAxiosMock({}, 429));
    const res = await request(mount(service, '/api/pexels')).get('/api/pexels/photos/search?query=nature');
    expect(res.status).toBe(429);
    expect(res.body.error.code).toBe('RATE_LIMITED');
  });

  it('forwards rate-limit headers to client', async () => {
    const service = await loadService(createAxiosMock(mockPhotoResponse, 200, {
      'x-ratelimit-limit': '20000',
      'x-ratelimit-remaining': '19999',
      'x-ratelimit-reset': '1234567890',
    }));
    const res = await request(mount(service, '/api/pexels')).get('/api/pexels/photos/search?query=nature');
    expect(res.status).toBe(200);
    expect(res.body._rateLimit).toEqual({ limit: '20000', remaining: '19999', reset: '1234567890' });
  });

  it('returns 502 on upstream 500 error', async () => {
    const service = await loadService(createAxiosMock({ message: 'Server error' }, 500));
    const res = await request(mount(service, '/api/pexels')).get('/api/pexels/photos/search?query=nature');
    expect(res.status).toBe(502);
    expect(res.body.error.code).toBe('PEXELS_UPSTREAM_ERROR');
  });
});
