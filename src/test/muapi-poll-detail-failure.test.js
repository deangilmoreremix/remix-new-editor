// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';

afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

describe('MuapiClient.pollForResult on a failed job', () => {
  const run = async (response) => {
    vi.stubGlobal('fetch', vi.fn(async () => response));
    const { MuapiClient } = await import('../lib/muapi.js');
    const c = new MuapiClient();
    const started = Date.now();
    const err = await c.pollForResult('req-1', 5, 1).catch((e) => e);
    return { err, calls: fetch.mock.calls.length, ms: Date.now() - started };
  };
  it('a 400 { detail: { status: failed, error } } fails at once with MuAPI\'s reason', async () => {
    const body = JSON.stringify({ detail: { id: 'x', status: 'failed', error: 'The file format is not supported. Please check the file type.' } });
    const { err, calls } = await run({ ok: false, status: 400, text: async () => body, json: async () => JSON.parse(body) });
    expect(err.message).toContain('The file format is not supported');
    expect(calls).toBe(1); // not retried
  });
  it('the same failure delivered as a 200 is also terminal', async () => {
    const data = { detail: { status: 'failed', error: 'bad ref' } };
    const { err, calls } = await run({ ok: true, status: 200, json: async () => data, text: async () => JSON.stringify(data) });
    expect(err.message).toContain('bad ref');
    expect(calls).toBe(1);
  });
  it('a 429 is still retried', async () => {
    const { err, calls } = await run({ ok: false, status: 429, text: async () => 'slow down', json: async () => ({}) });
    expect(calls).toBe(5);
    expect(err.message).toMatch(/Poll Failed: 429|timed out/);
  });
});
