import { describe, expect, it } from 'vitest';
import { buildDesignSpec, reviewAgainstSpec, specMarkdown } from '../lib/designSpec';
import type { DirectorPlan } from '../lib/directorPlan';
import type { ProjectData } from '../types';

const plan = {
  title: 'Acme — promo',
  palette: { background: '#101010', text: '#f5f5f5', accent: '#3366ff' },
  scenes: [
    { kind: 'title', recipeId: '', durationSec: 2, headline: 'Meet *Acme*', caption: '', transition: 'cut' },
    { kind: 'shot', recipeId: 'brand/hub', durationSec: 4, headline: '', caption: '', transition: 'dip', feature: 'Everything in one place' },
  ],
} as unknown as DirectorPlan;

describe('design spec', () => {
  const spec = buildDesignSpec(plan, null, 'make a promo');
  it('records the storyboard, tokens and data rules', () => {
    expect(spec.scenes.map((s) => s.start)).toEqual([0, 2]);
    expect(spec.tokens.accent).toBe('#3366ff');
    expect(spec.sampleOnly).toBe(true);
    expect(spec.dataRules.length).toBeGreaterThan(0);
    const md = specMarkdown(spec);
    expect(md).toContain('# Design spec — Acme — promo');
    expect(md).toContain('**Brief:** make a promo');
    expect(md).toContain('| 2 |');
  });
  it('flags captions off the spec accent', () => {
    const project = { name: 'x', fps: 30, width: 1920, height: 1080, spec, tracks: [{ id: 't', name: 'c', clips: [{ id: 'c1', cardId: 'inkpress-caption', start: 0, duration: 30, inOffset: 0, speed: 1, opacity: 1, scale: 1, x: 0, y: 0, props: { accent: '#ff0000' } }] }] } as ProjectData;
    const items = reviewAgainstSpec(project);
    expect(items.find((i) => i.code === 'V3')?.ok).toBe(false);
    expect(items.find((i) => i.code === 'V1')?.ok).toBe(true);
  });
  it('is silent without a spec', () => {
    expect(reviewAgainstSpec({ name: 'x', fps: 30, width: 1, height: 1, tracks: [] } as ProjectData)).toEqual([]);
  });
});
