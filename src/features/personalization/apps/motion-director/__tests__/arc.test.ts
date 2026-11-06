import { describe, expect, it } from 'vitest';
import { MOTION_TEMPLATES } from '../../../data/motionRecipeCatalog';
import { SHOT_FACTS } from '../demosrc/_generated/shotFacts';
import { arrangeArc, sceneEnergy } from '../lib/filmChat';
import type { DirectorPlan, DirectorScene } from '../lib/directorPlan';

const id = (stem: string) => MOTION_TEMPLATES.find((t) => t.componentName === stem)!.id;
const byEnergy = (e: string) => MOTION_TEMPLATES.filter((t) => SHOT_FACTS[t.componentName]?.energy === e && SHOT_FACTS[t.componentName]?.slug !== 'document-typewriter-reveal' && !SHOT_FACTS[t.componentName]?.technique).map((t) => t.id);
const shot = (recipeId: string): DirectorScene => ({ kind: 'shot', recipeId, durationSec: 4, headline: '', caption: '', transition: 'cut' });
const title: DirectorScene = { kind: 'title', recipeId: '', durationSec: 2, headline: 'x', caption: '', transition: 'cut' };
const plan = (scenes: DirectorScene[]): DirectorPlan => ({ title: 't', summary: '', palette: { background: '#fff', text: '#000', accent: '#f00' }, scenes });

describe('promo-energy-arc step 3', () => {
  const [h1, h2, h3] = byEnergy('high');
  const [l1, l2] = byEnergy('low');
  const doc = id('DocumentTypewriterReveal');

  it('alternates high and steady shots in the feature climb, and puts the document shot just before the finale', () => {
    const p = plan([title, shot(id('SpotlightHeroCard')), shot(doc), shot(h1), shot(h2), shot(h3), shot(l1), shot(l2), shot('brand/logo-reveal')]);
    const out = arrangeArc(p).scenes;
    expect(out[1].recipeId).toBe(id('SpotlightHeroCard'));
    expect(out[0].kind).toBe('title');
    expect(out[out.length - 1].recipeId).toBe('brand/logo-reveal');
    expect(out[out.length - 2].recipeId).toBe(doc);
    const climb = out.slice(2, -2).map((s) => sceneEnergy(s) >= 3);
    for (let i = 1; i < climb.length - 1; i++) expect(climb[i] && climb[i - 1] && climb[i + 1]).toBe(false);
    expect(new Set(out.map((s) => s.recipeId)).size).toBe(new Set(p.scenes.map((s) => s.recipeId)).size);
  });

  it('keeps the order of shots the person named', () => {
    const p = plan([shot(h1), shot(doc), shot(h2), shot(h3)]);
    expect(arrangeArc(p, new Set([h1])).scenes).toBe(p.scenes);
  });
});
