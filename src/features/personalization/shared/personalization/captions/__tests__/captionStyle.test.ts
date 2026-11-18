import { describe, it, expect } from 'vitest'
import { createDefaultPreviewSettings, normalizePreviewSettings } from '../../preview/presets'
import {
  MAX_CAPTION_CUES, MAX_CAPTION_TEXT, MAX_WORDS_PER_CAPTION_CUE, activeCueAt, applyCaptionsPatch, activeWordIndex, captionLayout, cleanCues, normalizeCaptions,
} from '../captionStyle'

const cues = [
  { startMs: 0, endMs: 1500, text: 'Hello there', words: [{ text: 'Hello', startMs: 0, endMs: 600 }, { text: 'there', startMs: 700, endMs: 1400 }] },
  { startMs: 2000, endMs: 3000, text: 'Call now' },
]

describe('activeCueAt', () => {
  it('finds the cue showing, and nothing in a gap, before the first or after the last', () => {
    expect(activeCueAt(cues, 0)?.text).toBe('Hello there')
    expect(activeCueAt(cues, 1499)?.text).toBe('Hello there')
    expect(activeCueAt(cues, 1500)).toBeNull() // end is exclusive
    expect(activeCueAt(cues, 1800)).toBeNull()
    expect(activeCueAt(cues, 2000)?.text).toBe('Call now')
    expect(activeCueAt(cues, 3000)).toBeNull()
    expect(activeCueAt(cues, -5)).toBeNull()
    expect(activeCueAt([], 100)).toBeNull()
  })
})

describe('activeWordIndex', () => {
  it('follows the spoken word and is -1 without word times', () => {
    expect(activeWordIndex(cues[0], 0)).toBe(0)
    expect(activeWordIndex(cues[0], 650)).toBe(0)
    expect(activeWordIndex(cues[0], 800)).toBe(1)
    expect(activeWordIndex(cues[1], 2500)).toBe(-1)
  })
})

describe('captionLayout', () => {
  it('sizes text from the frame height, bigger for bold, and keeps lines inside the frame', () => {
    const wide = captionLayout('clean', 'bottom', 1920, 1080)
    const tall = captionLayout('clean', 'bottom', 1080, 1920)
    expect(wide.fontSizePx).toBe(54)
    expect(tall.fontSizePx).toBe(65)
    expect(captionLayout('bold', 'bottom', 1920, 1080).fontSizePx).toBeGreaterThan(wide.fontSizePx)
    expect(wide.maxWidthPx).toBe(Math.round(1920 * 0.86))
    expect(tall.marginPx).toBeGreaterThan(wide.marginPx) // portrait keeps clear of the app UI at the bottom
  })
  it('centres on "middle" and survives a zero-size frame', () => {
    expect(captionLayout('bar', 'middle', 1920, 1080).marginPx).toBe(0)
    expect(captionLayout('bar', 'top', 0, 0).fontSizePx).toBeGreaterThan(0)
  })
})

describe('cleanCues / normalizeCaptions', () => {
  it('drops junk, orders cues, trims text and fixes reversed times', () => {
    const out = cleanCues([
      { startMs: 5000, endMs: 6000, text: ' later ' }, { startMs: 0, endMs: 100, text: 'first' }, { startMs: 'x', endMs: 1, text: 'bad' },
      { startMs: 10, endMs: 5, text: 'reversed' }, { startMs: 1, endMs: 2, text: '   ' }, null, 'junk',
    ])
    expect(out.map((c) => c.text)).toEqual(['first', 'reversed', 'later'])
    expect(out[1].endMs).toBeGreaterThan(out[1].startMs)
  })
  it('enforces the caps on cues, text and words', () => {
    const many = Array.from({ length: MAX_CAPTION_CUES + 20 }, (_, i) => ({ startMs: i * 10, endMs: i * 10 + 5, text: 'x' }))
    expect(cleanCues(many)).toHaveLength(MAX_CAPTION_CUES)
    expect(cleanCues([{ startMs: 0, endMs: 5, text: 'a'.repeat(500) }])[0].text).toHaveLength(MAX_CAPTION_TEXT)
    const words = Array.from({ length: 30 }, (_, i) => ({ text: `w${i}`, startMs: i, endMs: i + 1 }))
    expect(cleanCues([{ startMs: 0, endMs: 100, text: 'a', words }])[0].words).toHaveLength(MAX_WORDS_PER_CAPTION_CUE)
  })
  it('keeps valid captions, defaults unknown style/position, and returns undefined when nothing is usable', () => {
    const ok = normalizeCaptions({ enabled: false, forUrl: 'https://x/a.mp4', style: 'weird', position: 'nowhere', cues })
    expect(ok).toMatchObject({ enabled: false, forUrl: 'https://x/a.mp4', style: 'bold', position: 'bottom' })
    expect(ok?.cues).toHaveLength(2)
    expect(normalizeCaptions({ forUrl: 'https://x/a.mp4', cues: [] })).toBeUndefined()
    expect(normalizeCaptions({ cues })).toBeUndefined() // no video to belong to
    expect(normalizeCaptions(null)).toBeUndefined()
    expect(normalizeCaptions('nope')).toBeUndefined()
  })
})

describe('applyCaptionsPatch', () => {
  const base = { enabled: true, forUrl: 'https://x/a.mp4', style: 'bold' as const, position: 'bottom' as const, cues }
  it('merges a patch over the current captions and keeps the rest', () => {
    const out = applyCaptionsPatch(base, { style: 'bar', position: 'top' })
    expect(out).toMatchObject({ enabled: true, style: 'bar', position: 'top', forUrl: 'https://x/a.mp4' })
    expect(out?.cues).toHaveLength(2)
  })
  it('starts captions from a full patch, removes them with null, and treats an emptied list as none', () => {
    expect(applyCaptionsPatch(undefined, base)).toMatchObject({ forUrl: 'https://x/a.mp4' })
    expect(applyCaptionsPatch(base, null)).toBeUndefined()
    expect(applyCaptionsPatch(base, { cues: [] })).toBeUndefined()
    expect(applyCaptionsPatch(undefined, { enabled: true })).toBeUndefined() // nothing to show yet
  })
  it('cleans an edited list (a blanked line disappears)', () => {
    const out = applyCaptionsPatch(base, { cues: [{ startMs: 0, endMs: 900, text: '  fixed  ' }, { startMs: 1000, endMs: 1900, text: '   ' }] })
    expect(out?.cues.map((c) => c.text)).toEqual(['fixed'])
  })
})

describe('captions in saved project settings', () => {
  it('survive a save and restore, and bad data is dropped instead of breaking the preview', () => {
    const captions = { enabled: true, forUrl: 'https://x/a.mp4', style: 'clean' as const, position: 'top' as const, cues }
    const restored = normalizePreviewSettings(JSON.parse(JSON.stringify({ ...createDefaultPreviewSettings(), captions })))
    expect(restored.captions).toMatchObject({ enabled: true, style: 'clean', position: 'top', forUrl: 'https://x/a.mp4' })
    expect(restored.captions?.cues).toHaveLength(2)
    expect(normalizePreviewSettings({ ...createDefaultPreviewSettings(), captions: { forUrl: 5, cues: 'x' } }).captions).toBeUndefined()
    expect(normalizePreviewSettings(createDefaultPreviewSettings()).captions).toBeUndefined()
  })
})

describe('Capite looks in saved projects', () => {
  const base = { enabled: true, forUrl: 'https://x/v.mp4', position: 'bottom', cues: [{ startMs: 0, endMs: 900, text: 'Hi' }] }
  it('keeps a known Capite look and falls back to bold for an unknown one', () => {
    expect(normalizeCaptions({ ...base, style: 'mrbeast' })?.style).toBe('mrbeast')
    expect(normalizeCaptions({ ...base, style: 'nope' })?.style).toBe('bold')
  })
})

describe('caption language', () => {
  const base = { enabled: true, forUrl: 'https://x/v.mp4', style: 'bold', position: 'bottom', cues: [{ startMs: 0, endMs: 900, text: 'Hi' }] }
  it('keeps a language code (with an optional region) and drops anything else', () => {
    expect(normalizeCaptions({ ...base, language: 'es' })?.language).toBe('es')
    expect(normalizeCaptions({ ...base, language: 'pt-BR' })?.language).toBe('pt-BR')
    expect(normalizeCaptions({ ...base, language: 'haw' })?.language).toBe('haw')
    for (const bad of ['', 'english', 'e', '12', 'es; drop', 42, null, {}]) expect(normalizeCaptions({ ...base, language: bad })?.language, String(bad)).toBeUndefined()
    expect(normalizeCaptions(base)?.language).toBeUndefined()
  })
  it('can be set and cleared with a patch', () => {
    const a = applyCaptionsPatch(undefined, { ...base, language: 'ja' } as never)
    expect(a?.language).toBe('ja')
    expect(applyCaptionsPatch(a, { language: undefined })?.language).toBeUndefined()
  })
})
