// [remix] The editor preview stacks overlays and Studio designs in the order the published video and the MP4 draw them.
import { describe, it, expect } from 'vitest';
import { overlayPaintRanks, designsBelowSandbox } from '@cinegen/lib/overlays/overlays';

describe('overlayPaintRanks', () => {
  it('ranks by start time, later on top, like the composition does for the overlay track', () => {
    const r = overlayPaintRanks([{ id: 'a', start: 5 }, { id: 'b', start: 1 }, { id: 'c', start: 3 }]);
    expect([r.get('b'), r.get('c'), r.get('a')]).toEqual([0, 1, 2]);
  });

  it('keeps the list order when two overlays start together', () => {
    const r = overlayPaintRanks([{ id: 'x', start: 2 }, { id: 'y', start: 2 }, { id: 'z', start: 2 }]);
    expect([r.get('x'), r.get('y'), r.get('z')]).toEqual([0, 1, 2]);
  });

  it('accepts numeric ids and an empty list', () => {
    expect(overlayPaintRanks([]).size).toBe(0);
    expect(overlayPaintRanks([{ id: 7, start: 0 }]).get('7')).toBe(0);
  });
});

describe('designsBelowSandbox', () => {
  const ov = (id: string, type: string, start: number) => ({ id, type, start });
  it('keeps only designs that start before every sandboxed animation under the animation frame', () => {
    const list = [ov('d1', 'overlay-studio-design', 0), ov('hf', 'hyperframes', 2), ov('d2', 'overlay-studio-design', 4), ov('mg', 'mg-template', 6)];
    expect([...designsBelowSandbox(list, overlayPaintRanks(list))]).toEqual(['d1']);
  });
  it('is empty without animations, so every design is stacked with the overlays', () => {
    const list = [ov('d1', 'overlay-studio-design', 0), ov('t', 'overlay-text', 1)];
    expect(designsBelowSandbox(list, overlayPaintRanks(list)).size).toBe(0);
  });
});
