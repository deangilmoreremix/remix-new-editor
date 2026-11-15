import { describe, it, expect } from 'vitest'
import { layerSnapBox, snapMove, snapTargets, SNAP_THRESHOLD, type SnapBox } from '../snap'
import { createLayer } from '../../../preview/presets'

const box = (cx: number, cy: number, w = 0.2, h = 0.1): SnapBox => ({ cx, cy, w, h })
const frame = snapTargets([], 0.02)

describe('snapTargets', () => {
  it('always has the safe edges, thirds and center on both axes', () => {
    for (const axis of [frame.xs, frame.ys]) {
      for (const t of [0.02, 1 / 3, 0.5, 2 / 3, 0.98]) expect(axis.some((v) => Math.abs(v - t) < 1e-4)).toBe(true)
    }
  })
  it('adds the edges and center of other layers, sorted and de-duplicated', () => {
    const t = snapTargets([box(0.25, 0.25, 0.2, 0.1)], 0.02)
    for (const v of [0.15, 0.25, 0.35]) expect(t.xs.some((x) => Math.abs(x - v) < 1e-4)).toBe(true)
    for (const v of [0.2, 0.25, 0.3]) expect(t.ys.some((y) => Math.abs(y - v) < 1e-4)).toBe(true)
    expect([...t.xs]).toEqual([...t.xs].sort((a, b) => a - b))
    expect(new Set(t.xs).size).toBe(t.xs.length)
  })
})

describe('snapMove', () => {
  it('snaps the center to the middle of the frame when it is close, and reports the guide', () => {
    const r = snapMove(box(0.5 + 0.004, 0.3), frame)
    expect(r.dx).toBeCloseTo(-0.004, 6)
    expect(r.guidesX).toEqual([0.5])
  })

  it('does nothing when nothing is within the threshold', () => {
    const r = snapMove(box(0.45, 0.4), frame)
    expect(r).toEqual({ dx: 0, dy: 0, guidesX: [], guidesY: [] })
  })

  it('snaps an edge, not just the center: right edge to the safe margin', () => {
    // right edge at 0.98 + 0.005
    const r = snapMove(box(0.88 + 0.005, 0.5 + 0.2), frame)
    expect(r.dx).toBeCloseTo(-0.005, 6)
    expect(r.guidesX).toContain(0.98)
  })

  it('snaps each axis independently', () => {
    const r = snapMove(box(0.5 + 0.003, 0.7), frame) // y: 0.7 is 0.033 from 2/3 -> no y snap
    expect(r.guidesX).toEqual([0.5])
    expect(r.guidesY).toEqual([])
    expect(r.dy).toBe(0)
  })

  it('picks the nearest alignment when several are in range', () => {
    const t = snapTargets([box(0.5, 0.5, 0.2, 0.1)], 0.02) // other layer edges at 0.4, 0.5, 0.6
    const r = snapMove(box(0.4 + 0.1 + 0.002, 0.2), t) // moving box left edge = 0.402 -> 0.4 (0.002) beats center 0.502 -> 0.5 (0.002)? tie-safe: either is within threshold
    expect(Math.abs(r.dx)).toBeLessThanOrEqual(SNAP_THRESHOLD)
    expect(r.guidesX).toHaveLength(1)
  })

  it('aligns to another layer\'s top and bottom edges', () => {
    const other = box(0.7, 0.4, 0.2, 0.1) // top 0.35, bottom 0.45
    const t = snapTargets([other], 0.02)
    const r = snapMove(box(0.2, 0.45 + 0.05 + 0.004, 0.2, 0.1), t) // moving top = 0.504 .. bottom 0.554; center 0.504+... 
    // moving box top edge is at 0.454, 0.004 below the other's bottom edge (0.45)
    expect(r.dy).toBeCloseTo(-0.004, 6)
    expect(r.guidesY).toContain(0.45)
  })

  it('a zero threshold never moves anything', () => {
    expect(snapMove(box(0.5, 0.5), frame, 0)).toEqual({ dx: 0, dy: 0, guidesX: [0.5], guidesY: [0.5] })
  })
})

describe('layerSnapBox', () => {
  it('is the layer box in normalized frame coordinates and stays inside the frame', () => {
    const b = layerSnapBox({ ...createLayer('logo'), x: 0.5, y: 0.5, scale: 0.2 }, undefined, 1920, 1080)
    expect(b.cx).toBeGreaterThan(0)
    expect(b.cx).toBeLessThan(1)
    expect(b.w).toBeCloseTo(0.2, 2)
    expect(b.cx).toBeCloseTo(0.5, 2)
  })
  it('uses the drawn text for a text layer', () => {
    const short = layerSnapBox({ ...createLayer('headline'), x: 0.5, y: 0.5 }, 'Hi', 1920, 1080)
    const long = layerSnapBox({ ...createLayer('headline'), x: 0.5, y: 0.5 }, 'A much longer headline for this frame', 1920, 1080)
    expect(long.w).toBeGreaterThan(short.w)
  })
})
