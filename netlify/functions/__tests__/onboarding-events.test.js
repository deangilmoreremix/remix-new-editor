// @vitest-environment node
import { describe, it, expect, vi } from 'vitest';
import { handle, handler, normalizeEvent, deviceClass, MAX_BODY } from '../onboarding-events.js';

const env = { SUPABASE_URL: 'https://db.test', SUPABASE_SERVICE_ROLE_KEY: 'service-secret', ANALYTICS_HASH_SALT: 'salt' };
const base = { anon: 'anon_0123456789abcdef', session: 'sess_0123456789abcdef', events: [{ event: 'start', seq: 0 }] };

function fakeFetch({ ingest = { ok: true, accepted: 1, duplicates: 0 }, limit = { allowed: true }, limiterDown = false } = {}) {
  const calls = [];
  const fn = vi.fn(async (url, init) => {
    const name = url.split('/rpc/')[1];
    calls.push({ name, args: JSON.parse(init.body), headers: init.headers });
    if (name === 'rate_limit_check') return limiterDown ? { ok: false, status: 500, json: async () => ({}) } : { ok: true, json: async () => limit };
    return { ok: true, json: async () => ingest };
  });
  fn.calls = calls;
  return fn;
}

describe('onboarding-events: normalizeEvent', () => {
  it('keeps the allowed shape and drops unknown keys', () => {
    expect(normalizeEvent({ event: 'step_view', seq: 2, step: 6, sub: 'ready', owner: 'evil' })).toEqual({ event: 'step_view', seq: 2, step: 6, sub_step: 'ready' });
    expect(normalizeEvent({ event: 'step_answer', seq: 3, step: 1, props: { field: 'goal', value: 'ai-video', extra: 1 } }))
      .toEqual({ event: 'step_answer', seq: 3, step: 1, props: { field: 'goal', value: 'ai-video' } });
  });
  it('rejects unknown events, signup, bad seq/step/sub', () => {
    for (const e of [{ event: 'signup', seq: 0 }, { event: 'hack', seq: 0 }, { event: 'start', seq: -1 }, { event: 'start', seq: 1.5 }, { event: 'step_view', seq: 0, step: 7 },
      { event: 'step_view', seq: 0, step: 6, sub: 'x' }, null, 'x']) expect(normalizeEvent(e)).toBeNull();
  });
  it('never carries free text: company, website and job title are only "filled" flags', () => {
    expect(normalizeEvent({ event: 'step_answer', seq: 1, props: { field: 'company', value: 'Acme Corp', filled: true } })).toEqual({ event: 'step_answer', seq: 1, props: { field: 'company', filled: true } });
    expect(normalizeEvent({ event: 'step_answer', seq: 1, props: { field: 'website', value: 'https://acme.com' } })).toEqual({ event: 'step_answer', seq: 1, props: { field: 'website', filled: false } });
    const done = normalizeEvent({ event: 'complete', seq: 9, props: { goal: 'personal', company: 'Acme', website: true, jobTitle: false, tools: ['avatar', 'Not An Id!'], types: ['talking'], primary: 'avatar' } });
    expect(done.props).toEqual({ goal: 'personal', website: true, jobTitle: false, tools: ['avatar'], types: ['talking'], primary: 'avatar' });
    expect(JSON.stringify(done)).not.toContain('Acme');
  });
  it('rejects answers with unknown fields or non-id values', () => {
    expect(normalizeEvent({ event: 'step_answer', seq: 1, props: { field: 'password', value: 'x' } })).toBeNull();
    expect(normalizeEvent({ event: 'step_answer', seq: 1, props: { field: 'goal', value: 'has spaces & symbols' } })).toBeNull();
    expect(normalizeEvent({ event: 'open_studio', seq: 1, props: { studio: '<script>' } })).toBeNull();
  });
  it('detects the device class', () => {
    expect(deviceClass('Mozilla/5.0 (iPhone)')).toBe('mobile');
    expect(deviceClass('Mozilla/5.0 (iPad)')).toBe('tablet');
    expect(deviceClass('Mozilla/5.0 (X11; Linux)')).toBe('desktop');
  });
});

describe('onboarding-events: handle', () => {
  it('503 without config, 400 on bad input', async () => {
    expect((await handle(base, { env: {}, fetchImpl: fakeFetch() })).statusCode).toBe(503);
    for (const b of [null, { ...base, anon: 'x' }, { ...base, session: 'x' }, { ...base, events: [] }, { ...base, events: Array.from({ length: 26 }, (_, i) => ({ event: 'start', seq: i })) }, { ...base, events: [{ event: 'signup', seq: 0 }] }]) {
      expect((await handle(b, { env, fetchImpl: fakeFetch() })).statusCode).toBe(400);
    }
  });

  it('writes through the ingest RPC with a hashed anon id, never the raw one, and the device class', async () => {
    const f = fakeFetch();
    const r = await handle({ ...base, ref: 'example.com' }, { env, fetchImpl: f, ip: '1.2.3.4', ua: 'Mozilla/5.0 (iPhone)' });
    expect(r.statusCode).toBe(200);
    expect(JSON.parse(r.body)).toMatchObject({ ok: true, accepted: 1 });
    const ing = f.calls.find((c) => c.name === 'ingest_onboarding_events');
    expect(ing.args.p_anon_hash).toMatch(/^[0-9a-f]{32}$/);
    expect(ing.args.p_anon_hash).not.toContain('anon_');
    expect(ing.args).toMatchObject({ p_session_key: base.session, p_device: 'mobile', p_referrer: 'example.com', p_clerk_user_id: null });
    expect(JSON.stringify(f.calls)).not.toContain('1.2.3.4');
    expect(ing.headers.Authorization).toBe('Bearer service-secret');
  });

  it('resolves the user from a verified token only; a body user id is ignored; a bad token is anonymous', async () => {
    const f = fakeFetch();
    await handle({ ...base, clerk_user_id: 'evil', userId: 'evil' }, { env, fetchImpl: f, token: 't', verify: async () => ({ userId: 'user_real' }) });
    expect(f.calls.find((c) => c.name === 'ingest_onboarding_events').args.p_clerk_user_id).toBe('user_real');
    const g = fakeFetch();
    await handle({ ...base, userId: 'evil' }, { env, fetchImpl: g, token: 't', verify: async () => { throw new Error('bad'); } });
    expect(g.calls.find((c) => c.name === 'ingest_onboarding_events').args.p_clerk_user_id).toBeNull();
    const h = fakeFetch();
    await handle(base, { env, fetchImpl: h, token: 't', verify: async () => null });
    expect(h.calls.find((c) => c.name === 'ingest_onboarding_events').args.p_clerk_user_id).toBeNull();
  });

  it('429 when the limiter says no; fails open when the limiter is down', async () => {
    expect((await handle(base, { env, fetchImpl: fakeFetch({ limit: { allowed: false } }) })).statusCode).toBe(429);
    expect((await handle(base, { env, fetchImpl: fakeFetch({ limiterDown: true }) })).statusCode).toBe(200);
  });

  it('502 when the database fails, 400 when the RPC rejects', async () => {
    const down = vi.fn(async (url) => (url.includes('rate_limit_check') ? { ok: true, json: async () => ({ allowed: true }) } : { ok: false, status: 500, json: async () => ({}) }));
    expect((await handle(base, { env, fetchImpl: down })).statusCode).toBe(502);
    expect((await handle(base, { env, fetchImpl: fakeFetch({ ingest: { ok: false, error: 'bad_event' } }) })).statusCode).toBe(400);
  });
});

describe('onboarding-events: handler', () => {
  it('405 for GET, 204 for OPTIONS, 413 for a big body, 400 for bad JSON', async () => {
    expect((await handler({ httpMethod: 'GET' })).statusCode).toBe(405);
    expect((await handler({ httpMethod: 'OPTIONS' })).statusCode).toBe(204);
    expect((await handler({ httpMethod: 'POST', body: 'x'.repeat(MAX_BODY + 1) })).statusCode).toBe(413);
    expect((await handler({ httpMethod: 'POST', body: '{nope' })).statusCode).toBe(400);
  });
});
