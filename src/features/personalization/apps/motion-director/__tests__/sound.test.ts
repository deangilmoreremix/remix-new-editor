// @vitest-environment jsdom
import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { MOTION_TEMPLATES } from '../../../data/motionRecipeCatalog';
import { OUTPUT_AUDIO_OFFSET_F, planToProject, sfxGain } from '../lib/buildFilm';
import type { DirectorPlan } from '../lib/directorPlan';
import { SFX_PEAKS } from '../demosrc/_generated/sfxPeaks';

const palette = { background: '#101018', text: '#ffffff', accent: '#8b6bff' };
const scene = (recipeId: string, kind: 'shot' | 'title' = 'shot', durationSec = 4, transition: 'cut' | 'flash' = 'cut') => ({ kind, recipeId, durationSec, headline: 'Line', caption: '', transition });
const capture = { screens: ['https://img/page.jpg'], crops: [], title: 'Acme', sections: [0, 900, 1800], pageH: 4000, sectionNames: ['Hero', 'Features'], nav: ['A', 'B', 'C'], address: 'acme.com' };

const film = () => {
  const shot = MOTION_TEMPLATES[0].id;
  const plan: DirectorPlan = { title: 't', summary: '', palette, scenes: [scene('brand/url-scan'), scene(shot, 'shot', 4, 'flash'), scene('brand/hub'), scene('', 'title', 2), scene(shot), scene('brand/feature-zoom'), scene('', 'title', 3)] };
  return planToProject(plan, { aspectRatio: '16:9', capture, brand: { name: 'Acme' } });
};
const sfxClips = () => film().tracks.flatMap((t) => t.clips).filter((c) => c.cardId === 'audio-clip' && String(c.props.file).includes('/sfxlib/'));

describe('sound design', () => {
  it('uses only sounds that exist and none of the synthetic interface sounds (sound-design S1, 3.3)', () => {
    const files = sfxClips().map((c) => String(c.props.file));
    expect(files.length).toBeGreaterThan(10);
    for (const f of files) {
      expect(existsSync(`public/${f}`), f).toBe(true);
      expect(f, f).not.toMatch(/sfxlib\/ui\/ui-/);
    }
  });

  it('pins every hit by its peak: start + the file\'s own peak lag + the output offset lands on the hit\'s frame', () => {
    const cuts = sfxClips().filter((c) => c.label === 'Whoosh' || c.label === 'Impact');
    expect(cuts.length).toBeGreaterThan(0);
    const fps = 30;
    for (const c of cuts) {
      const name = String(c.props.file).replace('motion-studio/sfxlib/', '').replace('.mp3', '');
      const lag = ((SFX_PEAKS[name]?.peakMs ?? 0) / 1000) * fps;
      const landed = c.start - c.inOffset + lag + OUTPUT_AUDIO_OFFSET_F;
      // The cut frames are scene boundaries (whole frames); the pin rounds to a whole frame.
      expect(Math.abs(landed - Math.round(landed))).toBeLessThanOrEqual(0.51);
      expect(c.duration).toBeGreaterThan(lag - c.inOffset);
    }
  });

  it('alternates two key samples under a typed address, with the level stepping down', () => {
    const keys = sfxClips().filter((c) => c.label === 'Key');
    expect(keys.length).toBeGreaterThan(5);
    expect(new Set(keys.map((k) => k.props.file)).size).toBe(2);
    const vols = keys.map((k) => Number(k.props.volume));
    expect(vols[vols.length - 1]).toBeLessThan(vols[0]);
  });

  it('has a measured output offset on record', () => {
    expect(OUTPUT_AUDIO_OFFSET_F).toBeGreaterThan(1);
    expect(OUTPUT_AUDIO_OFFSET_F).toBeLessThan(2);
  });

  it('closes with a build that swells in and ends before the impact, then the shimmer', () => {
    const clips = sfxClips();
    const build = clips.find((c) => c.label === 'Build');
    const impact = clips.find((c) => c.label === 'Impact' && /deep-whoosh/.test(String(c.props.file)));
    const spark = clips.find((c) => c.label === 'Sparkle');
    expect(build && impact && spark).toBeTruthy();
    // The riser is our own file (not the slowed whoosh of before), played at its own speed.
    expect(String(build!.props.file)).toMatch(/sfxlib\/riser\/riser-rise-build\.mp3$/);
    expect(build!.speed).toBe(1);
    expect(build!.duration).toBeGreaterThan(35);
    // The build ends where the impact's peak lands (its clip starts earlier by the file's peak lag).
    const peakAt = impact!.start + Math.round(((SFX_PEAKS['impact/impact-deep-whoosh']?.peakMs ?? 0) / 1000) * 30) + Math.round(OUTPUT_AUDIO_OFFSET_F);
    expect(build!.start + build!.duration).toBeLessThanOrEqual(peakAt + 3);
    expect(build!.start + build!.duration).toBeGreaterThanOrEqual(peakAt - 4);
    expect(spark!.start).toBeGreaterThan(impact!.start);
  });

  it('boosts only the quietly recorded sounds (true peak below -12 dB, the seven the library lists) toward -8 dB', () => {
    expect(sfxGain('impact/impact-deep-whoosh')).toBe(1);
    expect(sfxGain('not/a-file')).toBe(1);
    // A file whose smoothed envelope is low but whose peak is near full scale is not quiet.
    expect(SFX_PEAKS['text/typewriter-hit-soft'].peakDb).toBeGreaterThan(-12);
    expect(sfxGain('text/typewriter-hit-soft')).toBe(1);
    expect(sfxGain('light/light-sweep-magic')).toBe(1);
    const quiet = Object.entries(SFX_PEAKS).filter(([, v]) => v.peakDb < -12);
    expect(quiet.map(([n]) => n).sort()).toEqual(['camera/ui-zoom-in', 'counter/clock-knob-spin', 'counter/clock-tick-single', 'data/data-load-os', 'text/pencil-write-short', 'text/write-fast', 'transition/wing-flutter']);
    for (const [name, v] of quiet) {
      const gain = sfxGain(name);
      expect(gain, name).toBeGreaterThan(1);
      expect(gain, name).toBeLessThanOrEqual(5);
      if (gain < 5) expect(v.peakDb + 20 * Math.log10(gain), name).toBeCloseTo(-8, 0);
    }
  });

  it('never pins a sound loud enough to clip: file peak + clip volume stays below -1 dBFS', () => {
    for (const c of sfxClips()) {
      const name = String(c.props.file).replace(/^motion-studio\/sfxlib\//, '').replace(/\.mp3$/, '');
      const peak = SFX_PEAKS[name]?.peakDb;
      expect(typeof peak, name).toBe('number');
      expect(peak + 20 * Math.log10(Math.max(1e-6, Number(c.props.volume))), `${name} at ${c.props.volume}`).toBeLessThanOrEqual(-1);
    }
  });
});
