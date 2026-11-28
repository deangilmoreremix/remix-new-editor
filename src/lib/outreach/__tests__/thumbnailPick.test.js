import { describe, it, expect } from 'vitest';
import { frameStats, scoreFrame, rankFrames, sampleTimes } from '../thumbnailPick.js';

const img = (w, h, fn) => { const data = new Uint8ClampedArray(w * h * 4); for (let y = 0; y < h; y += 1) for (let x = 0; x < w; x += 1) { const v = fn(x, y); const i = (y * w + x) * 4; data[i] = v; data[i + 1] = v; data[i + 2] = v; data[i + 3] = 255; } return { data, width: w, height: h }; };
const flat = (v) => img(32, 32, () => v);
const checker = (lo, hi) => img(32, 32, (x, y) => ((x + y) % 2 ? hi : lo));

describe('frame statistics', () => {
  it('a sharp pattern has far more sharpness than a flat frame', () => {
    expect(frameStats(checker(40, 200)).sharpness).toBeGreaterThan(1000);
    expect(frameStats(flat(120)).sharpness).toBe(0);
  });
  it('reports brightness and contrast', () => {
    expect(frameStats(flat(200)).brightness).toBeCloseTo(200, 0);
    expect(frameStats(checker(0, 200)).contrast).toBeGreaterThan(90);
  });
  it('handles an empty frame', () => { expect(frameStats(null)).toEqual({ sharpness: 0, brightness: 0, contrast: 0 }); });
});

describe('frame ranking', () => {
  it('prefers a sharp, well lit, contrasty frame over dark or flat ones', () => {
    const ranked = rankFrames([
      { time: 1, image: flat(10) },
      { time: 2, image: checker(60, 180) },
      { time: 3, image: flat(250) },
    ]);
    expect(ranked[0].time).toBe(2);
    expect(ranked[0].reasons).toContain('sharp');
    expect(ranked.find((r) => r.time === 1).reasons).toContain('too dark');
    expect(ranked.find((r) => r.time === 3).reasons).toContain('too bright');
    expect(ranked.every((r) => r.score >= 0 && r.score <= 100)).toBe(true);
  });
  it('breaks ties by the earlier time', () => {
    expect(rankFrames([{ time: 5, image: flat(120) }, { time: 2, image: flat(120) }]).map((r) => r.time)).toEqual([2, 5]);
  });
  it('samples evenly and skips the very start and end', () => {
    const t = sampleTimes(100, 5);
    expect(t[0]).toBe(5); expect(t[4]).toBe(95); expect(t).toHaveLength(5);
    expect(sampleTimes(0)).toEqual([0]);
    expect(sampleTimes(10, 1)).toEqual([5]);
  });
});
