import { describe, it, expect } from 'vitest'
import { assColor, assTime, cuesToWords, generateAss, type AssStyle } from '../assExport'

const base: AssStyle = {
  fontName: 'Montserrat', fontNameFallback: 'IBM Plex Sans', fontSize: 105, primaryColor: '#FFFFFF', highlightColor: '#00FFFF', outlineColor: '#000000',
  shadowColor: '#000000', shadowAlpha: 128, outlineSize: 5, shadowDepth: 4.5, bold: true, italic: false, letterSpacing: 0, wordSpacing: 100, animation: 'highlight',
}
const words = [{ text: 'Call', start: 0.5, end: 0.9 }, { text: 'us', start: 0.9, end: 1.2 }, { text: 'today', start: 1.2, end: 2 }]
const dialogues = (ass: string) => ass.split('\n').filter((l) => l.startsWith('Dialogue:'))

describe('assColor / assTime', () => {
  it('writes &HAABBGGRR with the colour channels reversed', () => {
    expect(assColor('#00FFFF')).toBe('&H00FFFF00')
    expect(assColor('#FF6600')).toBe('&H000066FF')
    expect(assColor('#abc')).toBe('&H00CCBBAA')
    expect(assColor('#000000', 128)).toBe('&H80000000')
    expect(assColor('nonsense')).toBe('&H00FFFFFF') // never invalid output
  })
  it('writes H:MM:SS.cc', () => {
    expect(assTime(0)).toBe('0:00:00.00')
    expect(assTime(61.234)).toBe('0:01:01.23')
    expect(assTime(3725.5)).toBe('1:02:05.50')
    expect(assTime(-3)).toBe('0:00:00.00')
  })
})

describe('cuesToWords', () => {
  it('shares a line\'s time between its words in proportion to their length, covering the line exactly', () => {
    const w = cuesToWords([{ start: 1, end: 3, text: 'aa bbbb cc' }])
    expect(w.map((x) => x.text)).toEqual(['aa', 'bbbb', 'cc'])
    expect(w[0].start).toBe(1)
    expect(w[2].end).toBeCloseTo(3, 6)
    expect(w[1].end - w[1].start).toBeGreaterThan(w[0].end - w[0].start)
    for (let i = 1; i < w.length; i++) expect(w[i].start).toBeCloseTo(w[i - 1].end, 6)
  })
  it('skips empty lines and lines with no time', () => {
    expect(cuesToWords([{ start: 1, end: 1, text: 'x' }, { start: 0, end: 2, text: '   ' }])).toEqual([])
  })
})

describe('generateAss', () => {
  const gen = (over: Partial<Parameters<typeof generateAss>[0]> = {}) => generateAss({ words, width: 1080, height: 1920, style: base, ...over })
  it('is empty when there are no words', () => { expect(gen({ words: [] })).toBe('') })
  it('has the header, one style and one event per word, in time order', () => {
    const ass = gen()
    expect(ass).toContain('[Script Info]')
    expect(ass).toContain('PlayResX: 1080')
    expect(ass).toContain('PlayResY: 1920')
    expect(ass).toContain('[V4+ Styles]')
    expect(ass).toContain('[Events]')
    expect(ass.match(/^Style: /gm)).toHaveLength(1)
    const d = dialogues(ass)
    expect(d).toHaveLength(3)
    expect(d[0]).toContain('0:00:00.50')
  })
  it('colours only the spoken word, upper-cases by default, and keeps casing when asked', () => {
    const d = dialogues(gen())
    expect(d[1]).toContain('{\\c&H00FFFF00}US{\\r}')
    expect(d[1]).toContain('CALL')
    expect(dialogues(gen({ casing: 'original' }))[1]).toContain('{\\c&H00FFFF00}us{\\r}')
    expect(dialogues(gen({ casing: 'title' }))[0]).toContain('Call')
  })
  it('uses each animation\'s own tags', () => {
    expect(dialogues(gen({ style: { ...base, animation: 'karaoke' } }))[0]).toContain('\\kf')
    expect(dialogues(gen({ style: { ...base, animation: 'bounce' } }))[0]).toContain('\\fscx120')
    expect(dialogues(gen({ style: { ...base, animation: 'pop' } }))[0]).toContain('\\fscx115')
    expect(dialogues(gen({ style: { ...base, animation: 'scale' } }))[0]).toContain('\\fscx110')
    expect(dialogues(gen({ style: { ...base, animation: 'glow' } }))[0]).toContain('\\blur4')
    const box = gen({ style: { ...base, animation: 'box' } })
    expect(dialogues(box)[0]).toContain('\\3a&H00&')
    expect(box).toMatch(/Style: Default,[^\n]*,3,/) // BorderStyle 3 = opaque box
  })
  it('puts the caption at the chosen height with a fixed position', () => {
    const d = dialogues(gen({ positionPct: 10 }))[0]
    expect(d).toContain('\\pos(540,1728)')
    expect(dialogues(gen({ positionPct: 45 }))[0]).toContain('\\pos(540,1056)')
  })
  it('scales to the frame and falls back to the fallback font for non-Latin scripts', () => {
    expect(gen({ width: 1920, height: 1080 })).toContain('PlayResY: 1080')
    expect(gen({ language: 'en' })).toContain('Style: Default,Montserrat,')
    expect(gen({ language: 'ar' })).toContain('Style: Default,IBM Plex Sans,')
    expect(gen({ language: 'ja', words: [{ text: '今日は', start: 0, end: 1 }] })).toContain('Style: Default,IBM Plex Sans,')
  })
  it('breaks a long line into at most two lines, with \\N, and never drops a word', () => {
    const many = Array.from({ length: 14 }, (_, i) => ({ text: `word${i}`, start: i * 0.3, end: i * 0.3 + 0.3 }))
    const d = dialogues(gen({ words: many }))
    expect(d).toHaveLength(14)
    const joined = d.join('\n')
    for (let i = 0; i < 14; i++) expect(joined).toContain(`WORD${i}`)
    expect(d.some((l) => l.includes('\\N'))).toBe(true)
    expect(d.every((l) => (l.match(/\\N/g) ?? []).length <= 1)).toBe(true)
  })
  it('escapes braces and backslashes and strips emoji the renderer cannot draw', () => {
    const d = dialogues(gen({ words: [{ text: 'a{b}\\c', start: 0, end: 1 }, { text: '😀', start: 1, end: 2 }] }))
    expect(d).toHaveLength(1)
    expect(d[0]).toContain('A\\{B\\}\\\\C')
    expect(d[0]).not.toContain('😀')
  })
  it('applies a weight transition to the active and idle words', () => {
    const d = dialogues(gen({ weightTransition: 'light-to-bold' }))[1]
    expect(d).toContain('\\b900')
    expect(d).toContain('{\\b300}')
  })
  it('never ends an event before it starts and never overlaps the next word', () => {
    const d = dialogues(gen())
    const times = d.map((l) => l.split(',').slice(1, 3))
    expect(times[0][1] <= times[1][0] || times[0][1] === times[1][0]).toBe(true)
  })
  it('keeps the words of CJK, Arabic, Hebrew, Thai and Hindi captions (only emoji are removed)', () => {
    const samples: [string, string][] = [['ja', '今日は'], ['zh', '你好'], ['ko', '안녕'], ['ar', 'مرحبا'], ['he', 'שלום'], ['th', 'สวัสดี'], ['hi', 'नमस्ते'], ['ru', 'привет']]
    for (const [language, text] of samples) {
      const ass = gen({ language, words: [{ text: `${text}👍`, start: 0, end: 1 }] })
      expect(ass, language).toContain(text.toUpperCase())
      expect(ass, language).not.toContain('👍')
    }
  })
  describe('separate captions stay separate', () => {
    const two = cuesToWords([{ start: 0, end: 1, text: 'Hello' }, { start: 10, end: 11, text: 'Later' }])
    it('never shows one caption\'s words with another\'s, and never keeps a caption up through the silence after it', () => {
      const d = dialogues(generateAss({ words: two, width: 1080, height: 1920, style: base }))
      expect(d).toHaveLength(2)
      expect(d[0]).toContain('HELLO')
      expect(d[0]).not.toContain('LATER')
      expect(d[1]).toContain('LATER')
      expect(d[1]).not.toContain('HELLO')
      expect(d[0]).toContain('0:00:00.00,0:00:00.99') // ends with its own caption, not at the next one
      expect(d[1]).toContain('0:00:10.00,0:00:10.99')
    })
    it('still breaks one long caption into lines and groups, but only within that caption', () => {
      const long = cuesToWords([{ start: 0, end: 6, text: Array.from({ length: 14 }, (_, i) => `word${i}`).join(' ') }, { start: 8, end: 9, text: 'next' }])
      const d = dialogues(generateAss({ words: long, width: 1080, height: 1920, style: base }))
      expect(d).toHaveLength(15)
      expect(d.slice(0, 14).every((l) => !l.includes('NEXT'))).toBe(true)
      expect(d[14]).not.toContain('WORD')
    })
    it('cuesToWords marks which caption each word belongs to', () => {
      expect(two.map((w) => w.group)).toEqual([0, 1])
    })
  })
})
