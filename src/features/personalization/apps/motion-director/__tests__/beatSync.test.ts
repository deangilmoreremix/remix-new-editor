import { describe, expect, it } from 'vitest';
import { analyzeDrums, beatsFromEnvelope, syncReport } from '../lib/beatSync';

const HOP = 0.0116;
/** An envelope with a kick every `period` seconds starting at `offset`, decaying like a drum hit. */
const pulses = (bpm: number, seconds: number, offset = 0.2, accentEvery = 0) => {
  const n = Math.floor(seconds / HOP);
  const env = new Float64Array(n);
  const period = 60 / bpm;
  let k = 0;
  for (let t = offset; t < seconds; t += period, k++) {
    const i = Math.round(t / HOP);
    const amp = accentEvery && k % accentEvery === 0 ? 1 : 0.7;
    for (let j = 0; j < 12 && i + j < n; j++) env[i + j] = Math.max(env[i + j], amp * Math.exp(-j / 4));
  }
  return env;
};

describe('beatsFromEnvelope', () => {
  it.each([100, 120, 128, 140])('finds a steady %i bpm pulse within a bpm and lands beats on the hits', (bpm) => {
    const { bpm: found, beats } = beatsFromEnvelope(pulses(bpm, 30), HOP, 30);
    expect(Math.abs(found - bpm)).toBeLessThanOrEqual(1);
    // Every beat of the grid sits within 50 ms of a real hit, from the first to the last (no drift).
    const period = 60 / bpm;
    const worst = Math.max(...beats.map((b) => { const r = (b - 0.2) / period; return Math.abs(r - Math.round(r)) * period; }));
    expect(worst).toBeLessThan(0.05);
  });

  it('settles on the usual tempo, not half-time, when the bar has a louder downbeat', () => {
    const { bpm } = beatsFromEnvelope(pulses(120, 40, 0.1, 4), HOP, 40);
    expect(bpm).toBeGreaterThanOrEqual(110);
    expect(bpm).toBeLessThanOrEqual(130);
  });

  it('says nothing for silence', () => {
    expect(beatsFromEnvelope(new Float64Array(2000), HOP, 20).beats).toEqual([]);
  });
});

describe('syncReport', () => {
  it('measures, in frames, how many cuts sit within 3 frames of a beat', () => {
    const beats = [0, 0.5, 1, 1.5, 2];
    const r = syncReport([0.5, 1.02, 1.6], beats, 30);
    expect(r.cuts).toBe(3);
    expect(r.within).toBe(2);
    expect(r.worstFrames).toBe(3);
  });
  it('reports zero synced when there is no grid', () => {
    expect(syncReport([1, 2], [], 30)).toEqual({ cuts: 2, within: 0, worstFrames: 0 });
  });
});

describe('analyzeDrums', () => {
  const SR = 44100;
  const BPM = 120;
  const SECONDS = 16;
  /** A four-on-the-bar groove: kick on 1 and 3 (a louder one on 1), snare on 2 and 4, hi-hat on every eighth. */
  const groove = () => {
    const x = new Float32Array(SR * SECONDS);
    let seed = 12345;
    const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296) * 2 - 1;
    const beat = 60 / BPM;
    const add = (t: number, len: number, fn: (age: number) => number) => {
      const i0 = Math.round(t * SR);
      for (let i = 0; i < len * SR && i0 + i < x.length; i++) x[i0 + i] += fn(i / SR);
    };
    const truth = { kicks: [] as number[], snares: [] as number[], hats: [] as number[] };
    for (let b = 0; b * beat + 0.5 < SECONDS; b++) {
      const t = 0.5 + b * beat;
      const inBar = b % 4;
      if (inBar === 0 || inBar === 2) {
        truth.kicks.push(t);
        add(t, 0.18, (a) => (inBar === 0 ? 0.9 : 0.6) * Math.sin(2 * Math.PI * (50 + 70 * Math.exp(-a * 40)) * a) * Math.exp(-a * 22));
      } else {
        truth.snares.push(t);
        add(t, 0.16, (a) => 0.5 * (Math.sin(2 * Math.PI * 190 * a) * 0.6 + rnd() * 0.5) * Math.exp(-a * 30));
      }
      for (const off of [0, beat / 2]) {
        truth.hats.push(t + off);
        add(t + off, 0.04, (a) => 0.2 * rnd() * Math.exp(-a * 90));
      }
    }
    return { x, truth, beat };
  };

  const covered = (found: number[], truth: number[], tol = 0.03) => truth.filter((t) => found.some((f) => Math.abs(f - t) <= tol)).length / truth.length;

  it('finds the tempo and the kick, snare and hi-hat hits where they are played', () => {
    const { x, truth } = groove();
    const d = analyzeDrums(x, SR);
    expect(Math.abs(d.bpm - BPM)).toBeLessThanOrEqual(2);
    expect(covered(d.kicks, truth.kicks)).toBeGreaterThan(0.9);
    expect(covered(d.snares, truth.snares)).toBeGreaterThan(0.8);
    expect(covered(d.hats, truth.hats)).toBeGreaterThan(0.8);
    expect(d.snares.filter((k) => truth.snares.some((t) => Math.abs(t - k) <= 0.03)).length / d.snares.length).toBeGreaterThan(0.8);
    // A hit is not reported in the wrong band: almost every kick found is a real kick.
    expect(d.kicks.filter((k) => truth.kicks.some((t) => Math.abs(t - k) <= 0.03)).length / d.kicks.length).toBeGreaterThan(0.9);
  });

  it('puts the downbeat on the louder kick (the first beat of each bar)', () => {
    const { x, truth, beat } = groove();
    const d = analyzeDrums(x, SR);
    expect(d.downbeats.length).toBeGreaterThan(3);
    const barStarts = truth.kicks.filter((_, i) => i % 2 === 0);
    expect(covered(d.downbeats, barStarts, 0.05)).toBeGreaterThan(0.8);
    expect(beat).toBe(0.5);
  });

  it('says nothing for silence', () => {
    const d = analyzeDrums(new Float32Array(SR * 8), SR);
    expect(d.kicks).toEqual([]);
    expect(d.beats).toEqual([]);
  });
});
