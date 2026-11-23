// @vitest-environment node
/** Every remix tab adapter, driven through the simulated tab: MCP server -> gateway -> bridge queue -> tab controller -> adapter. */
import { describe, it, expect, vi } from 'vitest';
import { world } from './helpers/bridgeWorld.js';
import { createIframeRpc } from '../../src/lib/mcpBridge/iframeRpc.js';
import { createWorkbenchTools } from '../../src/lib/mcpBridge/adapters/workbench.js';
import { createMotionDirectorTools } from '../../src/lib/mcpBridge/adapters/motionDirector.js';
import { createRenderQueueTools } from '../../src/lib/mcpBridge/adapters/renderQueue.js';
import { createBrandTools } from '../../src/lib/mcpBridge/adapters/brand.js';
import { createAppTools } from '../../src/lib/mcpBridge/adapters/app.js';
import { interpretAgentCommand } from '../../src/features/personalization/apps/motion-director/lib/agentCommands.ts';

vi.hoisted(() => { process.env.MCP_KEY_SECRET = 'm'.repeat(40); });

async function session(tools, { confirm = async () => 'once', studio = 'x' } = {}) {
  const w = await world();
  const mcp = await w.mcpFor(w.key);
  const { tab } = w.mkTab('owner_1', { confirm, tools });
  await tab.enable();
  const call = (tool, args = {}) => w.withPolling(tab, () => w.call(mcp, 'studio_call', { session: tab.sessionId(), tool, args, wait_seconds: 5 }));
  return { call, w, tab };
}

describe('iframe rpc', () => {
  it('only accepts answers from its own frame and origin, and times out otherwise', async () => {
    let handler; const posted = [];
    const frame = { contentWindow: { postMessage: (m, o) => posted.push([m, o]) } };
    const rpc = createIframeRpc({ getFrame: () => frame, origin: () => 'https://app.test', timeoutMs: 30, addListener: (f) => { handler = f; }, removeListener: () => {}, makeId: () => 'id1' });
    const p = rpc.call('get_project');
    expect(posted[0]).toEqual([{ type: 'sv:call', id: 'id1', op: 'get_project', args: {} }, 'https://app.test']);
    handler({ source: {}, origin: 'https://app.test', data: { type: 'sv:call-result', id: 'id1', ok: true, result: { evil: 1 } } }); // wrong window
    handler({ source: frame.contentWindow, origin: 'https://evil.test', data: { type: 'sv:call-result', id: 'id1', ok: true, result: { evil: 2 } } }); // wrong origin
    await expect(p).rejects.toThrow(/did not answer/);
    const q = rpc.call('undo');
    posted.length = 0;
    handler({ source: frame.contentWindow, origin: 'https://app.test', data: { type: 'sv:call-result', id: 'id1', ok: true, result: { ok: true } } });
    await expect(q).resolves.toEqual({ ok: true });
  });
});

describe('workbench adapter', () => {
  const calls = [];
  const rpc = { call: async (op, args) => { calls.push([op, args]); return op === 'get_project' ? { project: { tracks: [] } } : { applied: 1, errors: [] }; } };
  const imported = [];
  const tools = createWorkbenchTools({ rpc, importAssets: (...a) => imported.push(a) });
  it('reads silently, edits ask, https-only imports', async () => {
    const confirm = vi.fn(async () => 'once');
    const s = await session(tools, { confirm });
    expect((await s.call('workbench_get_project')).body.result.project).toEqual({ tracks: [] });
    expect(confirm).not.toHaveBeenCalled();
    expect((await s.call('workbench_run_ops', { ops: [{ op: 'remove_clip', clipId: 'c' }] })).body.status).toBe('done');
    expect(calls.at(-1)).toEqual(['run_ops', { ops: [{ op: 'remove_clip', clipId: 'c' }] }]);
    expect(confirm).toHaveBeenCalledTimes(1);
    expect((await s.call('workbench_import_assets', { assets: [{ url: 'http://x/y.png' }] })).body.status).toBe('error');
    await s.call('workbench_import_assets', { assets: [{ url: 'https://x/y.mp4', kind: 'video' }], mode: 'new' });
    expect(imported[0][1]).toBe('new');
  });
});

describe('motion director adapter', () => {
  const project = { name: 'P', fps: 30, width: 1920, height: 1080, background: '#fff', tracks: [{ id: 't1', name: 'Main', clips: [{ id: 'c1', cardId: 'inkpress-title-card', label: 'Title', start: 0, duration: 60, props: { title: 'Hello', nested: { a: 1 } } }] }] };
  const applied = [];
  const state = { project, selectedClipId: 'c1', undo: vi.fn(), redo: vi.fn() };
  const exports = vi.fn();
  const tools = createMotionDirectorTools({ getState: () => state, interpretAgentCommand, applyAgentOps: (ops) => applied.push(...ops), cards: { 'inkpress-title-card': {} }, requestExport: exports });
  it('summarizes the project, runs the studio\'s own interpreter, validates ids', async () => {
    const s = await session(tools);
    const got = (await s.call('motion_director_get_project')).body.result;
    expect(got.tracks[0].clips[0].props).toEqual({ title: 'Hello' }); // nested objects are left out
    const cmd = (await s.call('motion_director_command', { text: 'make the background black' })).body;
    expect(cmd.status).toBe('done');
    expect(applied.some((o) => o.kind === 'setBackground')).toBe(true);
    expect((await s.call('motion_director_remove_clip', { clip_id: 'nope' })).body.status).toBe('error');
    expect((await s.call('motion_director_add_clip', { card_id: 'unknown' })).body.status).toBe('error');
    expect((await s.call('motion_director_set_background', { color: 'red; drop' })).body.status).toBe('error');
    await s.call('motion_director_undo'); expect(state.undo).toHaveBeenCalled();
    await s.call('motion_director_render'); expect(exports).toHaveBeenCalled();
  });
  it('a declined edit changes nothing', async () => {
    applied.length = 0;
    const s = await session(tools, { confirm: async () => 'no' });
    expect((await s.call('motion_director_command', { text: 'make the background black' })).body.status).toBe('declined');
    expect(applied).toEqual([]);
  });
});

describe('render queue adapter', () => {
  it('lists, queues, processes and removes; removal is destructive', async () => {
    const jobs = [];
    const tools = createRenderQueueTools({ list: () => jobs, enqueue: (j) => { const e = { id: 'j1', status: 'queued', progress: 0, ...j }; jobs.push(e); return e; }, remove: (id) => { jobs.splice(jobs.findIndex((j) => j.id === id), 1); }, process: () => null });
    expect(tools.find((t) => t.name === 'render_queue_remove').risk).toBe('destructive');
    const s = await session(tools);
    expect((await s.call('render_queue_enqueue', { project: { a: 1 }, name: 'Clip' })).body.result).toMatchObject({ id: 'j1', status: 'queued' });
    expect((await s.call('render_queue_list')).body.result.jobs).toHaveLength(1);
    expect((await s.call('render_queue_process')).body.result).toEqual({ started: false });
  });
});

describe('brand adapter', () => {
  it('never returns key-like fields and saves with a generated id', async () => {
    const saved = [];
    const store = { listBrands: () => [{ id: 'b1', name: 'Acme' }], getBrand: (id) => (id === 'b1' ? { id, name: 'Acme', apiKey: 'sk-secret', colors: { token: 'x', primary: '#fff' } } : null), listCampaigns: () => [], listAssets: () => [], saveBrand: (b) => { saved.push(b); return b; }, generateId: () => 'new1' };
    const s = await session(createBrandTools(store));
    const got = (await s.call('brand_get', { id: 'b1' })).body.result;
    expect(JSON.stringify(got)).not.toMatch(/sk-secret|"token"/);
    expect(got.brand.colors.primary).toBe('#fff');
    await s.call('brand_save', { brand: { name: 'New', openaiKey: 'sk-zzz' } });
    expect(saved[0]).toEqual({ name: 'New', id: 'new1' });
    expect((await s.call('brand_get', { id: 'zz' })).body.status).toBe('error');
  });
});

describe('app adapter', () => {
  it('navigates only to known pages', async () => {
    let page = 'image';
    const nav = vi.fn(async (p) => { page = p; });
    const s = await session(createAppTools({ getCurrentPage: () => page, navigate: nav, isKnownPage: (p) => ['image', 'video'].includes(p), title: () => 'SmartVid' }));
    expect((await s.call('app_state')).body.result).toEqual({ page: 'image', title: 'SmartVid' });
    expect((await s.call('app_navigate', { page: '../../etc' })).body.status).toBe('error');
    expect((await s.call('app_navigate', { page: 'video' })).body.result).toEqual({ page: 'video' });
  });
});
