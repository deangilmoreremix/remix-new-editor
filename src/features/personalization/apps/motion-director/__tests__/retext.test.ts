// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { keepsShape, validateEditOps, validateRetext, type DirectorPlan } from '../lib/directorPlan';
import { fallbackTexts } from '../lib/retext';
import { planToProject } from '../lib/buildFilm';
import { DEMO_TEXTS } from '../demosrc/_generated/demoTexts';
import { MOTION_TEMPLATES } from '../../../data/motionRecipeCatalog';

const content = { headline: 'Finally, a cure for your IT headaches', description: 'Managed IT for South Florida businesses', headings: ['Stop downtime', 'Help desk support'], ctas: ['Free audit'], nav: ['Cybersecurity', 'Firewalls', 'Virtual CIO'] };

describe('retext', () => {
  it('keeps only pairs whose from is a real template line', () => {
    const allowed = new Map([[1, new Set(['Home', 'Every shot, within reach.'])]]);
    const out = validateRetext({ scenes: [{ index: 1, pairs: [{ from: 'Home', to: 'Start **now**' }, { from: 'Made up', to: 'x' }, { from: 'Home', to: '' }] }, { index: 9, pairs: [{ from: 'Home', to: 'y' }] }] }, allowed);
    expect(out).toEqual({ 1: { Home: 'Start now' } });
  });

  it('cuts a rewrite that would overflow the recipe\'s layout', () => {
    const allowed = new Map([[0, new Set(['Every shot, within reach.'])]]);
    const out = validateRetext({ scenes: [{ index: 0, pairs: [{ from: 'Every shot, within reach.', to: 'Finally, a cure for your IT headaches and more' }] }] }, allowed);
    expect(out[0]['Every shot, within reach.'].length).toBeLessThanOrEqual(34);
    expect(out[0]['Every shot, within reach.']).toBe('Finally, a cure for your IT');
  });

  it('gives each scene of a repeated recipe its own words', () => {
    const lines = ['Your product,', 'in motion.'];
    const used = new Set<string>();
    const a = fallbackTexts(lines, content, 'Acme', { index: 1, headline: 'Stop downtime', caption: 'Help desk' }, used);
    const b = fallbackTexts(lines, content, 'Acme', { index: 2, headline: 'Virtual CIO', caption: 'Firewalls' }, used);
    expect(a).toEqual({ 'Your product,': 'Stop downtime', 'in motion.': 'Help desk' });
    expect(b).toEqual({ 'Your product,': 'Virtual CIO', 'in motion.': 'Firewalls' });
    expect(fallbackTexts(['Arial, sans-serif'], content, 'Acme', { index: 0, headline: 'x y z' })).toEqual({});
  });

  it('keeps the word count and length of words that are part of an effect', () => {
    const allowed = new Map([[0, new Set(['Faster', 'Build the film'])]]);
    const out = validateRetext({ scenes: [{ index: 0, pairs: [{ from: 'Faster', to: 'Smarter' }, { from: 'Faster', to: 'Much faster' }, { from: 'Build the film', to: 'Ship it' }] }] }, allowed, new Set([0]));
    expect(out).toEqual({ 0: { Faster: 'Smarter' } });
    expect(keepsShape('Smarter', 'Faster')).toBe(true);
    expect(keepsShape('Much faster', 'Faster')).toBe(false);
  });

  it('fills sentences with the site headline and labels with its menu, in similar lengths', () => {
    const map = fallbackTexts(['Every shot, within reach.', 'Renders', 'Settings', 'Acme Studio'], content, 'Acme Studio');
    expect(map['Every shot, within reach.']).toBe('Stop downtime');
    expect(map.Renders).toBe('Cybersecurity');
    expect(map.Settings).toBe('Firewalls');
    expect(map['Acme Studio']).toBeUndefined();
    expect(fallbackTexts(['Home'], null, '')).toEqual({});
  });

  it('turns a set_texts op into a validated edit and rejects unknown clips', () => {
    const { ops } = validateEditOps({ reply: 'ok', ops: [{ op: 'set_texts', clipId: 'c1', from: 'Home', to: 'Start', recipeId: '', seconds: 0, text: '', background: '', accent: '' }, { op: 'set_texts', clipId: 'zz', from: 'Home', to: 'Start' }] }, new Set(['c1']));
    expect(ops).toEqual([{ op: 'set_texts', clipId: 'c1', from: 'Home', to: 'Start' }]);
  });

  it('puts the words on the shot clip of that scene', () => {
    const shot = MOTION_TEMPLATES.find((t) => (DEMO_TEXTS[t.componentName] ?? []).length > 0)!;
    const plan: DirectorPlan = { title: 't', summary: '', palette: { background: '#fff', text: '#000', accent: '#f50' }, scenes: [{ kind: 'title', recipeId: '', durationSec: 3, headline: 'Hi', caption: '', transition: 'cut' }, { kind: 'shot', recipeId: shot.id, durationSec: 4, headline: 'x', caption: '', transition: 'cut' }] };
    const project = planToProject(plan, { aspectRatio: '16:9', texts: { 1: { Home: 'Start' } } });
    const clip = project.tracks.flatMap((t) => t.clips).find((c) => c.cardId.startsWith('demo:'))!;
    expect(clip.props.texts).toEqual({ Home: 'Start' });
  });
});

describe('writeShotWords', () => {
  const shot = MOTION_TEMPLATES.find((t) => t.componentName === 'ListReveal')!;
  const plan: DirectorPlan = { title: 'Acme — x', summary: '', palette: { background: '#fff', text: '#000', accent: '#f50' }, scenes: [{ kind: 'shot', recipeId: shot.id, durationSec: 4, headline: 'x', caption: '', transition: 'cut' }] };

  it('uses the director\'s words, and the site\'s own words when the director is unreachable', async () => {
    vi.resetModules();
    vi.doMock('../lib/directorClient', async (orig) => ({ ...(await orig<object>()), requestRetext: vi.fn().mockResolvedValue({ 0: { Home: 'Start' } }) }));
    const a = await import('../lib/filmPipeline');
    expect(await a.writeShotWords(plan, null, 'Acme', () => undefined)).toEqual({ 0: { Home: 'Start' } });

    vi.resetModules();
    vi.doMock('../lib/directorClient', async (orig) => ({ ...(await orig<object>()), requestRetext: vi.fn().mockRejectedValue(new Error('no key')) }));
    const b = await import('../lib/filmPipeline');
    const cap = { title: 'Acme', url: 'https://acme.com', content } as never;
    const out = await b.writeShotWords(plan, cap, 'Acme', () => undefined);
    expect(['Stop downtime', 'Help desk support']).toContain(out[0]?.['Every shot, within reach.']);
    // With no site, the scene's own headline still goes into the recipe's first line.
    const bare = await b.writeShotWords({ ...plan, scenes: [{ ...plan.scenes[0], headline: 'Stop downtime' }] }, null, 'Acme', () => undefined);
    expect(Object.values(bare[0] ?? {})).toContain('Stop downtime');
  });
});
