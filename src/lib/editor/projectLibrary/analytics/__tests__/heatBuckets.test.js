import { describe, it, expect } from 'vitest';
import { heatBuckets, heatBarHeight } from '../heatBuckets.js';

const curve = [0, 25, 50, 75, 100].map((p, i) => ({ positionPercent: p, retentionPercent: [100, 80, 60, 40, 20][i] }));

describe('heatBuckets', () => {
  it('returns one value per slice, taken from the nearest measured point', () => {
    const b = heatBuckets(curve, 5);
    expect(b).toEqual([100, 80, 60, 40, 20]);
  });

  it('defaults to 34 slices, starting and ending on the first and last point', () => {
    const b = heatBuckets(curve);
    expect(b).toHaveLength(34);
    expect(b[0]).toBe(100);
    expect(b[33]).toBe(20);
  });

  it('never invents values: every slice is one of the measured values', () => {
    const allowed = new Set(curve.map((p) => p.retentionPercent));
    heatBuckets(curve, 34).forEach((v) => expect(allowed.has(v)).toBe(true));
  });

  it('gives an empty list when there is no data or the count is invalid', () => {
    expect(heatBuckets([], 34)).toEqual([]);
    expect(heatBuckets(null, 34)).toEqual([]);
    expect(heatBuckets(undefined)).toEqual([]);
    expect(heatBuckets(curve, 0)).toEqual([]);
    expect(heatBuckets(curve, 2.5)).toEqual([]);
  });

  it('handles a single point and a single slice', () => {
    expect(heatBuckets([{ positionPercent: 0, retentionPercent: 77 }], 3)).toEqual([77, 77, 77]);
    expect(heatBuckets(curve, 1)).toEqual([100]);
  });

  it('matches the original Engagement-tab bucketing exactly', () => {
    // The previous inline code: nearest point by |position - i/33*100|, first wins ties.
    const original = Array.from({ length: 34 }, (_, i) => {
      const pos = (i / 33) * 100;
      return curve.reduce((best, p) => (Math.abs(p.positionPercent - pos) < Math.abs(best.positionPercent - pos) ? p : best), curve[0]).retentionPercent;
    });
    expect(heatBuckets(curve, 34)).toEqual(original);
  });
});

describe('heatBarHeight', () => {
  it('clamps to 7..100 and treats junk as zero', () => {
    expect(heatBarHeight(0)).toBe(7);
    expect(heatBarHeight(3)).toBe(7);
    expect(heatBarHeight(55)).toBe(55);
    expect(heatBarHeight(140)).toBe(100);
    expect(heatBarHeight('x')).toBe(7);
    expect(heatBarHeight(undefined)).toBe(7);
  });
});
