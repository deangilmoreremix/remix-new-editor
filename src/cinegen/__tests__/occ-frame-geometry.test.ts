import { describe, it, expect } from 'vitest';
import { resolveFit, LEGACY_FIT, NEW_TIMELINE_FIT, frameFor, aspectRatio, resolveGeometry } from '@cinegen/lib/occ/frame-geometry';
import { frameForAspect } from '../../lib/editor/remotion/timelineToComposition.js';

describe('shared frame geometry', () => {
  it('uses one fit fallback and lets clip, then project, override it', () => {
    expect(resolveFit({}, undefined)).toBe('cover');
    expect(resolveFit({}, {})).toBe(LEGACY_FIT);
    expect(NEW_TIMELINE_FIT).toBe('contain');
    expect(resolveFit({}, { fit: 'contain' })).toBe('contain');
    expect(resolveFit({ transform: { fit: 'contain' } }, { fit: 'cover' })).toBe('contain');
  });
  it('preview frame matches the export frame for every project aspect', () => {
    for (const a of ['16:9', '9:16', '1:1', '4:5', '21:9']) {
      const e = frameForAspect('720p', a);
      expect(frameFor(a, 720)).toEqual({ width: e.width, height: e.height });
    }
    expect(aspectRatio(undefined)).toBeCloseTo(16 / 9);
  });
  it('resolves rect, transform, crop and fill together', () => {
    const g = resolveGeometry({ transform: { x: 10, y: 0, scale: 1, rotation: 0, fill: 50, crop: { left: 0.1, top: 0, right: 0, bottom: 0 } } }, undefined, 0, { width: 1080, height: 1920 }, { width: 1920, height: 1080 });
    expect(g.fit).toBe('cover');
    expect(g.rect.height).toBe(1920);
    expect(g.transform).toContain('translate(10%');
    expect(g.clipPath).toContain('inset(');
    expect(g.fill?.filter).toMatch(/blur\(/);
  });
});
