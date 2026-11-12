import { describe, it, expect } from 'vitest';
import { fillCss, hasTransform, IDENTITY_TRANSFORM } from '@cinegen/lib/occ/transform';
import { flexCropInsetPatch } from '../../openchatcut/editor/flexCrop';

describe('fit / background fill / crop on the clip transform', () => {
  it('fit and fill count as a transform and fill produces a blur filter', () => {
    expect(hasTransform({ ...IDENTITY_TRANSFORM, fit: 'cover' })).toBe(true);
    expect(hasTransform({ ...IDENTITY_TRANSFORM, fill: 50 })).toBe(true);
    expect(fillCss(IDENTITY_TRANSFORM, 1280, 720)).toBeUndefined();
    const css = fillCss({ ...IDENTITY_TRANSFORM, fill: 50 }, 1280, 720)!;
    expect(css.filter).toMatch(/blur\(\d+px\)/);
    expect(parseFloat(css.transform.replace(/[^0-9.]/g, ''))).toBeGreaterThan(1);
  });
  it('crop edges clamp so a minimum span stays visible', () => {
    const a = flexCropInsetPatch(undefined, 'left', 0.9).crop!;
    expect(a.left).toBeLessThanOrEqual(0.95);
    expect(flexCropInsetPatch(a, 'left', 0).crop).toBeUndefined();
  });
});
