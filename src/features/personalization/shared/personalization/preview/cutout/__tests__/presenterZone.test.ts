import { describe, expect, it } from 'vitest';
import { maskBounds, presenterBounds, presenterZone, unionRects } from '../presenterZone';
import type { Mask } from '../maskMath';

const mask = (w: number, h: number, on: (x: number, y: number) => boolean): Mask => ({
  w, h, data: Uint8ClampedArray.from({ length: w * h }, (_, i) => (on(i % w, Math.floor(i / w)) ? 255 : 0)),
});

describe('maskBounds', () => {
  it('finds the tight box of the presenter pixels', () => {
    const m = mask(10, 10, (x, y) => x >= 2 && x < 6 && y >= 1 && y < 9);
    expect(maskBounds(m)).toEqual({ x: 0.2, y: 0.1, w: 0.4, h: 0.8 });
  });
  it('is null for an empty mask or a few stray pixels', () => {
    expect(maskBounds(mask(10, 10, () => false))).toBeNull();
    expect(maskBounds(mask(10, 10, (x, y) => x === 3 && y === 3))).toBeNull();
  });
  it('ignores faint pixels below the threshold', () => {
    const m = mask(4, 4, () => false);
    m.data.fill(60);
    expect(maskBounds(m)).toBeNull();
  });
});

describe('unionRects / presenterBounds', () => {
  it('unions boxes and skips nulls', () => {
    expect(unionRects([{ x: 0.1, y: 0.2, w: 0.2, h: 0.2 }, null, { x: 0.5, y: 0.1, w: 0.1, h: 0.5 }])).toEqual({ x: 0.1, y: 0.1, w: 0.5, h: 0.5 });
    expect(unionRects([null])).toBeNull();
  });
  it('covers a presenter who moves across the clip', () => {
    const masks = [mask(10, 10, (x) => x < 3), mask(10, 10, (x) => x < 3), mask(10, 10, (x) => x < 3), mask(10, 10, (x) => x >= 7)];
    const b = presenterBounds(masks, 3)!;
    expect(b.x).toBe(0);
    expect(b.x + b.w).toBe(1);
  });
});

describe('presenterZone', () => {
  const none = { x: 0.5, y: 0.5, scale: 1, rotation: 0 };
  const bounds = { x: 0.3, y: 0.1, w: 0.4, h: 0.8 }; // the person inside a portrait source
  it('a portrait source in a landscape frame is centered with side bars (contain), plus the margin', () => {
    const z = presenterZone(bounds, 9 / 16, none, 1920, 1080, { x: 0, top: 0, bottom: 0 });
    // the 9:16 picture is 607.5 px wide centered: left edge at 656.25, the person spans 30%..70% of it
    expect(z.x * 1920).toBeCloseTo(656.25 + 0.3 * 607.5, 1);
    expect(z.w * 1920).toBeCloseTo(0.4 * 607.5, 1);
    expect(z.y * 1080).toBeCloseTo(0.1 * 1080, 1);
    expect(z.h * 1080).toBeCloseTo(0.8 * 1080, 1);
  });
  it('follows the presenter preset: moved left and made smaller', () => {
    const full = presenterZone(bounds, 9 / 16, none, 1920, 1080, { x: 0, top: 0, bottom: 0 });
    const left = presenterZone(bounds, 9 / 16, { x: 0.28, y: 0.55, scale: 0.85, rotation: 0 }, 1920, 1080, { x: 0, top: 0, bottom: 0 });
    expect(left.x + left.w / 2).toBeLessThan(full.x + full.w / 2);
    expect(left.w).toBeCloseTo(full.w * 0.85, 6);
  });
  it('adds the margin, with more head-room above, and stays inside the frame', () => {
    const plain = presenterZone(bounds, 9 / 16, none, 1920, 1080, { x: 0, top: 0, bottom: 0 });
    const padded = presenterZone(bounds, 9 / 16, none, 1920, 1080);
    expect(padded.x).toBeLessThan(plain.x);
    expect(plain.y - padded.y).toBeGreaterThan(padded.y + padded.h - (plain.y + plain.h));
    const big = presenterZone({ x: 0, y: 0, w: 1, h: 1 }, 16 / 9, { x: 0.5, y: 0.5, scale: 2.5, rotation: 0 }, 1920, 1080);
    expect(big.x).toBeGreaterThanOrEqual(0);
    expect(big.x + big.w).toBeLessThanOrEqual(1);
    expect(big.y + big.h).toBeLessThanOrEqual(1);
  });
  it('a quarter turn swaps the box\'s width and height about its center', () => {
    const square = { x: 0.4, y: 0.3, w: 0.2, h: 0.4 };
    const a = presenterZone(square, 16 / 9, none, 1920, 1080, { x: 0, top: 0, bottom: 0 });
    const b = presenterZone(square, 16 / 9, { ...none, rotation: 90 }, 1920, 1080, { x: 0, top: 0, bottom: 0 });
    expect(b.w * 1920).toBeCloseTo(a.h * 1080, 0);
    expect(b.h * 1080).toBeCloseTo(a.w * 1920, 0);
  });
});
