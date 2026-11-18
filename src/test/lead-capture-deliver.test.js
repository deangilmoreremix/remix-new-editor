// deliverWebhook: the retry / signing / budget behavior of lead-capture's webhook delivery, driven with a fake
// network and clock so every branch runs. Signatures are recomputed with Node's crypto, not the code under test.
import { describe, it, expect, vi } from 'vitest';
import { createHmac } from 'node:crypto';
import { deliverWebhook, ATTEMPT_TIMEOUT_MS, DELIVERY_BUDGET_MS } from '../../supabase/functions/lead-capture/logic.ts';

const URL_ = 'https://hooks.example.com/abc/SECRET-PATH?token=zzz';
const BODY = JSON.stringify({ event: 'video_opted_in', data: { EMAIL: 'a@b.co' } });
const START = 1_700_000_000_000;
const abortError = () => Object.assign(new Error('aborted'), { name: 'AbortError' });

/**
 * script: one entry per attempt. A number is the HTTP status, an Error is thrown (network failure), and
 * { timeout: true } advances the clock by the attempt timeout and throws AbortError.
 * perCallMs advances the clock on every fetch (to test fresh timestamps).
 */
function fake(script, { perCallMs = 0, publicOk = true } = {}) {
  let clock = START;
  const calls = [];
  const sleeps = [];
  const cancels = [];
  let n = 0;
  const deps = {
    fetchFn: vi.fn(async (url, init) => {
      calls.push({ url, init, at: clock });
      const step = script[calls.length - 1];
      clock += perCallMs;
      if (step && step.timeout) { clock += ATTEMPT_TIMEOUT_MS; throw abortError(); }
      if (step instanceof Error) throw step;
      const cancel = vi.fn(async () => {});
      cancels.push(cancel);
      return { ok: step >= 200 && step < 300, status: step, body: { cancel } };
    }),
    sleepFn: vi.fn(async (ms) => { sleeps.push(ms); clock += ms; }),
    nowFn: () => clock,
    resolvesPublic: vi.fn(async () => publicOk),
    newId: () => `id-${++n}`,
  };
  return { deps, calls, sleeps, cancels };
}
const run = (f, over = {}) => deliverWebhook({ url: URL_, body: BODY, event: 'video_opted_in', secret: 'whsec_test', maxAttempts: 3, ...over }, f.deps);
const expectedSig = (secret, t, body = BODY) => `t=${t},v1=${createHmac('sha256', secret).update(`${t}.${body}`).digest('hex')}`;

describe('deliverWebhook', () => {
  it('delivers on the first try with the right request, headers and signature', async () => {
    const f = fake([200]);
    const r = await run(f);
    expect(r).toEqual({ deliveryId: 'id-1', host: 'hooks.example.com', ok: true, status: 200, attempts: 1, error: null });
    expect(f.calls).toHaveLength(1);
    const { url, init } = f.calls[0];
    expect(url).toBe(URL_);
    expect(init.method).toBe('POST');
    expect(init.redirect).toBe('manual');
    expect(init.body).toBe(BODY); // exactly the bytes that were signed
    expect(init.headers).toMatchObject({ 'Content-Type': 'application/json', 'User-Agent': 'remix-lead-capture/1.0', 'X-Remix-Event': 'video_opted_in', 'X-Remix-Delivery': 'id-1' });
    expect(init.headers['X-Remix-Signature']).toBe(expectedSig('whsec_test', Math.floor(START / 1000)));
    expect(f.sleeps).toEqual([]);
  });

  it('never keeps the path or query (they can hold secrets) in the result', async () => {
    const r = await run(fake([200]));
    expect(JSON.stringify(r)).not.toMatch(/SECRET-PATH|token|zzz/);
  });

  it('retries 500, 500, 200: three attempts, one delivery id, a fresh valid signature each time', async () => {
    const f = fake([500, 500, 200], { perCallMs: 1500 });
    const r = await run(f);
    expect(r).toMatchObject({ ok: true, status: 200, attempts: 3, error: null });
    expect(f.sleeps).toEqual([300, 900]);
    expect(new Set(f.calls.map((c) => c.init.headers['X-Remix-Delivery']))).toEqual(new Set(['id-1']));
    const stamps = f.calls.map((c) => Number(/t=(\d+)/.exec(c.init.headers['X-Remix-Signature'])[1]));
    expect(new Set(stamps).size).toBe(3); // timestamps move forward, so a replayed old attempt is detectable
    f.calls.forEach((c, i) => expect(c.init.headers['X-Remix-Signature']).toBe(expectedSig('whsec_test', stamps[i])));
  });

  it('gives up after the last attempt and reports the final status', async () => {
    const f = fake([503, 503, 503]);
    const r = await run(f);
    expect(r).toMatchObject({ ok: false, status: 503, attempts: 3, error: 'HTTP 503' });
    expect(f.calls).toHaveLength(3);
    expect(f.sleeps).toEqual([300, 900]);
  });

  it.each([400, 401, 403, 404, 410, 422])('does not retry a %i (the receiver said no)', async (status) => {
    const f = fake([status, 200]);
    const r = await run(f);
    expect(r).toMatchObject({ ok: false, status, attempts: 1, error: `HTTP ${status}` });
    expect(f.calls).toHaveLength(1);
    expect(f.sleeps).toEqual([]);
  });

  it.each([408, 429])('retries a %i', async (status) => {
    const r = await run(fake([status, 200]));
    expect(r).toMatchObject({ ok: true, attempts: 2 });
  });

  it.each([301, 302, 307])('treats a %i redirect as a failure and does not follow or retry it', async (status) => {
    const f = fake([status, 200]);
    const r = await run(f);
    expect(r).toMatchObject({ ok: false, status, attempts: 1, error: `HTTP ${status}` });
    expect(f.calls[0].init.redirect).toBe('manual');
  });

  it('retries a network error and then succeeds', async () => {
    const r = await run(fake([new TypeError('fetch failed'), 200]));
    expect(r).toMatchObject({ ok: true, status: 200, attempts: 2 });
  });

  it('labels an unreachable receiver as a network error with no status', async () => {
    const r = await run(fake([new TypeError('x'), new TypeError('x'), new TypeError('x')]));
    expect(r).toMatchObject({ ok: false, status: null, attempts: 3, error: 'network error' });
  });

  it('labels an aborted request as a timeout', async () => {
    const r = await run(fake([{ timeout: true }]), { maxAttempts: 1 });
    expect(r).toMatchObject({ ok: false, status: null, attempts: 1, error: 'timeout' });
  });

  it('stops retrying when the total time budget would be exceeded', async () => {
    // attempt 1 times out (5s) -> 5s + 0.3s + 5s fits in 12s, so one retry; attempt 2 times out at ~10.3s ->
    // 10.3s + 0.9s + 5s no longer fits, so it stops after 2 attempts even though 3 were allowed.
    expect(ATTEMPT_TIMEOUT_MS).toBe(5000);
    expect(DELIVERY_BUDGET_MS).toBe(12_000);
    const f = fake([{ timeout: true }, { timeout: true }, 200]);
    const r = await run(f);
    expect(r).toMatchObject({ ok: false, attempts: 2, error: 'timeout' });
    expect(f.sleeps).toEqual([300]);
  });

  it('makes a single attempt when maxAttempts is 1 (the Test Webhook button)', async () => {
    const f = fake([500, 200]);
    const r = await run(f, { maxAttempts: 1 });
    expect(r).toMatchObject({ ok: false, status: 500, attempts: 1 });
    expect(f.sleeps).toEqual([]);
  });

  it('sends no signature header when there is no signing secret', async () => {
    const f = fake([200]);
    await run(f, { secret: '' });
    expect(f.calls[0].init.headers).not.toHaveProperty('X-Remix-Signature');
    expect(f.calls[0].init.headers['X-Remix-Delivery']).toBe('id-1');
  });

  it('signs with the secret it was given (a different secret gives a different signature)', async () => {
    const a = fake([200]); const b = fake([200]);
    await run(a, { secret: 'whsec_one' }); await run(b, { secret: 'whsec_two' });
    expect(a.calls[0].init.headers['X-Remix-Signature']).not.toBe(b.calls[0].init.headers['X-Remix-Signature']);
  });

  it('refuses a host that resolves to a private address: no request, zero attempts', async () => {
    const f = fake([200], { publicOk: false });
    const r = await run(f);
    expect(r).toMatchObject({ ok: false, status: null, attempts: 0, error: 'blocked address' });
    expect(f.deps.fetchFn).not.toHaveBeenCalled();
    expect(f.deps.resolvesPublic).toHaveBeenCalledTimes(1);
  });

  it('checks the host once, not on every retry', async () => {
    const f = fake([500, 500, 200]);
    await run(f);
    expect(f.deps.resolvesPublic).toHaveBeenCalledTimes(1);
  });

  it('closes every response body (no leaked connections), including failed attempts', async () => {
    const f = fake([500, 200]);
    await run(f);
    expect(f.cancels).toHaveLength(2);
    f.cancels.forEach((c) => expect(c).toHaveBeenCalledTimes(1));
  });

  it('uses a different delivery id for each separate delivery', async () => {
    const f = fake([200, 200]);
    const a = await run(f); const b = await run(f);
    expect(a.deliveryId).toBe('id-1');
    expect(b.deliveryId).toBe('id-2');
  });

  it('carries the event name through to the header', async () => {
    const f = fake([200]);
    await run(f, { event: 'test_event' });
    expect(f.calls[0].init.headers['X-Remix-Event']).toBe('test_event');
  });
});
