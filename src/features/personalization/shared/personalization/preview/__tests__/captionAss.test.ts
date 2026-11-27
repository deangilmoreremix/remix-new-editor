import { describe, it, expect } from 'vitest'
import { captionsToAss } from '../captionAss'
import { captionPreset, DEFAULT_CAPTION_STYLE, CAPITE_PRESETS, type CaptionSettings } from '../captions'

const brand = { primary: '#112233', accent: '#ddeeff', text: '#ffffff' }
const caps = (over: Partial<CaptionSettings> = {}): CaptionSettings => ({
  enabled: true,
  cues: [{ id: 'a', start: 0.5, end: 2, text: 'Call us today' }, { id: 'b', start: 2.5, end: 4, text: 'for a free quote' }],
  style: DEFAULT_CAPTION_STYLE,
  ...over,
})
const opts = { width: 1920, height: 1080 }
const dialogues = (ass: string) => ass.split('\n').filter((l) => l.startsWith('Dialogue:'))

describe('captionsToAss', () => {
  it('shares each line\'s time between its words and covers every word', () => {
    const d = dialogues(captionsToAss(caps(), opts))
    expect(d).toHaveLength(3 + 4)
    expect(d[0]).toContain('0:00:00.50')
    expect(d[3]).toContain('0:00:02.50')
  })
  it('uses the colours and highlight of the style, and the brand preset\'s own numbers', () => {
    const style = captionPreset('karaoke', brand)!
    const ass = captionsToAss(caps({ style }), opts)
    expect(dialogues(ass)[0]).toContain('&H00FFEEDD') // the accent #ddeeff
  })
  it('draws a Capite look in its own font and animation', () => {
    const look = CAPITE_PRESETS.find((p) => p.id === 'capite-karaoke') ?? CAPITE_PRESETS[0]
    const style = captionPreset(look.id, brand)!
    const ass = captionsToAss(caps({ style }), opts)
    expect(ass).toContain('Style: Default,')
    expect(ass).not.toContain('Style: Default,Inter,')
    expect(dialogues(ass).length).toBeGreaterThan(0)
  })
  it('turns the highlight off when the style has none, and a caption box into a background behind the whole caption', () => {
    const none = captionsToAss(caps({ style: { ...DEFAULT_CAPTION_STYLE, highlight: 'none' } }), opts)
    expect(dialogues(none)[1]).not.toContain(DEFAULT_CAPTION_STYLE.highlightColor.replace('#', '').toUpperCase())
    const boxed = captionsToAss(caps({ style: { ...DEFAULT_CAPTION_STYLE, box: true } }), opts)
    expect(boxed).toMatch(/,100,100,[^,]*,0,3,/) // BorderStyle 3: a box behind every word
    expect(dialogues(boxed)[0]).not.toContain('\\3a&H00&') // not the moving word box
  })
  it('keeps the casing the style asks for and places top, middle and bottom at different heights', () => {
    expect(dialogues(captionsToAss(caps({ style: { ...DEFAULT_CAPTION_STYLE, uppercase: false } }), opts))[0]).toContain('Call')
    const y = (position: 'top' | 'middle' | 'bottom') => Number(/\\pos\(\d+,(\d+)\)/.exec(dialogues(captionsToAss(caps({ style: { ...DEFAULT_CAPTION_STYLE, position } }), opts))[0])![1])
    expect(y('top')).toBeLessThan(y('middle'))
    expect(y('middle')).toBeLessThan(y('bottom'))
  })
  it('uses the saved language or the script of the text for the font and layout', () => {
    expect(captionsToAss(caps({ language: 'ar', cues: [{ id: 'a', start: 0, end: 1, text: 'مرحبا' }] }), opts)).toContain('Style: Default,Noto Sans,')
    expect(captionsToAss(caps({ cues: [{ id: 'a', start: 0, end: 1, text: '你好世界' }] }), opts)).toContain('Style: Default,Noto Sans,')
  })
  it('is empty when there are no captions', () => { expect(captionsToAss(caps({ cues: [] }), opts)).toBe('') })
  it('keeps separate captions apart and ends each with its own caption', () => {
    const c = caps({ cues: [{ id: 'a', start: 0, end: 1, text: 'Hello' }, { id: 'b', start: 10, end: 11, text: 'Later' }] })
    const d = dialogues(captionsToAss(c, opts))
    expect(d).toHaveLength(2)
    expect(d[0]).not.toContain('LATER')
    expect(d[1]).not.toContain('HELLO')
    expect(d[0]).toContain('0:00:00.00,0:00:01.00')
    expect(d[1]).toContain('0:00:10.00,0:00:11.00')
  })
  describe('review fixes', () => {
    it('exports a box behind the whole caption (Boxed, Brand bar) as a background, not as the moving word box', () => {
      const style = captionPreset('boxed', brand)!
      expect(style.box).toBe(true)
      const ass = captionsToAss(caps({ style }), opts)
      expect(ass).toMatch(/,100,100,[^,]*,0,3,/) // BorderStyle 3 for the whole caption
      expect(dialogues(ass).join('\n')).not.toContain('\\3a&H00&') // no per-word box
      expect(ass).toContain('&H') // opacity carried in the colour
    })
    it('keeps the selected word effect and a background together', () => {
      const style = { ...DEFAULT_CAPTION_STYLE, box: true, animation: 'scale' as const }
      const d = dialogues(captionsToAss(caps({ style }), opts)).join('\n')
      expect(d).toContain('\\fscx110')
    })
    it('exports no word effect at all when "Highlight word" is off', () => {
      for (const animation of ['scale', 'pop', 'bounce', 'glow', 'box', 'karaoke'] as const) {
        const style = { ...DEFAULT_CAPTION_STYLE, highlight: 'none' as const, animation }
        const d = dialogues(captionsToAss(caps({ style }), opts)).join('\n')
        expect(d, animation).not.toMatch(/\\fscx1[012]\d|\\blur|\\3a&H00&|\\kf/)
      }
    })
  })
  describe('like the preview', () => {
    it('shows the moving five-word window when the style is windowed, and every word otherwise', () => {
      const text = 'a b c d e f g h'
      const one = (windowed: boolean) => caps({ cues: [{ id: 'x', start: 0, end: 8, text }], style: { ...DEFAULT_CAPTION_STYLE, windowed, uppercase: false } })
      const count = (line: string) => line.replace(/\{[^}]*\}/g, '').split(',,').pop()!.trim().split(/\s+/).filter(Boolean).length
      expect(Math.max(...dialogues(captionsToAss(one(true), opts)).map(count))).toBeLessThanOrEqual(5)
      expect(Math.max(...dialogues(captionsToAss(one(false), opts)).map(count))).toBe(8)
    })
    it('keeps the window still when "Highlight word" is off, as the preview does (no word is active)', () => {
      const style = { ...DEFAULT_CAPTION_STYLE, windowed: true, highlight: 'none' as const, uppercase: false }
      const d = dialogues(captionsToAss(caps({ cues: [{ id: 'x', start: 0, end: 8, text: 'a b c d e f g h' }], style }), opts))
      const shown = (line: string) => line.replace(/\{[^}]*\}/g, '').split(',,').pop()!.trim()
      expect(new Set(d.map(shown)).size).toBe(1)
    })
    it('sizes text in a script the table does not list (Greek) as wide script when no language is saved', () => {
      const size = (ass: string) => Number(ass.split('\n').find((l) => l.startsWith('Style: '))!.split(',')[2])
      const greek = size(captionsToAss(caps({ cues: [{ id: 'g', start: 0, end: 1, text: 'Καλημέρα κόσμε' }] }), opts))
      const latin = size(captionsToAss(caps({ cues: [{ id: 'l', start: 0, end: 1, text: 'Hello world' }] }), opts))
      expect(greek).toBeLessThan(latin)
    })
    it('styles an English caption and a Japanese caption each for its own script when no language is saved', () => {
      const ass = captionsToAss(caps({ cues: [{ id: 'a', start: 0, end: 1, text: 'Hello' }, { id: 'b', start: 2, end: 3, text: 'こんにちは' }] }), opts)
      expect(ass.match(/^Style: /gm)).toHaveLength(2)
    })
    it('sizes Arabic text as the preview does, not at the legacy half size', () => {
      const size = (ass: string) => Number(ass.split('\n').find((l) => l.startsWith('Style: '))!.split(',')[2])
      const arabic = size(captionsToAss(caps({ language: 'ar' }), opts))
      const english = size(captionsToAss(caps({ language: 'en' }), opts))
      expect(arabic / english).toBeGreaterThan(0.55)
    })
  })
})
