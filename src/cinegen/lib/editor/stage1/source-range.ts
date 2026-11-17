// [remix] Stage 1: mark in / mark out for the source monitor (pure). Seconds, like the rest of CineGen's clip model.
export interface SourceMarks { assetId: string; markIn: number | null; markOut: number | null }

/** Shortest range an edit may use (one frame at 24 fps, the editor's display rate). */
export const MIN_RANGE = 1 / 24;

export const emptyMarks = (assetId: string): SourceMarks => ({ assetId, markIn: null, markOut: null });
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export function setMarkIn(m: SourceMarks, time: number, assetDuration: number): SourceMarks {
  const t = clamp(time, 0, Math.max(0, assetDuration));
  // an out point at or before the new in point is dropped (as in Premiere / Resolve)
  return { ...m, markIn: t, markOut: m.markOut !== null && m.markOut - t < MIN_RANGE ? null : m.markOut };
}

export function setMarkOut(m: SourceMarks, time: number, assetDuration: number): SourceMarks {
  const t = clamp(time, 0, Math.max(0, assetDuration));
  return { ...m, markOut: t, markIn: m.markIn !== null && t - m.markIn < MIN_RANGE ? null : m.markIn };
}

export const clearMarks = (m: SourceMarks): SourceMarks => ({ ...m, markIn: null, markOut: null });

/** The source range an insert / overwrite uses: the marks, else the whole asset. */
export function resolveRange(m: SourceMarks | null | undefined, assetDuration: number): { in: number; out: number } {
  const dur = Math.max(0, assetDuration);
  const inP = clamp(m?.markIn ?? 0, 0, dur);
  const outP = clamp(m?.markOut ?? dur, 0, dur);
  return outP - inP >= MIN_RANGE ? { in: inP, out: outP } : { in: 0, out: dur };
}
