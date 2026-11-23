// @vitest-environment node
import { describe, it, expect, vi } from 'vitest';
import { jwtVerify } from 'jose';
import { createPagesStudio, PAGE_ACTIONS } from '../../netlify/functions/_shared/mcpPages.js';
import { ownerSupabase, mintOwnerToken } from '../../netlify/functions/_shared/ownerSupabase.js';
import { classifyRequest } from '../../netlify/functions/mcp-gateway.js';
import { customTools } from '../../mcp/tools.js';
import { humanOnlyViolations } from '../../packages/studio-mcp-core/src/governor.js';

const SECRET = 's'.repeat(40);
const who = { userId: 'user_owner', workspaceId: 'personal' };

// A tiny chainable stand-in for supabase-js that records what the app's data layer asks for.
function fakeDb() {
  const log = [];
  const rows = [];
  const from = (table) => {
    const q = { table, ops: [] };
    const chain = new Proxy({}, { get: (_t, prop) => {
      if (prop === 'then') return (res) => res({ data: q.result ?? (q.single ? rows[0] : rows), error: null });
      return (...args) => {
        q.ops.push([prop, args]);
        if (prop === 'insert') { const r = (Array.isArray(args[0]) ? args[0] : [args[0]]).map((x) => ({ ...x })); rows.splice(0, rows.length, ...r); }
        if (prop === 'single') q.single = true;
        if (prop === 'update') rows.splice(0, rows.length, { id: 'abcdefgh12', ...args[0] });
        log.push({ table, op: prop, args });
        return chain;
      };
    } });
    return chain;
  };
  return { from, rpc: async () => ({ data: [{ views: 3 }], error: null }), log };
}

describe('owner identity', () => {
  it('mints a short-lived token whose subject is the key owner', async () => {
    const t = await mintOwnerToken({ userId: 'user_owner', secret: SECRET });
    const { payload } = await jwtVerify(t, new TextEncoder().encode(SECRET), { audience: 'authenticated' });
    expect(payload.sub).toBe('user_owner');
    expect(payload.role).toBe('authenticated');
    expect(payload.exp - payload.iat).toBeLessThanOrEqual(300);
  });
  it('refuses the local-development principal and a missing secret', async () => {
    await expect(mintOwnerToken({ userId: 'byok', secret: SECRET })).rejects.toThrow(/signed-in/);
    await expect(mintOwnerToken({ userId: 'u', secret: '' })).rejects.toThrow(/not configured/);
  });
  it('builds the client with that token as its Authorization header', async () => {
    const factory = vi.fn(() => ({}));
    await ownerSupabase(who, { SUPABASE_URL: 'https://x.supabase.co', SUPABASE_ANON_KEY: 'anon', SUPABASE_JWT_SECRET: SECRET }, factory);
    expect(factory.mock.calls[0][2].global.headers.Authorization).toMatch(/^Bearer ey/);
  });
});

describe('video pages studio', () => {
  const studio = (db = fakeDb()) => ({ db, run: createPagesStudio({ env: {}, origin: 'https://smartvid.test', clientFor: async () => db }) });
  const call = (s, body, w = who) => s.run(body, w).then((r) => ({ status: r.statusCode, body: JSON.parse(r.body) }));

  it('runs only for a signed-in key owner', async () => {
    const s = studio();
    expect((await call(s, { action: 'list' }, { userId: 'byok' })).status).toBe(401);
    expect((await call(s, { action: 'list' }, null)).status).toBe(401);
  });
  it('rejects unknown actions and bad ids before touching the database', async () => {
    const s = studio();
    expect((await call(s, { action: 'drop_tables' })).status).toBe(400);
    expect((await call(s, { action: 'delete', id: "x'; --" })).status).toBe(400);
    expect(s.db.log).toEqual([]);
  });
  it('creates a draft through the app\'s own sanitizing code (https only; never public)', async () => {
    const s = studio();
    expect((await call(s, { action: 'create', title: 'Hi', video_url: 'http://insecure/x.mp4' })).status).toBe(400);
    const ok = await call(s, { action: 'create', title: 'Hi', video_url: 'https://cdn.test/x.mp4' });
    expect(ok.status).toBe(200);
    const insert = s.db.log.find((l) => l.op === 'insert');
    expect(insert.table).toBe('landing_pages');
    expect(insert.args[0]).toMatchObject({ video_url: 'https://cdn.test/x.mp4', published: false });
    expect(insert.args[0].clerk_user_id).toBeUndefined(); // the owner column is set by the database from the token, not by the request
  });
  it('publish and delete go through the same table the app uses', async () => {
    const s = studio();
    await call(s, { action: 'publish', id: 'abcdefgh12' });
    expect(s.db.log.find((l) => l.op === 'update').args[0]).toMatchObject({ published: true });
    await call(s, { action: 'delete', id: 'abcdefgh12' });
    expect(s.db.log.some((l) => l.op === 'delete')).toBe(true);
  });
  it('caps recipients per call', async () => {
    const s = studio();
    await call(s, { action: 'add_contacts', id: 'abcdefgh12', contacts: Array.from({ length: 900 }, () => ({ firstname: 'A' })) });
    expect(s.db.log.filter((l) => l.op === 'insert').reduce((n, l) => n + l.args[0].length, 0)).toBe(500);
  });
});

describe('safeguards for pages', () => {
  it('the gateway classifies each action itself', () => {
    for (const [action, risk] of Object.entries(PAGE_ACTIONS)) expect(classifyRequest('/studio/pages', 'POST', { action }).risk).toBe(risk);
    expect(classifyRequest('/studio/pages', 'POST', { action: 'nope' }).risk).toBe('write');
  });
  it('the tools declare matching risk and no tool is human-only', () => {
    const t = Object.fromEntries(customTools.map((x) => [x.name, x]));
    expect(t.video_pages_publish.risk).toBe('publish');
    expect(t.video_pages_delete.risk).toBe('destructive');
    expect(t.video_pages_remove_contact.risk).toBe('destructive');
    expect(humanOnlyViolations(customTools.map((x) => x.name))).toEqual([]);
  });
});
