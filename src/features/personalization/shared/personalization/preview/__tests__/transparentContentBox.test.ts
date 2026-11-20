import { describe, expect, it } from 'vitest';
import { transparentContentBox } from '../imagePixels';

/** w×h RGBA, transparent except the given opaque rect [x0,y0,x1,y1) in pixels. */
function img(w: number, h: number, rect?: [number, number, number, number]) {
  const d = new Uint8ClampedArray(w * h * 4);
  if (rect) for (let y = rect[1]; y < rect[3]; y++) for (let x = rect[0]; x < rect[2]; x++) { const o = (y * w + x) * 4; d[o] = 255; d[o + 3] = 255; }
  return d;
}

describe('transparentContentBox', () => {
  it('finds a centred logo with padding on all sides and adds a small margin', () => {
    const box = transparentContentBox(img(100, 100, [30, 40, 70, 60]), 100, 100)!;
    expect(box).not.toBeNull();
    expect(box.x).toBeLessThan(0.3); expect(box.x).toBeGreaterThan(0.2);
    expect(box.y).toBeLessThan(0.4); expect(box.y).toBeGreaterThan(0.3);
    expect(box.x + box.w).toBeGreaterThan(0.7); expect(box.x + box.w).toBeLessThan(0.8);
    expect(box.w * box.h).toBeLessThan(0.5);
  });
  it('handles off-centre content and clamps the margin to the image', () => {
    const box = transparentContentBox(img(100, 100, [0, 0, 40, 30]), 100, 100)!;
    expect(box.x).toBe(0); expect(box.y).toBe(0);
    expect(box.x + box.w).toBeLessThanOrEqual(1);
  });
  it('returns null for a fully transparent image', () => {
    expect(transparentContentBox(img(50, 50), 50, 50)).toBeNull();
  });
  it('returns null when the image is fully opaque (nothing to trim)', () => {
    expect(transparentContentBox(img(50, 50, [0, 0, 50, 50]), 50, 50)).toBeNull();
  });
  it('returns null when less than ~10% would be removed', () => {
    expect(transparentContentBox(img(100, 100, [2, 2, 98, 98]), 100, 100)).toBeNull();
  });
  it('returns null for a speck (content under 8% of a dimension)', () => {
    expect(transparentContentBox(img(100, 100, [50, 50, 53, 53]), 100, 100)).toBeNull();
  });
  it('ignores faint anti-alias fringe below the alpha threshold', () => {
    const d = img(100, 100, [30, 40, 70, 60]);
    d[(5 * 100 + 5) * 4 + 3] = 8; // a nearly-invisible stray pixel far from the content
    const box = transparentContentBox(d, 100, 100)!;
    expect(box.x).toBeGreaterThan(0.2);
  });
  it('is safe on tiny or short buffers', () => {
    expect(transparentContentBox(new Uint8ClampedArray(4), 1, 1)).toBeNull();
    expect(transparentContentBox(new Uint8ClampedArray(10), 100, 100)).toBeNull();
  });
});
