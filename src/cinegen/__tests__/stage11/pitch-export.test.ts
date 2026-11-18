// Stage 11 (port H): pitch model, persistence (JSON + DB converters) and export mapping through the REAL mapping functions + REAL timelineToComposition,
// with the REAL SoundTouch render as the bake (only the decode / blob step, which needs a browser, is replaced by a synthetic sine source).
import { describe, it, expect } from 'vitest';
import { defaultClipPitch, normalizeClipPitch, pitchPlan, pitchShiftSemitones, needsPitchBake, audiblePitchSemitones, pitchKey, PITCH_SEMITONES_MAX } from '@cinegen/lib/audio/pitch';
import { renderClipPitch } from '@cinegen/lib/audio/pitch-bake';
import { bakePitchForExport } from '@cinegen/lib/audio/export-pitch';
import { buildExportStateWithAudio } from '@cinegen/lib/audio/export-prepare';
import { defaultClipEq } from '@cinegen/lib/audio/eq';
import { clipFromRow, clipToRow } from '@cinegen/lib/db-converters';
import { createDefaultTimeline, addClipToTrack } from '@cinegen/lib/editor/timeline-operations';
import { exportClipsFromTimeline, exportTracksFromTimeline, exportItem } from '@cinegen/lib/editor/export-mapping';
import { RAMP_PRESETS, rampSpeeds } from '@cinegen/lib/editor/stage1/speed-ramp';
// @ts-expect-error plain JS module
import { timelineToComposition } from '../../../lib/editor/remotion/timelineToComposition.js';
import type { Asset } from '@cinegen/types/project';
import type { Timeline, Clip } from '@cinegen/types/timeline';
import { peakFrequency, sine } from './dsp-helpers';

const SR = 48000;
const asset = (id: string, type: Asset['type'] = 'video'): Asset => ({ id, name: id, type, url: `https://x.test/${id}.${type === 'audio' ? 'wav' : 'mp4'}`, duration: 10, createdAt: '2026' });
const ASSETS = [asset('A'), asset('S', 'audio')];
const A1 = (tl: Timeline) => tl.tracks.find((t) => t.name === 'A1')!.id;
const V1 = (tl: Timeline) => tl.tracks.find((t) => t.name === 'V1')!.id;

describe('pitch model', () => {
  it('clamps to +-12 semitones / +-100 cents, neutral settings normalise to nothing', () => {
    expect(normalizeClipPitch({ semitones: 99, cents: -500, preservePitch: true })).toEqual({ semitones: PITCH_SEMITONES_MAX, cents: -100, preservePitch: true });
    expect(normalizeClipPitch(defaultClipPitch())).toBeUndefined();
    expect(normalizeClipPitch(undefined)).toBeUndefined();
    expect(normalizeClipPitch('x')).toBeUndefined();
    expect(normalizeClipPitch({ semitones: 0, cents: 0, preservePitch: false })).toEqual({ semitones: 0, cents: 0, preservePitch: false }); // "tape" mode alone is a setting
    expect(pitchShiftSemitones({ semitones: -3, cents: 25 })).toBeCloseTo(-2.75, 9);
  });
  it('plan: preserve = time-stretch, tape mode = resample; audible pitch', () => {
    expect(pitchPlan({ semitones: 2, cents: 0, preservePitch: true }, 2)).toEqual({ tempo: 2, rate: 1, semitones: 2 });
    expect(pitchPlan({ semitones: 2, cents: 0, preservePitch: false }, 2)).toEqual({ tempo: 1, rate: 2, semitones: 2 });
    expect(audiblePitchSemitones({ semitones: 0, cents: 0, preservePitch: false }, 0.5)).toBeCloseTo(-12, 9);
    expect(audiblePitchSemitones({ semitones: 5, cents: 0, preservePitch: true }, 4)).toBe(5);
    expect(pitchKey({ semitones: 1, cents: 2, preservePitch: false })).toBe('1|2|0');
  });
  it('which clips are baked', () => {
    expect(needsPitchBake({ semitones: 1, cents: 0, preservePitch: true }, 1)).toBe(true);
    expect(needsPitchBake({ semitones: 0, cents: 0, preservePitch: false }, 1)).toBe(false); // nothing to do at speed 1
    expect(needsPitchBake({ semitones: 0, cents: 0, preservePitch: false }, 2)).toBe(false); // tape mode: the composition's playbackRate resample is exactly that
    expect(needsPitchBake({ semitones: 3, cents: 0, preservePitch: false }, 2)).toBe(true);
    expect(needsPitchBake(undefined, 2)).toBe(true); // default = pitch preserved: the renderer would resample, so the stretch is baked
    expect(needsPitchBake(undefined, 1)).toBe(false);
  });
});

describe('persistence', () => {
  const clip: Clip = { id: 'c1', assetId: 'S', trackId: 't', name: 'n', startTime: 0, duration: 4, trimStart: 0, trimEnd: 0, speed: 1, volume: 1, keyframes: [], pitch: { semitones: 7, cents: -20, preservePitch: false } } as Clip;
  it('JSON round trip keeps the pitch', () => {
    const back = JSON.parse(JSON.stringify({ clips: [clip] })).clips[0] as Clip;
    expect(back.pitch).toEqual(clip.pitch);
  });
  it('DB converters: pitch and EQ share stage4_json; a row without pitch (old project) loads fine; a bad value is dropped', () => {
    const row = clipToRow(clip, 'tl');
    expect(JSON.parse(row['stage4_json'] as string)).toEqual({ pitch: clip.pitch });
    expect(clipFromRow(row).pitch).toEqual(clip.pitch);
    const both = clipToRow({ ...clip, eq: defaultClipEq() }, 'tl');
    const rb = clipFromRow(both);
    expect(rb.pitch).toEqual(clip.pitch); expect(rb.eq?.bands.length).toBe(6);
    const plain = clipToRow({ ...clip, pitch: undefined }, 'tl');
    expect(plain['stage4_json']).toBeNull();
    expect(clipFromRow(plain).pitch).toBeUndefined();
    expect(clipFromRow({ ...row, stage4_json: JSON.stringify({ pitch: { semitones: 'x' } }) }).pitch).toBeUndefined();
    expect(clipFromRow({ ...row, stage4_json: '{"eq":null}' }).pitch).toBeUndefined();
    expect(clipFromRow({ ...row, stage4_json: 'not json' }).pitch).toBeUndefined();
  });
});

// A bake that does the real DSP on a synthetic 440 Hz source and records what the composition will play.
const SOURCE = sine(440, 10, SR);
function fakeBake(store: Map<string, Float32Array>, calls: Array<{ trimStart: number; duration: number; speed: number }> = []) {
  return async (r: { url: string; trimStart: number; duration: number; speed: number; pitch: any }) => {
    calls.push({ trimStart: r.trimStart, duration: r.duration, speed: r.speed });
    const [out] = await renderClipPitch([SOURCE], SR, r);
    const id = `blob:pitched-${store.size}`; store.set(id, out); return id;
  };
}
async function compose(tl: Timeline, bakePitch: any, bakeEq: any = async (u: string) => u) {
  const clips = exportClipsFromTimeline(tl, ASSETS);
  const { state, warnings } = await buildExportStateWithAudio({ clips, tracks: exportTracksFromTimeline(tl), totalDuration: tl.duration, masterVolume: tl.masterVolume }, exportItem, undefined, bakeEq, bakePitch);
  return { model: timelineToComposition(state, { fps: 30, quality: '720p' }), warnings };
}
const withPitch = (tl: Timeline, patch: Partial<Clip>): Timeline => ({ ...tl, clips: tl.clips.map((c) => ({ ...c, ...patch })) });

describe('export mapping (real mapping + real SoundTouch render)', () => {
  it('+12 semitones on an audio clip: the composition plays a baked 880 Hz file from 0 at speed 1, full duration, master volume applied once', async () => {
    let tl = createDefaultTimeline('t');
    tl = addClipToTrack(tl, A1(tl), ASSETS[1], 0);
    tl = { ...withPitch(tl, { pitch: { semitones: 12, cents: 0, preservePitch: true }, trimStart: 1, volume: 0.8 }), masterVolume: 0.5 };
    const dur = tl.clips[0].duration - tl.clips[0].trimStart - tl.clips[0].trimEnd;
    const store = new Map<string, Float32Array>();
    const { model } = await compose(tl, fakeBake(store));
    const a = model.audio[0];
    expect(store.has(a.src)).toBe(true);
    expect(a.playbackRate ?? 1).toBe(1);
    expect(a.trimBefore ?? 0).toBe(0);
    expect(a.volume).toBeCloseTo(0.4, 5); // 0.8 * 0.5, once
    const pcm = store.get(a.src)!;
    expect(Math.abs(pcm.length / SR - dur)).toBeLessThan(0.01);
    expect(Math.abs(peakFrequency(pcm, SR, SR) - 880) / 880).toBeLessThan(0.01);
  });
  it('speed 2x, pitch preserved, no pitch setting at all: baked as a time-stretch (440 Hz, half length) because the renderer alone would resample to 880 Hz', async () => {
    let tl = createDefaultTimeline('t');
    tl = addClipToTrack(tl, A1(tl), ASSETS[1], 0);
    tl = withPitch(tl, { speed: 2 });
    const calls: any[] = []; const store = new Map<string, Float32Array>();
    const { model } = await compose(tl, fakeBake(store, calls));
    expect(calls).toHaveLength(1);
    const pcm = store.get(model.audio[0].src)!;
    const expectedDur = (tl.clips[0].duration - tl.clips[0].trimStart - tl.clips[0].trimEnd) / 2;
    expect(Math.abs(pcm.length / SR - expectedDur)).toBeLessThan(0.01);
    expect(Math.abs(peakFrequency(pcm, SR, SR) - 440) / 440).toBeLessThan(0.01);
    expect(model.audio[0].playbackRate ?? 1).toBe(1);
  });
  it('speed 2x + 7 semitones: baked at half length, 659 Hz', async () => {
    let tl = createDefaultTimeline('t');
    tl = addClipToTrack(tl, A1(tl), ASSETS[1], 0);
    const store = new Map<string, Float32Array>();
    const { model } = await compose(withPitch(tl, { speed: 2, pitch: { semitones: 7, cents: 0, preservePitch: true } }), fakeBake(store));
    const pcm = store.get(model.audio[0].src)!;
    expect(Math.abs(peakFrequency(pcm, SR, SR) - 440 * Math.pow(2, 7 / 12)) / 659.26).toBeLessThan(0.01);
    expect(model.audio[0].playbackRate ?? 1).toBe(1);
  });
  it('tape mode (preserve off) at 2x, no shift: not baked, the composition resamples with playbackRate 2; with +12: baked, 440*2*2 Hz', async () => {
    let tl = createDefaultTimeline('t');
    tl = addClipToTrack(tl, A1(tl), ASSETS[1], 0);
    const calls: any[] = [];
    const plain = await compose(withPitch(tl, { speed: 2, pitch: { semitones: 0, cents: 0, preservePitch: false } }), fakeBake(new Map(), calls));
    expect(calls).toHaveLength(0);
    expect(plain.model.audio[0].playbackRate).toBe(2);
    const store = new Map<string, Float32Array>();
    const { model } = await compose(withPitch(tl, { speed: 2, pitch: { semitones: 12, cents: 0, preservePitch: false } }), fakeBake(store, calls));
    expect(Math.abs(peakFrequency(store.get(model.audio[0].src)!, SR, SR / 2) - 1760) / 1760).toBeLessThan(0.01);
  });
  it('speed-ramp preset pieces each get their own bake with their own speed (pitch preserved)', async () => {
    let tl = createDefaultTimeline('t');
    tl = addClipToTrack(tl, A1(tl), ASSETS[1], 0);
    const base = tl.clips[0];
    const speeds = rampSpeeds(RAMP_PRESETS['speed-up'].points, 4);
    const S = base.duration; let acc = 0;
    const pieces: Clip[] = speeds.map((sp, i) => { const a = (S * i) / 4; const b = (S * (i + 1)) / 4; const p = { ...base, id: `p${i}`, startTime: acc, trimStart: a, trimEnd: S - b, speed: sp, pitch: { semitones: 3, cents: 0, preservePitch: true } } as Clip; acc += (b - a) / sp; return p; });
    tl = { ...tl, clips: pieces, duration: acc };
    const calls: any[] = []; const store = new Map<string, Float32Array>();
    const { model } = await compose(tl, fakeBake(store, calls));
    expect(calls.map((c) => c.speed)).toEqual(speeds);
    expect(model.audio).toHaveLength(4);
    for (const a of model.audio) { const f = peakFrequency(store.get(a.src)!, SR, 0, 8192); expect(Math.abs(f - 440 * Math.pow(2, 3 / 12)) / 523.25).toBeLessThan(0.02); }
  });
  it('composes with EQ and master: pitch is baked first, the EQ bake receives the pitched file, volume is not applied twice', async () => {
    let tl = createDefaultTimeline('t');
    tl = addClipToTrack(tl, A1(tl), ASSETS[1], 0);
    const eq = defaultClipEq(); eq.bands[2].gain = 6;
    tl = { ...withPitch(tl, { pitch: { semitones: 5, cents: 0, preservePitch: true }, eq }), masterVolume: 0.5 };
    const order: string[] = [];
    const { model } = await compose(tl, async (r: any) => { order.push(`pitch:${r.url}`); return 'blob:pitched'; }, async (u: string) => { order.push(`eq:${u}`); return 'blob:eq-of-pitched'; });
    expect(order).toEqual(['pitch:https://x.test/S.wav', 'eq:blob:pitched']);
    expect(model.audio[0].src).toBe('blob:eq-of-pitched');
    expect(model.audio[0].volume).toBeCloseTo(0.5, 5);
    expect(model.audio[0].playbackRate ?? 1).toBe(1);
  });
  it('a video clip with a linked audio clip: the video stays silent and the AUDIO clip is baked; an unlinked video clip is warned', async () => {
    let tl = createDefaultTimeline('t');
    tl = addClipToTrack(tl, V1(tl), ASSETS[0], 0);
    tl = withPitch(tl, { pitch: { semitones: 4, cents: 0, preservePitch: true } });
    const calls: any[] = [];
    const r = await compose(tl, fakeBake(new Map(), calls));
    expect(calls).toHaveLength(1); // only the audio-track clip
    expect(r.model.layers.find((l: any) => l.kind === 'video').volume).toBe(0);
    expect(r.warnings.join(' ')).not.toMatch(/Pitch on/);
    const lone = { ...tl, clips: tl.clips.filter((c) => !tl.tracks.find((t) => t.id === c.trackId && t.kind === 'audio')).map((c) => ({ ...c, linkedClipIds: undefined })) };
    expect((await compose(lone, fakeBake(new Map(), []))).warnings.join(' ')).toMatch(/Pitch on .* is preview-only/);
  });
  it('an unlinked video clip that only has a speed change (no pitch setting) is left alone, with no new warning', async () => {
    let tl = createDefaultTimeline('t');
    tl = addClipToTrack(tl, V1(tl), ASSETS[0], 0);
    const lone = { ...tl, clips: tl.clips.filter((c) => !tl.tracks.find((t) => t.id === c.trackId && t.kind === 'audio')).map((c) => ({ ...c, linkedClipIds: undefined, speed: 2 })) };
    const calls: any[] = [];
    const r = await compose(lone, fakeBake(new Map(), calls));
    expect(calls).toHaveLength(0);
    expect(r.warnings.join(' ')).not.toMatch(/Pitch/);
  });
  it('a failing bake keeps the clip unshifted and says so; abort propagates; clips without pitch never call the bake', async () => {
    let tl = createDefaultTimeline('t');
    tl = addClipToTrack(tl, A1(tl), ASSETS[1], 0);
    const shifted = withPitch(tl, { pitch: { semitones: 2, cents: 0, preservePitch: true } });
    const r = await compose(shifted, async () => { throw new Error('decode failed'); });
    expect(r.model.audio[0].src).toBe('https://x.test/S.wav');
    expect(r.warnings.join(' ')).toMatch(/Pitch on .* was not applied.*decode failed/);
    const clips = exportClipsFromTimeline(shifted, ASSETS) as any[];
    await expect(bakePitchForExport(clips, exportTracksFromTimeline(shifted), async () => { throw new DOMException('x', 'AbortError'); })).rejects.toMatchObject({ name: 'AbortError' });
    const calls: any[] = [];
    await compose(tl, fakeBake(new Map(), calls));
    expect(calls).toHaveLength(0); // speed 1, no pitch
  });
  it('a muted audio track is not baked', async () => {
    let tl = createDefaultTimeline('t');
    tl = addClipToTrack(tl, A1(tl), ASSETS[1], 0);
    tl = withPitch({ ...tl, tracks: tl.tracks.map((t) => (t.kind === 'audio' ? { ...t, muted: true } : t)) }, { pitch: { semitones: 2, cents: 0, preservePitch: true } });
    const calls: any[] = [];
    await compose(tl, fakeBake(new Map(), calls));
    expect(calls).toHaveLength(0);
  });
});
