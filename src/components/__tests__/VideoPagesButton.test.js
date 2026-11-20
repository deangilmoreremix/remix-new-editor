// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';

const picker = vi.hoisted(() => ({ open: vi.fn() }));
vi.mock('../../lib/landingPages/pickerModal.js', () => ({
  openLandingPagePicker: picker.open,
  toPickerVideo: (v) => (v && /^https:\/\//.test(v.url) ? v : null),
}));

import { createVideoPagesButton, latestFromSaved } from '../VideoPagesButton.js';
import { WORKBENCH_GENERATION_EVENT } from '../../lib/workbench.js';

describe('Video Pages header button', () => {
  beforeEach(() => { picker.open.mockClear(); });

  it('is always clickable: with nothing made yet it opens the picker on its chooser', async () => {
    const target = new EventTarget();
    const btn = createVideoPagesButton({ target });
    btn.click();
    await vi.waitFor(() => expect(picker.open).toHaveBeenCalledWith({ video: null }));
  });

  it('loads the latest finished video or picture from any studio', async () => {
    const target = new EventTarget();
    const btn = createVideoPagesButton({ target });
    target.dispatchEvent(new CustomEvent(WORKBENCH_GENERATION_EVENT, { detail: { entry: { type: 'video', url: 'https://x.test/a.mp4', prompt: 'A fox', studio: 'video' } } }));
    target.dispatchEvent(new CustomEvent(WORKBENCH_GENERATION_EVENT, { detail: { entry: { type: 'audio', url: 'https://x.test/a.mp3' } } }));
    expect(btn.querySelector('[data-latest-dot]').classList.contains('hidden')).toBe(false);
    btn.click();
    await vi.waitFor(() => expect(picker.open).toHaveBeenCalledWith({ video: expect.objectContaining({ url: 'https://x.test/a.mp4', type: 'video', prompt: 'A fox' }) }));
  });

  it('ignores audio and non-https output', () => {
    expect(latestFromSaved({ type: 'audio', url: 'https://x.test/a.mp3' })).toBeNull();
    expect(latestFromSaved({ type: 'image', url: 'blob:abc' })).toBeNull();
    expect(latestFromSaved({ type: 'image', url: 'https://x.test/a.png' })).toMatchObject({ type: 'image' });
  });
});
