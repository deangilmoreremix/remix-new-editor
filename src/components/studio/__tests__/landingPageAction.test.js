// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';

const picker = vi.hoisted(() => ({ open: vi.fn() }));
vi.mock('../../../lib/landingPages/pickerModal.js', () => ({
  openLandingPagePicker: picker.open,
  toPickerVideo: (v) => (v && /^https:\/\//.test(v.url) ? v : null),
}));

import { canMakeLandingPage, openLandingPageFor, createLandingPageButton } from '../landingPageAction.js';
import { createResultsGallery } from '../resultsGallery.js';
import { MediaDetailView } from '../../MediaDetailView.js';

describe('Create landing page on results', () => {
  beforeEach(() => { picker.open.mockClear(); document.body.innerHTML = ''; });

  it('only offers it for https videos and pictures', () => {
    expect(canMakeLandingPage({ url: 'https://x.test/a.mp4', type: 'video' })).toBe(true);
    expect(canMakeLandingPage({ url: 'https://x.test/a.png', type: 'image' })).toBe(true);
    expect(canMakeLandingPage({ url: 'https://x.test/a.mp3', type: 'audio' })).toBe(false);
    expect(canMakeLandingPage({ url: 'blob:abc', type: 'video' })).toBe(false);
  });

  it('the studio button opens the picker with that result', async () => {
    const btn = createLandingPageButton({ getItem: () => ({ url: 'https://x.test/a.mp4', type: 'video', studio: 'video' }) });
    btn.click();
    await vi.waitFor(() => expect(picker.open).toHaveBeenCalledWith({ items: expect.any(Array), video: expect.objectContaining({ url: 'https://x.test/a.mp4' }) }));
  });

  it('refuses (and tells the user) when the result has no https link', async () => {
    const toast = vi.fn();
    expect(await openLandingPageFor({ url: 'blob:x', type: 'video' }, { toast })).toBe(false);
    expect(toast).toHaveBeenCalled();
    expect(picker.open).not.toHaveBeenCalled();
  });

  it('every results-gallery card has a Create landing page action', async () => {
    const g = createResultsGallery({ kind: 'video' });
    document.body.appendChild(g.root || g.el || g.node || document.createElement('div'));
    g.addItem({ id: '1', url: 'https://x.test/a.mp4', prompt: 'A fox' });
    const btn = document.body.querySelector('[data-action="landing"]');
    expect(btn).toBeTruthy();
    btn.click();
    await vi.waitFor(() => expect(picker.open).toHaveBeenCalledWith({ items: expect.any(Array), video: expect.objectContaining({ url: 'https://x.test/a.mp4', type: 'video' }) }));
  });

  it('the media preview window adds it by default, once', () => {
    const v = new MediaDetailView({ mediaUrl: 'https://x.test/a.png', mediaType: 'image' });
    expect(v._renderActions().match(/create-landing-page/g)).toHaveLength(1);
    const lib = new MediaDetailView({ mediaUrl: 'https://x.test/a.png', mediaType: 'image', actions: [{ id: 'landing-page', label: 'Create landing page' }] });
    expect(lib._renderActions()).not.toContain('create-landing-page');
    expect(new MediaDetailView({ mediaUrl: 'https://x.test/a.mp3', mediaType: 'audio' })._renderActions()).not.toContain('create-landing-page');
  });
});

describe('recent results ride along as the content tray', () => {
  it('recentItems: newest pictures and videos, https only, not the item itself, at most n, no duplicates, no audio', async () => {
    const { recentItems } = await import('../landingPageAction.js');
    const load = async () => [
      { type: 'video', url: 'https://cdn.test/a.mp4', prompt: 'A' },
      { type: 'audio', url: 'https://cdn.test/a.mp3' },
      { type: 'image', url: 'https://cdn.test/b.png' },
      { type: 'image', url: 'https://cdn.test/b.png' },
      { type: 'image', url: 'blob:abc' },
      { type: 'image', url: 'https://cdn.test/self.png' },
      { type: 'image', url: 'https://cdn.test/c.png', thumbnail_url: 'https://cdn.test/c-t.png' },
      { type: 'video', url: 'https://cdn.test/d.mp4' },
    ];
    const out = await recentItems({ exclude: ['https://cdn.test/self.png'], n: 3, load });
    expect(out.map((i) => i.url.split('/').pop())).toEqual(['a.mp4', 'b.png', 'c.png']);
    expect(out[2].thumbnail_url).toBe('https://cdn.test/c-t.png');
  });
  it('a slow or broken history never blocks the hand-off', async () => {
    const { recentItems } = await import('../landingPageAction.js');
    expect(await recentItems({ load: () => new Promise(() => {}), timeoutMs: 20 })).toEqual([]);
    expect(await recentItems({ load: async () => { throw new Error('offline'); } })).toEqual([]);
  });
  it('the picker gets the requested item as main and the recent ones as items', async () => {
    const { openLandingPageFor, recentItems } = await import('../landingPageAction.js');
    vi.resetModules();
    const history = [{ type: 'image', url: 'https://cdn.test/r1.png' }, { type: 'video', url: 'https://cdn.test/r2.mp4' }];
    vi.doMock('../../../lib/generationHistory.js', () => ({ loadGenerationHistory: async () => history }));
    const fresh = await import('../landingPageAction.js');
    await fresh.openLandingPageFor({ url: 'https://cdn.test/main.png', type: 'image' });
    expect(picker.open).toHaveBeenLastCalledWith({ video: expect.objectContaining({ url: 'https://cdn.test/main.png' }), items: [expect.objectContaining({ url: 'https://cdn.test/r1.png' }), expect.objectContaining({ url: 'https://cdn.test/r2.mp4' })] });
    await fresh.openLandingPageFor({ url: 'https://cdn.test/main.png', type: 'image' }, { recent: false });
    expect(picker.open).toHaveBeenLastCalledWith({ video: expect.objectContaining({ url: 'https://cdn.test/main.png' }), items: [] });
    vi.doUnmock('../../../lib/generationHistory.js');
    expect(typeof openLandingPageFor).toBe('function'); expect(typeof recentItems).toBe('function');
  });
});
