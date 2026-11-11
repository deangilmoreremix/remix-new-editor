import { describe, it, expect } from 'vitest';
import { buildAssemblyPlan, buildSrt, TRANSITIONS, withTimeout } from '../assemble.js';

describe('buildAssemblyPlan (upstream assemble.py semantics)', () => {
  const shots = [{ duration: 3 }, { duration: 3, zoom: true }, { duration: 4 }];

  it('uses real clip lengths: chains xfades with upstream\'s offsets and total', () => {
    const p = buildAssemblyPlan(shots, { transition: 0.5 });
    expect(p.total).toBeCloseTo(9, 5); // 3+3+4 - 2*0.5
    expect(p.filterComplex).toContain(`[v0][v1]xfade=transition=${TRANSITIONS[0]}:duration=0.5:offset=2.5[vx1]`);
    expect(p.filterComplex).toContain(`[vx1][v2]xfade=transition=${TRANSITIONS[1]}:duration=0.5:offset=5[vx2]`);
    expect(p.filterComplex).toContain('[vx2]null[vout]');
    expect(p.audioLabel).toBe('aout'); // every clip's own audio is kept
    expect(p.filterComplex).toContain('[a0][a1]acrossfade=d=0.5:c1=tri:c2=tri[ax1]');
  });

  it('clamps the transition to a shorter clip, as upstream does', () => {
    const p = buildAssemblyPlan([{ duration: 8 }, { duration: 0.2 }], { transition: 0.35 });
    expect(p.filterComplex).toContain('xfade=transition=fade:duration=0.2:offset=7.8[vx1]');
  });

  it('zooms only impact shots', () => {
    const p = buildAssemblyPlan(shots);
    expect(p.filterComplex.match(/flags=lanczos/g)).toHaveLength(1);
    expect(p.filterComplex).toMatch(/\[1:v\][^;]*lanczos[^;]*\[v1\]/);
  });

  it('gives a clip without audio a silent input right after it (upstream layout)', () => {
    const p = buildAssemblyPlan([{ duration: 3 }, { duration: 3, hasAudio: false }, { duration: 4 }]);
    expect(p.inputs.map((i) => i.type)).toEqual(['clip', 'clip', 'silence', 'clip']);
    expect(p.filterComplex).toContain('[2:a]atrim=duration=3');
    expect(p.filterComplex).toContain('[3:v]trim=duration=4');
  });

  it('hard cuts, one clip, clip audio off, and invalid input', () => {
    expect(buildAssemblyPlan(shots, { transition: 0 }).total).toBe(10);
    expect(buildAssemblyPlan(shots, { transition: 0 }).filterComplex).toContain('concat=n=3:v=1:a=0[vout]');
    expect(buildAssemblyPlan([shots[0]]).filterComplex).toContain('[v0]null[vout]');
    const off = buildAssemblyPlan(shots, { clipAudio: false });
    expect(off.audioLabel).toBeNull();
    expect(off.filterComplex).not.toContain('acrossfade');
    expect(() => buildAssemblyPlan([])).toThrow();
    expect(() => buildAssemblyPlan([{ duration: 0 }])).toThrow(/usable duration/);
  });

  it('extension: mixes narration and music after the upstream graph, ducking the clip sound under the voice', () => {
    const base = buildAssemblyPlan(shots, { transition: 0.5 });
    const p = buildAssemblyPlan(shots, { transition: 0.5, hasNarration: true, hasMusic: true });
    expect(p.filterComplex.startsWith(`${base.filterComplex};`)).toBe(true);
    expect(p.filterComplex).toContain('[aout]volume=0.25[clipaudio]');
    expect(p.filterComplex).toContain('[3:a]highpass');
    expect(p.filterComplex).toContain('[4:a]aresample=48000,volume=0.126');
    expect(p.filterComplex).toContain('[clipaudio][nar][bgm]amix=inputs=3:duration=longest:normalize=0[aout2]');
    expect(p.audioLabel).toBe('aout2');
    expect(p.inputs.map((i) => i.type)).toEqual(['clip', 'clip', 'clip', 'narration', 'music']);
    expect(buildAssemblyPlan(shots, { hasMusic: true }).filterComplex).toContain('[aout]volume=1[clipaudio]');
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
