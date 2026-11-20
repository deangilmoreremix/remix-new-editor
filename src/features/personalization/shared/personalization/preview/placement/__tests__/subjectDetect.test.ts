import { describe, it, expect, vi } from 'vitest';
import {
  AUTO_SUBJECT_ZONE_ID, boxToRect, findSubjectZone, mainSubject, padRect, subjectSampleTimes, subjectWeight, toCompositionRect, unionRects,
} from '../subjectDetect';
import type { Detection, FrameImage } from '../../../localAI/engine';

const det = (label: string, score: number, box: [number, number, number, number]): Detection => ({ label, score, box: { xmin: box[0], ymin: box[1], xmax: box[2], ymax: box[3] } });
const frame = (w = 1920, h = 1080): FrameImage => ({ width: w, height: h, data: new Uint8ClampedArray(4) });

describe('subjectWeight', () => {
  it('rates people highest, animals and vehicles next, products lower, other things never', () => {
    expect(subjectWeight('person')).toBe(1);
    expect(subjectWeight('Dog')).toBe(0.8);
    expect(subjectWeight('truck')).toBe(0.8);
    expect(subjectWeight('bottle')).toBe(0.6);
    expect(subjectWeight('toothbrush')).toBe(0);
  });
});

describe('mainSubject', () => {
  it('prefers a person over a bigger background object', () => {
    const s = mainSubject([det('couch', 0.9, [0, 0.2, 1, 1]), det('person', 0.9, [0.4, 0.1, 0.6, 0.9])]);
    expect(s?.label).toBe('person');
  });
  it('ignores low-confidence detections, tiny ones and labels that are never a subject', () => {
    expect(mainSubject([det('person', 0.4, [0.2, 0.2, 0.8, 0.8])])).toBeNull();
    expect(mainSubject([det('person', 0.95, [0.5, 0.5, 0.52, 0.52])])).toBeNull();
    expect(mainSubject([det('toothbrush', 0.99, [0.1, 0.1, 0.9, 0.9])])).toBeNull();
    expect(mainSubject([])).toBeNull();
  });
  it('clamps a box that runs off the frame', () => {
    expect(boxToRect({ xmin: -0.2, ymin: 0.1, xmax: 1.3, ymax: 0.5 })).toEqual({ x: 0, y: 0.1, w: 1, h: 0.4 });
  });
});

describe('rect helpers', () => {
  it('unions rectangles and pads within the frame', () => {
    expect(unionRects([{ x: 0.1, y: 0.1, w: 0.2, h: 0.2 }, { x: 0.5, y: 0.4, w: 0.2, h: 0.3 }])).toEqual({ x: 0.1, y: 0.1, w: 0.6, h: 0.6 });
    expect(unionRects([])).toBeNull();
    const p = padRect({ x: 0.02, y: 0.02, w: 0.96, h: 0.96 }, 0.1);
    expect(p).toEqual({ x: 0, y: 0, w: 1, h: 1 });
  });
});

describe('toCompositionRect (objectFit: cover)', () => {
  it('is unchanged when the footage and the frame have the same shape', () => {
    const r = toCompositionRect({ x: 0.25, y: 0.25, w: 0.5, h: 0.5 }, { w: 1920, h: 1080 }, { w: 1920, h: 1080 })!;
    expect(r.x).toBeCloseTo(0.25); expect(r.w).toBeCloseTo(0.5);
  });
  it('accounts for the crop when a wide clip fills a vertical frame', () => {
    // 16:9 source into a 9:16 frame shows only the middle 31.6% of the width
    const r = toCompositionRect({ x: 0.4, y: 0.1, w: 0.2, h: 0.8 }, { w: 1920, h: 1080 }, { w: 1080, h: 1920 })!;
    expect(r.x).toBeGreaterThan(0.1); expect(r.w).toBeGreaterThan(0.4); // a small slice of the source fills much more of the frame
    expect(r.y).toBeCloseTo(0.1); expect(r.h).toBeCloseTo(0.8);
  });
  it('returns null when the subject is cropped out of the frame', () => {
    expect(toCompositionRect({ x: 0, y: 0.1, w: 0.1, h: 0.8 }, { w: 1920, h: 1080 }, { w: 1080, h: 1920 })).toBeNull();
  });
});

describe('subjectSampleTimes', () => {
  it('spreads frames across the clip and handles an unknown length', () => {
    expect(subjectSampleTimes(10, 5)).toEqual([1, 3, 5, 7, 9]);
    expect(subjectSampleTimes(0)).toEqual([0]);
    expect(subjectSampleTimes(Number.NaN)).toEqual([0]);
  });
});

describe('findSubjectZone', () => {
  const comp = { width: 1920, height: 1080 };
  it('merges the frames that agree into one padded zone in composition space', async () => {
    const boxes: Record<number, [number, number, number, number]> = { 1: [0.30, 0.2, 0.5, 0.8], 2: [0.35, 0.2, 0.6, 0.8], 3: [0.32, 0.2, 0.55, 0.8] };
    const out = await findSubjectZone({
      times: [1, 2, 3], comp,
      grab: async () => frame(),
      detect: vi.fn(async () => []).mockResolvedValueOnce([det('person', 0.9, boxes[1])]).mockResolvedValueOnce([det('person', 0.8, boxes[2])]).mockResolvedValueOnce([det('person', 0.7, boxes[3])]),
    });
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.label).toBe('person');
    expect(out.framesUsed).toBe(3);
    expect(out.score).toBeCloseTo(0.8);
    expect(out.zone).toMatchObject({ id: AUTO_SUBJECT_ZONE_ID, source: 'user', label: 'Subject found: person' });
    expect(out.zone.x).toBeCloseTo(0.30 - 0.06); expect(out.zone.x + out.zone.w).toBeCloseTo(0.6 + 0.06);
  });
  it('keeps the most common kind of subject and drops a one-off', async () => {
    const seq = [[det('person', 0.9, [0.3, 0.2, 0.5, 0.8])], [det('dog', 0.95, [0.7, 0.5, 0.9, 0.9])], [det('person', 0.9, [0.3, 0.2, 0.5, 0.8])]];
    let i = 0;
    const out = await findSubjectZone({ times: [1, 2, 3], comp, grab: async () => frame(), detect: async () => seq[i++] });
    expect(out.ok && out.label).toBe('person');
    expect(out.ok && out.framesUsed).toBe(2);
  });
  it('says why nothing was found', async () => {
    expect(await findSubjectZone({ times: [1], comp, grab: async () => null, detect: async () => [] })).toEqual({ ok: false, reason: 'no-frames' });
    expect(await findSubjectZone({ times: [1, 2], comp, grab: async () => frame(), detect: async () => [] })).toEqual({ ok: false, reason: 'nothing-found' });
  });
  it('treats a frame that cannot be read as skipped, not as a failure', async () => {
    let n = 0;
    const out = await findSubjectZone({ times: [1, 2], comp, grab: async () => { if (n++ === 0) throw new Error('tainted'); return frame(); }, detect: async () => [det('person', 0.9, [0.3, 0.2, 0.5, 0.8])] });
    expect(out.ok && out.framesUsed).toBe(1);
  });
  it('stops when cancelled and reports progress', async () => {
    const ac = new AbortController();
    const progress: number[] = [];
    await expect(findSubjectZone({ times: [1, 2, 3], comp, signal: ac.signal, grab: async () => frame(), onProgress: (d) => { progress.push(d); if (d === 1) ac.abort(); }, detect: async () => [] })).rejects.toMatchObject({ name: 'AbortError' });
    expect(progress).toEqual([1]);
  });
  it('reports a subject that sits wholly outside the visible crop', async () => {
    const out = await findSubjectZone({ times: [1], comp: { width: 1080, height: 1920 }, grab: async () => frame(), detect: async () => [det('person', 0.9, [0, 0.1, 0.1, 0.9])] });
    expect(out).toEqual({ ok: false, reason: 'outside-frame' });
  });
});
