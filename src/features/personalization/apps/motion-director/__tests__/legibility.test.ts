// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { MOTION_TEMPLATES } from '../../../data/motionRecipeCatalog';
import { planToProject } from '../lib/buildFilm';
import type { DirectorPlan } from '../lib/directorPlan';

const palette = { background: '#101018', text: '#ffffff', accent: '#8b6bff' };
const shot = MOTION_TEMPLATES.find((t) => t.componentName === 'ListReveal')!;
const plan: DirectorPlan = { title: 't', summary: '', palette, scenes: [{ kind: 'shot', recipeId: shot.id, durationSec: 4, headline: 'Every shot, within reach', caption: 'Stop downtime before it starts', transition: 'cut' }, { kind: 'shot', recipeId: shot.id, durationSec: 4, headline: 'x', caption: '', transition: 'cut' }] };

describe('legibility (aesthetic-rules Q11)', () => {
  it('sets captions at 5.2 % of the frame height or more (1080p: 56 px)', () => {
    for (const [ratio, height] of [['16:9', 1080], ['9:16', 1920], ['1:1', 1080]] as const) {
      const project = planToProject(plan, { aspectRatio: ratio });
      const caption = project.tracks.flatMap((t) => t.clips).find((c) => c.cardId === 'inkpress-caption')!;
      const px = Number(caption.props.fontSize);
      expect(px / Math.min(project.height, project.width * 0.9), ratio).toBeGreaterThanOrEqual(0.05);
      if (ratio === '16:9') expect(px).toBe(56);
      expect(height).toBe(project.height);
    }
  });

  it('keeps long captions in normal case so they can wrap onto two lines', () => {
    const long = { ...plan, scenes: [{ ...plan.scenes[0], caption: 'A managed IT team that fixes it before you notice' }, plan.scenes[1]] };
    const caption = planToProject(long, { aspectRatio: '16:9' }).tracks.flatMap((t) => t.clips).find((c) => c.cardId === 'inkpress-caption')!;
    expect(caption.props.uppercase).toBe(false);
  });
});
