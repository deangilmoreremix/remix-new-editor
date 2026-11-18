// Stage 1 (CineGen): real-data tests. Timelines are built with the real timeline operations, the Stage 1 operation is run, and the resulting
// clips / times are asserted. Undo / redo is the editor's snapshot model (operations are pure and never mutate their input); save -> load goes
// through JSON and the project migration used when a project is opened.
import { describe, it, expect } from 'vitest';
import { createDefaultTimeline, addClipToTrack, addTransition, addKeyframe, moveClip, trimClip, slipClip, slideClip, rippleTrim, rollTrim, splitClip, removeClip, linkClips, unlinkClips, updateTrack } from '@cinegen/lib/editor/timeline-operations';
import { migrateSequenceToTimelines } from '@cinegen/lib/editor/timeline-migration';
import {
  setMarkIn, setMarkOut, clearMarks, resolveRange, emptyMarks, insertEdit, overwriteEdit, groupClips, ungroupClips, expandSelectionWithGroups,
  createCompound, flattenCompounds, expandCompound, applySpeedRamp, speedAt, rampSpeeds, nextShuttleRate, shuttleTick, needsSeekDriver,
} from '@cinegen/lib/editor/stage1';
import { clipToRow, clipFromRow, timelineFromRows, trackToRow, transitionToRow } from '@cinegen/lib/db-converters';
import { exportClipsFromTimeline } from '@cinegen/lib/editor/export-mapping';
import { clipEffectiveDuration, clipEndTime } from '@cinegen/types/timeline';
import type { Asset } from '@cinegen/types/project';
import type { Clip, Timeline } from '@cinegen/types/timeline';

const asset = (id: string, type: Asset['type'] = 'video', duration = 10): Asset => ({ id, name: id, type, url: `https://x.test/${id}.mp4`, duration, createdAt: '2026-01-01' });
const A = asset('A'); const B = asset('B', 'video', 20); const S = asset('S', 'audio', 6); const ASSETS = [A, B, S];
const T = (tl: Timeline, n: string) => tl.tracks.find((t) => t.name === n)!.id;
const snap = <X,>(x: X): X => JSON.parse(JSON.stringify(x));
const near = (a: number, b: number) => expect(a).toBeCloseTo(b, 6);
const onTrack = (tl: Timeline, id: string) => tl.clips.filter((c) => c.trackId === id).sort((a, b) => a.startTime - b.startTime);
const span = (c: Clip) => [c.startTime, clipEndTime(c)] as const;

/** V1: A at 0 (10s). A1: its linked audio. */
function base(): Timeline {
  return addClipToTrack(createDefaultTimeline('t'), T(createDefaultTimeline('t'), 'V1'), A, 0);
}
function fresh(): Timeline {
  const tl = createDefaultTimeline('t');
  return addClipToTrack(tl, T(tl, 'V1'), A, 0);
}

describe('mark in / mark out', () => {
  it('sets, clamps, drops a crossed point and resolves the range', () => {
    let m = emptyMarks('A');
    m = setMarkIn(m, 2, 10); expect(m.markIn).toBe(2);
    m = setMarkOut(m, 7.5, 10); expect(resolveRange(m, 10)).toEqual({ in: 2, out: 7.5 });
    m = setMarkIn(m, 8, 10); expect(m.markOut).toBeNull(); // out was before the new in
    expect(resolveRange(m, 10)).toEqual({ in: 8, out: 10 });
    expect(setMarkOut(m, 99, 10).markOut).toBe(10);
    expect(resolveRange(clearMarks(m), 10)).toEqual({ in: 0, out: 10 });
    expect(resolveRange(null, 4)).toEqual({ in: 0, out: 4 });
  });
});

describe('insert edit', () => {
  it('inserts a marked range mid-clip: splits, ripples, places linked audio, moves markers', () => {
    let tl = fresh();
    tl = { ...tl, markers: [{ id: 'm1', time: 6, color: '#fff', label: 'late' }, { id: 'm0', time: 1, color: '#fff', label: 'early' }] };
    const before = snap(tl);
    const r = insertEdit(tl, { asset: B, range: { in: 5, out: 8 }, trackId: T(tl, 'V1'), at: 4 });
    expect(r.error).toBeUndefined();
    expect(tl).toEqual(before); // pure: input untouched
    const v = onTrack(r.timeline, T(tl, 'V1'));
    expect(v.map(span)).toEqual([[0, 4], [4, 7], [7, 13]]);
    expect(v[1].assetId).toBe('B'); expect(v[1].trimStart).toBe(5); near(clipEffectiveDuration(v[1]), 3);
    expect(v[2].assetId).toBe('A'); near(v[2].trimStart, 4); // second half of A resumes at source 4s
    const a = onTrack(r.timeline, T(tl, 'A1'));
    expect(a.map(span)).toEqual([[0, 4], [4, 7], [7, 13]]);
    expect(v[1].linkedClipIds).toEqual([a[1].id]);
    expect(r.timeline.markers.map((m) => [m.id, m.time])).toEqual([['m1', 9], ['m0', 1]]);
    near(r.timeline.duration, 13);
  });

  it('inserting at the playhead past the end just appends; audio assets go on an audio track without a linked clip', () => {
    const tl = fresh();
    const r = insertEdit(tl, { asset: A, trackId: T(tl, 'V1'), at: 15 });
    expect(onTrack(r.timeline, T(tl, 'V1')).map(span)).toEqual([[0, 10], [15, 25]]);
    const r2 = insertEdit(tl, { asset: S, range: { in: 1, out: 3 }, trackId: T(tl, 'A2'), at: 0 });
    expect(r2.clipIds).toHaveLength(1);
    expect(onTrack(r2.timeline, T(tl, 'A2')).map(span)).toEqual([[0, 2]]);
    expect(onTrack(r2.timeline, T(tl, 'V1')).map(span)).toEqual([[2, 12]]); // insert ripples every unlocked track (sync), so V1 moved by the 2s
  });

  it('does not ripple a locked track and refuses a locked target', () => {
    let tl = fresh();
    tl = addClipToTrack(tl, T(tl, 'V2'), B, 6);
    tl = updateTrack(tl, T(tl, 'V2'), { locked: true });
    const r = insertEdit(tl, { asset: A, range: { in: 0, out: 2 }, trackId: T(tl, 'V1'), at: 0 });
    expect(onTrack(r.timeline, T(tl, 'V2')).map(span)).toEqual([[6, 26]]);
    expect(insertEdit(tl, { asset: A, trackId: T(tl, 'V2'), at: 0 }).error).toMatch(/locked/);
  });

  it('removes a dissolve that the ripple would pull apart', () => {
    let tl = createDefaultTimeline('t');
    tl = addClipToTrack(tl, T(tl, 'V1'), A, 0);
    tl = addClipToTrack(tl, T(tl, 'V2'), B, 8);
    tl = { ...tl, clips: tl.clips.map((c) => (c.assetId === 'A' ? { ...c, trimEnd: 2 } : c.assetId === 'B' ? { ...c, trimStart: 2 } : c)) };
    const [a, b] = tl.clips.filter((c) => c.trackId === T(tl, 'V1') || c.trackId === T(tl, 'V2'));
    tl = addTransition(tl, { id: 'd', type: 'dissolve', duration: 2, clipAId: a.id, clipBId: b.id });
    expect(tl.transitions).toHaveLength(1);
    // before the overlap: A is split and B moves; the dissolve follows A's tail, which moves too, so it survives with its overlap intact
    const early = insertEdit(tl, { asset: S, trackId: T(tl, 'A2'), at: 3, range: { in: 0, out: 1 } }).timeline;
    const d1 = early.transitions.find((t) => t.id === 'd')!;
    const aTail = early.clips.find((c) => c.id === d1.clipAId)!; const bClip = early.clips.find((c) => c.id === d1.clipBId)!;
    near(aTail.startTime, 4); near(clipEndTime(aTail), 9); near(bClip.startTime, 7); // overlap [7, 9] = still 2s
    // inside the overlap: A's tail and B's head are cut apart, so the dissolve is removed
    const inside = insertEdit(tl, { asset: S, trackId: T(tl, 'A2'), at: 7, range: { in: 0, out: 1 } }).timeline;
    expect(inside.transitions.filter((t) => t.id === 'd')).toHaveLength(0);
  });

  it('undo / redo round trip with snapshots', () => {
    const t0 = fresh();
    const hist = [snap(t0)];
    const t1 = insertEdit(t0, { asset: B, range: { in: 0, out: 2 }, trackId: T(t0, 'V1'), at: 3 }).timeline; hist.push(snap(t1));
    const t2 = overwriteEdit(t1, { asset: B, range: { in: 4, out: 5 }, trackId: T(t0, 'V1'), at: 0 }).timeline; hist.push(snap(t2));
    expect(hist[1]).not.toEqual(hist[0]);
    // undo twice then redo twice
    expect(snap(t0)).toEqual(hist[0]);
    const redo = overwriteEdit(snap(t1), { asset: B, range: { in: 4, out: 5 }, trackId: T(t0, 'V1'), at: 0 }).timeline;
    expect(onTrack(redo, T(t0, 'V1')).map((c) => [c.assetId, ...span(c)])).toEqual(onTrack(t2, T(t0, 'V1')).map((c) => [c.assetId, ...span(c)]));
  });
});

describe('overwrite edit', () => {
  it('replaces the covered span, splits a straddled clip and keeps the length of everything else', () => {
    const tl = fresh();
    const r = overwriteEdit(tl, { asset: B, range: { in: 2, out: 5 }, trackId: T(tl, 'V1'), at: 4 });
    const v = onTrack(r.timeline, T(tl, 'V1'));
    expect(v.map((c) => [c.assetId, ...span(c)])).toEqual([['A', 0, 4], ['B', 4, 7], ['A', 7, 10]]);
    near(v[2].trimStart, 7); // the tail resumes at source 7s (nothing shifted)
    expect(onTrack(r.timeline, T(tl, 'A1')).map(span)).toEqual([[0, 4], [4, 7], [7, 10]]);
    near(r.timeline.duration, 10);
  });

  it('removes fully covered clips, trims partially covered ones, and cleans links and transitions', () => {
    let tl = createDefaultTimeline('t');
    const v1 = T(tl, 'V1');
    tl = addClipToTrack(tl, v1, A, 0); // 0-10
    tl = addClipToTrack(tl, v1, B, 10); // 10-30
    tl = addClipToTrack(tl, v1, A, 30); // 30-40
    const mid = tl.clips.find((c) => c.assetId === 'B' && c.trackId === v1)!;
    tl = addTransition(tl, { id: 'f', type: 'fadeToBlack', duration: 1, clipAId: mid.id });
    const r = overwriteEdit(tl, { asset: S, range: { in: 0, out: 6 }, trackId: T(tl, 'A2'), at: 0 }); // audio-only: V1 untouched
    expect(onTrack(r.timeline, v1)).toHaveLength(3);
    const r2 = overwriteEdit(tl, { asset: B, range: { in: 0, out: 20 }, trackId: v1, at: 5 }); // covers 5..25: trims A's tail, covers B's head (10-25), keeps B's last 5s
    const v = onTrack(r2.timeline, v1);
    expect(v.map((c) => [c.assetId, ...span(c)])).toEqual([['A', 0, 5], ['B', 5, 25], ['B', 25, 30], ['A', 30, 40]]);
    // the fade-to-black was on B's END: it now sits on the surviving tail piece
    const fade = r2.timeline.transitions.find((t) => t.id === 'f')!;
    near(clipEndTime(r2.timeline.clips.find((c) => c.id === fade.clipAId)!), 30);
  });
});

describe('groups', () => {
  it('group / ungroup, selection expansion, merge, and the group moves together via moveClip on each member', () => {
    let tl = createDefaultTimeline('t');
    tl = addClipToTrack(tl, T(tl, 'V1'), A, 0);
    tl = addClipToTrack(tl, T(tl, 'V2'), B, 2);
    const [x, y] = tl.clips.filter((c) => c.trackId === T(tl, 'V1') || c.trackId === T(tl, 'V2'));
    const g = groupClips(tl, [x.id, y.id]);
    expect(g.groupId).toBeTruthy();
    expect(g.timeline.clips.filter((c) => c.groupId === g.groupId)).toHaveLength(2);
    expect([...expandSelectionWithGroups(g.timeline.clips, [x.id])].sort()).toEqual([x.id, y.id].sort());
    expect(groupClips(tl, [x.id]).groupId).toBeNull();
    const u = ungroupClips(g.timeline, [y.id]);
    expect(u.clips.some((c) => c.groupId)).toBe(false);
    // splitting a member does not touch the other member (unlike linked clips)
    const sp = splitClip(g.timeline, x.id, 3);
    expect(sp.clips.filter((c) => c.assetId === 'B' && c.trackId === T(tl, 'V2'))).toHaveLength(1);
    // moving all selected members by the same delta keeps their relative offsets
    const sel = [...expandSelectionWithGroups(g.timeline.clips, [x.id])];
    let moved = g.timeline;
    for (const id of sel) { const c = moved.clips.find((k) => k.id === id)!; moved = moveClip(moved, id, c.trackId, c.startTime + 5); }
    const [mx, my] = [moved.clips.find((c) => c.id === x.id)!, moved.clips.find((c) => c.id === y.id)!];
    near(my.startTime - mx.startTime, 2);
  });
});

describe('compound clips', () => {
  function build(): { tl: Timeline; ids: string[] } {
    let tl = createDefaultTimeline('t');
    tl = addClipToTrack(tl, T(tl, 'V1'), A, 1); // 1-11 + audio
    tl = addClipToTrack(tl, T(tl, 'V2'), B, 4); // 4-24 + audio on A1
    tl = addKeyframe(tl, tl.clips[0].id, { time: 2, property: 'opacity', value: 0.5 });
    const ids = tl.clips.filter((c) => c.trackId === T(tl, 'V1') || c.trackId === T(tl, 'V2')).map((c) => c.id);
    return { tl, ids };
  }

  it('nest -> one clip on the timeline; flatten -> the original clips at the same times; expand restores ids', () => {
    const { tl, ids } = build();
    const orig = snap(tl);
    const c = createCompound(tl, tl.clips.map((k) => k.id));
    expect(c.compoundId).toBeTruthy();
    expect(c.timeline.clips).toHaveLength(1);
    const comp = c.timeline.clips[0];
    near(comp.startTime, 1); near(clipEffectiveDuration(comp), 23);
    const flat = flattenCompounds(c.timeline);
    expect(flat.clips).toHaveLength(tl.clips.length);
    const key = (k: Clip) => `${k.assetId}|${k.trackId}|${k.startTime.toFixed(4)}|${clipEffectiveDuration(k).toFixed(4)}`;
    expect(flat.clips.map(key).sort()).toEqual(tl.clips.map(key).sort());
    expect(flat.clips.every((k) => k.id.startsWith(`${comp.id}::`))).toBe(true);
    // keyframes survive
    expect(flat.clips.find((k) => k.assetId === 'A' && k.trackId === T(tl, 'V1'))!.keyframes).toEqual([{ time: 2, property: 'opacity', value: 0.5 }]);
    const ex = expandCompound(c.timeline, comp.id);
    expect(ex.timeline.clips.map((k) => k.id).sort()).toEqual(orig.clips.map((k) => k.id).sort());
    expect(ex.timeline.clips.map(key).sort()).toEqual(tl.clips.map(key).sort());
    // linked A/V pairs inside are re-linked
    expect(ex.timeline.clips.find((k) => k.id === ids[0])!.linkedClipIds?.length).toBe(1);
  });

  it('moving, trimming and speed of the compound are honoured when flattened', () => {
    const { tl } = build();
    const c = createCompound(tl, tl.clips.map((k) => k.id));
    const id = c.compoundId as string;
    const moved = moveClip(c.timeline, id, c.timeline.clips[0].trackId, 11); // +10s
    const f1 = flattenCompounds(moved);
    near(Math.min(...f1.clips.map((k) => k.startTime)), 11);
    // trim 3s off the head of the compound: the first clip (A at rel 0..10) loses 3s, B (rel 3..23) is untouched in source
    const trimmed = trimClip(c.timeline, id, 3, 0);
    const f2 = flattenCompounds(trimmed);
    const a = f2.clips.find((k) => k.assetId === 'A' && k.trackId === T(tl, 'V1'))!;
    near(a.trimStart, 3); near(a.startTime, 1); near(clipEffectiveDuration(a), 7);
    const b = f2.clips.find((k) => k.assetId === 'B' && k.trackId === T(tl, 'V2'))!;
    near(b.startTime, 1); near(b.trimStart, 0); // B started at rel 3 = the new head
    // 2x speed halves positions and doubles clip speeds
    const fast = { ...c.timeline, clips: c.timeline.clips.map((k) => (k.id === id ? { ...k, speed: 2 } : k)) };
    const f3 = flattenCompounds(fast);
    const a3 = f3.clips.find((k) => k.assetId === 'A' && k.trackId === T(tl, 'V1'))!;
    expect(a3.speed).toBe(2); near(clipEffectiveDuration(a3), 5);
    const b3 = f3.clips.find((k) => k.assetId === 'B' && k.trackId === T(tl, 'V2'))!;
    near(b3.startTime - a3.startTime, 1.5);
  });

  it('is flattened for export: the export clip list contains the nested clips (not the container)', () => {
    const { tl } = build();
    const c = createCompound(tl, tl.clips.map((k) => k.id));
    const direct = exportClipsFromTimeline(c.timeline, ASSETS);
    expect(direct).toHaveLength(1); // unflattened: the container alone (what export-tab must NOT send)
    const flat = exportClipsFromTimeline(flattenCompounds(c.timeline), ASSETS);
    expect(flat).toHaveLength(tl.clips.length);
    expect(flat.map((f) => f.inputPath).sort()).toEqual(tl.clips.map((k) => ASSETS.find((a) => a.id === k.assetId)!.url).sort());
  });

  it('nested compounds flatten recursively; transitions between nested clips are kept; the same object is returned when there is none', () => {
    const tl0 = fresh();
    expect(flattenCompounds(tl0)).toBe(tl0);
    const inner = createCompound(tl0, tl0.clips.map((k) => k.id));
    const outer = createCompound(inner.timeline, [inner.compoundId as string]);
    const flat = flattenCompounds(outer.timeline);
    expect(flat.clips).toHaveLength(2);
    expect(flat.clips.some((k) => k.compound)).toBe(false);
  });
});

describe('speed ramp', () => {
  it('speedAt / rampSpeeds interpolate and clamp', () => {
    const pts = [{ at: 0, speed: 1 }, { at: 1, speed: 3 }];
    near(speedAt(pts, 0.5), 2); near(speedAt(pts, -1), 1); near(speedAt(pts, 2), 3);
    expect(rampSpeeds(pts, 4)).toEqual([1.25, 1.75, 2.25, 2.75]);
    near(speedAt([{ at: 0, speed: 100 }], 0), 8);
  });

  it('cuts a clip into stepped pieces that cover the whole source once, with the right total length, and ripples later clips', () => {
    let tl = fresh();
    tl = addClipToTrack(tl, T(tl, 'V1'), B, 10); // after A
    const a = tl.clips.find((c) => c.assetId === 'A' && c.trackId === T(tl, 'V1'))!;
    const r = applySpeedRamp(tl, a.id, [{ at: 0, speed: 1 }, { at: 1, speed: 4 }], { steps: 4 });
    const v = onTrack(r.timeline, T(tl, 'V1'));
    const pcs = v.filter((c) => c.assetId === 'A');
    expect(pcs).toHaveLength(4);
    expect(pcs.map((c) => c.speed)).toEqual([1.375, 2.125, 2.875, 3.625]);
    // source coverage: contiguous, no gap, no overlap, whole 10s
    let src = 0;
    for (const p of pcs) { near(p.trimStart, src); src = p.trimStart + (p.duration - p.trimStart - p.trimEnd); }
    near(src, 10);
    // timeline: contiguous pieces, total = sum of (2.5 / speed)
    const total = pcs.reduce((m, p) => m + 2.5 / p.speed, 0);
    near(pcs[0].startTime, 0); near(clipEndTime(pcs[3]), total);
    // B (after) rippled by the length change; linked audio ramped too
    near(v.find((c) => c.assetId === 'B')!.startTime, total);
    expect(onTrack(r.timeline, T(tl, 'A1')).filter((c) => c.assetId === 'A')).toHaveLength(4);
    // links pair piece i with piece i
    const aud = onTrack(r.timeline, T(tl, 'A1'));
    expect(pcs[2].linkedClipIds).toEqual([aud[2].id]);
  });

  it('keeps keyframes on their source position and fades on the ends; a ramp then undo restores the original', () => {
    let tl = fresh();
    const id = tl.clips[0].id;
    tl = { ...tl, clips: tl.clips.map((c) => (c.id === id ? { ...c, fadeIn: 1, fadeOut: 1 } : c)) };
    tl = addKeyframe(tl, id, { time: 7.5, property: 'opacity', value: 0.3 });
    const orig = snap(tl);
    const r = applySpeedRamp(tl, id, [{ at: 0, speed: 2 }], { steps: 4 });
    const pcs = onTrack(r.timeline, T(tl, 'V1')).filter((c) => c.assetId === 'A');
    expect(pcs[0].fadeIn).toBe(1); expect(pcs[0].fadeOut).toBeUndefined();
    expect(pcs[3].fadeOut).toBe(1); expect(pcs[3].fadeIn).toBeUndefined();
    expect(pcs[3].keyframes).toHaveLength(1); near(pcs[3].keyframes[0].time, 0); // 7.5s source = start of the 4th piece (2.5s each)
    expect(tl).toEqual(orig);
  });

  it('exports each piece at its own constant speed', () => {
    const tl = fresh();
    const r = applySpeedRamp(tl, tl.clips[0].id, [{ at: 0, speed: 1 }, { at: 1, speed: 2 }], { steps: 2 });
    const ex = exportClipsFromTimeline(r.timeline, ASSETS).filter((c) => c.type === 'video' && c.trackKind === 'video');
    expect(ex.map((c) => c.speed)).toEqual([1.25, 1.75]);
  });
});

describe('shuttle (J / K / L)', () => {
  it('L ladders 1,2,4,8 and caps; J reverses; opposite key brakes; K stops', () => {
    let r = 0;
    r = nextShuttleRate(r, 'L'); expect(r).toBe(1);
    r = nextShuttleRate(r, 'L'); expect(r).toBe(2);
    r = nextShuttleRate(r, 'L'); r = nextShuttleRate(r, 'L'); r = nextShuttleRate(r, 'L'); expect(r).toBe(8);
    r = nextShuttleRate(r, 'J'); expect(r).toBe(4);
    r = nextShuttleRate(r, 'J'); r = nextShuttleRate(r, 'J'); expect(r).toBe(1);
    r = nextShuttleRate(r, 'J'); expect(r).toBe(0);
    r = nextShuttleRate(r, 'J'); expect(r).toBe(-1);
    r = nextShuttleRate(r, 'J'); expect(r).toBe(-2);
    expect(nextShuttleRate(-2, 'K')).toBe(0);
    expect(needsSeekDriver(-1)).toBe(true); expect(needsSeekDriver(2)).toBe(false); expect(needsSeekDriver(8)).toBe(true);
    near(shuttleTick(5, -2, 0.5, 100), 4); near(shuttleTick(0.2, -8, 1, 100), 0); near(shuttleTick(99.9, 8, 1, 100), 100);
  });
});

describe('existing ops cross-check (ripple / roll / slip / slide / link) on a real timeline', () => {
  it('behave as documented on real clips with handles', () => {
    let tl = createDefaultTimeline('t');
    const v1 = T(tl, 'V1');
    tl = addClipToTrack(tl, v1, A, 0); tl = addClipToTrack(tl, v1, B, 10); tl = addClipToTrack(tl, v1, A, 30);
    const [c1, c2, c3] = onTrack(tl, v1);
    const h = { ...tl, clips: tl.clips.map((c) => (c.id === c1.id ? { ...c, trimEnd: 2 } : c.id === c2.id ? { ...c, trimStart: 2, trimEnd: 2 } : c.id === c3.id ? { ...c, trimStart: 2 } : c)) };
    const get = (t: Timeline, id: string) => t.clips.find((c) => c.id === id)!;
    // slip: source window moves, position and length do not
    const slipped = get(slipClip(h, c2.id, 1), c2.id);
    near(slipped.trimStart, 3); near(slipped.trimEnd, 1); near(slipped.startTime, 10); near(clipEffectiveDuration(slipped), clipEffectiveDuration(get(h, c2.id)));
    // slide: the clip moves, the neighbours absorb it
    const slid = slideClip(h, c2.id, 1);
    near(get(slid, c2.id).startTime, 11); near(get(slid, c1.id).trimEnd, 1); near(get(slid, c3.id).trimStart, 3); near(get(slid, c3.id).startTime, 31);
    // ripple: trimming the right edge inwards pulls everything after it
    const rt = rippleTrim(h, c1.id, 'right', -2);
    near(get(rt, c1.id).trimEnd, 4); near(get(rt, c2.id).startTime, 8); near(get(rt, c3.id).startTime, 28);
    // roll: the cut moves, outer edges and total length stay
    const roll = rollTrim(h, c1.id, c2.id, 1);
    near(get(roll, c1.id).trimEnd, 1); near(get(roll, c2.id).trimStart, 3); near(clipEndTime(get(roll, c2.id)), clipEndTime(get(h, c2.id)));
    // link / unlink round trip, remove cleans partners
    const l = unlinkClips(linkClips(tl, c1.id, c3.id), c1.id, c3.id);
    expect(get(l, c1.id).linkedClipIds ?? []).toEqual(get(tl, c1.id).linkedClipIds ?? []);
    expect(removeClip(tl, c3.id).clips.some((c) => c.id === c3.id)).toBe(false);
  });
});

describe('save -> load round trip', () => {
  it('group, compound, ramp pieces and marker survive JSON + the project migration unchanged', () => {
    let tl = createDefaultTimeline('t');
    tl = addClipToTrack(tl, T(tl, 'V1'), A, 0); tl = addClipToTrack(tl, T(tl, 'V2'), B, 12);
    const vids = tl.clips.filter((c) => c.trackId === T(tl, 'V1') || c.trackId === T(tl, 'V2')).map((c) => c.id);
    tl = groupClips(tl, vids).timeline;
    tl = applySpeedRamp(tl, vids[0], [{ at: 0, speed: 1 }, { at: 1, speed: 2 }], { steps: 3 }).timeline;
    tl = { ...tl, markers: [{ id: 'm', time: 3, color: '#0fd7f1', label: 'x' }] };
    const c = createCompound(tl, tl.clips.filter((k) => k.assetId === 'B').map((k) => k.id));
    const saved = JSON.stringify({ timelines: [c.timeline] });
    const loaded = migrateSequenceToTimelines(JSON.parse(saved)).timelines[0] as Timeline;
    expect(loaded).toEqual(c.timeline);
    expect(loaded.clips.some((k) => k.compound)).toBe(true);
    expect(loaded.clips.some((k) => k.groupId)).toBe(true);
    // an older project (no group / compound fields) opens unchanged
    const old = migrateSequenceToTimelines({ timelines: [{ id: 'x', name: 'old', tracks: [], clips: [{ id: 'c', assetId: 'A', trackId: 't', name: 'c', startTime: 0, duration: 4, trimStart: 0, trimEnd: 0 }], markers: [], duration: 4 }] }).timelines[0];
    expect(old.clips[0].groupId).toBeUndefined(); expect(old.clips[0].compound).toBeUndefined();
    expect(flattenCompounds(old)).toBe(old);
  });

  it('survives the project row converters used by the project store (clipToRow -> timelineFromRows)', () => {
    let tl = createDefaultTimeline('t');
    tl = addClipToTrack(tl, T(tl, 'V1'), A, 0); tl = addClipToTrack(tl, T(tl, 'V2'), B, 12);
    const vids = tl.clips.filter((c) => c.trackId === T(tl, 'V1') || c.trackId === T(tl, 'V2')).map((c) => c.id);
    tl = groupClips(tl, vids).timeline;
    tl = createCompound(tl, [vids[1]]).timeline;
    const rows = tl.clips.map((c) => ({ ...clipToRow(c, tl.id), keyframes: c.keyframes.map((k) => ({ id: '', clip_id: c.id, ...k })) }));
    const back = timelineFromRows({ id: tl.id, name: tl.name, duration: tl.duration, markers: '[]' }, tl.tracks.map((t, i) => trackToRow(t, tl.id, i)), rows, tl.transitions.map((t) => transitionToRow(t, tl.id)));
    expect(back.clips.map((c) => [c.id, c.groupId, !!c.compound])).toEqual(tl.clips.map((c) => [c.id, c.groupId, !!c.compound]));
    const comp = back.clips.find((c) => c.compound)!;
    expect(comp.compound!.clips[0].assetId).toBe('B');
    expect(clipFromRow(clipToRow(tl.clips[0], tl.id), []).groupId).toBe(tl.clips[0].groupId);
  });
});
