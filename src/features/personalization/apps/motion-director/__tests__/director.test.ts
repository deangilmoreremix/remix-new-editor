import { describe, expect, it } from 'vitest';
import { existsSync } from 'node:fs';
import { MOTION_TEMPLATES, motionCardId } from '../../../data/motionRecipeCatalog';
import { PLAN_LIMITS, buildCatalogBrief, validateEditOps, validatePlan } from '../lib/directorPlan';
import { planToProject, snapToBeats } from '../lib/buildFilm';
import { beatsFromEnvelope } from '../lib/beatSync';
import { PRODUCT_TEXTURE_SHOTS, isProductTextureShot } from '../lib/productShots';
import { CARDS } from '../cards/registry';

const productShot = MOTION_TEMPLATES.find((t) => t.componentName === 'CrashImpactReal')!;
const codeShot = MOTION_TEMPLATES.find((t) => !isProductTextureShot(t.componentName))!;

describe('director plan validation', () => {
  it('keeps catalog shots and titles, drops unknown recipes, and fits the requested length', () => {
    const plan = validatePlan(
      {
        title: 'Launch',
        summary: 's',
        palette: { background: '#FFFFFF', text: '#111111', accent: 'not-a-colour' },
        scenes: [
          { kind: 'title', recipeId: '', durationSec: 2, headline: 'Meet Acme', caption: '', transition: 'cut' },
          { kind: 'shot', recipeId: productShot.id, durationSec: 4, headline: 'Real pages', caption: 'Live', transition: 'flash' },
          { kind: 'shot', recipeId: 'made-up/recipe/Nope', durationSec: 4, headline: 'x', caption: '', transition: 'cut' },
          { kind: 'shot', recipeId: codeShot.id, durationSec: 99, headline: 'Ship it', caption: '', transition: 'cut' },
        ],
      },
      { targetSec: 20 },
    );
    expect(plan.scenes.map((s) => s.recipeId)).toEqual(['', productShot.id, codeShot.id]);
    expect(plan.palette).toEqual({ background: '#ffffff', text: '#111111', accent: '#b5651d' });
    for (const s of plan.scenes) {
      expect(s.durationSec).toBeGreaterThanOrEqual(PLAN_LIMITS.minSceneSec);
      expect(s.durationSec).toBeLessThanOrEqual(PLAN_LIMITS.maxSceneSec);
    }
    const total = plan.scenes.reduce((sum, s) => sum + s.durationSec, 0);
    expect(total).toBeGreaterThan(19);
    expect(total).toBeLessThanOrEqual(20.5);
  });

  it('rejects a plan with too few usable scenes', () => {
    expect(() => validatePlan({ scenes: [{ kind: 'shot', recipeId: 'nope', durationSec: 3 }] }, { targetSec: 10 })).toThrow();
  });

  it('only accepts edit ops for known clips and catalog recipes', () => {
    const { ops } = validateEditOps(
      {
        reply: 'ok',
        ops: [
          { op: 'set_text', clipId: 'c1', text: 'Hello' },
          { op: 'set_text', clipId: 'ghost', text: 'x' },
          { op: 'replace_recipe', clipId: 'c1', recipeId: 'made-up' },
          { op: 'replace_recipe', clipId: 'c1', recipeId: productShot.id },
          { op: 'set_palette', background: '#000000', text: '', accent: 'red' },
          { op: 'drop_table', clipId: 'c1' },
        ],
      },
      new Set(['c1']),
    );
    expect(ops).toEqual([
      { op: 'set_text', clipId: 'c1', text: 'Hello' },
      { op: 'replace_recipe', clipId: 'c1', recipeId: productShot.id },
      { op: 'set_palette', background: '#000000', text: '', accent: '' },
    ]);
  });

  it('lists every shot in the catalog brief and flags product-page shots', () => {
    const brief = buildCatalogBrief().split('\n');
    expect(brief).toHaveLength(MOTION_TEMPLATES.length + 5); // the shots plus the five brand scenes
    expect(brief.filter((l) => l.includes('PRODUCT-PAGE'))).toHaveLength(PRODUCT_TEXTURE_SHOTS.length);
  });
});

describe('product texture shots', () => {
  it('names real catalog shots that exist in the card registry', () => {
    for (const name of PRODUCT_TEXTURE_SHOTS) {
      const t = MOTION_TEMPLATES.find((x) => x.componentName === name);
      expect(t, name).toBeTruthy();
      expect(CARDS[motionCardId(t!)], name).toBeTruthy();
    }
  });
});

describe('film assembly', () => {
  const plan = validatePlan(
    {
      title: 'Acme launch',
      summary: '',
      palette: { background: '#101010', text: '#fafafa', accent: '#ff5500' },
      scenes: [
        { kind: 'title', recipeId: '', durationSec: 2, headline: 'Meet *Acme*', caption: 'The new way', transition: 'cut' },
        { kind: 'shot', recipeId: productShot.id, durationSec: 4, headline: 'Your real pages', caption: 'LIVE PRODUCT', transition: 'flash' },
        { kind: 'shot', recipeId: codeShot.id, durationSec: 4, headline: 'Ship faster', caption: '', transition: 'cut' },
      ],
    },
    { targetSec: 10 },
  );

  it('builds editable tracks: shots back to back, captions, flash cut, background, music', () => {
    const project = planToProject(plan, {
      aspectRatio: '16:9',
      capture: { screens: ['https://cdn.example/page.jpg'], crops: ['https://cdn.example/crop-1.jpg'] },
      music: { url: 'blob:music', name: 'track.mp3', beats: [] },
    });
    const byName = Object.fromEntries(project.tracks.map((t) => [t.name, t.clips]));
    const shots = project.tracks.find((t) => t.clips.some((c) => c.cardId === 'inkpress-title-card'))!.clips;
    expect(shots.map((c) => c.cardId)).toEqual(['inkpress-title-card', motionCardId(productShot), motionCardId(codeShot)]);
    expect(shots[1].start).toBe(shots[0].start + shots[0].duration);
    expect(shots[0].props).toMatchObject({ text: 'Meet *Acme*', sub: 'The new way', bg: '#101010', ink: '#fafafa', accent: '#ff5500' });
    // Captures go only to the shots that render product pages.
    expect(shots[1].props).toMatchObject({ screens: ['https://cdn.example/page.jpg'], crops: ['https://cdn.example/crop-1.jpg'] });
    expect(shots[2].props.screens).toBeUndefined();
    expect(byName.Transitions.map((c) => [c.cardId, c.props.kind])).toEqual([['connected-seam', 'flash']]);
    // One sound effect per scene change: a whoosh on the plain cut, an impact on the flash cut.
    expect(byName.SFX.filter((c) => c.label !== 'Stamp').map((c) => c.props.file)).toEqual([
      'motion-studio/sfxlib/transition/swoosh-quick.mp3',
      'motion-studio/sfxlib/impact/impact-transition.mp3',
    ]);
    for (const c of byName.SFX) expect(existsSync(`public/${c.props.file}`), String(c.props.file)).toBe(true);
    expect(byName.Music[0]).toMatchObject({ cardId: 'audio-clip', props: { file: 'blob:music' } });
    expect(project.name).toBe('Acme launch');
    expect(project.background).toBe('#101010');
    for (const c of project.tracks.flatMap((t) => t.clips)) expect(CARDS[c.cardId], c.cardId).toBeTruthy();
  });

  it('snaps scene changes to nearby beats and keeps scenes long enough', () => {
    const snapped = snapToBeats([2, 2, 2], [2.2, 3.9, 6]);
    [2.2, 1.7, 2.1].forEach((v, i) => expect(snapped[i]).toBeCloseTo(v, 6));
    // The film's total length is unchanged.
    expect(snapped.reduce((a, b) => a + b, 0)).toBeCloseTo(6, 6);
    expect(snapToBeats([2, 2], [])).toEqual([2, 2]);
    // A downbeat a little further away still beats a plain beat; without it the nearest beat wins.
    expect(snapToBeats([2, 2], [2.1], 0.35, 1.2, { downbeats: [2.2] })[0]).toBeCloseTo(2.2);
    expect(snapToBeats([2, 2], [2.1])[0]).toBeCloseTo(2.1);
    // A beat farther than the window is ignored.
    expect(snapToBeats([2, 2], [3])).toEqual([2, 2]);
  });
});

describe('beat detection', () => {
  it('finds a 120 BPM pulse in a synthetic envelope', () => {
    const hop = 0.01;
    const env = Array.from({ length: 1000 }, (_, i) => (i % 50 === 5 ? 1 : 0.05));
    const { bpm, beats } = beatsFromEnvelope(env, hop, 10);
    expect(bpm).toBe(120);
    expect(beats[1] - beats[0]).toBeCloseTo(0.5, 2);
  });

  it('returns no beats for silence', () => {
    expect(beatsFromEnvelope(new Array(500).fill(0), 0.01, 5).beats).toEqual([]);
  });
});
