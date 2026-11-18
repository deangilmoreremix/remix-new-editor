import { describe, it, expect } from 'vitest';
import { cursorStops, cursorAt } from '../remotion/websiteCursor.js';
import { timelineToComposition } from '../remotion/timelineToComposition.js';

describe('pointer over a website background', () => {
  it('is the same for the same clip, and keeps clear of the camera bubble corner', () => {
    expect(cursorStops('clip-1')).toEqual(cursorStops('clip-1'));
    expect(cursorStops('clip-1')).not.toEqual(cursorStops('clip-2'));
    for (const [x, y] of cursorStops('clip-1')) { expect(x).toBeGreaterThanOrEqual(0.38); expect(y).toBeLessThanOrEqual(0.72); }
  });

  it('glides between stops and clicks when it arrives', () => {
    const stops = [[0.4, 0.2], [0.8, 0.6], [0.5, 0.5]];
    expect(cursorAt(0, stops)).toEqual({ x: 0.4, y: 0.2, click: 0 });
    const arrived = cursorAt(2.4 * 0.6, stops);
    expect(arrived.x).toBeCloseTo(0.8);
    expect(arrived.click).toBeGreaterThan(0);
  });

  it('the composition passes cursor through for image clips', () => {
    const m = timelineToComposition({ timelineSeconds: 5, tracks: [{ id: 't', type: 'video', items: [{ id: 'i', type: 'image', src: 'https://x/a.jpg', scroll: true, cursor: true, left: 0, width: 100 }] }] });
    expect(m.layers.find((l) => l.kind === 'image')).toMatchObject({ scroll: true, cursor: true });
  });
});
