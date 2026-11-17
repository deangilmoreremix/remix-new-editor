import { describe, it, expect, vi, afterEach } from 'vitest';
import { handler } from '../../netlify/functions/mcp-gateway.js';

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
