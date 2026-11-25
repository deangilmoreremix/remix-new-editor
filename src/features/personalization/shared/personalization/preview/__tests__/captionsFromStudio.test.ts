import { describe, it, expect } from 'vitest'
import { captionWords, normalizeCaptions, normalizeCues, type CaptionCue, type CaptionSettings } from '../captions'
import { captionsToStudioInput, captionStyleToStudio, parseColor, studioToCaptionSettings, STUDIO_FONTS, type StudioPayload } from '../captionsFromStudio'

const brand = { primary: '#29d3f2', accent: '#facc15', text: '#ffffff' }
const tok = (text: string, i: number, at = 0) => ({ text: (i ? ' ' : '') + text, fromMs: at + i * 500, toMs: at + i * 500 + 450 })
const payload = (style: Record<string, unknown> = {}): StudioPayload => ({
  pages: [
    { startMs: 0, durationMs: 1500, tokens: ['Call', 'us', 'today'].map((t, i) => tok(t, i)) },
    { startMs: 2000, durationMs: 1000, tokens: ['for', 'a', 'quote'].map((t, i) => tok(t, i, 2000)) },
  ],
  style: { preset: 'capite-hormozi', fontSize: 7, position: 'top', positionY: 0.3, color: '#ffffff', highlightColor: '#00ffff', strokeColor: '#001122', stroke: true, bold: true, uppercase: true, highlightActive: true, animation: 'bounce', ...style },
})

describe('Studio output → this editor’s captions', () => {
  it('writes one line per page with the exact time of every word', () => {
    const { settings, truncated } = studioToCaptionSettings(payload(), brand)
    expect(truncated).toBe(false)
    expect(settings.enabled).toBe(true)
    expect(settings.cues).toHaveLength(2)
    expect(settings.cues[0]).toMatchObject({ id: 'cue_0', start: 0, text: 'Call us today' })
    expect(settings.cues[0].words).toEqual([{ text: 'Call', start: 0, end: 0.45 }, { text: 'us', start: 0.5, end: 0.95 }, { text: 'today', start: 1, end: 1.45 }])
    expect(settings.cues[1].start).toBe(2)
  })
  it('never lets two lines overlap (the layer shows the first that covers a moment)', () => {
    const p = payload()
    p.pages[0].tokens[2].toMs = 2600
    const { settings } = settings_(p)
    expect(settings.cues[0].end).toBeLessThanOrEqual(settings.cues[1].start)
  })
  it('keeps the look: Capite preset, colours, size, outline, motion and the dragged height', () => {
    const { style } = studioToCaptionSettings(payload(), brand).settings
    expect(style).toMatchObject({ preset: 'capite-hormozi', position: 'top', positionY: 0.3, size: 0.07, color: '#ffffff', highlightColor: '#00ffff', uppercase: true, bold: true, highlight: 'word', animation: 'bounce' })
    expect(style.outline).toMatchObject({ color: '#001122' })
    expect(style.box).toBe(false)
  })
  it('maps a line background to this editor’s box, with the colour and opacity', () => {
    const { style } = studioToCaptionSettings(payload({ preset: 'classic', animation: 'highlight', background: true, stroke: false, backgroundColor: 'rgba(10, 20, 30, 0.4)' }), brand).settings
    expect(style).toMatchObject({ preset: 'clean', box: true, boxColor: '#0a141e', boxOpacity: 0.4 })
    expect(style.outline).toBeUndefined()
  })
  it('does not carry the Studio font over: this editor draws one bundled font so preview and export match', () => {
    const { style } = studioToCaptionSettings(payload({ fontFamily: 'Anton' }), brand).settings
    expect(JSON.stringify(style)).not.toContain('Anton')
    expect(STUDIO_FONTS).toEqual(['Inter'])
  })
  it('tolerates junk without throwing', () => {
    const { settings } = studioToCaptionSettings({ pages: [{ startMs: 0, durationMs: 1, tokens: [{ text: '  ', fromMs: 0, toMs: 1 }] }], style: { color: 'red; x', fontSize: 'big', position: 7 } }, brand)
    expect(settings.cues).toEqual([])
    expect(settings.style.color).toBeTruthy()
  })
  it('reports when a video has more lines than a project keeps', () => {
    const many: StudioPayload = { pages: Array.from({ length: 260 }, (_, i) => ({ startMs: i * 1000, durationMs: 900, tokens: [tok('w', 0, i * 1000)] })), style: {} }
    const r = studioToCaptionSettings(many, brand)
    expect(r.truncated).toBe(true)
    expect(r.settings.cues).toHaveLength(200)
  })
})
const settings_ = (p: StudioPayload) => studioToCaptionSettings(p, brand)

describe('exact word times in captions', () => {
  const cue: CaptionCue = { id: 'c', start: 0, end: 3, text: 'Call us today', words: [{ text: 'Call', start: 0, end: 0.2 }, { text: 'us', start: 0.2, end: 2.5 }, { text: 'today', start: 2.5, end: 3 }] }
  const activeAt = (c: CaptionCue, sec: number) => captionWords(c, sec * 30, 30, 'word').findIndex((w) => w.active)
  it('highlights the word actually being said, not an even split', () => {
    expect(activeAt(cue, 0.1)).toBe(0)
    expect(activeAt(cue, 1.5)).toBe(1) // 'us' is long in the speech
    expect(activeAt(cue, 2.7)).toBe(2)
    const { text, ...even } = { ...cue, words: undefined }
    expect(activeAt({ ...even, text } as CaptionCue, 1.5)).toBe(1)
  })
  it('reports progress and elapsed time inside the spoken word', () => {
    const w = captionWords(cue, 1.35 * 30, 30, 'word')[1]
    expect(w.elapsed).toBeCloseTo(1.15, 1)
    expect(w.progress).toBeCloseTo(0.5, 1)
  })
  it('falls back to the length-based split once the line is edited so the words no longer match', () => {
    const edited = { ...cue, text: 'Call us right now' }
    const words = captionWords(edited, 30, 30, 'word')
    expect(words.map((w) => w.text)).toEqual(['Call', 'us', 'right', 'now'])
    expect(words.filter((w) => w.active)).toHaveLength(1)
  })
  it('survives a save and reload, and drops word times that are invalid or no longer match', () => {
    const raw = { enabled: true, cues: [{ ...cue }, { id: 'bad', start: 3, end: 4, text: 'a b', words: [{ text: 'x', start: 'no', end: 1 }] }, { id: 'edit', start: 4, end: 5, text: 'changed text', words: [{ text: 'old', start: 4, end: 4.5 }] }] }
    const n = normalizeCaptions(JSON.parse(JSON.stringify(raw)))!
    expect(n.cues[0].words).toHaveLength(3)
    expect(n.cues[1].words).toBeUndefined()
    expect(n.cues[2].words).toBeUndefined()
    expect(normalizeCues([{ id: 'a', start: 0, end: 1, text: 'hi', words: Array.from({ length: 40 }, () => ({ text: 'hi', start: 0, end: 1 })) }])[0].words).toBeUndefined()
  })
  it('keeps a dragged height, clamped to the frame', () => {
    const n = normalizeCaptions({ enabled: true, cues: [], style: { positionY: 5 } })!
    expect(n.style.positionY).toBe(0.96)
    expect(normalizeCaptions({ enabled: true, cues: [], style: {} })!.style.positionY).toBeUndefined()
  })
})

describe('this editor’s captions → what the Studio opens on', () => {
  const caps: CaptionSettings = {
    enabled: true,
    cues: [
      { id: 'a', start: 0, end: 1.2, text: 'timed words', words: [{ text: 'timed', start: 0, end: 0.5 }, { text: 'words', start: 0.5, end: 1.2 }] },
      { id: 'b', start: 2, end: 4, text: 'pasted line here' },
    ],
    style: { preset: 'capite-mrbeast', position: 'middle', size: 0.08, highlight: 'word', color: '#ffff00', highlightColor: '#ff6600', box: false, boxColor: '#000000', boxOpacity: 0.5, uppercase: true, bold: true, italic: true, outline: { size: 0.08, color: '#000000' }, positionY: 0.4 },
  }
  it('uses exact word times when there are any, and shares a line’s time by word length when there are not', () => {
    const { words } = captionsToStudioInput(caps)
    expect(words.slice(0, 2)).toEqual([{ text: 'timed', startMs: 0, endMs: 500 }, { text: 'words', startMs: 500, endMs: 1200 }])
    expect(words.slice(2).map((w) => w.text)).toEqual(['pasted', 'line', 'here'])
    expect(words[2].startMs).toBe(2000)
    expect(words[4].endMs).toBe(4000)
    for (let i = 3; i < words.length; i++) expect(words[i].startMs).toBe(words[i - 1].endMs)
  })
  it('hands the Studio the look in its own terms, in the one allowed font', () => {
    const s = captionStyleToStudio(caps.style)
    expect(s).toMatchObject({ preset: 'capite-mrbeast', fontFamily: 'Inter', fontSize: 8, position: 'middle', positionY: 0.4, color: '#ffff00', highlightColor: '#ff6600', uppercase: true, italic: true, stroke: true, highlightActive: true, background: false })
  })
  it('round-trips: Studio → captions → Studio keeps the words, times and look', () => {
    const first = studioToCaptionSettings(payload(), brand).settings
    const again = captionsToStudioInput(first)
    expect(again.words.map((w) => [w.text, w.startMs, w.endMs])).toEqual(payload().pages.flatMap((p) => p.tokens.map((t) => [t.text.trim(), t.fromMs, t.toMs])))
    expect(again.style).toMatchObject({ preset: 'capite-hormozi', fontSize: 7, positionY: 0.3, highlightColor: '#00ffff', stroke: true })
  })
})

describe('parseColor', () => {
  it('reads hex, short hex and rgb(a), and rejects the rest', () => {
    expect(parseColor('#ABCDEF')).toEqual({ hex: '#abcdef', alpha: 1 })
    expect(parseColor('#f80')).toEqual({ hex: '#ff8800', alpha: 1 })
    expect(parseColor('rgba(255, 0, 128, 0.5)')).toEqual({ hex: '#ff0080', alpha: 0.5 })
    expect(parseColor('rgb(1,2,3)')).toEqual({ hex: '#010203', alpha: 1 })
    expect(parseColor('red')).toBeNull()
    expect(parseColor('url(x)')).toBeNull()
    expect(parseColor(5)).toBeNull()
  })
})
