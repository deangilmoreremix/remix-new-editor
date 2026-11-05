// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { MOTION_TEMPLATES } from '../../../data/motionRecipeCatalog';
import { planToProject } from '../lib/buildFilm';
import type { DirectorPlan } from '../lib/directorPlan';
import type { AdaptRequest } from '../lib/directorClient';
import { adaptFilm, adaptShot, adaptTargets, stillFrames, type AdaptDeps } from '../lib/adaptLoop';

const palette = { background: '#101018', text: '#ffffff', accent: '#8b6bff' };
const id = (c: string) => MOTION_TEMPLATES.find((t) => t.componentName === c)!.id;
const plan: DirectorPlan = {
  title: 't',
  summary: '',
  palette,
  scenes: [
    { kind: 'shot', recipeId: id('RowEmbed'), durationSec: 5, headline: 'a', caption: 'b', transition: 'cut' },
    { kind: 'shot', recipeId: id('SpotlightHeroCard'), durationSec: 6, headline: 'a', caption: 'b', transition: 'cut' },
    { kind: 'title', recipeId: '', durationSec: 3, headline: 'End', caption: '', transition: 'cut' },
  ],
};
const project = () => planToProject(plan, { aspectRatio: '16:9' });
const ctx = { screens: ['p.png'], crops: ['c.png'], layout: { pageH: 3000, sections: [], cards: [] }, brand: { name: 'Acme' } };
const GOOD = `import React from 'react';\nexport const RowEmbed = () => <div>ok</div>;\nexport const ROW_EMBED_DURATION = 68;`;
const deps = (over: Partial<AdaptDeps> = {}): AdaptDeps => ({
  render: vi.fn(async () => undefined),
  request: vi.fn(async () => ({ code: GOOD, notes: 'swapped the page' })),
  source: vi.fn(async () => 'export const RowEmbed = () => null'),
  card: vi.fn(async () => '---\nname: row-embed\n---\n## 已知坑\n- land in the real slot'),
  reference: vi.fn(async () => ['data:image/jpeg;base64,REF']),
  ...over,
});

describe('adapting shots', () => {
  it('targets shots that draw sample screens first and skips title cards', () => {
    const ids = adaptTargets(project()).map((c) => c.cardId);
    expect(ids.length).toBeGreaterThan(0);
    expect(ids.every((c) => c.startsWith('demo:'))).toBe(true);
  });

  it('keeps a clean adaptation and renders three stills of it', async () => {
    const p = project();
    const clip = adaptTargets(p)[0];
    const d = deps();
    const out = await adaptShot(p, clip, ctx, d, new AbortController().signal);
    expect(out?.props.adaptedCode).toBe(GOOD);
    expect(out?.props.adaptedStem).toBe(clip.cardId.slice(5));
    expect(d.render).toHaveBeenCalledTimes(3);
    expect(stillFrames(clip)).toHaveLength(3);
  });

  it('sends the problem back and tries again when the code is refused, then gives up', async () => {
    const p = project();
    const clip = adaptTargets(p)[0];
    const request = vi.fn(async (_b: AdaptRequest) => ({ code: `export const X = () => fetch("/x")`, notes: "" }));
    const out = await adaptShot(p, clip, ctx, deps({ request }), new AbortController().signal);
    expect(out).toBeNull();
    expect(request).toHaveBeenCalledTimes(3);
    expect((request.mock.calls[1][0] as { problems?: string[] }).problems?.[0]).toMatch(/refused/);
  });

  it('feeds render failures back and succeeds on the next round', async () => {
    const p = project();
    const clip = adaptTargets(p)[0];
    const stem = clip.cardId.slice(5);
    const good = `export const ${stem} = () => <div>ok</div>;`;
    let n = 0;
    const render = vi.fn(async () => {
      if (n++ === 0) throw new Error('boom');
    });
    const request = vi.fn(async (_b: AdaptRequest) => ({ code: good, notes: "" }));
    const out = await adaptShot(p, clip, ctx, deps({ render, request }), new AbortController().signal);
    expect(out?.props.adaptedCode).toBe(good);
    expect(request).toHaveBeenCalledTimes(2);
    expect((request.mock.calls[1][0] as { problems?: string[] }).problems?.[0]).toMatch(/failed to render: boom/);
  });

  it('leaves the film alone when nothing passes, and stops at a missing key', async () => {
    const p = project();
    const logs: string[] = [];
    const none = await adaptFilm(p, ctx, deps({ request: vi.fn(async () => ({ code: 'nope', notes: '' })) }), (l) => logs.push(l));
    expect(JSON.stringify(none)).not.toContain('adaptedCode');
    expect(logs.join('\n')).toMatch(/Kept the original/);
  });

  it('works like the coding agent: reads the card and the reference, then sees its own stills next to it', async () => {
    const p = project();
    const clip = adaptTargets(p)[0];
    const render = vi.fn().mockRejectedValueOnce(new Error('blank frame')).mockResolvedValue({ blob: 'ok' });
    const d = deps({ render, snapshot: vi.fn(async () => 'data:image/jpeg;base64,MINE') });
    const done = await adaptShot(p, clip, ctx, d, new AbortController().signal);
    expect(done).not.toBeNull();
    const calls = (d.request as ReturnType<typeof vi.fn>).mock.calls.map((c) => c[0] as AdaptRequest);
    expect(calls[0].card).toContain('row-embed');
    expect(calls[0].reference).toEqual(['data:image/jpeg;base64,REF']);
    expect(calls[0].stills).toBeUndefined();
    expect(calls[1].problems?.[0]).toContain('blank frame');
    expect(calls[1].stills).toEqual(['data:image/jpeg;base64,MINE', 'data:image/jpeg;base64,MINE']);
  });

  it('adapts every recipe shot of the film, not just the first few', () => {
    const many: DirectorPlan = { ...plan, scenes: ['RowEmbed', 'SpotlightHeroCard', 'DeckDealFlyin', 'PageWaterfallWall', 'CardStack', 'ListReveal'].map((c) => ({ kind: 'shot' as const, recipeId: id(c), durationSec: 4, headline: 'a', caption: 'b', transition: 'cut' as const })) };
    expect(adaptTargets(planToProject(many, { aspectRatio: '16:9' })).length).toBe(6);
  });
});
