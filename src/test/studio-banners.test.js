import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import { createStudioHeader, createEditorBanner, getHeroThumbnail } from '../lib/thumbnails.js';

// Every picture a banner points at must exist, otherwise the banner is a blank box.
const heroPaths = () => {
  const src = fs.readFileSync('src/lib/thumbnails.js', 'utf-8');
  const block = src.match(/const HERO_THUMBNAILS = \{([\s\S]*?)\n\};/)[1];
  return [...block.matchAll(/^\s*'?([\w-]+)'?:\s*'([^']+)'/gm)].map((m) => ({ id: m[1], path: m[2] }));
};

describe('studio banners', () => {
  it('every registered banner picture exists on disk', () => {
    const missing = heroPaths().filter((h) => !fs.existsSync(`public${h.path}`)).map((h) => h.id);
    expect(missing).toEqual([]);
  });

  it('has a banner picture for the full-screen editors and the other pages that were missing one', () => {
    for (const id of ['director', 'workbench', 'viral', 'personalizer', 'website-builder', 'timeline', 'video-agent', 'cinema-template']) {
      expect(getHeroThumbnail(id), id).toBeTruthy();
    }
  });

  it('the new banners are not another page\'s picture', () => {
    const paths = ['director', 'workbench', 'viral', 'personalizer', 'website-builder'].map(getHeroThumbnail);
    expect(new Set(paths).size).toBe(paths.length);
    expect(paths).not.toContain(getHeroThumbnail('video'));
    expect(paths).not.toContain(getHeroThumbnail('video-agent'));
  });

  it('is 128px / 176px tall (the old 96-112px box showed only a thin strip of the picture)', () => {
    const el = createStudioHeader('image', 'Image Studio', 'x');
    expect(el.className).toContain('h-32');
    expect(el.className).toContain('md:h-44');
    expect(el.className).toContain('hero-banner');
    expect(el.querySelector('img')).not.toBeNull();
  });

  it('aims the crop at the subject instead of the exact centre', () => {
    expect(createStudioHeader('audio', 'Audio Studio').querySelector('img').style.objectPosition).toBe('50% 47%');
    expect(createStudioHeader('character', 'Character Studio').querySelector('img').style.objectPosition).toBe('50% 20%');
  });

  it('the editor banner is the compact variant inside a non-shrinking row', () => {
    const row = createEditorBanner('director', 'Director', 'AI editor');
    expect(row.className).toContain('shrink-0');
    const banner = row.querySelector('.hero-banner');
    expect(banner.className).toContain('h-20');
    expect(banner.querySelector('h1').textContent).toBe('Director');
    expect(banner.querySelector('img').getAttribute('src')).toContain('/thumbnails/heroes/director.webp');
  });

  it('the Timeline Editor banner is added after the editor mounts (the editor replaces the container contents)', () => {
    const src = fs.readFileSync('src/components/TimelineEditorPage.jsx', 'utf-8');
    expect(src.indexOf('createTimelineEditorApp(container);')).toBeLessThan(src.indexOf("createEditorBanner('timeline'"));
    expect(src).not.toContain("createHeroSection('timeline'");
  });
});
