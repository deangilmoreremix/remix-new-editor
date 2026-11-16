/**
 * Timeline math: when a layer is on screen. A layer is shown from `startFrame` until `endFrame` inclusive, and until
 * the last frame when it has no `endFrame` (an open-ended layer stays up under the end card). All pure and in frames,
 * so dragging, trimming and keyboard nudges are unit-tested and the UI only converts pixels to frames.
 */
import type { PreviewLayer } from '../../preview/types'

/** Shortest a bar may get, in frames, so a layer can never be trimmed to nothing. */
export const MIN_SPAN_FRAMES = 3

export type TimelineEdit = 'move' | 'start' | 'end'

export interface Span { start: number; end: number }

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
const lastFrame = (duration: number) => Math.max(0, Math.round(duration) - 1)

/** The frames a layer is shown, clamped into the video. */
export function layerSpan(layer: Pick<PreviewLayer, 'startFrame' | 'endFrame'>, durationInFrames: number): Span {
  const last = lastFrame(durationInFrames)
  const start = clamp(Math.round(layer.startFrame || 0), 0, last)
  const end = layer.endFrame === undefined ? last : clamp(Math.round(layer.endFrame), start, last)
  return { start, end }
}

export const frameToFraction = (frame: number, durationInFrames: number): number =>
  durationInFrames <= 1 ? 0 : clamp(frame / (durationInFrames - 1), 0, 1)

export const fractionToFrame = (fraction: number, durationInFrames: number): number =>
  Math.round(clamp(fraction, 0, 1) * lastFrame(durationInFrames))

/**
 * The layer patch for dragging one part of its bar by `deltaFrames`.
 *  - move  shifts the whole span, keeping its length (an open-ended layer stays open-ended)
 *  - start trims the left edge (never past the end minus the minimum length)
 *  - end   trims the right edge; dragging it to the last frame makes the layer open-ended again
 */
export function applyTimelineEdit(
  layer: Pick<PreviewLayer, 'startFrame' | 'endFrame'>,
  edit: TimelineEdit,
  deltaFrames: number,
  durationInFrames: number,
): Pick<PreviewLayer, 'startFrame'> & { endFrame: number | undefined } {
  const last = lastFrame(durationInFrames)
  const { start, end } = layerSpan(layer, durationInFrames)
  const d = Math.round(deltaFrames)
  const open = layer.endFrame === undefined

  if (edit === 'move') {
    const length = end - start
    const nextStart = clamp(start + d, 0, Math.max(0, last - (open ? MIN_SPAN_FRAMES - 1 : length)))
    return { startFrame: nextStart, endFrame: open ? undefined : nextStart + length }
  }
  if (edit === 'start') {
    const nextStart = clamp(start + d, 0, Math.max(0, end - (MIN_SPAN_FRAMES - 1)))
    return { startFrame: nextStart, endFrame: open ? undefined : end }
  }
  const nextEnd = clamp(end + d, Math.min(last, start + (MIN_SPAN_FRAMES - 1)), last)
  return { startFrame: start, endFrame: nextEnd >= last ? undefined : nextEnd }
}

/** Seconds for a label, one decimal ("1.5 s"). */
export const formatSeconds = (frame: number, fps: number): string => `${(frame / Math.max(1, fps)).toFixed(1)} s`

/** Whole-second ruler ticks as frames (0, fps, 2*fps … up to the last frame). */
export function rulerTicks(durationInFrames: number, fps: number): number[] {
  const ticks: number[] = []
  const step = Math.max(1, Math.round(fps))
  for (let f = 0; f <= lastFrame(durationInFrames); f += step) ticks.push(f)
  return ticks
}
