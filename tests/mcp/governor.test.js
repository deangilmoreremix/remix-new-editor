// @vitest-environment node
import { describe, it, expect, vi } from 'vitest';

vi.hoisted(() => {
  Object.assign(process.env, { MCP_KEY_SECRET: 'm'.repeat(40), NEXT_PUBLIC_SUPABASE_URL: 'https://x.supabase.co', SUPABASE_URL: 'https://x.supabase.co', NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon'.repeat(10), SUPABASE_SERVICE_ROLE_KEY: 'k'.repeat(40), INTERNAL_FUNCTION_SECRET: 's'.repeat(32) });
});
const rpc = vi.fn();
vi.mock('../../netlify/functions/_personalization/src/lib/supabase', () => ({ createServerClient: () => ({ rpc: (...a) => rpc(...a) }) }));

import { createGovernor, createMemoryGovernorStore, humanOnlyViolations, HUMAN_ONLY, createCatalog, createGatewayClient, createBrandedServer, connectInMemory } from '../../packages/studio-mcp-core/src/index.js';
import { createHandler, STUDIOS, classifyRequest } from '../../netlify/functions/mcp-gateway.js';
import { createMcpKey } from '../../netlify/functions/_shared/mcpKeys.js';
import { createHandler as keysHandler } from '../../netlify/functions/mcp-keys.js';
import { brand } from '../../mcp/brand.js';
import { customTools } from '../../mcp/tools.js';
import { GENERATION_TOOLS } from '../../packages/studio-mcp-core/src/server.js';

const KEY_ID = '11111111-1111-1111-1111-111111111111';

describe('governor', () => {
  it('reads and writes need no confirm; destructive and publish do, and say what they would do', async () => {
    const g = createGovernor({ store: createMemoryGovernorStore() });
    expect((await g.check({ keyId: KEY_ID, risk: 'read' })).ok).toBe(true);
    expect((await g.check({ keyId: KEY_ID, risk: 'write' })).ok).toBe(true);
    const no = await g.check({ keyId: KEY_ID, risk: 'destructive', label: 'leads DELETE' });
    expect(no).toMatchObject({ ok: false, status: 409, code: 'confirm_required' });
    expect(no.message).toMatch(/Nothing was done/);
    expect((await g.check({ keyId: KEY_ID, risk: 'publish', confirm: 'yes' })).ok).toBe(false); // only literal true counts
    expect((await g.check({ keyId: KEY_ID, risk: 'publish', confirm: true })).ok).toBe(true);
    expect((await g.check({ keyId: KEY_ID, risk: 'bogus' })).ok).toBe(false);
  });

  it('caps confirmed destructive/publish calls per key per UTC day; a refused call does not use the cap', async () => {
    let t = Date.parse('2026-11-23T10:00:00Z');
    const g = createGovernor({ store: createMemoryGovernorStore(), caps: { destructive: 2, publish: 1 }, now: () => t });
    await g.check({ keyId: KEY_ID, risk: 'destructive' }); // refused, not counted
    expect((await g.check({ keyId: KEY_ID, risk: 'destructive', confirm: true })).ok).toBe(true);
    expect((await g.check({ keyId: KEY_ID, risk: 'destructive', confirm: true })).ok).toBe(true);
    const over = await g.check({ keyId: KEY_ID, risk: 'destructive', confirm: true });
    expect(over).toMatchObject({ ok: false, status: 429, code: 'daily_cap' });
    expect((await g.check({ keyId: KEY_ID, risk: 'publish', confirm: true })).ok).toBe(true);
    expect((await g.check({ keyId: KEY_ID, risk: 'publish', confirm: true })).ok).toBe(false);
    expect((await g.check({ keyId: '22222222-2222-2222-2222-222222222222', risk: 'publish', confirm: true })).ok).toBe(true); // another key
    t = Date.parse('2026-11-24T00:00:01Z');
    expect((await g.check({ keyId: KEY_ID, risk: 'destructive', confirm: true })).ok).toBe(true); // next day
  });

  it('audit rows hold the tool, risk, outcome and time and nothing else; failures never throw', async () => {
    const store = createMemoryGovernorStore();
    const g = createGovernor({ store });
    await g.record({ keyId: KEY_ID, userId: 'u1', tool: 'leads DELETE', risk: 'destructive', ok: true, ms: 12.6, body: 'secret prompt', url: 'https://x.test', apiKey: 'sk-1' });
    expect(Object.keys(store.rows[0]).sort()).toEqual(['at', 'clerk_user_id', 'key_id', 'ms', 'ok', 'risk', 'tool']);
    expect(JSON.stringify(store.rows)).not.toMatch(/secret|x\.test|sk-1/);
    await expect(createGovernor({ store: { audit: async () => { throw new Error('db down'); } } }).record({ tool: 't', risk: 'read', ok: true })).resolves.toBeUndefined();
    expect((await g.recent('u1')).length).toBe(1);
    expect(await g.recent('someone-else')).toEqual([]);
  });
});

describe('human-only actions', () => {
  it('flags the names it should', () => {
    expect(humanOnlyViolations(['save_api_key', 'set_api_keys', 'create_mcp_key', 'revoke_mcp_key', 'checkout', 'upgrade', 'connect_social', 'oauth', 'delete_api_key'])).toHaveLength(9);
    expect(humanOnlyViolations(['image_generate', 'leads_delete', 'timeline_export_video', 'account_balance', 'connect_social_posts_list'].slice(0, 4))).toEqual([]);
    expect(HUMAN_ONLY.length).toBeGreaterThan(3);
  });

  it('no tool this server registers is a human-only action', async () => {
    const client = createGatewayClient({ gatewayUrl: 'https://gw.test', apiKey: 'sv_live_x', brandName: brand.name, fetchImpl: async () => ({ ok: true, status: 200, text: async () => '{}' }) });
    const mcp = await connectInMemory(createBrandedServer({ brand: { ...brand, customTools }, catalog: createCatalog(JSON.parse((await import('node:fs')).readFileSync('mcp/catalog.json', 'utf8'))), client }));
    const names = (await mcp.listTools()).tools.map((t) => t.name.replace(/^smartvid_/, ''));
    expect(names.length).toBeGreaterThan(40);
    expect(humanOnlyViolations(names)).toEqual([]);
    expect(GENERATION_TOOLS.length).toBeGreaterThan(5);
  });
});

describe('gateway enforcement', () => {
  const MU = 'mu_test_key_0123456789abcdef';
  function memoryStore() {
    const rows = [];
    return { rows, insert: async (r) => { const row = { id: crypto.randomUUID(), created_at: 'now', revoked_at: null, ...r }; rows.push(row); return row; }, byHash: async (h) => rows.find((r) => r.key_hash === h && !r.revoked_at) || null, countActive: async () => 0, touch: async () => {} };
  }
  async function setup(over = {}) {
    const store = memoryStore();
    const key = (await createMcpKey(store, { userId: 'owner_1', muapiKey: MU })).key;
    const gstore = createMemoryGovernorStore();
    const governor = createGovernor({ store: gstore, caps: { destructive: 2, publish: 1 } });
    const studios = { personalization: vi.fn(async () => ({ statusCode: 200, body: '{"ok":true}' })), ...over };
    const h = createHandler({ store: () => store, studios, env: {}, governor });
    const call = (path, body, method = 'POST') => h({ httpMethod: method, path: `/api/mcp-gateway${path}`, headers: { authorization: `Bearer ${key}` }, body: body ? JSON.stringify(body) : undefined });
    return { call, gstore, studios, store };
  }

  it('classifies requests itself, from the route and body', () => {
    expect(classifyRequest('/balance', 'GET').risk).toBe('read');
    expect(classifyRequest('/generate', 'POST').risk).toBe('write');
    expect(classifyRequest('/studio/personalization', 'POST', { method: 'DELETE', path: '/leads/x' }).risk).toBe('destructive');
    expect(classifyRequest('/studio/personalization', 'POST', { method: 'GET', path: '/leads' }).risk).toBe('read');
    expect(classifyRequest('/studio/anything-new', 'POST', {}).risk).toBe('write');
    expect(classifyRequest('/bridge/call', 'POST', { risk: 'publish', tool: 'x' }).risk).toBe('publish');
    expect(classifyRequest('/bridge/call', 'POST', { risk: 'nonsense' }).risk).toBe('write');
  });

  it('a delete without confirm is refused before the studio runs; with confirm it runs, is counted and audited', async () => {
    const { call, gstore, studios } = await setup();
    const refused = await call('/studio/personalization', { method: 'DELETE', path: '/leads/abc' });
    expect(refused.statusCode).toBe(409);
    expect(JSON.parse(refused.body).error.code).toBe('confirm_required');
    expect(studios.personalization).not.toHaveBeenCalled();
    const ok = await call('/studio/personalization', { method: 'DELETE', path: '/leads/abc', confirm: true });
    expect(ok.statusCode).toBe(200);
    expect(studios.personalization).toHaveBeenCalledTimes(1);
    expect(gstore.rows.map((r) => [r.tool, r.risk, r.ok])).toEqual([['personalization DELETE', 'destructive', true]]);
    expect(JSON.stringify(gstore.rows)).not.toMatch(/abc/);
  });

  it('enforces the daily cap at the gateway', async () => {
    const { call } = await setup();
    const d = (n) => call('/studio/personalization', { method: 'DELETE', path: `/leads/l${n}`, confirm: true });
    expect((await d(1)).statusCode).toBe(200);
    expect((await d(2)).statusCode).toBe(200);
    const third = await d(3);
    expect(third.statusCode).toBe(429);
    expect(JSON.parse(third.body).error.message).toMatch(/Daily limit/);
  });

  it('audits reads and writes too, including failures, with the caller\'s user id', async () => {
    const { call, gstore } = await setup({ personalization: async () => ({ statusCode: 500, body: '{}' }) });
    await call('/studio/personalization', { method: 'GET', path: '/leads' });
    await call('/studio/personalization', { method: 'POST', path: '/leads', body: {} });
    expect(gstore.rows.map((r) => [r.risk, r.ok, r.clerk_user_id])).toEqual([['read', false, 'owner_1'], ['write', false, 'owner_1']]);
  });

  it('with no governor configured it still refuses unconfirmed destructive calls', async () => {
    const store = memoryStore();
    const key = (await createMcpKey(store, { userId: 'owner_1', muapiKey: MU })).key;
    const h = createHandler({ store: () => store, studios: { personalization: async () => ({ statusCode: 200, body: '{}' }) }, env: {}, governor: null });
    const r = await h({ httpMethod: 'POST', path: '/api/mcp-gateway/studio/personalization', headers: { authorization: `Bearer ${key}` }, body: JSON.stringify({ method: 'DELETE', path: '/leads/x' }) });
    expect(r.statusCode).toBe(409);
  });
});

describe('tool-level confirm and the audit view', () => {
  it('leads_delete tells the model what it would do and sends nothing until confirm: true', async () => {
    const sent = [];
    const fetchImpl = async (u, init = {}) => { sent.push({ u, body: init.body ? JSON.parse(init.body) : null, tool: init.headers?.['X-MCP-Tool'] }); return { ok: true, status: 200, text: async () => '{"ok":true}' }; };
    const client = createGatewayClient({ gatewayUrl: 'https://gw.test', apiKey: 'sv_live_x', brandName: brand.name, fetchImpl });
    const mcp = await connectInMemory(createBrandedServer({ brand: { ...brand, customTools }, catalog: createCatalog([]), client }));
    const no = JSON.parse((await mcp.callTool({ name: 'smartvid_leads_delete', arguments: { lead_id: 'abc' } })).content[0].text);
    expect(no.status).toBe('confirmation_required');
    expect(no.message).toMatch(/Nothing was done/);
    expect(sent).toHaveLength(0);
    await mcp.callTool({ name: 'smartvid_leads_delete', arguments: { lead_id: 'abc', confirm: true } });
    expect(sent).toHaveLength(1);
    expect(sent[0].body).toMatchObject({ method: 'DELETE', path: '/leads/abc', confirm: true });
    expect(sent[0].tool).toBe('leads_delete');
    const tool = (await mcp.listTools()).tools.find((t) => t.name === 'smartvid_leads_delete');
    expect(tool.description).toMatch(/requires confirm: true/);
    expect(tool.annotations.destructiveHint).toBe(true);
    expect((await mcp.listTools()).tools.find((t) => t.name === 'smartvid_leads_list').annotations.readOnlyHint).toBe(true);
  });

  it('mcp-keys audit returns only the caller\'s own recent events', async () => {
    const gstore = createMemoryGovernorStore();
    const g = createGovernor({ store: gstore });
    await g.record({ keyId: KEY_ID, userId: 'user_1', tool: 'leads DELETE', risk: 'destructive', ok: true, ms: 5 });
    await g.record({ keyId: KEY_ID, userId: 'user_2', tool: 'secret-other', risk: 'read', ok: true, ms: 5 });
    const h = keysHandler({ store: {}, env: { MCP_KEY_SECRET: 'x'.repeat(40) }, audit: { recent: (u, n) => g.recent(u, n) } });
    const r = await h({ httpMethod: 'POST', body: JSON.stringify({ action: 'audit' }), headers: {}, auth: { userId: 'user_1' } });
    const body = JSON.parse(r.body);
    expect(body.events.map((e) => e.tool)).toEqual(['leads DELETE']);
    expect(r.body).not.toContain('secret-other');
  });
});
