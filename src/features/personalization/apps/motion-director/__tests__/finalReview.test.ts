import { describe, expect, it, vi } from 'vitest';
import { MOTION_TEMPLATES } from '../../../data/motionRecipeCatalog';
import { planToProject } from '../lib/buildFilm';
import { applyReviewFixes, finalReviewLines, reviewShots, runFinalReview, type FinalReviewDeps } from '../lib/finalReview';
import type { DirectorPlan } from '../lib/directorPlan';
import { AESTHETIC_RULES, FINAL_REVIEW } from '../lib/_generated/reviewChecklists';

const id = (c: string) => MOTION_TEMPLATES.find((t) => t.componentName === c)!.id;
const plan: DirectorPlan = {
  title: 'Acme',
  summary: '',
  palette: { background: '#101018', text: '#ffffff', accent: '#8b6bff' },
  scenes: [
    { kind: 'shot', recipeId: id('DeckDealFlyin'), durationSec: 5, headline: 'a', caption: 'one', transition: 'whip' },
    { kind: 'shot', recipeId: id('RowEmbed'), durationSec: 5, headline: 'b', caption: 'two', transition: 'cut' },
    { kind: 'title', recipeId: '', durationSec: 2, headline: 'Try Acme', caption: '', transition: 'cut' },
  ],
};

describe('stage 7: the independent review gets everything the pipeline lists', () => {
  it('carries the English checklists', () => {
    expect(FINAL_REVIEW).toContain('F1:');
    expect(FINAL_REVIEW).toContain('Q');
    expect(AESTHETIC_RULES.split('\n').filter((l) => /^[A-Z]\d+\. /.test(l)).length).toBe(27);
  });

  it('sends each shot with its card pitfalls, its reference frames and the film\'s frames at the same moments, plus the seams; merges the answers', async () => {
    const project = { ...planToProject(plan, { aspectRatio: '16:9' } as never), spec: { brief: 'b' } as never };
    const calls: Array<Parameters<FinalReviewDeps['request']>[0]> = [];
    const deps: FinalReviewDeps = {
      frame: vi.fn(async (_p, f) => `data:image/jpeg;base64,${f}`),
      reference: vi.fn(async (stem) => [`ref-${stem}-a`, `ref-${stem}-b`, `ref-${stem}-c`]),
      request: vi.fn(async (body) => {
        calls.push(body);
        return body.part === 'film'
          ? { items: [{ id: 'B1', ok: false, seconds: [5], text: 'the whip seam shows a blank frame', stage: '3' as const }], summary: 'Motion and sound need playback.' }
          : { items: [{ id: 'S2', ok: true, seconds: [1.1], text: 'deck deal keeps its composition', stage: 'none' as const }], summary: '' };
      }),
    };
    const report = await runFinalReview(project, deps);
    const shots = calls.find((c) => c.part === 'shots')!.shots!;
    expect(shots.map((s) => s.name)).toHaveLength(3);
    expect(shots[0].pitfalls.length).toBeGreaterThan(0);
    expect(shots[0].reference).toEqual(['ref-DeckDealFlyin-a', 'ref-DeckDealFlyin-b', 'ref-DeckDealFlyin-c']);
    expect(shots[0].rendered).toHaveLength(3);
    const film = calls.find((c) => c.part === 'film')!;
    expect(film.seams).toHaveLength(1);
    expect(film.seams![0].kind).toBe('whip');
    expect(report.items.map((i) => i.id)).toEqual(['B1', 'S2']);
    const lines = finalReviewLines(report);
    expect(lines[0]).toMatch(/3 shots compared .*, 1 seam, .* 1 ✓, 1 ✗\./);
    expect(lines[1]).toBe('✗ B1 (5.0s): the whip seam shows a blank frame → storyboard / seams');

    // Stage 3 fix: the failed seam becomes a plain cut and the incoming shot starts at its own first frame again.
    const { project: fixed, fixed: notes } = applyReviewFixes(project, report.items);
    expect(fixed.tracks.flatMap((t) => t.clips).some((c) => c.cardId === 'connected-seam')).toBe(false);
    expect(reviewShots(fixed)[1].clip.inOffset).toBe(0);
    expect(notes[0]).toMatch(/whip seam at 5\.0s is a plain cut now/);
  });
});

describe('a late review never throws away edits', () => {
  it('applies only while the film on screen and the workbench copy are still the reviewed ones', async () => {
    const { reviewStillApplies } = await import('../lib/finalReview');
    const built = { project: {} };
    const project = built.project;
    expect(reviewStillApplies({ installed: built, reviewed: built, project })).toBe(true);
    expect(reviewStillApplies({ installed: built, reviewed: built, current: () => project, project })).toBe(true);
    // Edited in the workbench meanwhile (the store holds a new project object).
    expect(reviewStillApplies({ installed: built, reviewed: built, current: () => ({ ...project }), project })).toBe(false);
    // A new film was built meanwhile.
    expect(reviewStillApplies({ installed: { project: {} }, reviewed: built, project })).toBe(false);
  });
});
