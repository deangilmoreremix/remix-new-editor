import { describe, it, expect } from 'vitest';
import { computeScopes } from '../colorScopes.js';

const solid = (w, h, [r, g, b]) => { const d = new Uint8ClampedArray(w * h * 4); for (let i = 0; i < w * h; i += 1) d.set([r, g, b, 255], i * 4); return d; };

describe('computeScopes', () => {
  it('puts a pure red frame in the top red bin, with nothing in green/blue', () => {
    const s = computeScopes(solid(20, 10, [255, 0, 0]), 20, 10);
    expect(s.histogram.r[255]).toBe(200);
    expect(s.histogram.g[0]).toBe(200);
    expect(s.histogram.b[0]).toBe(200);
    expect(s.pixels).toBe(200);
    expect(s.histogram.luma[Math.round(0.2126 * 255)]).toBe(200);
  });
  it('shows grey as a single point at the centre of the vectorscope', () => {
    const s = computeScopes(solid(8, 8, [128, 128, 128]), 8, 8);
    const centre = Math.round(0.5 * 127);
    const total = s.vectorscope.data.reduce((a, b) => a + b, 0);
    expect(total).toBe(64);
    expect(s.vectorscope.data[centre * 128 + centre] + s.vectorscope.data[64 * 128 + 64]).toBeGreaterThan(0);
  });
  it('keeps a bright left half and dark right half in different waveform columns', () => {
    const w = 20, h = 4; const d = new Uint8ClampedArray(w * h * 4);
    for (let y = 0; y < h; y += 1) for (let x = 0; x < w; x += 1) d.set(x < 10 ? [255, 255, 255, 255] : [0, 0, 0, 255], (y * w + x) * 4);
    const s = computeScopes(d, w, h, { waveformColumns: 2 });
    expect(s.waveform.data[0 * 256 + 255]).toBe(40);
    expect(s.waveform.data[1 * 256 + 0]).toBe(40);
    expect(s.stats.meanLuma).toBeCloseTo(127.5, 0);
  });
  it('RGB parade keeps R, G and B in separate bands (pure red = only the red band at the top level)', () => {
    const s = computeScopes(solid(30, 6, [255, 0, 0]), 30, 6, { waveformColumns: 6 });
    const { columns: pc, data } = s.parade;
    expect(pc).toBe(2);
    const total = (ch, level) => { let n = 0; for (let c = 0; c < pc; c += 1) n += data[ch * pc * 256 + c * 256 + level]; return n; };
    expect(total(0, 255)).toBe(180);
    expect(total(1, 0)).toBe(180);
    expect(total(2, 0)).toBe(180);
    expect(total(1, 255) + total(2, 255)).toBe(0);
  });
  it('RGB parade columns follow x position (bright left / dark right)', () => {
    const w = 20, h = 2; const d = new Uint8ClampedArray(w * h * 4);
    for (let y = 0; y < h; y += 1) for (let x = 0; x < w; x += 1) d.set(x < 10 ? [255, 255, 255, 255] : [0, 0, 0, 255], (y * w + x) * 4);
    const s = computeScopes(d, w, h, { waveformColumns: 6 });
    expect(s.parade.data[0 * 256 + 255]).toBe(20);
    expect(s.parade.data[1 * 256 + 0]).toBe(20);
  });
});
