// @vitest-environment node
import { describe, it, expect, vi } from 'vitest';
import { handle, handler, resolveRange, adminIds } from '../admin-onboarding-funnel.js';

const env = { SUPABASE_URL: 'https://db.test', SUPABASE_SERVICE_ROLE_KEY: 'service-secret', ADMIN_CLERK_USER_IDS: ' user_admin , user_two ' };
const NOW = new Date('2026-11-22T12:00:00Z');
const report = { ok: true, funnel: [{ key: 'start', label: 'Started', people: 3 }] };
const okFetch = (body = report) => vi.fn(async () => ({ ok: true, status: 200, json: async () => body }));
const call = (over = {}, deps = {}) => handle({ method: 'GET', userId: 'user_admin', query: {}, ...over }, { env, fetchImpl: okFetch(), now: NOW, ...deps });

describe('admin-onboarding-funnel: who may read it', () => {
  it('only a listed admin gets the report; everyone else gets the same 403', async () => {
    expect((await call()).statusCode).toBe(200);
    expect((await call({ userId: 'user_two' })).statusCode).toBe(200);
    const nobody = await call({ userId: 'user_other' });
    const empty = await call({}, { env: { ...env, ADMIN_CLERK_USER_IDS: '' } });
    const unset = await call({}, { env: { ...env, ADMIN_CLERK_USER_IDS: undefined } });
    const noUser = await call({ userId: '' });
    for (const r of [nobody, empty, unset, noUser]) expect(r.statusCode).toBe(403);
    expect(nobody.body).toBe(empty.body); // nothing tells "not an admin" from "closed"
    expect(adminIds({ ADMIN_CLERK_USER_IDS: 'a, ,b' })).toEqual(['a', 'b']);
  });
  it('does not even call the database for a non-admin', async () => {
    const f = okFetch();
    await call({ userId: 'user_other' }, { fetchImpl: f });
    expect(f).not.toHaveBeenCalled();
  });
  it('405 for other methods, 503 without Supabase config', async () => {
    expect((await call({ method: 'POST' })).statusCode).toBe(405);
    expect((await call({}, { env: { ADMIN_CLERK_USER_IDS: 'user_admin' } })).statusCode).toBe(503);
  });
});

describe('admin-onboarding-funnel: the range', () => {
  it('defaults to the last 30 days ending now', () => {
    const r = resolveRange({}, NOW);
    expect(r.to.toISOString()).toBe(NOW.toISOString());
    expect(r.from.toISOString()).toBe('2026-10-23T12:00:00.000Z');
  });
  it('a plain end date includes that whole day', () => {
    const r = resolveRange({ from: '2026-11-01', to: '2026-11-07' }, NOW);
    expect(r.from.toISOString()).toBe('2026-11-01T00:00:00.000Z');
    expect(r.to.toISOString()).toBe('2026-11-08T00:00:00.000Z');
  });
  it('rejects garbage, an inverted range and one over 366 days', () => {
    expect(resolveRange({ from: 'yesterday' }, NOW).error).toBeTruthy();
    expect(resolveRange({ from: '2026-11-10', to: '2026-11-01' }, NOW).error).toBeTruthy();
    expect(resolveRange({ from: '2024-01-01', to: '2026-11-01' }, NOW).error).toMatch(/366/);
  });
  it('400 for a bad range, and the RPC receives the validated range with the service key', async () => {
    expect((await call({ query: { from: 'nope' } })).statusCode).toBe(400);
    const f = okFetch();
    await call({ query: { from: '2026-11-01', to: '2026-11-07' } }, { fetchImpl: f });
    const [url, init] = f.mock.calls[0];
    expect(url).toBe('https://db.test/rest/v1/rpc/onboarding_funnel');
    expect(JSON.parse(init.body)).toEqual({ p_from: '2026-11-01T00:00:00.000Z', p_to: '2026-11-08T00:00:00.000Z' });
    expect(init.headers.Authorization).toBe('Bearer service-secret');
  });
});

describe('admin-onboarding-funnel: the answer', () => {
  it('returns the report with no-store caching', async () => {
    const r = await call();
    expect(JSON.parse(r.body)).toEqual(report);
    expect(r.headers['Cache-Control']).toBe('no-store');
  });
  it('502 when the database fails or reports a problem', async () => {
    expect((await call({}, { fetchImpl: vi.fn(async () => ({ ok: false, status: 500, json: async () => ({}) })) })).statusCode).toBe(502);
    expect((await call({}, { fetchImpl: okFetch({ ok: false, error: 'bad_range' }) })).statusCode).toBe(502);
    expect((await call({}, { fetchImpl: vi.fn(async () => { throw new Error('net'); }) })).statusCode).toBe(502);
  });
  it('the exported handler is behind Clerk auth: no token means 401 and no report', async () => {
    const r = await handler({ httpMethod: 'GET', headers: {}, queryStringParameters: {} });
    expect(r.statusCode).toBe(401);
  });
});
