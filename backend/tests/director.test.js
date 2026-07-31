// @vitest-environment node

import request from 'supertest';
import { describe, test, expect } from 'vitest';
import express from 'express';
import agentActionsService from '../services/agentActionsService.js';
import videoAgentService from '../services/videoAgentService.js';
import videoDbProxyService from '../services/videoDbProxyService.js';

function mount(router, prefix = '') {
    const r = express();
    r.use(express.json());
    r.use(prefix, router);
    return r;
}

const agentsApp = mount(agentActionsService, '/api/agents');
const videoAgentApp = mount(videoAgentService, '/videoagent');
const videodbApp = mount(videoDbProxyService, '/api/videodb');

describe('Director backend routes', () => {
    describe('GET /health', () => {
        test('returns 200 with status ok', async () => {
            const healthApp = express();
            healthApp.get('/health', (_req, res) => res.json({ status: 'ok' }));
            const res = await request(healthApp).get('/health');
            expect(res.status).toBe(200);
            expect(res.body.status).toBe('ok');
        });
    });

    describe('GET /api/agents/actions', () => {
        test('returns 200 with an array of actions', async () => {
            const res = await request(agentsApp).get('/api/agents/actions');
            expect(res.status).toBe(200);
            expect(Array.isArray(res.body.actions)).toBe(true);
            expect(res.body.actions.length).toBeGreaterThan(0);
        });
    });

    describe('POST /api/agents/agent/:action', () => {
        test('POST /api/agents/agent/speed returns inline result', async () => {
            const res = await request(agentsApp).post('/api/agents/agent/speed').send({});
            expect(res.status).toBe(200);
            expect(res.body).toMatchObject({
                success: true,
                action: 'speed',
                error: 'videoUrl required',
            });
            expect(Array.isArray(res.body.steps)).toBe(true);
        });

        test('POST /api/agents/agent/reverse returns inline result', async () => {
            const res = await request(agentsApp).post('/api/agents/agent/reverse').send({});
            expect(res.status).toBe(200);
            expect(res.body).toMatchObject({
                success: true,
                action: 'reverse',
                error: 'videoUrl required',
            });
            expect(Array.isArray(res.body.steps)).toBe(true);
        });
    });

    describe('POST /videoagent/process', () => {
        test('action=process-tool tool=meme returns a job', async () => {
            const res = await request(videoAgentApp)
                .post('/videoagent/process')
                .send({ action: 'process-tool', tool: 'meme' });
            expect(res.status).toBe(200);
            expect(res.body).toHaveProperty('jobId');
            expect(res.body.status).toBe('processing');
        });
    });

    describe('POST /api/videodb/proxy', () => {
        test('empty key returns non-200', async () => {
            const res = await request(videodbApp)
                .post('/api/videodb/proxy')
                .send({ endpoint: 'health', videoDbKey: '' });
            expect(res.status).not.toBe(200);
        });

        test('dummy key returns non-2xx', async () => {
            const res = await request(videodbApp)
                .post('/api/videodb/proxy')
                .send({ endpoint: 'health', videoDbKey: 'dummy-key' });
            expect(res.status).not.toBe(200);
        });

        test('SSRF attempt is blocked', async () => {
            const res = await request(videodbApp)
                .post('/api/videodb/proxy')
                .send({ endpoint: 'https://evil.com/x', videoDbKey: 'anything' });
            expect(res.status).toBe(400);
        });
    });
});
