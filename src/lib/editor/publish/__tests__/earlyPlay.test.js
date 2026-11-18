// Regression: a Play pressed on /watch before the player is wired (markup rendered, lazy engine module still loading) was lost.
import { describe, it, expect, vi } from 'vitest';
import { captureEarlyPlay } from '../earlyPlay.js';
import { mountWatchPage } from '../../../../pages/WatchPage.jsx';

const markup = () => {
  const box = document.createElement('div');
  box.innerHTML = '<div data-frame><div data-stage></div><button data-bigplay>▶</button></div><button data-play aria-label="Play">▶</button><input data-seek type="range"/>';
  document.body.appendChild(box);
  return box;
};

describe('captureEarlyPlay', () => {
  it('big play before wiring: pending state, then exactly one play() on release', () => {
    const box = markup();
    const early = captureEarlyPlay(box);
    box.querySelector('[data-bigplay]').click();
    box.querySelector('[data-bigplay]').click(); // double press: still one intent
    expect(early.pending).toBe(true);
    expect(box.querySelector('[data-stage]').hasAttribute('data-play-pending')).toBe(true);
    expect(box.querySelector('[data-play]').getAttribute('aria-label')).toBe('Pause');
    const player = { play: vi.fn() };
    expect(early.release(player)).toBe(true);
    expect(early.release(player)).toBe(false);
    expect(player.play).toHaveBeenCalledTimes(1);
    expect(box.querySelector('[data-stage]').hasAttribute('data-play-pending')).toBe(false);
    box.querySelector('[data-bigplay]').click(); // listeners are gone after release
    expect(player.play).toHaveBeenCalledTimes(1);
  });
  it('play button and Space toggle; pressing twice cancels; no press -> nothing starts', () => {
    const box = markup();
    const early = captureEarlyPlay(box);
    const seek = box.querySelector('[data-seek]');
    seek.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true }));
    expect(early.pending).toBe(true);
    box.querySelector('[data-play]').click(); // toggles back off
    expect(early.pending).toBe(false);
    expect(box.querySelector('[data-bigplay]').hidden).toBe(false);
    const player = { play: vi.fn() };
    expect(early.release(player)).toBe(false);
    expect(player.play).not.toHaveBeenCalled();
  });
});

describe('mountWatchPage: Play pressed while the engine module is still loading', () => {
  it('starts playback once the player is wired, and only once', async () => {
    const box = document.createElement('div');
    document.body.appendChild(box);
    const plays = [];
    const create = (host, o) => ({ play: () => plays.push(1), pause: () => {}, seekToFrame: () => {}, update: () => {}, destroy: () => {}, isPlaying: () => false, onFrame: o.onFrame });
    const project = { version: 1, title: 'Demo', timelineSeconds: 10, tracks: [{ id: 'v', type: 'video', items: [{ left: 0, width: 100, id: 'vid', type: 'video', src: 'https://cdn/x.mp4' }] }], listBuilder: null };
    const analytics = { track: vi.fn(), onPlayerChange: vi.fn(), destroy: vi.fn() };
    const deps = {
      fetchVideo: async () => ({ id: 'abcdefgh12', title: 'Demo', project }), analytics, onLead: vi.fn(),
      // Reading deps.createEngine happens after the markup exists and before anything is wired: press Play right there.
      get createEngine() { box.querySelector('[data-bigplay]').click(); box.querySelector('[data-bigplay]').click(); return create; },
    };
    const player = await mountWatchPage(box, 'abcdefgh12', deps);
    expect(plays.length).toBe(1);
    expect(player.playing).toBe(true);
    expect(box.querySelector('[data-play]').getAttribute('aria-label')).toBe('Pause');
    expect(box.querySelector('[data-stage]').hasAttribute('data-play-pending')).toBe(false);
    player.destroy();
  });
});
