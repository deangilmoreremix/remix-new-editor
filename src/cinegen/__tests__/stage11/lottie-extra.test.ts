// Stage 11 (port J): Lottie value slots + layer visibility on a Lottie document written to the Lottie slots format (v1.0 `slots` table + `sid` references).
import { describe, it, expect } from 'vitest';
import { extractLottieValueSlots, applyLottieValueOverrides, extractLottieLayers, applyLottieLayerVisibility } from '@cinegen/lib/editor/stage11/lottie-extra';
import { applyLottieEdits, hasLottieEdits } from '@cinegen/lib/editor/stage2/lottie-edit';

const rect = (nm: string, color: number[]) => ({ ty: 'gr', nm, it: [{ ty: 'rc', p: { a: 0, k: [0, 0] }, s: { a: 0, k: [40, 40] }, r: { a: 0, k: 0 } }, { ty: 'fl', c: { a: 0, k: color }, o: { a: 0, k: 100 } }, { ty: 'tr', p: { a: 0, k: [0, 0] }, a: { a: 0, k: [0, 0] }, s: { a: 0, k: [100, 100] }, r: { a: 0, k: 0 }, o: { a: 0, k: 100 } }] });
const doc = () => ({
  v: '5.12.1', fr: 30, ip: 0, op: 60, w: 200, h: 200,
  slots: {
    fade: { nm: 'Opacity', p: { a: 0, k: 100 } },
    spin: { p: { a: 1, k: [{ t: 0, s: [0], h: 0 }, { t: 30, s: [90] }] } },
    place: { nm: 'Position', p: { a: 0, k: [100, 100] } },
    tint: { p: { a: 0, k: [1, 0, 0] } },
  },
  layers: [
    { ty: 4, nm: 'Badge', ind: 1, ip: 0, op: 60, ks: { o: { a: 0, k: 100, sid: 'fade' }, r: { a: 0, k: 0 }, p: { a: 0, k: [100, 100, 0], sid: 'place' }, a: { a: 0, k: [0, 0, 0] }, s: { a: 0, k: [100, 100, 100] } }, shapes: [rect('box', [1, 0, 0, 1])] },
    { ty: 4, nm: 'Sparkle', ind: 2, ip: 0, op: 60, ks: { o: { a: 0, k: 100 }, r: { a: 1, k: [{ t: 0, s: [0] }, { t: 30, s: [90] }], sid: 'spin' }, p: { a: 0, k: [0, 0, 0] }, a: { a: 0, k: [0, 0, 0] }, s: { a: 0, k: [100, 100, 100] } }, shapes: [rect('dot', [0, 0, 1, 1])] },
    { ty: 3, nm: '', ind: 3, ip: 0, op: 60, ks: {} },
    { ty: 5, nm: 'Title', ind: 4, ip: 0, op: 60, hd: true, ks: {}, t: { d: { k: [{ s: { t: 'Hi', s: 20, f: 'Arial', fc: [0, 0, 0], j: 0, tr: 0, lh: 24, ls: 0 }, t: 0 }] } } },
  ],
});

describe('lottie value slots', () => {
  it('discovers scalar and 2D slots; colours (3 numbers) are not mistaken for vectors; an animated slot reports its first keyframe', () => {
    const s = extractLottieValueSlots(doc());
    expect(s).toEqual([
      { id: 'fade', type: 'scalar', label: 'Opacity', value: 100 },
      { id: 'spin', type: 'scalar', label: 'spin', value: 0 },
      { id: 'place', type: 'vector', label: 'Position', value: [100, 100] },
    ]);
    expect(extractLottieValueSlots({ layers: [] })).toEqual([]);
    expect(extractLottieValueSlots('{not json')).toEqual([]);
    expect(extractLottieValueSlots(JSON.stringify(doc())).length).toBe(3); // a raw JSON string works too
  });

  it('bakes the value into every referencing property (3D position keeps its z), updates the table, and never mutates the input', () => {
    const d = doc(); const before = JSON.stringify(d);
    const out = applyLottieValueOverrides(d, { fade: 35, place: [20, 30], spin: 45 });
    expect(JSON.stringify(d)).toBe(before);
    const badge = out.layers[0].ks; const sparkle = out.layers[1].ks;
    expect(badge.o).toMatchObject({ a: 0, k: 35, sid: 'fade' });
    expect(badge.p.k).toEqual([20, 30, 0]);
    expect(sparkle.r).toMatchObject({ a: 0, k: 45 }); // an animated slot property becomes static at the chosen value
    expect(out.slots.fade.p.k).toBe(35); expect(out.slots.place.p.k).toEqual([20, 30]);
    // untouched properties keep their identity of content
    expect(out.layers[0].ks.r).toEqual(d.layers[0].ks.r);
  });

  it('ignores unknown slots, wrong shapes and non-finite numbers (returns the very same object when nothing applies)', () => {
    const d = doc();
    expect(applyLottieValueOverrides(d, { nope: 3 })).toBe(d);
    expect(applyLottieValueOverrides(d, { fade: [1, 2] as never, place: 5 as never, spin: NaN })).toBe(d);
    expect(applyLottieValueOverrides(d, undefined)).toBe(d);
  });
});

describe('lottie layer visibility', () => {
  it('lists top-level layers with kind and hidden flag, and hides by key', () => {
    const d = doc();
    const l = extractLottieLayers(d);
    expect(l.map((x) => [x.key, x.label, x.kind, x.hidden])).toEqual([['0', 'Badge', 'shape', false], ['1', 'Sparkle', 'shape', false], ['2', 'Layer 3', 'null', false], ['3', 'Title', 'text', true]]);
    const out = applyLottieLayerVisibility(d, ['1']);
    expect(out.layers[1].hd).toBe(true); expect(out.layers[0].hd).toBeUndefined(); expect(d.layers[1]).not.toHaveProperty('hd');
    expect(applyLottieLayerVisibility(d, ['9'])).toBe(d);
    expect(applyLottieLayerVisibility(d, [])).toBe(d);
  });
});

describe('through the shared patcher used by preview and export', () => {
  it('applyLottieEdits applies colours, values and hidden layers together', () => {
    const d = doc();
    const edits = { colors: { c0: '#00ff00' }, values: { fade: 50 }, hidden: ['1'] };
    expect(hasLottieEdits(edits)).toBe(true);
    const out = applyLottieEdits(d, edits) as ReturnType<typeof doc>;
    expect(out.layers[0].ks.o.k).toBe(50);
    expect((out.layers[1] as { hd?: boolean }).hd).toBe(true);
    expect(JSON.stringify(out.layers[0].shapes)).toContain('0,1,0'); // the fill colour c0 became #00ff00 = [0,1,0]
    expect(hasLottieEdits({})).toBe(false);
    expect(applyLottieEdits(d, { hidden: [] })).toBe(d);
  });
});
