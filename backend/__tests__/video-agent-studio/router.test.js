// Tests that the Video Agent Studio router:
//  - requires auth (401 without a user)
//  - scopes projects/assets/jobs to the calling user
//  - never lets a caller act on someone else's project or asset

import { describe, it, expect, beforeEach } from '@jest/globals';
import express from 'express';
import request from 'supertest';
import { createVideoAgentStudioRouter } from '../../routes/video-agent-studio/index.js';
import { InMemoryVideoAgentProjectRepository } from '../../services/video-agent-studio/projectRepository.js';
import { InMemoryVideoAgentMediaStore } from '../../services/video-agent-studio/mediaStore.js';
import { InMemorySmartVideoGenerationAdapter } from '../../services/video-agent-studio/generationAdapter.js';
import { InMemoryCreditLedger } from '../../services/video-agent-studio/creditLedger.js';
import { InMemoryVideoAgentEventBus } from '../../services/video-agent-studio/eventBus.js';

function makeApp(deps, requireUser) {
  const app = express();
  app.use(express.json({ limit: '10mb' }));
  app.use((req, _res, next) => {
    req.user = null; // ensure no leakage
    next();
  });
  app.use(
    '/api/video-agent-studio',
    (req, res, next) => {
      requireUser(req)
        .then((user) => {
          req.user = user;
          next();
        })
        .catch(next);
    },
    createVideoAgentStudioRouter(deps),
  );
  // Tiny error handler so test assertions get clean JSON.
  app.use((err, _req, res, _next) => {
    res.status(err.status || 500).json({ error: err.message });
  });
  return app;
}

describe('Video Agent Studio router', () => {
  let deps;
  let app;
  let userMap;
  beforeEach(() => {
    userMap = new Map();
    deps = {
      projectRepository: new InMemoryVideoAgentProjectRepository(),
      mediaStore: new InMemoryVideoAgentMediaStore(),
      generationAdapter: new InMemorySmartVideoGenerationAdapter(),
      creditLedger: new InMemoryCreditLedger(),
      eventBus: new InMemoryVideoAgentEventBus(),
      getApprovalMode: async () => ({ mode: 'BALANCED' }),
      requireUser: async (req) => {
        const id = req.headers['x-test-user'];
        if (!id) {
          const e = new Error('unauthenticated');
          e.status = 401;
          throw e;
        }
        return { id };
      },
    };
    app = makeApp(deps, deps.requireUser);
  });

  it('rejects unauthenticated requests with 401', async () => {
    const res = await request(app).get('/api/video-agent-studio/projects');
    expect(res.status).toBe(401);
  });

  it('creates, reads, and saves a project, scoped to the user', async () => {
    const create = await request(app)
      .post('/api/video-agent-studio/projects')
      .set('x-test-user', 'u1')
      .send({ name: 'My film' });
    expect(create.status).toBe(200);
    const id = create.body.project.id;

    const otherList = await request(app)
      .get('/api/video-agent-studio/projects')
      .set('x-test-user', 'u2');
    expect(otherList.status).toBe(200);
    expect(otherList.body.rows).toEqual([]);

    const otherGet = await request(app)
      .get(`/api/video-agent-studio/projects/${id}`)
      .set('x-test-user', 'u2');
    expect(otherGet.status).toBe(404);

    const save = await request(app)
      .put(`/api/video-agent-studio/projects/${id}`)
      .set('x-test-user', 'u1')
      .send({ projectDoc: { tracks: [] } });
    expect(save.status).toBe(200);
    expect(save.body.project.revision).toBe(2);
  });

  it('estimates a generation and (with enough credits) submits a job', async () => {
    deps.creditLedger.balances.set('u1', 100);
    const est = await request(app)
      .post('/api/video-agent-studio/generation/estimate')
      .set('x-test-user', 'u1')
      .send({ capability: 'video.generate', inputs: { prompt: 'a cat' } });
    expect(est.status).toBe(200);
    expect(est.body.estimate.creditsEstimated).toBeGreaterThanOrEqual(0);

    const submit = await request(app)
      .post('/api/video-agent-studio/generation/submit')
      .set('x-test-user', 'u1')
      .send({ capability: 'video.generate', inputs: { prompt: 'a cat' } });
    // BALANCED mode with a 1-credit estimate -> no approval needed
    expect(submit.status).toBe(202);
    expect(submit.body.job.status).toBe('queued');
  });

  it('returns 402 when the user has no credits', async () => {
    const submit = await request(app)
      .post('/api/video-agent-studio/generation/submit')
      .set('x-test-user', 'u1')
      .send({ capability: 'video.generate', inputs: { prompt: 'a cat' } });
    expect(submit.status).toBe(402);
  });

  it('rejects unsupported capabilities with 400', async () => {
    const est = await request(app)
      .post('/api/video-agent-studio/generation/estimate')
      .set('x-test-user', 'u1')
      .send({ capability: 'totally.fake', inputs: {} });
    expect(est.status).toBe(400);
  });

  it('uploads an asset and resolves its read URL for the owner only', async () => {
    const proj = await request(app)
      .post('/api/video-agent-studio/projects')
      .set('x-test-user', 'u1')
      .send({ name: 'A' });
    const projectId = proj.body.project.id;

    const up = await request(app)
      .post(`/api/video-agent-studio/projects/${projectId}/assets`)
      .set('x-test-user', 'u1')
      .send({ filename: 'a.mp4', mimeType: 'video/mp4', byteSize: 1024 });
    expect(up.status).toBe(201);
    const assetId = up.body.asset.id;

    const url = await request(app)
      .get(`/api/video-agent-studio/assets/${assetId}/url`)
      .set('x-test-user', 'u1');
    expect(url.status).toBe(200);
    expect(url.body.url).toContain(assetId);

    const otherUrl = await request(app)
      .get(`/api/video-agent-studio/assets/${assetId}/url`)
      .set('x-test-user', 'u2');
    expect(otherUrl.status).toBe(404);
  });

  it('rejects a non-video mime type at upload time', async () => {
    const proj = await request(app)
      .post('/api/video-agent-studio/projects')
      .set('x-test-user', 'u1')
      .send({ name: 'A' });
    const projectId = proj.body.project.id;
    const up = await request(app)
      .post(`/api/video-agent-studio/projects/${projectId}/assets`)
      .set('x-test-user', 'u1')
      .send({ filename: 'a.exe', mimeType: 'application/octet-stream', byteSize: 1 });
    expect(up.status).toBe(400);
  });
});
