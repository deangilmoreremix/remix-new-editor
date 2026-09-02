import { describe, it, expect } from 'vitest';

/**
 * Keyframe interpolation logic used by EffectsStudio for animated effect params.
 */

function interpolateKeyframes(keyframes, time) {
  if (!keyframes || keyframes.length === 0) return 0;
  if (keyframes.length === 1) return keyframes[0].value;

  // Find surrounding keyframes
  let before = keyframes[0];
  let after = keyframes[keyframes.length - 1];

  for (let i = 0; i < keyframes.length - 1; i++) {
    if (keyframes[i].time <= time && keyframes[i + 1].time >= time) {
      before = keyframes[i];
      after = keyframes[i + 1];
      break;
    }
  }

  if (time <= before.time) return before.value;
  if (time >= after.time) return after.value;

  const t = (time - before.time) / (after.time - before.time);
  return before.value + (after.value - before.value) * t;
}

function buildKeyframeSegments(totalDuration, animatedProps) {
  const segments = [];
  const props = animatedProps || {};

  if (Object.keys(props).length === 0) {
    return [{ startTime: 0, endTime: totalDuration, duration: totalDuration, params: {} }];
  }

  const times = new Set([0, totalDuration]);
  for (const keyframes of Object.values(props)) {
    for (const kf of keyframes) {
      times.add(Math.max(0, Math.min(totalDuration, kf.time)));
    }
  }
  const sortedTimes = Array.from(times).sort((a, b) => a - b);

  for (let i = 0; i < sortedTimes.length - 1; i++) {
    const startTime = sortedTimes[i];
    const endTime = sortedTimes[i + 1];
    const midTime = (startTime + endTime) / 2;
    const params = {};

    for (const [prop, keyframes] of Object.entries(props)) {
      params[prop] = interpolateKeyframes(keyframes, midTime);
    }

    segments.push({
      startTime,
      endTime,
      duration: endTime - startTime,
      params,
    });
  }

  return segments;
}

describe('EffectsStudio keyframes', () => {
  describe('interpolateKeyframes', () => {
    it('returns value for empty keyframes', () => {
      expect(interpolateKeyframes([], 2)).toBe(0);
    });

    it('returns single value regardless of time', () => {
      expect(interpolateKeyframes([{ time: 0, value: 0.5 }], 10)).toBe(0.5);
    });

    it('interpolates between two keyframes', () => {
      const kfs = [
        { time: 0, value: 0 },
        { time: 10, value: 1 },
      ];
      expect(interpolateKeyframes(kfs, 0)).toBe(0);
      expect(interpolateKeyframes(kfs, 5)).toBe(0.5);
      expect(interpolateKeyframes(kfs, 10)).toBe(1);
    });

    it('clamps before first keyframe', () => {
      const kfs = [
        { time: 2, value: 0.5 },
        { time: 8, value: 1 },
      ];
      expect(interpolateKeyframes(kfs, 0)).toBe(0.5);
    });

    it('clamps after last keyframe', () => {
      const kfs = [
        { time: 0, value: 0 },
        { time: 5, value: 1 },
      ];
      expect(interpolateKeyframes(kfs, 10)).toBe(1);
    });

    it('handles three keyframes', () => {
      const kfs = [
        { time: 0, value: 0 },
        { time: 5, value: 1 },
        { time: 10, value: 0 },
      ];
      expect(interpolateKeyframes(kfs, 0)).toBe(0);
      expect(interpolateKeyframes(kfs, 2.5)).toBe(0.5);
      expect(interpolateKeyframes(kfs, 5)).toBe(1);
      expect(interpolateKeyframes(kfs, 7.5)).toBe(0.5);
      expect(interpolateKeyframes(kfs, 10)).toBe(0);
    });
  });

  describe('buildKeyframeSegments', () => {
    it('returns one segment when no keyframes', () => {
      const segments = buildKeyframeSegments(5, {});
      expect(segments).toHaveLength(1);
      expect(segments[0]).toEqual({
        startTime: 0,
        endTime: 5,
        duration: 5,
        params: {},
      });
    });

    it('splits at keyframe boundaries', () => {
      const segments = buildKeyframeSegments(10, {
        guidance_scale: [
          { time: 0, value: 7.5 },
          { time: 5, value: 12 },
        ],
      });
      expect(segments.length).toBeGreaterThanOrEqual(2);
      expect(segments[0].startTime).toBe(0);
      expect(segments[segments.length - 1].endTime).toBe(10);
    });

    it('interpolates params per segment midpoint', () => {
      const segments = buildKeyframeSegments(10, {
        effect_strength: [
          { time: 0, value: 0.5 },
          { time: 10, value: 1.0 },
        ],
      });
      const midSegment = segments.find(s => s.startTime === 0 && s.endTime === 10);
      // With only two keyframes at boundaries, there should be a single segment
      expect(midSegment.params.effect_strength).toBeCloseTo(0.75, 5);
    });

    it('handles multiple animated properties', () => {
      const segments = buildKeyframeSegments(10, {
        guidance_scale: [{ time: 0, value: 7.5 }, { time: 10, value: 12 }],
        denoise_strength: [{ time: 0, value: 0.5 }, { time: 10, value: 0.8 }],
      });
      const allHaveBoth = segments.every(s => 'guidance_scale' in s.params && 'denoise_strength' in s.params);
      expect(allHaveBoth).toBe(true);
    });

    it('preserves segment ordering by time', () => {
      const segments = buildKeyframeSegments(10, {
        effect_strength: [
          { time: 0, value: 0.2 },
          { time: 3, value: 0.8 },
          { time: 7, value: 0.4 },
          { time: 10, value: 0.9 },
        ],
      });
      for (let i = 0; i < segments.length - 1; i++) {
        expect(segments[i].endTime).toBeLessThanOrEqual(segments[i + 1].startTime);
      }
    });
  });
});
