// Fix A (2): addTransition / removeTransition are exact inverses (B, later clips on its track and the audio linked to them move together).
import { describe, it, expect } from 'vitest';
import { createDefaultTimeline, addClipToTrack } from '@cinegen/lib/editor/timeline-operations';
import { addGlTransition, removeTransition } from '@cinegen/lib/occ/transitions';
import { clipEndTime, type Timeline } from '@cinegen/types/timeline';
import type { Asset } from '@cinegen/types/project';

const asset = (id: string): Asset => ({ id, name: id, type: 'video', url: `https://x.test/${id}.mp4`, duration: 10, createdAt: '2026-01-01' });
const T = (tl: Timeline, n: string) => tl.tracks.find((t) => t.name === n)!.id;
const clone = <X,>(x: X): X => JSON.parse(JSON.stringify(x));

/** V1: A 0-3, B 3-6, C 6-9 (each with synced linked audio and 2 s spare source on both sides so handles exist). */
function chain() {
  let tl = createDefaultTimeline('t');
  for (const [i, id] of ['A', 'B', 'C'].entries()) tl = addClipToTrack(tl, T(tl, 'V1'), asset(id), i * 3);
  tl = { ...tl, duration: 9, clips: tl.clips.map((c) => ({ ...c, trimStart: 2, trimEnd: 5, duration: 10 })) };
  const v = (id: string) => tl.clips.find((c) => c.assetId === id && c.trackId === T(tl, 'V1'))!;
  return { tl, a: v('A'), b: v('B'), c: v('C') };
}
const starts = (tl: Timeline) => Object.fromEntries(tl.clips.map((c) => [c.id, c.startTime]));
const get = (tl: Timeline, id: string) => tl.clips.find((c) => c.id === id)!;

describe('Fix A: removeTransition is the inverse of addTransition', () => {
  it('add then remove returns to the original timeline exactly (picture + linked audio)', () => {
    const { tl, a, b } = chain();
    const withTr = addGlTransition(tl, a, b, 'cross-dissolve', 0.5);
    expect(get(withTr, b.id).startTime).toBeCloseTo(2.5, 9);
    const bAud = withTr.clips.find((c) => c.assetId === 'B' && c.trackId !== b.trackId)!;
    expect(bAud.startTime).toBeCloseTo(2.5, 9);
    const back = removeTransition(withTr, withTr.transitions[0].id);
    expect(back.transitions).toHaveLength(0);
    expect(starts(back)).toEqual(starts(tl));
    expect(back.duration).toBeCloseTo(tl.duration, 9);
    expect(back).toEqual(tl);
  });

  it('ripples across multiple clips: a chain A-B-C with two transitions keeps C overlap, removing either restores positions', () => {
    const { tl, a, b, c } = chain();
    let t1 = addGlTransition(tl, a, b, 'cross-dissolve', 0.5);
    t1 = addGlTransition(t1, get(t1, b.id), get(t1, c.id), 'glt-pixelize', 0.4);
    // C was ripple-moved by the first add (0.5) and the second (0.4): 6 - 0.9
    expect(get(t1, c.id).startTime).toBeCloseTo(5.1, 9);
    expect(clipEndTime(get(t1, b.id)) - get(t1, c.id).startTime).toBeCloseTo(0.4, 9); // B-C overlap is exactly the second transition
    const idAB = t1.transitions.find((t) => t.clipAId === a.id)!.id;
    const idBC = t1.transitions.find((t) => t.clipAId === b.id)!.id;
    // remove the FIRST: B and C shift back by 0.5, the B-C overlap is unchanged
    const noAB = removeTransition(t1, idAB);
    expect(get(noAB, b.id).startTime).toBeCloseTo(3, 9);
    expect(get(noAB, c.id).startTime).toBeCloseTo(5.6, 9);
    expect(clipEndTime(get(noAB, b.id)) - get(noAB, c.id).startTime).toBeCloseTo(0.4, 9);
    // then the second: back to the original
    expect(starts(removeTransition(noAB, idBC))).toEqual(starts(tl));
    // opposite order
    const noBC = removeTransition(t1, idBC);
    expect(starts(removeTransition(noBC, idAB))).toEqual(starts(tl));
    // linked audio of C stayed in sync with C at every step
    for (const x of [t1, noAB, noBC]) {
      const cAud = x.clips.find((k) => k.assetId === 'C' && k.trackId !== get(x, c.id).trackId)!;
      expect(cAud.startTime).toBeCloseTo(get(x, c.id).startTime, 9);
    }
  });

  it('a slipped linked audio keeps its offset through add and remove', () => {
    const { tl, a, b } = chain();
    const bAud = tl.clips.find((c) => c.assetId === 'B' && c.trackId !== b.trackId)!;
    const slipped = { ...tl, clips: tl.clips.map((c) => (c.id === bAud.id ? { ...c, startTime: c.startTime + 0.2 } : c)) };
    const added = addGlTransition(slipped, a, b, 'cross-dissolve', 1);
    expect(get(added, bAud.id).startTime).toBeCloseTo(3.2, 9);
    const back = removeTransition(added, added.transitions[0].id);
    expect(starts(back)).toEqual(starts(slipped));
  });

  it('undo / redo of add and remove through snapshots reproduces the same states', () => {
    const { tl, a, b } = chain();
    const hist = [clone(tl)];
    const t1 = addGlTransition(tl, a, b, 'cross-dissolve', 0.5); hist.push(clone(t1));
    const t2 = removeTransition(t1, t1.transitions[0].id); hist.push(clone(t2));
    expect(hist[2]).toEqual(hist[0]);
    // undo twice = hist[0]; redo = replaying the same ops on the restored snapshots gives the same results
    const redo1 = addGlTransition(clone(hist[0]), get(hist[0], a.id), get(hist[0], b.id), 'cross-dissolve', 0.5);
    expect(redo1).toEqual(hist[1]);
    expect(removeTransition(clone(hist[1]), hist[1].transitions[0].id)).toEqual(hist[2]);
  });

  it('removing a transition whose clips no longer overlap does not move anything', () => {
    const { tl, a, b } = chain();
    const withTr = addGlTransition(tl, a, b, 'cross-dissolve', 0.5);
    const apart = { ...withTr, clips: withTr.clips.map((c) => (c.id === b.id ? { ...c, startTime: 4 } : c)) };
    expect(starts(removeTransition(apart, apart.transitions[0].id))).toEqual(starts(apart));
  });
});
