import { describe, expect, it } from 'vitest';
import { chooseSeams } from '../lib/filmChat';
import { validatePlan, type DirectorPlan, type DirectorScene } from '../lib/directorPlan';
import { planToProject } from '../lib/buildFilm';
import { MOTION_TEMPLATES } from '../../../data/motionRecipeCatalog';
import { SHOT_FACTS } from '../demosrc/_generated/shotFacts';
import { seamLook, whipTravel } from '../lib/seams';

const scene = (kind: 'shot' | 'title', recipeId: string, transition: DirectorScene['transition'] = 'cut'): DirectorScene => ({
  kind,
  recipeId,
  durationSec: 3,
  headline: kind === 'title' ? 'Hello' : '',
  caption: '',
  transition,
});
const palette = { background: '#101010', text: '#f5f5f5', accent: '#3366ff' };
const plan = (scenes: DirectorScene[]): DirectorPlan => ({ title: 't', palette, scenes } as DirectorPlan);

describe('chooseSeams', () => {
  const shots = Array.from({ length: 8 }, (_, i) => scene('shot', `brand/feature-zoom`, 'cut'));

  it('dresses every shot-to-shot seam while the caps last (no bare cuts between shots), and respects the caps', () => {
    const out = chooseSeams(plan(shots)).scenes.map((s) => s.transition);
    expect(out.filter((t) => t === 'wipe' || t === 'barn' || t === 'ink').length).toBeLessThanOrEqual(2);
    expect(out.filter((t) => t === 'dip' || t === 'iris').length).toBeLessThanOrEqual(2);
    expect(out.filter((t) => t === 'window').length).toBeLessThanOrEqual(2);
    expect(out.filter((t) => t === 'flash' || t === 'glitch').length).toBeLessThanOrEqual(3);
    expect(out.slice(0, -1).every((t) => t !== 'cut')).toBe(true);
    expect(out[out.length - 1]).toBe('cut');
  });

  it('cuts plainly next to a title card', () => {
    const out = chooseSeams(plan([scene('title', ''), scene('shot', 'brand/hub'), scene('shot', 'brand/feature-zoom'), scene('title', '')])).scenes.map((s) => s.transition);
    expect(out[0]).toBe('cut');
    expect(out[2]).toBe('cut');
  });

  it('dips into the closing logo', () => {
    const out = chooseSeams(plan([scene('shot', 'brand/hub'), scene('shot', 'brand/feature-zoom'), scene('shot', 'brand/logo-reveal')])).scenes.map((s) => s.transition);
    expect(out[1]).toBe('dip');
  });

  it("drops the director's picks beyond a cap", () => {
    const many = Array.from({ length: 6 }, () => scene('shot', 'brand/feature-zoom', 'wipe'));
    const out = chooseSeams(plan(many)).scenes.filter((s) => s.transition === 'wipe' || s.transition === 'barn');
    expect(out.length).toBeLessThanOrEqual(2);
  });
});

describe('seam transitions in the film', () => {
  it('validatePlan keeps the new kinds', () => {
    const p = validatePlan({ title: 't', palette, scenes: [{ ...scene('title', ''), transition: 'wipe' }, { ...scene('title', ''), transition: 'barn' }, { ...scene('title', ''), transition: 'dip' }, scene('title', '')] }, { targetSec: 12 });
    expect(p.scenes.map((s) => s.transition)).toEqual(['wipe', 'barn', 'dip', 'cut']);
  });

  it('planToProject lays a seam card centred on each dressed cut', () => {
    const p = plan([scene('title', '', 'wipe'), scene('title', '', 'barn'), scene('title', '', 'dip'), scene('title', '')]);
    const project = planToProject(p, {} as never);
    const seams = project.tracks.flatMap((t) => t.clips).filter((c) => c.cardId === 'connected-seam');
    expect(seams.map((c) => c.props.kind)).toEqual(['wipe', 'barn', 'dip']);
    for (const c of seams) expect(c.duration).toBeGreaterThanOrEqual(14);
  });
});

describe('more seam kinds', () => {
  it('keeps whip, ink and leak through validation and lays their cards, with one light leak at most', () => {
    const p = plan([scene('title', '', 'whip'), scene('title', '', 'ink'), scene('title', '', 'leak'), scene('title', '', 'leak'), scene('title', '')]);
    const checked = validatePlan(p, { targetSec: 15 });
    expect(checked.scenes.slice(0, 4).map((s) => s.transition)).toEqual(['whip', 'ink', 'leak', 'leak']);
    const chosen = chooseSeams(checked);
    expect(chosen.scenes.filter((s) => s.transition === 'leak').length).toBeLessThanOrEqual(1);
    const project = planToProject(plan([scene('title', '', 'whip'), scene('title', '', 'ink'), scene('title', '', 'leak'), scene('title', '')]), {} as never);
    const ids = project.tracks.flatMap((t) => t.clips).filter((c) => c.cardId === 'connected-seam').map((c) => c.props.kind);
    expect(ids).toEqual(['whip', 'ink', 'leak']);
  });
});

describe('portal, iris, line and glitch seams', () => {
  it('lay their cards, and glitch counts with the flash cuts (at most 3 hits)', () => {
    const p = plan([scene('title', '', 'portal'), scene('title', '', 'iris'), scene('title', '', 'line'), scene('title', '', 'glitch'), scene('title', '')]);
    const project = planToProject(p, {} as never);
    const ids = project.tracks.flatMap((t) => t.clips).filter((c) => c.cardId === 'connected-seam').map((c) => c.props.kind);
    expect(ids).toEqual(['portal', 'iris', 'line', 'glitch']);
    const hits = chooseSeams(plan(Array.from({ length: 8 }, () => scene('shot', 'brand/feature-zoom', 'glitch')))).scenes.filter((s) => s.transition === 'glitch' || s.transition === 'flash');
    expect(hits.length).toBeLessThanOrEqual(3);
  });
});

describe('seam choice by the shot-transitions card', () => {
  const byEnergy = (e: string) => MOTION_TEMPLATES.filter((t) => SHOT_FACTS[t.componentName]?.energy === e && !SHOT_FACTS[t.componentName]?.technique);
  it('overview into a feature goes through the window (style C)', () => {
    const out = chooseSeams(plan([scene('shot', 'brand/hub'), scene('shot', 'brand/feature-zoom'), scene('shot', byEnergy('mid')[0].id)])).scenes.map((s) => s.transition);
    expect(out[0]).toBe('window');
  });
  it('high energy into high energy whips (style B)', () => {
    const [a, b] = byEnergy('high');
    const out = chooseSeams(plan([scene('shot', a.id), scene('shot', b.id), scene('title', '')])).scenes.map((s) => s.transition);
    expect(out[0]).toBe('whip');
  });
  it('a big drop in energy dips, a rise pushes', () => {
    const high = byEnergy('high')[0];
    const low = byEnergy('low')[0];
    expect(chooseSeams(plan([scene('shot', high.id), scene('shot', low.id), scene('title', '')])).scenes[0].transition).toBe('dip');
    expect(chooseSeams(plan([scene('shot', low.id), scene('shot', high.id), scene('title', '')])).scenes[0].transition).toBe('push');
  });
  it('similar energy pushes in through a white flash (style A)', () => {
    const [a, b] = byEnergy('mid');
    expect(chooseSeams(plan([scene('shot', a.id), scene('shot', b.id), scene('title', '')])).scenes[0].transition).toBe('flash');
  });
});

describe('connected seams in the built film', () => {
  it('a seam clip joins the two real shots: half from each, the incoming shot starts that far into its motion, the film keeps its length', () => {
    const [a, b] = MOTION_TEMPLATES.filter((t) => SHOT_FACTS[t.componentName]?.energy === 'high' && !SHOT_FACTS[t.componentName]?.technique);
    const p = plan([{ ...scene('shot', a.id, 'whip'), durationSec: 5 }, { ...scene('shot', b.id), durationSec: 5 }]);
    const project = planToProject(p, {} as never);
    const clips = project.tracks.flatMap((t) => t.clips);
    const seam = clips.find((c) => c.cardId === 'connected-seam')!;
    const shotsOnly = project.tracks.find((t) => t.name === 'Shots')!.clips;
    expect(seam.props.kind).toBe('whip');
    expect(seam.props.outId).toBe(shotsOnly[0].id);
    expect(seam.props.inId).toBe(shotsOnly[1].id);
    const half = seam.props.half as number;
    expect(half).toBe(18);
    expect(seam.start).toBe(shotsOnly[1].start - half);
    expect(seam.duration).toBe(half * 2);
    expect(shotsOnly[1].inOffset).toBe(half);
    expect(shotsOnly[1].start).toBe(shotsOnly[0].start + shotsOnly[0].duration);
  });

  it('the seam looks: whip covers 70 % of the way in 30 % of the time; window grows from a card to the full frame; flash peaks at the cut', () => {
    expect(whipTravel(0.3)).toBeGreaterThan(0.7);
    expect(whipTravel(1)).toBeCloseTo(1);
    const early = seamLook('window', 0.2);
    const late = seamLook('window', 0.99);
    expect(String(early.in.clipPath)).toMatch(/^inset\(3\d/);
    expect(String(late.in.clipPath)).toMatch(/^inset\(0\.\d+% 0\.\d+%/);
    expect(seamLook('flash', 0.5).over!.opacity).toBeCloseTo(1);
    expect(seamLook('flash', 0.1).over!.opacity).toBe(0);
    expect(seamLook('dip', 0.3).in.display).toBe('none');
    expect(seamLook('dip', 0.7).out.display).toBe('none');
  });
});

describe('seams in a vertical film', () => {
  it('the window opens from a card inside the shot\'s 16:9 band, not from the empty frame around it', async () => {
    const { stageRect } = await import('../lib/seams');
    const st = stageRect(1080, 1920);
    expect(st.x).toBeCloseTo(0);
    expect(st.h).toBeCloseTo(31.64, 1);
    const m = String(seamLook('window', 0.1, { stage: st }).in.clipPath).match(/inset\(([\d.]+)%/)!;
    expect(Number(m[1])).toBeGreaterThan(st.y);
    expect(Number(m[1])).toBeLessThan(st.y + st.h);
  });
});

describe('seam sounds (sound-design 4.2, anti-machine-gun)', () => {
  it('never plays the same sample at two scene changes in a row', () => {
    const p = plan(Array.from({ length: 7 }, (_, i) => ({ ...scene('shot', 'brand/feature-zoom', (['whip', 'whip', 'cut', 'cut', 'window', 'window', 'cut'] as const)[i]), durationSec: 4 })));
    const project = planToProject(p, {} as never);
    const cuts = project.tracks.flatMap((t) => t.clips).filter((c) => c.cardId === 'audio-clip' && (c.label === 'Whoosh' || c.label === 'Impact')).sort((a, b) => a.start - b.start).map((c) => String(c.props.file));
    expect(cuts.length).toBe(6);
    cuts.slice(1).forEach((f, i) => expect(f).not.toBe(cuts[i]));
  });
});

describe('the window opens from a real card', () => {
  it('from the hub, the window starts on the hub\'s page card', async () => {
    const { WINDOW_SOURCES } = await import('../lib/seams');
    const m = String(seamLook('window', 0.05, { from: WINDOW_SOURCES['brand-hub'] }).in.clipPath).match(/inset\(([\d.]+)% ([\d.]+)% ([\d.]+)% ([\d.]+)%/)!.slice(1).map(Number);
    expect(m[0]).toBeCloseTo(37.3, 0);
    expect(m[3]).toBeCloseTo(35, 0);
  });
});
