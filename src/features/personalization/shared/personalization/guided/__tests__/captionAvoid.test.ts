import { describe, expect, it } from 'vitest'
import { captionAvoid, clearOf, coveredNow } from '../captionAvoid'
import { createDefaultPreviewSettings } from '../../preview/presets'
import type { PreviewCaptions } from '../../preview/types'

const brand = { businessName: 'Rascop And Associates LLC', headline: 'Call us today', offer: '10% off', cta: 'Book now' } as never
const nameLayer = (y: number) => ({ ...createDefaultPreviewSettings().layers.find((l) => l.kind === 'businessName')!, visible: true, opacity: 1, startFrame: 0, endFrame: undefined, x: 0.05, y })
const caps = (over: Partial<PreviewCaptions> = {}): PreviewCaptions => ({ enabled: true, forUrl: 'https://x/v.mp4', style: 'bold', position: 'bottom', cues: [{ startMs: 500, endMs: 3000, text: 'Call us today for a free quote' }], ...over })
const settings = (captions: PreviewCaptions | undefined, y: number) => ({ layers: [nameLayer(y)] as never, width: 1920, height: 1080, fps: 30, captions })

describe('captionAvoid (remix)', () => {
  it('is null without captions, with captions off, and for captions designed in the Caption Studio', () => {
    expect(captionAvoid(settings(undefined, 0.84), brand)).toBeNull()
    expect(captionAvoid(settings(caps({ enabled: false }), 0.84), brand)).toBeNull()
    expect(captionAvoid(settings(caps({ studio: { style: {}, pages: [] } as never }), 0.84), brand)).toBeNull()
  })
  it('finds the layers the captions cover, and moves them clear', () => {
    const a = captionAvoid(settings(caps(), 0.84), brand)!
    expect(coveredNow(a)).toBe(1)
    const out = clearOf(a)
    expect(out.cleared).toBe(true)
    expect(coveredNow(captionAvoid(settings(caps({ custom: { offsetY: out.offsetY } }), 0.84), brand)!)).toBe(0)
    expect(coveredNow(captionAvoid(settings(caps(), 0.1), brand)!)).toBe(0)
  })
})
