import { describe, expect, it } from 'vitest';
import { peaksFromSamples } from '../waveform';

describe('peaksFromSamples', () => {
  it('takes the loudest sample per bucket, normalized so the loudest bucket is 1', () => {
    const s = Float32Array.from([0.1, -0.2, 0.4, -0.8, 0.05, 0.05, 0.3, -0.1]);
    const p = peaksFromSamples(s, 4);
    expect(p).toHaveLength(4);
    expect(p[1]).toBe(1);
    expect(p[0]).toBeCloseTo(0.25, 6);
    expect(p[2]).toBeCloseTo(0.0625, 6);
    expect(p[3]).toBeCloseTo(0.375, 6);
  });
  it('is all zeros for silence and for no samples', () => {
    expect(peaksFromSamples(new Float32Array(100), 5)).toEqual([0, 0, 0, 0, 0]);
    expect(peaksFromSamples(new Float32Array(0), 3)).toEqual([0, 0, 0]);
  });
  it('handles fewer samples than buckets', () => {
    const p = peaksFromSamples(Float32Array.from([0.5, 1]), 5);
    expect(p).toHaveLength(5);
    expect(Math.max(...p)).toBe(1);
  });
});
