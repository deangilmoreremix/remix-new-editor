// @vitest-environment node
import { describe, test, expect, vi } from 'vitest';
import { Readable } from 'node:stream';
import { resolveUpstream, createMuapiDevProxyHandler, muapiDevProxyPlugin } from '../../scripts/dev-muapi-proxy.mjs';

function request(body, method = 'POST') {
  const req = Readable.from([Buffer.from(typeof body === 'string' ? body : JSON.stringify(body))]);
  req.method = method;
  req.headers = { 'x-api-key': 'browser-placeholder', authorization: 'Bearer nope' };
  return req;
}
function response() {
  const res = { statusCode: 0, headers: {}, body: null, setHeader(k, v) { this.headers[k] = v; }, end(text) { this.body = text; } };
  return res;
}

describe('resolveUpstream', () => {
  test('submits generations to /api/v1 as POST with the params as the body', () => {
    const r = resolveUpstream({ endpoint: 'seedream-5.0-pro-edit', params: { prompt: 'p', images_list: ['https://x/a.png'] } });
    expect(r).toEqual({ url: 'https://api.muapi.ai/api/v1/seedream-5.0-pro-edit', method: 'POST', body: JSON.stringify({ prompt: 'p', images_list: ['https://x/a.png'] }) });
  });
  test('polls results with GET and no body', () => {
    expect(resolveUpstream({ endpoint: 'predictions/abc-123/result', params: {} })).toEqual({ url: 'https://api.muapi.ai/api/v1/predictions/abc-123/result', method: 'GET', body: null });
    expect(resolveUpstream({ endpoint: 'account/balance' }).method).toBe('GET');
  });
  test('app/ and workflow/ endpoints live outside /api/v1', () => {
    expect(resolveUpstream({ endpoint: 'app/calculate_dynamic_cost', params: { task_name: 'm' } }).url).toBe('https://api.muapi.ai/app/calculate_dynamic_cost');
    expect(resolveUpstream({ endpoint: 'workflow/get-published-workflows', apiMethod: 'GET' }).method).toBe('GET');
  });
  test('honours an explicit method and refuses odd ones', () => {
    expect(resolveUpstream({ endpoint: 'predictions/x/media', apiMethod: 'DELETE' }).method).toBe('DELETE');
    expect(resolveUpstream({ endpoint: 'x', apiMethod: 'PUT' }).error).toBeTruthy();
  });
  test('rejects endpoints that could reach another host or path', () => {
    for (const endpoint of ['../secret', '/abs', 'https://evil.example/x', 'a b', '', undefined, 'x/../y', '//evil']) {
      expect(resolveUpstream({ endpoint }).error, String(endpoint)).toBeTruthy();
    }
  });
});

describe('proxy handler', () => {
  test('forwards the request, drops the browser key, and returns the upstream status and body', async () => {
    const forward = vi.fn(async () => ({ status: 200, text: '{"request_id":"r1"}' }));
    const handler = createMuapiDevProxyHandler({ forward, apiKey: undefined, log: false });
    const res = response();
    await handler(request({ endpoint: 'seedream-5.0-pro-edit', params: { prompt: 'p' } }), res, vi.fn());
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toEqual({ request_id: 'r1' });
    // The browser's placeholder key never reaches muapi.
    expect(forward.mock.calls[0][1]).toBeUndefined();
    expect(JSON.stringify(forward.mock.calls[0])).not.toContain('browser-placeholder');
  });
  test('uses MUAPI_API_KEY from the environment when provided', async () => {
    const forward = vi.fn(async () => ({ status: 200, text: '{}' }));
    await createMuapiDevProxyHandler({ forward, apiKey: 'env-key', log: false })(request({ endpoint: 'account/balance' }), response(), vi.fn());
    expect(forward.mock.calls[0][1]).toBe('env-key');
  });
  test('passes upstream errors through, and reports network failures as 502', async () => {
    const bad = createMuapiDevProxyHandler({ forward: async () => ({ status: 404, text: '{"detail":"not found"}' }), log: false });
    const r1 = response(); await bad(request({ endpoint: 'predictions/x/result' }), r1, vi.fn());
    expect(r1.statusCode).toBe(404);
    const down = createMuapiDevProxyHandler({ forward: async () => { throw new Error('boom'); }, log: false });
    const r2 = response(); await down(request({ endpoint: 'account/balance' }), r2, vi.fn());
    expect(r2.statusCode).toBe(502);
  });
  test('rejects invalid bodies and bad endpoints without calling muapi, and ignores non-POST', async () => {
    const forward = vi.fn();
    const handler = createMuapiDevProxyHandler({ forward, log: false });
    const r1 = response(); await handler(request('not json'), r1, vi.fn());
    const r2 = response(); await handler(request({ endpoint: '../x' }), r2, vi.fn());
    expect([r1.statusCode, r2.statusCode]).toEqual([400, 400]);
    const next = vi.fn(); await handler(request({}, 'GET'), response(), next);
    expect(next).toHaveBeenCalled();
    expect(forward).not.toHaveBeenCalled();
  });
});

describe('plugin', () => {
  test('is dev-only and runs before the built-in middleware', () => {
    const plugin = muapiDevProxyPlugin();
    expect(plugin.apply).toBe('serve');
    expect(plugin.enforce).toBe('pre');
    const use = vi.fn();
    plugin.configureServer({ middlewares: { use } });
    expect(use.mock.calls[0][0]).toBe('/functions/v1/muapi-proxy');
  });
});
