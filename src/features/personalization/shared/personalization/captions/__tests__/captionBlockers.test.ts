import { describe, expect, it } from 'vitest'
import { layerBlockers } from '../captionBlockers'
import { createDefaultPreviewSettings } from '../../preview/presets'
import type { PreviewLayer } from '../../preview/types'

const brand = { businessName: 'Rascop And Associates LLC', headline: 'Call us today', offer: '10% off', cta: 'Book now' } as never
const base = createDefaultPreviewSettings()
const name = (over: Partial<PreviewLayer> = {}): PreviewLayer => ({ ...(base.layers.find((l) => l.kind === 'businessName') ?? base.layers[0]), kind: 'businessName', visible: true, opacity: 1, startFrame: 0, endFrame: undefined, x: 0.1, y: 0.6, ...over } as PreviewLayer)

describe('layerBlockers', () => {
  it('gives the area of a visible text layer as a fraction of the frame', () => {
    const [r] = layerBlockers([name()], brand, 1920, 1080)
    expect(r.left).toBeGreaterThanOrEqual(0)
    expect(r.right).toBeLessThanOrEqual(1.01)
    expect(r.bottom).toBeGreaterThan(r.top)
    expect(r.right).toBeGreaterThan(r.left)
    expect((r.top + r.bottom) / 2).toBeGreaterThan(0.5) // the layer was placed in the lower half
  })
  it('leaves out hidden and see-through layers, designs and the end card', () => {
    const layers = [name({ visible: false }), name({ opacity: 0 }), name({ kind: 'design' as never }), name({ kind: 'endCard' as never })]
    expect(layerBlockers(layers, brand, 1920, 1080)).toHaveLength(0)
  })
  it('leaves out a layer that is never on screen while a caption is', () => {
    const early = name({ startFrame: 0, endFrame: 30 })
    expect(layerBlockers([early], brand, 1920, 1080, [{ startFrame: 40, endFrame: 90 }])).toHaveLength(0)
    expect(layerBlockers([early], brand, 1920, 1080, [{ startFrame: 20, endFrame: 90 }])).toHaveLength(1)
    expect(layerBlockers([early], brand, 1920, 1080, [])).toHaveLength(1) // no captions to compare with: every layer counts
  })
  it('copes with a frame it cannot measure', () => {
    expect(layerBlockers([name()], brand, 0, 1080)).toEqual([])
  })
  it('uses the rotated extent of a turned layer, around its centre', () => {
    const [flat] = layerBlockers([name({ rotation: 0 })], brand, 1920, 1080)
    const [turned] = layerBlockers([name({ rotation: 90 })], brand, 1920, 1080)
    const fw = flat.right - flat.left, fh = flat.bottom - flat.top
    // a quarter turn swaps the width and height (in pixels), about the same centre
    expect((turned.bottom - turned.top) * 1080).toBeCloseTo(fw * 1920, 0)
    expect((turned.right - turned.left) * 1920).toBeCloseTo(fh * 1080, 0)
    expect((turned.left + turned.right) / 2).toBeCloseTo((flat.left + flat.right) / 2, 3)
    expect((turned.top + turned.bottom) / 2).toBeCloseTo((flat.top + flat.bottom) / 2, 3)
  })
})
