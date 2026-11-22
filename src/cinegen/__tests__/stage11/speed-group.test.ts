// Fix M: re-editable speed curves. Real timeline operations (addClipToTrack / splitClip / moveClip / trimClip / removeClip) and the real DB row converters.
import { describe, it, expect } from 'vitest';
import { createDefaultTimeline, addClipToTrack, splitClip, moveClip, trimClip, removeClip } from '@cinegen/lib/editor/timeline-operations';
import { clipEndTime } from '@cinegen/types/timeline';
import { clipToRow, clipFromRow } from '@cinegen/lib/db-converters';
import { applySpeedRamp } from '@cinegen/lib/editor/stage1/speed-ramp';
import { CURVE_PRESETS, curveDuration } from '@cinegen/lib/editor/stage11/speed-curve';
import { applySpeedCurveGroup, inspectSpeedGroup, reapplySpeedCurve, normalizeClipSpeedCurve } from '@cinegen/lib/editor/stage11/speed-group';
import type { Asset } from '@cinegen/types/project';
import type { Clip, Timeline } from '@cinegen/types/timeline';

const A: Asset = { id: 'A', name: 'A', type: 'video', url: 'https://x.test/A.mp4', duration: 10, createdAt: '2026-01-01' };
const V1 = (tl: Timeline) => tl.tracks.find((t) => t.name === 'V1')!.id;
const fresh = (): Timeline => { let tl = createDefaultTimeline('t'); tl = addClipToTrack(tl, V1(tl), A, 0); return addClipToTrack(tl, V1(tl), { ...A, id: 'B', duration: 5 }, 10); };
const hero = CURVE_PRESETS['hero-moment'].curve;
const flash = CURVE_PRESETS['flash-forward'].curve;
const firstA = (tl: Timeline) => tl.clips.find((c) => c.assetId === 'A' && c.trackId === V1(tl))!;
const piecesOf = (tl: Timeline, trackId: string) => tl.clips.filter((c) => c.assetId === 'A' && c.trackId === trackId).sort((a, b) => a.startTime - b.startTime);
const bStart = (tl: Timeline) => tl.clips.find((c) => c.assetId === 'B')!.startTime;

describe('speed curve info on the pieces', () => {
  it('every piece (video and linked audio) carries the curve; piece 0 carries the origin', () => {
    const tl = fresh();
    const r = applySpeedCurveGroup(tl, firstA(tl).id, hero, { steps: 12 });
    const all = r.timeline.clips.filter((c) => c.assetId === 'A');
    expect(all).toHaveLength(24);
    expect(all.every((c) => c.speedCurve?.steps === 12 && c.speedCurve.group === all[0].speedCurve!.group)).toBe(true);
    const v = piecesOf(r.timeline, V1(tl));
    expect(v.map((c) => c.speedCurve!.index)).toEqual([...Array(12).keys()]);
    expect(v[0].speedCurve!.origin?.speed).toBe(1);
    expect(v[1].speedCurve!.origin).toBeUndefined();
    expect(inspectSpeedGroup(r.timeline, v[5].id).ok).toBe(true);
  });

  it('survives the DB row round trip (JSON), old rows load without it, and nothing else is stripped', () => {
    const tl = fresh();
    const r = applySpeedCurveGroup(tl, firstA(tl).id, flash, { steps: 8 });
    const back = r.timeline.clips.map((c) => { const row = JSON.parse(JSON.stringify(clipToRow(c, 'tl'))); return clipFromRow(row, c.keyframes); });
    const tl2 = { ...r.timeline, clips: back };
    const v = piecesOf(tl2, V1(tl));
    expect(v[3].speedCurve).toEqual(piecesOf(r.timeline, V1(tl))[3].speedCurve);
    expect(inspectSpeedGroup(tl2, v[3].id).ok).toBe(true);
    // a plain clip's row has no speed curve; a row without the key loads fine
    const plain = clipToRow(tl.clips[0], 'tl');
    expect(plain['stage1_json']).toBeNull();
    expect(clipFromRow({ ...plain }, []).speedCurve).toBeUndefined();
    // an old stage1 row (groupId only) loads and keeps its groupId
    const g = clipFromRow({ ...plain, stage1_json: JSON.stringify({ groupId: 'g1' }) }, []);
    expect(g.groupId).toBe('g1'); expect(g.speedCurve).toBeUndefined();
    // garbage is dropped, not thrown
    expect(normalizeClipSpeedCurve({ group: 'x', index: -1 })).toBeUndefined();
    expect(clipFromRow({ ...plain, stage1_json: JSON.stringify({ speedCurve: 'nope' }) }, []).speedCurve).toBeUndefined();
  });

  it('a different ramp over one piece does not copy the group info onto its sub-pieces', () => {
    const tl = fresh();
    const r = applySpeedCurveGroup(tl, firstA(tl).id, hero, { steps: 8 });
    const p = piecesOf(r.timeline, V1(tl))[2];
    const r2 = applySpeedRamp(r.timeline, p.id, [{ at: 0, speed: 1 }, { at: 1, speed: 2 }], { steps: 4 });
    expect(r2.clipIds.every((id) => !r2.timeline.clips.find((c) => c.id === id)!.speedCurve)).toBe(true);
    expect(inspectSpeedGroup(r2.timeline, piecesOf(r2.timeline, V1(tl))[0].id).ok).toBe(false);
  });
});

describe('reapplySpeedCurve', () => {
  it('replaces ALL pieces over the original source span, ripples later clips, relinks audio, and the input is untouched (one undo step)', () => {
    const tl0 = fresh();
    const r1 = applySpeedCurveGroup(tl0, firstA(tl0).id, hero, { steps: 12 });
    const len1 = curveDuration(hero, 10);
    expect(bStart(r1.timeline)).toBeCloseTo(len1, 2);
    const before = JSON.stringify(r1.timeline);
    const pick = piecesOf(r1.timeline, V1(tl0))[7]; // any piece opens the group
    const r2 = reapplySpeedCurve(r1.timeline, pick.id, flash, { steps: 16 });
    expect(r2.ok).toBe(true);
    expect(JSON.stringify(r1.timeline)).toBe(before);
    const v = piecesOf(r2.timeline, V1(tl0));
    expect(v).toHaveLength(16);
    expect(v[0].trimStart).toBeCloseTo(0, 6);
    expect(v[15].trimEnd).toBeCloseTo(0, 6);
    expect(v.reduce((m, p) => m + p.duration - p.trimStart - p.trimEnd, 0)).toBeCloseTo(10, 6);
    const end = clipEndTime(v[15]);
    expect(end).toBeCloseTo(curveDuration(flash, 10), 1);
    expect(bStart(r2.timeline)).toBeCloseTo(end, 6);
    // audio chain: same pieces, linked 1:1
    const a = r2.timeline.clips.filter((c) => c.assetId === 'A' && c.trackId !== V1(tl0)).sort((x, y) => x.startTime - y.startTime);
    expect(a).toHaveLength(16);
    a.forEach((p, i) => { expect(p.speed).toBe(v[i].speed); expect(p.startTime).toBeCloseTo(v[i].startTime, 6); expect(p.linkedClipIds).toEqual([v[i].id]); expect(v[i].linkedClipIds).toEqual([p.id]); });
    // no stray clips: 16 + 16 + B (video and audio)
    expect(r2.timeline.clips).toHaveLength(34);
    // and the new group is editable again, with the new curve and step count
    const insp = inspectSpeedGroup(r2.timeline, v[3].id);
    expect(insp.ok && insp.steps).toBe(16);
    expect(insp.ok && insp.curve).toEqual(flash);
    // the old group id is gone
    expect(new Set(r2.timeline.clips.filter((c) => c.speedCurve).map((c) => c.speedCurve!.group)).size).toBe(1);
  });

  it('works from a linked audio piece, and re-applying the same curve restores identical timings', () => {
    const tl0 = fresh();
    const r1 = applySpeedCurveGroup(tl0, firstA(tl0).id, hero, { steps: 10 });
    const audio = r1.timeline.clips.find((c) => c.assetId === 'A' && c.trackId !== V1(tl0))!;
    const r2 = reapplySpeedCurve(r1.timeline, audio.id, hero, { steps: 10 });
    expect(r2.ok).toBe(true);
    const sig = (t: Timeline) => t.clips.map((c) => [c.assetId, c.trackId, +c.startTime.toFixed(5), +c.trimStart.toFixed(5), +c.trimEnd.toFixed(5), c.speed]).sort().join('|');
    expect(sig(r2.timeline)).toBe(sig(r1.timeline));
  });

  it('shrinking and growing the curve moves later clips by exactly the length change', () => {
    const tl0 = fresh();
    const slow = { points: [{ at: 0, speed: 0.5 }, { at: 1, speed: 0.5 }] };
    const fast = { points: [{ at: 0, speed: 4 }, { at: 1, speed: 4 }] };
    const r1 = applySpeedCurveGroup(tl0, firstA(tl0).id, slow, { steps: 8 }); // 20 s
    expect(bStart(r1.timeline)).toBeCloseTo(20, 3);
    const r2 = reapplySpeedCurve(r1.timeline, firstA(r1.timeline).id, fast, { steps: 8 }); // 2.5 s
    expect(bStart(r2.timeline)).toBeCloseTo(2.5, 3);
    expect(r2.timeline.duration).toBeCloseTo(2.5 + 5, 3);
  });

  it('keeps keyframes (source-timed), fades and the clip anim of the original', () => {
    const tl0 = fresh();
    const c0 = firstA(tl0);
    const anim = { keys: { opacity: [{ t: 0, v: 0 }, { t: 5, v: 1 }] } };
    const tl1: Timeline = { ...tl0, clips: tl0.clips.map((c) => (c.id === c0.id ? { ...c, speed: 2, fadeIn: 0.4, fadeOut: 0.3, keyframes: [{ time: 1, property: 'opacity', value: 0.5 }, { time: 4, property: 'opacity', value: 0.9 }], anim } as Clip : c)) };
    const r1 = applySpeedCurveGroup(tl1, c0.id, hero, { steps: 8 });
    const r2 = reapplySpeedCurve(r1.timeline, c0.id, flash, { steps: 8 });
    expect(r2.ok).toBe(true);
    const v = piecesOf(r2.timeline, V1(tl0));
    // keyframes sit at the same SOURCE position (time * speed of the original = 2, 8 source seconds from the clip's start... check via piece trim)
    const srcOf = (p: Clip, k: { time: number }) => p.trimStart + k.time * p.speed;
    const kfs = v.flatMap((p) => p.keyframes.filter((k) => k.property === 'opacity').map((k) => ({ s: srcOf(p, k), value: k.value })));
    expect(kfs.map((k) => +k.s.toFixed(3))).toEqual([2, 8]);
    expect(kfs.map((k) => k.value)).toEqual([0.5, 0.9]);
    expect(v[0].fadeIn).toBe(0.4); expect(v[1].fadeIn).toBeUndefined();
    expect(v[7].fadeOut).toBe(0.3); expect(v[6].fadeOut).toBeUndefined();
    expect(v[0].speedCurve!.origin?.speed).toBe(2);
    expect(v[0].speedCurve!.origin?.anim).toEqual(anim);
  });
});

describe('stale groups are refused with a reason (never guessed at)', () => {
  const made = () => { const tl = fresh(); const r = applySpeedCurveGroup(tl, firstA(tl).id, hero, { steps: 8 }); return { tl, r, v: piecesOf(r.timeline, V1(tl)) }; };
  const stale = (t: Timeline, id: string, re: RegExp) => { const i = inspectSpeedGroup(t, id); expect(i.ok).toBe(false); expect(!i.ok && i.reason).toMatch(re); const rr = reapplySpeedCurve(t, id, flash); expect(rr.ok).toBe(false); expect(rr.timeline).toBe(t); };

  it('split', () => { const { tl, r, v } = made(); const t = splitClip(r.timeline, v[3].id, v[3].startTime + 0.1); stale(t, v[0].id, /split, deleted or duplicated/); expect(tl).toBeTruthy(); });
  it('deleted piece', () => { const { r, v } = made(); stale(removeClip(r.timeline, v[4].id), v[0].id, /split, deleted or duplicated/); });
  it('moved piece', () => { const { r, v } = made(); stale(moveClip(r.timeline, v[2].id, v[2].trackId, v[2].startTime + 1), v[0].id, /moved, trimmed or retimed/); });
  it('trimmed piece', () => { const { r, v } = made(); stale(trimClip(r.timeline, v[6].id, 'end', v[6].startTime + 0.2), v[0].id, /moved, trimmed or retimed/); });
  it('retimed piece (speed)', () => { const { r, v } = made(); stale({ ...r.timeline, clips: r.timeline.clips.map((c) => (c.id === v[1].id ? { ...c, speed: c.speed * 2 } : c)) }, v[0].id, /moved, trimmed or retimed/); });
  it('locked track', () => { const { tl, r, v } = made(); stale({ ...r.timeline, tracks: r.timeline.tracks.map((t) => (t.id === V1(tl) ? { ...t, locked: true } : t)) }, v[0].id, /locked/); });
  it('transition between two pieces', () => { const { r, v } = made(); stale({ ...r.timeline, transitions: [{ id: 'x', type: 'dissolve', duration: 0.2, clipAId: v[2].id, clipBId: v[3].id }] }, v[0].id, /transition/); });
  it('a clip that never had a curve', () => { const tl = fresh(); const i = inspectSpeedGroup(tl, tl.clips[0].id); expect(i.ok).toBe(false); expect(!i.ok && i.hadInfo).toBe(false); });
  it('the outgoing transition of the last piece survives re-apply', () => {
    const { r, v } = made();
    const t0 = { ...r.timeline, transitions: [{ id: 'x', type: 'dissolve' as const, duration: 0.2, clipAId: v[7].id, clipBId: 'B-clip' }] };
    const rr = reapplySpeedCurve(t0, v[0].id, flash, { steps: 6 });
    expect(rr.ok).toBe(true);
    expect(rr.timeline.transitions[0].clipAId).toBe(piecesOf(rr.timeline, V1(r.timeline)).at(-1)!.id);
  });
  it('compound clips are never ramped', () => {
    const tl = fresh(); const c = tl.clips[0];
    const t: Timeline = { ...tl, clips: tl.clips.map((x) => (x.id === c.id ? { ...x, compound: { clips: [], transitions: [] } } : x)) };
    expect(applySpeedCurveGroup(t, c.id, hero).clipIds).toEqual([]);
  });
});
