import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import screenshots from '../data/guideScreenshots.json';
import { GUIDE_ROUTES, featureLabel } from '../data/guideRoutes.js';
import { GUIDE_STEPS } from '../components/GuidePage.js';
import { NAV_GROUPS } from '../lib/studioRoutes.js';
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
  it('the onboarding steps all point at real guides, once each', () => {
    const slugs = GUIDE_STEPS.map(([slug]) => slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const slug of slugs) expect(screenshots[slug], slug).toBeTruthy();
  });
  it('turns a feature id into a readable caption', () => {
    expect(featureLabel('prompt-optional')).toBe('Prompt optional');
  });
});

describe('Apps page', () => {
  it('shows a card with a picture for every studio, with no per-card guide links', async () => {
    const { AppsHub } = await import('../components/AppsHub.js');
    const page = AppsHub();
    const cards = [...page.querySelectorAll('[data-searchable]')];
    for (const id of EXPECTED) expect(getStudioThumbnail(id), `thumbnail ${id}`).toBeTruthy();
    expect(cards.length).toBe(EXPECTED.length);
    expect(cards.every((c) => c.querySelector('img'))).toBe(true);
    expect(page.querySelectorAll('[data-guide-link]').length).toBe(0);
  });
  it('links to the Get started guide from the top of the page', async () => {
    const { AppsHub } = await import('../components/AppsHub.js');
    expect(AppsHub().querySelector('[data-get-started]').getAttribute('href')).toBe('#/guide');
  });
});

describe('Get started guide', () => {
  it('is a known page, also for older per-studio links', () => {
    expect(isKnownPage('guide')).toBe(true);
    expect(isKnownPage('guide/image-studio')).toBe(true);
  });
  it('renders one numbered step per guide with an overview and an Open button', async () => {
    const { GuidePage } = await import('../components/GuidePage.js');
    const page = GuidePage();
    expect(page.querySelectorAll('section[id^="step-"]').length).toBe(GUIDE_STEPS.length);
    expect(page.querySelectorAll('h1').length).toBe(1);
    expect([...page.querySelectorAll('section img')].every((i) => i.getAttribute('src').startsWith('/guides/'))).toBe(true);
  });
});
