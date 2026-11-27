// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';

const openVideoPages = vi.fn();
vi.mock('../../VideoPagesButton.js', async (orig) => ({ ...(await orig()), openVideoPages }));
import { createStudioVideoPagesButton } from '../studioVideoPagesButton.js';

describe('createStudioVideoPagesButton (Edit, Upscale, Product Shot, Animate, Photo Studio)', () => {
  beforeEach(() => openVideoPages.mockClear());

  it('opens with the studio result and its output type', async () => {
    const btn = createStudioVideoPagesButton({ studioId: 'animate', getResult: () => 'https://cdn.test/a.mp4', getAsset: () => ({ type: 'video' }) });
    expect(btn.hasAttribute('data-studio-video-pages')).toBe(true);
    btn.click();
    await vi.waitFor(() => expect(openVideoPages).toHaveBeenCalled());
    expect(openVideoPages.mock.calls[0][0]).toMatchObject({ url: 'https://cdn.test/a.mp4', type: 'video', studio: 'animate' });
  });

  it('with no result yet it falls back to your newest creation', async () => {
    createStudioVideoPagesButton({ studioId: 'edit', getResult: () => '', getAsset: () => ({ type: 'image' }) }).click();
    await vi.waitFor(() => expect(openVideoPages).toHaveBeenCalled());
    expect(openVideoPages.mock.calls[0][0]).toBeNull();
  });
});
