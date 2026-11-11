import { describe, expect, it } from 'vitest';
import { MOTION_TEMPLATES } from '../../../data/motionRecipeCatalog';
import { buildCatalogue, cropKind } from '../lib/pictureCatalogue';
import { assignPictures, picturesShown } from '../lib/assignPictures';
import type { SiteCapture } from '../lib/directorClient';
import type { DirectorPlan } from '../lib/directorPlan';

const info = (route: string, text: string, extra: Partial<{ imageShare: number; portraits: number; map: boolean; cut: 'card' | 'band' }> = {}) => ({ route, cut: 'card' as const, width: 400, height: 300, text, imageShare: 0, portraits: 0, map: false, ...extra });

describe('the picture catalogue', () => {
  it('labels what each shot shows', () => {
    expect(cropKind(info('contact', 'Contact us (954) 555-0100', { map: true }))).toBe('map');
    expect(cropKind(info('team', 'Bob Reynold · Senior engineer', { portraits: 1, imageShare: 0.4 }))).toBe('people');
    expect(cropKind(info('client-testimonials', 'Highly recommend their team'))).toBe('testimonial');
    expect(cropKind(info('contact', 'Phone (954) 555-0100 · Send message'))).toBe('contact');
    expect(cropKind(info('home', 'Our new office', { imageShare: 0.8 }))).toBe('photo');
    expect(cropKind(info('home', '', { cut: 'band' }))).toBe('blank');
    expect(cropKind(info('firewalls', 'Firewalls · Stop threats before they reach you'))).toBe('card');
  });

  it('keeps a block repeated on every page once', () => {
    const banner = 'Live & Local 24/7 Help Desk · Save half in one year with us';
    const cap = { page: { url: 'p0', width: 1, height: 1 }, pages: [{ name: 'home', path: '/', url: 'p0', width: 1, height: 1 }], crops: ['c0', 'c1', 'c2'], images: [], cropInfo: [info('home', banner), info('firewalls', banner), info('firewalls', 'Firewalls that stop threats early')] } as unknown as SiteCapture;
    expect(buildCatalogue(cap).filter((p) => p.kind === 'card').map((p) => p.url)).toEqual(['c0', 'c2']);
  });
});

describe('pictures for each scene', () => {
  const id = (c: string) => MOTION_TEMPLATES.find((t) => t.componentName === c)!.id;
  const pages = ['home', 'firewalls', 'cyber-security', 'client-testimonials'].map((name, i) => ({ name, path: `/${name}`, url: `page-${name}`, width: 1, height: 1 }));
  const crops = Array.from({ length: 60 }, (_, i) => `crop-${i}`);
  const routes = ['home', 'firewalls', 'cyber-security', 'client-testimonials', 'team'];
  const cap = {
    page: { url: 'page-home', width: 1, height: 1 },
    pages,
    crops,
    images: [],
    cropInfo: crops.map((_, i) => info(routes[i % 5], `${routes[i % 5]} card number ${i}`, routes[i % 5] === 'team' ? { portraits: 1 } : i === 7 ? { map: true } : {})),
  } as unknown as SiteCapture;
  const plan: DirectorPlan = {
    title: 't', summary: '', palette: { background: '#fff', text: '#000', accent: '#f00' },
    scenes: [
      { kind: 'title', recipeId: '', durationSec: 2, headline: 'Meet us', caption: '', transition: 'cut' },
      { kind: 'shot', recipeId: id('SpotlightHeroCard'), durationSec: 5, headline: 'Your IT partner', caption: '', transition: 'cut' },
      { kind: 'shot', recipeId: id('CrashZoomReal'), durationSec: 4, headline: 'Firewalls that hold', caption: '', transition: 'cut', feature: 'Firewalls' },
      { kind: 'shot', recipeId: 'brand/people-gallery', durationSec: 4, headline: '', caption: '', transition: 'cut' },
      { kind: 'shot', recipeId: id('DeckDealFlyin'), durationSec: 5, headline: 'Everything we do', caption: '', transition: 'cut' },
    ],
  };
  const out = assignPictures(plan, buildCatalogue(cap));

  it('gives a feature scene the page of that feature and its own cards', () => {
    expect(out[2].screens[0]).toBe('page-firewalls');
    expect(out[2].crops.every((c) => routes[Number(c.split('-')[1]) % 5] === 'firewalls')).toBe(true);
  });
  it('fills the gallery with people and a deck deal with many distinct cards, never a map', () => {
    expect(out[3].crops.every((c) => routes[Number(c.split('-')[1]) % 5] === 'team')).toBe(true);
    expect(new Set(out[4].crops).size).toBe(26);
    expect(out.flatMap((s) => s.crops)).not.toContain('crop-7');
  });
  it('does not repeat a picture across scenes while there are fresh ones', () => {
    const all = out.flatMap((s) => s.crops);
    expect(new Set(all).size).toBe(all.length);
    expect(picturesShown(out)).toBeGreaterThan(35);
  });
});
