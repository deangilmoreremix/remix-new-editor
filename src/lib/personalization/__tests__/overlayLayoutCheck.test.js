import { describe, it, expect, vi } from 'vitest';
import { overlaysFromTimeline, checkOverlayGeometry, checkTextContrast, checkOverlays, videoSampleRequests, samplesToTimeline, measureTimelineFrames } from '../layoutCheck.js';

const text = (id, geometry, extra = {}) => ({ id, type: 'overlay-text', start: 0, end: 10, addon: { text: 'Hello', fontColor: '#FFFFFF', geometry, ...extra.addon }, ...extra.clip });
const image = (id, geometry, src = '{{logoUrl}}', extra = {}) => ({ id, type: 'overlay-personalized-image', start: 0, end: 10, addon: { src, geometry }, ...extra });
const state = (...clips) => ({ timelineSeconds: 10, tracks: [{ type: 'text', items: clips }] });

describe('overlaysFromTimeline', () => {
  it('reads text and image overlays with their real rectangles, resolving tokens', () => {
    const profile = { id: 'c', name: 'Ann', personalization: { business: { businessName: 'Acme' } } };
    const { overlays, notMeasured } = overlaysFromTimeline(state(text('a', { left: 10, top: 10, width: 30, height: 10 }, { addon: { text: 'Hi {{businessName}}' } }), image('b', { left: 80, top: 5, width: 15, height: 6 })), { profile });
    expect(overlays.map((o) => [o.id, o.kind])).toEqual([['clip:a', 'text'], ['clip:b', 'image']]);
    expect(overlays[0].text).toBe('Hi Acme');
    expect(overlays[1]).toMatchObject({ token: 'logoUrl', rect: { left: 80, top: 5, width: 15, height: 6 } });
    expect(notMeasured).toBe(0);
  });
  it('tags overlays made in the Personalize window and counts what it cannot measure', () => {
    const bridged = text('a', { left: 0, top: 0, width: 10, height: 10 }, { clip: { bridge: { source: 'personalize-modal', layerId: 'headline' } } });
    const lower = { id: 'lt', type: 'overlay-lower-third', start: 0, end: 5, addon: {} };
    const bg = { id: 'bg', type: 'overlay-background', start: 0, end: 5, addon: {} };
    const { overlays, notMeasured } = overlaysFromTimeline(state(bridged, lower, bg));
    expect(overlays[0].bridged).toBe(true);
    expect(notMeasured).toBe(1); // the lower third; the backdrop is full-frame by design
  });
  it('skips overlays without usable geometry and copes with an empty project', () => {
    expect(overlaysFromTimeline(state({ id: 'x', type: 'overlay-text', addon: {} })).overlays).toEqual([]);
    expect(overlaysFromTimeline(null)).toEqual({ overlays: [], notMeasured: 0 });
  });
});

describe('checkOverlayGeometry', () => {
  const ov = (id, rect, over = {}) => ({ id, name: id, kind: 'text', startSec: 0, endSec: 10, rect, bridged: false, ...over });
  it('flags an overlay reaching outside the frame', () => {
    const issues = checkOverlayGeometry([ov('a', { left: 90, top: 10, width: 20, height: 10 })]);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ code: 'off-frame', layerId: 'a', fixable: false });
    expect(checkOverlayGeometry([ov('a', { left: 80, top: 10, width: 20, height: 10 })])).toEqual([]);
  });
  it('flags two overlays on top of each other at the same time, not at different times', () => {
    const a = ov('a', { left: 10, top: 10, width: 30, height: 10 });
    const b = ov('b', { left: 12, top: 11, width: 30, height: 10 });
    expect(checkOverlayGeometry([a, b])[0]).toMatchObject({ code: 'overlay-collision', layerId: 'a' });
    expect(checkOverlayGeometry([a, { ...b, startSec: 20, endSec: 30 }])).toEqual([]);
  });
  it('does not call a wide logo beside text a collision, because it uses the real rectangle', () => {
    const logo = ov('logo', { left: 76, top: 4, width: 20, height: 7 }, { kind: 'image' });
    const title = ov('title', { left: 10, top: 40, width: 50, height: 10 });
    expect(checkOverlayGeometry([logo, title])).toEqual([]);
  });
  it('treats a near-full-frame overlay as a backdrop, not a collision (an end card under its text)', () => {
    const card = ov('card', { left: 0, top: 0, width: 100, height: 100 }, { kind: 'image' });
    expect(checkOverlayGeometry([card, ov('t', { left: 10, top: 30, width: 80, height: 40 })])).toEqual([]);
  });
  it('marks an issue fixable when the placement engine may move one of the overlays', () => {
    const a = ov('a', { left: 10, top: 10, width: 30, height: 10 }, { bridged: true });
    const b = ov('b', { left: 12, top: 11, width: 30, height: 10 });
    expect(checkOverlayGeometry([a, b])[0].fixable).toBe(true);
  });
});

const grid = (value) => ({ t: 0, cols: 4, rows: 4, luma: Array(16).fill(value) });
describe('checkTextContrast', () => {
  const ov = (over = {}) => ({ id: 'clip:a', name: 'Title', kind: 'text', text: 'Hello', color: '#FFFFFF', hasBackground: false, startSec: 0, endSec: 10, rect: { left: 10, top: 10, width: 40, height: 10 }, ...over });
  it('flags white text on a bright frame and passes it on a dark one', () => {
    expect(checkTextContrast([ov()], [grid(0.95)])[0]).toMatchObject({ code: 'low-contrast', layerId: 'clip:a' });
    expect(checkTextContrast([ov()], [grid(0.05)])).toEqual([]);
  });
  it('ignores text with its own background, empty text and images', () => {
    expect(checkTextContrast([ov({ hasBackground: true })], [grid(0.95)])).toEqual([]);
    expect(checkTextContrast([ov({ text: '  ' })], [grid(0.95)])).toEqual([]);
    expect(checkTextContrast([ov({ kind: 'image' })], [grid(0.95)])).toEqual([]);
  });
});

describe('checkOverlays', () => {
  const text1 = { id: 'clip:a', name: 'Title', kind: 'text', text: 'Hello', color: '#FFFFFF', hasBackground: false, startSec: 0, endSec: 10, rect: { left: 10, top: 10, width: 40, height: 10 }, bridged: false };
  it('is honest that readability was not measured, and what it never checks', () => {
    const r = checkOverlays({ overlays: [text1] });
    expect(r.status).toBe('review-required');
    expect(r.issues[0].code).toBe('contrast-unverified');
    expect(r.notes.join(' ')).toMatch(/subject of the video/);
  });
  it('says when the video could not be read', () => {
    expect(checkOverlays({ overlays: [text1], frames: 'unavailable' }).issues[0].message).toMatch(/could not be read/);
  });
  it('uses measured frames', () => {
    const r = checkOverlays({ overlays: [text1], samples: [grid(0.95)], frames: 'measured' });
    expect(r.status).toBe('needs-adjustment');
    expect(r.issues.map((i) => i.code)).toEqual(['low-contrast']);
    expect(checkOverlays({ overlays: [text1], samples: [grid(0.05)], frames: 'measured' }).status).toBe('ready');
  });
  it('mentions overlays it cannot measure', () => {
    expect(checkOverlays({ overlays: [], notMeasured: 2 }).notes[0]).toMatch(/2 other overlays/);
  });
});

describe('measuring frames', () => {
  const video = (id, start, end, extra = {}) => ({ id, type: 'video', src: `https://a.test/${id}.mp4`, start, end, ...extra });
  const st = (...clips) => ({ timelineSeconds: 20, tracks: [{ type: 'video', items: clips }, { type: 'text', items: [text('t', { left: 0, top: 0, width: 10, height: 10 })] }] });

  it('plans source times that cover the part of the clip the timeline plays', () => {
    const [req] = videoSampleRequests(st(video('v', 5, 15, { trimIn: 2 })));
    expect(req).toMatchObject({ clipId: 'v', start: 5, end: 15, trimIn: 2 });
    expect(req.times[0]).toBe(2);
    expect(Math.max(...req.times)).toBeLessThanOrEqual(2 + 10);
    expect(req.times).toHaveLength(7);
    expect(videoSampleRequests(st({ id: 'x', type: 'image', src: 'a' }))).toEqual([]);
  });
  it('relabels source time as timeline time and drops samples outside the played part', () => {
    const req = { start: 5, end: 15, trimIn: 2 };
    expect(samplesToTimeline([{ t: 2 }, { t: 7 }, { t: 30 }], req).map((s) => s.t)).toEqual([5, 10]);
  });
  it('measures every clip, counts the ones it cannot read, and never guesses', async () => {
    const sampler = vi.fn(async (url) => (url.includes('bad') ? null : { samples: [{ t: 0, cols: 1, rows: 1, luma: [0.5] }], durationSec: 10 }));
    const r = await measureTimelineFrames(st(video('good', 0, 10), video('bad', 10, 20)), { sampler });
    expect(r).toMatchObject({ failed: 1, clips: 2 });
    expect(r.samples).toHaveLength(1);
    expect(sampler.mock.calls[0][1].composition).toEqual({ width: 1920, height: 1080 });
  });
  it('stops when cancelled', async () => {
    const ctl = new AbortController(); ctl.abort();
    const sampler = vi.fn();
    expect((await measureTimelineFrames(st(video('a', 0, 10)), { sampler, signal: ctl.signal })).samples).toEqual([]);
    expect(sampler).not.toHaveBeenCalled();
  });
});
