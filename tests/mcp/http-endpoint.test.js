// @vitest-environment node
import { describe, it, expect, vi } from 'vitest';
import { connectOverHttp, createGovernor, createMemoryGovernorStore, humanOnlyViolations } from '../../packages/studio-mcp-core/src/index.js';
import { createHttpHandler } from '../../netlify/functions/mcp-http.js';
import { createHandler as createGateway } from '../../netlify/functions/mcp-gateway.js';
import { createMcpKey } from '../../netlify/functions/_shared/mcpKeys.js';
import { keyStore, MU } from './helpers/bridgeWorld.js';

vi.hoisted(() => { process.env.MCP_KEY_SECRET = 'm'.repeat(40); });

async function setup(opts = {}) {
  const ks = keyStore();
  const key = (await createMcpKey(ks, { userId: 'owner_1', muapiKey: MU })).key;
  const governor = createGovernor({ store: createMemoryGovernorStore() });
  const gateway = createGateway({ store: () => ks, studios: {}, env: {}, governor, bridge: null });
  const handle = createHttpHandler({ store: () => ks, gateway, ...opts });
  const fetchImpl = async (url, init) => handle(new Request(url, init));
  const connect = (k) => connectOverHttp({ url: 'https://site.test/api/mcp', fetchImpl, headers: k ? { Authorization: `Bearer ${k}` } : {} });
  return { key, handle, fetchImpl, connect, ks };
}

describe('hosted MCP over streamable HTTP', () => {
  it('refuses a request with no key, a malformed key and an unknown key (401, branded, nothing about the backend)', async () => {
    const t = await setup();
    const post = (auth) => t.handle(new Request('https://site.test/api/mcp', { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream', ...(auth ? { authorization: auth } : {}) }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }) }));
    for (const auth of [undefined, 'Bearer nope', 'Bearer sv_live_' + 'x'.repeat(43)]) {
      const res = await post(auth);
      expect(res.status).toBe(401);
      const text = await res.text();
      expect(text).toMatch(/SmartVid/);
      expect(text).not.toMatch(/mu-?api/i);
    }
    expect((await t.handle(new Request('https://site.test/api/mcp', { method: 'GET' }))).status).toBe(405);
  });

  it('lists the same tools as the stdio server, with no upstream name and nothing human-only', async () => {
    const t = await setup();
    const mcp = await t.connect(t.key);
    const { tools } = await mcp.listTools();
    expect(tools.length).toBeGreaterThan(50);
    expect(tools.every((x) => x.name.startsWith('smartvid_'))).toBe(true);
    expect(JSON.stringify(tools)).not.toMatch(/mu-?api/i);
    expect(humanOnlyViolations(tools.map((x) => x.name))).toEqual([]);
  });

  it('runs a tool through the in-process gateway (read call, then the safeguards still apply)', async () => {
    const t = await setup();
    const mcp = await t.connect(t.key);
    const studios = await mcp.callTool({ name: 'smartvid_list_studios', arguments: {} });
    expect(studios.isError).toBeFalsy();
    expect(studios.content[0].text).not.toMatch(/mu-?api/i);
    // confirm gating comes from the gateway, not from the transport
    const del = await mcp.callTool({ name: 'smartvid_leads_delete', arguments: { lead_id: 'abc' } });
    expect(JSON.stringify(del.content)).toMatch(/confirm/i);
  });

  it('stops a caller the limiter refuses (429 with Retry-After)', async () => {
    const t = await setup({ limit: async () => ({ ok: false, retryAfter: 7, message: 'Slow down.' }) });
    const res = await t.handle(new Request('https://site.test/api/mcp', { method: 'POST', headers: { authorization: `Bearer ${t.key}`, 'content-type': 'application/json' }, body: '{}' }));
    expect(res.status).toBe(429);
    expect(res.headers.get('retry-after')).toBe('7');
  });
});
