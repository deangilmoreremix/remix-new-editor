import { describe, it, expect } from 'vitest'
import {
  HANDLES, anchorPoint, cursorForHandle, handleById, handlePoint, resizeFromHandle, rotateVec, rotationFromPointer, snapAngle,
  type HandleId, type TransformBox,
} from '../transform'

const close = (a: number, b: number, d = 6) => expect(a).toBeCloseTo(b, d)
const box = (over: Partial<TransformBox> = {}): TransformBox => ({ cx: 500, cy: 300, w: 200, h: 100, rotation: 0, ...over })

describe('HANDLES', () => {
  it('are eight: four corners and four edges, each with an opposite', () => {
    expect(HANDLES).toHaveLength(8)
    expect(HANDLES.filter((h) => h.kind === 'corner')).toHaveLength(4)
    expect(HANDLES.filter((h) => h.kind === 'edge')).toHaveLength(4)
    expect(new Set(HANDLES.map((h) => h.id)).size).toBe(8)
    for (const h of HANDLES) {
      const opp = HANDLES.find((o) => o.hx === -h.hx && o.hy === -h.hy)
      expect(opp, `opposite of ${h.id}`).toBeTruthy()
    }
  })
  it('sit on the box edge where their direction says', () => {
    expect(handleById('nw')).toMatchObject({ left: 0, top: 0 })
    expect(handleById('se')).toMatchObject({ left: 100, top: 100 })
    expect(handleById('n')).toMatchObject({ left: 50, top: 0 })
    expect(handleById('w')).toMatchObject({ left: 0, top: 50 })
  })
})

describe('handlePoint / anchorPoint', () => {
  it('unrotated: corners are at the box corners and the anchor is the opposite one', () => {
    const b = box()
    expect(handlePoint(b, 'se')).toEqual({ x: 600, y: 350 })
    expect(handlePoint(b, 'nw')).toEqual({ x: 400, y: 250 })
    expect(anchorPoint(b, 'se')).toEqual({ x: 400, y: 250 })
    expect(anchorPoint(b, 'e')).toEqual({ x: 400, y: 300 })
    expect(anchorPoint(b, 'n')).toEqual({ x: 500, y: 350 })
  })
  it('rotated 90 degrees: the right-edge handle ends up below the center', () => {
    const p = handlePoint(box({ rotation: 90 }), 'e')
    close(p.x, 500)
    close(p.y, 400)
  })
  it('a handle and its anchor are mirror images about the center', () => {
    for (const rot of [0, 33, -120]) {
      for (const h of HANDLES) {
        const b = box({ rotation: rot })
        const p = handlePoint(b, h.id)
        const a = anchorPoint(b, h.id)
        close((p.x + a.x) / 2, b.cx)
        close((p.y + a.y) / 2, b.cy)
      }
    }
  })
})

describe('resizeFromHandle', () => {
  it('dragging a handle onto its own position changes nothing', () => {
    for (const rot of [0, 25, -70, 180]) {
      for (const h of HANDLES) {
        const b = box({ rotation: rot })
        const r = resizeFromHandle(b, h.id, handlePoint(b, h.id))
        close(r.factor, 1)
        close(r.cx, b.cx)
        close(r.cy, b.cy)
      }
    }
  })

  it('a corner drag scales along the diagonal and keeps the opposite corner fixed', () => {
    const b = box() // se corner at (600,350), anchor (400,250)
    const r = resizeFromHandle(b, 'se', { x: 800, y: 450 }) // twice as far from the anchor along the diagonal
    close(r.factor, 2)
    const after: TransformBox = { ...b, cx: r.cx, cy: r.cy, w: b.w * r.factor, h: b.h * r.factor }
    expect(anchorPoint(after, 'se').x).toBeCloseTo(400, 6)
    expect(anchorPoint(after, 'se').y).toBeCloseTo(250, 6)
  })

  it('keeps the anchor fixed for every handle and rotation, whatever the factor', () => {
    for (const rot of [0, 30, -45, 90, 150]) {
      for (const h of HANDLES) {
        const b = box({ rotation: rot })
        const anchor = anchorPoint(b, h.id)
        const target = { x: handlePoint(b, h.id).x + 37, y: handlePoint(b, h.id).y - 21 }
        const r = resizeFromHandle(b, h.id, target)
        const after: TransformBox = { ...b, cx: r.cx, cy: r.cy, w: b.w * r.factor, h: b.h * r.factor }
        const a2 = anchorPoint(after, h.id)
        close(a2.x, anchor.x, 4)
        close(a2.y, anchor.y, 4)
      }
    }
  })

  it('an edge handle scales along its axis only, so dragging it sideways does nothing', () => {
    const b = box()
    const along = resizeFromHandle(b, 'e', { x: 700, y: 300 }) // anchor x=400, handle at 600 -> 700 = factor 1.5
    close(along.factor, 1.5)
    const sideways = resizeFromHandle(b, 'e', { x: 600, y: 900 })
    close(sideways.factor, 1)
  })

  it('works in the rotated frame: a 90 degree box resizes along the screen vertical', () => {
    const b = box({ rotation: 90 }) // right edge handle now points down
    const r = resizeFromHandle(b, 'e', { x: 500, y: 500 }) // anchor y=200, handle at y=400 -> 500: (500-200)/200
    close(r.factor, 1.5)
  })

  it('limits the factor and never returns zero, negative or non-finite values', () => {
    const b = box()
    expect(resizeFromHandle(b, 'se', { x: 9999, y: 9999 }, { maxFactor: 3 }).factor).toBe(3)
    expect(resizeFromHandle(b, 'se', { x: 400, y: 250 }, { minFactor: 0.25 }).factor).toBe(0.25) // dragged onto the anchor
    expect(resizeFromHandle(b, 'se', { x: -9999, y: -9999 }, { minFactor: 0.1 }).factor).toBe(0.1) // dragged past it
    const bad = resizeFromHandle(b, 'se', { x: NaN, y: 0 })
    expect(Number.isFinite(bad.factor)).toBe(true)
    expect(bad.factor).toBeGreaterThan(0)
  })

  it('a zero-size box cannot be resized and returns a neutral result', () => {
    const r = resizeFromHandle(box({ w: 0, h: 0 }), 'se', { x: 700, y: 400 })
    expect(r.factor).toBe(1)
  })
})

describe('rotationFromPointer', () => {
  const c = { x: 100, y: 100 }
  it('pointing straight up is no rotation, right is 90, down is 180, left is -90', () => {
    close(rotationFromPointer(c, { x: 100, y: 0 }), 0)
    close(rotationFromPointer(c, { x: 200, y: 100 }), 90)
    close(rotationFromPointer(c, { x: 100, y: 200 }), 180)
    close(rotationFromPointer(c, { x: 0, y: 100 }), -90)
  })
  it('points the top handle at the pointer: the result rotates the handle onto the pointer direction', () => {
    const b: TransformBox = { cx: 100, cy: 100, w: 80, h: 40, rotation: 0 }
    for (const p of [{ x: 190, y: 40 }, { x: 30, y: 20 }, { x: 150, y: 190 }]) {
      const rot = rotationFromPointer(c, p)
      const dir = rotateVec({ x: 0, y: -1 }, rot) // where the top handle points after rotating
      const want = { x: p.x - c.x, y: p.y - c.y }
      const len = Math.hypot(want.x, want.y)
      // the angle is rounded to 0.1 degree, so compare to 2 decimals
      close(dir.x, want.x / len, 2)
      close(dir.y, want.y / len, 2)
      expect(b.rotation).toBe(0)
    }
  })
  it('snaps to multiples of 15 degrees with the snap option', () => {
    // about 20 degrees right of straight up
    const p = { x: 100 + Math.sin((20 * Math.PI) / 180) * 50, y: 100 - Math.cos((20 * Math.PI) / 180) * 50 }
    expect(Math.round(rotationFromPointer(c, p))).toBe(20)
    expect(rotationFromPointer(c, p, { snap: true })).toBe(15)
    expect(snapAngle(22.6)).toBe(30)
    expect(snapAngle(-7.4)).toBe(0)
  })
  it('returns a normalized angle and keeps the current one when the pointer is on the center', () => {
    for (let i = 0; i < 24; i++) {
      const a = (i * 15 * Math.PI) / 180
      const r = rotationFromPointer(c, { x: 100 + Math.cos(a) * 30, y: 100 + Math.sin(a) * 30 })
      expect(r).toBeGreaterThan(-180)
      expect(r).toBeLessThanOrEqual(180)
    }
    expect(rotationFromPointer(c, c, { current: 42 })).toBe(42)
  })
})

describe('cursorForHandle', () => {
  it('uses the usual resize cursors when not rotated', () => {
    const expected: Record<HandleId, string> = { nw: 'nwse-resize', se: 'nwse-resize', ne: 'nesw-resize', sw: 'nesw-resize', n: 'ns-resize', s: 'ns-resize', e: 'ew-resize', w: 'ew-resize' }
    for (const h of HANDLES) expect(cursorForHandle(h.id, 0)).toBe(expected[h.id])
  })
  it('turns with the box: at 90 degrees an edge cursor swaps axis, at 45 a corner cursor swaps diagonal', () => {
    expect(cursorForHandle('e', 90)).toBe('ns-resize')
    expect(cursorForHandle('n', 90)).toBe('ew-resize')
    expect(cursorForHandle('se', 90)).toBe('nesw-resize')
    expect(cursorForHandle('e', 45)).toBe('nwse-resize')
  })
})
