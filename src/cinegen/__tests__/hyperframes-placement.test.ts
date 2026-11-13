// Placement of animations in the frame: one math for the preview, the drag handles and the export.
import { describe, expect, it } from 'vitest';
// @ts-expect-error plain JS
import { hfPlacement, normalizeGeom, defaultFitFor } from '../../lib/hyperframes/placement.js';
import { hyperframesItem, createHyperframesOverlay, hyperframesOverlayLayer } from '../lib/hyperframes/overlay';

describe('hfPlacement', () => {
  it('contain in a 16:9 frame is the old behaviour (fills the frame, no offset)', () => {
    const p = hfPlacement(1920, 1080, 1920, 1080, undefined, 'contain');
    expect([p.left, p.top, p.w, p.h, p.k]).toEqual([0, 0, 1920, 1080, 1]);
  });
  it('contain letterboxes in a vertical frame', () => {
    const p = hfPlacement(1080, 1920, 1920, 1080, undefined, 'contain');
    expect(p.k).toBeCloseTo(0.5625); expect(p.top).toBeCloseTo((1920 - 607.5) / 2);
  });
  it('width-bottom sits on the bottom edge in 16:9, 9:16 and 1:1, exact in 16:9 and enlarged (max 2.2x) in narrower frames', () => {
    for (const [W, H] of [[1920, 1080], [1080, 1920], [1080, 1080]]) {
      const p = hfPlacement(W, H, 1920, 1080, { fit: 'width-bottom' });
      expect(p.left).toBe(0); expect(p.top + p.h).toBeCloseTo(H);
    }
    expect(hfPlacement(1920, 1080, 1920, 1080, { fit: 'width-bottom' }).k).toBe(1);
    const sq = hfPlacement(1080, 1080, 1920, 1080, { fit: 'width-bottom' }).k / (1080 / 1920); expect(sq).toBeGreaterThan(1.4); expect(sq).toBeLessThan(1.7);
    expect(hfPlacement(1080, 1920, 1920, 1080, { fit: 'width-bottom' }).k / (1080 / 1920)).toBeCloseTo(2.2);
  });
  it('scale is about the bottom-left corner for width-bottom and about the centre otherwise', () => {
    const a = hfPlacement(1920, 1080, 1920, 1080, { fit: 'width-bottom', scale: 0.5 });
    expect(a.left).toBe(0); expect(a.top + a.h).toBeCloseTo(1080);
    const b = hfPlacement(1920, 1080, 1920, 1080, { fit: 'contain', scale: 0.5 });
    expect(b.left + b.w / 2).toBeCloseTo(960); expect(b.top + b.h / 2).toBeCloseTo(540);
  });
  it('x / y are percentages of the frame and values are clamped', () => {
    const p = hfPlacement(2000, 1000, 2000, 1000, { x: 10, y: -20, fit: 'contain' });
    expect(p.left).toBeCloseTo(200); expect(p.top).toBeCloseTo(-200);
    expect(normalizeGeom({ scale: 99, x: 1e9, y: 'abc' }, 'contain')).toEqual({ x: 150, y: 0, scale: 4, fit: 'contain' });
    expect(normalizeGeom({ fit: 'nonsense' }, 'cover').fit).toBe('cover');
  });
});

describe('animations in the overlay model', () => {
  it('lower thirds default to width-bottom, other animations to contain', () => {
    expect(defaultFitFor({ id: 'lt-clean-bar' })).toBe('width-bottom');
    expect(defaultFitFor({ id: 'rui:lower-third' })).toBe('width-bottom');
    expect(defaultFitFor({ id: 'bar-chart-race', category: 'data', tags: [] })).toBe('contain');
  });
  it('the layer carries the geometry; an old overlay without one still renders with the default fit', () => {
    const item = hyperframesItem('lt-clean-bar')!;
    const o = createHyperframesOverlay(item, 1);
    expect((hyperframesOverlayLayer(o, 30) as { geom: { fit: string } }).geom.fit).toBe('width-bottom');
    const moved = hyperframesOverlayLayer({ ...o, geom: { x: 5, y: -3, scale: 0.8 } }, 30) as { geom: Record<string, unknown> };
    expect(moved.geom).toMatchObject({ x: 5, y: -3, scale: 0.8, fit: 'width-bottom' });
    const legacy = { ...o }; delete (legacy as Record<string, unknown>).geom;
    expect((hyperframesOverlayLayer(legacy, 30) as { geom: { fit: string } }).geom.fit).toBe('width-bottom');
  });
});
