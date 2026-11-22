import { describe, it, expect, vi } from 'vitest';
import { frameCrop, isMarkFrame, CAPTURE_MARK, captureInTab } from '../browserCapture.js';
import { defaultDraft, siteStatus, sitesToCapture, backgroundShotFor, backgroundProblems } from '../draft.js';

const fakeTab = () => {
  const tab = { closed: false, visits: [], location: null };
  let href = '/outreach-capture.html';
  const loc = { replace: (u) => { href = u; } };
  Object.defineProperty(loc, 'href', { get: () => href });
  Object.defineProperty(tab, 'location', { get: () => loc, set: (u) => { href = u; tab.visits.push(u); } });
  tab.href = () => href;
  return tab;
};
const noWait = async () => {};

describe('capture with my browser', () => {
  it('cuts off the top bar and keeps at most 16:9 from the top', () => {
    expect(frameCrop(1920, 1080)).toEqual({ sx: 0, sy: 81, sw: 1920, sh: 999 });
    expect(frameCrop(1280, 1600)).toEqual({ sx: 0, sy: 120, sw: 1280, sh: 720 });
    expect(frameCrop(1280, 720, { hideTopBar: false })).toEqual({ sx: 0, sy: 0, sw: 1280, sh: 720 });
  });

  it('tells the capture tab from any other tab', () => {
    expect(isMarkFrame(CAPTURE_MARK)).toBe(true);
    expect(isMarkFrame([230, 240, 20])).toBe(true);
    expect(isMarkFrame([255, 255, 255])).toBe(false);
  });

  it('loads each page in the tab, keeps a frame of each, and reports pages that never load', async () => {
    const tab = fakeTab();
    const onShot = vi.fn();
    const upload = vi.fn(async (_b, i) => `https://cdn/shot-${i}.jpg`);
    const { shots, failed } = await captureInTab({
      tab, share: { video: {}, ended: () => false }, urls: ['https://www.facebook.com/a', 'https://never.example/', 'https://x.com/b'], upload, onShot,
      deps: { sleep: noWait, left: (t) => t.href() !== '/outreach-capture.html' && !/never/.test(t.href()), grab: async () => new Blob(['x']) },
    });
    expect(tab.visits).toEqual(['https://www.facebook.com/a', 'https://never.example/', 'https://x.com/b']);
    expect(shots).toEqual({ 'https://www.facebook.com/a': 'https://cdn/shot-0.jpg', 'https://x.com/b': 'https://cdn/shot-2.jpg' });
    expect(failed).toEqual(['https://never.example/']);
    expect(onShot).toHaveBeenCalledTimes(2);
  }, 30000);

  it('stops when the tab is closed or sharing ends, keeping what was captured', async () => {
    const tab = fakeTab();
    const onShot = vi.fn(() => { tab.closed = true; });
    await expect(captureInTab({
      tab, share: { video: {}, ended: () => false }, urls: ['https://a.example/', 'https://b.example/'], upload: async () => 'https://cdn/a.jpg', onShot,
      deps: { sleep: noWait, left: () => true, grab: async () => new Blob(['x']) },
    })).rejects.toThrow(/closed or stopped sharing\. 1 of 2/);
    expect(onShot).toHaveBeenCalledWith('https://a.example/', 'https://cdn/a.jpg');
  });

  it('stops on Stop', async () => {
    const ctl = new AbortController(); ctl.abort();
    await expect(captureInTab({ tab: fakeTab(), share: { video: {} }, urls: ['https://a.example/'], upload: vi.fn(), signal: ctl.signal })).rejects.toMatchObject({ name: 'AbortError' });
  });
});

describe('uploaded screenshots', () => {
  const draft = {
    ...defaultDraft(),
    background: { ...defaultDraft().background, mode: 'website', fallbackSite: 'mine.example', onMissing: 'error' },
    contacts: [
      { id: 'a', website: 'https://www.facebook.com/acme', backgroundShot: 'https://cdn/up.jpg' },
      { id: 'b', backgroundShot: 'https://cdn/b.jpg' },
      { id: 'c', website: 'https://www.facebook.com/other' },
    ],
    siteShots: { 'https://www.facebook.com/acme': 'https://cdn/captured.jpg' },
  };
  it('wins over the captured page and needs no capture', () => {
    expect(backgroundShotFor(draft, draft.contacts[0])).toBe('https://cdn/up.jpg');
    expect(siteStatus(draft, draft.contacts[1])).toBe('uploaded');
    expect(sitesToCapture(draft)).toEqual(['https://www.facebook.com/other', 'https://mine.example/']);
    expect(backgroundProblems(draft)).toEqual([]); // c is not checked yet
    expect(backgroundProblems({ ...draft, siteErrors: { 'https://www.facebook.com/other': 'x' } }).map((c) => c.id)).toEqual(['c']);
  });
});
