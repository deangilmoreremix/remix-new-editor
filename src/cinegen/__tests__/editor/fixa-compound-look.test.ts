// Fix A (3): a compound clip's own anim / fx / transform / opacity keys / blend apply to the whole group (distributed onto its picture children
// with the right time offset), in the flattened timeline the preview and export use, and survive expand and a save -> load.
import { describe, it, expect } from 'vitest';
import { createDefaultTimeline, addClipToTrack, updateClipProperties } from '@cinegen/lib/editor/timeline-operations';
import { createCompound, flattenCompounds, expandCompound } from '@cinegen/lib/editor/stage1';
import { poseAt, poseOpacity, animFxKeys } from '@cinegen/lib/editor/stage2/anim';
import { clipFxInstances } from '@cinegen/lib/occ/clip-fx';
import { exportClipsFromTimeline, exportItem } from '@cinegen/lib/editor/export-mapping';
import { clipToRow, clipFromRow } from '@cinegen/lib/db-converters';
import type { Asset } from '@cinegen/types/project';
import type { Clip, Timeline } from '@cinegen/types/timeline';

const asset = (id: string): Asset => ({ id, name: id, type: 'video', url: `https://x.test/${id}.mp4`, duration: 10, createdAt: '2026-01-01' });
const T = (tl: Timeline, n: string) => tl.tracks.find((t) => t.name === n)!.id;

/** V1: A 0-3 and B 3-6 nested into one compound at 0; the compound gets `look`. */
function setup(look: Partial<Clip>, childLook?: (id: 'A' | 'B') => Partial<Clip>) {
  let tl = createDefaultTimeline('t');
  tl = addClipToTrack(tl, T(tl, 'V1'), asset('A'), 0);
  tl = addClipToTrack(tl, T(tl, 'V1'), asset('B'), 3);
  tl = { ...tl, duration: 6, clips: tl.clips.map((c) => ({ ...c, duration: 10, trimStart: 0, trimEnd: 7 })) };
  for (const id of ['A', 'B'] as const) {
    const c = tl.clips.find((k) => k.assetId === id && k.trackId === T(tl, 'V1'))!;
    if (childLook) tl = updateClipProperties(tl, c.id, childLook(id));
  }
  const picture = tl.clips.filter((c) => c.trackId === T(tl, 'V1')).map((c) => c.id);
  const r = createCompound(tl, picture);
  tl = updateClipProperties(r.timeline, r.compoundId as string, look);
  return { tl, cid: r.compoundId as string };
}
const pics = (tl: Timeline) => tl.clips.filter((c) => c.trackId === T(tl, 'V1')).sort((a, b) => a.startTime - b.startTime);

describe('Fix A: a compound clip animation applies to the whole group', () => {
  it('keyed x on the compound is continuous across the cut between its two children and equals the compound curve at compound time', () => {
    const keys = { x: [{ t: 0, v: -30 }, { t: 6, v: 30 }] };
    const { tl } = setup({ anim: { keys } });
    const [a, b] = pics(flattenCompounds(tl));
    expect(a.startTime).toBe(0); expect(b.startTime).toBe(3);
    // A at its t: compound time = t ; B at t: compound time = 3 + t
    for (const t of [0, 1, 2.5, 3]) expect(poseAt(a, t).x).toBeCloseTo(-30 + 10 * t, 3);
    for (const t of [0, 1, 2.5, 3]) expect(poseAt(b, t).x).toBeCloseTo(-30 + 10 * (3 + t), 3);
    // no jump at the cut: end of A == start of B
    expect(poseAt(a, 3).x).toBeCloseTo(poseAt(b, 0).x, 3);
  });

  it('composes with the child\'s own pose: group scale 2 and shift scale the child\'s offset (translate . scale order) and keep its own keys', () => {
    const { tl } = setup({ transform: { x: 5, y: 0, scale: 2, rotation: 0 } }, (id) => (id === 'A' ? { anim: { keys: { x: [{ t: 0, v: 0 }, { t: 3, v: 10 }] } } } : { transform: { x: 4, y: 2, scale: 1.5, rotation: 0 } }));
    const [a, b] = pics(flattenCompounds(tl));
    expect(poseAt(a, 0).x).toBeCloseTo(5, 3); expect(poseAt(a, 3).x).toBeCloseTo(5 + 2 * 10, 3); expect(poseAt(a, 1.5).x).toBeCloseTo(5 + 2 * 5, 3);
    expect(poseAt(a, 1).scale).toBeCloseTo(2, 4);
    expect(poseAt(b, 1).x).toBeCloseTo(5 + 2 * 4, 3); expect(poseAt(b, 1).y).toBeCloseTo(2 * 2, 3); expect(poseAt(b, 1).scale).toBeCloseTo(3, 4);
  });

  it('opacity: group keys multiply the child opacity; static compound opacity is not applied twice', () => {
    const { tl } = setup({ opacity: 0.5, anim: { keys: { opacity: [{ t: 0, v: 1 }, { t: 6, v: 0 }] } } }, () => ({ opacity: 0.8 }));
    const [a, b] = pics(flattenCompounds(tl));
    // anim opacity key wins over the compound's static value (the same rule as any clip): 1 -> 0 over 6 s, times the child's 0.8
    expect(poseOpacity(a, 0)).toBeCloseTo(0.8, 3);
    expect(poseOpacity(b, 0)).toBeCloseTo(0.8 * 0.5, 3); // compound time 3
    // the same pure sample the export uses (poseOpacity) over the exported clip
    const ex = exportClipsFromTimeline(flattenCompounds(tl), [asset('A'), asset('B')]).filter((c) => c.trackKind === 'video');
    expect(ex.every((c) => !!c.anim?.keys?.opacity?.length)).toBe(true);
  });

  it('static compound opacity alone still multiplies the children (unchanged behaviour)', () => {
    const { tl } = setup({ opacity: 0.5 });
    expect(pics(flattenCompounds(tl)).map((c) => c.opacity)).toEqual([0.5, 0.5]);
    expect(pics(flattenCompounds(tl)).every((c) => !c.anim)).toBe(true);
  });

  it('modifiers on the compound (sway) are sampled with compound time: B continues the motion instead of restarting at the cut', () => {
    const mod = { id: 'm', type: 'sway', enabled: true, amplitude: 1, frequency: 0.5, phase: 0, seed: 1 } as never;
    const { tl, cid } = setup({ anim: { modifiers: [mod] } });
    const comp = tl.clips.find((c) => c.id === cid)!;
    const [a, b] = pics(flattenCompounds(tl));
    for (const t of [0, 0.7, 2.2]) { expect(poseAt(a, t).x).toBeCloseTo(poseAt(comp, t).x, 2); expect(poseAt(b, t).x).toBeCloseTo(poseAt(comp, 3 + t).x, 2); expect(poseAt(b, t).y).toBeCloseTo(poseAt(comp, 3 + t).y, 2); }
  });

  it('a compound with only a fit / identity transform changes nothing (no baked keys)', () => {
    const { tl } = setup({ transform: { x: 0, y: 0, scale: 1, rotation: 0, fit: 'contain' } });
    expect(pics(flattenCompounds(tl)).every((c) => !c.anim)).toBe(true);
  });
});

describe('Fix A: a compound clip\'s effects apply to the whole group', () => {
  const fxList = [{ id: 'builtin:fx-exposure', props: { exposure: 0.5 }, keys: { exposure: [{ frame: 0, value: -2 }, { frame: 180, value: 2 }] } } as never];
  it('fx are appended after the child\'s own, param keys shifted to the child\'s time (compound time = offset + child time)', () => {
    const { tl } = setup({ fx: fxList, anim: { keys: { 'fx:0:amount': [{ t: 0, v: 0 }, { t: 6, v: 1 }] } } }, (id) => (id === 'A' ? { fx: [{ id: 'builtin:fx-scanlines', props: {} } as never] } : {}));
    const [a, b] = pics(flattenCompounds(tl));
    expect(a.fx!.map((f) => f.id)).toEqual(['builtin:fx-scanlines', 'builtin:fx-exposure']);
    expect(b.fx!.map((f) => f.id)).toEqual(['builtin:fx-exposure']);
    const ex = (c: Clip, t: number) => clipFxInstances(c, t).find((i) => i.def.id === 'builtin:fx-exposure')!.overrides.exposure as number;
    // exposure goes -2 -> 2 over compound frames 0..180 (6 s): at compound time 1 -> -2 + 4/6
    expect(ex(a, 1)).toBeCloseTo(-2 + 4 / 6, 2);
    expect(ex(b, 0)).toBeCloseTo(0, 2); // compound time 3 = half way
    expect(ex(b, 3)).toBeCloseTo(2, 2); // compound time 6
    // an anim key on the compound's effect parameter is re-indexed onto the appended effect (index 1 on A, 0 on B) and shifted
    expect(animFxKeys(a.anim, 1)!.amount[0].value).toBeCloseTo(0, 3);
    expect(animFxKeys(b.anim, 0)!.amount[0].value).toBeCloseTo(0.5, 3);
  });

  it('LUT and blend mode of the compound reach the children; a child LUT stays before the group LUT', () => {
    const { tl } = setup({ lut: { id: 'builtin:lut-teal', intensity: 0.7 } as never, blendMode: 'screen' }, (id) => (id === 'A' ? { lut: { id: 'builtin:lut-warm', intensity: 1 } as never } : {}));
    const [a, b] = pics(flattenCompounds(tl));
    expect(a.blendMode).toBe('screen'); expect(b.blendMode).toBe('screen');
    expect(a.lut).toBeUndefined();
    expect(a.fx!.map((f) => [f.id, f.props.intensity])).toEqual([['builtin:lut-warm', 1], ['builtin:lut-teal', 0.7]]);
    expect(b.lut).toBeUndefined(); expect(b.fx!.map((f) => f.id)).toEqual(['builtin:lut-teal']);
  });

  it('audio children are untouched', () => {
    let tl = createDefaultTimeline('t');
    tl = addClipToTrack(tl, T(tl, 'V1'), asset('A'), 0);
    const all = tl.clips.map((c) => c.id);
    const r = createCompound(tl, all);
    const t2 = updateClipProperties(r.timeline, r.compoundId as string, { anim: { keys: { x: [{ t: 0, v: 10 }] } }, fx: fxList });
    const flat = flattenCompounds(t2);
    const aud = flat.clips.find((c) => c.trackId === T(tl, 'A1'));
    if (aud) { expect(aud.fx).toBeUndefined(); expect(aud.anim).toBeUndefined(); }
    expect(flat.clips.find((c) => c.trackId === T(tl, 'V1'))!.fx).toHaveLength(1);
  });
});

describe('Fix A: through the export mapping, expand and save/load', () => {
  it('the real export clips carry the group look per child (anim keys + fx) and equal what flatten produces', () => {
    const { tl } = setup({ anim: { keys: { x: [{ t: 0, v: -30 }, { t: 6, v: 30 }] } }, fx: [{ id: 'builtin:fx-exposure', props: { exposure: 1 } } as never] });
    const ex = exportClipsFromTimeline(flattenCompounds(tl), [asset('A'), asset('B')]).filter((c) => c.trackKind === 'video');
    expect(ex).toHaveLength(2);
    const items = ex.map((c, i) => exportItem(c, i)) as Array<{ anim?: { keys: { x: Array<{ t: number; v: number }> } }; occFx: Array<{ id: string }> }>;
    expect(items.every((i) => i.occFx.some((f) => f.id === 'builtin:fx-exposure'))).toBe(true);
    expect(items[0].anim!.keys.x[0].v).toBeCloseTo(-30, 3);
    expect(items[1].anim!.keys.x[0].v).toBeCloseTo(0, 3); // B starts at compound time 3
  });

  it('expand keeps the look: the expanded clips equal the flattened ones; nest -> expand of an animated child keeps its own keys', () => {
    const { tl, cid } = setup({ anim: { keys: { x: [{ t: 0, v: -30 }, { t: 6, v: 30 }] } }, fx: [{ id: 'builtin:fx-exposure', props: { exposure: 1 } } as never] });
    const ex = expandCompound(tl, cid).timeline;
    const flat = flattenCompounds(tl);
    expect(pics(ex).map((c) => [c.startTime, c.anim, c.fx])).toEqual(pics(flat).map((c) => [c.startTime, c.anim, c.fx]));
    expect(ex.clips.some((c) => c.compound)).toBe(false);
    const [a, b] = pics(ex);
    expect(poseAt(b, 0).x).toBeCloseTo(0, 3); expect(poseAt(a, 0).x).toBeCloseTo(-30, 3);
  });

  it('the compound\'s own anim / fx survive the row converters (save -> load) and still flatten the same', () => {
    const { tl, cid } = setup({ anim: { keys: { x: [{ t: 0, v: -30 }, { t: 6, v: 30 }] } }, fx: [{ id: 'builtin:fx-exposure', props: { exposure: 1 } } as never], blendMode: 'screen' });
    const c = tl.clips.find((x) => x.id === cid)!;
    const back = clipFromRow(JSON.parse(JSON.stringify({ ...clipToRow(c, tl.id), created_at: '', keyframes: [] })) as never);
    expect(back.anim).toEqual(c.anim); expect(back.fx).toEqual(c.fx); expect(back.compound!.clips).toHaveLength(2);
    const tl2: Timeline = { ...tl, clips: tl.clips.map((x) => (x.id === cid ? back : x)) };
    expect(JSON.stringify(pics(flattenCompounds(tl2)))).toBe(JSON.stringify(pics(flattenCompounds(tl))));
  });

  it('nested compounds: the outer look reaches the inner compound\'s children', () => {
    const { tl, cid } = setup({ fx: [{ id: 'builtin:fx-exposure', props: { exposure: 1 } } as never] });
    const outer = createCompound(tl, [cid]);
    const t2 = updateClipProperties(outer.timeline, outer.compoundId as string, { anim: { keys: { x: [{ t: 0, v: 0 }, { t: 6, v: 60 }] } } });
    const [a, b] = pics(flattenCompounds(t2));
    expect(a.fx!.map((f) => f.id)).toEqual(['builtin:fx-exposure']);
    expect(poseAt(b, 0).x).toBeCloseTo(30, 2);
  });
});
