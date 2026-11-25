import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import CLIPS from '../../../data/studioClips.json';
import { clipUrl, startClip, stopClip } from '../common/clipPreview.js';
import { StudioDemosSection } from '../sections/StudioDemosSection.jsx';

beforeEach(() => {
  window.matchMedia = vi.fn().mockImplementation((q) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {} }));
  HTMLMediaElement.prototype.play = vi.fn(() => Promise.resolve());
  HTMLMediaElement.prototype.pause = vi.fn();
});
afterEach(() => { document.body.innerHTML = ''; });

const tile = (slug) => {
  const b = document.createElement('button');
  b.setAttribute('data-demo-slug', slug);
  b.innerHTML = '<span data-clip-frame></span>';
  return b;
};

describe('studio clip previews', () => {
  it('only studios listed in the manifest have a clip url', () => {
    expect(CLIPS.slugs.length).toBe(41);
    expect(clipUrl(CLIPS.slugs[0])).toBe(`${CLIPS.base}/${CLIPS.slugs[0]}.mp4`);
    expect(clipUrl('timeline-editor')).toBeNull();
  });

  it('plays a muted looping inline clip on start and pauses on stop, creating it once', () => {
    const t = tile(CLIPS.slugs[0]);
    startClip(t); startClip(t);
    const vids = t.querySelectorAll('video');
    expect(vids.length).toBe(1);
    expect(vids[0].muted).toBe(true);
    expect(vids[0].loop).toBe(true);
    expect(vids[0].preload).toBe('none');
    stopClip(t);
    expect(HTMLMediaElement.prototype.pause).toHaveBeenCalled();
  });

  it('removes the clip when it fails to load, leaving the still thumbnail', () => {
    const t = tile(CLIPS.slugs[0]);
    startClip(t);
    t.querySelector('video').dispatchEvent(new Event('error'));
    expect(t.querySelector('video')).toBeNull();
  });

  it('does nothing for a studio without a clip, or with reduced motion', () => {
    const none = tile('timeline-editor'); startClip(none);
    expect(none.querySelector('video')).toBeNull();
    window.matchMedia = vi.fn().mockImplementation((q) => ({ matches: q.includes('reduce'), media: q, addEventListener() {}, removeEventListener() {} }));
    const t = tile(CLIPS.slugs[0]); startClip(t);
    expect(t.querySelector('video')).toBeNull();
  });

  it('the picker plays the selected tile and a hovered tile, and downloads nothing for the rest', () => {
    const s = StudioDemosSection();
    document.body.appendChild(s);
    const tiles = s.querySelectorAll('[data-demo-slug]');
    expect(tiles[0].querySelector('video')).not.toBeNull(); // selected tile
    expect(s.querySelectorAll('[data-clip-frame] video').length).toBe(1);
    tiles[1].dispatchEvent(new Event('focusin', { bubbles: true }));
    expect(tiles[1].querySelector('video')).not.toBeNull();
    expect(tiles[2].querySelector('video')).toBeNull();
  });
});
