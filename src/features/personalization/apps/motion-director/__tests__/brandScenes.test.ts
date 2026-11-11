// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { BRAND_SCENES, buildCatalogBrief, validatePlan, type DirectorPlan } from '../lib/directorPlan';
import { planToProject } from '../lib/buildFilm';
import { inkPressPlan, restrictToRecipes } from '../lib/filmChat';
import { drawsSampleScreen, isProductTextureShot } from '../lib/productShots';
import { CARDS } from '../cards/registry';
import { parseWords } from '../cards/inkpress/title-card';
import { MOTION_TEMPLATES } from '../../../data/motionRecipeCatalog';

const scene = (recipeId: string, kind: 'shot' | 'title' = 'shot', headline = 'Line') => ({ kind, recipeId, durationSec: 4, headline, caption: '', transition: 'cut' as const });
const palette = { background: '#101018', text: '#ffffff', accent: '#8b6bff' };
const capture = { screens: ['https://img/page.jpg'], crops: ['https://img/c1.jpg'], title: 'Acme', sections: [0, 900, 1800], pageH: 4000, sectionNames: ['Hero', 'Features', 'Pricing'], nav: ['Video', 'Audio', 'Brand'], address: 'acme.com' };

describe('brand scenes', () => {
  it('every brand scene has a registered card and a catalog line', () => {
    const brief = buildCatalogBrief();
    for (const [id, b] of Object.entries(BRAND_SCENES)) {
      expect(CARDS[b.cardId], id).toBeTruthy();
      expect(brief).toContain(`${id} |`);
    }
  });

  it('validatePlan keeps brand scenes', () => {
    const plan = validatePlan({ title: 't', palette, scenes: [scene('brand/url-scan'), scene('brand/hub'), scene('brand/logo-reveal')] }, { targetSec: 12 });
    expect(plan.scenes.map((s) => s.recipeId)).toEqual(['brand/url-scan', 'brand/hub', 'brand/logo-reveal']);
  });

  it('builds the brand cards from the capture', () => {
    const plan: DirectorPlan = { title: 't', summary: '', palette, scenes: [scene('brand/url-scan'), scene('brand/hub', 'shot', 'Every studio'), scene('brand/feature-zoom', 'shot', 'Zoom'), scene('', 'title', 'Start *now*')] };
    const project = planToProject(plan, { aspectRatio: '16:9', capture, brand: { name: 'Acme', logo: 'https://img/logo.png', repo: 'acme.com' } });
    const clips = project.tracks.flatMap((t) => t.clips).filter((c) => c.cardId.startsWith('brand-'));
    expect(clips.map((c) => c.cardId)).toEqual(['brand-url-scan', 'brand-hub', 'brand-feature-zoom', 'brand-logo-reveal']);
    const byId = Object.fromEntries(clips.map((c) => [c.cardId, c.props]));
    expect(byId['brand-hub']).toMatchObject({ file: 'https://img/page.jpg', labels: 'Video\nAudio\nBrand\nHero\nFeatures\nPricing' });
    expect(byId['brand-url-scan']).toMatchObject({ url: 'acme.com' });
    expect(byId['brand-logo-reveal']).toMatchObject({ logo: 'https://img/logo.png', name: 'Acme', cta: 'Start now', url: 'acme.com' });
  });

  it('keeps picked-recipes films free of other recipes but lets brand scenes frame them', () => {
    const picks = MOTION_TEMPLATES.slice(0, 2);
    const plan: DirectorPlan = { title: 't', summary: '', palette, scenes: [scene('brand/url-scan'), scene(picks[0].id), scene('brand/hub'), scene(picks[1].id), scene('brand/logo-reveal')] };
    const out = restrictToRecipes(plan, picks, 30);
    const ids = out.scenes.map((s) => s.recipeId);
    expect(ids[0]).toBe('brand/url-scan');
    expect(ids[ids.length - 1]).toBe('brand/logo-reveal');
    expect(ids).not.toContain('brand/hub');
    expect(ids).toEqual(expect.arrayContaining([picks[0].id, picks[1].id]));
  });

  it('marks emphasis even with punctuation outside the stars', () => {
    expect(parseWords('Meet *Acme-bakery*.')).toEqual([{ text: 'Meet', accent: false }, { text: 'Acme-bakery.', accent: true }]);
  });

  it('the Ink Press path tells a captured site\'s story with the scan and hub scenes', () => {
    const plan = inkPressPlan({ prompt: 'acme.com', durationSec: 40, productName: 'Acme', content: { headline: 'Grow with Acme', headings: ['One', 'Two'] }, siteScenes: true });
    const ids = plan.scenes.map((s) => s.recipeId);
    expect(ids.slice(0, 3)).toEqual(['', 'brand/url-scan', 'brand/hub']);
    const without = inkPressPlan({ prompt: 'acme.com', durationSec: 40, productName: 'Acme' });
    expect(without.scenes.map((s) => s.recipeId)).not.toContain('brand/hub');
  });

  it('flags shots that draw a sample screen', () => {
    const flagged = MOTION_TEMPLATES.filter(drawsSampleScreen);
    expect(flagged.length).toBeGreaterThan(10);
    expect(flagged.some((t) => isProductTextureShot(t.componentName))).toBe(false);
    expect(buildCatalogBrief().split('\n').filter((l) => l.includes('SAMPLE-UI'))).toHaveLength(flagged.length);
  });

  it('lays sound cues under brand scenes and the closing logo', () => {
    const plan: DirectorPlan = { title: 't', summary: '', palette, scenes: [scene('brand/url-scan'), scene('', 'title', 'Hello'), scene('', 'title', 'Go')] };
    const project = planToProject(plan, { aspectRatio: '16:9', capture, brand: { name: 'Acme' } });
    const labels = project.tracks.flatMap((t) => t.clips).filter((c) => c.cardId === 'audio-clip').map((c) => c.label);
    expect(labels).toEqual(expect.arrayContaining(['Key', 'Scan', 'Build', 'Impact', 'Sparkle', 'Stamp']));
  });

  it('always closes a site film on the logo reveal, holding it at least 3 s', () => {
    const shot = MOTION_TEMPLATES[0];
    const endOnShot: DirectorPlan = { title: 't', summary: '', palette, scenes: [scene(shot.id), scene(shot.id), scene(shot.id)] };
    const endOnTitle: DirectorPlan = { title: 't', summary: '', palette, scenes: [scene(shot.id), scene(shot.id), { ...scene('', 'title', 'Call us'), durationSec: 2 }] };
    for (const plan of [endOnShot, endOnTitle]) {
      const project = planToProject(plan, { aspectRatio: '16:9', capture, brand: { name: 'Acme' } });
      const reveal = project.tracks.flatMap((t) => t.clips).find((c) => c.cardId === 'brand-logo-reveal')!;
      expect(reveal.duration).toBeGreaterThanOrEqual(90);
      const end = project.tracks.flatMap((t) => t.clips).filter((c) => !c.cardId.startsWith('audio')).reduce((m, c) => Math.max(m, c.start + c.duration), 0);
      expect(reveal.start + reveal.duration).toBe(end);
    }
    const noSite = planToProject(endOnTitle, { aspectRatio: '16:9' });
    expect(noSite.tracks.flatMap((t) => t.clips).some((c) => c.cardId === 'brand-logo-reveal')).toBe(false);
  });

  it('starts each repeat of a page recipe further along the site pictures', () => {
    const ids = MOTION_TEMPLATES.filter((t) => t.componentName === 'DeckDealFlyin');
    const plan: DirectorPlan = { title: 't', summary: '', palette, scenes: [scene(ids[0].id), scene(ids[0].id)] };
    const project = planToProject(plan, { aspectRatio: '16:9', capture: { ...capture, crops: ['a', 'b', 'c', 'd', 'e', 'f'] } });
    const crops = project.tracks.flatMap((t) => t.clips).filter((c) => c.cardId.startsWith('demo:')).map((c) => (c.props.crops as string[])[0]);
    expect(new Set(crops).size).toBe(2);
  });
});
