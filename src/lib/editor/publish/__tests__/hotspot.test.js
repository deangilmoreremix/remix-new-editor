import { describe, it, expect, vi, beforeEach } from 'vitest';
import '../../addons/index.js';
import { getAddon, createAddonClip, addonOptions } from '../../addons/index.js';
import { hotspotElement } from '../viewerOverlays.js';
import { mountWatchPage } from '../../../../pages/WatchPage.jsx';
import { timelineToComposition } from '../../remotion/timelineToComposition.js';
import { ctaLabels } from '../sections.js';
import { conversionRows } from '../../projectLibrary/analytics/analyticsData.js';

const T = 20;
const pct = (sec) => (sec / T) * 100;
const clipAt = (start, end, extra) => ({ left: pct(start), width: pct(end - start), ...extra });

function project(hotspots) {
  return {
    version: 1, title: 'Demo', timelineSeconds: T,
    tracks: [
      { id: 'v', type: 'video', items: [clipAt(0, 20, { id: 'vid', type: 'video', src: 'https://cdn/x.mp4' })] },
      { id: 't', type: 'text', items: hotspots },
    ],
    listBuilder: null,
  };
}

function fakeEngine() {
  const e = { frame: 0, playing: false, model: null, onFrame: null };
  const create = (host, o) => {
    e.model = o.model; e.onFrame = o.onFrame; e.onEnded = o.onEnded;
    return {
      play: () => { e.playing = true; }, pause: () => { e.playing = false; },
      seekToFrame: (f) => { e.frame = f; }, update: (m) => { e.model = m; }, destroy: vi.fn(),
    };
  };
  e.advance = (sec) => { if (e.playing) { e.frame = Math.round(sec * 30); e.onFrame(e.frame); } };
  return { e, create };
}

const link = clipAt(2, 8, { id: 'hs-link', type: 'addon-hotspot', addon: { label: 'Book a demo', action: 'link', linkMode: 'url', linkUrl: 'https://example.com/demo', geometry: { left: 10, top: 20, width: 30, height: 25 } } });
const jump = clipAt(2, 8, { id: 'hs-jump', type: 'addon-hotspot', addon: { label: 'Skip to pricing', action: 'seek', seekTime: 12, geometry: { left: 50, top: 50, width: 20, height: 20 } } });

describe('hotspot addon', () => {
  it('is a registered, viewer-only interactive addon (left out of exports with a warning)', () => {
    expect(getAddon('addon-hotspot').category).toBe('interactive');
    const clip = createAddonClip('addon-hotspot', { startSec: 1, timelineSeconds: 20 });
    expect(addonOptions(clip)).toMatchObject({ action: 'link', seekTime: 0 });
    const model = timelineToComposition(project([link]), {});
    expect(model.skipped.map((s) => s.type)).toEqual(['addon-hotspot']);
    expect(model.layers.some((l) => l.type === 'addon-hotspot')).toBe(false);
  });

  it('builds a link, call or jump area and refuses an empty one', () => {
    const a = hotspotElement({ id: 1, type: 'addon-hotspot', addon: { action: 'link', linkMode: 'url', linkUrl: 'https://example.com', label: 'Go', highlight: true, geometry: { left: 5, top: 6, width: 7, height: 8 } } });
    expect(a.tagName).toBe('A');
    expect(a.getAttribute('href')).toBe('https://example.com/');
    expect(a.target).toBe('_blank');
    expect(a.classList.contains('wf-hotspot--hint')).toBe(true);
    expect(a.style.left).toBe('5%');
    const tel = hotspotElement({ id: 2, type: 'addon-hotspot', addon: { action: 'link', linkMode: 'phone', phoneCountry: '1', phoneNumber: '234 567 8900' } });
    expect(tel.getAttribute('href')).toBe('tel:+12345678900');
    const seek = hotspotElement({ id: 3, type: 'addon-hotspot', addon: { action: 'seek', seekTime: 5 } });
    expect(seek.tagName).toBe('BUTTON');
    expect(hotspotElement({ id: 4, type: 'addon-hotspot', addon: { action: 'link', linkUrl: 'javascript:alert(1)' } })).toBeNull();
    expect(hotspotElement({ id: 5, type: 'addon-hotspot', addon: { action: 'seek', seekTime: -1 } })).toBeNull();
  });

  it('labels hotspots for analytics and the dashboard', () => {
    expect(ctaLabels(project([link]))['hs-link']).toBe('Book a demo');
    expect(conversionRows([{ type: 'overlay_click', clip_id: 'hs-link', label: 'Book a demo', sessions: 3 }])[0]).toEqual({ label: 'Hotspot: Book a demo', clicks: 3, uniqueSessions: 3 });
  });
});

describe('hotspot on the published player', () => {
  let box;
  beforeEach(() => {
    document.body.innerHTML = '';
    box = document.createElement('div');
    document.body.appendChild(box);
    // jsdom cannot navigate; the click still bubbles through the page's handlers first.
    document.addEventListener('click', (ev) => { if (ev.target.closest?.('a')) ev.preventDefault(); });
  });

  it('shows only during its time range, and a link click is one overlay_click (not a CTA click)', async () => {
    const { e, create } = fakeEngine();
    const analytics = { track: vi.fn(), onPlayerChange: vi.fn(), destroy: vi.fn() };
    const player = await mountWatchPage(box, 'abcdefgh12', { fetchVideo: async () => ({ id: 'abcdefgh12', title: 'Demo', project: project([link]) }), createEngine: create, analytics, onLead: vi.fn() });
    expect(box.querySelector('.wf-hotspot')).toBeNull();
    box.querySelector('[data-bigplay]').click();
    e.advance(3);
    const el = box.querySelector('.wf-hotspot');
    expect(el.getAttribute('href')).toBe('https://example.com/demo');
    el.click();
    const calls = analytics.track.mock.calls.filter(([type]) => ['overlay_click', 'cta_click', 'call_click'].includes(type));
    expect(calls).toHaveLength(1);
    expect(calls[0][0]).toBe('overlay_click');
    expect(calls[0][1]).toMatchObject({ clip: 'hs-link', props: { label: 'Book a demo' } });
    e.advance(9);
    expect(box.querySelector('.wf-hotspot')).toBeNull();
    player.destroy();
  });

  it('a jump hotspot seeks, keeps playing and is tracked', async () => {
    const { e, create } = fakeEngine();
    const analytics = { track: vi.fn(), onPlayerChange: vi.fn(), destroy: vi.fn() };
    const player = await mountWatchPage(box, 'abcdefgh12', { fetchVideo: async () => ({ id: 'abcdefgh12', title: 'Demo', project: project([jump]) }), createEngine: create, analytics, onLead: vi.fn() });
    box.querySelector('[data-bigplay]').click();
    e.advance(3);
    box.querySelector('.wf-hotspot').click();
    expect(player.time).toBeCloseTo(12, 1);
    expect(e.playing).toBe(true);
    expect(analytics.track).toHaveBeenCalledWith('overlay_click', expect.objectContaining({ clip: 'hs-jump', props: { label: 'Skip to pricing' } }));
    player.destroy();
  });
});
