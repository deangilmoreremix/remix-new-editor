import { describe, expect, it } from 'vitest'
import { MIN_Y, MAX_Y, yFromDrag, yFromKey } from '../captionDrag'

describe('captionDrag (Studio captions: the height is a fraction of the frame, from the top)', () => {
  it('turns a drag into a height: down is larger, clamped to the frame', () => {
    expect(yFromDrag(0.5, 108, 1080)).toBeCloseTo(0.6, 5)
    expect(yFromDrag(0.5, -108, 1080)).toBeCloseTo(0.4, 5)
    expect(yFromDrag(0.5, 5000, 1080)).toBe(MAX_Y)
    expect(yFromDrag(0.5, -5000, 1080)).toBe(MIN_Y)
  })
  it('ignores a drag it cannot measure', () => {
    expect(yFromDrag(0.5, 50, 0)).toBe(0.5)
    expect(yFromDrag(0.5, NaN, 1080)).toBe(0.5)
  })
  it('moves one percent per arrow key (up is smaller), five with Shift, and ignores other keys', () => {
    expect(yFromKey(0.5, 'ArrowUp', false)).toBeCloseTo(0.49, 5)
    expect(yFromKey(0.5, 'ArrowDown', true)).toBeCloseTo(0.55, 5)
    expect(yFromKey(MIN_Y, 'ArrowUp', true)).toBe(MIN_Y)
    expect(yFromKey(0.5, 'Enter', false)).toBeUndefined()
  })
})
