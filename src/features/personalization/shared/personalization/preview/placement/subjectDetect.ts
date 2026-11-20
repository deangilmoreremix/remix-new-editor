/**
 * Find the subject of the footage automatically, on the viewer's own device (object detection through the free local
 * AI), and turn it into the same protected zone the customer can mark by hand. Text and images are then kept off it by
 * the placement engine and the layout check, which already react to protected zones.
 *
 * This is a helper, not proof: it boxes common objects (people, animals, vehicles, everyday products). It can miss a
 * subject and it never overrides one the customer marked themselves. Pure parts first, then one orchestrator whose
 * frame grabbing and detection are injected, so it is testable without a model.
 */
import { coverCropRect } from './frameSampler';
import type { NormRect, ProtectedZone } from '../types';
import type { Detection, FrameImage } from '../../localAI/engine';

export const AUTO_SUBJECT_ZONE_ID = 'auto-subject';
/** Detections below this confidence are ignored. */
export const MIN_SUBJECT_SCORE = 0.6;
/** Frames sampled across the clip. */
export const SUBJECT_FRAME_COUNT = 5;
/** Breathing room added around the detected box (a fraction of the frame). */
export const SUBJECT_PAD = 0.06;

const ANIMALS = new Set(['bird', 'cat', 'dog', 'horse', 'sheep', 'cow', 'elephant', 'bear', 'zebra', 'giraffe']);
const VEHICLES = new Set(['bicycle', 'car', 'motorcycle', 'airplane', 'bus', 'train', 'truck', 'boat']);
const PRODUCTS = new Set(['bottle', 'wine glass', 'cup', 'laptop', 'cell phone', 'tv', 'chair', 'couch', 'bed', 'dining table', 'potted plant', 'vase', 'handbag', 'backpack', 'suitcase', 'cake', 'pizza', 'sandwich', 'donut', 'bowl']);

/** How likely a label is to be THE subject of a marketing clip. 0 = never treated as the subject. */
export function subjectWeight(label: string): number {
  const l = label.toLowerCase();
  if (l === 'person') return 1;
  if (ANIMALS.has(l) || VEHICLES.has(l)) return 0.8;
  if (PRODUCTS.has(l)) return 0.6;
  return 0;
}

export interface FoundSubject { label: string; score: number; rect: NormRect }

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/** Detection box (fractions 0..1 of the full frame) as a top-left rectangle. */
export function boxToRect(box: Detection['box']): NormRect {
  const x = clamp01(box.xmin), y = clamp01(box.ymin);
  return { x, y, w: Math.max(0, clamp01(box.xmax) - x), h: Math.max(0, clamp01(box.ymax) - y) };
}

/**
 * The most likely subject among one frame's detections: confidence x how subject-like the label is x a gentle preference
 * for bigger things (gentle: a big background sofa must not beat the person in front of it).
 */
export function mainSubject(detections: Detection[], minScore = MIN_SUBJECT_SCORE): FoundSubject | null {
  let best: { s: FoundSubject; rank: number } | null = null;
  for (const d of detections) {
    if (!d?.box || d.score < minScore) continue;
    const weight = subjectWeight(d.label);
    if (weight <= 0) continue;
    const rect = boxToRect(d.box);
    const area = rect.w * rect.h;
    if (area < 0.01) continue; // a speck is not the subject
    const rank = d.score * weight * Math.pow(area, 0.25);
    if (!best || rank > best.rank) best = { s: { label: d.label, score: d.score, rect }, rank };
  }
  return best?.s ?? null;
}

export function unionRects(rects: NormRect[]): NormRect | null {
  if (!rects.length) return null;
  const x1 = Math.min(...rects.map((r) => r.x)), y1 = Math.min(...rects.map((r) => r.y));
  const x2 = Math.max(...rects.map((r) => r.x + r.w)), y2 = Math.max(...rects.map((r) => r.y + r.h));
  return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
}

export function padRect(r: NormRect, pad = SUBJECT_PAD): NormRect {
  const x1 = clamp01(r.x - pad), y1 = clamp01(r.y - pad);
  const x2 = clamp01(r.x + r.w + pad), y2 = clamp01(r.y + r.h + pad);
  return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
}

/**
 * A rectangle in fractions of the SOURCE frame, as it appears in the composition: the footage is drawn with
 * `objectFit: 'cover'`, so part of it is cropped away. Returns null when none of it is visible.
 */
export function toCompositionRect(rect: NormRect, src: { w: number; h: number }, comp: { w: number; h: number }): NormRect | null {
  const crop = coverCropRect(src.w, src.h, comp.w, comp.h);
  if (!(crop.sw > 0 && crop.sh > 0)) return null;
  const x1 = clamp01((rect.x * src.w - crop.sx) / crop.sw);
  const y1 = clamp01((rect.y * src.h - crop.sy) / crop.sh);
  const x2 = clamp01(((rect.x + rect.w) * src.w - crop.sx) / crop.sw);
  const y2 = clamp01(((rect.y + rect.h) * src.h - crop.sy) / crop.sh);
  if (x2 - x1 < 0.02 || y2 - y1 < 0.02) return null;
  return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
}

/** Times (seconds) to look at: spread across the clip, away from the very first and last frame. */
export function subjectSampleTimes(durationSeconds: number, count = SUBJECT_FRAME_COUNT): number[] {
  const d = Number.isFinite(durationSeconds) && durationSeconds > 0 ? durationSeconds : 0;
  if (!d || count <= 1) return [0];
  return Array.from({ length: count }, (_, i) => Math.round(((i + 0.5) / count) * d * 100) / 100);
}

export interface SubjectFound {
  ok: true
  zone: ProtectedZone
  label: string
  /** Mean confidence of the frames that agreed. */
  score: number
  framesUsed: number
  framesTotal: number
}
export type SubjectOutcome = SubjectFound | { ok: false; reason: 'no-frames' | 'nothing-found' | 'outside-frame' }

export interface FindSubjectOptions {
  times: number[]
  grab: (t: number) => Promise<FrameImage | null>
  detect: (frame: FrameImage) => Promise<Detection[]>
  comp: { width: number; height: number }
  signal?: AbortSignal
  onProgress?: (done: number, total: number) => void
}

const abortError = () => Object.assign(new Error('Cancelled'), { name: 'AbortError' });

/**
 * Looks at each frame, takes the main subject of every one, keeps those that agree on the same kind of thing (the
 * most common label) and returns one zone covering where it was, mapped into the composition and padded a little.
 */
export async function findSubjectZone(opts: FindSubjectOptions): Promise<SubjectOutcome> {
  const found: (FoundSubject & { frame: FrameImage })[] = [];
  let grabbed = 0;
  for (let i = 0; i < opts.times.length; i++) {
    if (opts.signal?.aborted) throw abortError();
    const frame = await opts.grab(opts.times[i]).catch(() => null);
    opts.onProgress?.(i + 1, opts.times.length);
    if (!frame) continue;
    grabbed++;
    const subject = mainSubject(await opts.detect(frame));
    if (subject) found.push({ ...subject, frame });
  }
  if (grabbed === 0) return { ok: false, reason: 'no-frames' };
  if (!found.length) return { ok: false, reason: 'nothing-found' };

  const counts = new Map<string, number>();
  for (const f of found) counts.set(f.label, (counts.get(f.label) ?? 0) + 1);
  const label = [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
  const agreeing = found.filter((f) => f.label === label);

  // Each frame's box is mapped with ITS OWN size (frames of one clip share a shape), then merged in composition space.
  const rects: NormRect[] = [];
  for (const f of agreeing) {
    const mapped = toCompositionRect(f.rect, { w: f.frame.width, h: f.frame.height }, { w: opts.comp.width, h: opts.comp.height });
    if (mapped) rects.push(mapped);
  }
  const merged = unionRects(rects);
  if (!merged) return { ok: false, reason: 'outside-frame' };
  const padded = padRect(merged);
  const score = agreeing.reduce((s, f) => s + f.score, 0) / agreeing.length;
  return {
    ok: true,
    zone: { id: AUTO_SUBJECT_ZONE_ID, label: `Subject found: ${label}`, source: 'user', ...padded },
    label,
    score,
    framesUsed: agreeing.length,
    framesTotal: opts.times.length,
  };
}
