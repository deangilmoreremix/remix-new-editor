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

describe('MuapiClient.pollForResult review follow-ups', () => {
  const seq = (...responses) => { let i = 0; vi.stubGlobal('fetch', vi.fn(async () => responses[Math.min(i++, responses.length - 1)])); };
  const client = async () => new (await import('../lib/muapi.js')).MuapiClient();
  it('a transient 4xx without a failed status keeps polling and returns the completed result', async () => {
    const done = { status: 'completed', outputs: ['https://cdn/x.png'] };
    seq({ ok: false, status: 409, text: async () => '{"detail":"busy"}', json: async () => ({}) }, { ok: true, status: 200, json: async () => done, text: async () => '' });
    expect((await (await client()).pollForResult('r', 5, 1)).outputs[0]).toBe('https://cdn/x.png');
    expect(fetch).toHaveBeenCalledTimes(2);
  });
  it('401/403 fail at once', async () => {
    seq({ ok: false, status: 401, text: async () => '{"detail":"bad key"}', json: async () => ({}) });
    await expect((await client()).pollForResult('r', 5, 1)).rejects.toThrow('bad key');
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it('an object error is readable, not [object Object]', async () => {
    const body = JSON.stringify({ detail: { status: 'failed', error: { code: 'E1', info: 'nope' } } });
    seq({ ok: false, status: 400, text: async () => body, json: async () => JSON.parse(body) });
    const err = await (await client()).pollForResult('r', 5, 1).catch((e) => e);
    expect(err.message).not.toContain('[object Object]');
    expect(err.message).toContain('"code":"E1"');
  });
  it('an error body that never arrives does not hang the poll', async () => {
    vi.useFakeTimers();
    seq({ ok: false, status: 400, text: () => new Promise(() => {}), json: async () => ({}) });
    const p = (await client()).pollForResult('r', 1, 1).catch((e) => e);
    await vi.advanceTimersByTimeAsync(11_000);
    expect((await p).message).toMatch(/Poll Failed|timed out/);
  });
});
