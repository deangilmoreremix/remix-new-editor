// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { MOTION_TEMPLATES } from '../../../data/motionRecipeCatalog';
import { planToProject } from '../lib/buildFilm';
import { reviewFilm, reviewSummary } from '../lib/filmReview';
import type { DirectorPlan } from '../lib/directorPlan';
import type { ProjectData } from '../types';

const palette = { background: '#101018', text: '#ffffff', accent: '#8b6bff' };
const id = (c: string) => MOTION_TEMPLATES.find((t) => t.componentName === c)!.id;
let n = 0;
const scene = (recipeId: string, kind: 'shot' | 'title' = 'shot', durationSec = 6) => ({ kind, recipeId, durationSec, headline: `Line ${++n}`, caption: `Caption words ${n}`, transition: 'cut' as const });
const music = { url: 'https://cdn.test/music.mp3', name: 'music' };

describe('final review', () => {
  it('passes a clean film and says what it checked', () => {
    const plan: DirectorPlan = { title: 't', summary: '', palette, scenes: [scene(id('SpotlightHeroCard')), scene(id('RowEmbed')), scene(id('ListStackPress')), scene('', 'title', 3)] };
    const items = reviewFilm(planToProject(plan, { aspectRatio: '16:9', music } as never));
    expect(items.filter((i) => !i.ok), JSON.stringify(items.filter((i) => !i.ok))).toEqual([]);
    expect(reviewSummary(items)[0]).toMatch(/passed\./);
  });

  it('names the second of a repeated recipe, a clipped recipe, a short ending and tiny captions', () => {
    const plan: DirectorPlan = { title: 't', summary: '', palette, scenes: [scene(id('RowEmbed')), scene(id('RowEmbed')), scene(id('ListStackPress'), 'shot', 6)] };
    const project: ProjectData = planToProject(plan, { aspectRatio: '16:9' });
    const clips = project.tracks.flatMap((t) => t.clips);
    // Cut the last recipe short, make the ending short and the captions small.
    const lastShot = clips.filter((c) => c.cardId.startsWith('demo:')).pop()!;
    lastShot.duration = 20;
    lastShot.speed = 1;
    clips.filter((c) => c.cardId === 'inkpress-caption').forEach((c) => (c.props.fontSize = 22));
    const items = reviewFilm(project);
    const bad = Object.fromEntries(items.filter((i) => !i.ok && !(i.code === 'F2' && /said again/.test(i.text))).map((i) => [i.code, i.text]));
    expect(bad.F2).toMatch(/plays again at/);
    expect(bad.S3).toMatch(/Cut short/);
    expect(bad.B3).toMatch(/holds only/);
    expect(bad.Q11).toMatch(/too small/);
    expect(reviewSummary(items).slice(1).every((l) => l.startsWith('- '))).toBe(true);
  });
});

const samplePlan = (): DirectorPlan => ({ title: 't', summary: '', palette, scenes: [scene(id('SpotlightHeroCard')), scene('', 'title', 3)] });

describe('content self-check', () => {
  it('flags a line said twice and a mute stretch', () => {
    const same = (recipeId: string) => ({ kind: 'shot' as const, recipeId, durationSec: 6, headline: 'Same', caption: 'The same caption', transition: 'cut' as const });
    const items = reviewFilm(planToProject({ title: 't', summary: '', palette, scenes: [same(id('SpotlightHeroCard')), same(id('RowEmbed'))] }, { aspectRatio: '16:9' }));
    const f2 = items.find((i) => i.code === 'F2' && !i.ok && /said again/.test(i.text));
    expect(f2?.text).toContain('The same caption');
    expect(items.find((i) => i.code === 'A2')!.ok).toBe(false);
  });
});

describe('A5 long sound samples', () => {
  it('flags a >5 s sample left running for over 3 s and accepts a trimmed one', async () => {
    const { SFX_PEAKS } = await import('../demosrc/_generated/sfxPeaks');
    const long = Object.entries(SFX_PEAKS).find(([, v]) => v.durationMs > 5000)![0];
    const base = reviewFilm(planToProject(samplePlan(), { aspectRatio: '16:9' }));
    expect(base.find((i) => i.code === 'A5')?.ok).toBe(true);
    const project = planToProject(samplePlan(), { aspectRatio: '16:9' });
    project.tracks.push({ id: 'tA5', name: 'x', clips: [{ id: 'cA5', cardId: 'audio-clip', start: 0, duration: 200, speed: 1, props: { file: `motion-studio/sfxlib/${long}.mp3` } }] } as never);
    expect(reviewFilm(project).find((i) => i.code === 'A5')?.ok).toBe(false);
  });
});

describe('D2 and P3', () => {
  const withWords = (extra: Record<string, unknown>, brief = 'a promo') => {
    const p = planToProject(samplePlan(), { aspectRatio: '16:9' });
    p.spec = { ...(p.spec ?? ({} as never)), version: 1, brief, product: 'Acme', url: null, sampleOnly: false, tokens: { background: '#000', text: '#fff', accent: '#8b6bff', font: null }, scenes: [], dataRules: [] } as never;
    p.tracks[0].clips.push({ id: 'w1', cardId: 'inkpress-caption', start: 0, duration: 30, inOffset: 0, speed: 1, opacity: 1, scale: 1, x: 0, y: 0, props: { text: 'x', fontSize: 80, ...extra } } as never);
    return reviewFilm(p);
  };
  const code = (items: ReturnType<typeof reviewFilm>, c: string) => items.find((i) => i.code === c)!;

  it('flags a named person nobody asked for, and accepts them when the brief asked for people', () => {
    const named = { text: 'Andrew Garnett President & CEO' };
    expect(code(withWords(named), 'D2').ok).toBe(false);
    expect(code(withWords(named, 'use its images and people'), 'D2').ok).toBe(true);
    expect(code(withWords({ text: 'Meet Acme.' }), 'D2').ok).toBe(true);
  });

  it('flags a number, rank or guarantee the brief did not give', () => {
    expect(code(withWords({ text: '99% faster, guaranteed' }), 'P3').ok).toBe(false);
    expect(code(withWords({ text: 'Ranked #1 in town' }), 'P3').ok).toBe(false);
    expect(code(withWords({ text: 'Your IT, handled.' }), 'P3').ok).toBe(true);
    expect(code(withWords({ text: '99% faster' }, 'show 99% faster'), 'P3').ok).toBe(true);
  });
});
