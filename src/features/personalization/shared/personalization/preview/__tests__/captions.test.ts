import { describe, expect, it } from 'vitest'
import {
  CAPTION_PRESETS, DEFAULT_CAPTION_STYLE, MAX_CUES, activeCue, captionPreset, captionWords, cueEntrance, cuesFromText, normalizeCaptions, normalizeCues,
  parseSubtitles, scriptToCues,
} from '../captions'
import { normalizePreviewSettings } from '../presets'

const FPS = 30
const cue = (start: number, end: number, text: string) => ({ id: `c${start}`, start, end, text })

describe('scriptToCues', () => {
  it('splits into lines of about six words and covers the whole video in order', () => {
    const cues = scriptToCues('We help small businesses grow with simple honest marketing that works every single time you ask.', 10)
    expect(cues.length).toBeGreaterThanOrEqual(2)
    expect(cues[0].start).toBe(0)
    expect(cues.at(-1)!.end).toBeCloseTo(10, 5)
    for (let i = 1; i < cues.length; i++) expect(cues[i].start).toBeCloseTo(cues[i - 1].end, 5)
    expect(cues.map((c) => c.text).join(' ')).toContain('simple honest marketing')
  })
  it('breaks at a sentence end once a line is long enough, and never leaves a tiny last line', () => {
    const cues = scriptToCues('Call us today. We are open late. Book now and save big on everything we do for you.', 9)
    expect(cues[0].text).toBe('Call us today.')
    expect(cues.every((c) => c.text.split(' ').length >= 3)).toBe(true)
  })
  it('is empty for no text or no time', () => {
    expect(scriptToCues('   ', 5)).toEqual([])
    expect(scriptToCues('hello', 0)).toEqual([])
  })
})

describe('parseSubtitles', () => {
  const srt = `1\n00:00:01,000 --> 00:00:03,500\nHello <i>there</i>\nfriend\n\n2\n00:00:04,000 --> 00:00:06,000\nSecond line\n\nbroken block\n\n3\n00:00:09,000 --> 00:00:08,000\nbackwards`
  it('reads SRT, joins lines, strips tags, and skips bad blocks', () => {
    const cues = parseSubtitles(srt)
    expect(cues).toHaveLength(2)
    expect(cues[0]).toMatchObject({ start: 1, end: 3.5, text: 'Hello there friend' })
    expect(cues[1].start).toBe(4)
  })
  it('reads WebVTT-style times with dots and an hour part', () => {
    expect(parseSubtitles('00:00:01.250 --> 00:00:02.000\nHi')[0].start).toBe(1.25)
    expect(parseSubtitles('1:00:00,000 --> 1:00:02,000\nLong')[0].start).toBe(3600)
  })
  it('cuesFromText uses subtitles when it finds them and a script otherwise', () => {
    expect(cuesFromText(srt, 10)[0].start).toBe(1)
    expect(cuesFromText('Just a plain script of words here for you today friend', 6)[0].start).toBe(0)
  })
})

describe('activeCue / captionWords', () => {
  const cues = [cue(1, 3, 'one two three four'), cue(3, 5, 'next')]
  it('finds the line on screen, none in gaps, and switches at the boundary', () => {
    expect(activeCue(cues, 0, FPS)).toBeNull()
    expect(activeCue(cues, 45, FPS)?.text).toBe('one two three four')
    expect(activeCue(cues, 90, FPS)?.text).toBe('next')
    expect(activeCue(cues, 150, FPS)).toBeNull()
  })
  it('highlights the word being spoken, moving through the line', () => {
    const c = cues[0]
    const at = (f: number) => captionWords(c, f, FPS, 'word').findIndex((w) => w.active)
    expect(at(30)).toBe(0)
    expect(at(89)).toBe(3)
    const mid = at(60)
    expect(mid).toBeGreaterThan(0)
    expect(mid).toBeLessThan(3)
    expect([at(35), at(50), at(70), at(85)]).toEqual([...[at(35), at(50), at(70), at(85)]].sort((a, b) => a - b))
  })
  it('highlights nothing when highlighting is off, and exactly one word otherwise', () => {
    expect(captionWords(cues[0], 60, FPS, 'none').some((w) => w.active)).toBe(false)
    expect(captionWords(cues[0], 60, FPS, 'word').filter((w) => w.active)).toHaveLength(1)
  })
  it('a longer word gets more of the time', () => {
    const c = cue(0, 3, 'a extraordinarily b')
    const fr = (t: number) => captionWords(c, t * FPS, FPS, 'word').findIndex((w) => w.active)
    expect(fr(0.1)).toBe(0)
    expect(fr(1.5)).toBe(1)
    expect(fr(2.9)).toBe(2)
  })
  it('entrance fades and rises in over the first moments of a line', () => {
    expect(cueEntrance(cues[0], 30, FPS)).toEqual({ opacity: 0, rise: expect.any(Number) })
    expect(cueEntrance(cues[0], 30, FPS).rise).toBeGreaterThan(0)
    expect(cueEntrance(cues[0], 60, FPS)).toEqual({ opacity: 1, rise: 0 })
  })
})

describe('normalizing', () => {
  it('drops junk cues, fixes backwards times, caps the count and sorts', () => {
    const cues = normalizeCues([{ id: 'a', start: 5, end: 6, text: 'later' }, { start: 1, end: 0, text: 'backwards' }, { start: 'x', end: 2, text: 'bad' }, { start: 0, end: 1, text: '   ' }, 3])
    expect(cues.map((c) => c.text)).toEqual(['backwards', 'later'])
    expect(cues[0].end).toBeGreaterThan(cues[0].start)
    expect(normalizeCues(Array.from({ length: 300 }, (_, i) => ({ start: i, end: i + 1, text: `t${i}` })))).toHaveLength(MAX_CUES)
  })
  it('keeps ids unique', () => {
    const ids = normalizeCues([{ id: 'x', start: 0, end: 1, text: 'a' }, { id: 'x', start: 1, end: 2, text: 'b' }]).map((c) => c.id)
    expect(new Set(ids).size).toBe(2)
  })
  it('clamps style values and rejects bad colors', () => {
    const c = normalizeCaptions({ enabled: true, cues: [], style: { size: 9, color: 'red', highlightColor: '#abc', boxOpacity: 9, position: 'nope' } })!
    expect(c.style.size).toBe(0.14)
    expect(c.style.color).toBe(DEFAULT_CAPTION_STYLE.color)
    expect(c.style.highlightColor).toBe('#abc')
    expect(c.style.boxOpacity).toBe(1)
    expect(c.style.position).toBe('bottom')
    expect(c.enabled).toBe(true)
  })
  it('is undefined when absent, and survives normalizePreviewSettings', () => {
    expect(normalizeCaptions(undefined)).toBeUndefined()
    expect(normalizePreviewSettings({}).captions).toBeUndefined()
    const out = normalizePreviewSettings({ captions: { enabled: true, cues: [{ id: 'a', start: 0, end: 2, text: 'hello world' }] } })
    expect(out.captions?.cues[0].text).toBe('hello world')
  })
})

describe('presets', () => {
  const brand = { primary: '#112233', accent: '#ddeeff', text: '#ffffff' }
  it('are built from the brand colors', () => {
    expect(captionPreset('karaoke', brand)!.highlightColor).toBe('#ddeeff')
    expect(captionPreset('brand', brand)!.boxColor).toBe('#112233')
    expect(captionPreset('nope', brand)).toBeUndefined()
  })
  it('are all valid and round-trip through normalize', () => {
    for (const p of CAPTION_PRESETS) {
      const s = captionPreset(p.id, brand)!
      expect(normalizeCaptions({ enabled: true, cues: [], style: s })!.style).toEqual(s)
    }
  })
})

describe('caption language', () => {
  const base = { enabled: true, cues: [{ id: 'a', start: 0, end: 2, text: 'hello world' }] }
  it('keeps a language code (with an optional region) and drops anything else', () => {
    expect(normalizeCaptions({ ...base, language: 'es' })?.language).toBe('es')
    expect(normalizeCaptions({ ...base, language: 'pt-BR' })?.language).toBe('pt-BR')
    for (const bad of ['', 'english', 'e', '12', 'es; drop', 42, null, {}]) expect(normalizeCaptions({ ...base, language: bad })?.language, String(bad)).toBeUndefined()
    expect(normalizeCaptions(base)?.language).toBeUndefined()
  })
  it('survives a saved project', () => {
    expect(normalizePreviewSettings({ captions: { ...base, language: 'ar' } }).captions?.language).toBe('ar')
  })
})
