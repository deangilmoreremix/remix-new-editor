// @vitest-environment jsdom
/* global EventTarget */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const picker = vi.hoisted(() => ({ open: vi.fn() }));
vi.mock('../../lib/landingPages/pickerModal.js', () => ({
  openLandingPagePicker: picker.open,
  toPickerVideo: (v) => (v && /^https:\/\//.test(v.url) ? v : null),
}));

const hist = vi.hoisted(() => ({ list: [] }));
vi.mock('../../lib/generationHistory.js', () => ({ loadGenerationHistory: async () => hist.list }));

import { createVideoPagesButton, latestFromSaved, pickLatest } from '../VideoPagesButton.js';
import { WORKBENCH_GENERATION_EVENT } from '../../lib/workbench.js';

describe('Video Pages header button', () => {
  beforeEach(() => { picker.open.mockClear(); });

  it('with nothing finished this session it loads your newest video or picture from history (no upload)', async () => {
    hist.list = [{ type: 'audio', url: 'https://x.test/a.mp3' }, { type: 'image', url: 'https://x.test/new.png', prompt: 'Newest' }, { type: 'video', url: 'https://x.test/old.mp4' }];
    createVideoPagesButton({ target: new EventTarget() }).click();
    await vi.waitFor(() => expect(picker.open).toHaveBeenCalledWith({ items: expect.any(Array), video: expect.objectContaining({ url: 'https://x.test/new.png', type: 'image' }) }));
  });

  it('pickLatest skips audio and unusable links', () => {
    expect(pickLatest([{ type: 'audio', url: 'https://x/a.mp3' }, { type: 'video', url: 'blob:x' }, { type: 'video', url: 'https://x/v.mp4' }])?.url).toBe('https://x/v.mp4');
    expect(pickLatest([])).toBeNull();
  });

  it('only a user who has never made anything gets the chooser', async () => {
    hist.list = [];
    const target = new EventTarget();
    const btn = createVideoPagesButton({ target });
    btn.click();
    await vi.waitFor(() => expect(picker.open).toHaveBeenCalledWith({ items: expect.any(Array), video: null }));
  });

  it('loads the latest finished video or picture from any studio', async () => {
    const target = new EventTarget();
    const btn = createVideoPagesButton({ target });
    target.dispatchEvent(new CustomEvent(WORKBENCH_GENERATION_EVENT, { detail: { entry: { type: 'video', url: 'https://x.test/a.mp4', prompt: 'A fox', studio: 'video' } } }));
    target.dispatchEvent(new CustomEvent(WORKBENCH_GENERATION_EVENT, { detail: { entry: { type: 'audio', url: 'https://x.test/a.mp3' } } }));
    expect(btn.querySelector('[data-latest-dot]').classList.contains('hidden')).toBe(false);
    btn.click();
    await vi.waitFor(() => expect(picker.open).toHaveBeenCalledWith({ items: expect.any(Array), video: expect.objectContaining({ url: 'https://x.test/a.mp4', type: 'video', prompt: 'A fox' }) }));
  });

  it('ignores audio and non-https output', () => {
    expect(latestFromSaved({ type: 'audio', url: 'https://x.test/a.mp3' })).toBeNull();
    expect(latestFromSaved({ type: 'image', url: 'blob:abc' })).toBeNull();
    expect(latestFromSaved({ type: 'image', url: 'https://x.test/a.png' })).toMatchObject({ type: 'image' });
  });
});

describe('the window opens even when the history never answers', () => {
  it('waits 1.5 seconds at most, then opens the picker', async () => {
    vi.useFakeTimers();
    const open = vi.fn();
    vi.doMock('../../lib/generationHistory.js', () => ({ loadGenerationHistory: () => new Promise(() => {}) }));
    vi.doMock('../../lib/landingPages/pickerModal.js', () => ({ openLandingPagePicker: open, toPickerVideo: (v) => v }));
    vi.doMock('../studio/landingPageAction.js', () => ({ recentItems: async () => [] }));
    vi.resetModules();
    const { createVideoPagesButton } = await import('../VideoPagesButton.js');
    const btn = createVideoPagesButton({ target: new EventTarget() });
    btn.click();
    await vi.advanceTimersByTimeAsync(1600);
    expect(open).toHaveBeenCalledTimes(1);
    vi.useRealTimers(); vi.resetModules(); vi.doUnmock('../../lib/generationHistory.js'); vi.doUnmock('../../lib/landingPages/pickerModal.js'); vi.doUnmock('../studio/landingPageAction.js');
  });
});
