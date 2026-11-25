import { describe, expect, it } from 'vitest'
import { captionAvoid, clearOf, coveredNow } from '../captionAvoid'
import { createDefaultPreviewSettings } from '../../preview/presets'
import { cleanStudioCaptions } from '../../captions/studioCaptions'
import type { CaptionSettings } from '../../preview/captions'

const brand = { businessName: 'Rascop And Associates LLC', headline: 'Call us today', offer: '10% off', cta: 'Book now' } as never
const nameLayer = (y: number, over: object = {}) => ({ ...createDefaultPreviewSettings().layers.find((l) => l.kind === 'businessName')!, visible: true, opacity: 1, startFrame: 0, endFrame: undefined, x: 0.05, y, ...over })
const tok = (text: string, i: number) => ({ text: (i ? ' ' : '') + text, fromMs: 500 + i * 400, toMs: 500 + i * 400 + 400 })
const studio = (style: Record<string, unknown> = {}) => cleanStudioCaptions({ pages: [{ startMs: 500, durationMs: 1600, tokens: ['call', 'us', 'today', 'please'].map(tok) }], style: { fontSize: 6, position: 'bottom', ...style } })!
const caps = (over: Partial<CaptionSettings> = {}): CaptionSettings => ({ enabled: true, cues: [], style: {} as never, studio: studio(), ...over })
const settings = (captions: CaptionSettings | undefined, layers: object[]) => ({ layers: layers as never, width: 1920, height: 1080, fps: 30, captions })

describe('captionAvoid (Caption Studio captions)', () => {
  it('is null without Studio captions, and with captions off', () => {
    expect(captionAvoid(settings(undefined, [nameLayer(0.84)]), brand)).toBeNull()
    expect(captionAvoid(settings(caps({ enabled: false }), [nameLayer(0.84)]), brand)).toBeNull()
    expect(captionAvoid(settings(caps({ studio: undefined }), [nameLayer(0.84)]), brand)).toBeNull()
  })
  it('finds the layers the captions cover, and moves them clear', () => {
    const a = captionAvoid(settings(caps(), [nameLayer(0.84)]), brand)!
    expect(coveredNow(a)).toBe(1)
    const out = clearOf(a)
    expect(out.cleared).toBe(true)
    const moved = captionAvoid(settings(caps({ studio: studio({ positionY: out.positionY }) }), [nameLayer(0.84)]), brand)!
    expect(coveredNow(moved)).toBe(0)
    expect(coveredNow(captionAvoid(settings(caps(), [nameLayer(0.1)]), brand)!)).toBe(0)
  })
  it('ignores a layer that is off screen while the captions are', () => {
    expect(coveredNow(captionAvoid(settings(caps(), [nameLayer(0.84, { startFrame: 0, endFrame: 5 })]), brand)!)).toBe(0) // gone by 0.17 s; captions start at 0.5 s
  })
})
