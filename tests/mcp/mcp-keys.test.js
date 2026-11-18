// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { newRawKey, isMcpKey, hashKey, encryptSecret, decryptSecret, createMcpKey, resolveMcpKey } from '../../netlify/functions/_shared/mcpKeys.js';
import { createHandler } from '../../netlify/functions/mcp-keys.js';

const SECRET = 'x'.repeat(40);
const MU = 'mu_test_key_0123456789abcdef';

function memoryStore() {
  const rows = [];
  return {
    rows,
    insert: async (r) => { const row = { id: crypto.randomUUID(), created_at: new Date().toISOString(), revoked_at: null, last_used_at: null, ...r }; rows.push(row); return row; },
    byHash: async (h) => rows.find((r) => r.key_hash === h && !r.revoked_at) || null,
    listForUser: async (u) => rows.filter((r) => r.clerk_user_id === u && !r.revoked_at),
    countActive: async (u) => rows.filter((r) => r.clerk_user_id === u && !r.revoked_at).length,
    revoke: async (u, id) => { const r = rows.find((x) => x.id === id && x.clerk_user_id === u && !x.revoked_at); if (r) r.revoked_at = 'now'; return !!r; },
    touch: async (id) => { rows.find((r) => r.id === id).last_used_at = 'now'; },
  };
}

let env0;
beforeEach(() => { env0 = process.env.MCP_KEY_SECRET; process.env.MCP_KEY_SECRET = SECRET; });
afterEach(() => { if (env0 === undefined) delete process.env.MCP_KEY_SECRET; else process.env.MCP_KEY_SECRET = env0; });

describe('mcp key primitives', () => {
  it('generates well-formed, unique keys and hashes them', () => {
    const a = newRawKey(); const b = newRawKey();
    expect(isMcpKey(a)).toBe(true);
    expect(a).not.toBe(b);
    expect(hashKey(a)).toMatch(/^[0-9a-f]{64}$/);
    expect(isMcpKey('sv_live_short')).toBe(false);
    expect(isMcpKey(`${a}x!`)).toBe(false);
  });

  it('encrypts with a per-value salt, round-trips, and detects tampering', () => {
    const e1 = encryptSecret(MU); const e2 = encryptSecret(MU);
    expect(e1).not.toBe(e2);
    expect(e1).not.toContain(MU);
    expect(decryptSecret(e1)).toBe(MU);
    const parts = e1.split(':'); parts[4] = Buffer.from('tampered').toString('base64');
    expect(decryptSecret(parts.join(':'))).toBeNull();
    expect(decryptSecret('plain-text')).toBeNull();
  });

  it('fails closed without a strong MCP_KEY_SECRET', () => {
    const enc = encryptSecret(MU);
    process.env.MCP_KEY_SECRET = 'short';
    expect(() => encryptSecret(MU)).toThrow(/MCP_KEY_SECRET/);
    expect(decryptSecret(enc)).toBeNull();
    process.env.MCP_KEY_SECRET = 'y'.repeat(40);
    expect(decryptSecret(enc)).toBeNull(); // a different secret cannot read it
  });
});

describe('create / resolve / revoke', () => {
  it('stores only the hash + ciphertext and resolves the key to its user', async () => {
    const store = memoryStore();
    const r = await createMcpKey(store, { userId: 'user_1', muapiKey: MU, openaiKey: 'sk-abcdefghijklmnopqrstuv' });
    const row = store.rows[0];
    expect(JSON.stringify(row)).not.toContain(r.key);
    expect(JSON.stringify(row)).not.toContain(MU);
    expect(row.key_hash).toBe(hashKey(r.key));
    const who = await resolveMcpKey(store, r.key);
    expect(who).toMatchObject({ userId: 'user_1', keys: { muapi: MU, openai: 'sk-abcdefghijklmnopqrstuv' } });
    expect(store.rows[0].last_used_at).toBe('now');
  });

  it('rejects unknown, malformed, revoked keys and undecryptable rows', async () => {
    const store = memoryStore();
    const r = await createMcpKey(store, { userId: 'user_1', muapiKey: MU });
    expect(await resolveMcpKey(store, newRawKey())).toBeNull();
    expect(await resolveMcpKey(store, 'nope')).toBeNull();
    store.rows[0].muapi_key_enc = 'v1:bad:bad:bad:bad';
    expect(await resolveMcpKey(store, r.key)).toBeNull();
    const r2 = await createMcpKey(store, { userId: 'user_1', muapiKey: MU });
    await store.revoke('user_1', store.rows[1].id);
    expect(await resolveMcpKey(store, r2.key)).toBeNull();
  });

  it('requires a valid upstream key and caps active keys', async () => {
    const store = memoryStore();
    expect((await createMcpKey(store, { userId: 'u', muapiKey: null })).error).toBe('bad_key');
    expect((await createMcpKey(store, { userId: 'u', muapiKey: MU, openaiKey: 'nope' })).error).toBe('bad_openai_key');
    for (let i = 0; i < 10; i++) await createMcpKey(store, { userId: 'u', muapiKey: MU });
    expect((await createMcpKey(store, { userId: 'u', muapiKey: MU })).error).toBe('too_many_keys');
  });
});

describe('mcp-keys function', () => {
  const ev = (body, over = {}) => ({ httpMethod: 'POST', body: JSON.stringify(body), headers: { 'x-muapi-key': MU }, auth: { userId: 'user_1', workspaceId: 'personal', claims: {} }, ...over });

  it('creates, lists (never returning the key) and revokes — only for the owner', async () => {
    const store = memoryStore();
    const h = createHandler({ store, env: { MCP_KEY_SECRET: SECRET } });
    const created = JSON.parse((await h(ev({ action: 'create', label: 'Claude' }))).body);
    expect(created.ok).toBe(true);
    expect(isMcpKey(created.key)).toBe(true);
    const listed = JSON.parse((await h(ev({ action: 'list' }))).body);
    expect(listed.keys).toHaveLength(1);
    expect(JSON.stringify(listed)).not.toContain(created.key);
    const other = await h(ev({ action: 'revoke', id: created.id }, { auth: { userId: 'user_2' } }));
    expect(other.statusCode).toBe(404);
    expect((await h(ev({ action: 'revoke', id: created.id }))).statusCode).toBe(200);
    expect(JSON.parse((await h(ev({ action: 'list' }))).body).keys).toHaveLength(0);
  });

  it('needs a session, a configured secret, a valid body, and (optionally) the entitlement', async () => {
    const store = memoryStore();
    expect((await createHandler({ store, env: { MCP_KEY_SECRET: SECRET } })(ev({ action: 'list' }, { auth: {} }))).statusCode).toBe(401);
    expect((await createHandler({ store, env: {} })(ev({ action: 'list' }))).statusCode).toBe(503);
    expect((await createHandler({ store, env: { MCP_KEY_SECRET: SECRET } })(ev({ action: 'x' }))).statusCode).toBe(400);
    expect((await createHandler({ store, env: { MCP_KEY_SECRET: SECRET } })(ev({ action: 'create' }, { headers: {} }))).statusCode).toBe(400);
    const gated = createHandler({ store, env: { MCP_KEY_SECRET: SECRET, MCP_REQUIRE_ENTITLEMENT: '1' } });
    expect((await gated(ev({ action: 'create' }))).statusCode).toBe(403);
    expect((await gated(ev({ action: 'create' }, { auth: { userId: 'user_1', claims: { fea: 'u:smartvideo_full_access' } } }))).statusCode).toBe(200);
  });
});
