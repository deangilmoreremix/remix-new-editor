// Stage 4: scene detection on synthetic frame sequences with known cuts, scene search / timeline placement, silence detection and audio sync on
// synthetic audio, relink matching, capability detection with mocked globals, thumbnail cache, adaptive quality, cancellable jobs.
import { describe, it, expect, vi } from 'vitest';
import { rgbHistogram, histogramDistance, detectCuts, refineCut, type FrameSample } from '@cinegen/lib/scenes/histogram-cuts';
import { scenesFromCuts, searchScenes, stepFrame, parseTimeToken, formatTime } from '@cinegen/lib/scenes/scenes';
import { addSceneToTimeline } from '@cinegen/lib/scenes/scene-timeline';
import { createDefaultTimeline } from '@cinegen/lib/editor/timeline-operations';
import { detectCapabilities, summarizeCapabilities } from '@cinegen/lib/perf/capabilities';
import { matchRelinks, scoreMatch, probeSource } from '@cinegen/lib/perf/relink';
import { ThumbCache, memoryStore, mediaFingerprint, thumbKey, type KvStore } from '@cinegen/lib/perf/thumb-cache';
import { PreviewQualityMonitor } from '@cinegen/lib/perf/adaptive-quality';
import { JobRegistry, isAbort } from '@cinegen/lib/perf/jobs';
import { detectSilentSpans, rmsEnvelope } from '../../../openchatcut/audio/silence';
import { findLag, downsample, TARGET_RATE } from '../../../openchatcut/multicam/align';
import type { Asset } from '@cinegen/types/project';

// ---- synthetic video: 64x36 RGBA frames, a flat colour per scene with deterministic noise; optional moving square / fade ----
let seed = 7; const rnd = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
const COLORS: Array<[number, number, number]> = [[200, 40, 40], [30, 160, 60], [40, 60, 210], [220, 210, 40]];
function frame(color: [number, number, number], opts: { square?: number; mix?: [number, number, number]; t?: number } = {}): Uint8ClampedArray {
  const w = 64; const h = 36; const d = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const o = (y * w + x) * 4; const n = (rnd() - 0.5) * 8;
    let c = color;
    if (opts.mix) { const k = opts.t ?? 0; c = [color[0] * (1 - k) + opts.mix[0] * k, color[1] * (1 - k) + opts.mix[1] * k, color[2] * (1 - k) + opts.mix[2] * k]; }
    if (opts.square !== undefined && x >= opts.square && x < opts.square + 10 && y >= 10 && y < 20) c = [255, 255, 255];
    d[o] = c[0] + n; d[o + 1] = c[1] + n; d[o + 2] = c[2] + n; d[o + 3] = 255;
  }
  return d;
}
const sceneAt = (t: number, cuts: number[]) => cuts.filter((c) => t >= c).length;
function samplesFor(cuts: number[], dur: number, step: number, mod?: (t: number, i: number) => Parameters<typeof frame>[1]): FrameSample[] {
  const out: FrameSample[] = [];
  for (let i = 0; i * step < dur; i++) { const t = i * step; out.push({ timeSec: t, hist: rgbHistogram(frame(COLORS[sceneAt(t, cuts) % COLORS.length], mod?.(t, i))) }); }
  return out;
}

describe('scene detection on synthetic frame sequences with known cuts', () => {
  it('histogram distance: 0 for the same picture, near 1 for disjoint colours', () => {
    const a = rgbHistogram(frame(COLORS[0])); const b = rgbHistogram(frame(COLORS[0])); const c = rgbHistogram(frame(COLORS[2]));
    expect(histogramDistance(a, b)).toBeLessThan(0.05);
    expect(histogramDistance(a, c)).toBeGreaterThan(0.6);
  });
  it('finds 3 hard cuts (4 scenes) at the known times, one sample after each', () => {
    const cuts = [2.05, 4.43, 7.2];
    const samples = samplesFor(cuts, 9, 0.1);
    const found = detectCuts(samples, 9);
    expect(found).toHaveLength(3);
    found.forEach((f, i) => { expect(f.timeSec).toBeGreaterThanOrEqual(cuts[i]); expect(f.timeSec - cuts[i]).toBeLessThanOrEqual(0.1 + 1e-9); expect(f.kind).toBe('cut'); });
  });
  it('a moving object and a slow fade are not cuts', () => {
    const moving = samplesFor([], 6, 0.1, (_t, i) => ({ square: (i * 3) % 50 }));
    expect(detectCuts(moving, 6)).toEqual([]);
    const fade = samplesFor([], 6, 0.1, (t) => ({ mix: COLORS[1], t: t / 6 }));
    expect(detectCuts(fade, 6)).toEqual([]);
  });
  it('a one-frame flash inside a scene does not make several cuts (min scene length)', () => {
    const s = samplesFor([], 4, 0.1); s[20] = { timeSec: s[20].timeSec, hist: rgbHistogram(frame(COLORS[2])) };
    const found = detectCuts(s, 4, { minSceneSec: 0.5 });
    expect(found.length).toBeLessThanOrEqual(1);
  });
  it('refineCut bisects to about one frame of the true cut', async () => {
    const cut = 3.0417; const A = rgbHistogram(frame(COLORS[0])); const B = rgbHistogram(frame(COLORS[1]));
    const t = await refineCut(async (x) => (x < cut ? A : B), { timeSec: 2.9, hist: A }, { timeSec: 3.1, hist: B }, 1 / 30);
    expect(t).toBeGreaterThanOrEqual(cut); expect(t - cut).toBeLessThanOrEqual(1 / 30 + 1e-9);
    const ac = new AbortController(); ac.abort();
    await expect(refineCut(async () => A, { timeSec: 0, hist: A }, { timeSec: 1, hist: B }, 1 / 30, ac.signal)).rejects.toMatchObject({ name: 'AbortError' });
  });
});

describe('scene records, search, frame step, timeline placement', () => {
  const scenes = scenesFromCuts('a1', 'Beach', [3, 7.5, 7.6, 12], 20).map((s, i) => ({ ...s, tags: i === 1 ? ['sunset', 'wide'] : [] }));
  it('builds scenes from cuts and ignores cuts that would make tiny scenes', () => {
    expect(scenes.map((s) => [s.startSec, s.endSec])).toEqual([[0, 3], [3, 7.5], [7.5, 12], [12, 20]]);
    expect(scenesFromCuts('x', 'x', [0, 20, 19.95], 20)).toHaveLength(1);
  });
  it('searches name, tags, time and length', () => {
    expect(searchScenes(scenes, 'scene 3').map((s) => s.index)).toEqual([2]);
    expect(searchScenes(scenes, 'tag:sunset').map((s) => s.index)).toEqual([1]);
    expect(searchScenes(scenes, 'sunset').map((s) => s.index)).toEqual([1]);
    expect(searchScenes(scenes, '0:05').map((s) => s.index)).toEqual([1]);
    expect(searchScenes(scenes, '>4.6').map((s) => s.index)).toEqual([3]);
    expect(searchScenes(scenes, 'nomatch')).toEqual([]);
    expect(searchScenes(scenes, '')).toHaveLength(4);
    expect(parseTimeToken('1:02.5')).toBe(62.5); expect(parseTimeToken('abc')).toBeNull(); expect(formatTime(75.25)).toBe('1:15.3');
  });
  it('steps exactly one frame and clamps to the media', () => {
    expect(stepFrame(1, 1, 25, 10)).toBeCloseTo(1.04, 6); expect(stepFrame(1, -1, 25, 10)).toBeCloseTo(0.96, 6);
    expect(stepFrame(0, -1, 25, 10)).toBe(0); expect(stepFrame(9.99, 1, 25, 10)).toBeCloseTo(9.96, 6);
  });
  it('adds a scene to the timeline with the editor\'s own addClipToTrack, trimmed to the scene (video + linked audio)', () => {
    const asset: Asset = { id: 'a1', name: 'Beach', type: 'video', url: 'u', duration: 20, createdAt: '' };
    const tl = createDefaultTimeline('t'); const v1 = tl.tracks.find((t) => t.name === 'V1')!.id;
    const next = addSceneToTimeline(tl, v1, asset, { startSec: 3, endSec: 7.5 }, 2);
    expect(next.clips).toHaveLength(2);
    for (const c of next.clips) { expect(c.trimStart).toBe(3); expect(c.trimEnd).toBe(12.5); expect(c.startTime).toBe(2); }
    expect(next.duration).toBeCloseTo(6.5, 6);
  });
});

describe('silence detection and audio sync on synthetic audio', () => {
  const SR = 16000;
  const tone = (sec: number, f = 220, a = 0.4) => Float32Array.from({ length: Math.round(sec * SR) }, (_, i) => a * Math.sin((2 * Math.PI * f * i) / SR));
  const quiet = (sec: number) => Float32Array.from({ length: Math.round(sec * SR) }, () => (rnd() - 0.5) * 0.0004);
  it('finds the 1.5 s gap between two tones (with the padding the detector keeps)', () => {
    const x = new Float32Array([...tone(1), ...quiet(1.5), ...tone(1)]);
    const spans = detectSilentSpans(rmsEnvelope(x, SR, 50), 50);
    expect(spans).toHaveLength(1);
    expect(spans[0].startMs).toBeGreaterThanOrEqual(1000); expect(spans[0].startMs).toBeLessThan(1300);
    expect(spans[0].endMs).toBeGreaterThan(2300); expect(spans[0].endMs).toBeLessThanOrEqual(2500);
  });
  it('reports nothing for continuous sound, and for a gap that is too short', () => {
    expect(detectSilentSpans(rmsEnvelope(tone(3), SR, 50), 50)).toEqual([]);
    expect(detectSilentSpans(rmsEnvelope(new Float32Array([...tone(1), ...quiet(0.3), ...tone(1)]), SR, 50), 50)).toEqual([]);
  });
  it('sync check: cross-correlation recovers a known offset between two recordings of the same sound', () => {
    const N = TARGET_RATE * 6; const sig = Float32Array.from({ length: N }, () => rnd() - 0.5);
    const delay = Math.round(0.37 * TARGET_RATE);
    const other = new Float32Array(N); other.set(sig.subarray(0, N - delay), delay); // `other` is `sig` delayed by 0.37 s
    const r = findLag(sig, other);
    expect(Math.abs(r.lagSeconds)).toBeCloseTo(0.37, 2); expect(r.confidence).toBeGreaterThan(0.5);
    const unrelated = Float32Array.from({ length: N }, () => rnd() - 0.5);
    expect(findLag(sig, unrelated).confidence).toBeLessThan(r.confidence);
    expect(downsample(new Float32Array(48000), 48000, TARGET_RATE).length).toBe(TARGET_RATE);
  });
});

describe('relink matching', () => {
  const missing = [
    { id: 'a', name: 'interview_cam1.mp4', size: 1_000_000, duration: 61.2 },
    { id: 'b', name: 'beach.mov', size: 5_000_000, originalPath: '/Users/x/Footage/beach.mov' },
    { id: 'c', name: 'music.wav', size: 3_000_000 },
  ];
  const files = [
    { name: 'beach.mov', size: 5_000_000 }, { name: 'Interview_Cam1.MP4', size: 1_000_000, duration: 61.2 },
    { name: 'interview_cam1.mp4', size: 777 }, { name: 'unrelated.png', size: 1 }, { name: 'music.mp3', size: 2_100_000 },
  ];
  it('assigns each missing asset its best file, one-to-one', () => {
    const m = matchRelinks(missing, files);
    expect(m.find((x) => x.assetId === 'a')?.fileIndex).toBe(1); // same size + duration beats the same-name file of another size
    expect(m.find((x) => x.assetId === 'b')?.fileIndex).toBe(0);
    expect(m.find((x) => x.assetId === 'c')).toBeDefined(); // same name, other extension
    expect(new Set(m.map((x) => x.fileIndex)).size).toBe(m.length);
    expect(m.find((x) => x.assetId === 'c')!.reasons).toContain('same name, other extension');
  });
  it('does not match unrelated files, and scores size within 1 percent lower than an exact size', () => {
    expect(matchRelinks([{ id: 'z', name: 'zzz.mp4', size: 10 }], [{ name: 'other.mp4', size: 99 }])).toEqual([]);
    expect(scoreMatch(missing[0], { name: 'x.mp4', size: 1_005_000 }).score).toBeLessThan(scoreMatch(missing[0], { name: 'x.mp4', size: 1_000_000 }).score);
  });
  it('probeSource: ok / 206 are readable, 404 and network errors are missing, abort propagates', async () => {
    const mk = (status: number) => (async () => ({ ok: status >= 200 && status < 300, status, body: { cancel: async () => {} } })) as unknown as typeof fetch;
    expect(await probeSource('https://x/a', undefined, mk(206))).toBe(true);
    expect(await probeSource('https://x/a', undefined, mk(404))).toBe(false);
    expect(await probeSource('blob:gone', undefined, (async () => { throw new TypeError('Failed to fetch'); }) as unknown as typeof fetch)).toBe(false);
    expect(await probeSource('data:text/plain,hi')).toBe(true); expect(await probeSource('')).toBe(false);
    await expect(probeSource('https://x', undefined, (async () => { throw new DOMException('a', 'AbortError'); }) as unknown as typeof fetch)).rejects.toMatchObject({ name: 'AbortError' });
  });
});

describe('capability detection with mocked globals', () => {
  const full = () => ({
    VideoDecoder: class {}, VideoEncoder: class {}, AudioContext: class {}, OfflineAudioContext: class {}, AudioWorkletNode: class {}, Worker: class {}, OffscreenCanvas: class {},
    indexedDB: {}, SharedArrayBuffer: class {}, crossOriginIsolated: true, WebGL2RenderingContext: class {},
    document: { createElement: () => ({ getContext: (k: string) => (k === 'webgl2' ? {} : null) }) },
    navigator: { gpu: {}, hardwareConcurrency: 8, deviceMemory: 8, storage: { getDirectory: async () => ({}) }, mediaCapabilities: { decodingInfo: async () => ({ supported: true, smooth: true, powerEfficient: true }) } },
  });
  const by = (caps: Awaited<ReturnType<typeof detectCapabilities>>, id: string) => caps.find((c) => c.id === id)!;
  it('everything available', async () => {
    const caps = await detectCapabilities(full());
    for (const id of ['webcodecs', 'webgl2', 'opfs', 'audioworklet', 'webaudio', 'indexeddb', 'workers', 'isolation', 'webgpu', 'mediacapabilities']) expect(by(caps, id).status).toBe('yes');
    expect(summarizeCapabilities(caps)).toEqual({ ok: true, missing: [] });
  });
  it('an empty environment reports no for all and lists the missing essentials', async () => {
    const caps = await detectCapabilities({});
    for (const id of ['webcodecs', 'webgl2', 'opfs', 'audioworklet', 'webaudio', 'indexeddb', 'workers', 'webgpu', 'mediacapabilities']) expect(by(caps, id).status).toBe('no');
    expect(summarizeCapabilities(caps).missing).toEqual(['WebCodecs', 'WebGL2', 'Web Audio (live + offline)']);
  });
  it('partial cases: decoder only, WebGL2 context refused, OPFS rejecting, 4K not smooth, throwing probes', async () => {
    const g: any = full(); delete g.VideoEncoder;
    g.document = { createElement: () => ({ getContext: () => null }) };
    g.navigator.storage.getDirectory = async () => { throw new Error('SecurityError'); };
    g.navigator.mediaCapabilities.decodingInfo = async (c: any) => ({ supported: true, smooth: !String(c.video.contentType).includes('avc1.640033'), powerEfficient: false });
    delete g.OfflineAudioContext;
    const caps = await detectCapabilities(g);
    expect(by(caps, 'webcodecs').status).toBe('partial'); expect(by(caps, 'webgl2').status).toBe('no'); expect(by(caps, 'webgl2').detail).toMatch(/null/);
    expect(by(caps, 'opfs').status).toBe('no'); expect(by(caps, 'opfs').detail).toMatch(/SecurityError/);
    expect(by(caps, 'mediacapabilities').status).toBe('partial'); expect(by(caps, 'webaudio').status).toBe('partial');
    const bad: any = full(); bad.navigator.mediaCapabilities.decodingInfo = async () => { throw new Error('x'); };
    expect(by(await detectCapabilities(bad), 'mediacapabilities').status).toBe('no');
  });
});

describe('thumbnail cache, adaptive quality, cancellable jobs', () => {
  it('caches, hits, prunes least-recently-used, and keys by media fingerprint rather than URL', async () => {
    let now = 0; const c = new ThumbCache(memoryStore(), 3, () => ++now);
    const fp = mediaFingerprint({ name: 'a.mp4', size: 10, duration: 2.5 });
    expect(fp).toBe('a.mp4|10|2500'); expect(thumbKey(fp, 1.2345, 160)).toBe('thumb:a.mp4|10|2500:1235:160');
    const make = vi.fn(async () => 'data:img');
    expect((await c.getOrCreate('k1', make)).hit).toBe(false); expect((await c.getOrCreate('k1', make)).hit).toBe(true); expect(make).toHaveBeenCalledTimes(1);
    await c.put('k2', 'x'); await c.put('k3', 'y'); await c.get('k1'); // k2 is now the oldest
    await c.put('k4', 'z');
    expect(await c.get('k2')).toBeUndefined(); expect(await c.get('k1')).toBe('data:img'); expect((await c.stats()).count).toBe(3);
    await c.clear(); expect((await c.stats()).count).toBe(0);
  });
  it('falls back to memory when the IndexedDB backend throws', async () => {
    const broken: KvStore = { get: async () => { throw new Error('idb'); }, set: async () => { throw new Error('idb'); }, del: async () => { throw new Error('idb'); }, entries: async () => { throw new Error('idb'); } };
    const c = new ThumbCache(broken); await c.put('a', 'v');
    expect(await c.get('a')).toBe('v'); expect((await c.stats()).backend).toBe('memory');
  });
  it('adaptive quality advises proxy after sustained dropped frames and original after smooth playback', () => {
    const m = new PreviewQualityMonitor(1000 / 30, 60);
    for (let i = 0; i < 59; i++) m.record(33); expect(m.advise(false)).toBeNull();
    m.record(33); expect(m.advise(false)).toBe('ok');
    for (let i = 0; i < 60; i++) m.record(i % 2 ? 90 : 33); expect(m.advise(false)).toBe('use-proxy');
    for (let i = 0; i < 60; i++) m.record(i % 2 ? 90 : 33); expect(m.advise(true)).toBe('ok');
    for (let i = 0; i < 60; i++) m.record(16.7); expect(m.advise(true)).toBe('back-to-original');
    for (let i = 0; i < 60; i++) m.record(5000); expect(m.advise(false)).toBeNull(); // pauses are ignored
  });
  it('JobRegistry: cancel aborts the signal, the job rejects with AbortError, restarting a key cancels the old run, progress is reported', async () => {
    const jr = new JobRegistry(); const seen: number[] = [];
    jr.subscribe(() => seen.push(jr.list().length));
    const p = jr.run('k', 'Job', (signal, progress) => new Promise((_, rej) => { progress(0.5); signal.addEventListener('abort', () => rej(new DOMException('x', 'AbortError'))); }));
    expect(jr.list()).toHaveLength(1); expect(jr.list()[0].progress).toBe(0.5);
    expect(jr.cancel('k')).toBe(true);
    await expect(p).rejects.toSatisfy(isAbort);
    expect(jr.list()).toHaveLength(0); expect(jr.cancel('k')).toBe(false);
    const first = jr.run('s', 'a', (signal) => new Promise((_, rej) => signal.addEventListener('abort', () => rej(new DOMException('x', 'AbortError')))));
    const second = jr.run('s', 'b', async () => 42);
    await expect(first).rejects.toSatisfy(isAbort); expect(await second).toBe(42);
    const a = jr.run('x', 'x', (signal) => new Promise((_, rej) => signal.addEventListener('abort', () => rej(new DOMException('x', 'AbortError')))));
    const b = jr.run('y', 'y', (signal) => new Promise((_, rej) => signal.addEventListener('abort', () => rej(new DOMException('x', 'AbortError')))));
    expect(jr.cancelAll()).toBe(2); await expect(a).rejects.toBeDefined(); await expect(b).rejects.toBeDefined();
  });
});
