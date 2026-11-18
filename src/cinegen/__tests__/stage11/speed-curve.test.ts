// Stage 11 (port J): speed-ramp curve. Real timeline operations; numbers are checked against the analytic remap.
import { describe, it, expect } from 'vitest';
import { createDefaultTimeline, addClipToTrack } from '@cinegen/lib/editor/timeline-operations';
import { exportClipsFromTimeline } from '@cinegen/lib/editor/export-mapping';
import { clipEndTime } from '@cinegen/types/timeline';
import {
  applySpeedCurve, curveSpeedAt, curveTimeAt, curveDuration, curveSourceAt, curvePieceSpeeds, normalizeCurve, invSpeedIntegral, pieceDuration, CURVE_PRESETS,
} from '@cinegen/lib/editor/stage11/speed-curve';
import type { Asset } from '@cinegen/types/project';
import type { Timeline } from '@cinegen/types/timeline';

const A: Asset = { id: 'A', name: 'A', type: 'video', url: 'https://x.test/A.mp4', duration: 10, createdAt: '2026-01-01' };
const fresh = (): Timeline => { const tl = createDefaultTimeline('t'); return addClipToTrack(tl, tl.tracks.find((t) => t.name === 'V1')!.id, A, 0); };
const V1 = (tl: Timeline) => tl.tracks.find((t) => t.name === 'V1')!.id;

describe('speed curve maths', () => {
  it('constant curve: speed and remap are exact', () => {
    const c = { points: [{ at: 0, speed: 2 }, { at: 1, speed: 2 }] };
    expect(curveSpeedAt(c, 0.37)).toBeCloseTo(2, 9);
    expect(curveTimeAt(c, 1, 10)).toBeCloseTo(5, 6);
    expect(curveTimeAt(c, 0.5, 10)).toBeCloseTo(2.5, 6);
    expect(curveSourceAt(c, 2.5, 10)).toBeCloseTo(0.5, 5);
  });

  it('linear 1x to 4x has the closed-form integral  S * ln(4) / 3  (time to play 10 s of source)', () => {
    const c = { points: [{ at: 0, speed: 1 }, { at: 1, speed: 4 }] };
    expect(curveDuration(c, 10)).toBeCloseTo((10 * Math.log(4)) / 3, 5);
    // inverse remap is consistent with the forward remap
    for (const u of [0.1, 0.4, 0.75, 0.99]) expect(curveSourceAt(c, curveTimeAt(c, u, 10), 10)).toBeCloseTo(u, 4);
  });

  it('segment easing changes the curve: ease-in-out lies below linear in the first half and above in the second', () => {
    const lin = { points: [{ at: 0, speed: 1 }, { at: 1, speed: 3 }] };
    const eio = { points: [{ at: 0, speed: 1, ease: 'ease-in-out' as const }, { at: 1, speed: 3 }] };
    expect(curveSpeedAt(eio, 0.25)).toBeLessThan(curveSpeedAt(lin, 0.25));
    expect(curveSpeedAt(eio, 0.75)).toBeGreaterThan(curveSpeedAt(lin, 0.75));
    expect(curveSpeedAt(eio, 0.5)).toBeCloseTo(2, 3);
    // a custom bezier is honoured (hold-like: speed stays near 1 until late)
    const bz = { points: [{ at: 0, speed: 1, ease: { bezier: [0.9, 0, 1, 0.2] as [number, number, number, number] } }, { at: 1, speed: 3 }] };
    expect(curveSpeedAt(bz, 0.5)).toBeLessThan(1.3);
  });

  it('speeds are clamped to the supported 0.1..8 range even when a spring overshoots', () => {
    const c = { points: [{ at: 0, speed: 0.1, ease: { spring: { tension: 400, friction: 20, mass: 1 } } }, { at: 1, speed: 8 }] };
    for (let i = 0; i <= 50; i++) { const s = curveSpeedAt(c, i / 50); expect(s).toBeGreaterThanOrEqual(0.1); expect(s).toBeLessThanOrEqual(8); }
  });

  it('is deterministic: same curve, same numbers, with Date.now and Math.random trapped', () => {
    const c = CURVE_PRESETS['hero-moment'].curve;
    const a = curvePieceSpeeds(c, 24);
    const now = Date.now; const rnd = Math.random;
    Date.now = () => { throw new Error('clock'); }; Math.random = () => { throw new Error('random'); };
    try { expect(curvePieceSpeeds(c, 24)).toEqual(a); } finally { Date.now = now; Math.random = rnd; }
  });

  it('piece speeds are harmonic means: total duration equals the exact remap', () => {
    for (const p of Object.values(CURVE_PRESETS)) {
      const sp = curvePieceSpeeds(p.curve, 32);
      expect(sp).toHaveLength(32);
      expect(pieceDuration(sp, 10)).toBeCloseTo(curveDuration(p.curve, 10), 2);
    }
  });

  it('normalizeCurve repairs untrusted input', () => {
    expect(normalizeCurve(null).points).toEqual([{ at: 0, speed: 1 }, { at: 1, speed: 1 }]);
    const n = normalizeCurve({ points: [{ at: 0.4, speed: 99 }, { at: NaN, speed: 1 }, { at: 0.9, speed: 0.01, ease: 'bogus' }] });
    expect(n.points[0].at).toBe(0); expect(n.points.at(-1)!.at).toBe(1);
    expect(n.points.every((p) => p.speed >= 0.1 && p.speed <= 8)).toBe(true);
    expect(invSpeedIntegral({ points: [{ at: 0, speed: 1 }, { at: 1, speed: 1 }] }, 0.2, 0.2)).toBe(0);
  });
});

describe('applySpeedCurve on a real timeline', () => {
  it('cuts the clip into contiguous pieces whose boundaries lie exactly on the remap (source AND time)', () => {
    let tl = fresh();
    tl = addClipToTrack(tl, V1(tl), { ...A, id: 'B', duration: 5 }, 10); // follows A, must ripple
    const a = tl.clips.find((c) => c.assetId === 'A' && c.trackId === V1(tl))!;
    const curve = CURVE_PRESETS['hero-moment'].curve;
    const r = applySpeedCurve(tl, a.id, curve, { steps: 24 });
    const v = r.timeline.clips.filter((c) => c.trackId === V1(tl)).sort((x, y) => x.startTime - y.startTime);
    const pcs = v.filter((c) => c.assetId === 'A');
    expect(pcs).toHaveLength(24);
    let src = 0; let tt = 0;
    pcs.forEach((p, i) => {
      expect(p.trimStart).toBeCloseTo(src, 6);
      expect(p.startTime).toBeCloseTo(tt, 6);
      // exact remap at the piece start (within the 1e-4 speed rounding)
      expect(p.startTime).toBeCloseTo(curveTimeAt(curve, i / 24, 10), 2);
      src += p.duration - p.trimStart - p.trimEnd; tt = clipEndTime(p);
    });
    expect(src).toBeCloseTo(10, 6);
    expect(tt).toBeCloseTo(curveDuration(curve, 10), 2);
    // the clip that followed ripples by the length change
    expect(v.find((c) => c.assetId === 'B')!.startTime).toBeCloseTo(tt, 6);
    // linked audio ramped with identical pieces
    expect(r.timeline.clips.filter((c) => c.assetId === 'A' && c.trackId !== V1(tl))).toHaveLength(24);
  });

  it('export gets the same per-piece speeds (through the real export mapping)', () => {
    const tl = fresh();
    const r = applySpeedCurve(tl, tl.clips[0].id, CURVE_PRESETS['ease-into-slow'].curve, { steps: 12 });
    const ex = exportClipsFromTimeline(r.timeline, [A]).filter((c) => c.type === 'video' && c.trackKind === 'video');
    expect(ex).toHaveLength(12);
    expect(ex.map((c) => c.speed)).toEqual(curvePieceSpeeds(CURVE_PRESETS['ease-into-slow'].curve, 12));
    // slow-mo end: the last piece is slower than the first
    expect(ex.at(-1)!.speed!).toBeLessThan(ex[0].speed!);
  });

  it('does not touch compound clips and leaves the input timeline unchanged (undo = the old object)', () => {
    const tl = fresh();
    const before = JSON.stringify(tl);
    applySpeedCurve(tl, tl.clips[0].id, CURVE_PRESETS['flash-forward'].curve);
    expect(JSON.stringify(tl)).toBe(before);
    expect(applySpeedCurve(tl, 'nope', CURVE_PRESETS['flash-forward'].curve).clipIds).toEqual([]);
  });
});
