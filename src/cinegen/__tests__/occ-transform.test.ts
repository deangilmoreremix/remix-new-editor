// [remix] Clip transform + tracked path (cinegen/lib/occ/transform.ts) fed by OpenChatCut tracker points.
import { describe, it, expect } from 'vitest';
import { clipTransformCss, hasTransform, pathOffsetAt, transformFromTrack, IDENTITY_TRANSFORM } from '@cinegen/lib/occ/transform';
import { clipToRow, clipFromRow } from '@cinegen/lib/db-converters';

describe('clip transform', () => {
  it('identity has no css; base values map to translate/rotate/scale', () => {
    expect(hasTransform(IDENTITY_TRANSFORM)).toBe(false);
    expect(clipTransformCss(IDENTITY_TRANSFORM, 0)).toBeUndefined();
    expect(clipTransformCss({ x: 10, y: -5, scale: 1.5, rotation: 12 }, 0)).toBe('translate(10%, -5%) rotate(12deg) scale(1.5)');
  });
  it('pins a tracked subject to the centre and grows scale to hide the edges', () => {
    const pts = [0, 10, 20].map((frame, i) => ({ frame, x: 0.5 + i * 0.1, y: 0.5, confidence: 1 }));
    const tr = transformFromTrack(pts, 30);
    expect(tr.path).toHaveLength(3);
    expect(tr.path![0]).toMatchObject({ t: 0, x: 0, y: 0 });
    expect(tr.path![2].x).toBeCloseTo(-20, 5);          // subject moved right 20% → frame moves left 20% to keep it centred
    expect(tr.scale).toBeGreaterThan(1.3);
    expect(pathOffsetAt(tr.path, 10 / 30 / 2).x).toBeCloseTo(-5, 5); // interpolated between keys
    expect(clipTransformCss(tr, 20 / 30)).toMatch(/translate\(-(19\.9|20)/);
  });
  it('persists through the project row converters', () => {
    const clip: any = { id: 'c', assetId: 'a', trackId: 't', name: 'n', startTime: 0, duration: 5, trimStart: 0, trimEnd: 0, speed: 1, opacity: 1, volume: 1, flipH: false, flipV: false, keyframes: [], transform: { x: 3, y: 4, scale: 1.2, rotation: 5, path: [{ t: 0, x: 1, y: 2 }] } };
    const back = clipFromRow(clipToRow(clip, 'tl', 0) as never);
    expect(back.transform).toEqual(clip.transform);
  });
});

import { placeInSlot, layoutSlots } from '../../openchatcut/editor/layouts';
import { clipTransformClipPath } from '@cinegen/lib/occ/transform';
describe('layouts', () => {
  it('2-up fill: each slot gets a half-width crop and an offset toward its half', () => {
    const [l, r] = Object.values(layoutSlots('2up-horizontal')).map((s) => placeInSlot(s, 'cover'));
    expect(l.crop).toBeTruthy(); expect(r.crop).toBeTruthy();
    expect((l.x ?? 0)).toBeLessThan(0); expect((r.x ?? 0)).toBeGreaterThan(0);
    expect(clipTransformClipPath({ x: 0, y: 0, scale: 1, rotation: 0, crop: l.crop })).toMatch(/^inset\(/);
  });
});

import { transformValuesAt, upsertKey } from '@cinegen/lib/occ/transform';
describe('transform keyframes', () => {
  it('interpolates between keys and replaces a key at the same time', () => {
    let t = upsertKey(IDENTITY_TRANSFORM, 0, { x: 0, y: 0, scale: 1, rotation: 0 });
    t = upsertKey(t, 2, { x: 20, y: -10, scale: 2, rotation: 90 });
    expect(transformValuesAt(t, 1)).toEqual({ x: 10, y: -5, scale: 1.5, rotation: 45 });
    expect(transformValuesAt(t, 5).scale).toBe(2);
    t = upsertKey(t, 2, { x: 0, y: 0, scale: 1, rotation: 0 });
    expect(t.keys).toHaveLength(2);
    expect(clipTransformCss(t, 1)).toContain('scale(1)');
  });
});
