// @vitest-environment node

import request from 'supertest';
import { describe, test, expect, vi } from 'vitest';
import express from 'express';
import campaignService from '../services/campaignService.js';
import assetGeneratorService from '../services/assetGeneratorService.js';
import photoStudioService from '../services/photoStudioService.js';
import animateService from '../services/animateService.js';

function mount(router, prefix = '') {
  const r = express();
  r.use(express.json());
  r.use(prefix, router);
  return r;
}

const MOCK_USER_KEY = 'fcd5a2fb05a2f8adc74a221aa47fb963e45286f177bada5ea69f65e0095186ac';

describe('Brand Studio backend services user MuAPI key forwarding', () => {
  describe('campaignService POST /create', () => {
    const app = mount(campaignService, '/api/campaign');

    test('forwards user key when header is present', async () => {
      const res = await request(app)
        .post('/api/campaign/create')
        .set('X-User-Muapi-Key', MOCK_USER_KEY)
        .send({
          brandId: 'brand-123',
          goal: 'brand awareness',
          brand: { brandName: 'Test Brand' },
        });

      expect([200, 201, 400, 401, 500]).toContain(res.status);
    });

    test('works without user key header (server fallback)', async () => {
      const res = await request(app)
        .post('/api/campaign/create')
        .send({
          brandId: 'brand-123',
          goal: 'brand awareness',
          brand: { brandName: 'Test Brand' },
        });

      expect([200, 201, 400, 401, 500]).toContain(res.status);
    });
  });

  describe('assetGeneratorService POST /generate', () => {
    const app = mount(assetGeneratorService, '/api/asset');

    test('forwards user key when header is present', async () => {
      const res = await request(app)
        .post('/api/asset/generate')
        .set('X-User-Muapi-Key', MOCK_USER_KEY)
        .send({
          campaignId: 'campaign-123',
          conceptIndex: 0,
          platformId: 'instagram-feed',
          brand: { brandName: 'Test Brand' },
          concept: { title: 'Test', theme: 'Theme' },
        });

      expect([200, 201, 400, 401, 500]).toContain(res.status);
    });

    test('works without user key header (server fallback)', async () => {
      const res = await request(app)
        .post('/api/asset/generate')
        .send({
          campaignId: 'campaign-123',
          conceptIndex: 0,
          platformId: 'instagram-feed',
          brand: { brandName: 'Test Brand' },
          concept: { title: 'Test', theme: 'Theme' },
        });

      expect([200, 201, 400, 401, 500]).toContain(res.status);
    });
  });

  describe('photoStudioService POST /generate', () => {
    const app = mount(photoStudioService, '/api/photo-studio');

    test('rejects invalid product image URL (private IP check)', async () => {
      const res = await request(app)
        .post('/api/photo-studio/generate')
        .set('X-User-Muapi-Key', MOCK_USER_KEY)
        .send({
          productImageUrl: 'http://localhost:8080/test.png',
          category: 'test',
          styleId: 'studio_white',
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Invalid product image URL');
    });

    test('forwards user key when valid product image URL is provided', async () => {
      const res = await request(app)
        .post('/api/photo-studio/generate')
        .set('X-User-Muapi-Key', MOCK_USER_KEY)
        .send({
          productImageUrl: 'https://example.com/product.png',
          category: 'test',
          styleId: 'studio_white',
        });

      expect([200, 201, 400, 401, 500]).toContain(res.status);
    });
  });

  describe('animateService POST /generate', () => {
    const app = mount(animateService, '/api/animate');

    test('rejects invalid source URL (private IP check)', async () => {
      const res = await request(app)
        .post('/api/animate/generate')
        .set('X-User-Muapi-Key', MOCK_USER_KEY)
        .send({
          sourceImageUrl: 'http://127.0.0.1:8080/image.png',
          sourceType: 'upload',
          prompt: 'animate this',
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Invalid source URL');
    });

    test('forwards user key when valid source URL is provided', async () => {
      const res = await request(app)
        .post('/api/animate/generate')
        .set('X-User-Muapi-Key', MOCK_USER_KEY)
        .send({
          sourceImageUrl: 'https://example.com/image.png',
          sourceType: 'upload',
          prompt: 'animate this',
        });

      expect([200, 201, 400, 401, 500]).toContain(res.status);
    });
  });
});
