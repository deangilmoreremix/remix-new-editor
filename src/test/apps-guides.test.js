import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import screenshots from '../data/guideScreenshots.json';
import { GUIDE_ROUTES, guideSlugForRoute, featureLabel } from '../data/guideRoutes.js';
import { NAV_GROUPS, getNavItemForRoute } from '../lib/studioRoutes.js';
import { getStudioThumbnail } from '../lib/thumbnails.js';
import { isKnownPage } from '../lib/router.js';

const menuApps = NAV_GROUPS.slice(1).flatMap((g) => g.items.map((i) => i.id));
const EXPECTED = [...new Set(['templates', 'academy', ...menuApps, 'render'])];

describe('studio guides data', () => {
  it('every guide slug maps to a studio route and vice versa', () => {
    expect(Object.keys(screenshots).sort()).toEqual(Object.keys(GUIDE_ROUTES).sort());
  });
  it('every mapped studio is a side-menu app, Templates, Academy or Video Render', () => {
    const known = new Set(['templates', 'academy', 'render', ...menuApps]);
    for (const [slug, route] of Object.entries(GUIDE_ROUTES)) expect(known.has(route), `${slug} -> ${route}`).toBe(true);
  });
  it('every screenshot in the data file exists in public/guides', () => {
    const missing = Object.values(screenshots).flatMap((g) => [g.overview, ...Object.values(g.features)]).filter((p) => !fs.existsSync(`public${p}`));
    expect(missing).toEqual([]);
  });
  it('only Website Builder and Video Pages have no guide', () => {
    expect(EXPECTED.filter((id) => !guideSlugForRoute(id)).sort()).toEqual(['video-pages', 'website-builder']);
  });
  it('turns a feature id into a readable caption', () => {
    expect(featureLabel('prompt-optional')).toBe('Prompt optional');
  });
});

describe('Apps page', () => {
  it('shows a card with a picture for every studio, and a Guide link wherever there is a guide', async () => {
    const { AppsHub } = await import('../components/AppsHub.js');
    const page = AppsHub();
    const cards = [...page.querySelectorAll('[data-searchable]')];
    for (const id of EXPECTED) expect(getStudioThumbnail(id), `thumbnail ${id}`).toBeTruthy();
    expect(cards.length).toBe(EXPECTED.length);
    expect(cards.every((c) => c.querySelector('img'))).toBe(true);
    const withGuide = EXPECTED.filter((id) => guideSlugForRoute(id));
    expect([...page.querySelectorAll('[data-guide-link]')].map((a) => a.dataset.guideLink).sort())
      .toEqual(withGuide.map(guideSlugForRoute).sort());
  });
  it('opens a guide page route and keeps the studio highlighted', () => {
    expect(isKnownPage('guide/image-studio')).toBe(true);
    expect(getNavItemForRoute('guide/image-studio')).toBe('image');
    expect(getNavItemForRoute('guide/video-render')).toBeNull();
  });
});
