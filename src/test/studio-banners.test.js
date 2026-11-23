import { describe, it, expect, afterEach } from 'vitest';
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

describe('studio banner width and coverage', () => {
  afterEach(() => { document.body.innerHTML = ''; });
  const nextFrames = () => new Promise((r) => setTimeout(r, 60));
  const mountIn = (wrapperClass, areaWidth) => {
    let area = document.getElementById('content-area');
    if (!area) {
      area = document.createElement('div');
      area.id = 'content-area';
      Object.defineProperty(area, 'clientWidth', { value: areaWidth, configurable: true });
      document.body.appendChild(area);
    }
    const wrap = document.createElement('div');
    wrap.className = wrapperClass;
    const banner = createStudioHeader('image', 'Image Studio', 'x');
    wrap.appendChild(banner);
    area.appendChild(wrap);
    return banner;
  };

  it('is as wide as the content area minus a fixed gutter, whatever wrapper the page puts it in', async () => {
    const narrow = mountIn('w-full max-w-4xl px-4', 1852);
    const wide = mountIn('w-full max-w-7xl px-8', 1852);
    const plain = mountIn('px-3', 1852);
    await nextFrames();
    for (const b of [narrow, wide, plain]) expect(b.style.width).toBe('1804px');
  });

  it('follows the content area width', async () => {
    const b = mountIn('w-full max-w-4xl', 1000);
    await nextFrames();
    expect(b.style.width).toBe('952px');
  });

  it('a studio with no artwork yet still gets the same-size banner, with the title', () => {
    const el = createStudioHeader('no-art-yet', 'Lead Finder', 'Find local businesses');
    expect(el.className).toContain('md:h-[clamp(176px,14vw,264px)]');
    expect(el.className).toContain('hero-banner');
    expect(el.querySelector('img')).toBeNull();
    expect(el.querySelector('h1').textContent).toBe('Lead Finder');
  });

  it('every studio page uses the shared banner, not the older createHeroSection one', () => {
    const pages = ['TextToImagePage', 'ImageToImagePage', 'TextToVideoPage', 'ImageToVideoPage', 'VideoToVideoPage', 'VideoWatermarkPage', 'RenderPage'];
    for (const f of pages) {
      const src = fs.readFileSync(`src/components/${f}.js`, 'utf-8');
      expect(src, f).not.toContain('createHeroSection');
      expect(src, f).toContain('createStudioHeader(');
    }
  });

  it('Photo Studio, Find My Brand, Lead Finder, Motion Director and Outreach have a banner', () => {
    const expected = { PhotoStudioPage: "createStudioHeader('photo-studio'", FindMyBrandPage: "createStudioHeader('find-my-brand'", LeadFinderStudio: "createStudioHeader('leadfinder'", MotionDirectorPage: "createEditorBanner('motion-director'", OutreachStudio: "createEditorBanner('outreach'" };
    for (const [f, call] of Object.entries(expected)) {
      expect(fs.readFileSync(`src/components/${f}.js`, 'utf-8'), f).toContain(call);
    }
  });
});
