// [remix] Stage 4: scene-cut detection from sampled frames, by colour-histogram difference. Pure (no DOM): the browser side that
// grabs frames is scan-video.ts. The existing Detect scenes button (lib/occ/analysis.ts detectSceneChanges) uses the mean absolute pixel
// difference, which also fires on fast camera motion; a histogram ignores where things are in the picture and reacts to colour change.
// The approach (per-channel RGB histogram distance, an adaptive "much higher than the neighbourhood" test, a minimum scene length)
// is the standard one; no FreeCut source was copied (its scene detectors depend on its worker and logger layers).
import { normalizeSceneCandidates, type RawSceneCandidate, type SceneChange } from '../../../openchatcut/scene/detect';

export const HIST_BINS = 16;

/** 3 x HIST_BINS normalised histogram (R, G, B) of an RGBA pixel buffer. */
export function rgbHistogram(rgba: ArrayLike<number>, bins = HIST_BINS): Float32Array {
  const h = new Float32Array(bins * 3);
  const n = Math.floor(rgba.length / 4);
  if (!n) return h;
  const shift = 256 / bins;
  for (let i = 0; i < n; i++) {
    const o = i * 4;
    h[Math.min(bins - 1, Math.floor(rgba[o] / shift))]++;
    h[bins + Math.min(bins - 1, Math.floor(rgba[o + 1] / shift))]++;
    h[2 * bins + Math.min(bins - 1, Math.floor(rgba[o + 2] / shift))]++;
  }
  for (let i = 0; i < h.length; i++) h[i] /= n;
  return h;
}

/** 0 (identical) to 1 (disjoint): half the L1 distance between the histograms, averaged over the three channels. */
export function histogramDistance(a: ArrayLike<number>, b: ArrayLike<number>): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += Math.abs(a[i] - b[i]);
  return sum / 2 / 3;
}

export interface FrameSample { timeSec: number; hist: Float32Array }
export interface CutOptions {
  /** absolute score above which a change can be a cut (default 0.25) */
  threshold?: number;
  /** a cut must also exceed this multiple of the average score of the preceding samples (default 2.5; 0 turns the test off) */
  adaptiveRatio?: number;
  /** minimum scene length (default 0.5 s): closer candidates compete by score */
  minSceneSec?: number;
}
export interface Cut { timeSec: number; score: number; kind: SceneChange['kind'] }

/** Cuts between consecutive samples. `timeSec` is the first sample AFTER the change (refine with refineCut for exact timing). */
export function detectCuts(samples: readonly FrameSample[], durationSec: number, opts: CutOptions = {}): Cut[] {
  const threshold = opts.threshold ?? 0.25;
  const ratio = opts.adaptiveRatio ?? 2.5;
  const scores: RawSceneCandidate[] = [];
  const recent: number[] = [];
  for (let i = 1; i < samples.length; i++) {
    const s = histogramDistance(samples[i - 1].hist, samples[i].hist);
    const avg = recent.length ? recent.reduce((x, y) => x + y, 0) / recent.length : 0;
    // the neighbourhood average excludes earlier cuts so one cut does not hide the next
    if (s >= threshold && (ratio <= 0 || s >= avg * ratio)) scores.push({ timeMs: Math.round(samples[i].timeSec * 1000), score: s });
    recent.push(s >= threshold ? 0 : s);
    if (recent.length > 8) recent.shift();
  }
  const norm = normalizeSceneCandidates(scores, { threshold, minSceneMs: Math.round((opts.minSceneSec ?? 0.5) * 1000), durationMs: durationSec * 1000 });
  return norm.map((c) => ({ timeSec: c.timeMs / 1000, score: c.score, kind: c.kind }));
}

/**
 * Narrow a cut between two sample times to about `precisionSec` by bisection. `histAt` samples one frame (async: it seeks a video).
 * Returns the first time at which the picture already looks like the "after" frame.
 */
export async function refineCut(
  histAt: (timeSec: number) => Promise<Float32Array>, before: FrameSample, after: FrameSample, precisionSec = 1 / 30, signal?: AbortSignal,
): Promise<number> {
  let lo = before.timeSec; let hi = after.timeSec;
  while (hi - lo > precisionSec) {
    if (signal?.aborted) throw new DOMException('Scene scan cancelled', 'AbortError');
    const mid = (lo + hi) / 2;
    const h = await histAt(mid);
    if (histogramDistance(h, before.hist) <= histogramDistance(h, after.hist)) lo = mid; else hi = mid;
  }
  return hi;
}
