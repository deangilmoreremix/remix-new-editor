// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../supabase.js', () => ({ supabase: {}, primeSupabaseIdentity: vi.fn(async () => {}), getClerkUserId: () => 'u1' }));
vi.mock('../../uploadService.js', () => ({ uploadFileToSupabase: vi.fn() }));
vi.mock('../../brandStore.js', () => ({ listBrands: () => [] }));
vi.mock('../../loading.js', () => ({ showToast: vi.fn() }));
import { openLandingPagePicker, filterTemplates, toPickerVideo, CHIPS } from '../pickerModal.js';
import { TEMPLATES } from '../templates.js';

const tick = () => new Promise((r) => setTimeout(r, 0));
const VIDEO = { url: 'https://cdn.test/a.mp4', title: 'Hello', studio: 'video' };

describe('toPickerVideo', () => {
  it('accepts https and blob videos, drops everything else', () => {
    expect(toPickerVideo(VIDEO)).toMatchObject({ url: VIDEO.url, title: 'Hello', source: { studio: 'video' } });
    expect(toPickerVideo({ url: 'blob:abc' }).permanent).toBe(false);
    expect(toPickerVideo({ url: 'http://x/a.mp4' })).toBeNull();
    expect(toPickerVideo({ url: 'javascript:alert(1)' })).toBeNull();
    expect(toPickerVideo(null)).toBeNull();
  });
  it('keeps a poster only when it is a different https url', () => {
    expect(toPickerVideo({ ...VIDEO, thumbnail_url: 'https://cdn.test/p.jpg' }).posterUrl).toBe('https://cdn.test/p.jpg');
    expect(toPickerVideo({ ...VIDEO, thumbnail_url: VIDEO.url }).posterUrl).toBeNull();
  });
});

describe('filterTemplates / chips', () => {
  const all = TEMPLATES.filter((t) => t.puck);
  it('searches name and description', () => {
    const r = filterTemplates(all, { q: 'spa' });
    expect(r.length).toBeGreaterThan(0);
    expect(r.length).toBeLessThan(all.length);
  });
  it('every design is in at least one category chip', () => {
    const seen = new Set();
    CHIPS.filter((c) => c.id !== 'all').forEach((c) => filterTemplates(all, { chip: c.id }).forEach((t) => seen.add(t.id)));
    expect(all.filter((t) => !seen.has(t.id)).map((t) => t.id)).toEqual([]);
  });
});

describe('openLandingPagePicker', () => {
  beforeEach(() => { document.body.innerHTML = ''; document.body.style.overflow = ''; });
  const grid = () => document.querySelector('[data-design-grid]');

  it('shows every design, locks scroll and restores it on close', () => {
    const onClose = vi.fn();
    const p = openLandingPagePicker({ video: VIDEO, onClose });
    expect(grid().querySelectorAll('button').length).toBe(TEMPLATES.filter((t) => t.puck).length);
    expect(document.body.style.overflow).toBe('hidden');
    p.close();
    expect(document.querySelector('[data-landing-picker]')).toBeNull();
    expect(document.body.style.overflow).toBe('');
    expect(onClose).toHaveBeenCalledTimes(1);
    p.close();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('click a design -> editor with the video; save creates the page and returns the link', async () => {
    const mountPuckEditor = vi.fn(() => ({ destroy: vi.fn() }));
    const createPageFromVideo = vi.fn(async (_c, v, o) => ({ id: 'abcd123456', config: { template: o.template }, video_url: v.url }));
    const updatePage = vi.fn(async (_c, id) => ({ id, published: false, config: {} }));
    const onPick = vi.fn();
    openLandingPagePicker({ video: VIDEO, onPick, deps: { mountPuckEditor, createPageFromVideo, updatePage } });
    const first = grid().querySelector('button');
    first.click();
    await tick();
    expect(mountPuckEditor).toHaveBeenCalledTimes(1);
    expect(mountPuckEditor.mock.calls[0][1].page.video_url).toBe(VIDEO.url);
    const save = [...document.querySelectorAll('button')].find((b) => b.textContent === 'Save as my page');
    save.click();
    await tick(); await tick();
    expect(createPageFromVideo.mock.calls[0][1].url).toBe(VIDEO.url);
    expect(createPageFromVideo.mock.calls[0][2].template).toBe(first.dataset.template);
    expect(onPick).toHaveBeenCalledWith(expect.objectContaining({ id: 'abcd123456', published: false, url: expect.stringContaining('/p/abcd123456') }));
    expect(document.body.textContent).toContain('Saved to Video Pages');
  });

  it('shows the error and keeps the editor when saving fails', async () => {
    const createPageFromVideo = vi.fn(async () => { throw new Error('Upload failed. Sign in and try again.'); });
    openLandingPagePicker({ video: VIDEO, deps: { mountPuckEditor: () => ({ destroy() {} }), createPageFromVideo } });
    grid().querySelector('button').click();
    await tick();
    [...document.querySelectorAll('button')].find((b) => b.textContent === 'Save as my page').click();
    await tick(); await tick();
    expect(document.body.textContent).toContain('Upload failed');
    expect([...document.querySelectorAll('button')].find((b) => b.textContent === 'Save as my page').disabled).toBe(false);
  });

  it('without a usable video it asks for a link and rejects non-https', () => {
    openLandingPagePicker({ video: { url: 'http://x/a.mp4' } });
    expect(document.body.textContent).toContain('Paste one below');
    const input = document.querySelector('input[aria-label="Video link"]');
    input.value = 'http://nope/a.mp4';
    [...document.querySelectorAll('button')].find((b) => b.textContent === 'Use link').click();
    expect(document.body.textContent).toContain('full https://');
    input.value = 'https://cdn.test/ok.mp4';
    [...document.querySelectorAll('button')].find((b) => b.textContent === 'Use link').click();
    expect(document.querySelector('input[aria-label="Video link"]')).toBeNull();
    expect(grid()).not.toBeNull();
  });

  it('opens straight on a chosen design when `template` is given', async () => {
    const mountPuckEditor = vi.fn(() => ({ destroy() {} }));
    const id = TEMPLATES.find((t) => t.puck).id;
    openLandingPagePicker({ video: VIDEO, template: id, deps: { mountPuckEditor } });
    await tick();
    expect(grid()).toBeNull();
    expect(mountPuckEditor).toHaveBeenCalledTimes(1);
  });

  it('Escape goes back from the editor first, then closes', async () => {
    const onClose = vi.fn();
    openLandingPagePicker({ video: VIDEO, onClose, deps: { mountPuckEditor: () => ({ destroy() {} }) } });
    grid().querySelector('button').click();
    await tick();
    expect(grid()).toBeNull();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(grid()).not.toBeNull();
    expect(onClose).not.toHaveBeenCalled();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(onClose).toHaveBeenCalled();
  });
});
