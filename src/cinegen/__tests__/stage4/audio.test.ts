// Stage 4 audio: EQ maths against analytic values, WAV encoding, meters, and master volume / fades / EQ bake through the REAL export mapping.
import { describe, it, expect } from 'vitest';
import { biquadCoefficients, biquadMagnitudeDb, defaultClipEq, eqResponseDb, normalizeClipEq, isEqActive, webAudioQ, EQ_PRESETS, eqKey } from '@cinegen/lib/audio/eq';
import { encodeWav16 } from '@cinegen/lib/audio/eq-bake';
import { channelLevel, dbToFraction, holdPeak, toDb } from '@cinegen/lib/audio/meter';
import { bakeEqForExport } from '@cinegen/lib/audio/export-audio';
import { buildExportStateWithAudio } from '@cinegen/lib/audio/export-prepare';
import { createDefaultTimeline, addClipToTrack, updateTrack } from '@cinegen/lib/editor/timeline-operations';
import { exportClipsFromTimeline, exportTracksFromTimeline, exportItem } from '@cinegen/lib/editor/export-mapping';
// @ts-expect-error plain JS module
import { timelineToComposition } from '../../../lib/editor/remotion/timelineToComposition.js';
import type { Asset } from '@cinegen/types/project';
import type { Timeline } from '@cinegen/types/timeline';

const FS = 48000;
const db = (band: Parameters<typeof biquadCoefficients>[0], f: number) => biquadMagnitudeDb(biquadCoefficients(band, FS), f, FS);

describe('EQ biquad maths (RBJ cookbook values)', () => {
  it('peaking: exactly the set gain at the centre, 0 dB far away, and the known 6 dB / Q 1 coefficients', () => {
    const band = { type: 'peaking' as const, frequency: 1000, gain: 6, q: 1 };
    expect(db(band, 1000)).toBeCloseTo(6, 4);
    expect(Math.abs(db(band, 20))).toBeLessThan(0.05);
    expect(Math.abs(db(band, 20000))).toBeLessThan(0.6);
    // hand-computed: A = 10^(6/40), w0 = 2*pi*1000/48000, alpha = sin(w0) / 2
    const A = Math.pow(10, 6 / 40); const w0 = (2 * Math.PI * 1000) / FS; const alpha = Math.sin(w0) / 2;
    const a0 = 1 + alpha / A; const c = biquadCoefficients(band, FS);
    expect(c.b0).toBeCloseTo((1 + alpha * A) / a0, 12);
    expect(c.b1).toBeCloseTo((-2 * Math.cos(w0)) / a0, 12);
    expect(c.a2).toBeCloseTo((1 - alpha / A) / a0, 12);
    expect(c.b0).toBeCloseTo(1.04396, 4);
  });
  it('shelves reach their gain on the far side and 0 dB on the other; half the gain at the corner', () => {
    expect(db({ type: 'lowshelf', frequency: 200, gain: 9, q: 1 }, 20)).toBeCloseTo(9, 1);
    expect(Math.abs(db({ type: 'lowshelf', frequency: 200, gain: 9, q: 1 }, 15000))).toBeLessThan(0.1);
    expect(db({ type: 'highshelf', frequency: 6000, gain: -8, q: 1 }, 20000)).toBeCloseTo(-8, 0);
    expect(db({ type: 'highshelf', frequency: 6000, gain: -8, q: 1 }, 6000)).toBeCloseTo(-4, 1);
  });
  it('Butterworth high-pass / low-pass are -3.01 dB at the cutoff and about -12 dB an octave away', () => {
    const hp = { type: 'highpass' as const, frequency: 1000, gain: 0, q: Math.SQRT1_2 };
    const lp = { type: 'lowpass' as const, frequency: 1000, gain: 0, q: Math.SQRT1_2 };
    expect(db(hp, 1000)).toBeCloseTo(-3.0103, 2);
    expect(db(lp, 1000)).toBeCloseTo(-3.0103, 2);
    expect(db(hp, 500)).toBeLessThan(-11); expect(db(hp, 500)).toBeGreaterThan(-13.5);
    expect(Math.abs(db(hp, 15000))).toBeLessThan(0.2);
  });
  it('notch removes the centre frequency', () => { expect(db({ type: 'notch', frequency: 1000, gain: 0, q: 5 }, 1000)).toBeLessThan(-60); });
  it('Web Audio takes highpass/lowpass Q in dB: Butterworth is -3.01 dB, other types stay linear', () => {
    expect(webAudioQ({ type: 'highpass', q: Math.SQRT1_2 })).toBeCloseTo(-3.0103, 3);
    expect(webAudioQ({ type: 'peaking', q: 2 })).toBe(2);
  });
  it('combines bands (dB add) and the default EQ is neutral', () => {
    const eq = defaultClipEq();
    expect(isEqActive(eq)).toBe(false);
    expect(eqKey(eq)).toBe('');
    eq.bands[2] = { ...eq.bands[2], gain: 6 }; eq.bands[3] = { ...eq.bands[3], frequency: 1000, gain: 3 };
    expect(isEqActive(eq)).toBe(true);
    const r = eqResponseDb(eq, [1000], FS);
    expect(r[0]).toBeGreaterThan(8.5); expect(r[0]).toBeLessThan(9.5);
    expect(eqResponseDb({ ...eq, enabled: false }, [1000], FS)[0]).toBe(0);
  });
  it('normalizes hostile stored data to valid bands and clamps gain / Q / frequency', () => {
    expect(normalizeClipEq(null)).toBeNull();
    expect(normalizeClipEq({ bands: 'x' })).toBeNull();
    const n = normalizeClipEq({ enabled: true, bands: [{ type: 'nonsense', frequency: -5, gain: 99, q: 0, enabled: true }] })!;
    expect(n.bands).toHaveLength(6);
    expect(n.bands[0].type).toBe('highpass'); expect(n.bands[0].frequency).toBe(20); expect(n.bands[0].gain).toBe(20); expect(n.bands[0].q).toBeGreaterThanOrEqual(0.3);
  });
  it('every preset yields a valid, active EQ except Flat', () => {
    for (const p of EQ_PRESETS) {
      const eq = { enabled: true, bands: p.apply(defaultClipEq().bands) };
      expect(normalizeClipEq(eq)).not.toBeNull();
      expect(isEqActive(eq)).toBe(p.id !== 'flat');
    }
  });
});

describe('WAV encoding and meters', () => {
  it('writes a valid 16-bit PCM header and the sample values', () => {
    const l = Float32Array.from([0, 0.5, -0.5, 1, -1, 2]); const r = Float32Array.from([0, 0, 0, 0, 0, 0]);
    const wav = encodeWav16({ numberOfChannels: 2, sampleRate: 44100, length: 6, getChannelData: (c) => (c ? r : l) });
    const v = new DataView(wav); const tag = (o: number) => String.fromCharCode(v.getUint8(o), v.getUint8(o + 1), v.getUint8(o + 2), v.getUint8(o + 3));
    expect(tag(0)).toBe('RIFF'); expect(tag(8)).toBe('WAVE'); expect(tag(36)).toBe('data');
    expect(v.getUint32(4, true)).toBe(wav.byteLength - 8);
    expect(v.getUint16(22, true)).toBe(2); expect(v.getUint32(24, true)).toBe(44100); expect(v.getUint16(34, true)).toBe(16);
    expect(v.getUint32(40, true)).toBe(6 * 2 * 2);
    expect(v.getInt16(44 + 4, true)).toBe(16383); // 0.5 * 32767 = 16383.5, truncated by setInt16
    expect(v.getInt16(44 + 3 * 4, true)).toBe(32767); expect(v.getInt16(44 + 4 * 4, true)).toBe(-32768); expect(v.getInt16(44 + 5 * 4, true)).toBe(32767); // clipped
  });
  it('peak / RMS of a sine: peak 0.5 = -6.02 dBFS, RMS = peak / sqrt 2', () => {
    const x = Float32Array.from({ length: 4800 }, (_, i) => 0.5 * Math.sin((2 * Math.PI * 1000 * i) / 48000));
    const l = channelLevel(x);
    expect(l.peakDb).toBeCloseTo(-6.02, 1); expect(l.rmsDb).toBeCloseTo(-9.03, 1);
    expect(channelLevel(new Float32Array(100)).peakDb).toBe(-120);
    expect(toDb(1)).toBe(0); expect(dbToFraction(0)).toBe(1); expect(dbToFraction(-60)).toBe(0); expect(dbToFraction(-30)).toBeCloseTo(0.5);
    expect(holdPeak(-6, -20, 0.5)).toBe(-16); expect(holdPeak(-6, -3, 0.5)).toBe(-3);
  });
});

const asset = (id: string, type: Asset['type'] = 'video'): Asset => ({ id, name: id, type, url: `https://x.test/${id}.${type === 'audio' ? 'wav' : 'mp4'}`, duration: 10, createdAt: '2026' });
const ASSETS = [asset('A'), asset('S', 'audio')];
const A1 = (tl: Timeline) => tl.tracks.find((t) => t.name === 'A1')!.id;
const V1 = (tl: Timeline) => tl.tracks.find((t) => t.name === 'V1')!.id;
async function compose(tl: Timeline, bake = async (u: string) => `blob:baked-${u.split('/').pop()}`) {
  const clips = exportClipsFromTimeline(tl, ASSETS);
  const { state, warnings } = await buildExportStateWithAudio({ clips, tracks: exportTracksFromTimeline(tl), totalDuration: tl.duration, masterVolume: tl.masterVolume }, exportItem, undefined, bake as never);
  return { model: timelineToComposition(state, { fps: 30, quality: '720p' }), warnings };
}

describe('Stage 4 export: master volume, fades, EQ bake (real mapping + real timelineToComposition)', () => {
  it('master volume multiplies clip x track volume in the composition', async () => {
    let tl = createDefaultTimeline('t');
    tl = addClipToTrack(tl, A1(tl), ASSETS[1], 0);
    tl = updateTrack(tl, A1(tl), { volume: 0.8 });
    tl = { ...tl, clips: tl.clips.map((c) => ({ ...c, volume: 0.5 })), masterVolume: 0.5 };
    expect((await compose(tl)).model.audio[0].volume).toBeCloseTo(0.2, 5); // 0.5 * 0.8 * 0.5
    expect((await compose({ ...tl, masterVolume: 0 })).model.audio[0].volume).toBe(0);
    expect((await compose({ ...tl, masterVolume: undefined })).model.audio[0].volume).toBeCloseTo(0.4, 5);
  });
  it('master volume also scales volume keyframes and the audio of a video clip', async () => {
    let tl = createDefaultTimeline('t');
    tl = addClipToTrack(tl, V1(tl), ASSETS[0], 0);
    tl = { ...tl, masterVolume: 0.25 };
    const m = (await compose(tl)).model;
    // the video clip is silent (its sound is the linked audio clip, as in the preview); master scales that audio clip
    expect(m.layers.find((l: any) => l.kind === 'video').volume).toBe(0);
    expect(m.audio).toHaveLength(1); expect(m.audio[0].volume).toBeCloseTo(0.25, 5);
    // a video clip with no linked audio keeps its own sound, scaled by master
    const lone = { ...tl, clips: tl.clips.filter((c) => !tl.tracks.find((t) => t.id === c.trackId && t.kind === 'audio')).map((c) => ({ ...c, linkedClipIds: undefined })) };
    expect((await compose(lone)).model.layers.find((l: any) => l.kind === 'video').volume).toBeCloseTo(0.25, 5);
    let t2 = createDefaultTimeline('t');
    t2 = addClipToTrack(t2, A1(t2), ASSETS[1], 0);
    t2 = { ...t2, masterVolume: 0.5, clips: t2.clips.map((c) => ({ ...c, keyframes: [{ time: 0, property: 'volume' as const, value: 0 }, { time: 2, property: 'volume' as const, value: 1 }] })) };
    const kf = (await compose(t2)).model.audio[0].keyframes.volume;
    expect(kf.map((k: any) => k.v)).toEqual([0, 0.5]);
  });
  it('clip fades reach the composition audio item (fadeIn / fadeOut seconds)', async () => {
    let tl = createDefaultTimeline('t');
    tl = addClipToTrack(tl, A1(tl), ASSETS[1], 0);
    tl = { ...tl, clips: tl.clips.map((c) => ({ ...c, fadeIn: 1.5, fadeOut: 2 })) };
    const a = (await compose(tl)).model.audio[0];
    expect(a.fadeIn).toBe(1.5); expect(a.fadeOut).toBe(2);
  });
  it('EQ on an audio-track clip is baked (source swapped for the EQ file); a video-track clip is warned as preview-only', async () => {
    let tl = createDefaultTimeline('t');
    tl = addClipToTrack(tl, A1(tl), ASSETS[1], 0);
    tl = addClipToTrack(tl, V1(tl), ASSETS[0], 0);
    const eq = defaultClipEq(); eq.bands[2].gain = 6;
    tl = { ...tl, clips: tl.clips.map((c) => ({ ...c, eq })) };
    const calls: string[] = [];
    const r = await compose(tl, async (u) => { calls.push(u); return `blob:eq-${u.split('/').pop()}`; });
    expect(calls).toContain('https://x.test/S.wav');
    expect(r.model.audio.some((a: any) => a.src === 'blob:eq-S.wav')).toBe(true);
    const videoLayer = r.model.layers.find((l: any) => l.kind === 'video');
    expect(videoLayer.src).toBe('https://x.test/A.mp4'); // not swapped
    expect(videoLayer.volume).toBe(0); // its sound is the (baked) linked audio clip: no dry copy is mixed in
    expect(r.warnings.join(' ')).not.toMatch(/preview-only/); // the linked audio clip carries the EQ, so nothing is lost
    // every audible source is an EQ'd file (the standalone audio clip and the linked audio of the video)
    expect(r.model.audio.every((a: any) => a.src.startsWith('blob:eq-'))).toBe(true);
    // an EQ on a video clip with NO linked audio cannot be baked: warned
    const lone = { ...tl, clips: tl.clips.filter((c) => !tl.tracks.find((t) => t.id === c.trackId && t.kind === 'audio')).map((c) => ({ ...c, linkedClipIds: undefined })) };
    expect((await compose(lone)).warnings.join(' ')).toMatch(/EQ on .* is preview-only/);
  });
  it('a failing bake keeps the clip, without EQ, and says so; an abort propagates; a flat EQ is never baked', async () => {
    let tl = createDefaultTimeline('t');
    tl = addClipToTrack(tl, A1(tl), ASSETS[1], 0);
    const eq = defaultClipEq(); eq.bands[2].gain = 6;
    const withEq = { ...tl, clips: tl.clips.map((c) => ({ ...c, eq })) };
    const r = await compose(withEq, async () => { throw new Error('decode failed'); });
    expect(r.model.audio[0].src).toBe('https://x.test/S.wav');
    expect(r.warnings.join(' ')).toMatch(/was not applied.*decode failed/);
    const clips = exportClipsFromTimeline(withEq, ASSETS) as any[];
    await expect(bakeEqForExport(clips, exportTracksFromTimeline(withEq), async () => { throw new DOMException('x', 'AbortError'); })).rejects.toMatchObject({ name: 'AbortError' });
    const flat = { ...tl, clips: tl.clips.map((c) => ({ ...c, eq: defaultClipEq() })) };
    const calls: string[] = [];
    await compose(flat, async (u) => { calls.push(u); return u; });
    expect(calls).toEqual([]);
  });
  it('a muted track is not baked at all', async () => {
    let tl = createDefaultTimeline('t');
    tl = addClipToTrack(tl, A1(tl), ASSETS[1], 0);
    const eq = defaultClipEq(); eq.bands[2].gain = 6;
    tl = updateTrack({ ...tl, clips: tl.clips.map((c) => ({ ...c, eq })) }, A1(tl), { muted: true });
    const calls: string[] = [];
    await compose(tl, async (u) => { calls.push(u); return u; });
    expect(calls).toEqual([]);
  });
});
