// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { canRetarget, watchIdOf, retargetFor, createRetargetButton, OPEN_RETARGET_PROJECT_KEY } from '../retargetAction.js';

const video = { url: 'https://cdn.example.com/a.mp4', type: 'video', prompt: 'A dog' };
const store = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)), m }; };
const deps = (over = {}) => ({
  signedIn: true,
  getLink: vi.fn().mockResolvedValue({ watchUrl: 'https://smartvid.app/watch/vabc123def', pageError: null }),
  getClient: vi.fn().mockResolvedValue({ c: 1 }),
  enable: vi.fn().mockResolvedValue('row-uuid'),
  navigate: vi.fn(),
  storage: store(),
  ...over,
});

describe('canRetarget', () => {
  it('is for finished https videos only', () => {
    expect(canRetarget(video)).toBe(true);
    expect(canRetarget({ url: 'https://cdn.example.com/a.png', type: 'image' })).toBe(false);
    expect(canRetarget({ url: 'http://cdn.example.com/a.mp4', type: 'video' })).toBe(false);
    expect(canRetarget({ url: 'blob:abc', type: 'video' })).toBe(false);
    expect(canRetarget(null)).toBe(false);
  });
});

describe('watchIdOf', () => {
  it('reads the id from a /watch address and ignores anything else', () => {
    expect(watchIdOf('https://smartvid.app/watch/vabc123def')).toBe('vabc123def');
    expect(watchIdOf('https://smartvid.app/v/acme/promo')).toBeNull();
    expect(watchIdOf('nope')).toBeNull();
    expect(watchIdOf(null)).toBeNull();
  });
});

describe('retargetFor', () => {
  it('publishes the result as a tracked video, turns Retarget on, leaves the project id for the overview and opens it', async () => {
    const d = deps();
    expect(await retargetFor(video, { toast: vi.fn(), deps: d })).toBe(true);
    expect(d.getLink).toHaveBeenCalledWith(expect.objectContaining({ url: video.url, kind: 'video', title: 'A dog' }));
    expect(d.enable).toHaveBeenCalledWith({ c: 1 }, 'vabc123def');
    expect(d.storage.m.get(OPEN_RETARGET_PROJECT_KEY)).toBe('row-uuid');
    expect(d.navigate).toHaveBeenCalledWith('timeline');
  });
  it('asks a guest to sign in and does nothing else', async () => {
    const d = deps({ signedIn: false }); const toast = vi.fn();
    expect(await retargetFor(video, { toast, deps: d })).toBe(false);
    expect(toast).toHaveBeenCalledWith(expect.stringMatching(/Sign in/));
    expect(d.getLink).not.toHaveBeenCalled();
  });
  it('refuses a picture without publishing anything', async () => {
    const d = deps(); const toast = vi.fn();
    expect(await retargetFor({ url: 'https://cdn.example.com/a.png', type: 'image' }, { toast, deps: d })).toBe(false);
    expect(d.getLink).not.toHaveBeenCalled();
  });
  it('says why when the page could not be made, and does not navigate', async () => {
    const d = deps({ getLink: vi.fn().mockResolvedValue({ watchUrl: null, pageError: 'The video could not be read' }) }); const toast = vi.fn();
    expect(await retargetFor(video, { toast, deps: d })).toBe(false);
    expect(toast).toHaveBeenCalledWith('The video could not be read');
    expect(d.enable).not.toHaveBeenCalled();
    expect(d.navigate).not.toHaveBeenCalled();
  });
  it('reports a failure instead of throwing', async () => {
    const d = deps({ enable: vi.fn().mockRejectedValue(new Error('This project id belongs to another project')) }); const toast = vi.fn();
    expect(await retargetFor(video, { toast, deps: d })).toBe(false);
    expect(toast).toHaveBeenCalledWith('This project id belongs to another project');
    expect(d.navigate).not.toHaveBeenCalled();
  });
  it('still opens the overview when storage is blocked', async () => {
    const d = deps({ storage: { setItem() { throw new Error('blocked'); } } });
    expect(await retargetFor(video, { toast: vi.fn(), deps: d })).toBe(true);
    expect(d.navigate).toHaveBeenCalledWith('timeline');
  });
});

describe('createRetargetButton', () => {
  beforeEach(() => { document.body.innerHTML = ''; });
  it('copies the studio button style and is marked as a retarget action', () => {
    const like = document.createElement('a'); like.className = 'studio-btn x';
    const btn = createRetargetButton({ like });
    expect(btn.className).toBe('studio-btn x');
    expect(btn.dataset.action).toBe('retarget');
    expect(btn.textContent).toBe('Retarget');
    expect(btn.type).toBe('button');
  });
});
