// [remix] Export aspect ratio: output frame keeps the preset's short edge.
import { describe, it, expect } from 'vitest';
// @ts-expect-error plain JS
import { frameForAspect, timelineToComposition } from '../../lib/editor/remotion/timelineToComposition.js';

describe('export aspect', () => {
  it('maps preset × ratio to even frame sizes', () => {
    expect(frameForAspect('1080p', '16:9')).toEqual({ width: 1920, height: 1080 });
    expect(frameForAspect('1080p', '9:16')).toEqual({ width: 1080, height: 1920 });
    expect(frameForAspect('720p', '1:1')).toEqual({ width: 720, height: 720 });
    expect(frameForAspect('1080p', '4:5')).toEqual({ width: 1080, height: 1350 });
    expect(frameForAspect('720p', 'garbage')).toEqual({ width: 1280, height: 720 });
  });
  it('the composition model carries the chosen frame', () => {
    const m = timelineToComposition({ timelineSeconds: 2, tracks: [] }, { fps: 30, quality: '720p', aspect: '9:16' });
    expect([m.width, m.height]).toEqual([720, 1280]);
  });
});
