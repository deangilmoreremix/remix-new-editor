import { describe, it, expect } from 'vitest';
import { splitClip, trimEdge, rollEdit, slipClip, slideClip, setSpeed, setInOut, addMarker, nextMarker, prevMarker, previousTouching, nextTouching } from '../editTools.js';

const T = 100; // 1% = 1 s
const v = (id, left, width, extra = {}) => ({ id, type: 'video', src: `${id}.mp4`, left, width, trimIn: 0, ...extra });

describe('blade (split)', () => {
  it('right half continues from the right source time', () => {
    const [a, b] = splitClip(v('c', 10, 20, { trimIn: 5 }), 18, T);
    expect([a.left, a.width, a.trimIn]).toEqual([10, 8, 5]);
    expect([b.left, b.width, b.trimIn]).toEqual([18, 12, 13]);
  });
  it('accounts for playback speed and splits keyframes', () => {
    const [, b] = splitClip(v('c', 0, 10, { playbackRate: 2, keyframes: { opacity: [{ t: 1, v: 0 }, { t: 6, v: 1 }] } }), 4, T);
    expect(b.trimIn).toBe(8);
    expect(b.keyframes.opacity).toEqual([{ t: 2, v: 1 }]);
  });
  it('refuses to split at the edges', () => {
    expect(splitClip(v('c', 10, 20), 10, T)).toBeNull();
    expect(splitClip(v('c', 10, 20), 40, T)).toBeNull();
  });
});

describe('trim and ripple', () => {
  it('plain trim of the left edge moves the start and the in-point', () => {
    const c = v('c', 10, 20, { trimIn: 3 });
    expect(trimEdge([c], c, 'left', 2, T)).toBe(2);
    expect([c.left, c.width, c.trimIn]).toEqual([12, 18, 5]);
  });
  it('cannot extend before the start of the source', () => {
    const c = v('c', 10, 20, { trimIn: 3 });
    expect(trimEdge([c], c, 'left', -10, T)).toBe(-3);
    expect([c.left, c.trimIn]).toEqual([7, 0]);
  });
  it('cannot extend past the end of the media when its length is known', () => {
    const c = v('c', 0, 10, { trimIn: 2, mediaDuration: 15 });
    expect(trimEdge([c], c, 'right', 10, T)).toBe(3);
  });
  it('ripple keeps the clip start and pulls later clips', () => {
    const a = v('a', 0, 10);
    const b = v('b', 10, 10);
    trimEdge([a, b], a, 'left', 4, T, { ripple: true });
    expect([a.left, a.width, a.trimIn]).toEqual([0, 6, 4]);
    expect(b.left).toBe(6);
    trimEdge([a, b], a, 'right', 2, T, { ripple: true });
    expect([a.width, b.left]).toEqual([8, 8]);
  });
  it('images are not limited by an in-point', () => {
    const img = { id: 'i', type: 'image', left: 10, width: 5 };
    expect(trimEdge([img], img, 'left', -4, T)).toBe(-4);
  });
});

describe('roll, slip, slide', () => {
  it('roll moves the cut between touching clips', () => {
    const a = v('a', 0, 10);
    const b = v('b', 10, 10, { trimIn: 1 });
    expect(nextTouching([a, b], a)).toBe(b);
    expect(previousTouching([a, b], b)).toBe(a);
    expect(rollEdit([a, b], a, 'right', 3, T)).toBe(3);
    expect([a.width, b.left, b.width, b.trimIn]).toEqual([13, 13, 7, 4]);
    expect(rollEdit([a, b], b, 'left', -5, T)).toBe(-4); // b can only go back to its source start
    expect([a.width, b.left, b.trimIn]).toEqual([9, 9, 0]);
  });
  it('roll does nothing without a touching neighbour', () => {
    const a = v('a', 0, 10);
    expect(rollEdit([a], a, 'right', 3, T)).toBe(0);
  });
  it('slip changes the source range only', () => {
    const c = v('c', 10, 10, { trimIn: 5, mediaDuration: 20 });
    slipClip(c, -3, T);
    expect([c.left, c.width, c.trimIn]).toEqual([10, 10, 8]);
    slipClip(c, -50, T);
    expect(c.trimIn).toBe(10); // media 20 s - 10 s shown
    slipClip(c, 50, T);
    expect(c.trimIn).toBe(0);
  });
  it('slide moves a clip between neighbours keeping total length', () => {
    const a = v('a', 0, 10);
    const b = v('b', 10, 10);
    const c = v('c', 20, 10);
    expect(slideClip([a, b, c], b, 3, T)).toBe(3);
    expect([a.width, b.left, c.left, c.width, c.trimIn]).toEqual([13, 13, 23, 7, 3]);
  });
});

describe('speed, source in/out, markers', () => {
  it('speed keeps the same source range', () => {
    const c = v('c', 0, 10, { speed: 1 });
    expect(setSpeed(c, 2)).toBe(2);
    expect([c.width, c.playbackRate, c.speed]).toEqual([5, 2, undefined]);
    expect(setSpeed(c, 99)).toBe(4);
  });
  it('in/out sets trim and length', () => {
    const c = setInOut(v('c', 5, 1, { playbackRate: 2 }), 4, 10, T);
    expect([c.left, c.trimIn, c.width]).toEqual([5, 4, 3]);
  });
  it('markers stay sorted and navigable', () => {
    let m = addMarker([], 5);
    m = addMarker(m, 2, 'intro');
    m = addMarker(m, 5.01);
    expect(m.map((x) => x.t)).toEqual([2, 5.01]);
    expect(nextMarker(m, 2).t).toBe(5.01);
    expect(prevMarker(m, 5.01).t).toBe(2);
    expect(nextMarker(m, 9)).toBeNull();
  });
});
