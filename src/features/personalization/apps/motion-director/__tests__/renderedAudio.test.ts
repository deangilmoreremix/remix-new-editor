import { describe, expect, it } from 'vitest';
import { audioReport, audioStats } from '../lib/renderedAudio';

const tone = (amp: number, n: number) => Float32Array.from({ length: n }, (_, i) => amp * Math.sin(i / 10));

describe('rendered audio', () => {
  it('measures the peak and says when it clips', () => {
    const quiet = audioStats([tone(0.25, 48000 * 2)], 48000);
    expect(quiet.peakDb).toBeCloseTo(-12, 0);
    expect(quiet.clipped).toBe(0);
    expect(quiet.perSecondDb).toHaveLength(2);
    expect(audioReport(quiet)[0]).toMatch(/does not clip/);
    const hot = audioStats([tone(1, 48000)], 48000);
    expect(hot.clipped).toBeGreaterThan(0);
    expect(audioReport(hot)[0]).toMatch(/clips/);
  });

  it('flags a mostly silent file', () => {
    const s = audioStats([new Float32Array(48000 * 5)], 48000);
    expect(audioReport(s).join(' ')).toMatch(/nearly silent/);
  });
});
