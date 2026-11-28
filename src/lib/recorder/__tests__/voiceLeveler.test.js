import { describe, it, expect } from 'vitest';
import { VoiceLeveler, LEVELER } from '../voiceLeveler.js';

const RATE = 16000;
const BLOCK = 128;
const rmsOf = (a) => Math.sqrt(a.reduce((s, v) => s + v * v, 0) / a.length);
const dbOf = (x) => 20 * Math.log10(Math.max(x, 1e-9));
// Run a mono signal through the leveler in render-sized blocks, like an AudioWorklet does.
function run(signal, { rate = RATE, opts } = {}) {
  const lv = new VoiceLeveler(rate, opts);
  const out = new Float32Array(signal.length);
  for (let i = 0; i < signal.length; i += BLOCK) {
    const inB = signal.subarray(i, Math.min(signal.length, i + BLOCK));
    const outB = new Float32Array(inB.length);
    lv.processBlock([inB], [outB]);
    out.set(outB, i);
  }
  return out;
}
const tone = (seconds, amp, hz = 200) => Float32Array.from({ length: Math.round(seconds * RATE) }, (_, i) => amp * Math.sin((2 * Math.PI * hz * i) / RATE));
const tail = (a, seconds = 1) => a.subarray(a.length - Math.round(seconds * RATE));

describe('voice leveler', () => {
  it('brings quiet speech up toward the target level, by no more than +12 dB', () => {
    const out = run(tone(12, 0.04)); // about -31 dBFS (rms 0.028)
    const gainDb = dbOf(rmsOf(tail(out))) - dbOf(rmsOf(tone(1, 0.04)));
    expect(gainDb).toBeGreaterThan(6);
    expect(gainDb).toBeLessThanOrEqual(12.1);
  });
  it('never turns normal-level speech down, and leaves it close to unchanged', () => {
    const input = tone(8, 0.15); // rms 0.106: already near the target
    const gainDb = dbOf(rmsOf(tail(run(input)))) - dbOf(rmsOf(tail(input)));
    expect(gainDb).toBeGreaterThanOrEqual(-0.5);
    expect(gainDb).toBeLessThan(1.5);
  });
  it('a loud signal can never pass the ceiling', () => {
    const out = run(tone(2, 1.0));
    expect(Math.max(...out.map(Math.abs))).toBeLessThanOrEqual(LEVELER.ceiling + 1e-6);
    const bursts = run(Float32Array.from({ length: RATE }, (_, i) => (i % 400 < 200 ? 3 : -3))); // far past full scale
    expect(Math.max(...bursts.map(Math.abs))).toBeLessThanOrEqual(LEVELER.ceiling + 1e-6);
  });
  it('turns very quiet background down (about 20 dB) but not to silence', () => {
    const hiss = tone(3, 0.0008, 3000); // about -62 dBFS
    const out = run(hiss);
    const reduction = dbOf(rmsOf(tail(hiss))) - dbOf(rmsOf(tail(out)));
    expect(reduction).toBeGreaterThan(14);
    expect(reduction).toBeLessThan(26);
    expect(rmsOf(tail(out))).toBeGreaterThan(0);
  });
  it('the gate opens again quickly when speech returns after a pause', () => {
    const sig = new Float32Array(RATE * 4);
    sig.set(tone(1, 0.001, 3000), 0);               // pause with hiss
    sig.set(tone(3, 0.15), RATE);                   // speech
    const out = run(sig);
    const early = out.subarray(RATE + Math.round(0.1 * RATE), RATE + Math.round(0.3 * RATE)); // 100-300 ms into speech
    expect(rmsOf(early)).toBeGreaterThan(0.08);
  });
  it('keeps stereo channels in step (same gain on both), and silent in gives silent out', () => {
    const lv = new VoiceLeveler(RATE);
    const l = tone(0.5, 0.2).subarray(0, BLOCK); const r = l.map((v) => v * 0.5);
    const ol = new Float32Array(BLOCK); const or = new Float32Array(BLOCK);
    lv.processBlock([l, r], [ol, or]);
    ol.forEach((v, i) => { if (Math.abs(l[i]) > 0.05) expect(or[i] / ol[i]).toBeCloseTo(0.5, 3); });
    const z = new Float32Array(BLOCK); const oz = new Float32Array(BLOCK).fill(1);
    new VoiceLeveler(RATE).processBlock([z], [oz]);
    expect(Math.max(...oz.map(Math.abs))).toBe(0);
  });
  it('survives bad samples and missing channels without producing NaN', () => {
    const lv = new VoiceLeveler(RATE);
    const bad = new Float32Array(BLOCK).fill(NaN);
    const out = new Float32Array(BLOCK);
    expect(lv.processBlock([bad], [out])).toBe(true);
    expect(out.every(Number.isFinite)).toBe(true);
    const out2 = [new Float32Array(BLOCK), new Float32Array(BLOCK).fill(5)];
    lv.processBlock([tone(0.1, 0.1).subarray(0, BLOCK)], out2); // one input channel, two outputs
    expect(Math.max(...out2[1].map(Math.abs))).toBe(0);
    expect(lv.processBlock([], [])).toBe(true);
  });
  it('limit() is the identity below the knee and monotonic above it', () => {
    const lv = new VoiceLeveler(RATE);
    expect(lv.limit(0.3)).toBe(0.3);
    expect(lv.limit(-0.5)).toBe(-0.5);
    let prev = lv.limit(0.6);
    for (let x = 0.65; x < 5; x += 0.05) { const y = lv.limit(x); expect(y).toBeGreaterThanOrEqual(prev); expect(y).toBeLessThanOrEqual(LEVELER.ceiling); prev = y; }
    expect(lv.limit(-2)).toBe(-lv.limit(2));
  });
});
