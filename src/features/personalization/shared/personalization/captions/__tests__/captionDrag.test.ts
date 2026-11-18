import { describe, expect, it } from 'vitest'
import { gripY, offsetFromDrag, offsetFromKey } from '../captionDrag'

describe('captionDrag', () => {
  it('puts the grip near the caption for each place, and moves it with the offset', () => {
    expect(gripY('bottom', undefined)).toBeCloseTo(0.88, 5)
    expect(gripY('middle', 0)).toBe(0.5)
    expect(gripY('top', undefined)).toBeCloseTo(0.12, 5)
    expect(gripY('bottom', 0.2)).toBeCloseTo(0.68, 5)
    expect(gripY('bottom', -0.2)).toBe(0.96) // kept on the frame
  })
  it('turns a drag into an offset: up is positive, a whole frame height is clamped to 0.4', () => {
    expect(offsetFromDrag(undefined, -108, 1080)).toBe(0.1)
    expect(offsetFromDrag(0.1, 54, 1080)).toBe(0.05)
    expect(offsetFromDrag(0, -2000, 1080)).toBe(0.4)
    expect(offsetFromDrag(0, 2000, 1080)).toBe(-0.4)
  })
  it('ignores a drag it cannot measure', () => {
    expect(offsetFromDrag(0.1, 50, 0)).toBe(0.1)
    expect(offsetFromDrag(undefined, NaN, 1080)).toBe(0)
  })
  it('moves one percent per arrow key, five with Shift, within 0.4, and ignores other keys', () => {
    expect(offsetFromKey(undefined, 'ArrowUp', false)).toBe(0.01)
    expect(offsetFromKey(0.1, 'ArrowDown', true)).toBe(0.05)
    expect(offsetFromKey(0.39, 'ArrowUp', true)).toBe(0.4)
    expect(offsetFromKey(0.1, 'Enter', false)).toBeUndefined()
  })
})
