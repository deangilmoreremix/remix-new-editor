// @vitest-environment node
/** MCP tool → real MCP client → real gateway → real route handlers (Supabase faked). The whole path, offline. */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.hoisted(() => {
  Object.assign(process.env, { MCP_KEY_SECRET: 'm'.repeat(40), NEXT_PUBLIC_SUPABASE_URL: 'https://x.supabase.co', SUPABASE_URL: 'https://x.supabase.co', NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon'.repeat(10), SUPABASE_SERVICE_ROLE_KEY: 'k'.repeat(40), INTERNAL_FUNCTION_SECRET: 's'.repeat(32) });
});

const rpc = vi.fn();
vi.mock('../../netlify/functions/_personalization/src/lib/supabase', () => ({
  createServerClient: () => ({ rpc: (...a) => rpc(...a) }),
}));

import { createCatalog, createGatewayClient, createBrandedServer, connectInMemory } from '../../packages/studio-mcp-core/src/index.js';
import { createHandler, STUDIOS } from '../../netlify/functions/mcp-gateway.js';
import { createMcpKey } from '../../netlify/functions/_shared/mcpKeys.js';
import { brand } from '../../mcp/brand.js';
import { customTools } from '../../mcp/tools.js';

const MU = 'mu_test_key_0123456789abcdef';

function memoryStore() {
  const rows = [];
  return {
    rows,
    insert: async (r) => { const row = { id: crypto.randomUUID(), created_at: 'now', revoked_at: null, ...r }; rows.push(row); return row; },
    byHash: async (h) => rows.find((r) => r.key_hash === h && !r.revoked_at) || null,
    countActive: async () => 0,
    touch: async () => {},
  };
}

/** A real MCP key for `userId`, resolved by the real gateway. `userId: 'byok'` uses the local-development bearer path instead. */
async function connect(userId = 'owner_1') {
  const store = memoryStore();
  const env = userId === 'byok' ? { MCP_ALLOW_BYOK: '1' } : {};
  const apiKey = userId === 'byok' ? MU : (await createMcpKey(store, { userId, muapiKey: MU })).key;
  const gw = createHandler({ store: () => store, studios: { personalization: STUDIOS.personalization }, env });
  const fetchImpl = async (url, init = {}) => {
    const u = new URL(url);
    const out = await gw({ httpMethod: init.method || 'GET', path: u.pathname, headers: Object.fromEntries(Object.entries(init.headers || {}).map(([k, v]) => [k.toLowerCase(), v])), body: init.body });
    return { ok: out.statusCode < 400, status: out.statusCode, statusText: '', headers: { get: () => null }, text: async () => out.body };
  };
  const client = createGatewayClient({ gatewayUrl: 'https://gw.test/api/mcp-gateway', apiKey, brandName: brand.name, fetchImpl, pollIntervalMs: 1 });
  client.sleep = async () => {};
  return connectInMemory(createBrandedServer({ brand: { ...brand, customTools }, catalog: createCatalog([]), client }));
}
const call = async (mcp, name, args = {}) => {
  // Argument-schema failures come back as a plain protocol error message, not JSON.
  const r = await mcp.callTool({ name: `smartvid_${name}`, arguments: args }).catch((e) => ({ isError: true, content: [{ text: JSON.stringify({ error: e.message }) }] }));
  let body; try { body = JSON.parse(r.content[0].text); } catch { body = { error: r.content[0].text }; }
  return { isError: !!r.isError, body };
};

beforeEach(() => rpc.mockReset());

describe('Lead Finder tools', () => {
  it('leads_list runs as the key owner', async () => {
    rpc.mockResolvedValue({ data: [{ id: 'l1', stage: 'New' }], error: null });
    const r = await call(await connect(), 'leads_list');
    expect(r.isError).toBe(false);
    expect(rpc).toHaveBeenCalledWith('lead_finder_leads_list', { p_clerk_user_id: 'owner_1' });
  });

  it('a different key owner reads a different user, never the first', async () => {
    rpc.mockResolvedValue({ data: [], error: null });
    await call(await connect('owner_2'), 'leads_list');
    expect(rpc).toHaveBeenCalledWith('lead_finder_leads_list', { p_clerk_user_id: 'owner_2' });
  });

  it('input errors come back as tool errors from the real validation, not as server faults', async () => {
    const mcp = await connect();
    const badNiche = await call(mcp, 'businesses_find', { niche: 'not-a-niche', location: 'Austin, TX' });
    expect(badNiche.isError).toBe(true);
    expect(JSON.stringify(badNiche.body)).toMatch(/niche/i);
    const noWebsite = await call(mcp, 'business_contact_enrich', {});
    expect(noWebsite.isError).toBe(true);
    const badLead = await call(mcp, 'leads_save', { business: { id: '' } });
    expect(badLead.isError).toBe(true);
    expect(rpc).not.toHaveBeenCalled();
  });

  it('refuses ids that are not plain ids before anything is sent', async () => {
    const mcp = await connect();
    expect((await call(mcp, 'leads_update', { lead_id: '../x', stage: 'New' })).isError).toBe(true);
    expect((await call(mcp, 'leads_delete', { lead_id: 'a/b' })).isError).toBe(true);
  });

  it('the gateway refuses to run as a bring-your-own-key principal', async () => {
    const mcp = await connect('byok');
    const r = await call(mcp, 'leads_list');
    expect(r.isError).toBe(true);
    expect(JSON.stringify(r.body)).toMatch(/signed-in|MCP key/i);
  });

  it('discovery tools reach their routes (validation answers prove the right handler ran)', async () => {
    const mcp = await connect();
    const status = await call(mcp, 'brand_assets_status', { job_id: 'job_1' });
    expect(JSON.stringify(status.body)).not.toMatch(/mu-?api/i);
    const nf = await call(mcp, 'business_research', { website_url: 'http://127.0.0.1/admin' });
    expect(nf.isError).toBe(true); // SSRF guard in the real handler
  });
});
