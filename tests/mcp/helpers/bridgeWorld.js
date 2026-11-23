// Shared by the bridge tests: one in-memory world (clock, bridge store, key store, governor, gateway, tab endpoint, MCP server).
import { vi } from 'vitest';
import { createBridge, createMemoryBridgeStore, LIMITS, createTabBridge, createGovernor, createMemoryGovernorStore, createCatalog, createGatewayClient, createBrandedServer, connectInMemory } from '../../../packages/studio-mcp-core/src/index.js';
import { createHandler as gatewayHandler } from '../../../netlify/functions/mcp-gateway.js';
import { createHandler as tabHandler } from '../../../netlify/functions/mcp-bridge.js';
import { createMcpKey } from '../../../netlify/functions/_shared/mcpKeys.js';
import { brand } from '../../../mcp/brand.js';

export const MU = 'mu_test_key_0123456789abcdef';
export const fast = { ...LIMITS, waitPollMs: 5 };

export function keyStore() {
  const rows = [];
  return { rows, insert: async (r) => { const row = { id: crypto.randomUUID(), created_at: 'now', revoked_at: null, ...r }; rows.push(row); return row; }, byHash: async (h) => rows.find((r) => r.key_hash === h && !r.revoked_at) || null, countActive: async () => 0, touch: async () => {} };
}

export async function world({ userId = 'owner_1', caps } = {}) {
  let t = Date.parse('2026-11-23T10:00:00Z');
  const clock = { now: () => t, advance: (ms) => { t += ms; } };
  const bstore = createMemoryBridgeStore({ now: clock.now });
  const bridge = createBridge({ store: bstore, now: clock.now, limits: fast, brandName: 'SmartVid' });
  const ks = keyStore();
  const mkKey = async (u) => (await createMcpKey(ks, { userId: u, muapiKey: MU })).key;
  const key = await mkKey(userId);
  const gstore = createMemoryGovernorStore();
  const governor = createGovernor({ store: gstore, caps: caps || { destructive: 5, publish: 5 }, now: clock.now });
  const gw = gatewayHandler({ store: () => ks, studios: {}, env: {}, governor, bridge });
  const tabApi = tabHandler({ bridge });

  const asUser = (u) => (init) => tabApi({ httpMethod: 'POST', headers: {}, auth: { userId: u }, body: init.body });
  const tabFetch = (u) => async (_url, init) => { const out = await asUser(u)(init); return { ok: out.statusCode < 400, status: out.statusCode, json: async () => JSON.parse(out.body) }; };

  const mkTab = (u, { confirm = async () => 'once', tools } = {}) => {
    const bridgeTab = createTabBridge({ endpoint: '/api/mcp-bridge', fetchImpl: tabFetch(u), getHeaders: async () => ({}), confirm, label: 'Test tab', now: clock.now, setTimeoutImpl: () => 0 });
    const ran = [];
    bridgeTab.setTools('timeline', tools || [
      { name: 'timeline_get_timeline', description: 'Read the timeline', risk: 'read', run: async () => { ran.push('get'); return { clips: [{ id: 'c1' }] }; } },
      { name: 'timeline_add_clip', description: 'Add a clip', risk: 'write', run: async (a) => { ran.push(['add', a]); return { id: 'c2' }; } },
      { name: 'timeline_delete_all', description: 'Remove everything', risk: 'destructive', run: async () => { ran.push('delete'); return { removed: 9 }; } },
      { name: 'timeline_boom', description: 'Throws', risk: 'read', run: async () => { throw new Error('page exploded'); } },
      { name: 'timeline_big', description: 'Huge result', risk: 'read', run: async () => ({ blob: 'x'.repeat(1_200_000) }) },
    ]);
    return { tab: bridgeTab, ran };
  };

  const gwFetch = (apiKey) => async (url, init = {}) => {
    const u = new URL(url);
    const out = await gw({ httpMethod: init.method || 'GET', path: u.pathname + u.search, queryStringParameters: Object.fromEntries(u.searchParams), headers: Object.fromEntries(Object.entries(init.headers || {}).map(([k, v]) => [k.toLowerCase(), v])), body: init.body });
    return { ok: out.statusCode < 400, status: out.statusCode, statusText: '', headers: { get: () => null }, text: async () => out.body };
  };
  const mcpFor = async (apiKey) => {
    const client = createGatewayClient({ gatewayUrl: 'https://gw.test/api/mcp-gateway', apiKey, brandName: brand.name, fetchImpl: gwFetch(apiKey), pollIntervalMs: 1 });
    return connectInMemory(createBrandedServer({ brand, catalog: createCatalog([]), client }));
  };
  const call = async (mcp, name, args = {}) => {
    const r = await mcp.callTool({ name: `smartvid_${name}`, arguments: args }).catch((e) => ({ isError: true, content: [{ text: JSON.stringify({ error: e.message }) }] }));
    let body; try { body = JSON.parse(r.content[0].text); } catch { body = { error: r.content[0].text }; }
    return { isError: !!r.isError, body };
  };
  /** run `fn` while the tab keeps polling, like a real tab would */
  const withPolling = async (tab, fn) => {
    let stop = false;
    const loop = (async () => { while (!stop) { await tab.tick(); await new Promise((r) => setTimeout(r, 4)); } })();
    try { return await fn(); } finally { stop = true; await loop; }
  };
  return { clock, bstore, bridge, gstore, key, mkKey, mkTab, mcpFor, call, withPolling, ks };
}

