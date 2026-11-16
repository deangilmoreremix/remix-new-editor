import { describe, it, expect } from 'vitest'
import { MIN_SPAN_FRAMES, applyTimelineEdit, formatSeconds, fractionToFrame, frameToFraction, layerSpan, rulerTicks } from '../timeline'

const D = 150 // 5 s at 30 fps; last frame 149

describe('layerSpan', () => {
  it('is the frames a layer is shown, open-ended to the last frame', () => {
    expect(layerSpan({ startFrame: 0, endFrame: undefined }, D)).toEqual({ start: 0, end: 149 })
    expect(layerSpan({ startFrame: 30, endFrame: 90 }, D)).toEqual({ start: 30, end: 90 })
  })
  it('clamps out-of-range values into the video', () => {
    expect(layerSpan({ startFrame: -5, endFrame: 9999 }, D)).toEqual({ start: 0, end: 149 })
    expect(layerSpan({ startFrame: 400, endFrame: undefined }, D)).toEqual({ start: 149, end: 149 })
    expect(layerSpan({ startFrame: 60, endFrame: 10 }, D)).toEqual({ start: 60, end: 60 })
  })
})

describe('frame <-> fraction', () => {
  it('maps the first and last frame to 0 and 1 and round-trips', () => {
    expect(frameToFraction(0, D)).toBe(0)
    expect(frameToFraction(149, D)).toBe(1)
    for (const f of [0, 1, 37, 90, 149]) expect(fractionToFrame(frameToFraction(f, D), D)).toBe(f)
  })
  it('clamps and survives a one-frame video', () => {
    expect(fractionToFrame(-1, D)).toBe(0)
    expect(fractionToFrame(7, D)).toBe(149)
    expect(frameToFraction(5, 1)).toBe(0)
  })
})

describe('applyTimelineEdit', () => {
  it('moves a closed span, keeping its length and staying inside the video', () => {
    expect(applyTimelineEdit({ startFrame: 30, endFrame: 60 }, 'move', 15, D)).toEqual({ startFrame: 45, endFrame: 75 })
    expect(applyTimelineEdit({ startFrame: 30, endFrame: 60 }, 'move', -999, D)).toEqual({ startFrame: 0, endFrame: 30 })
    expect(applyTimelineEdit({ startFrame: 100, endFrame: 130 }, 'move', 999, D)).toEqual({ startFrame: 119, endFrame: 149 })
  })

  it('moves an open-ended layer by its start only, and keeps it open-ended', () => {
    const r = applyTimelineEdit({ startFrame: 10, endFrame: undefined }, 'move', 20, D)
    expect(r).toEqual({ startFrame: 30, endFrame: undefined })
    const far = applyTimelineEdit({ startFrame: 10, endFrame: undefined }, 'move', 9999, D)
    expect(far.startFrame).toBe(149 - (MIN_SPAN_FRAMES - 1))
    expect(far.endFrame).toBeUndefined()
  })

  it('trims the start but never below the minimum length', () => {
    expect(applyTimelineEdit({ startFrame: 30, endFrame: 90 }, 'start', 10, D)).toEqual({ startFrame: 40, endFrame: 90 })
    expect(applyTimelineEdit({ startFrame: 30, endFrame: 90 }, 'start', 999, D)).toEqual({ startFrame: 90 - (MIN_SPAN_FRAMES - 1), endFrame: 90 })
    expect(applyTimelineEdit({ startFrame: 30, endFrame: 90 }, 'start', -999, D).startFrame).toBe(0)
  })

  it('trims the end but never below the minimum length, and the last frame means open-ended again', () => {
    expect(applyTimelineEdit({ startFrame: 30, endFrame: 90 }, 'end', -10, D)).toEqual({ startFrame: 30, endFrame: 80 })
    expect(applyTimelineEdit({ startFrame: 30, endFrame: 90 }, 'end', -999, D)).toEqual({ startFrame: 30, endFrame: 30 + (MIN_SPAN_FRAMES - 1) })
    expect(applyTimelineEdit({ startFrame: 30, endFrame: 90 }, 'end', 999, D)).toEqual({ startFrame: 30, endFrame: undefined })
  })

  it('trimming the end of an open-ended layer starts from the last frame', () => {
    expect(applyTimelineEdit({ startFrame: 20, endFrame: undefined }, 'end', -30, D)).toEqual({ startFrame: 20, endFrame: 119 })
  })

  it('a zero move changes nothing', () => {
    expect(applyTimelineEdit({ startFrame: 30, endFrame: 90 }, 'move', 0, D)).toEqual({ startFrame: 30, endFrame: 90 })
  })

  it('never produces a span shorter than the minimum, whatever the drag', () => {
    for (const edit of ['move', 'start', 'end'] as const) {
      for (const delta of [-500, -37, -1, 0, 1, 37, 500]) {
        const r = applyTimelineEdit({ startFrame: 50, endFrame: 60 }, edit, delta, D)
        const span = layerSpan(r, D)
        expect(span.end - span.start).toBeGreaterThanOrEqual(MIN_SPAN_FRAMES - 1)
        expect(span.start).toBeGreaterThanOrEqual(0)
        expect(span.end).toBeLessThanOrEqual(149)
      }
    }
  })
})

describe('labels and ruler', () => {
  it('formats seconds and lays ticks every whole second', () => {
    expect(formatSeconds(45, 30)).toBe('1.5 s')
    expect(rulerTicks(150, 30)).toEqual([0, 30, 60, 90, 120])
    expect(rulerTicks(1, 30)).toEqual([0])
  })
})
