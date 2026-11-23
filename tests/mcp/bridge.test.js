// @vitest-environment node
/**
 * A simulated tab: the real tab controller (packages/studio-mcp-core/src/bridge-tab.js) talking to the real tab endpoint
 * (netlify/functions/mcp-bridge.js) and, from the MCP side, through the real MCP server, client and gateway, all over one in-memory store.
 */
import { describe, it, expect, vi } from 'vitest';
import { createBridge, createMemoryBridgeStore, createTabBridge, LIMITS, createGovernor, createMemoryGovernorStore } from '../../packages/studio-mcp-core/src/index.js';
import { createHandler as gatewayHandler } from '../../netlify/functions/mcp-gateway.js';
import { createHandler as tabHandler } from '../../netlify/functions/mcp-bridge.js';
import { MU, world } from './helpers/bridgeWorld.js';

vi.hoisted(() => { process.env.MCP_KEY_SECRET = 'm'.repeat(40); });

describe('bridge: enabling a tab', () => {
  it('nothing is listed until the tab is switched on; then its tools and risks are', async () => {
    const w = await world();
    const mcp = await w.mcpFor(w.key);
    const { tab } = w.mkTab('owner_1');
    expect((await w.call(mcp, 'studio_sessions')).body.sessions).toEqual([]);
    await tab.enable();
    const sessions = (await w.call(mcp, 'studio_sessions')).body.sessions;
    expect(sessions).toHaveLength(1);
    expect(sessions[0].tools.find((t) => t.name === 'timeline_delete_all').risk).toBe('destructive');
    expect(sessions[0].tools.find((t) => t.name === 'timeline_get_timeline').risk).toBe('read');
    await tab.disable();
    expect((await w.call(mcp, 'studio_sessions')).body.sessions).toEqual([]);
  });

  it('a tab that stops polling drops out of the list after 20 seconds', async () => {
    const w = await world();
    const mcp = await w.mcpFor(w.key);
    const { tab } = w.mkTab('owner_1');
    await tab.enable();
    w.clock.advance(21_000);
    expect((await w.call(mcp, 'studio_sessions')).body.sessions).toEqual([]);
    const sid = tab.sessionId();
    const gone = await w.call(mcp, 'studio_call', { session: sid, tool: 'timeline_get_timeline' });
    expect(gone.isError).toBe(true);
    expect(JSON.stringify(gone.body)).toMatch(/stopped responding/);
  });
});

describe('bridge: running tab tools', () => {
  it('a read tool runs silently and returns its result through the MCP', async () => {
    const w = await world();
    const mcp = await w.mcpFor(w.key);
    const confirm = vi.fn(async () => 'no');
    const { tab, ran } = w.mkTab('owner_1', { confirm });
    await tab.enable();
    const out = await w.withPolling(tab, () => w.call(mcp, 'studio_call', { session: tab.sessionId(), tool: 'timeline_get_timeline', wait_seconds: 5 }));
    expect(out.body).toMatchObject({ status: 'done', result: { clips: [{ id: 'c1' }] } });
    expect(ran).toEqual(['get']);
    expect(confirm).not.toHaveBeenCalled();
  });

  it('a write asks the user; "no" declines it and nothing runs; "once" runs it; "all" stops asking for the session', async () => {
    const w = await world();
    const mcp = await w.mcpFor(w.key);
    const answers = ['no', 'once', 'all'];
    const confirm = vi.fn(async () => answers.shift());
    const { tab, ran } = w.mkTab('owner_1', { confirm });
    await tab.enable();
    const add = (n) => w.withPolling(tab, () => w.call(mcp, 'studio_call', { session: tab.sessionId(), tool: 'timeline_add_clip', args: { n }, wait_seconds: 5 }));
    const declined = await add(1);
    expect(declined.body.status).toBe('declined');
    expect(ran).toEqual([]);
    expect((await add(2)).body.status).toBe('done');
    expect((await add(3)).body.status).toBe('done');
    expect((await add(4)).body.status).toBe('done'); // no further prompt
    expect(confirm).toHaveBeenCalledTimes(3);
    expect(ran.map((r) => r[1].n)).toEqual([2, 3, 4]);
    expect(confirm.mock.calls[0][0]).toMatchObject({ tool: 'timeline_add_clip', risk: 'write', args: { n: 1 } });
  });

  it('switching the tab off resets "allow all"', async () => {
    const w = await world();
    const { tab } = w.mkTab('owner_1', { confirm: async () => 'all' });
    await tab.enable();
    tab.setAllowAll(true);
    expect(tab.state().allowAll).toBe(true);
    await tab.disable();
    expect(tab.state().allowAll).toBe(false);
    expect(tab.state().enabled).toBe(false);
  });

  it('errors in the page come back as errors, not hangs; oversized results are refused with a clear reason', async () => {
    const w = await world();
    const mcp = await w.mcpFor(w.key);
    const { tab } = w.mkTab('owner_1');
    await tab.enable();
    const run = (tool) => w.withPolling(tab, () => w.call(mcp, 'studio_call', { session: tab.sessionId(), tool, wait_seconds: 5 }));
    const boom = await run('timeline_boom');
    expect(boom.body).toMatchObject({ status: 'error', error: 'page exploded' });
    const big = await run('timeline_big');
    expect(big.body.status).toBe('done');
    expect(JSON.stringify(big.body.result)).toMatch(/tooLarge/); // the tab itself refuses to send a megabyte
  });

  it('an unknown tool, a stale session and oversized arguments are refused before anything is queued', async () => {
    const w = await world();
    const mcp = await w.mcpFor(w.key);
    const { tab } = w.mkTab('owner_1');
    await tab.enable();
    const sid = tab.sessionId();
    expect(JSON.stringify((await w.call(mcp, 'studio_call', { session: sid, tool: 'timeline_nope' })).body)).toMatch(/no tool/);
    expect(JSON.stringify((await w.call(mcp, 'studio_call', { session: sid, tool: 'timeline_add_clip', args: { x: 'y'.repeat(70_000) } })).body)).toMatch(/too large/);
    expect(w.bstore.commands.size).toBe(0);
  });

  it('a slow tab returns a command id that studio_result can pick up later', async () => {
    const w = await world();
    const mcp = await w.mcpFor(w.key);
    const { tab } = w.mkTab('owner_1');
    await tab.enable();
    const first = await w.call(mcp, 'studio_call', { session: tab.sessionId(), tool: 'timeline_get_timeline', wait_seconds: 0 });
    expect(first.body.status).toBe('pending');
    const id = first.body.id;
    await tab.tick(); // the tab picks it up and answers
    const second = await w.call(mcp, 'studio_result', { command_id: id });
    expect(second.body).toMatchObject({ status: 'done', result: { clips: [{ id: 'c1' }] } });
  });

  it('commands expire after 60 seconds if the tab never answers', async () => {
    const w = await world();
    const mcp = await w.mcpFor(w.key);
    const { tab } = w.mkTab('owner_1');
    await tab.enable();
    const first = await w.call(mcp, 'studio_call', { session: tab.sessionId(), tool: 'timeline_get_timeline', wait_seconds: 0 });
    w.clock.advance(61_000);
    const r = await w.call(mcp, 'studio_result', { command_id: first.body.id });
    expect(r.body.status).toBe('expired');
    expect(r.body.error).toMatch(/did not answer/);
    const polled = await w.bridge.poll('owner_1', tab.sessionId());
    expect(polled.commands).toEqual([]); // an expired command is never handed out
  });
});

describe('bridge: safeguards and isolation', () => {
  it('risk comes from the tab\'s own registration: a destructive tab tool needs confirm, whatever the caller says', async () => {
    const w = await world();
    const mcp = await w.mcpFor(w.key);
    const { tab, ran } = w.mkTab('owner_1');
    await tab.enable();
    const sid = tab.sessionId();
    const refused = await w.call(mcp, 'studio_call', { session: sid, tool: 'timeline_delete_all', wait_seconds: 1 });
    expect(refused.body).toMatchObject({ status: 'confirmation_required' });
    expect(w.bstore.commands.size).toBe(0);
    expect(ran).toEqual([]);
    // a caller trying to lower the risk by sending its own `risk` in the body still gets the registered one
    const direct = await (await w.mcpFor(w.key)).callTool({ name: 'smartvid_studio_call', arguments: { session: sid, tool: 'timeline_delete_all', args: {}, risk: 'read' } }).catch(() => null);
    expect(w.bstore.commands.size).toBe(0);
    expect(direct).toBeTruthy();
    const ok = await w.withPolling(tab, () => w.call(mcp, 'studio_call', { session: sid, tool: 'timeline_delete_all', confirm: true, wait_seconds: 5 }));
    expect(ok.body.status).toBe('done');
    expect(ran).toEqual(['delete']);
  });

  it('audits tab calls with the tool name, risk and outcome, and counts destructive ones against the cap', async () => {
    const w = await world({ caps: { destructive: 1, publish: 1 } });
    const mcp = await w.mcpFor(w.key);
    const { tab } = w.mkTab('owner_1');
    await tab.enable();
    const del = () => w.withPolling(tab, () => w.call(mcp, 'studio_call', { session: tab.sessionId(), tool: 'timeline_delete_all', confirm: true, wait_seconds: 5 }));
    expect((await del()).body.status).toBe('done');
    const capped = await del();
    expect(capped.isError).toBe(true);
    expect(JSON.stringify(capped.body)).toMatch(/Daily limit/);
    expect(w.gstore.rows.some((r) => r.tool === 'bridge timeline_delete_all' && r.risk === 'destructive' && r.ok === true)).toBe(true);
    expect(JSON.stringify(w.gstore.rows)).not.toMatch(/removed/);
  });

  it('another user\'s key cannot see or drive my tab, and my commands never reach their tab', async () => {
    const w = await world();
    const bobKey = await w.mkKey('bob');
    const alice = w.mkTab('owner_1');
    const bob = w.mkTab('bob');
    await alice.tab.enable(); await bob.tab.enable();
    const bobMcp = await w.mcpFor(bobKey);
    const bobSees = (await w.call(bobMcp, 'studio_sessions')).body.sessions;
    expect(bobSees).toHaveLength(1);
    expect(bobSees[0].id).toBe(bob.tab.sessionId());
    const attempt = await w.call(bobMcp, 'studio_call', { session: alice.tab.sessionId(), tool: 'timeline_get_timeline', wait_seconds: 1 });
    expect(attempt.isError).toBe(true);
    expect(JSON.stringify(attempt.body)).toMatch(/not connected/);
    expect(w.bstore.commands.size).toBe(0);
    // a tab cannot poll or answer for someone else's session either
    expect((await w.bridge.poll('bob', alice.tab.sessionId())).gone).toBe(true);
    const mcp = await w.mcpFor(w.key);
    const pend = await w.call(mcp, 'studio_call', { session: alice.tab.sessionId(), tool: 'timeline_get_timeline', wait_seconds: 0 });
    expect(await w.bridge.respond('bob', alice.tab.sessionId(), pend.body.id, { status: 'done', result: { forged: true } })).toBeNull();
    expect(w.bstore.commands.get(pend.body.id).status).toBe('pending');
  });

  it('the tab endpoint needs a signed-in user and rejects malformed ids and bad tool lists', async () => {
    const w = await world();
    const h = tabHandler({ bridge: w.bridge });
    const post = (body, auth = { userId: 'owner_1' }) => h({ httpMethod: 'POST', auth, body: JSON.stringify(body) });
    expect((await post({ action: 'poll', sessionId: 'x' }, {})).statusCode).toBe(401);
    expect((await post({ action: 'poll', sessionId: 'not-a-uuid' })).statusCode).toBe(400);
    expect((await post({ action: 'register', tools: [{ name: 'Bad Name!' }] })).statusCode).toBe(400);
    expect((await post({ action: 'register', tools: [{ name: 'a_tool' }, { name: 'a_tool' }] })).statusCode).toBe(400);
    expect((await post({ action: 'register', tools: Array.from({ length: 201 }, (_, i) => ({ name: `tool_${i}` })) })).statusCode).toBe(400);
    expect((await post({ action: 'bogus', sessionId: crypto.randomUUID() })).statusCode).toBe(400);
    expect((await h({ httpMethod: 'GET', auth: { userId: 'u' }, body: '' })).statusCode).toBe(405);
  });

  it('unknown risk values register as "write", and a tab cannot hold more than 8 live sessions', async () => {
    const w = await world();
    const s = await w.bridge.register('owner_1', { label: 'x', studio: 's', tools: [{ name: 'odd_tool', risk: 'harmless' }] });
    expect(s.tools[0].risk).toBe('write');
    for (let i = 0; i < 7; i++) await w.bridge.register('owner_1', { label: `t${i}`, studio: 's', tools: [] });
    await expect(w.bridge.register('owner_1', { label: 'ninth', studio: 's', tools: [] })).rejects.toMatchObject({ code: 'too_many_sessions' });
  });

  it('a bring-your-own-key principal cannot use tab control', async () => {
    const w = await world();
    const gw = gatewayHandler({ studios: {}, env: { MCP_ALLOW_BYOK: '1' }, governor: null, bridge: w.bridge });
    const r = await gw({ httpMethod: 'GET', path: '/api/mcp-gateway/bridge/sessions', headers: { authorization: `Bearer ${MU}` } });
    expect(r.statusCode).toBe(401);
  });

  it('provider names in a tab\'s result are scrubbed', async () => {
    const w = await world();
    const mcp = await w.mcpFor(w.key);
    const { tab } = w.mkTab('owner_1', { tools: [{ name: 'say_hello', risk: 'read', description: 'x', run: async () => ({ note: 'Powered by MuAPI' }) }] });
    await tab.enable();
    const out = await w.withPolling(tab, () => w.call(mcp, 'studio_call', { session: tab.sessionId(), tool: 'say_hello', wait_seconds: 5 }));
    expect(JSON.stringify(out.body)).toContain('SmartVid');
    expect(JSON.stringify(out.body)).not.toMatch(/mu-?api/i);
  });
});
