// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { applyPaint, makePainter, paintRole } from '../lib/themePaint';
import { SHOT_FACTS } from '../demosrc/_generated/shotFacts';

const c = (hex: string) => ({ r: parseInt(hex.slice(1, 3), 16), g: parseInt(hex.slice(3, 5), 16), b: parseInt(hex.slice(5, 7), 16), a: 1 });
const site = { page: '#ffffff', surface: '#f2f4f7', field: '#eef0f3', text: '#1c1d29', muted: '#5b6070', accent: '#a6c937', border: '#d9dce3' };

describe('themePaint (upstream THEMES.md: repaint a scene\'s own colours by role)', () => {
  it('gives each colour its role on its ground; warm light stays light', () => {
    expect(paintRole(c('#0b0d12'), 'dark')).toBe('page');
    expect(paintRole(c('#1b1f2a'), 'dark')).toBe('surface');
    expect(paintRole(c('#f4f4f6'), 'dark')).toBe('text');
    expect(paintRole(c('#2f6bff'), 'dark')).toBe('accent');
    expect(paintRole(c('#ffd27a'), 'dark')).toBeNull();
    expect(paintRole(c('#fbfaf7'), 'light')).toBe('page');
    expect(paintRole(c('#14110f'), 'light')).toBe('text');
  });

  it('a light recipe in a light film takes every role; a dark recipe in a light film only the accent', () => {
    const light = makePainter(site, 'light')!;
    expect(light.color('#fbfaf7')).toBe('rgb(255, 255, 255)');
    expect(light.color('rgba(20, 17, 15, 0.5)')).toBe('rgba(28, 29, 41, 0.5)');
    expect(light.color('#2f6bff')).toBe('rgb(166, 201, 55)');
    const dark = makePainter(site, 'dark')!;
    expect(dark.color('#0b0d12')).toBe('#0b0d12');
    expect(dark.color('#2f6bff')).toBe('rgb(166, 201, 55)');
    expect(light.value('linear-gradient(90deg, #2f6bff 0%, #fbfaf7 100%)')).toBe('linear-gradient(90deg, rgb(166, 201, 55) 0%, rgb(255, 255, 255) 100%)');
  });

  it('repaints inline styles and SVG paint under the recipe, and painting twice changes nothing', () => {
    document.body.innerHTML = '<div id="r"><div style="background: #fbfaf7; color: #14110f"></div><svg><rect fill="#2f6bff" stroke="none"/></svg></div>';
    const root = document.getElementById('r')!;
    const p = makePainter(site, 'light')!;
    applyPaint(root, p);
    const html = root.innerHTML;
    expect(html).toContain('rgb(255, 255, 255)');
    expect(html).toContain('fill="rgb(166, 201, 55)"');
    applyPaint(root, p);
    expect(root.innerHTML).toBe(html);
  });

  it('knows for every recipe whether it reads the Look roles and on which ground it was designed', () => {
    const all = Object.values(SHOT_FACTS);
    expect(all).toHaveLength(150);
    expect(all.filter((f) => !f.readsLook).length).toBeGreaterThan(60);
    for (const f of all) expect(['dark', 'light']).toContain(f.ground);
  });
});

describe('captions on the shot they sit on', () => {
  it('are light under a dark-ground recipe in a light film, and the film text colour under a light one', async () => {
    const { planToProject } = await import('../lib/buildFilm');
    const { MOTION_TEMPLATES } = await import('../../../data/motionRecipeCatalog');
    const dark = MOTION_TEMPLATES.find((t) => SHOT_FACTS[t.componentName]?.ground === 'dark')!;
    const light = MOTION_TEMPLATES.find((t) => SHOT_FACTS[t.componentName]?.ground === 'light')!;
    const p = planToProject({ title: 't', summary: '', palette: { background: '#ffffff', text: '#1c1d29', accent: '#a6c937' }, scenes: [dark, light].map((t) => ({ kind: 'shot' as const, recipeId: t.id, durationSec: 4, headline: 'Line', caption: `Caption ${t.componentName}`, transition: 'cut' as const })) }, { aspectRatio: '16:9' });
    const caps = p.tracks.flatMap((tr) => tr.clips).filter((c) => c.cardId === 'inkpress-caption');
    expect(caps.map((c) => c.props.color)).toEqual(['#f5f5f2', '#1c1d29']);
  });
});
