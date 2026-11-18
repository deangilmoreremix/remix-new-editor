import { describe, it, expect } from 'vitest'
import { entranceFor, exitFor, itemEntrance, usesWordEntrance, wordEntrance } from '../motion'
import { EXIT_FRAMES } from '../imageStyle'
import { createLayer } from '../presets'
import type { PreviewLayer } from '../types'

const FPS = 30
const layer = (over: Partial<PreviewLayer> = {}): PreviewLayer => ({ ...createLayer('headline'), startFrame: 0, animationDelay: 0, ...over })

describe('entranceFor', () => {
  it('is invisible before its start and fully in after settling', () => {
    for (const animation of ['fade', 'slide-up', 'slide-down', 'slide-left', 'lower-third'] as const) {
      const l = layer({ animation, startFrame: 10 })
      expect(entranceFor(l, 5, FPS).opacity).toBe(0)
      const done = entranceFor(l, 10 + 60, FPS)
      expect(done.opacity).toBeCloseTo(1, 2)
      expect(Math.abs(done.translateX) + Math.abs(done.translateY)).toBeLessThan(0.5)
    }
  })

  it('slides up from below and settles monotonically toward rest', () => {
    const l = layer({ animation: 'slide-up' })
    let prev = Infinity
    for (let f = 0; f <= 30; f += 2) {
      const y = entranceFor(l, f, FPS).translateY
      expect(y).toBeLessThanOrEqual(prev + 1e-6)
      expect(y).toBeGreaterThanOrEqual(0)
      prev = y
    }
  })

  it('opacity never exceeds 1 or drops below 0', () => {
    for (const animation of ['fade', 'slide-up', 'pop', 'logo-reveal', 'cta-pulse', 'lower-third', 'none'] as const) {
      for (let f = 0; f < 90; f += 3) {
        const o = entranceFor(layer({ animation }), f, FPS).opacity
        expect(o).toBeGreaterThanOrEqual(0)
        expect(o).toBeLessThanOrEqual(1)
      }
    }
  })

  it('honours the animation delay', () => {
    const l = layer({ animation: 'fade', startFrame: 0, animationDelay: 20 })
    expect(entranceFor(l, 15, FPS).opacity).toBe(0)
    expect(entranceFor(l, 20 + 40, FPS).opacity).toBeCloseTo(1, 2)
  })

  it("'none' is always fully visible", () => {
    expect(entranceFor(layer({ animation: 'none' }), 0, FPS)).toEqual({ opacity: 1, scale: 1, translateX: 0, translateY: 0 })
  })
})

describe('wordEntrance', () => {
  const size = 60
  it('staggers words: later words start later', () => {
    const a = wordEntrance(0, 5, 6, 0, FPS, size)
    const b = wordEntrance(4, 5, 6, 0, FPS, size)
    expect(a.opacity).toBeGreaterThan(b.opacity)
  })

  it('a word has not started before its turn and is fully in well after it', () => {
    expect(wordEntrance(3, 4, 2, 0, FPS, size)).toEqual({ opacity: 0, translateY: size * 0.45 })
    const done = wordEntrance(3, 4, 90, 0, FPS, size)
    expect(done.opacity).toBe(1)
    expect(done.translateY).toBeCloseTo(0, 1)
  })

  it('a long line still finishes inside the stagger budget plus the spring settle time', () => {
    // 30 words must not take 30 * 3 frames to start: the last word starts by frame 18
    const last = wordEntrance(29, 30, 18 + 1, 0, FPS, size)
    expect(last.opacity).toBeGreaterThan(0)
  })

  it('is safe for an empty line and bad indexes', () => {
    expect(Number.isFinite(wordEntrance(0, 0, 5, 0, FPS, size).opacity)).toBe(true)
    expect(Number.isFinite(wordEntrance(-3, 2, 5, 0, FPS, size).opacity)).toBe(true)
  })
})

describe('usesWordEntrance', () => {
  it('applies to headlines and names that slide up or fade, nothing else', () => {
    expect(usesWordEntrance(layer({ animation: 'slide-up' }))).toBe(true)
    expect(usesWordEntrance(layer({ animation: 'fade' }))).toBe(true)
    expect(usesWordEntrance({ ...createLayer('businessName'), animation: 'slide-up' })).toBe(true)
    expect(usesWordEntrance(layer({ animation: 'pop' }))).toBe(false)
    expect(usesWordEntrance(layer({ animation: 'lower-third' }))).toBe(false)
    expect(usesWordEntrance({ ...createLayer('tagline'), animation: 'fade' })).toBe(false)
    expect(usesWordEntrance({ ...createLayer('cta'), animation: 'fade' })).toBe(false)
  })
})

describe('exitFor', () => {
  it('never exits a layer with no end frame', () => {
    expect(exitFor({ endFrame: undefined }, 9999)).toEqual({ opacity: 1, translateY: 0 })
  })

  it('is untouched until the exit window, then fades and lifts to gone at the end frame', () => {
    const end = 100
    expect(exitFor({ endFrame: end }, end - EXIT_FRAMES - 5)).toEqual({ opacity: 1, translateY: -0 })
    const mid = exitFor({ endFrame: end }, end - EXIT_FRAMES / 2)
    expect(mid.opacity).toBeCloseTo(0.5, 5)
    expect(mid.translateY).toBeLessThan(0)
    expect(exitFor({ endFrame: end }, end).opacity).toBe(0)
  })

  it('opacity only ever decreases through the window', () => {
    let prev = 1
    for (let f = 90; f <= 100; f++) {
      const o = exitFor({ endFrame: 100 }, f).opacity
      expect(o).toBeLessThanOrEqual(prev)
      prev = o
    }
  })
})

describe('itemEntrance', () => {
  it('reveals items one after another and settles to rest', () => {
    const a = itemEntrance(0, 8, FPS, 30)
    const d = itemEntrance(3, 8, FPS, 30)
    expect(a.opacity).toBeGreaterThan(d.opacity)
    expect(itemEntrance(3, 5, FPS, 30)).toEqual({ opacity: 0, translateY: 30 })
    const done = itemEntrance(3, 120, FPS, 30)
    expect(done.opacity).toBe(1)
    expect(done.translateY).toBeCloseTo(0, 1)
  })
})
