// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';

const openVideoPages = vi.fn();
vi.mock('../../VideoPagesButton.js', async (orig) => ({ ...(await orig()), openVideoPages }));
import { mountPersonalizeTrigger } from '../personalizePopover.js';

describe("each studio's Video Pages button", () => {
  beforeEach(() => { document.body.innerHTML = ''; openVideoPages.mockClear(); });
  const mount = (previewUrl = '', type = 'video') => {
    const row = document.createElement('div'); document.body.appendChild(row);
    const handle = mountPersonalizeTrigger({ controlsContainer: row, studioId: 'video', studioName: 'Video Studio', getPreview: () => previewUrl, getAsset: () => ({ type }) });
    return { row, handle };
  };
  it('sits right after Personalize in the same row', () => {
    const { row } = mount();
    const kids = [...row.children];
    expect(kids[0].id).toBe('v-contact-btn');
    expect(kids[1].hasAttribute('data-studio-video-pages')).toBe(true);
  });
  it("opens with this studio's video", async () => {
    const { row } = mount('https://cdn.test/a.mp4');
    row.querySelector('[data-studio-video-pages]').click();
    await vi.waitFor(() => expect(openVideoPages).toHaveBeenCalled());
    expect(openVideoPages.mock.calls[0][0]).toMatchObject({ url: 'https://cdn.test/a.mp4', type: 'video' });
  });
  it("opens with this studio's picture", async () => {
    const { row } = mount('https://cdn.test/a.png', 'image');
    row.querySelector('[data-studio-video-pages]').click();
    await vi.waitFor(() => expect(openVideoPages).toHaveBeenCalled());
    expect(openVideoPages.mock.calls[0][0]).toMatchObject({ type: 'image' });
  });
  it('falls back to your newest creation when the studio has nothing yet', async () => {
    const { row } = mount('');
    row.querySelector('[data-studio-video-pages]').click();
    await vi.waitFor(() => expect(openVideoPages).toHaveBeenCalled());
    expect(openVideoPages.mock.calls[0][0]).toBeNull();
  });
  it('is removed with the trigger', () => {
    const { row, handle } = mount();
    handle.destroy();
    expect(row.children.length).toBe(0);
  });
});
