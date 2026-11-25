import { describe, expect, it } from 'vitest'
import { PLAYBACK_RATES, clampPlaybackRate } from '../playbackRate'

describe('playbackRate', () => {
  it('offers 0.75x, 1x, 1.25x and 1.5x', () => { expect([...PLAYBACK_RATES]).toEqual([0.75, 1, 1.25, 1.5]) })
  it('keeps a good rate and falls back to normal speed for a bad one', () => {
    expect(clampPlaybackRate(1.25)).toBe(1.25)
    for (const bad of [0, -1, NaN, Infinity, 'fast', undefined, null]) expect(clampPlaybackRate(bad), String(bad)).toBe(1)
  })
  it('keeps the rate within 0.25x to 2x', () => {
    expect(clampPlaybackRate(0.01)).toBe(0.25)
    expect(clampPlaybackRate(9)).toBe(2)
  })
})
