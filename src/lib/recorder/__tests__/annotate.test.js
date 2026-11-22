import { describe, it, expect } from 'vitest';
import { markOpacity, drawMarks, pointOnPicture, FADE_AFTER_MS, FADE_MS } from '../annotate.js';
import { spotlightAmount, bubbleBox, WIDTH, HEIGHT } from '../composeBoth.jsx';

const fakeCtx = () => {
  const calls = [];
  return { calls, ctx: new Proxy({}, { get: (t, k) => (k in t ? t[k] : (...a) => calls.push([k, ...a])), set: (t, k, v) => { t[k] = v; calls.push([`set:${String(k)}`, v]); return true; } }) };
};

describe('drawing on screen', () => {
  it('marks stay while drawn, then fade out after a few seconds unless held', () => {
    expect(markOpacity({ endedAt: null }, 99999)).toBe(1);
    expect(markOpacity({ endedAt: 0 }, FADE_AFTER_MS)).toBe(1);
    expect(markOpacity({ endedAt: 0 }, FADE_AFTER_MS + FADE_MS / 2)).toBeCloseTo(0.5);
    expect(markOpacity({ endedAt: 0 }, FADE_AFTER_MS + FADE_MS)).toBe(0);
    expect(markOpacity({ endedAt: 0, hold: true }, 1e9)).toBe(1);
  });

  it('draws pen paths, boxes and arrows (with a head) in picture pixels', () => {
    const { ctx, calls } = fakeCtx();
    drawMarks(ctx, [
      { tool: 'pen', color: '#f00', points: [[0, 0], [0.5, 0.5], [1, 1]], endedAt: null },
      { tool: 'box', color: '#ff0', points: [[0.5, 0.5], [0.25, 0.25]], endedAt: null },
      { tool: 'arrow', color: '#0f0', points: [[0, 0], [1, 0]], endedAt: null },
    ], 200, 100, 0);
    expect(calls.filter(([k]) => k === 'lineTo').slice(0, 2)).toEqual([['lineTo', 100, 50], ['lineTo', 200, 100]]);
    expect(calls).toContainEqual(['rect', 50, 25, 50, 25]);
    expect(calls.filter(([k]) => k === 'fill')).toHaveLength(1); // the arrow head
  });

  it('maps a pointer to the letterboxed screen picture', () => {
    const rect = { left: 0, top: 0, width: 400, height: 400 }; // a 16:9 picture letterboxed in a square
    expect(pointOnPicture(200, 200, rect, 1600, 900)).toEqual([0.5, 0.5]);
    expect(pointOnPicture(200, 10, rect, 1600, 900)).toBeNull(); // in the black bar
  });
});

describe('camera spotlight', () => {
  it('grows the bubble while held, with a short ease in and out', () => {
    const spots = [{ start: 2, end: 5 }];
    expect(spotlightAmount(0, spots)).toBe(0);
    expect(spotlightAmount(3, spots)).toBe(1);
    expect(spotlightAmount(2 - 0.175, spots)).toBeCloseTo(0.5);
    expect(spotlightAmount(6, spots)).toBe(0);
    expect(spotlightAmount(10, [{ start: 9, end: null }])).toBe(1);
  });

  it('moves the bubble from the corner to a large centred circle', () => {
    const small = bubbleBox(0); const big = bubbleBox(1);
    expect(small.size).toBe(Math.round(WIDTH * 0.2));
    expect(big.size).toBe(Math.round(HEIGHT * 0.72));
    expect(big.left).toBe(Math.round((WIDTH - big.size) / 2));
    expect(big.bottom).toBe(Math.round((HEIGHT - big.size) / 2));
  });
});
