// @vitest-environment node

import request from 'supertest';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import brandService from '../services/brandService.js';

const { mockAnalyzeBrand } = vi.hoisted(() => ({
  mockAnalyzeBrand: vi.fn(),
}));

vi.mock('../lib/brandAnalyzer.js', () => ({
  analyzeBrand: mockAnalyzeBrand,
}));

function mount(router, prefix = '') {
  const r = express();
  r.use(express.json());
  r.use(prefix, router);
  return r;
}

const MOCK_USER_KEY = 'fcd5a2fb05a2f8adc74a221aa47fb963e45286f177bada5ea69f65e0095186ac';
const MOCK_SERVER_KEY = 'server-muapi-key-1234567890';

describe('brandService user MuAPI key precedence', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    process.env.MUAPI_API_KEY = MOCK_SERVER_KEY;
    mockAnalyzeBrand.mockResolvedValue({
      id: 'brand-123',
      url: 'https://example.com',
      brandName: 'Test Brand',
    });
  });

  afterEach(() => {
    delete process.env.MUAPI_API_KEY;
  });

  test('returns 400 when no user key and no server key are configured', async () => {
    delete process.env.MUAPI_API_KEY;

    const res = await request(mount(brandService, '/api/brand'))
      .post('/api/brand/extract')
      .send({ url: 'https://example.com' });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('MuAPI key is required');
    expect(mockAnalyzeBrand).not.toHaveBeenCalled();
  });

  test('uses user key from X-User-Muapi-Key header when present', async () => {
    const res = await request(mount(brandService, '/api/brand'))
      .post('/api/brand/extract')
      .set('X-User-Muapi-Key', MOCK_USER_KEY)
      .send({ url: 'https://example.com' });

    expect(res.status).toBe(201);
    expect(mockAnalyzeBrand).toHaveBeenCalledWith(
      'https://example.com',
      MOCK_USER_KEY
    );
    expect(res.body.data.brandName).toBe('Test Brand');
  });

  test('falls back to server key when user key is absent', async () => {
    const res = await request(mount(brandService, '/api/brand'))
      .post('/api/brand/extract')
      .send({ url: 'https://example.com' });

    expect(res.status).toBe(201);
    expect(mockAnalyzeBrand).toHaveBeenCalledWith(
      'https://example.com',
      MOCK_SERVER_KEY
    );
    expect(res.body.data.brandName).toBe('Test Brand');
  });

  test('prefers user key over server key when both are present', async () => {
    const res = await request(mount(brandService, '/api/brand'))
      .post('/api/brand/extract')
      .set('X-User-Muapi-Key', MOCK_USER_KEY)
      .send({ url: 'https://example.com' });

    expect(res.status).toBe(201);
    expect(mockAnalyzeBrand).toHaveBeenCalledWith(
      'https://example.com',
      MOCK_USER_KEY
    );
    expect(res.body.data.brandName).toBe('Test Brand');
  });
});

describe('brandService CRUD', () => {
  test('returns 404 for missing brand', async () => {
    const res = await request(mount(brandService, '/api/brand')).get('/api/brand/nonexistent');
    expect(res.status).toBe(404);
  });

  test('returns empty array for list endpoint', async () => {
    const res = await request(mount(brandService, '/api/brand')).get('/api/brand/');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });
});
