import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { createLandingVideo, mountLandingVideos, videoSlot } from '../common/landingVideo.js';

const setReducedMotion = (on) => {
  window.matchMedia = vi.fn().mockImplementation((q) => ({ matches: on && q.includes('prefers-reduced-motion'), media: q, addEventListener() {}, removeEventListener() {} }));
};
let ioCallback;
beforeEach(() => {
  setReducedMotion(false);
  ioCallback = null;
  global.IntersectionObserver = class { constructor(cb) { ioCallback = cb; } observe() {} disconnect() {} };
  HTMLMediaElement.prototype.load = vi.fn();
  HTMLMediaElement.prototype.play = vi.fn(() => Promise.resolve());
  HTMLMediaElement.prototype.pause = vi.fn();
});
afterEach(() => { document.body.innerHTML = ''; });

describe('landing product videos', () => {
  it('is a muted, looping, inline, metadata-preloaded video with a poster', () => {
    const el = createLandingVideo({ name: 'a-hero-loop', label: 'Demo', eager: true, webm: true });
    const v = el.querySelector('video');
    expect(v.muted).toBe(true);
    expect(v.loop).toBe(true);
    expect(v.playsInline).toBe(true);
    expect(v.autoplay).toBe(true);
    expect(v.preload).toBe('metadata');
    expect(v.getAttribute('poster')).toBe('/landing-videos/a-hero-loop.poster.webp');
    expect([...v.querySelectorAll('source')].map((s) => s.type)).toEqual(['video/webm', 'video/mp4']);
  });

  it('does not fetch a below-the-fold video until it nears the viewport, then pauses when it leaves', () => {
    const el = createLandingVideo({ name: 'c04-image-studio', label: 'Image Studio' });
    const v = el.querySelector('video');
    expect(v.querySelectorAll('source')).toHaveLength(0);
    ioCallback([{ isIntersecting: true }]);
    expect(v.querySelectorAll('source')).toHaveLength(1);
    expect(v.querySelector('source').src).toContain('/landing-videos/c04-image-studio.mp4');
    ioCallback([{ isIntersecting: false }]);
    expect(HTMLMediaElement.prototype.pause).toHaveBeenCalled();
  });

  it('respects prefers-reduced-motion: poster image only, no video element', () => {
    setReducedMotion(true);
    const el = createLandingVideo({ name: 'c01-hero-prompt', label: 'Typing a prompt' });
    expect(el.querySelector('video')).toBeNull();
    const img = el.querySelector('img');
    expect(img.getAttribute('src')).toBe('/landing-videos/c01-hero-prompt.poster.webp');
    expect(img.alt).toBe('Typing a prompt');
  });

  it('mounts videos in place of slots and escapes labels', () => {
    const root = document.createElement('div');
    root.innerHTML = videoSlot('c12-templates', 'The "template" <library>', { className: 'aspect-video' });
    expect(root.querySelector('[data-lv-slot]')).not.toBeNull();
    mountLandingVideos(root);
    expect(root.querySelector('[data-lv-slot]')).toBeNull();
    const v = root.querySelector('[data-landing-video="c12-templates"] video');
    expect(v.getAttribute('aria-label')).toBe('The "template" <library>');
    expect(root.querySelector('[data-landing-video]').className).toContain('aspect-video');
  });
});
