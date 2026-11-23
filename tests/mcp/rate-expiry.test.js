// @vitest-environment node
import { describe, it, expect, vi } from 'vitest';
import { createRateLimiter, createMemoryRateStore, createSupabaseRateStore } from '../../packages/studio-mcp-core/src/index.js';
import { createMcpKey, resolveMcpKey } from '../../netlify/functions/_shared/mcpKeys.js';
import { createHandler as keysHandler } from '../../netlify/functions/mcp-keys.js';
import { createHandler as gatewayHandler } from '../../netlify/functions/mcp-gateway.js';
import { createHttpHandler } from '../../netlify/functions/mcp-http.js';
import { keyStore, MU } from './helpers/bridgeWorld.js';

vi.hoisted(() => { process.env.MCP_KEY_SECRET = 'm'.repeat(40); });

describe('rate limiter', () => {
  it('allows the limit, refuses the next call with a Retry-After, and starts fresh next minute', async () => {
    let t = Date.parse('2026-11-24T10:00:10Z');
    const l = createRateLimiter({ store: createMemoryRateStore(), perMinute: 3, now: () => t, brandName: 'SmartVid' });
    for (let i = 0; i < 3; i++) expect((await l.check('k1')).ok).toBe(true);
    const over = await l.check('k1');
    expect(over).toMatchObject({ ok: false, retryAfter: 50 });
    expect(over.message).toMatch(/SmartVid/);
    expect((await l.check('k2')).ok).toBe(true); // other keys are unaffected
    t += 51_000;
    expect((await l.check('k1')).ok).toBe(true);
  });
  it('falls back to a per-instance counter when the shared store fails, and 0 disables the limit', async () => {
    const bad = { hit: async () => { throw new Error('db down'); } };
    const l = createRateLimiter({ store: bad, perMinute: 2 });
    expect((await l.check('k')).ok).toBe(true);
    expect((await l.check('k')).ok).toBe(true);
    expect((await l.check('k')).ok).toBe(false);
    expect((await createRateLimiter({ store: bad, perMinute: 0 }).check('k')).ok).toBe(true);
  });
  it('the Supabase store calls the migration function and returns its count', async () => {
    const rpc = vi.fn(async () => ({ data: 7, error: null }));
    expect(await createSupabaseRateStore({ rpc }).hit('kid', 1_700_000_000_000)).toBe(7);
    expect(rpc.mock.calls[0][0]).toBe('mcp_rate_hit');
  });
});

describe('gateway and hosted endpoint apply it', () => {
  it('gateway answers 429 + Retry-After past the limit, but never throttles result polling', async () => {
    const ks = keyStore();
    const key = (await createMcpKey(ks, { userId: 'u', muapiKey: MU })).key;
    const limiter = createRateLimiter({ store: createMemoryRateStore(), perMinute: 2, brandName: 'SmartVid' });
    const gw = gatewayHandler({ store: () => ks, studios: {}, env: {}, governor: null, bridge: null, limiter });
    const call = (path) => gw({ httpMethod: 'GET', path, headers: { authorization: `Bearer ${key}` } });
    vi.stubGlobal('fetch', async () => ({ ok: true, status: 200, text: async () => '{"balance":1,"status":"completed"}' }));
    expect((await call('/api/mcp-gateway/balance')).statusCode).toBe(200);
    expect((await call('/api/mcp-gateway/balance')).statusCode).toBe(200);
    const blocked = await call('/api/mcp-gateway/balance');
    expect(blocked.statusCode).toBe(429);
    expect(Number(blocked.headers['Retry-After'])).toBeGreaterThan(0);
    expect(blocked.body).not.toMatch(/mu-?api/i);
    expect((await call('/api/mcp-gateway/result/abc123')).statusCode).toBe(200);
    vi.unstubAllGlobals();
  });
  it('the hosted endpoint counts one MCP request once', async () => {
    const ks = keyStore();
    const key = (await createMcpKey(ks, { userId: 'u', muapiKey: MU })).key;
    const limiter = createRateLimiter({ store: createMemoryRateStore(), perMinute: 1 });
    const handle = createHttpHandler({ store: () => ks, limiter, gateway: async () => ({ statusCode: 200, body: '{}' }) });
    const req = () => new Request('https://s.test/api/mcp', { method: 'POST', headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json', accept: 'application/json, text/event-stream' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'ping' }) });
    expect((await handle(req())).status).toBe(200);
    const second = await handle(req());
    expect(second.status).toBe(429);
    expect(second.headers.get('retry-after')).toBeTruthy();
  });
});

describe('key expiry and rotation', () => {
  it('an expiring key works until its date, then stops like a revoked one', async () => {
    const ks = keyStore();
    const t0 = Date.parse('2026-11-24T00:00:00Z');
    const { key } = await createMcpKey(ks, { userId: 'u', muapiKey: MU, expiresInDays: 30, now: () => t0 });
    expect(ks.rows[0].expires_at).toBe('2026-12-24T00:00:00.000Z');
    expect(await resolveMcpKey(ks, key, { now: () => t0 + 29 * 86_400_000 })).toMatchObject({ userId: 'u' });
    expect(await resolveMcpKey(ks, key, { now: () => t0 + 31 * 86_400_000 })).toBeNull();
  });
  it('keys without an expiry never expire and store no expires_at', async () => {
    const ks = keyStore();
    const { key } = await createMcpKey(ks, { userId: 'u', muapiKey: MU });
    expect('expires_at' in ks.rows[0]).toBe(false);
    expect(await resolveMcpKey(ks, key, { now: () => Date.now() + 10 * 365 * 86_400_000 })).not.toBeNull();
  });

  const keysApi = (store, env = {}) => {
    const h = keysHandler({ store, env: { MCP_KEY_SECRET: 'm'.repeat(40), ...env } });
    return (body) => h({ httpMethod: 'POST', headers: { 'x-muapi-key': MU }, auth: { userId: 'u' }, body: JSON.stringify(body) }).then((r) => ({ status: r.statusCode, body: JSON.parse(r.body) }));
  };
  const storeWithRevoke = () => {
    const ks = keyStore();
    ks.listForUser = async (u) => ks.rows.filter((r) => r.clerk_user_id === u && !r.revoked_at);
    ks.countActive = async (u) => ks.rows.filter((r) => r.clerk_user_id === u && !r.revoked_at).length;
    ks.revoke = async (u, id) => { const r = ks.rows.find((x) => x.id === id && x.clerk_user_id === u && !x.revoked_at); if (r) r.revoked_at = 'now'; return !!r; };
    return ks;
  };

  it('MCP_KEY_MAX_DAYS sets the default and caps what a user asks for', async () => {
    const ks = storeWithRevoke();
    const api = keysApi(ks, { MCP_KEY_MAX_DAYS: '90' });
    const a = await api({ action: 'create' });
    const b = await api({ action: 'create', expiresInDays: 365 });
    const c = await api({ action: 'create', expiresInDays: 7 });
    const days = (x) => Math.round((Date.parse(x.body.expires_at) - Date.now()) / 86_400_000);
    expect([days(a), days(b), days(c)]).toEqual([90, 90, 7]);
  });
  it('rotate makes a new key then revokes the old one; the old key stops working, the new one works', async () => {
    const ks = storeWithRevoke();
    const api = keysApi(ks);
    const first = await api({ action: 'create', label: 'Claude' });
    const rotated = await api({ action: 'rotate', id: first.body.id });
    expect(rotated.status).toBe(200);
    expect(rotated.body).toMatchObject({ label: 'Claude', replaced: first.body.id });
    expect(rotated.body.key).not.toBe(first.body.key);
    expect(await resolveMcpKey(ks, first.body.key)).toBeNull();
    expect(await resolveMcpKey(ks, rotated.body.key)).toMatchObject({ userId: 'u' });
  });
  it('rotate works at the key limit, and never revokes the old key when the new one cannot be made', async () => {
    const ks = storeWithRevoke();
    const api = keysApi(ks);
    let last;
    for (let i = 0; i < 10; i++) last = await api({ action: 'create' });
    expect((await api({ action: 'create' })).status).toBe(400);
    expect((await api({ action: 'rotate', id: last.body.id })).status).toBe(200);
    const ks2 = storeWithRevoke();
    const made = await keysApi(ks2)({ action: 'create' });
    const noKeys = keysHandler({ store: ks2, env: { MCP_KEY_SECRET: 'm'.repeat(40) } });
    const bad = await noKeys({ httpMethod: 'POST', headers: {}, auth: { userId: 'u' }, body: JSON.stringify({ action: 'rotate', id: made.body.id }) });
    expect(bad.statusCode).toBe(400);
    expect(await resolveMcpKey(ks2, made.body.key)).not.toBeNull();
  });
  it('rotating someone else\'s key is a 404', async () => {
    const ks = storeWithRevoke();
    const mine = await keysApi(ks)({ action: 'create' });
    const other = keysHandler({ store: ks, env: { MCP_KEY_SECRET: 'm'.repeat(40) } });
    const r = await other({ httpMethod: 'POST', headers: { 'x-muapi-key': MU }, auth: { userId: 'someone_else' }, body: JSON.stringify({ action: 'rotate', id: mine.body.id }) });
    expect(r.statusCode).toBe(404);
  });
});
