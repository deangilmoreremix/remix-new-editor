import { describe, it, expect, vi } from 'vitest';

// The Personalize window's module cannot be loaded at all.
vi.mock('../../features/personalization/mount.jsx', () => { throw new Error('no window'); });

import { VideoPersonalizationHub } from './VideoPersonalizationHub.jsx';

describe('VideoPersonalizationHub when the Personalize window cannot load', () => {
  it('reports it through onError instead of throwing', async () => {
    const onError = vi.fn();
    await expect(new VideoPersonalizationHub({ onError }).open()).resolves.toBeUndefined();
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError.mock.calls[0][0]).toBeInstanceOf(Error); // (the mock factory's message is wrapped by Vitest)
  });
  it('does not throw when there is no onError either', async () => {
    await expect(new VideoPersonalizationHub().open()).resolves.toBeUndefined();
  });
});
