// [remix] CineGen's PCM cross-correlation, ported to the browser, finds a known offset.
import { describe, it, expect, vi } from 'vitest';

vi.mock('../../../lib/editor/ml/audio.js', () => ({ decodeAudioAt: vi.fn() }));
import { crossCorrelatePcm, scoreFilenameSimilarity } from '../../adapters/main-process/audio-sync';

const RATE = 8000;
function noise(seconds: number, seed = 7) {
  let s = seed;
  const raw = new Float32Array(seconds * RATE);
  for (let i = 0; i < raw.length; i++) { s = (s * 1664525 + 1013904223) >>> 0; raw[i] = ((s / 0xffffffff) - 0.5) * (0.4 + 0.6 * Math.abs(Math.sin(i / 3000))); }
  // Real audio has low-frequency structure; smooth so a coarse scan can find the match.
  const out = new Float32Array(raw.length);
  const W = 800; let acc = 0;
  for (let i = 0; i < raw.length; i++) { acc += raw[i] - (i >= W ? raw[i - W] : 0); out[i] = acc / W; }
  return out;
}

describe('audio sync (CineGen algorithm, in the browser)', () => {
  it('detects a 2s offset between a clip and a delayed recording of it', () => {
    const base = noise(24);
    const target = new Float32Array(base.length + 2 * RATE);
    target.set(base, 2 * RATE); // the recording starts 2s later than the clip
    const r = crossCorrelatePcm(base, target, RATE);
    expect(Math.abs(r._offsetSeconds)).toBeGreaterThan(1.9);
    expect(Math.abs(r._offsetSeconds)).toBeLessThan(2.1);
    expect(r.confidence).toBeGreaterThan(0.5);
  });

  it('scores similar file names higher', () => {
    expect(scoreFilenameSimilarity('A001_C002.mov', 'A001_C002.wav')).toBeGreaterThan(scoreFilenameSimilarity('A001_C002.mov', 'interview.wav'));
  });
});
