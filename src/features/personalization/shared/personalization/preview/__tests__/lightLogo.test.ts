import { describe, it, expect } from 'vitest'
import { analyzeImagePixels } from '../imagePixels'

/** RGBA canvas: `bg` everywhere, a centred block of `fg`. alpha 0 = transparent. */
function image(w: number, h: number, bg: [number, number, number, number], fg: [number, number, number, number]) {
  const d = new Uint8ClampedArray(w * h * 4)
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const inBlock = x > w * 0.25 && x < w * 0.75 && y > h * 0.3 && y < h * 0.7
    const c = inBlock ? fg : bg
    d.set(c, (y * w + x) * 4)
  }
  return d
}

describe('lightLogo (a white / pale cut-out logo vanishes on a white tile)', () => {
  it('flags a white wordmark on transparency', () => {
    expect(analyzeImagePixels(image(64, 32, [0, 0, 0, 0], [255, 255, 255, 255]), 64, 32).lightLogo).toBe(true)
  })
  it('does not flag a dark or coloured wordmark on transparency', () => {
    expect(analyzeImagePixels(image(64, 32, [0, 0, 0, 0], [20, 30, 60, 255]), 64, 32).lightLogo).toBe(false)
    expect(analyzeImagePixels(image(64, 32, [0, 0, 0, 0], [216, 27, 96, 255]), 64, 32).lightLogo).toBe(false)
  })
  it('never flags an opaque picture (its white background would dominate)', () => {
    expect(analyzeImagePixels(image(64, 32, [255, 255, 255, 255], [20, 30, 60, 255]), 64, 32).lightLogo).toBe(false)
  })
  it('is false for an image too small to analyse', () => {
    expect(analyzeImagePixels(new Uint8ClampedArray(4), 1, 1).lightLogo).toBe(false)
  })
})

import { normalizeImageHints } from '../presets'

describe('lightLogo survives save / restore', () => {
  it('is kept by normalizeImageHints, and only when true', () => {
    const out = normalizeImageHints({ 'https://x.com/l.png': { aspect: 2, lightLogo: true }, 'https://x.com/m.png': { aspect: 2, lightLogo: 'yes' } })
    expect(out?.['https://x.com/l.png']?.lightLogo).toBe(true)
    expect(out?.['https://x.com/m.png']?.lightLogo).toBeUndefined()
  })
})
