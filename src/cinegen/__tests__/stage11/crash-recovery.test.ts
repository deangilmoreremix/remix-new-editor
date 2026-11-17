// Stage 11 (port J): crash recovery data layer. Timelines are built with the real timeline operations.
import { describe, it, expect } from 'vitest';
import { createDefaultTimeline, addClipToTrack, trimClip } from '@cinegen/lib/editor/timeline-operations';
import { PROJECT_SCHEMA_VERSION } from '@cinegen/lib/editor/project-migrations';
import {
  RecoveryStore, memoryRecoveryBackend, buildSnapshot, parseSnapshot, planRecovery, sliceFingerprint, stableStringify, summarize,
  RECOVERY_MAX_AGE_MS, RECOVERY_VERSION, RECOVERY_MAX_BYTES, coreFingerprint as coreFp, recoveryActions, fingerprintFor, resolveSpaces, elideHeavy, restoreElided,
} from '@cinegen/lib/recovery/crash-recovery';
import type { Asset } from '@cinegen/types/project';
import { workspaceReducer, createInitialWorkspaceState } from '@cinegen/lib/mcp/workspace-state';
import { WORKSPACE_PERSIST_ACTIONS } from '@cinegen/components/workspace/workspace-persistence';
import { recoverySliceFromState } from '@cinegen/components/workspace/use-crash-recovery';

const A: Asset = { id: 'A', name: 'A', type: 'video', url: 'blob:http://x/aaa', duration: 10, createdAt: '2026-01-01' };
function project() {
  let tl = createDefaultTimeline('t');
  tl = addClipToTrack(tl, tl.tracks.find((t) => t.name === 'V1')!.id, A, 0);
  return { timelines: [tl], activeTimelineId: tl.id, assets: [A] as never };
}
const NOW = 1_800_000_000_000;

describe('snapshot', () => {
  it('round-trips through the store, validates, and a successful save (clear) removes it', async () => {
    const store = new RecoveryStore(memoryRecoveryBackend(), () => NOW);
    const p = project();
    expect(await store.write('p1', p)).toBe(true);
    const got = await store.read('p1');
    expect(got?.v).toBe(RECOVERY_VERSION);
    expect(got?.timelines[0].clips).toHaveLength(2); // video + linked audio
    expect(summarize(got!)).toMatchObject({ clips: 2, timelines: 1, savedAt: NOW, overlays: 0, nodes: 0 });
    await store.clear('p1');
    expect(await store.read('p1')).toBeNull();
  });

  it('is plain data: functions / undefined fields do not survive, order does not matter for the fingerprint', () => {
    const p = project();
    const snap = buildSnapshot('p1', { ...p, assets: [{ ...A, extra: undefined, fn: () => 1 } as never] }, NOW);
    expect(JSON.stringify(snap)).not.toContain('extra');
    expect(stableStringify({ b: 1, a: [2, { d: 1, c: 2 }] })).toBe(stableStringify({ a: [2, { c: 2, d: 1 }], b: 1 }));
    // a blob: URL differing between sessions is not a change
    expect(sliceFingerprint({ ...p, assets: [{ ...A, url: 'blob:http://x/zzz' }] as never })).toBe(sliceFingerprint(p));
  });

  it('rejects wrong project, wrong version, newer schema, stale, malformed, and deletes unusable entries', async () => {
    const p = project();
    const good = buildSnapshot('p1', p, NOW);
    expect(parseSnapshot(good, 'p1', NOW)).not.toBeNull();
    expect(parseSnapshot(good, 'other', NOW)).toBeNull();
    expect(parseSnapshot({ ...good, v: 99 }, 'p1', NOW)).toBeNull();
    expect(parseSnapshot({ ...good, schema: PROJECT_SCHEMA_VERSION + 1 }, 'p1', NOW)).toBeNull();
    expect(parseSnapshot(good, 'p1', NOW + RECOVERY_MAX_AGE_MS + 1)).toBeNull();
    expect(parseSnapshot({ ...good, timelines: [{ id: 1 }] }, 'p1', NOW)).toBeNull();
    expect(parseSnapshot({ ...good, timelines: [] }, 'p1', NOW)).toBeNull();
    expect(parseSnapshot('garbage', 'p1', NOW)).toBeNull();
    const be = memoryRecoveryBackend();
    await be.set('p1', { ...good, v: 99 });
    const store = new RecoveryStore(be, () => NOW);
    expect(await store.read('p1')).toBeNull();
    expect(await be.get('p1')).toBeUndefined();
  });

  it('never throws when storage fails', async () => {
    const broken = { get: async () => { throw new Error('x'); }, set: async () => { throw new Error('quota'); }, del: async () => { throw new Error('x'); } };
    const store = new RecoveryStore(broken, () => NOW);
    expect(await store.write('p1', project())).toBe(false);
    expect(await store.read('p1')).toBeNull();
    await expect(store.clear('p1')).resolves.toBeUndefined();
  });
});

describe('recovery plan', () => {
  it('an edit made after the last save is recovered; unchanged timelines are left alone; nothing is deleted', () => {
    const saved = project();
    const tl = saved.timelines[0];
    const v = tl.clips.find((c) => c.trackId === tl.tracks.find((t) => t.name === 'V1')!.id)!;
    const edited = trimClip(tl, v.id, 0, 4);
    const live = { timelines: [edited], activeTimelineId: tl.id, assets: saved.assets };
    const snap = buildSnapshot('p1', live, NOW);
    // fresh load shows the saved project
    const plan = planRecovery(snap, saved);
    expect(plan.setTimelines).toHaveLength(1);
    expect(plan.setTimelines[0].clips.find((c) => c.id === v.id)!.trimEnd).toBe(edited.clips.find((c) => c.id === v.id)!.trimEnd);
    expect(plan.addTimelines).toEqual([]); expect(plan.addAssets).toEqual([]);
    // identical state: nothing to do
    const same = planRecovery(buildSnapshot('p1', saved, NOW), saved);
    expect(same.setTimelines).toEqual([]); expect(same.updateAssets).toEqual([]);
    expect(sliceFingerprint(buildSnapshot('p1', saved, NOW))).toBe(sliceFingerprint(saved));
  });

  it('a timeline / asset created after the last save is added; a restored blob URL is kept for an existing asset', () => {
    const saved = project();
    const extra = createDefaultTimeline('Second');
    const B: Asset = { ...A, id: 'B', url: 'https://x.test/B.mp4' };
    const live = { timelines: [saved.timelines[0], extra], activeTimelineId: extra.id, assets: [{ ...A, name: 'renamed', url: 'blob:http://x/old' }, B] as never };
    const plan = planRecovery(buildSnapshot('p1', live, NOW), { ...saved, assets: [{ ...A, url: 'blob:http://x/restored' }] as never });
    expect(plan.addTimelines.map((t) => t.id)).toEqual([extra.id]);
    expect(plan.activeTimelineId).toBe(extra.id);
    expect(plan.addAssets.map((a) => a.id)).toEqual(['B']);
    expect(plan.updateAssets).toHaveLength(1);
    expect(plan.updateAssets[0]).toMatchObject({ id: 'A', name: 'renamed', url: 'blob:http://x/restored' });
  });
});

// Fix N: the snapshot covers everything the save path persists (overlays, Spaces graph, folders, sets, director), v1 still loads, heavy payloads stay out.
describe('v2 slices', () => {
  const node = (id: string, extra: Record<string, unknown> = {}) => ({ id, type: 'prompt', position: { x: 1, y: 2 }, data: { type: 'prompt', config: { text: id }, ...extra } });
  const ov = (id: string, extra: Record<string, unknown> = {}) => ({ id, kind: 'text', text: id, start: 0, duration: 2, ...extra });
  const BASE = project();
  function full(over: Record<string, unknown> = {}) {
    const p = BASE;
    return {
      ...p, overlays: [ov('o1')] as never,
      spaces: [{ id: 's1', name: 'Space 1', nodes: [node('n1')], edges: [] }, { id: 's2', name: 'Space 2', nodes: [], edges: [] }] as never,
      activeSpaceId: 's1', openSpaceIds: ['s1'], mediaFolders: [{ id: 'f1', name: 'F' }] as never, director: { title: 'Show', scenes: [] }, sets: [{ id: 'x1', name: 'Set' }] as never, ...over,
    };
  }
  const plan = (snapSlice: ReturnType<typeof full>, cur: ReturnType<typeof full>) => planRecovery(buildSnapshot('p', snapSlice, NOW), cur);

  it('round trips every slice and an unchanged project makes no plan and an equal (key-order independent) fingerprint', async () => {
    const store = new RecoveryStore(memoryRecoveryBackend(), () => NOW);
    const a = full();
    expect(await store.write('p', a)).toBe(true);
    const got = (await store.read('p'))!;
    expect(got.v).toBe(2); expect(got.overlays).toHaveLength(1); expect(got.spaces).toHaveLength(2); expect(got.director).toEqual({ title: 'Show', scenes: [] });
    // same data, different key / list order, selection flags: no change
    const b = full({ overlays: [{ start: 0, text: 'o1', id: 'o1', duration: 2, kind: 'text' }], spaces: [...(a.spaces as never[])].reverse(), director: { scenes: [], title: 'Show' } });
    expect(fingerprintFor(got, b)).toBe(fingerprintFor(got, a));
    const pl = planRecovery(got, b);
    expect(pl.addOverlays.length + pl.updateOverlays.length + pl.spaceOps.length + pl.addSets.length + pl.updateSets.length + pl.addFolders.length).toBe(0);
    expect(pl.director).toBeNull(); expect(pl.activeSpaceId).toBeNull(); expect(pl.openSpaceIds).toEqual([]);
  });

  it('plans overlay, node/edge, director, set, folder and space changes', () => {
    const saved = full();
    const edited = full({
      overlays: [ov('o1', { text: 'changed' }), ov('o2')] as never,
      spaces: [{ id: 's1', name: 'Renamed', nodes: [node('n1'), node('n2')], edges: [{ id: 'e1', source: 'n1', target: 'n2' }] }, { id: 's2', name: 'Space 2', nodes: [], edges: [] }, { id: 's3', name: 'New', nodes: [node('n9')], edges: [] }] as never,
      activeSpaceId: 's3', openSpaceIds: ['s1', 's3'], director: { title: 'Edited', scenes: [] }, sets: [{ id: 'x1', name: 'Set2' }, { id: 'x2', name: 'S' }] as never, mediaFolders: [{ id: 'f1', name: 'F' }, { id: 'f2', name: 'G' }] as never,
    });
    const pl = plan(edited, saved);
    expect(pl.updateOverlays.map((o) => o.id)).toEqual(['o1']); expect(pl.addOverlays.map((o) => o.id)).toEqual(['o2']);
    expect(pl.director).toEqual({ title: 'Edited', scenes: [] });
    expect(pl.updateSets.map((o) => o.id)).toEqual(['x1']); expect(pl.addSets.map((o) => o.id)).toEqual(['x2']);
    expect(pl.addFolders.map((o) => o.id)).toEqual(['f2']);
    expect(pl.spaceOps.map((o) => (o.kind === 'add' ? 'add:' + o.space.id : 'edit:' + o.spaceId))).toEqual(['edit:s1', 'add:s3']);
    const edit = pl.spaceOps[0] as { name?: string; nodes?: unknown[]; edges?: unknown[] };
    expect(edit.name).toBe('Renamed'); expect(edit.nodes).toHaveLength(2); expect(edit.edges).toHaveLength(1);
    expect(pl.activeSpaceId).toBe('s3'); expect(pl.openSpaceIds).toEqual(['s3']);
  });

  it('resolveSpaces merges the live canvas into the active space and strips selection flags', () => {
    const r = resolveSpaces({ spaces: [{ id: 's1', nodes: [], edges: [] }, { id: 's2', nodes: [{ id: 'k' }], edges: [] }], activeSpaceId: 's1', nodes: [{ id: 'live', selected: true, dragging: true }], edges: [{ id: 'e' }] });
    expect(r[0].nodes).toEqual([{ id: 'live', selected: undefined, dragging: undefined }]); expect(r[0].edges).toHaveLength(1); expect(r[1].nodes).toHaveLength(1);
    expect(stableStringify(r[0].nodes)).toBe(stableStringify([{ id: 'live' }]));
  });

  it('keeps heavy data URLs and blob URLs out of the snapshot and restores the live value on recovery', () => {
    const big = 'data:image/png;base64,' + 'A'.repeat(50_000);
    const live = full({ spaces: [{ id: 's1', name: 'S', nodes: [node('n1', { result: { url: big, blob: 'blob:http://x/1' } })], edges: [] }] as never, overlays: [ov('o1', { src: big })] as never });
    const snap = buildSnapshot('p', live, NOW);
    expect(JSON.stringify(snap).length).toBeLessThan(20_000);
    // unchanged project (heavy payload present live, elided in the snapshot) is not a difference
    expect(fingerprintFor(snap, live)).toBe(snap.fingerprint);
    // an edit next to a heavy payload keeps the live payload
    const edited = full({ spaces: [{ id: 's1', name: 'S', nodes: [node('n1', { result: { url: big, blob: 'blob:http://x/1' }, extra: 1 })], edges: [] }] as never, overlays: live.overlays });
    const pl = planRecovery(buildSnapshot('p', edited, NOW), live);
    const op = pl.spaceOps[0] as { nodes: Array<{ data: { result: { url: string; blob: string } } }> };
    expect(op.nodes[0].data.result.url).toBe(big); expect(op.nodes[0].data.result.blob).toBe('blob:http://x/1');
    // a new node whose payload only existed as a heavy string: the payload key is dropped, not set to a marker
    expect(restoreElided(elideHeavy({ a: big, b: 1 }), undefined)).toEqual({ b: 1 });
    expect(elideHeavy('data:small')).toBe('data:small');
  });

  it('v1 snapshots still load: timelines and assets recover and the new slices never cause a prompt or a plan', () => {
    const p = BASE;
    const v1 = buildSnapshot('p', p, NOW, 1);
    expect(v1.v).toBe(1); expect(parseSnapshot(JSON.parse(JSON.stringify(v1)), 'p', NOW)).not.toBeNull();
    const cur = full({ timelines: [{ ...p.timelines[0], name: 'x' }] as never, overlays: [ov('o9')] as never });
    expect(fingerprintFor(v1, cur)).not.toBe(v1.fingerprint); // timeline differs: prompt
    const same = full({ overlays: [ov('o9')] as never, director: { a: 1 } });
    expect(fingerprintFor(v1, same)).toBe(coreFp(v1)); // only new slices differ: no prompt
    const pl = planRecovery(v1, cur);
    expect(pl.setTimelines).toHaveLength(1); expect(pl.addOverlays).toEqual([]); expect(pl.director).toBeNull(); expect(pl.spaceOps).toEqual([]);
  });

  it('degrades gracefully: an over-size full snapshot falls back to core; a failing store never throws', async () => {
    const huge = full({ overlays: [ov('o1', { blob: 'x'.repeat(RECOVERY_MAX_BYTES + 10) })] as never });
    const store = new RecoveryStore(memoryRecoveryBackend(), () => NOW);
    expect(await store.write('p', huge)).toBe(true);
    const got = (await store.read('p'))!;
    expect(got.v).toBe(1); expect(got.timelines).toHaveLength(1);
    // quota error on the big one, ok on the small one
    let calls = 0;
    const flaky = new RecoveryStore({ get: async () => undefined, del: async () => {}, set: async () => { if (calls++ === 0) throw new DOMException('q', 'QuotaExceededError'); } }, () => NOW);
    expect(await flaky.write('p', full())).toBe(true); expect(calls).toBe(2);
    const dead = new RecoveryStore({ get: async () => { throw new Error('x'); }, del: async () => { throw new Error('x'); }, set: async () => { throw new Error('x'); } }, () => NOW);
    expect(await dead.write('p', full())).toBe(false); expect(await dead.read('p')).toBeNull(); await dead.clear('p');
  });

  it('rejects malformed v2 snapshots', () => {
    const good = buildSnapshot('p', full(), NOW);
    expect(parseSnapshot({ ...good, spaces: 'x' }, 'p', NOW)).toBeNull();
    expect(parseSnapshot({ ...good, spaces: [{ id: 's' }] }, 'p', NOW)).toBeNull();
    expect(parseSnapshot({ ...good, overlays: [{}] }, 'p', NOW)).toBeNull();
  });

  it('round trip through the REAL reducer: edit overlay / node+edge / director, snapshot, reload the saved state, recover, reach the edited state', () => {
    const R = (st: ReturnType<typeof createInitialWorkspaceState>, a: Record<string, unknown>) => workspaceReducer(st, a as never);
    let saved = createInitialWorkspaceState();
    saved = R(saved, { type: 'ADD_OVERLAY', overlay: ov('o1') });
    const sliceOf = (st: typeof saved) => recoverySliceFromState(st as never);
    // the user edits after the last save
    let live = saved;
    live = R(live, { type: 'UPDATE_OVERLAY', overlayId: 'o1', updates: { text: 'edited' } });
    live = R(live, { type: 'ADD_OVERLAY', overlay: ov('o2') });
    live = R(live, { type: 'SET_NODES', nodes: [node('n1'), node('n2')] });
    live = R(live, { type: 'SET_EDGES', edges: [{ id: 'e1', source: 'n1', target: 'n2' }] });
    live = R(live, { type: 'SET_DIRECTOR', director: { ...(live.director as object), title: 'My show' } });
    const snap = buildSnapshot('p', sliceOf(live), NOW);
    expect(snap.fingerprint).not.toBe(fingerprintFor(snap, sliceOf(saved)));
    const actions = recoveryActions(planRecovery(snap, sliceOf(saved)));
    for (const a of actions) expect(WORKSPACE_PERSIST_ACTIONS as readonly string[]).toContain(a.type as string); // all go through the save path
    let recovered = saved;
    for (const a of actions) recovered = R(recovered, a);
    expect(fingerprintFor(snap, sliceOf(recovered))).toBe(snap.fingerprint); // everything is back
    expect(recovered.overlays.map((o: { id: string }) => o.id).sort()).toEqual(['o1', 'o2']);
    expect(recovered.nodes).toHaveLength(2); expect(recovered.edges).toHaveLength(1);
    expect((recovered.director as { title?: string }).title).toBe('My show');
    // recovery is itself ordinary pending work: nothing left to recover from the recovered state
    expect(planRecovery(snap, sliceOf(recovered)).spaceOps).toEqual([]);
  });
});
