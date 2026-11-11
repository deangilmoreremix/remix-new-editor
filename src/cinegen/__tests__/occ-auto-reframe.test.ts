// [remix] Auto-reframe host glue over OpenChatCut's detectFocalPoints (headless FrameSampler).
import { describe, it, expect } from 'vitest';
import { autoReframe } from '@cinegen/lib/occ/auto-reframe';
import type { ImageDataLike } from '../../openchatcut/reframe/detect';

/** a bright 8×8 block that moves left → right over the clip on a flat grey frame */
const sampler = (total: number) => async (frame: number): Promise<ImageDataLike> => {
  const w = 96; const h = 54; const data = new Uint8ClampedArray(w * h * 4).fill(40);
  const cx = Math.round(8 + (frame / Math.max(1, total - 1)) * (w - 24));
  for (let y = 20; y < 34; y++) for (let x = cx; x < cx + 12; x++) { const i = (y * w + x) * 4; data[i] = data[i + 1] = data[i + 2] = (x + y) % 2 ? 250 : 10; data[i + 3] = 255; }
  return { data, width: w, height: h };
};

describe('autoReframe', () => {
  it('follows a moving subject: focal x increases across the clip and stays near the block row', async () => {
    const z = await autoReframe({ sampler: sampler(90), width: 1920, height: 1080 }, { duration: 3, trimStart: 0, trimEnd: 0, speed: 1 }, 1.8);
    expect(z).not.toBeNull();
    const kf = z!.reframeCurve!.keyframes;
    expect(kf.length).toBeGreaterThan(3);
    expect(kf[kf.length - 1].focalPointX).toBeGreaterThan(kf[0].focalPointX + 0.3);
    expect(Math.abs(kf[1].focalPointY - 0.5)).toBeLessThan(0.25);
    expect(z!.magnification).toBe(1.8);
  });
  it('returns null when nothing can be sampled', async () => {
    expect(await autoReframe({ sampler: async () => null, width: 16, height: 9 }, { duration: 2, trimStart: 0, trimEnd: 0, speed: 1 }, 1.5)).toBeNull();
  });
});
