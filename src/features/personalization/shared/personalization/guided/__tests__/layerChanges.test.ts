import { describe, expect, it } from 'vitest'
import {
  describeLayerChanges,
  diffLayers,
  framesToSeconds,
  layerRevealFrame,
  lookChanged,
  secondsToFrames,
} from '../layerChanges'
import { applyLayoutPreset, createDefaultPreviewSettings, createLayer } from '../../preview/presets'

describe('diffLayers / describeLayerChanges', () => {
  it('reports the layers a layout switch added and removed', () => {
    const before = createDefaultPreviewSettings()
    const after = applyLayoutPreset(before, 'service-promotion')

    const changes = diffLayers(before.layers, after.layers)

    expect(changes.added.map((layer) => layer.kind)).toEqual(['serviceImage', 'tagline'])
    expect(changes.removed.map((layer) => layer.kind)).toEqual(['businessName'])
    expect(describeLayerChanges(changes)).toBe(
      'Added: Service image, Tagline · Removed: Business name · your other edits were kept',
    )
  })

  it('treats swapping one design for another as a removal plus an addition', () => {
    const a = [createLayer('design', { designId: 'one' })]
    const b = [createLayer('design', { designId: 'two' })]

    const changes = diffLayers(a, b)

    expect(changes.added).toHaveLength(1)
    expect(changes.removed).toHaveLength(1)
  })

  it('returns null when nothing was added or removed', () => {
    const layers = createDefaultPreviewSettings().layers
    expect(describeLayerChanges(diffLayers(layers, layers))).toBeNull()
  })
})

describe('lookChanged', () => {
  it('is true for a layout or design change only', () => {
    const base = createDefaultPreviewSettings()
    expect(lookChanged(base, { ...base, fps: 60 })).toBe(false)
    expect(lookChanged(base, { ...base, layout: 'special-offer' })).toBe(true)
    expect(lookChanged(base, { ...base, remotionDesignId: 'x' })).toBe(true)
  })
})

describe('timing helpers', () => {
  it('converts between frames and seconds', () => {
    expect(framesToSeconds(45, 30)).toBe(1.5)
    expect(secondsToFrames(1.5, 30)).toBe(45)
    expect(secondsToFrames(-2, 30)).toBe(0)
    expect(secondsToFrames(Number.NaN, 30)).toBe(0)
    expect(framesToSeconds(30, 0)).toBe(1)
  })

  it('reveals a layer half a second after it starts animating', () => {
    const layer = createLayer('headline', { startFrame: 10, animationDelay: 5 })
    expect(layerRevealFrame(layer, 30)).toBe(30)
  })
})
