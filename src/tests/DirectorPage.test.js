import { describe, test, expect, vi, beforeEach } from 'vitest';

vi.mock('../lib/apiKeyManager.js', () => ({
    apiKeyManager: {
        getOpenAIKey: () => 'test-openai-key',
        getVideoDBKey: () => 'test-videodb-key',
        getMuapiKey: () => 'test-muapi-key',
        getKey: () => 'test-key',
    }
}));

vi.mock('../lib/router.js', () => ({ navigate: vi.fn() }));
vi.mock('../lib/loading.js', () => ({ showToast: vi.fn() }));
vi.mock('../lib/security.js', () => ({ escapeHtml: (s) => s }));
vi.mock('../lib/clerkEntitlements.js', () => ({ requireEntitlement: vi.fn() }));

import { runAgentById, DIRECTOR_AGENTS } from '../components/DirectorPage.js';

beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
});

describe('runAgentById', () => {
    test('unknown agent ID throws', async () => {
        await expect(runAgentById('foo')).rejects.toThrow("Unknown agent: foo");
    });

    test('each of the 45 agent IDs maps to a tool in the switch statement', async () => {
        global.fetch = vi.fn().mockImplementation((url) => {
            const u = String(url);
            if (u.includes('/videoagent/process')) {
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve({ jobId: 'test-job', status: 'processing' }),
                });
            }
            if (u.includes('/videoagent/job/')) {
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve({ status: 'completed', result: {}, source: 'test' }),
                });
            }
            if (u.includes('/api/agents/agent/')) {
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve({ success: true, action: 'speed', source: 'ffmpeg', base64: 'test', format: 'mp4' }),
                });
            }
            if (u.includes('/api/videodb/proxy')) {
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve({ data: {} }),
                });
            }
            return Promise.resolve({
                ok: true,
                json: () => Promise.resolve({}),
            });
        });
        window.__BACKEND_URL__ = 'http://localhost:3001';

        const seen = new Set();
        for (const agent of DIRECTOR_AGENTS) {
            if (seen.has(agent.id)) continue;
            seen.add(agent.id);
            if (agent.tool === 'compile-timeline') {
                const err = await runAgentById(agent.id, { prompt: 'test' }).catch(e => e);
                expect(String(err)).not.toContain('has no tool mapping');
                continue;
            }
            const err = await runAgentById(agent.id).catch(e => e);
            expect(String(err)).not.toContain('has no tool mapping');
        }
        expect(seen.size).toBe(DIRECTOR_AGENTS.length);
    });

    test('function signature accepts expected parameters', async () => {
        global.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: () => Promise.resolve({ success: true, action: 'speed', source: 'ffmpeg', base64: 'test', format: 'mp4' }),
        });
        window.__BACKEND_URL__ = 'http://localhost:3001';

        const signal = new AbortController().signal;
        const onProgress = vi.fn();
        const result = await runAgentById('speed', { videoUrl: 'http://test.com/v.mp4', prompt: '2x' }, { onProgress, signal });
        expect(result).toBeDefined();
        expect(result.action).toBe('speed');
        expect(result.source).toBe('ffmpeg');
    });
});
