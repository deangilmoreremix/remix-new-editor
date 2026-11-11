import { describe, it, expect } from 'vitest';
import { multiCamBox, applyMultiCam, multiCamActive, normalizeMultiCam } from '../multiCam.js';
import { timelineToComposition } from '../remotion/timelineToComposition.js';
import { renderMultiCamPanel } from '../panels/multiCamPanel.js';

const tracks = () => ([
  { id: 'v1', type: 'video', name: 'Main Video', items: [{ id: 'a', type: 'video', src: 'https://x/a.mp4', left: 0, width: 50 }] },
  { id: 'v2', type: 'video', name: 'Camera 2', items: [{ id: 'b', type: 'video', src: 'https://x/b.mp4', left: 0, width: 50 }] },
  { id: 't', type: 'text', name: 'Titles', items: [{ id: 'h', type: 'text', heading: 'Hi', left: 0, width: 20 }] },
]);

describe('multiCamBox', () => {
  it('puts the second camera in the chosen corner at the chosen size, leaving the main full frame', () => {
    expect(multiCamBox({ mode: 'pip', pip: { corner: 'top-left', size: 25 } }, 'main')).toBeNull();
    const b = multiCamBox({ mode: 'pip', pip: { corner: 'bottom-right', size: 30 } }, 'second');
    expect(b.width).toBe(30);
    expect(b.left + b.width).toBeLessThan(100);
    expect(b.top + b.height).toBeLessThan(100);
    expect(multiCamBox({ mode: 'pip', pip: { corner: 'top-left', size: 30 } }, 'second')).toMatchObject({ left: 3 });
  });
  it('splits the frame by ratio, side by side or top and bottom', () => {
    expect(multiCamBox({ mode: 'split', split: { orientation: 'vertical', ratio: 0.5 } }, 'main')).toMatchObject({ left: 0, width: 50, height: 100 });
    expect(multiCamBox({ mode: 'split', split: { orientation: 'vertical', ratio: 0.5 } }, 'second')).toMatchObject({ left: 50, width: 50 });
    const h = multiCamBox({ mode: 'split', split: { orientation: 'horizontal', ratio: 0.6 } }, 'second');
    expect(h).toMatchObject({ left: 0, top: 60, width: 100, height: 40 });
  });
  it('clamps bad settings', () => {
    expect(normalizeMultiCam({ mode: 'x', pip: { size: 999 }, split: { ratio: 5 } })).toMatchObject({ mode: 'single', pip: { size: 60 }, split: { ratio: 0.8 } });
  });
});

describe('composition layers', () => {
  const build = (multiCam) => timelineToComposition({ timelineSeconds: 10, tracks: tracks(), multiCam }, { fps: 30 });
  it('is unchanged in single mode, or when the second track is missing', () => {
    expect(build(undefined).layers.every((l) => !l.box)).toBe(true);
    expect(build({ mode: 'pip', mainTrackId: 'v1', secondTrackId: 'nope' }).layers.every((l) => !l.box)).toBe(true);
  });
  it('gives the second camera a PiP box and draws it above the main one', () => {
    const m = build({ mode: 'pip', mainTrackId: 'v1', secondTrackId: 'v2', pip: { corner: 'bottom-left', size: 25 } });
    const media = m.layers.filter((l) => l.kind === 'video');
    expect(media.map((l) => l.id)).toEqual(['a', 'b']);
    expect(media[0].box).toBeUndefined();
    expect(media[1].box).toMatchObject({ width: 25 });
    expect(m.layers.findIndex((l) => l.id === 'h')).toBeGreaterThan(m.layers.findIndex((l) => l.id === 'b'));
  });
  it('splits the frame between the two cameras', () => {
    const m = build({ mode: 'split', mainTrackId: 'v1', secondTrackId: 'v2', split: { orientation: 'vertical', ratio: 0.5 } });
    const [a, b] = m.layers.filter((l) => l.kind === 'video');
    expect(a.box).toMatchObject({ left: 0, width: 50 });
    expect(b.box).toMatchObject({ left: 50, width: 50 });
  });
  it('multiCamActive needs two distinct video tracks', () => {
    expect(multiCamActive({ mode: 'pip', mainTrackId: 'v1', secondTrackId: 'v1' }, tracks())).toBe(false);
    expect(multiCamActive({ mode: 'pip', mainTrackId: 'v1', secondTrackId: 't' }, tracks())).toBe(false);
    expect(multiCamActive({ mode: 'split', mainTrackId: 'v1', secondTrackId: 'v2' }, tracks())).toBe(true);
  });
});

describe('Multi-Cam panel', () => {
  it('switches mode, adds a camera track and writes state.multiCam', () => {
    const state = { tracks: tracks().slice(0, 1), selectedClipId: 'a' };
    const el = document.createElement('div');
    let changed = 0;
    const s = { changed: () => { changed += 1; }, toast: () => {}, addVideoTrack: () => { const t = { id: 'v2', type: 'video', name: 'Camera 2', items: [] }; state.tracks.push(t); return t; }, moveSelectedTo: () => true };
    renderMultiCamPanel(el, state, s);
    el.querySelector('[data-mc-act="add-track"]').click();
    expect(state.multiCam.secondTrackId).toBe('v2');
    el.querySelector('[data-mc-mode="pip"]').click();
    expect(state.multiCam.mode).toBe('pip');
    expect(el.querySelector('[data-mc="size"]')).toBeTruthy();
    el.querySelector('[data-mc-mode="split"]').click();
    expect(el.querySelector('[data-mc="orientation"]')).toBeTruthy();
    expect(changed).toBeGreaterThan(2);
  });
  it('warns when the layout has no second camera yet', () => {
    const state = { tracks: tracks().slice(0, 1), multiCam: { mode: 'pip' } };
    const el = document.createElement('div');
    renderMultiCamPanel(el, state, {});
    expect(el.textContent).toMatch(/Choose a second camera/);
  });
});
