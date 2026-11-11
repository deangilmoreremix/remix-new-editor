// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';

const load = async () => {
  vi.resetModules();
  return import('../webRenderer');
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('export encoder tuning', () => {
  it('uses the hardware encoder when the browser has one', async () => {
    const isConfigSupported = vi.fn().mockResolvedValue({ supported: true });
    vi.stubGlobal('VideoEncoder', { isConfigSupported });
    const { pickEncoderTuning } = await load();
    const tuning = await pickEncoderTuning({ width: 1920, height: 1080 });
    expect(tuning).toMatchObject({ hardwareAcceleration: 'prefer-hardware', pageResponsiveness: 'low', keyframeIntervalInSeconds: 2 });
    expect(isConfigSupported).toHaveBeenCalledWith(expect.objectContaining({ hardwareAcceleration: 'prefer-hardware', width: 1920 }));
  });

  it('falls back to software when there is no hardware encoder, no WebCodecs, or the probe fails', async () => {
    vi.stubGlobal('VideoEncoder', { isConfigSupported: vi.fn().mockResolvedValue({ supported: false }) });
    expect((await (await load()).pickEncoderTuning({ width: 1280, height: 720 })).hardwareAcceleration).toBe('prefer-software');
    vi.stubGlobal('VideoEncoder', undefined);
    expect((await (await load()).pickEncoderTuning({ width: 1280, height: 720 })).hardwareAcceleration).toBe('prefer-software');
    vi.stubGlobal('VideoEncoder', { isConfigSupported: vi.fn().mockRejectedValue(new Error('x')) });
    expect((await (await load()).pickEncoderTuning({ width: 1280, height: 720 })).hardwareAcceleration).toBe('prefer-software');
  });

  it('gives up on a probe that never answers', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('VideoEncoder', { isConfigSupported: vi.fn().mockReturnValue(new Promise(() => undefined)) });
    const { pickEncoderTuning } = await load();
    const pending = pickEncoderTuning({ width: 1920, height: 1080 });
    await vi.advanceTimersByTimeAsync(3100);
    expect((await pending).hardwareAcceleration).toBe('prefer-software');
    vi.useRealTimers();
  });
});
