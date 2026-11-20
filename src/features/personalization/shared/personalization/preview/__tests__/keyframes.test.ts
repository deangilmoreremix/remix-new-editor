import { describe, expect, it } from 'vitest';
import {
  KEYFRAME_PRESETS, MAX_KEYFRAMES, NEUTRAL_KEYFRAME_STATE, isNeutralKeyframeState, keyframeStateFor, keyframeTransformParts, moveKeyframe,
  normalizeKeyframes, removeKeyframe, snapshotKeyframe, upsertKeyframe, type LayerKeyframe,
} from '../keyframes';

const k = (frame: number, patch: Partial<LayerKeyframe> = {}): LayerKeyframe => ({ frame, easing: 'linear', ...patch });

describe('keyframeStateFor', () => {
  it('is neutral with no keyframes', () => {
    expect(keyframeStateFor(undefined, 10)).toEqual(NEUTRAL_KEYFRAME_STATE);
    expect(keyframeStateFor([], 10)).toEqual(NEUTRAL_KEYFRAME_STATE);
    expect(isNeutralKeyframeState(keyframeStateFor(undefined, 0))).toBe(true);
  });
  it('holds the first value before and the last value after', () => {
    const list = [k(10, { dx: 0.1 }), k(20, { dx: 0.3 })];
    expect(keyframeStateFor(list, 0).dx).toBe(0.1);
    expect(keyframeStateFor(list, 99).dx).toBe(0.3);
  });
  it('interpolates linearly between keyframes', () => {
    const list = [k(0, { scale: 1 }), k(10, { scale: 2 })];
    expect(keyframeStateFor(list, 5).scale).toBeCloseTo(1.5, 6);
    expect(keyframeStateFor(list, 2.5).scale).toBeCloseTo(1.25, 6);
  });
  it('eases: in is slower at the start, out is faster', () => {
    const base = (easing: LayerKeyframe['easing']) => keyframeStateFor([k(0, { opacity: 0, easing }), k(10, { opacity: 1 })], 2).opacity;
    expect(base('ease-in')).toBeLessThan(base('linear'));
    expect(base('ease-out')).toBeGreaterThan(base('linear'));
    expect(keyframeStateFor([k(0, { opacity: 0, easing: 'ease-in-out' }), k(10, { opacity: 1 })], 5).opacity).toBeCloseTo(0.5, 6);
  });
  it('hold keeps the value until the next keyframe, then jumps', () => {
    const list = [k(0, { dx: 0, easing: 'hold' }), k(10, { dx: 1 })];
    expect(keyframeStateFor(list, 9).dx).toBe(0);
    expect(keyframeStateFor(list, 10).dx).toBe(1);
  });
  it('channels are independent: a channel only moves between keyframes that set it', () => {
    const list = [k(0, { dx: 0 }), k(10, { dy: 0.5 }), k(20, { dx: 1 })];
    const s = keyframeStateFor(list, 10);
    expect(s.dx).toBeCloseTo(0.5, 6);
    expect(s.dy).toBe(0.5);
    expect(s.scale).toBe(1);
  });
  it('uses the right segment with several keyframes', () => {
    const list = [k(0, { dx: 0 }), k(10, { dx: 10 }), k(20, { dx: 0 })];
    expect(keyframeStateFor(list, 15).dx).toBeCloseTo(5, 6);
    expect(keyframeStateFor(list, 5).dx).toBeCloseTo(5, 6);
  });
  it('does not depend on the order the list was stored in', () => {
    expect(keyframeStateFor([k(10, { dx: 1 }), k(0, { dx: 0 })], 5).dx).toBeCloseTo(0.5, 6);
  });
});

describe('keyframeTransformParts', () => {
  it('produces nothing for the neutral state', () => {
    expect(keyframeTransformParts(NEUTRAL_KEYFRAME_STATE, 1920, 1080)).toEqual([]);
  });
  it('turns fractions into pixels and keeps scale and rotation', () => {
    expect(keyframeTransformParts({ dx: 0.1, dy: -0.05, scale: 1.5, opacity: 1, rotation: 10 }, 1000, 800)).toEqual(['translate(100px, -40px)', 'scale(1.5)', 'rotate(10deg)']);
  });
});

describe('normalizeKeyframes', () => {
  it('rejects junk and returns undefined when nothing is left', () => {
    expect(normalizeKeyframes(undefined)).toBeUndefined();
    expect(normalizeKeyframes('x')).toBeUndefined();
    expect(normalizeKeyframes([null, 3, {}, { frame: 'a', dx: 1 }, { frame: 5 }])).toBeUndefined();
  });
  it('sorts, keeps one per frame (the later wins), and clamps values', () => {
    const out = normalizeKeyframes([{ frame: 20, scale: 99 }, { frame: 5, opacity: -3, easing: 'nope' }, { frame: 20, dx: 1 }])!;
    expect(out.map((x) => x.frame)).toEqual([5, 20]);
    expect(out[0]).toMatchObject({ opacity: 0, easing: 'ease-in-out' });
    expect(out[1].dx).toBe(1);
    expect(out[1].scale).toBeUndefined();
  });
  it('caps the count', () => {
    const many = Array.from({ length: 40 }, (_, i) => ({ frame: i, dx: 0.1 }));
    expect(normalizeKeyframes(many)).toHaveLength(MAX_KEYFRAMES);
  });
  it('rounds frames and floors them at 0', () => {
    expect(normalizeKeyframes([{ frame: -4.4, dx: 0.1 }, { frame: 7.6, dx: 0.2 }])!.map((x) => x.frame)).toEqual([0, 8]);
  });
});

describe('editing', () => {
  it('a new keyframe seeded from the current state does not make the layer jump', () => {
    const list = [k(0, { scale: 1 }), k(10, { scale: 2 })];
    const seeded = upsertKeyframe(list, snapshotKeyframe(list, 5));
    expect(keyframeStateFor(seeded, 5).scale).toBeCloseTo(keyframeStateFor(list, 5).scale, 6);
    expect(seeded).toHaveLength(3);
  });
  it('upsert replaces the keyframe at the same frame', () => {
    const out = upsertKeyframe([k(4, { dx: 0.1 })], k(4, { dx: 0.5 }));
    expect(out).toHaveLength(1);
    expect(out[0].dx).toBe(0.5);
  });
  it('remove returns undefined when the last one goes', () => {
    expect(removeKeyframe([k(4, { dx: 1 })], 4)).toBeUndefined();
    expect(removeKeyframe([k(4, { dx: 1 }), k(8, { dx: 2 })], 4)).toHaveLength(1);
  });
  it('move shifts a keyframe, stays inside the video, and replaces one already at the target', () => {
    const list = [k(4, { dx: 1 }), k(8, { dx: 2 })];
    expect(moveKeyframe(list, 4, 6, 30)!.map((x) => x.frame)).toEqual([6, 8]);
    expect(moveKeyframe(list, 4, 99, 30)!.map((x) => x.frame)).toEqual([8, 29]);
    const onto = moveKeyframe(list, 4, 8, 30)!;
    expect(onto).toHaveLength(1);
    expect(onto[0].dx).toBe(1);
    expect(moveKeyframe(list, 100, 3, 30)).toEqual(list);
  });
});

describe('presets', () => {
  it('every preset builds valid, in-order keyframes', () => {
    for (const p of KEYFRAME_PRESETS) {
      const list = p.build(10, 60);
      expect(normalizeKeyframes(list)).toBeDefined();
      expect(list.map((x) => x.frame)).toEqual([...list.map((x) => x.frame)].sort((a, b) => a - b));
    }
  });
  it('fade in and out ends invisible and is fully visible in the middle', () => {
    const list = KEYFRAME_PRESETS.find((p) => p.id === 'fade-in-out')!.build(0, 90);
    expect(keyframeStateFor(list, 0).opacity).toBe(0);
    expect(keyframeStateFor(list, 45).opacity).toBe(1);
    expect(keyframeStateFor(list, 90).opacity).toBe(0);
  });
});

describe('saved projects', () => {
  it('keeps a layer\'s keyframes through normalizePreviewSettings and drops junk', async () => {
    const { normalizePreviewSettings } = await import('../presets');
    const out = normalizePreviewSettings({
      layers: [{ kind: 'logo', keyframes: [{ frame: 30, dx: 0.2, easing: 'linear' }, { frame: 'x' }] }, { kind: 'cta' }],
    });
    const logo = out.layers.find((l) => l.kind === 'logo')!;
    expect(logo.keyframes).toEqual([{ frame: 30, dx: 0.2, easing: 'linear' }]);
    expect(out.layers.find((l) => l.kind === 'cta')!.keyframes).toBeUndefined();
  });
  it('an old project with no keyframes is unchanged', async () => {
    const { normalizePreviewSettings } = await import('../presets');
    expect(normalizePreviewSettings({ layers: [{ kind: 'logo' }] }).layers.every((l) => l.keyframes === undefined)).toBe(true);
  });
});
