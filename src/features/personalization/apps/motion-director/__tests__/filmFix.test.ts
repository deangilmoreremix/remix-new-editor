// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { MOTION_TEMPLATES } from '../../../data/motionRecipeCatalog';
import { planToProject } from '../lib/buildFilm';
import { reviewFilm } from '../lib/filmReview';
import { fixFilm } from '../lib/filmFix';
import type { DirectorPlan } from '../lib/directorPlan';

const palette = { background: '#101018', text: '#ffffff', accent: '#8b6bff' };
const id = (c: string) => MOTION_TEMPLATES.find((t) => t.componentName === c)!.id;
const plan: DirectorPlan = { title: 't', summary: '', palette, scenes: [
  { kind: 'shot', recipeId: id('SpotlightHeroCard'), durationSec: 6, headline: 'Line', caption: 'Caption words', transition: 'cut' },
  { kind: 'title', recipeId: '', durationSec: 3, headline: 'End', caption: '', transition: 'cut' },
] };

describe('fixing review findings', () => {
  it('repairs small captions, a short ending and alert sounds, then the review passes them', () => {
    const p = planToProject(plan, { aspectRatio: '16:9' });
    const clips = p.tracks.flatMap((t) => t.clips);
    clips.filter((c) => c.cardId === 'inkpress-caption').forEach((c) => (c.props.fontSize = 20));
    const lastVisual = clips.filter((c) => c.cardId === 'inkpress-title-card').pop()!;
    lastVisual.duration = 10;
    p.tracks[0].clips.push({ id: 'ui1', cardId: 'audio-clip', start: 5, duration: 30, inOffset: 0, speed: 1, opacity: 1, scale: 1, x: 0, y: 0, props: { file: 'motion-studio/sfxlib/ui/ui-confirm-tone.mp3' } } as never);
    const before = reviewFilm(p).filter((i) => !i.ok).map((i) => i.code);
    expect(before).toEqual(expect.arrayContaining(['Q11', 'B3', 'A7']));
    const { project, fixed } = fixFilm(p);
    expect(fixed.length).toBeGreaterThanOrEqual(3);
    const after = reviewFilm(project).filter((i) => !i.ok).map((i) => i.code);
    for (const code of ['Q11', 'B3', 'A7']) expect(after).not.toContain(code);
  });

  it('leaves a clean film untouched', () => {
    const p = planToProject(plan, { aspectRatio: '16:9' });
    expect(fixFilm(p).fixed).toEqual([]);
    expect(fixFilm(p).project).toBe(p);
  });
});
