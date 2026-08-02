// @vitest-environment node

import request from 'supertest';
import { describe, it, expect, vi } from 'vitest';
import express from 'express';
import storyboardService from '../services/storyboardService.js';

function mount(router, prefix = '') {
  const r = express();
  r.use(express.json());
  r.use(prefix, router);
  return r;
}

const storyboardApp = mount(storyboardService, '/api/storyboard');

describe('storyboardService', () => {
  it('creates and reads a storyboard', async () => {
    const id = 'test-storyboard-' + Date.now();
    const createRes = await request(storyboardApp).post('/api/storyboard/' + encodeURIComponent(id)).send({ id, frames: [{ prompt: 'A' }], preset: null });
    expect(createRes.status).toBe(201);
    expect(createRes.body.id).toBe(id);

    const readRes = await request(storyboardApp).get('/api/storyboard/' + encodeURIComponent(id));
    expect(readRes.status).toBe(200);
    expect(readRes.body.frames).toHaveLength(1);
  });

  it('returns 404 for missing storyboard', async () => {
    const res = await request(storyboardApp).get('/api/storyboard/does-not-exist');
    expect(res.status).toBe(404);
  });
});
