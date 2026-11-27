/**
 * Storyboard timeline: the pure maths behind editing a frame's length on the
 * strip (drag its right edge, or use the keyboard). No DOM in here.
 */

export const MIN_FRAME_SECONDS = 1;
export const MAX_FRAME_SECONDS = 60;
/** Never draw the strip tighter than this (pixels per second). */
export const MIN_PX_PER_SECOND = 28;
/** A segment is never narrower than this, so a 1s frame stays readable and grabbable. */
export const MIN_SEGMENT_PX = 40;

/** Whole seconds, kept inside the supported range. Anything unusable becomes the minimum. */
export function clampSeconds(value) {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return MIN_FRAME_SECONDS;
  return Math.max(MIN_FRAME_SECONDS, Math.min(MAX_FRAME_SECONDS, n));
}

/**
 * The scale of the strip: pixels per second. Fills the available width when the
 * storyboard is short, and falls back to a fixed minimum (so the strip scrolls
 * sideways) when it is long.
 */
export function pxPerSecond(totalSeconds, availableWidth) {
  const total = Math.max(1, Number(totalSeconds) || 1);
  const width = Number(availableWidth) > 0 ? Number(availableWidth) : 600;
  return Math.max(MIN_PX_PER_SECOND, width / total);
}

/** Drawn width of a segment, in pixels. */
export function segmentWidth(seconds, pxPerSec) {
  return Math.max(MIN_SEGMENT_PX, clampSeconds(seconds) * pxPerSec);
}

/** A frame's new length after its right edge is dragged `dxPx` pixels. */
export function secondsAfterDrag(startSeconds, dxPx, pxPerSec) {
  if (!(pxPerSec > 0)) return clampSeconds(startSeconds);
  return clampSeconds(Number(startSeconds) + Number(dxPx) / pxPerSec);
}

/**
 * Keyboard editing of a length. Right/Up add a second (Shift adds five),
 * Left/Down take one away, Home/End jump to the limits.
 * @returns {number|null} the new length, or null when the key is not one we handle
 */
export function secondsAfterKey(current, key, { shift = false } = {}) {
  const step = shift ? 5 : 1;
  switch (key) {
    case 'ArrowRight':
    case 'ArrowUp':
      return clampSeconds(current + step);
    case 'ArrowLeft':
    case 'ArrowDown':
      return clampSeconds(current - step);
    case 'Home':
      return MIN_FRAME_SECONDS;
    case 'End':
      return MAX_FRAME_SECONDS;
    default:
      return null;
  }
}

/** Screen-reader text for a length. */
export const secondsLabel = (s) => `${s} ${s === 1 ? 'second' : 'seconds'}`;
