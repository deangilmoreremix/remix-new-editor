import { describe, it, expect, vi } from 'vitest';
import { timelineToSourceTime, boundaryFrameTimes, clipTimelineRange } from '../frameGrab.js';
import { findSilences, mixAndResample } from '../audio.js';
import { mixByDepth, parallaxPath, parallaxFrame } from '../depthEffects.js';
import { rankFrames, zeroShotTags, dot } from '../mlIndex.js';
import { createWorkerClient } from '../mlClient.js';
import { normalizeCaption, sortCaptions } from '../../remotion/captions.js';
import { captionLines, assignSpeakers, padBox, sampleTimes } from '../localAI.js';

describe('frameGrab time math', () => {
  const clip = { left: 10, width: 20, trimIn: 3, playbackRate: 2 }; // 6s–18s on a 60s timeline
  it('reads left/width clips', () => {
    expect(clipTimelineRange(clip, 60)).toEqual({ start: 6, end: 18 });
  });
  it('maps timeline time to source time with trim and speed', () => {
    expect(timelineToSourceTime(clip, 6, 60)).toBe(3);
    expect(timelineToSourceTime(clip, 9, 60)).toBe(9); // 3 + 3s × 2
    expect(timelineToSourceTime(clip, 100, 60)).toBe(27); // clamped to the clip end: 3 + 12s × 2
  });
  it('picks the last frame before a gap and the first frame after it', () => {
    const before = { left: 0, width: 10, trimIn: 1 }; // 0–6s
    const after = { left: 20, width: 10, trimIn: 4 }; // 12–18s
    const t = boundaryFrameTimes(before, after, 60, { fps: 30 });
    expect(t.before).toBeCloseTo(7 - 1 / 30, 5);
    expect(t.after).toBe(4);
  });
});

describe('audio helpers', () => {
  it('finds silent ranges', () => {
    const rate = 1000;
    const pcm = new Float32Array(3000);
    for (let i = 0; i < 1000; i += 1) pcm[i] = Math.sin(i) * 0.5; // 0–1 s loud
    for (let i = 2000; i < 3000; i += 1) pcm[i] = Math.sin(i) * 0.5; // 2–3 s loud
    const s = findSilences(pcm, rate, { minSec: 0.5 });
    expect(s).toHaveLength(1);
    expect(s[0].start).toBeCloseTo(1, 1);
    expect(s[0].end).toBeCloseTo(2, 1);
  });
  it('mixes channels and resamples', () => {
    const out = mixAndResample([new Float32Array([1, 1, 1, 1]), new Float32Array([0, 0, 0, 0])], 4, 2);
    expect(Array.from(out)).toEqual([0.5, 0.5]);
  });
});

describe('depth effects', () => {
  it('keeps near pixels sharp and blurs far ones', () => {
    const sharp = new Uint8ClampedArray([255, 0, 0, 255, 255, 0, 0, 255]);
    const blurred = new Uint8ClampedArray([0, 0, 255, 255, 0, 0, 255, 255]);
    const out = mixByDepth(sharp, blurred, new Uint8Array([255, 0]));
    expect(Array.from(out.slice(0, 4))).toEqual([255, 0, 0, 255]);
    expect(Array.from(out.slice(4, 8))).toEqual([0, 0, 255, 255]);
  });
  it('parallax paths start centred and zoom in', () => {
    expect(parallaxPath(0, { style: 'push' }).zoom).toBeCloseTo(1.04);
    expect(parallaxPath(1, { style: 'push' }).zoom).toBeCloseTo(1.16);
    const f = parallaxFrame(new Uint8ClampedArray(16).fill(9), new Uint8Array(4).fill(128), 2, 2, { dx: 4 });
    expect(f.length).toBe(16);
  });
});

describe('search index', () => {
  it('ranks the best frame per asset', () => {
    const q = new Float32Array([1, 0]);
    const hits = rankFrames([
      { assetId: 'a', frames: [{ t: 1, embedding: new Float32Array([0.2, 0.98]) }, { t: 4, embedding: new Float32Array([0.9, 0.43]) }] },
      { assetId: 'b', frames: [{ t: 0, embedding: new Float32Array([0.1, 0.99]) }] },
    ], q, { minScore: 0.15 });
    expect(hits.map((h) => [h.assetId, h.t])).toEqual([['a', 4]]);
    expect(dot(q, q)).toBe(1);
  });
  it('zero-shot tags pick the closest labels', () => {
    const tags = zeroShotTags(new Float32Array([1, 0]), [new Float32Array([1, 0]), new Float32Array([0, 1])], ['beach', 'office']);
    expect(tags[0].label).toBe('beach');
    expect(tags.find((t) => t.label === 'office')).toBeUndefined();
  });
});

describe('captions keep local-AI metadata', () => {
  it('passes speaker and lang through normalizeCaption', () => {
    expect(normalizeCaption({ text: 'hi', startMs: 0, endMs: 100, speaker: 2, lang: 'es' })).toMatchObject({ speaker: 2, lang: 'es' });
    const plain = normalizeCaption({ text: 'hi', startMs: 0, endMs: 100 });
    expect(plain).not.toHaveProperty('speaker');
    expect(plain).not.toHaveProperty('lang');
    expect(sortCaptions([{ text: 'x', startMs: 5, endMs: 9, lang: 'not a lang!' }])[0]).not.toHaveProperty('lang');
  });
});

function mockWorker() {
  const listeners = { message: new Set(), error: new Set() };
  const w = {
    posted: [],
    terminated: false,
    addEventListener: (t, fn) => listeners[t].add(fn),
    postMessage: (msg) => w.posted.push(msg),
    terminate: () => { w.terminated = true; },
    emit: (data) => listeners.message.forEach((fn) => fn({ data })),
  };
  return w;
}

describe('worker client', () => {
  it('matches replies by id and forwards progress', async () => {
    const w = mockWorker();
    const client = createWorkerClient(() => w);
    const onProgress = vi.fn();
    const p = client.run('depth', { a: 1 }, { onProgress });
    const { id } = w.posted[0];
    w.emit({ id, type: 'progress', progress: 0.5 });
    w.emit({ id: id + 99, type: 'done', result: 'other' });
    w.emit({ id, type: 'done', result: 'mine' });
    await expect(p).resolves.toBe('mine');
    expect(onProgress).toHaveBeenCalledWith(expect.objectContaining({ progress: 0.5 }));
  });
  it('rejects worker errors and terminates on abort', async () => {
    const w = mockWorker();
    const client = createWorkerClient(() => w);
    const p = client.run('sam.mask', {});
    w.emit({ id: w.posted[0].id, type: 'error', message: 'boom' });
    await expect(p).rejects.toThrow('boom');
    const ctrl = new AbortController();
    const q = client.run('sam.mask', {}, { signal: ctrl.signal });
    ctrl.abort();
    await expect(q).rejects.toMatchObject({ name: 'AbortError' });
    expect(w.terminated).toBe(true);
  });
});

describe('caption helpers', () => {
  it('groups words into lines that break on pauses, punctuation and speaker changes', () => {
    const lines = captionLines([
      { text: 'Hello', startMs: 0, endMs: 300 },
      { text: ' world.', startMs: 300, endMs: 600 },
      { text: ' Next', startMs: 700, endMs: 900 },
      { text: ' line', startMs: 2000, endMs: 2200, speaker: 2 },
    ]);
    expect(lines.map((l) => l.text)).toEqual(['Hello world.', 'Next', 'line']);
  });
  it('assigns speakers by overlap, numbered in order of appearance', () => {
    const out = assignSpeakers(
      [{ text: 'a', startMs: 0, endMs: 900 }, { text: 'b', startMs: 1000, endMs: 1900 }, { text: 'c', startMs: 2000, endMs: 2500 }],
      [{ speaker: 7, start: 0, end: 0.95 }, { speaker: 3, start: 0.95, end: 2.6 }],
    );
    expect(out.map((c) => c.speaker)).toEqual([1, 2, 2]);
  });
  it('pads boxes inside the frame and samples times evenly', () => {
    expect(padBox([10, 10, 20, 20], 25, 25, 0.5)).toEqual([5, 5, 24, 24]);
    expect(sampleTimes(0, 10, 2)).toEqual([2.5, 7.5]);
  });
});

describe('audio sync', () => {
  it('finds how far one recording is shifted from another', async () => {
    const { syncOffset } = await import('../audio.js');
    const rate = 2000;
    const clicks = [0.3, 1.1, 1.5, 2.6, 3.0, 4.2];
    const make = (len, shift) => {
      const x = new Float32Array(Math.round(len * rate));
      clicks.forEach((t) => {
        const s = Math.round((t + shift) * rate);
        for (let i = 0; i < 200 && s + i < x.length; i += 1) if (s + i >= 0) x[s + i] = Math.sin(i) * (1 - i / 200);
      });
      return x;
    };
    const camera = make(6, 1.25); // camera started recording 1.25 s before the mic
    const mic = make(6, 0);
    const { offsetSec, confidence } = syncOffset(camera, mic, rate, { maxOffsetSec: 3 });
    expect(offsetSec).toBeCloseTo(1.25, 1);
    expect(confidence).toBeGreaterThan(0.5);
  });
});
