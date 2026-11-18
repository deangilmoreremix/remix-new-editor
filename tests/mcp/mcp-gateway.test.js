// @vitest-environment node
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { createHandler } from '../../netlify/functions/mcp-gateway.js';

const handler = createHandler({ env: { MCP_ALLOW_BYOK: '1' } });

const KEY = 'sv_0123456789abcdef0123';
const ev = (method, path, body, headers = { authorization: `Bearer ${KEY}` }) => ({ httpMethod: method, path, headers, body: body ? JSON.stringify(body) : undefined });
const reply = (status, body) => ({ ok: status < 400, status, statusText: 'x', text: async () => JSON.stringify(body) });

afterEach(() => vi.unstubAllGlobals());

describe('mcp-gateway', () => {
  it('requires a bearer key', async () => {
    const r = await handler(ev('GET', '/api/mcp-gateway/balance', null, {}));
    expect(r.statusCode).toBe(401);
  });

  it('forwards generate with the caller key and rejects unsafe endpoints', async () => {
    const f = vi.fn(async () => reply(200, { request_id: 'r1' }));
    vi.stubGlobal('fetch', f);
    const ok = await handler(ev('POST', '/api/mcp-gateway/generate', { endpoint: '/nano-banana', payload: { prompt: 'x' } }));
    expect(JSON.parse(ok.body)).toEqual({ request_id: 'r1' });
    expect(f.mock.calls[0][0]).toBe('https://api.muapi.ai/api/v1/nano-banana');
    expect(f.mock.calls[0][1].headers['x-api-key']).toBe(KEY);
    for (const endpoint of ['../account', 'https://evil.test/x', '//evil', 'a b']) {
      const r = await handler(ev('POST', '/api/mcp-gateway/generate', { endpoint }));
      expect(r.statusCode).toBe(400);
    }
    expect(f).toHaveBeenCalledTimes(1);
  });

  it('result: falls back to POST on 405 and brands upstream errors', async () => {
    const f = vi.fn()
      .mockResolvedValueOnce(reply(405, {}))
      .mockResolvedValueOnce(reply(200, { status: 'completed', outputs: ['https://x/y.png'] }));
    vi.stubGlobal('fetch', f);
    const r = await handler(ev('GET', '/.netlify/functions/mcp-gateway/result/abc-123'));
    expect(JSON.parse(r.body).status).toBe('completed');
    expect(f.mock.calls[1][1].method).toBe('POST');

    vi.stubGlobal('fetch', vi.fn(async () => reply(500, { detail: 'muapi.ai is down' })));
    const e = await handler(ev('POST', '/api/mcp-gateway/generate', { endpoint: 'x', payload: {} }));
    expect(e.statusCode).toBe(502);
    expect(e.body).not.toMatch(/mu-?api/i);
    expect(e.body).toContain('SmartVid');
  });

  it('upload refuses non-https and private source URLs', async () => {
    vi.stubGlobal('fetch', vi.fn());
    for (const source_url of ['http://a.com/x.png', 'https://localhost/x', 'https://169.254.169.254/latest', 'https://user:pw@a.com/x']) {
      const r = await handler(ev('POST', '/api/mcp-gateway/upload', { source_url }));
      expect(r.statusCode).toBe(400);
    }
  });
});

describe('mcp-gateway with MCP keys', () => {
  const SECRET = 'x'.repeat(40);
  const MU = 'mu_test_key_0123456789abcdef';
  let store; let keys; let env0;
  beforeEach(async () => {
    env0 = process.env.MCP_KEY_SECRET; process.env.MCP_KEY_SECRET = SECRET;
    const { createMcpKey } = await import('../../netlify/functions/_shared/mcpKeys.js');
    const rows = [];
    store = {
      insert: async (r) => { const row = { id: crypto.randomUUID(), created_at: 'now', revoked_at: null, ...r }; rows.push(row); return row; },
      byHash: async (h) => rows.find((r) => r.key_hash === h && !r.revoked_at) || null,
      countActive: async () => 0, touch: async () => {}, rows,
    };
    keys = await createMcpKey(store, { userId: 'user_9', muapiKey: MU, openaiKey: 'sk-abcdefghijklmnopqrstuv' });
  });
  afterEach(() => { if (env0 === undefined) delete process.env.MCP_KEY_SECRET; else process.env.MCP_KEY_SECRET = env0; });

  const call = (h, path, body, token = keys.key, method = 'POST') => h({ httpMethod: method, path, headers: { authorization: `Bearer ${token}` }, body: body ? JSON.stringify(body) : undefined });

  it('uses the stored upstream key, never the token, and rejects revoked or unknown keys', async () => {
    const f = vi.fn(async () => reply(200, { request_id: 'r1' }));
    vi.stubGlobal('fetch', f);
    const h = createHandler({ store: () => store, env: {} });
    const ok = await call(h, '/api/mcp-gateway/generate', { endpoint: 'nano-banana', payload: {} });
    expect(ok.statusCode).toBe(200);
    expect(f.mock.calls[0][1].headers['x-api-key']).toBe(MU);
    expect((await call(h, '/api/mcp-gateway/balance', null, 'sv_live_' + 'a'.repeat(43), 'GET')).statusCode).toBe(401);
    expect((await call(h, '/api/mcp-gateway/balance', null, MU, 'GET')).statusCode).toBe(401); // BYOK off by default
    store.rows[0].revoked_at = 'now';
    expect((await call(h, '/api/mcp-gateway/balance', null, keys.key, 'GET')).statusCode).toBe(401);
  });

  it('runs a studio handler as the key\'s user with their keys, and scrubs provider names', async () => {
    const seen = [];
    const studios = { demo: async (body, who) => { seen.push({ body, who }); return { statusCode: 200, body: JSON.stringify({ ok: true, note: 'MuAPI is busy' }) }; } };
    const h = createHandler({ store: () => store, studios, env: {} });
    const r = await call(h, '/api/mcp-gateway/studio/demo', { action: 'x' });
    expect(r.statusCode).toBe(200);
    expect(r.body).toContain('SmartVid is busy');
    expect(r.body).not.toMatch(/mu-?api/i);
    expect(seen[0].who).toMatchObject({ userId: 'user_9', keys: { muapi: MU, openai: 'sk-abcdefghijklmnopqrstuv' } });
    expect((await call(h, '/api/mcp-gateway/studio/nope', {})).statusCode).toBe(404);
    expect((await call(h, '/api/mcp-gateway/studio/constructor', {})).statusCode).toBe(404);
  });

  it('wires the real Zack D handler (needs the OpenAI key for script steps)', async () => {
    const h = createHandler({ store: () => store, env: {} });
    const r = await call(h, '/api/mcp-gateway/studio/zackd', { action: 'nope' });
    expect(r.statusCode).toBe(400);
    expect(JSON.parse(r.body).error.message).toBe('Unknown action');
  });
});
