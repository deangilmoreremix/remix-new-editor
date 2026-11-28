import { describe, it, expect } from 'vitest';
import { analyzeAudio, soundCheckFor } from '../audioQuality.js';

const RATE = 16000;
// A "voice": a 220 Hz tone in bursts (speech) with pauses, over steady low noise.
function take({ seconds = 6, speech = 0.2, noise = 0.002, clipEvery = 0 } = {}) {
  const out = new Float32Array(seconds * RATE);
  let seed = 7; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647 - 0.5; };
  for (let i = 0; i < out.length; i += 1) {
    const t = i / RATE;
    const talking = Math.floor(t * 2) % 2 === 0; // half a second on, half a second off
    out[i] = (talking ? speech * Math.sin(2 * Math.PI * 220 * t) : 0) + noise * 2 * rnd();
    if (clipEvery && i % clipEvery === 0) out[i] = 1;
  }
  return out;
}

describe('audio quality check', () => {
  it('says a clean, well-leveled take is good, with a plain note', () => {
    const r = analyzeAudio(take(), RATE);
    expect(r.level).toBe('good');
    expect(r.score).toBeGreaterThanOrEqual(80);
    expect(r.clippedPercent).toBe(0);
    expect(r.snrDb).toBeGreaterThan(25);
    expect(r.notes).toEqual(['The sound looks good: clear, not distorted, and quiet in the background.']);
    expect(r.seconds).toBe(6);
  });
  it('flags a very quiet voice', () => {
    const r = analyzeAudio(take({ speech: 0.004, noise: 0.00005 }), RATE);
    expect(r.loudnessDb).toBeLessThan(-35);
    expect(r.notes.join(' ')).toMatch(/Very quiet/);
    expect(r.score).toBeLessThan(80);
  });
  it('flags distortion', () => {
    const r = analyzeAudio(take({ clipEvery: 50 }), RATE);
    expect(r.clippedPercent).toBeGreaterThan(1);
    expect(r.notes.join(' ')).toMatch(/distorted/);
    expect(r.level).not.toBe('good');
  });
  it('flags background noise close to the voice', () => {
    const r = analyzeAudio(take({ speech: 0.05, noise: 0.03 }), RATE);
    expect(r.snrDb).toBeLessThan(20);
    expect(r.notes.join(' ')).toMatch(/noise/i);
  });
  it('flags a take that is too loud', () => {
    const r = analyzeAudio(take({ speech: 0.9, noise: 0.002 }), RATE);
    expect(r.notes.join(' ')).toMatch(/Very loud/);
  });
  it('measures nothing for empty or silent input, without crashing', () => {
    expect(analyzeAudio(new Float32Array(0), RATE)).toBeNull();
    expect(analyzeAudio(null)).toBeNull();
    expect(analyzeAudio([0.1], 0)).toBeNull();
    const silent = analyzeAudio(new Float32Array(RATE), RATE);
    expect(silent.loudnessDb).toBe(-90);
    expect(silent.level).not.toBe('good');
  });
  it('keeps the score between 0 and 100', () => {
    const r = analyzeAudio(take({ speech: 0.9, noise: 0.4, clipEvery: 10 }), RATE);
    expect(r.score).toBeGreaterThanOrEqual(0);
    expect(r.score).toBeLessThanOrEqual(100);
  });
});

describe('which recording a sound check belongs to', () => {
  const check = { state: 'done', url: 'https://cdn.x/a.webm', result: { score: 90 } };
  it('shows the result only for the recording it was measured on', () => {
    expect(soundCheckFor(check, 'https://cdn.x/a.webm')).toBe(check);
    expect(soundCheckFor(check, 'https://cdn.x/b.webm')).toBeNull(); // a replacement recording starts clean
    expect(soundCheckFor(check, '')).toBeNull();
    expect(soundCheckFor(null, 'https://cdn.x/a.webm')).toBeNull();
    expect(soundCheckFor({ state: 'done', result: {} }, 'https://cdn.x/a.webm')).toBeNull(); // no recording recorded with it
  });
});
