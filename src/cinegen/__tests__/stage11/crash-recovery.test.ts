// Stage 11 (port J): crash recovery data layer. Timelines are built with the real timeline operations.
import { describe, it, expect } from 'vitest';
import { createDefaultTimeline, addClipToTrack, trimClip } from '@cinegen/lib/editor/timeline-operations';
import { PROJECT_SCHEMA_VERSION } from '@cinegen/lib/editor/project-migrations';
import {
  RecoveryStore, memoryRecoveryBackend, buildSnapshot, parseSnapshot, planRecovery, sliceFingerprint, stableStringify, summarize,
  RECOVERY_MAX_AGE_MS, RECOVERY_VERSION,
} from '@cinegen/lib/recovery/crash-recovery';
import type { Asset } from '@cinegen/types/project';

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
    expect(summarize(got!)).toEqual({ clips: 2, timelines: 1, savedAt: NOW });
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
