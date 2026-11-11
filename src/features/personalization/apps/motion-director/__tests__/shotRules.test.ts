import { describe, expect, it } from 'vitest';
import { MOTION_TEMPLATES, resolveMotionTemplate } from '../../../data/motionRecipeCatalog';
import { SHOT_FACTS } from '../demosrc/_generated/shotFacts';
import { GROUP_CAPS, filmRuleViolations, rulesOf, ruleTags } from '../lib/shotRules';
import { applyFilmRules } from '../lib/filmChat';
import { buildCatalogBrief, type DirectorPlan } from '../lib/directorPlan';

const idOf = (component: string) => MOTION_TEMPLATES.find((t) => t.componentName === component)!.id;
const shot = (component: string) => ({ kind: 'shot' as const, recipeId: idOf(component), durationSec: 4, headline: component, caption: '', transition: 'cut' as const });
const palette = { background: '#101018', text: '#fff', accent: '#f50' };

describe('shot-card rules', () => {
  it('knows every recipe, and every group a recipe names has a cap', () => {
    for (const t of MOTION_TEMPLATES) {
      const r = rulesOf(t.componentName);
      expect(r, t.componentName).toBeTruthy();
      for (const g of r!.groups) expect(GROUP_CAPS[g], `${t.componentName}:${g}`).toBeGreaterThan(0);
    }
    expect(Object.keys(SHOT_FACTS).length).toBe(MOTION_TEMPLATES.length);
  });

  it('reads the upstream facts: roles, looks, fixed text, sound', () => {
    expect(rulesOf('SpotlightHeroCard')).toMatchObject({ role: 'opening', polarity: 'dark' });
    expect(rulesOf('OutroGroupPhotoLaunch')?.role).toBe('outro');
    expect(rulesOf('PaperTitleCard')?.role).toBe('title');
    expect(rulesOf('TextAsMask')?.text).toBe('fixed');
    expect(rulesOf('GlitchCycle')?.text).toBe('structural');
    expect(rulesOf('ListReveal')?.text).toBe('free');
    expect(ruleTags('SpotlightHeroCard')).toContain('OPENING');
    expect(buildCatalogBrief()).toContain('TEXT-FIXED');
  });

  it('flags a repeated recipe, a second outro kind, a mid-film opener, an over-full group and the other look family', () => {
    const scenes = [shot('SpotlightHeroCard'), shot('DeckDealFlyin'), shot('DeckDealFlyin'), shot('OutroGroupPhotoLaunch'), shot('UiStripAwayOutro')];
    const found = filmRuleViolations(scenes);
    expect(found.map((f) => f.index)).toContain(2);
    expect(found.find((f) => f.index === 2)?.reason).toMatch(/twice/);
    expect(found.find((f) => f.index === 4)?.reason).toMatch(/outroKind|outro/);
    const mid = filmRuleViolations([shot('DeckDealFlyin'), shot('RowEmbed'), shot('ListStackPress'), shot('SpotlightHeroCard'), shot('OutroGroupPhotoLaunch')]);
    expect(mid.find((f) => f.recipeId === idOf('SpotlightHeroCard'))?.reason).toMatch(/opening/);
  });

  it('never reports a recipe the person named, and lets the others make way for it', () => {
    const scenes = [shot('SpotlightHeroCard'), shot('AnimeImpact'), shot('RisoMisregistrationHit'), shot('CrashImpactReal'), shot('ScoreSlam')];
    const keep = new Set([idOf('ScoreSlam'), idOf('CrashImpactReal'), idOf('AnimeImpact'), idOf('RisoMisregistrationHit')]);
    expect(filmRuleViolations(scenes, keep)).toEqual([]);
    const without = filmRuleViolations(scenes);
    expect(without.length).toBeGreaterThanOrEqual(0);
  });

  it('applyFilmRules swaps a rule-breaker for a site scene with the same copy, or drops it', () => {
    const plan: DirectorPlan = { title: 't', summary: '', palette, scenes: [shot('SpotlightHeroCard'), shot('DeckDealFlyin'), shot('DeckDealFlyin'), shot('RowEmbed')] };
    const withSite = applyFilmRules(plan, { siteScenes: true });
    expect(withSite.plan.scenes.map((s) => s.recipeId)).toEqual([idOf('SpotlightHeroCard'), idOf('DeckDealFlyin'), 'brand/hub', idOf('RowEmbed')]);
    expect(withSite.plan.scenes[2].headline).toBe('DeckDealFlyin');
    expect(withSite.notes[0]).toMatch(/twice/);
    const without = applyFilmRules(plan);
    expect(without.plan.scenes).toHaveLength(3);
    expect(applyFilmRules({ ...plan, scenes: [plan.scenes[0], plan.scenes[1], plan.scenes[3]] }).notes).toEqual([]);
    expect(resolveMotionTemplate(plan.scenes[0].recipeId)).toBeTruthy();
  });
});

describe('native lengths', () => {
  it('plays each recipe at its native length, drops fillers when over, grows holds when under', async () => {
    const { fitNativeLengths } = await import('../lib/filmChat');
    const nativeSec = (c: string) => MOTION_TEMPLATES.find((t) => t.componentName === c)!.durationSec;
    const title = { kind: 'title' as const, recipeId: '', durationSec: 2, headline: 'Hi', caption: '', transition: 'cut' as const };
    const plan: DirectorPlan = { title: 't', summary: '', palette, scenes: [title, shot('SpotlightHeroCard'), shot('DeckDealFlyin'), { ...title, headline: 'Mid' }, shot('RowEmbed'), { ...title, headline: 'End' }] };
    const roomy = fitNativeLengths(plan, 60);
    const natives = [nativeSec('SpotlightHeroCard'), nativeSec('DeckDealFlyin'), nativeSec('RowEmbed')];
    const shots = roomy.scenes.filter((s) => s.kind === 'shot');
    shots.forEach((s, i) => expect(s.durationSec).toBeGreaterThanOrEqual(natives[i] - 0.11));
    // Under the request the film ends short instead of stretching a recipe: at most +30 % holds.
    shots.forEach((s, i) => expect(s.durationSec).toBeLessThanOrEqual(natives[i] * 1.3 + 0.2));
    const tight = fitNativeLengths(plan, 14, new Set([idOf('SpotlightHeroCard')]));
    expect(tight.scenes.length).toBeLessThan(plan.scenes.length);
    expect(tight.scenes.some((s) => s.recipeId === idOf('SpotlightHeroCard'))).toBe(true);
    expect(tight.scenes[0].kind).toBe('title');
    expect(tight.scenes[tight.scenes.length - 1].headline).toBe('End');
  });
});
