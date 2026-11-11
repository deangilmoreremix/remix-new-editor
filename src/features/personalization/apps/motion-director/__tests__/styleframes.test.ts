// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { validateDirections } from '../lib/directorPlan';
import { styleframeProject } from '../lib/styleframes';
import type { SiteCapture } from '../lib/directorClient';

const dir = (palette: unknown) => ({ name: 'Clean', claim: 'Quiet', keywords: ['a'], look: 'l', motion: 'm', why: 'w', tradeoff: 't', palette });

describe('direction palettes', () => {
  it('keeps a palette of three hex colours and drops anything else', () => {
    const ok = validateDirections({ directions: [dir({ background: '#101820', text: '#f5f5f5', accent: '#ff6b35' })], recommended: 0 });
    expect(ok.directions[0].palette).toEqual({ background: '#101820', text: '#f5f5f5', accent: '#ff6b35' });
    for (const bad of [undefined, { background: 'blue', text: '#fff', accent: '#ff6b35' }, { background: '#101820', text: '#f5f5f5' }, 'x']) {
      expect(validateDirections({ directions: [dir(bad)], recommended: 0 }).directions[0].palette).toBeUndefined();
    }
  });
});

describe('styleframes', () => {
  const capture = { url: 'https://acme.io/', title: 'Acme', page: { url: 'https://img/p.png', width: 1920, height: 3000 }, crops: [], brand: { background: null, text: null, accent: null, fontFamily: null }, content: { headline: 'Ship faster', nav: ['A', 'B'], ctas: ['Try it'] }, transient: false } as unknown as SiteCapture;

  it('is a two-scene film (the site in the hub, then the closing logo) in the direction\'s colours, with a frame inside each scene', () => {
    const { project, frames } = styleframeProject({ background: '#101820', text: '#f5f5f5', accent: '#ff6b35' }, 'Acme', capture);
    const shots = project.tracks.flatMap((t) => t.clips).filter((c) => c.cardId.startsWith('brand-'));
    expect(shots.map((c) => c.cardId)).toEqual(['brand-hub', 'brand-logo-reveal']);
    expect(project.tracks.flatMap((t) => t.clips).find((c) => c.cardId === 'brand-hub')!.props.bg).toBe('#101820');
    expect(frames).toHaveLength(2);
    expect(frames[0]).toBeGreaterThan(shots[0].start);
    expect(frames[0]).toBeLessThan(shots[0].start + shots[0].duration);
    expect(frames[1]).toBeGreaterThan(shots[1].start);
    expect(frames[1]).toBeLessThan(shots[1].start + shots[1].duration);
  });

  it('works with no site too', () => {
    expect(styleframeProject({ background: '#fff', text: '#000', accent: '#00f' }, 'Idea', null).frames).toHaveLength(2);
  });
});
