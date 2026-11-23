import { describe, it, expect, vi, beforeEach } from 'vitest';
import '../../addons/index.js';
import { getAddon, createAddonClip, addonOptions, pathChoices } from '../../addons/index.js';
import { pathChoiceElement } from '../viewerOverlays.js';
import { mountWatchPage } from '../../../../pages/WatchPage.jsx';
import { timelineToComposition } from '../../remotion/timelineToComposition.js';
import { buildOverlayElement } from '../../addons/overlayRender.js';

const T = 30;
const pct = (sec) => (sec / T) * 100;
const clipAt = (start, end, extra) => ({ left: pct(start), width: pct(end - start), ...extra });

const choice = clipAt(2, 7, {
  id: 'pc', type: 'addon-path-choice',
  addon: {
    heading: 'Pick one', thenTime: 25,
    choice1Label: 'Pricing', choice1From: 10, choice1Until: 15,
    choice2Label: 'Features', choice2From: 18, choice2Until: 0,
    choice3Label: '', choice4Label: '',
  },
});
const project = () => ({
  version: 1, title: 'Demo', timelineSeconds: T,
  tracks: [
    { id: 'v', type: 'video', items: [clipAt(0, 30, { id: 'vid', type: 'video', src: 'https://cdn/x.mp4' })] },
    { id: 't', type: 'text', items: [choice] },
  ],
  listBuilder: null,
});

function fakeEngine() {
  const e = { frame: 0, playing: false, onFrame: null };
  const create = (host, o) => {
    e.onFrame = o.onFrame; e.onEnded = o.onEnded;
    return { play: () => { e.playing = true; }, pause: () => { e.playing = false; }, seekToFrame: (f) => { e.frame = f; }, update: () => {}, destroy: vi.fn() };
  };
  e.advance = (sec) => { if (e.playing) { e.frame = Math.round(sec * 30); e.onFrame(e.frame); } };
  return { e, create };
}

describe('Choose your path addon', () => {
  it('is registered, keeps only labelled choices, and stays out of exports', () => {
    expect(getAddon('addon-path-choice').behavior).toBe('path');
    const clip = createAddonClip('addon-path-choice', { startSec: 1, timelineSeconds: T });
    expect(pathChoices(addonOptions(clip)).map((c) => c.label)).toEqual(['Option A', 'Option B']);
    expect(pathChoices({ choice1Label: 'A', choice1From: 3, choice1Until: 2 })[0]).toEqual({ label: 'A', from: 3, until: 0 });
    expect(pathChoices({ choice1Label: '', choice1From: 3 })).toEqual([]);
    const model = timelineToComposition(project(), {});
    expect(model.skipped.map((s) => s.type)).toEqual(['addon-path-choice']);
  });

  it('builds a card with one button per choice and refuses a single choice', () => {
    const picked = vi.fn();
    const el = pathChoiceElement(choice, { onPick: picked });
    expect([...el.querySelectorAll('button')].map((b) => b.textContent)).toEqual(['Pricing', 'Features']);
    el.querySelector('button').click();
    expect(picked).toHaveBeenCalledWith(expect.objectContaining({ label: 'Pricing' }));
    expect(pathChoiceElement({ id: 1, type: 'addon-path-choice', addon: { choice1Label: 'Only', choice1From: 1, choice2Label: '' } })).toBeNull();
  });

  it('shows a labelled box in the editor', () => {
    const el = buildOverlayElement({ ...choice, left: 0 }, { editor: true });
    expect(el.textContent).toContain('Pricing');
    expect(el.textContent).toContain('Features');
  });
});

describe('Choose your path on the published player', () => {
  let box;
  beforeEach(() => { document.body.innerHTML = ''; box = document.createElement('div'); document.body.appendChild(box); });

  async function mount(analytics) {
    const { e, create } = fakeEngine();
    const player = await mountWatchPage(box, 'abcdefgh12', { fetchVideo: async () => ({ id: 'abcdefgh12', title: 'Demo', project: project() }), createEngine: create, analytics, onLead: vi.fn() });
    box.querySelector('[data-bigplay]').click();
    return { e, player };
  }
  const analytics = () => ({ track: vi.fn(), onPlayerChange: vi.fn(), destroy: vi.fn() });

  it('pauses at the card; a pick jumps to its start, plays, and is tracked as a click', async () => {
    const a = analytics();
    const { e, player } = await mount(a);
    e.advance(2.5);
    expect(e.playing).toBe(false);
    const buttons = box.querySelectorAll('.wf-pathchoice__btn');
    expect(buttons).toHaveLength(2);
    buttons[1].click();
    expect(player.time).toBeCloseTo(18, 1);
    expect(e.playing).toBe(true);
    expect(box.querySelector('.wf-pathchoice')).toBeNull();
    expect(a.track).toHaveBeenCalledWith('overlay_click', expect.objectContaining({ clip: 'pc', props: { label: 'Path: Features' } }));
    player.destroy();
  });

  it('a route with an end hops to the continue point when it gets there', async () => {
    const { e, player } = await mount(analytics());
    e.advance(2.5);
    box.querySelectorAll('.wf-pathchoice__btn')[0].click();
    expect(player.time).toBeCloseTo(10, 1);
    e.advance(12);
    expect(player.time).toBeCloseTo(12, 1);
    e.advance(15.2);
    expect(player.time).toBeCloseTo(25, 1);
    player.destroy();
  });
});
