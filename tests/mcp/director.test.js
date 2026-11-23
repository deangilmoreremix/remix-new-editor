// @vitest-environment node
import { describe, it, expect, vi } from 'vitest';
import { createDirectorStudio, DIRECTOR_ACTIONS, ownerTag, scrubDirector, directorBase } from '../../netlify/functions/_shared/mcpDirector.js';
import { classifyRequest, createHandler, STUDIOS } from '../../netlify/functions/mcp-gateway.js';
import { customTools } from '../../mcp/tools.js';
import { humanOnlyViolations } from '../../packages/studio-mcp-core/src/governor.js';
import { readDirectorAgents } from '../../scripts/build-director-agents.mjs';
import { readFileSync } from 'node:fs';

const ENV = { DIRECTOR_API_URL: 'https://director.test' };
const A = { userId: 'user_a' };
const B = { userId: 'user_b' };

/** A stand-in for the Director backend: shared collections and sessions, no accounts, the same response shapes as routes.py. */
function fakeBackend() {
  const collections = new Map(); const sessions = new Map(); const calls = [];
  let n = 0;
  const reply = (status, data) => ({ status, text: async () => JSON.stringify(data) });
  const fetchImpl = vi.fn(async (url, init = {}) => {
    const u = new URL(url); const method = init.method || 'GET'; const body = init.body ? JSON.parse(init.body) : null;
    calls.push({ method, path: u.pathname, body, headers: init.headers });
    const p = u.pathname;
    if (p === '/health') return reply(200, { status: 'ok', config: { videodb: true } });
    if (p === '/config/check') return reply(200, { videodb_key: 'sk-secret-should-not-appear', note: 'VideoDB ready' });
    if (p === '/videodb/collection' && method === 'GET') return reply(200, [...collections.values()]);
    if (p === '/videodb/collection' && method === 'POST') { const c = { id: `c${++n}`, name: body.name, description: body.description }; collections.set(c.id, c); return reply(201, { data: { success: true, collection: c } }); }
    let m = /^\/videodb\/collection\/([^/]+)$/.exec(p);
    if (m) { const c = collections.get(m[1]); if (!c) return reply(500, { message: 'no such collection' }); if (method === 'DELETE') { collections.delete(m[1]); return reply(200, { success: true }); } return reply(200, c); }
    m = /^\/videodb\/collection\/([^/]+)\/(video|audio|image)(?:\/([^/]+))?(\/generate_url)?$/.exec(p);
    if (m) return reply(200, { ok: true, kind: m[2], id: m[3] || null, method });
    if (/\/upload$/.test(p)) return reply(200, { uploaded: true, source: body.source });
    m = /^\/api\/render\/agent\/(\w+)$/.exec(p);
    if (m) return reply(200, { status: 'ok', agent: m[1], collection_id: body.collection_id, session_id: body.session_id });
    if (p === '/agent' && method === 'POST') { sessions.set(body.message.session_id, { session_id: body.message.session_id }); return reply(200, { status: 'ok', session: { session_id: body.message.session_id } }); }
    if (p === '/session' && method === 'GET') return reply(200, [{ session_id: 'someone-elses-1' }, ...sessions.values()]);
    m = /^\/session\/([^/]+)$/.exec(p);
    if (m) return method === 'DELETE' ? (sessions.delete(m[1]), reply(200, { message: 'Session deleted successfully.' })) : reply(200, { session_id: m[1], conversations: [] });
    if (p === '/videoagent/workflow') return reply(200, { status: 'ok', workflow: body.steps });
    return reply(404, { message: 'nope' });
  });
  return { fetchImpl, collections, sessions, calls };
}
const setup = (env = ENV) => { const be = fakeBackend(); return { be, run: (input, who = A) => createDirectorStudio({ env, fetchImpl: be.fetchImpl })(input, who).then((r) => ({ status: r.statusCode, body: JSON.parse(r.body) })) }; };

describe('not configured', () => {
  it('says so plainly instead of failing obscurely', async () => {
    const s = setup({});
    expect((await s.run({ action: 'health' })).body).toMatchObject({ configured: false, status: 'not_configured' });
    const r = await s.run({ action: 'collections_list' });
    expect(r.status).toBe(503);
    expect(r.body.error.code).toBe('not_configured');
    expect(s.be.fetchImpl).not.toHaveBeenCalled();
  });
  it('only accepts an https backend address (http only on localhost)', () => {
    expect(directorBase({ DIRECTOR_API_URL: 'http://evil.example' })).toBeNull();
    expect(directorBase({ DIRECTOR_API_URL: 'http://localhost:8000/' })).toBe('http://localhost:8000');
    expect(directorBase({ DIRECTOR_API_URL: 'https://d.example/' })).toBe('https://d.example');
  });
});

describe('allow-list', () => {
  it('needs a signed-in key owner', async () => {
    const s = setup();
    expect((await s.run({ action: 'health' }, { userId: 'byok' })).status).toBe(401);
    expect((await s.run({ action: 'health' }, null)).status).toBe(401);
  });
  it('rejects unknown actions, other render agents and bad ids without calling the backend', async () => {
    const s = setup();
    expect((await s.run({ action: 'proxy', path: '/videodb/collection' })).status).toBe(400);
    expect((await s.run({ action: 'render_agent', agent: 'shell', collection_id: 'c1', video_id: 'v' })).status).toBe(400);
    expect((await s.run({ action: 'collection_get', collection_id: '../session' })).status).toBe(400);
    expect(s.be.calls).toEqual([]);
  });
  it('refuses oversized requests', async () => {
    const s = setup();
    expect((await s.run({ action: 'workflow', steps: [{ agent: 'a', params: { x: 'y'.repeat(70_000) } }] })).status).toBe(413);
  });
  it('upload only takes public https links', async () => {
    const s = setup();
    const c = (await s.run({ action: 'collection_create', name: 'mine', description: 'd' })).body.collection.id;
    for (const bad of ['http://x.com/a.mp4', 'https://127.0.0.1/a.mp4', 'https://169.254.169.254/x', 'file:///etc/passwd', 'https://u:p@x.com/a.mp4']) expect((await s.run({ action: 'upload', collection_id: c, source_url: bad })).status, bad).toBe(400);
    expect((await s.run({ action: 'upload', collection_id: c, source_url: 'https://cdn.example.com/a.mp4' })).status).toBe(200);
  });
});

describe('two users sharing one backend', () => {
  it('each only sees, reads and changes their own collections', async () => {
    const s = setup();
    const a = (await s.run({ action: 'collection_create', name: 'Ads', description: 'a' }, A)).body.collection;
    const b = (await s.run({ action: 'collection_create', name: 'Mine', description: 'b' }, B)).body.collection;
    expect(a.name).toBe('Ads'); // the owner tag is not shown
    expect([...s.be.collections.values()].map((c) => c.name)).toEqual([`${ownerTag('user_a')}-Ads`, `${ownerTag('user_b')}-Mine`]);
    expect((await s.run({ action: 'collections_list' }, A)).body.collections.map((c) => c.id)).toEqual([a.id]);
    expect((await s.run({ action: 'collections_list' }, B)).body.collections.map((c) => c.id)).toEqual([b.id]);
    for (const input of [
      { action: 'collection_get', collection_id: a.id }, { action: 'collection_delete', collection_id: a.id },
      { action: 'media_list', collection_id: a.id, kind: 'video' }, { action: 'media_delete', collection_id: a.id, kind: 'video', media_id: 'v1' },
      { action: 'upload', collection_id: a.id, source_url: 'https://cdn.example.com/a.mp4' },
      { action: 'render_agent', agent: 'subtitle', collection_id: a.id, video_id: 'v1' },
      { action: 'agent_chat', text: 'hi', collection_id: a.id },
    ]) expect((await s.run(input, B)).status, input.action).toBe(404);
    expect(s.be.collections.has(a.id)).toBe(true);
    // a collection nobody tagged (someone using the backend directly) is also off limits
    s.be.collections.set('raw1', { id: 'raw1', name: 'untagged', description: '' });
    expect((await s.run({ action: 'collection_get', collection_id: 'raw1' }, A)).status).toBe(404);
    expect((await s.run({ action: 'media_list', collection_id: 'raw1', kind: 'video' }, A)).status).toBe(404);
  });
  it('a render agent run uses the owner\'s ids, whatever params say', async () => {
    const s = setup();
    const a = (await s.run({ action: 'collection_create', name: 'c', description: 'd' }, A)).body.collection.id;
    await s.run({ action: 'render_agent', agent: 'subtitle', collection_id: a, video_id: 'v1', params: { collection_id: 'other', session_id: 'victim-session', language: 'fr' } }, A);
    const sent = s.be.calls.find((c) => c.path === '/api/render/agent/subtitle').body;
    expect(sent).toMatchObject({ collection_id: a, params: { language: 'fr' } });
    expect(sent.session_id.startsWith(`${ownerTag('user_a')}-`)).toBe(true);
    expect(sent.params.session_id).toBeUndefined();
  });
  it('sessions: ids are tagged, others cannot be read or deleted, the list is filtered', async () => {
    const s = setup();
    const ca = (await s.run({ action: 'collection_create', name: 'c', description: 'd' }, A)).body.collection.id;
    const chat = (await s.run({ action: 'agent_chat', text: 'hello', collection_id: ca }, A)).body;
    expect(chat.session_id.startsWith(`${ownerTag('user_a')}-`)).toBe(true);
    expect((await s.run({ action: 'sessions_list' }, A)).body.sessions.map((x) => x.session_id)).toEqual([chat.session_id]);
    expect((await s.run({ action: 'sessions_list' }, B)).body.sessions).toEqual([]);
    expect((await s.run({ action: 'session_get', session_id: chat.session_id }, B)).status).toBe(404);
    expect((await s.run({ action: 'session_delete', session_id: chat.session_id }, B)).status).toBe(404);
    expect((await s.run({ action: 'session_get', session_id: 'someone-elses-1' }, A)).status).toBe(404);
    expect((await s.run({ action: 'agent_chat', text: 'x', collection_id: ca, session_id: 'someone-elses-1' }, A)).status).toBe(404);
    expect((await s.run({ action: 'session_delete', session_id: chat.session_id }, A)).body).toEqual({ deleted: true });
    const sent = s.be.calls.find((c) => c.path === '/agent').body.message;
    expect(sent.collection_id).toBe(ca);
    expect(sent.conv_id.startsWith(`${ownerTag('user_a')}-`)).toBe(true);
  });
});

describe('responses', () => {
  it('drop key-like fields and provider names', async () => {
    const s = setup();
    const r = await s.run({ action: 'config_check' });
    expect(JSON.stringify(r.body)).not.toMatch(/sk-secret|videodb/i);
    expect(JSON.stringify(r.body)).toMatch(/media library/);
    expect(scrubDirector({ api_key: 'x', nested: { token: 'y', ok: 'MuApi' } })).toEqual({ nested: { ok: 'SmartVid' } });
  });
  it('sends the optional backend token as a header and never in a body', async () => {
    const s = setup({ ...ENV, DIRECTOR_API_TOKEN: 'backend-token-123' });
    await s.run({ action: 'health' });
    expect(s.be.calls[0].headers.Authorization).toBe('Bearer backend-token-123');
  });
});

describe('safeguards', () => {
  it('the gateway classifies each action itself; deletes are destructive', () => {
    for (const [action, risk] of Object.entries(DIRECTOR_ACTIONS)) expect(classifyRequest('/studio/director', 'POST', { action }).risk, action).toBe(risk);
    for (const a of ['collection_delete', 'media_delete', 'session_delete']) expect(DIRECTOR_ACTIONS[a]).toBe('destructive');
    expect(classifyRequest('/studio/director', 'POST', { action: 'nope' }).risk).toBe('write');
  });
  it('tools declare the same risk and none is human-only', () => {
    const t = Object.fromEntries(customTools.filter((x) => x.name.startsWith('director_')).map((x) => [x.name, x]));
    expect(Object.keys(t).length).toBe(18);
    for (const n of ['director_collection_delete', 'director_media_delete', 'director_session_delete']) expect(t[n].risk).toBe('destructive');
    expect(humanOnlyViolations(Object.keys(t))).toEqual([]);
  });
  it('is registered in the gateway and a delete there needs confirm', async () => {
    expect(typeof STUDIOS.director).toBe('function');
    const be = fakeBackend();
    const store = { byHash: async () => null };
    const gw = createHandler({ store: () => store, studios: { director: createDirectorStudio({ env: ENV, fetchImpl: be.fetchImpl }) }, env: { MCP_ALLOW_BYOK: '1' }, governor: { check: async ({ risk, confirm }) => (risk === 'destructive' && confirm !== true ? { ok: false, status: 409, message: 'confirm' } : { ok: true }), record: async () => {} }, bridge: null });
    const call = (body) => gw({ httpMethod: 'POST', path: '/api/mcp-gateway/studio/director', headers: { authorization: 'Bearer abcdefghijklmnop1234' }, body: JSON.stringify(body) });
    // BYOK is the local-development principal; the studio itself refuses it, but the governor decides first
    expect((await call({ action: 'collection_delete', collection_id: 'c1' })).statusCode).toBe(409);
  });
});

describe('agents list', () => {
  it('matches the Director page\'s own list', () => {
    const file = JSON.parse(readFileSync(new URL('../../mcp/director-agents.json', import.meta.url), 'utf8'));
    expect(file).toEqual(readDirectorAgents());
    expect(file.length).toBeGreaterThan(40);
    expect(new Set(file.map((a) => a.id)).size).toBe(file.length);
  });
  it('the tool returns it and the backend\'s render agents', async () => {
    const t = customTools.find((x) => x.name === 'director_agents_list');
    const out = await t.run({}, {});
    expect(out.render_agents).toEqual(['subtitle', 'scenes', 'highlight_reel', 'voiceover', 'dubbing', 'social']);
    expect(out.agents.length).toBeGreaterThan(40);
  });
});
