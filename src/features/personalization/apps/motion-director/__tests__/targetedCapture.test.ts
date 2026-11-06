import { describe, expect, it } from 'vitest';
import { mergeCaptures, neededPages } from '../lib/targetedCapture';
import type { SiteCapture } from '../lib/directorClient';
import type { DirectorPlan } from '../lib/directorPlan';
import { parseJobRequest, TARGETED_CAPTURE_OPTIONS } from '../../../../../../netlify/functions/_personalization/src/server/motionCaptureWorker';

const base = {
  url: 'https://acme.test/',
  title: 'Acme',
  page: { url: 'p0', width: 3840, height: 4000 },
  pages: [{ name: 'home', path: '/', url: 'p0', width: 3840, height: 4000 }, { name: 'services', path: '/services', url: 'p1', width: 3840, height: 4000 }],
  crops: ['c0'],
  cropInfo: [{ route: 'home', cut: 'card', text: 'x', imageShare: 0, portraits: 0, map: false, width: 10, height: 10 }],
  links: [{ name: 'services', path: '/services', url: 'https://acme.test/services' }, { name: 'pricing', path: '/pricing', url: 'https://acme.test/pricing' }, { name: 'testimonials', path: '/testimonials', url: 'https://acme.test/testimonials' }],
  brand: {},
  content: null,
} as unknown as SiteCapture;
const shot = (asset: string) => ({ kind: 'shot' as const, recipeId: 'x', durationSec: 4, headline: '', caption: '', transition: 'cut' as const, asset });
const plan = (assets: string[]): DirectorPlan => ({ title: 't', summary: '', palette: { background: '#fff', text: '#000', accent: '#f00' }, scenes: assets.map(shot) });

describe('pipeline stage 4: capture the page states the storyboard needs', () => {
  it('finds rows whose page was not captured among the site\'s links; captured pages and unknown states ask for nothing', () => {
    const need = neededPages(plan(['services page', 'pricing table', 'client testimonials', 'hero', 'a page nobody links']), base, 4, 0);
    expect(need.map((n) => [n.scene, n.link.path])).toEqual([[1, '/pricing'], [2, '/testimonials']]);
    expect(neededPages(plan(['pricing']), { ...base, partial: true })).toEqual([]);
  });

  it('after the quick capture, a couple more of the site\'s own pages are captured too (best first, never twice)', () => {
    const need = neededPages(plan(['pricing table']), base);
    expect(need.map((n) => [n.scene, n.link.path])).toEqual([[0, '/pricing'], [-1, '/testimonials']]);
  });

  it('merges the targeted page and its crops into the capture, keeping crop info in step', () => {
    const extra = { ...base, pages: [{ name: 'home', path: '/', url: 'px', width: 3840, height: 3000 }], crops: ['cx'], cropInfo: [{ ...base.cropInfo![0], route: 'home' }] } as SiteCapture;
    const m = mergeCaptures(base, extra, { name: 'pricing', path: '/pricing' });
    expect(m.pages!.map((p) => [p.name, p.path, p.url])).toEqual([['home', '/', 'p0'], ['services', '/services', 'p1'], ['pricing', '/pricing', 'px']]);
    expect(m.crops).toEqual(['c0', 'cx']);
    expect(m.cropInfo!.map((i) => i.route)).toEqual(['home', 'pricing']);
  });

  it('a targeted job is one page: no more routes, shorter limit; the flag survives dispatch', () => {
    expect(TARGETED_CAPTURE_OPTIONS.maxRoutes).toBe(0);
    expect(TARGETED_CAPTURE_OPTIONS.hardMs).toBeLessThan(300_000);
    const id = '0f8fad5b-d9cb-469f-a165-70867728950e';
    expect(parseJobRequest({ jobId: id, userId: 'u', url: 'https://acme.test/pricing', targeted: true })?.targeted).toBe(true);
    expect(parseJobRequest({ jobId: id, userId: 'u', url: 'https://acme.test/' })?.targeted).toBeUndefined();
  });
});
