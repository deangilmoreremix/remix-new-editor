import { describe, it, expect, afterEach, vi } from 'vitest';
import { createDemoPlayer, tourFor, formatDuration } from '../common/demoPlayer.js';
import { ProductDemoSection } from '../sections/ProductDemoSection.jsx';
import { StudioDemosSection } from '../sections/StudioDemosSection.jsx';
import { StudioGuidesSection } from '../sections/StudioGuidesSection.jsx';
import GUIDE_VIDEOS from '../../../data/guideVideos.json';

afterEach(() => { document.body.innerHTML = ''; });

describe('demo player', () => {
  it('formats durations', () => {
    expect(formatDuration(112)).toBe('1:52');
    expect(formatDuration(59)).toBe('0:59');
  });

  it('downloads nothing until play is clicked, then shows a controlled video with captions', () => {
    const el = createDemoPlayer({ label: 'Demo', poster: '/p.webp', src: '/v.mp4', captions: '/c.vtt' });
    document.body.appendChild(el);
    expect(el.querySelector('video')).toBeNull();
    el.querySelector('button').click();
    const v = el.querySelector('video');
    expect(v.controls).toBe(true);
    expect(v.getAttribute('src')).toBe('/v.mp4');
    expect(v.crossOrigin).toBe('anonymous'); // needed for cross-origin caption tracks
    expect(v.querySelector('track[kind="captions"]').getAttribute('src')).toBe('/c.vtt');
  });

  it('builds tour URLs and returns null for a studio with no tour', () => {
    expect(tourFor('cinema-studio').mp4).toMatch(/\/cinema-studio\/tour\.mp4$/);
    expect(tourFor('nope')).toBeNull();
  });
});

describe('landing demo sections', () => {
  it('Product Demo renders its heading and a play button, no video yet', () => {
    const s = ProductDemoSection();
    expect(s.id).toBe('product-demo');
    expect(s.querySelector('h2').textContent).toMatch(/whole platform/);
    expect(s.querySelector('button[aria-label^="Play video"]')).not.toBeNull();
    expect(s.querySelector('video')).toBeNull();
  });

  it('the Product Demo link reaches Studio Demos even before that section has lazy-loaded', () => {
    vi.useFakeTimers();
    const placeholder = document.createElement('div');
    placeholder.id = 'section-studio-demos';
    placeholder.scrollIntoView = vi.fn();
    document.body.appendChild(placeholder);
    const s = ProductDemoSection();
    document.body.appendChild(s);
    s.querySelector('a[href="#studio-demos"]').click();
    expect(placeholder.scrollIntoView).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(2000);
    expect(placeholder.scrollIntoView).toHaveBeenCalledTimes(3);
    vi.useRealTimers();
  });

  it('Studio Demos shows the featured picker and switches the featured tour', () => {
    const s = StudioDemosSection();
    const picks = () => s.querySelectorAll('[data-demo-slug]');
    expect(picks().length).toBe(12);
    expect(picks()[0].getAttribute('aria-pressed')).toBe('true');
    picks()[2].click();
    expect(picks()[2].getAttribute('aria-pressed')).toBe('true');
    expect(picks()[0].getAttribute('aria-pressed')).toBe('false');
    expect(s.querySelector('[data-demo-guide]').getAttribute('href')).toMatch(/^\/studios\/.+\/$/);
    expect(s.querySelector('[data-demo-player] video')).toBeNull();
  });

  it('Studio Demos makes every tour reachable through the All and category tabs', () => {
    const s = StudioDemosSection();
    const total = Object.keys(GUIDE_VIDEOS.studios).length;
    const tab = (key) => s.querySelector(`[data-demo-tab="${key}"]`);
    tab('all').click();
    expect(s.querySelectorAll('[data-demo-slug]').length).toBe(total);
    expect(tab('all').getAttribute('aria-pressed')).toBe('true');
    // category tabs together cover every tour exactly once
    const cats = Array.from(s.querySelectorAll('[data-demo-tab]')).map((b) => b.getAttribute('data-demo-tab')).filter((k) => k !== 'featured' && k !== 'all');
    const seen = new Set();
    cats.forEach((k) => { tab(k).click(); s.querySelectorAll('[data-demo-slug]').forEach((b) => seen.add(b.getAttribute('data-demo-slug'))); });
    expect(seen.size).toBe(total);
    // a tour picked from a non-featured tab still loads into the player
    const last = Array.from(s.querySelectorAll('[data-demo-slug]')).pop();
    last.click();
    expect(s.querySelector('[data-demo-guide]').getAttribute('href')).toBe(`/studios/${last.getAttribute('data-demo-slug')}/`);
  });

  it('Studio Guides keeps every link and adds tour lengths', () => {
    const s = StudioGuidesSection();
    expect(s.querySelectorAll('a[href^="/studios/"]').length).toBeGreaterThan(40);
    expect(s.textContent).toMatch(/▶ \d+:\d\d tour/);
    expect(s.textContent).toMatch(/Browse all studio guides/);
  });
});
