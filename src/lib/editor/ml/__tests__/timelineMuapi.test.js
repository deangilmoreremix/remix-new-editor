import { describe, it, expect, vi } from 'vitest';

vi.mock('../frameGrab.js', async (orig) => ({
  ...(await orig()),
  boundaryFrameUrls: vi.fn(async () => ({ firstFrameUrl: 'https://cdn/a.jpg', lastFrameUrl: 'https://cdn/b.jpg' })),
}));

import { gapNextTo, gapsOnTrack, fillGap, removeWatermark, isStockClip } from '../../ai/timelineMuapi.js';

function makeEditor(items) {
  const track = { id: 'v', items };
  return {
    track,
    timelineSeconds: () => 60,
    playheadSec: () => 0,
    clipStart: (c) => c.s,
    clipDuration: (c) => c.d,
    setClipTimes: (c, s, e) => { c.s = s; c.d = e - s; },
    trackOf: () => track,
    addToTrack: (t, c, times) => { if (times) { c.s = times.start; c.d = times.end - times.start; } t.items.push(c); return c; },
    mediaSrc: (c) => c.src,
    setMediaSrc: (c, u) => { c.src = u; },
    snapshot: vi.fn(), commit: vi.fn(), refresh: vi.fn(), toast: vi.fn(),
    storeBlob: vi.fn(async () => 'https://cdn/up.jpg'),
  };
}

describe('gaps', () => {
  const a = { id: 'a', type: 'video', s: 0, d: 4, src: 'https://cdn/a.mp4' };
  const b = { id: 'b', type: 'video', s: 6, d: 4, src: 'https://cdn/b.mp4' };
  it('finds the gap after and before a clip', () => {
    const ed = makeEditor([a, b]);
    expect(gapNextTo(ed, a, { side: 'after' })).toMatchObject({ before: a, after: b, start: 4, end: 6 });
    expect(gapNextTo(ed, b, { side: 'before' })).toMatchObject({ before: a, after: b, start: 4, end: 6 });
    expect(gapNextTo(ed, a, { side: 'before' })).toBeNull();
    expect(gapsOnTrack(ed, ed.track)).toHaveLength(1);
  });
});

describe('fillGap', () => {
  it('sends the boundary frames to MuAPI and places a speed-fitted clip in the gap', async () => {
    const a = { id: 'a', type: 'video', s: 0, d: 4, src: 'https://cdn/a.mp4' };
    const b = { id: 'b', type: 'video', s: 6.5, d: 4, src: 'https://cdn/b.mp4' };
    const ed = makeEditor([a, b]);
    const run = vi.fn(async () => ({ url: 'https://cdn/fill.mp4', urls: ['https://cdn/fill.mp4'] }));
    const clip = await fillGap(ed, gapNextTo(ed, a), { run });
    expect(run).toHaveBeenCalledWith('fill_gap', expect.objectContaining({
      model: 'vidu-q2-turbo-start-end-video', firstFrameUrl: 'https://cdn/a.jpg', lastFrameUrl: 'https://cdn/b.jpg', duration: 3,
    }), expect.anything());
    expect(clip).toMatchObject({ type: 'video', src: 'https://cdn/fill.mp4', s: 4, d: 2.5 });
    expect(clip.playbackRate).toBeCloseTo(3 / 2.5);
    expect(ed.track.items).toContain(clip);
  });
});

describe('removeWatermark', () => {
  it('needs rights confirmation, refuses stock, keeps the original', async () => {
    const clip = { id: 'v', type: 'video', s: 0, d: 4, src: 'https://cdn/mine.mp4' };
    const ed = makeEditor([clip]);
    const run = vi.fn(async () => ({ url: 'https://cdn/clean.mp4' }));
    await expect(removeWatermark(ed, clip, { run })).rejects.toThrow(/rights/);
    await removeWatermark(ed, clip, { run, rightsConfirmed: true });
    expect(run).toHaveBeenCalledWith('watermark_remove', { model: 'video-watermark-remover', videoUrl: 'https://cdn/mine.mp4' }, expect.anything());
    expect(clip.src).toBe('https://cdn/clean.mp4');
    expect(clip.localAI).toMatchObject({ op: 'watermark-removed', originalSrc: 'https://cdn/mine.mp4' });
    const stock = { id: 's', type: 'video', s: 0, d: 2, src: 'https://videos.pexels.com/x.mp4' };
    expect(isStockClip(stock)).toBe(true);
    await expect(removeWatermark(ed, stock, { run, rightsConfirmed: true })).rejects.toThrow(/stock/);
  });
});
