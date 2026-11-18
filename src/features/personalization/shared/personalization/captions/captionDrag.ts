/**
 * Dragging the captions on the live preview: where the grip sits for a caption place, and how a drag or a key moves the caption. Pure; no React.
 * Identical in remix-new-editor and OpenHiggsBolt. Offsets are fractions of the frame height (positive = up), the same as the customizer's.
 */
import { MAX_CAPTION_OFFSET } from './captionCustom'

export type DragPosition = 'top' | 'middle' | 'bottom'

/** Roughly where the caption line sits for each place, as a fraction of the frame height from the top. */
const BASE_Y: Readonly<Record<DragPosition, number>> = { top: 0.12, middle: 0.5, bottom: 0.88 }

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
const round3 = (v: number) => Math.round(v * 1000) / 1000

/** Where the grip is drawn (fraction from the top), kept on the frame. */
export const gripY = (position: DragPosition, offsetY: number | undefined): number => clamp(BASE_Y[position] - (offsetY ?? 0), 0.04, 0.96)

/** The offset after dragging `dyPx` pixels down (negative = up) on a stage that is `stageHeightPx` high. */
export function offsetFromDrag(startOffset: number | undefined, dyPx: number, stageHeightPx: number): number {
  const start = startOffset ?? 0
  if (!(stageHeightPx > 0) || !Number.isFinite(dyPx)) return start
  return round3(clamp(start - dyPx / stageHeightPx, -MAX_CAPTION_OFFSET, MAX_CAPTION_OFFSET))
}

/** The offset after an arrow key: 1 % of the frame, or 5 % with Shift. Other keys change nothing. */
export function offsetFromKey(current: number | undefined, key: string, big: boolean): number | undefined {
  const step = big ? 0.05 : 0.01
  const start = current ?? 0
  if (key === 'ArrowUp') return round3(clamp(start + step, -MAX_CAPTION_OFFSET, MAX_CAPTION_OFFSET))
  if (key === 'ArrowDown') return round3(clamp(start - step, -MAX_CAPTION_OFFSET, MAX_CAPTION_OFFSET))
  return undefined
}
