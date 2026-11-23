/**
 * Dragging the Studio captions on the live preview: how a drag or a key moves them. Pure; no React. Identical in remix-new-editor and
 * OpenHiggsBolt. A height is the centre of the caption block as a fraction of the frame height from the top (the Studio's `positionY`).
 */
export const MIN_Y = 0.04
export const MAX_Y = 0.96

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
const round3 = (v: number) => Math.round(v * 1000) / 1000

/** The height after dragging `dyPx` pixels down (negative = up) on a stage that is `stageHeightPx` high. */
export function yFromDrag(startY: number, dyPx: number, stageHeightPx: number): number {
  if (!(stageHeightPx > 0) || !Number.isFinite(dyPx)) return startY
  return round3(clamp(startY + dyPx / stageHeightPx, MIN_Y, MAX_Y))
}

/** The height after an arrow key: 1 % of the frame, or 5 % with Shift. Other keys change nothing. */
export function yFromKey(current: number, key: string, big: boolean): number | undefined {
  const step = big ? 0.05 : 0.01
  if (key === 'ArrowUp') return round3(clamp(current - step, MIN_Y, MAX_Y))
  if (key === 'ArrowDown') return round3(clamp(current + step, MIN_Y, MAX_Y))
  return undefined
}
