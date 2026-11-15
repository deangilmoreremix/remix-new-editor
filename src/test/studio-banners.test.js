import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import { createStudioHeader, createEditorBanner, getHeroThumbnail, getBannerThumbnail, getStudioThumbnail } from '../lib/thumbnails.js';

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

  it('is 128px tall on phones and 176-264px on desktop (scales with width so the picture is not a thin strip)', () => {
    const el = createStudioHeader('image', 'Image Studio', 'x');
    expect(el.className).toContain('h-32');
    expect(el.className).toContain('md:h-[clamp(176px,14vw,264px)]');
    expect(el.className).toContain('hero-banner');
    expect(el.querySelector('img')).not.toBeNull();
  });

  it('aims the crop at the subject instead of the exact centre', () => {
    const sharp = (id) => createStudioHeader(id, 'x').querySelector('.absolute img:not([aria-hidden])');
    expect(sharp('audio').style.objectPosition).toBe('50% 40%');
    expect(sharp('character').style.objectPosition).toBe('50% 25%');
  });

  it('the editor banner is the compact variant inside a non-shrinking row', () => {
    const row = createEditorBanner('director', 'Director', 'AI editor');
    expect(row.className).toContain('shrink-0');
    const banner = row.querySelector('.hero-banner');
    expect(banner.className).toContain('h-20');
    expect(banner.querySelector('h1').textContent).toBe('Director');
    expect(banner.querySelector('img:not([aria-hidden])').getAttribute('src')).toContain('/thumbnails/heroes/director.webp');
  });

  it('the Timeline Editor banner is added after the editor mounts (the editor replaces the container contents)', () => {
    const src = fs.readFileSync('src/components/TimelineEditorPage.jsx', 'utf-8');
    expect(src.indexOf('createTimelineEditorApp(container);')).toBeLessThan(src.indexOf("createEditorBanner('timeline'"));
    expect(src).not.toContain("createHeroSection('timeline'");
  });

  it('banners use the same picture as the Apps-page card where the studio has its own art', () => {
    for (const id of ['image', 'video', 'cinema', 'audio', 'avatar', 'videotools', 'training', 'upscale', 'lipsync', 'render']) {
      expect(getBannerThumbnail(id), id).toBe(getStudioThumbnail(id));
    }
    // no studio art of their own -> keep the hero picture
    for (const id of ['director', 'workbench', 'timeline', 'website-builder', 'viral', 'personalizer']) {
      expect(getBannerThumbnail(id), id).toBe(getHeroThumbnail(id));
    }
  });
});
