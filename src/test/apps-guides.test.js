import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import screenshots from '../data/guideScreenshots.json';
import { GUIDE_ROUTES, featureLabel } from '../data/guideRoutes.js';
import { GUIDE_STEPS } from '../components/GuidePage.js';
import { NAV_GROUPS, STUDIO_ROUTES } from '../lib/studioRoutes.js';
import { getStudioThumbnail } from '../lib/thumbnails.js';
import { isKnownPage } from '../lib/router.js';

const menuApps = NAV_GROUPS.slice(1).flatMap((g) => g.items.map((i) => i.id));
const EXPECTED = [...new Set(['templates', 'academy', ...menuApps, 'render'])];

describe('studio guides data', () => {
  it('every Apps-guide slug has screenshots', () => {
    for (const slug of Object.keys(GUIDE_ROUTES)) expect(screenshots[slug], slug).toBeTruthy();
  });
  it('every mapped studio is a side-menu app, Templates, Academy or Video Render', () => {
    const known = new Set(['templates', 'academy', 'render', ...menuApps, ...Object.keys(STUDIO_ROUTES)]);
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
  it('has no Get started banner above the apps', async () => {
    const { AppsHub } = await import('../components/AppsHub.js');
    expect(AppsHub().querySelector('[data-get-started]')).toBeNull();
  });
});

describe('Apps and Explore navigation helpers', () => {
  it('Apps page links to the Get started guide', async () => {
    const { AppsHub } = await import('../components/AppsHub.js');
    expect(AppsHub().querySelector('[data-apps-guide]')).toBeTruthy();
  });
  it('Explore has a jump bar to every section and category', async () => {
    const { ExplorePage, exploreCategories } = await import('../components/ExplorePage.js');
    const page = ExplorePage();
    const bar = page.querySelector('[data-explore-jump]');
    expect([...bar.querySelectorAll('[data-jump]')].map((b) => b.dataset.jump)).toEqual(['favorites', 'trending', 'prompts', 'categories', 'studios']);
    expect(bar.querySelectorAll('select option').length).toBe(exploreCategories().length + 1);
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

describe('Explore page', () => {
  it('is back in the side menu and routes to the Explore page', () => {
    expect(NAV_GROUPS[0].items.map((i) => i.id)).toContain('explore');
    expect(isKnownPage('explore')).toBe(true);
  });
  it('keeps the old Explore design and adds a card with a picture for every studio', async () => {
    const { ExplorePage } = await import('../components/ExplorePage.js');
    const page = ExplorePage();
    const text = page.textContent;
    for (const heading of ['Trending Templates', 'Prompt Library', 'Browse by Category', 'All studios']) expect(text).toContain(heading);
    const studios = page.querySelector('[data-explore-studios]');
    expect(Number(studios.dataset.exploreStudios)).toBe(EXPECTED.length);
    const cards = [...studios.querySelectorAll('[data-searchable]')];
    expect(cards.length).toBe(EXPECTED.length);
    expect(cards.every((c) => c.querySelector('img'))).toBe(true);
  });
});
