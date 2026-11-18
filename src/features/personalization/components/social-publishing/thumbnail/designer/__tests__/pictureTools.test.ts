import { describe, it, expect } from 'vitest'
import { applyMaskAlpha, autoEnhancePixels, sharpenPixels, AI_TOOL_IDS, FREE_TOOLS, aiToolLabel, type Pixels } from '../pictureTools'

const solid = (w: number, h: number, rgba: [number, number, number, number]): Pixels => {
  const data = new Uint8ClampedArray(w * h * 4)
  for (let i = 0; i < w * h; i++) data.set(rgba, i * 4)
  return { data, width: w, height: h }
}

describe('free picture tools (no API)', () => {
  it('offers cut out a person, auto-enhance and sharpen', () => {
    expect(FREE_TOOLS.map((t) => t.id)).toEqual(['cutout_person', 'enhance', 'sharpen'])
  })

  it('sharpen keeps a flat area flat and boosts an edge, leaving alpha alone', () => {
    const flat = sharpenPixels(solid(5, 5, [100, 100, 100, 255]))
    expect(Array.from(flat.data.slice(0, 4))).toEqual([100, 100, 100, 255])
    const p = solid(5, 5, [50, 50, 50, 200])
    // a bright centre pixel on a dark field gets brighter
    p.data.set([120, 120, 120, 200], (2 * 5 + 2) * 4)
    const out = sharpenPixels(p, 1)
    expect(out.data[(2 * 5 + 2) * 4]).toBeGreaterThan(120)
    for (let i = 3; i < out.data.length; i += 4) expect(out.data[i]).toBe(200)
  })

  it('auto-enhance stretches a dull picture and never touches alpha', () => {
    const w = 10
    const p = solid(w, 1, [100, 100, 100, 255])
    for (let x = 0; x < w; x++) p.data.set([100 + x * 5, 100 + x * 5, 100 + x * 5, 255], x * 4)
    const out = autoEnhancePixels(p)
    expect(out.data[0]).toBeLessThan(p.data[0] + 1)
    expect(out.data[(w - 1) * 4]).toBeGreaterThan(p.data[(w - 1) * 4])
    expect(out.data[3]).toBe(255)
  })

  it('cut-out uses the presenter mask as the picture alpha', () => {
    const p = solid(4, 4, [200, 10, 10, 255])
    const mask = { w: 2, h: 1, data: new Uint8ClampedArray([255, 0]) } // left kept, right removed
    const out = applyMaskAlpha(p, mask)
    expect(out.data[3]).toBe(255) // left edge
    expect(out.data[(3) * 4 + 3]).toBe(0) // right edge
  })
})

describe('optional AI tools', () => {
  it('lists the editor operations that suit a thumbnail, each with a label', () => {
    for (const id of ['replace_background', 'remove_object', 'enhance', 'relight', 'sharpen', 'restore', 'logo_transparent'] as const) {
      expect(AI_TOOL_IDS).toContain(id)
      expect(aiToolLabel(id)).toBeTruthy()
    }
  })
})
