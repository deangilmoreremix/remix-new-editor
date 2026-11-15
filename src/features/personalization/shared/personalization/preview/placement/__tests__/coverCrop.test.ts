import { describe, it, expect } from 'vitest'
import { coverCropRect } from '..'

/** The footage is shown with objectFit: 'cover', so contrast must be sampled on the cropped region. */
describe('coverCropRect', () => {
  it('crops the sides of a landscape clip shown in a portrait frame, centered', () => {
    const r = coverCropRect(1920, 1080, 1080, 1920)
    expect(r.sy).toBe(0)
    expect(r.sh).toBe(1080)
    expect(r.sw).toBeCloseTo(1080 * (1080 / 1920), 5)
    expect(r.sx).toBeCloseTo((1920 - r.sw) / 2, 5)
  })

  it('crops top and bottom of a portrait clip shown in a landscape frame, centered', () => {
    const r = coverCropRect(1080, 1920, 1920, 1080)
    expect(r.sx).toBe(0)
    expect(r.sw).toBe(1080)
    expect(r.sh).toBeCloseTo(1080 * (1080 / 1920), 5)
    expect(r.sy).toBeCloseTo((1920 - r.sh) / 2, 5)
  })

  it('uses the whole clip when the shapes match', () => {
    expect(coverCropRect(1280, 720, 1920, 1080)).toEqual({ sx: 0, sy: 0, sw: 1280, sh: 720 })
  })

  it('falls back to the whole source when a size is unknown', () => {
    expect(coverCropRect(0, 0, 1080, 1920)).toEqual({ sx: 0, sy: 0, sw: 0, sh: 0 })
    expect(coverCropRect(640, 360, 0, 0)).toEqual({ sx: 0, sy: 0, sw: 640, sh: 360 })
  })

  it('keeps the crop inside the source', () => {
    for (const [sw, sh, cw, ch] of [[1920, 1080, 1080, 1920], [1080, 1920, 1920, 1080], [1000, 1000, 1920, 1080]]) {
      const r = coverCropRect(sw, sh, cw, ch)
      expect(r.sx).toBeGreaterThanOrEqual(0)
      expect(r.sy).toBeGreaterThanOrEqual(0)
      expect(r.sx + r.sw).toBeLessThanOrEqual(sw + 1e-9)
      expect(r.sy + r.sh).toBeLessThanOrEqual(sh + 1e-9)
    }
  })
})
