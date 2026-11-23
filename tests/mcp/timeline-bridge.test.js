// @vitest-environment node
/**
 * The timeline editor's own agent tools, driven through the whole MCP path: MCP server -> gateway -> bridge queue -> tab controller -> toBridgeTools -> createAgentTools.
 */
import { describe, it, expect, vi } from 'vitest';
import { createAgentTools } from '../../src/lib/editor/agent/tools.js';
import { toBridgeTools } from '../../src/lib/editor/agent/bridgeTools.js';
import '../../src/lib/editor/addons/index.js';
import { world } from './helpers/bridgeWorld.js';

vi.hoisted(() => { process.env.MCP_KEY_SECRET = 'm'.repeat(40); });

function fakeEditor() {
  const T = { v: 30 };
  const tracks = [
    { id: 'v', name: 'Main Video', type: 'video', items: [] },
    { id: 'a', name: 'Voiceover', type: 'audio', items: [] },
    { id: 't', name: 'Titles', type: 'text', items: [] },
  ];
  const times = new Map();
  const all = () => tracks.flatMap((t) => t.items);
  return {
    tracks,
    ed: {
      snapshot: () => ({ timelineSeconds: T.v, playheadSec: 0, tracks: tracks.map((t) => ({ ...t, clips: t.items })) }),
      setTimelineSeconds: (s) => { T.v = s; },
      insertClip: (clip, kind) => { times.set(String(clip.id), { start: clip.start, end: clip.end }); tracks.find((t) => t.type === kind).items.push(clip); return clip; },
      createAddon: (type, start, dur) => ({ id: `${type}-${Math.random()}`, type, start, end: start + dur, addon: {} }),
      getClip: (id) => all().find((c) => String(c.id) === String(id)) || null,
      clipTimes: (c) => times.get(String(c.id)) || { start: 0, end: 0 },
      setClipTimes: (c, s, e) => times.set(String(c.id), { start: s, end: e }),
      removeClip: () => false,
      commit: vi.fn(),
      exportVideo: vi.fn(async () => ({ filename: 'v.mp4' })),
      confirm: vi.fn(async () => true),
    },
  };
}

describe('timeline tab adapter through the MCP', () => {
  it('registers exactly the editor\'s tools, prefixed, with read-only ones marked read', () => {
    const { ed } = fakeEditor();
    const agent = createAgentTools(ed);
    const list = toBridgeTools(agent);
    expect(list.map((t) => t.name)).toEqual(agent.definitions.map((d) => `timeline_${d.name}`));
    for (const t of list) expect(t.risk).toBe(agent.readOnly.has(t.name.slice(9)) ? 'read' : 'write');
    expect(list.find((t) => t.name === 'timeline_get_timeline').risk).toBe('read');
    expect(list.find((t) => t.name === 'timeline_export_video').risk).toBe('write');
  });

  it('read runs silently; a write asks and is declined or run; the editor state really changes', async () => {
    const w = await world();
    const mcp = await w.mcpFor(w.key);
    const { ed, tracks } = fakeEditor();
    const answers = ['no', 'once'];
    const confirm = vi.fn(async () => answers.shift());
    const { tab } = w.mkTab('owner_1', { confirm });
    tab.setTools('timeline', toBridgeTools(createAgentTools(ed)));
    await tab.enable();
    const call = (tool, args) => w.withPolling(tab, () => w.call(mcp, 'studio_call', { session: tab.sessionId(), tool, args, wait_seconds: 5 }));

    const read = await call('timeline_get_timeline', {});
    expect(read.body.status).toBe('done');
    expect(read.body.result.tracks).toHaveLength(3);
    expect(confirm).not.toHaveBeenCalled();

    const overlay = { type: 'overlay-text', start: 1, duration: 3, options: { text: 'Hello' } };
    const declined = await call('timeline_add_overlay', overlay);
    expect(declined.body.status).toBe('declined');
    expect(tracks[2].items).toHaveLength(0);

    const done = await call('timeline_add_overlay', overlay);
    expect(done.body.status).toBe('done');
    expect(tracks[2].items[0].addon).toMatchObject({ text: 'Hello' });
    expect(confirm).toHaveBeenCalledTimes(2);
  });

  it('an editor error comes back as an error, not a crash', async () => {
    const w = await world();
    const mcp = await w.mcpFor(w.key);
    const { ed } = fakeEditor();
    const { tab } = w.mkTab('owner_1', { confirm: async () => 'once' });
    tab.setTools('timeline', toBridgeTools(createAgentTools(ed)));
    await tab.enable();
    const out = await w.withPolling(tab, () => w.call(mcp, 'studio_call', { session: tab.sessionId(), tool: 'timeline_add_overlay', args: { type: 'overlay-text', start: 99 }, wait_seconds: 5 }));
    expect(out.body.status).toBe('error');
    expect(JSON.stringify(out.body)).toMatch(/past the end/);
  });
});
