import { describe, it, expect } from 'vitest';
import { buildAssemblyPlan, buildSrt, TRANSITIONS, withTimeout } from '../assemble.js';

describe('buildAssemblyPlan', () => {
  const shots = [{ duration: 3, zoom: false }, { duration: 3, zoom: true }, { duration: 4, zoom: false }];

  it('chains xfades with the right offsets and total', () => {
    const p = buildAssemblyPlan(shots, { transition: 0.5 });
    expect(p.total).toBeCloseTo(9, 5); // 3+3+4 - 2*0.5
    expect(p.filterComplex).toContain(`xfade=transition=${TRANSITIONS[0]}:duration=0.5:offset=2.5[x1]`);
    expect(p.filterComplex).toContain(`xfade=transition=${TRANSITIONS[1]}:duration=0.5:offset=5[vout]`);
    expect(p.audioLabel).toBeNull();
    expect(p.inputCount).toBe(3);
  });

  it('adds a zoom crop only on impact shots', () => {
    const p = buildAssemblyPlan(shots);
    expect(p.filterComplex.match(/flags=lanczos/g)).toHaveLength(1);
    expect(p.filterComplex).toMatch(/\[1:v\][^;]*lanczos[^;]*\[v1\]/);
  });

  it('maps narration and ducked music inputs after the clips', () => {
    const p = buildAssemblyPlan(shots, { hasNarration: true, hasMusic: true });
    expect(p.inputCount).toBe(5);
    expect(p.filterComplex).toContain('[3:a]highpass');
    expect(p.filterComplex).toContain('[4:a]aresample=48000,volume=0.126');
    expect(p.audioLabel).toBe('aout');
    expect(buildAssemblyPlan(shots, { hasMusic: true }).filterComplex).toContain('[3:a]aresample');
    expect(buildAssemblyPlan(shots, { hasMusic: true }).audioLabel).toBe('bgm');
  });

  it('supports hard cuts, single clips and validates input', () => {
    const cut = buildAssemblyPlan(shots, { transition: 0 });
    expect(cut.total).toBe(10);
    expect(cut.filterComplex).toContain('concat=n=2');
    expect(buildAssemblyPlan([shots[0]]).filterComplex).toContain('[v0]null[vout]');
    expect(() => buildAssemblyPlan([])).toThrow();
    expect(() => buildAssemblyPlan([{ duration: 0.2 }, { duration: 3 }], { transition: 0.35 })).toThrow(/too short/);
  });
});

describe('buildAssemblyPlan with the clips\' own audio', () => {
  const shots = [{ duration: 3 }, { duration: 3, hasAudio: false }, { duration: 4, zoom: true }];

  it('builds per-shot audio, crossfades it with the video timing and uses silence for audio-less clips', () => {
    const p = buildAssemblyPlan(shots, { transition: 0.5, clipAudio: true });
    expect(p.filterComplex).toContain('[0:a]atrim=duration=3,asetpts=PTS-STARTPTS');
    expect(p.filterComplex).toContain('anullsrc=r=48000:cl=stereo,atrim=duration=3,asetpts=PTS-STARTPTS[a1]');
    expect(p.filterComplex).not.toContain('[1:a]');
    expect(p.filterComplex).toContain('[a0][a1]acrossfade=d=0.5[ax1]');
    expect(p.filterComplex).toContain('[ax1][a2]acrossfade=d=0.5[ax2]');
    expect(p.filterComplex).toContain('[ax2]volume=1[clipaudio]');
    expect(p.audioLabel).toBe('clipaudio');
    expect(p.total).toBeCloseTo(9, 5);
  });

  it('ducks the clip audio under narration and mixes all sources', () => {
    const p = buildAssemblyPlan(shots, { transition: 0.5, clipAudio: true, hasNarration: true, hasMusic: true });
    expect(p.filterComplex).toContain('volume=0.25[clipaudio]');
    expect(p.filterComplex).toContain('[3:a]highpass'); // narration keeps its input slot after the clips
    expect(p.filterComplex).toContain('[4:a]aresample=48000,volume=0.126');
    expect(p.filterComplex).toContain('[clipaudio][nar][bgm]amix=inputs=3:duration=longest:normalize=0[aout]');
    expect(p.audioLabel).toBe('aout');
    expect(p.inputCount).toBe(5);
    expect(buildAssemblyPlan(shots, { clipAudio: true, hasMusic: true }).filterComplex).toContain('[clipaudio][bgm]amix=inputs=2');
  });

  it('is unchanged when clip audio is off, and supports hard cuts and one clip', () => {
    const off = buildAssemblyPlan(shots, { hasNarration: true });
    expect(off.filterComplex).not.toContain('acrossfade');
    expect(off.audioLabel).toBe('nar');
    expect(buildAssemblyPlan(shots, { transition: 0, clipAudio: true }).filterComplex).toContain('[a0][a1]concat=n=2:v=0:a=1[ax1]');
    const one = buildAssemblyPlan([{ duration: 3 }], { clipAudio: true });
    expect(one.filterComplex).toContain('[a0]volume=1[clipaudio]');
    expect(one.audioLabel).toBe('clipaudio');
  });
});

describe('buildSrt', () => {
  it('places beat captions on the transition-adjusted timeline', () => {
    const beats = [
      { narration: 'one two three four five six seven eight', shots: [{ duration_sec: 3 }, { duration_sec: 3 }] },
      { narration: 'next beat', shots: [{ duration_sec: 4 }] },
    ];
    const srt = buildSrt(beats, { transition: 0.5 });
    // beat 1: 0 -> 5.5 ; beat 2 would start at 5.0 but waits for beat 1's captions to end
    expect(srt).toContain('1\n00:00:00,000 --> 00:00:02,750\none two three four five six');
    expect(srt).toContain('2\n00:00:02,750 --> 00:00:05,500\nseven eight');
    expect(srt).toContain('3\n00:00:05,500 --> 00:00:09,000\nnext beat');
  });
});

describe('withTimeout', () => {
  it('rejects with a readable message when the work never finishes, and passes results through otherwise', async () => {
    await expect(withTimeout(new Promise(() => {}), 20, 'encoder stuck')).rejects.toThrow('encoder stuck');
    await expect(withTimeout(Promise.resolve(7), 1000, 'nope')).resolves.toBe(7);
    await expect(withTimeout(Promise.reject(new Error('boom')), 1000, 'nope')).rejects.toThrow('boom');
  });
});
