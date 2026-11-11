import { describe, expect, it } from 'vitest';
import { MOTION_PRESETS, pickMotionPreset, presetText } from '../lib/motionPreset';
import { chooseSeams } from '../lib/filmChat';
import type { DirectorPlan, DirectorScene } from '../lib/directorPlan';

describe('pickMotionPreset', () => {
  it.each([
    ['Managed IT, cybersecurity and compliance for South Florida businesses', '#2f80ff', 'trust'],
    ['Luxury handcrafted jewellery, a heritage boutique', '#8a6d3b', 'premium'],
    ['A wellness clinic and learning centre for the whole family', '#3aa675', 'calm'],
    ['Launch faster: the AI startup tool for creators, ship in seconds', '#ff3b30', 'bold'],
    ['The fun social game for friends: play, party and stream', '#ff2d95', 'playful'],
    ['Your neighbourhood bakery, a family-owned local shop', '#c58a2a', 'friendly'],
    ['', null, 'friendly'],
  ])('%s → %s', (text, accent, expected) => {
    expect(pickMotionPreset({ text, accent }).id).toBe(expected);
  });

  it('reads the site title, headline, description, headings and menu', () => {
    const text = presetText({ title: 'Acme', content: { headline: 'Secure payments', description: 'Banking for business', headings: ['Compliance'], nav: ['Pricing'] } });
    expect(text).toContain('Secure payments');
    expect(pickMotionPreset({ text }).id).toBe('trust');
  });

  it('has the six upstream presets with their table values', () => {
    expect(Object.keys(MOTION_PRESETS).sort()).toEqual(['bold', 'calm', 'friendly', 'playful', 'premium', 'trust']);
    expect(MOTION_PRESETS.trust.mainFrames).toBe(21);
    expect(MOTION_PRESETS.trust.overshoot).toBe(1);
    expect(MOTION_PRESETS.bold.overshoot).toBe(1.12);
    expect(MOTION_PRESETS.premium.mainFrames).toBe(48);
  });
});

const scene = (kind: 'shot' | 'title', recipeId: string, transition: DirectorScene['transition'] = 'cut'): DirectorScene => ({ kind, recipeId, durationSec: 3, headline: kind === 'title' ? 'Hello' : '', caption: '', transition });
const plan = (scenes: DirectorScene[]): DirectorPlan => ({ title: 't', palette: { background: '#101010', text: '#f5f5f5', accent: '#3366ff' }, scenes } as DirectorPlan);

describe('seams that fit the motion voice', () => {
  const shots = Array.from({ length: 10 }, () => scene('shot', 'brand/feature-zoom'));
  const kinds = (p: DirectorPlan) => new Set(p.scenes.map((s) => s.transition));

  it('a trustworthy film never glitches, whips or flashes', () => {
    const out = chooseSeams(plan(shots.map((s) => ({ ...s, transition: 'glitch' as const }))), MOTION_PRESETS.trust);
    for (const k of kinds(out)) expect(['cut', ...MOTION_PRESETS.trust.seams]).toContain(k);
    expect(kinds(out).has('glitch')).toBe(false);
  });

  it('a bold film can use them and a calm one never does', () => {
    const bold = chooseSeams(plan(shots), MOTION_PRESETS.bold);
    for (const k of kinds(bold)) expect(['cut', ...MOTION_PRESETS.bold.seams]).toContain(k);
    const calm = chooseSeams(plan(shots.map((s) => ({ ...s, transition: 'whip' as const }))), MOTION_PRESETS.calm);
    expect(kinds(calm).has('whip')).toBe(false);
    expect(kinds(calm).has('glitch')).toBe(false);
  });

  it('without a preset nothing changes', () => {
    expect(chooseSeams(plan(shots)).scenes.map((s) => s.transition)).toEqual(chooseSeams(plan(shots), undefined).scenes.map((s) => s.transition));
  });
});
