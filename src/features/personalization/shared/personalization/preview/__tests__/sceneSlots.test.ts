import { describe, expect, it } from 'vitest'
import '../../templates/catalog'
import {
  applyDesignTemplate,
  createDefaultPreviewSettings,
  normalizePreviewSettings,
  closestAspectRatio,
  removeDesignSlot,
  retimeScenes,
  sceneLengths,
  totalDurationInFrames,
} from '../presets'

const SEED = { businessName: 'Acme Roofing', headline: 'Roofs that last', logoUrl: 'https://cdn.example.com/logo.png' }

describe('opening scene, on-screen design and closing scene together', () => {
  const base = createDefaultPreviewSettings({ durationInFrames: 450 })
  const all = applyDesignTemplate(
    applyDesignTemplate(applyDesignTemplate(base, 'scene-gradient-text-sweep', SEED, 'intro'), 'lower-third', SEED, 'overlay'),
    'scene-fireworks-burst',
    SEED,
    'outro',
  )

  it('adds one layer per slot, draws scenes last, and an on-screen design replaces the layout but not the scenes', () => {
    expect(all.layers.map((layer) => layer.id)).toEqual(['design', 'design-intro', 'design-outro'])
    expect(all.remotionDesignId).toBe('lower-third')
    expect(all.remotionSceneIds).toEqual({ intro: 'scene-gradient-text-sweep', outro: 'scene-fireworks-burst' })
  })

  it('plays the scenes before and after the video, adding to its length', () => {
    const intro = all.layers.find((layer) => layer.id === 'design-intro')!
    const outro = all.layers.find((layer) => layer.id === 'design-outro')!
    // Each scene stores only its own length; the video keeps its 450 frames.
    expect(intro).toMatchObject({ startFrame: 0, endFrame: 109, scale: 1, x: 0.5, y: 0.5 })
    expect(outro).toMatchObject({ startFrame: 0, endFrame: 109, scale: 1 })
    expect(all.durationInFrames).toBe(450)
    expect(sceneLengths(all)).toEqual({ intro: 110, outro: 110 })
    expect(totalDurationInFrames(all)).toBe(110 + 450 + 110)
  })

  it('turns the branded end card off for a closing scene, and back on when it is removed', () => {
    expect(base.showEndCard).toBe(true)
    expect(all.showEndCard).toBe(false)
    const removed = removeDesignSlot(all, 'outro')
    expect(removed.showEndCard).toBe(true)
    expect(removed.layers.some((layer) => layer.id === 'design-outro')).toBe(false)
    expect(removed.layers.some((layer) => layer.id === 'design-intro')).toBe(true)
    expect(removed.remotionSceneIds).toEqual({ intro: 'scene-gradient-text-sweep', outro: null })
  })

  it('keeps scene lengths when the video gets shorter, and is never capped by it', () => {
    const shorter = retimeScenes({ ...all, durationInFrames: 60 })
    expect(sceneLengths(shorter)).toEqual({ intro: 110, outro: 110 })
    expect(totalDurationInFrames(shorter)).toBe(110 + 60 + 110)
  })

  it('rescales scene lengths when the frame rate changes', () => {
    const at60 = retimeScenes({ ...all, fps: 60 })
    expect(sceneLengths(at60)).toEqual({ intro: 220, outro: 220 })
  })

  it('lets any design play before or after the video, on its own placement', () => {
    const withOverlayAsIntro = applyDesignTemplate(base, 'lower-third', SEED, 'intro')
    const intro = withOverlayAsIntro.layers.find((layer) => layer.id === 'design-intro')!
    expect(intro.designId).toBe('lower-third')
    expect(intro.scale).toBeLessThan(1)
    expect(sceneLengths(withOverlayAsIntro).intro).toBe(90)
  })

  it('leaves hidden scenes out of the total', () => {
    const hidden = { ...all, layers: all.layers.map((layer) => (layer.id === 'design-outro' ? { ...layer, visible: false } : layer)) }
    expect(totalDurationInFrames(hidden)).toBe(110 + 450)
  })

  it('reads the length of older projects that saved an absolute closing window', () => {
    const legacy = { ...all, layers: all.layers.map((layer) => (layer.id === 'design-outro' ? { ...layer, startFrame: 340, endFrame: 449 } : layer)) }
    expect(sceneLengths(legacy).outro).toBe(110)
  })

  it('survives a save and reload', () => {
    const restored = normalizePreviewSettings(JSON.parse(JSON.stringify(all)))
    expect(restored.remotionSceneIds).toEqual(all.remotionSceneIds)
    expect(restored.layers.find((layer) => layer.id === 'design-outro')).toMatchObject({ designId: 'scene-fireworks-burst', endFrame: 109 })
    expect(totalDurationInFrames(restored)).toBe(totalDurationInFrames(all))
  })

  it('restores older projects with no scene ids', () => {
    const legacy = { ...all } as Record<string, unknown>
    delete legacy.remotionSceneIds
    expect(normalizePreviewSettings(legacy).remotionSceneIds).toEqual({ intro: null, outro: null })
  })
})

describe('closestAspectRatio', () => {
  it('matches a video to the nearest supported shape', () => {
    expect(closestAspectRatio(1920, 1080)).toBe('16:9')
    expect(closestAspectRatio(720, 1280)).toBe('9:16')
    expect(closestAspectRatio(1000, 1000)).toBe('1:1')
    expect(closestAspectRatio(1080, 1350)).toBe('4:5')
    expect(closestAspectRatio(0, 1080)).toBeNull()
  })
})
