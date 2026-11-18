// Stage 11 (port H): REAL DSP through the vendored SoundTouch on synthetic audio: pitch shift, duration preservation, time stretch.
import { describe, it, expect } from 'vitest';
import { renderPitchStretch, stretchedFrames } from '@cinegen/lib/audio/pitch-dsp';
import { pitchPlan, audiblePitchSemitones } from '@cinegen/lib/audio/pitch';
import { peakFrequency, rms, sine } from './dsp-helpers';

const SR = 48000;
const within = (got: number, want: number, tol = 0.01) => Math.abs(got - want) / want <= tol;

describe('pitch shift (SoundTouch, offline)', () => {
  const input = sine(440, 4, SR);
  for (const [semis, want] of [[12, 880], [-12, 220], [7, 440 * Math.pow(2, 7 / 12)], [0.5, 440 * Math.pow(2, 0.5 / 12)]] as const) {
    it(`440 Hz sine ${semis > 0 ? '+' : ''}${semis} semitones -> ~${want.toFixed(1)} Hz, duration preserved`, async () => {
      const [out] = await renderPitchStretch([input], pitchPlan({ semitones: Math.trunc(semis), cents: Math.round((semis % 1) * 100), preservePitch: true }, 1));
      expect(out.length).toBe(input.length); // exact: length is defined by the plan
      const f = peakFrequency(out, SR, 2 * SR);
      expect(within(f, want)).toBe(true);
      expect(rms(out, SR, 3 * SR)).toBeGreaterThan(0.25); // sound is there until near the end (0.5 amp sine = 0.354 rms)
      expect(rms(out, SR, 3 * SR)).toBeLessThan(0.5);
    });
  }
  it('cents add to semitones (+1 semitone, +50 cents = +1.5)', async () => {
    const [out] = await renderPitchStretch([input], pitchPlan({ semitones: 1, cents: 50, preservePitch: true }, 1));
    expect(within(peakFrequency(out, SR, 2 * SR), 440 * Math.pow(2, 1.5 / 12))).toBe(true);
  });
  it('stereo in, stereo out, both channels shifted', async () => {
    const [l, r] = await renderPitchStretch([input, sine(660, 4, SR)], pitchPlan({ semitones: 12, cents: 0, preservePitch: true }, 1));
    expect(within(peakFrequency(l, SR, 2 * SR), 880)).toBe(true);
    expect(within(peakFrequency(r, SR, 2 * SR), 1320)).toBe(true);
  });
});

describe('time stretch keeps the pitch (preserve pitch)', () => {
  const input = sine(440, 4, SR);
  it('speed 2x: 440 Hz stays, duration halves', async () => {
    const plan = pitchPlan({ semitones: 0, cents: 0, preservePitch: true }, 2);
    const [out] = await renderPitchStretch([input], plan);
    expect(out.length).toBe(stretchedFrames(input.length, plan));
    expect(Math.abs(out.length / SR - 2)).toBeLessThan(0.001);
    expect(within(peakFrequency(out, SR, SR / 2), 440)).toBe(true);
    expect(rms(out, SR / 2, SR + SR / 2)).toBeGreaterThan(0.25);
  });
  it('speed 0.5x: 440 Hz stays, duration doubles', async () => {
    const [out] = await renderPitchStretch([input], pitchPlan({ semitones: 0, cents: 0, preservePitch: true }, 0.5));
    expect(Math.abs(out.length / SR - 8)).toBeLessThan(0.001);
    expect(within(peakFrequency(out, SR, 3 * SR), 440)).toBe(true);
  });
  it('stretch 2x AND +12 semitones: 880 Hz, half the duration', async () => {
    const [out] = await renderPitchStretch([input], pitchPlan({ semitones: 12, cents: 0, preservePitch: true }, 2));
    expect(Math.abs(out.length / SR - 2)).toBeLessThan(0.001);
    expect(within(peakFrequency(out, SR, SR / 2), 880)).toBe(true);
  });
});

describe('preserve pitch OFF: the pitch follows the speed', () => {
  const input = sine(440, 4, SR);
  it('speed 2x without preserve: 880 Hz, half the duration', async () => {
    const plan = pitchPlan({ semitones: 0, cents: 0, preservePitch: false }, 2);
    const [out] = await renderPitchStretch([input], plan);
    expect(Math.abs(out.length / SR - 2)).toBeLessThan(0.001);
    expect(within(peakFrequency(out, SR, SR / 2), 880)).toBe(true);
    expect(audiblePitchSemitones({ semitones: 0, cents: 0, preservePitch: false }, 2)).toBeCloseTo(12, 9);
  });
  it('speed 2x without preserve and -12 semitones: back to 440 Hz', async () => {
    const [out] = await renderPitchStretch([input], pitchPlan({ semitones: -12, cents: 0, preservePitch: false }, 2));
    expect(within(peakFrequency(out, SR, SR / 2), 440)).toBe(true);
  });
});

describe('driver edge cases', () => {
  it('empty input and cancellation', async () => {
    expect((await renderPitchStretch([new Float32Array(0)], pitchPlan({ semitones: 3, cents: 0, preservePitch: true }, 1)))[0].length).toBe(0);
    const ac = new AbortController(); ac.abort();
    await expect(renderPitchStretch([sine(440, 1, SR)], pitchPlan({ semitones: 3, cents: 0, preservePitch: true }, 1), { signal: ac.signal })).rejects.toMatchObject({ name: 'AbortError' });
  });
  it('mono in -> mono out', async () => {
    const out = await renderPitchStretch([sine(440, 1, SR)], pitchPlan({ semitones: 12, cents: 0, preservePitch: true }, 1));
    expect(out.length).toBe(1);
  });
});
