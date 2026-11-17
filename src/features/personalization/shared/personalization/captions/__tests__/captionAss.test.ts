import { describe, it, expect } from 'vitest'
import { captionsToAss } from '../captionAss'
import { CAPITE_CAPTION_STYLES } from '../capiteStyles'
import type { PreviewCaptions } from '../../preview/types'

const caps = (over: Partial<PreviewCaptions> = {}): PreviewCaptions => ({
  enabled: true, forUrl: 'https://x/v.mp4', style: 'bold', position: 'bottom',
  cues: [
    { startMs: 500, endMs: 2000, text: 'Call us today', words: [{ text: 'Call', startMs: 500, endMs: 900 }, { text: 'us', startMs: 900, endMs: 1200 }, { text: 'today', startMs: 1200, endMs: 2000 }] },
    { startMs: 2500, endMs: 4000, text: 'for a free quote' },
  ],
  ...over,
})
const opts = { width: 1920, height: 1080, accent: '#ddeeff' }
const dialogues = (ass: string) => ass.split('\n').filter((l) => l.startsWith('Dialogue:'))

describe('captionsToAss', () => {
  it('uses the real word times when a line has them and shares the time by length when it does not', () => {
    const d = dialogues(captionsToAss(caps(), opts))
    expect(d).toHaveLength(3 + 4)
    expect(d[0]).toContain('0:00:00.50')
    expect(d[1]).toContain('0:00:00.90')
    expect(d[3]).toContain('0:00:02.50') // first word of the second line
  })
  it('draws a Capite look in its own font, colours and animation', () => {
    const look = CAPITE_CAPTION_STYLES.find((l) => l.animationType === 'karaoke')!
    const ass = captionsToAss(caps({ style: look.id }), opts)
    expect(ass).toContain(`Style: Default,${look.fontName},`)
    expect(dialogues(ass)[0]).toContain('\\kf')
  })
  it('draws the built-in looks with their brand accent for the spoken word', () => {
    expect(dialogues(captionsToAss(caps({ style: 'bold' }), opts))[0]).toContain('&H00FFEEDD') // #ddeeff
    expect(captionsToAss(caps({ style: 'clean' }), opts)).toContain('[Events]')
    expect(captionsToAss(caps({ style: 'bar' }), opts)).toContain('[Events]')
  })
  it('places top, middle and bottom captions at different heights', () => {
    const y = (position: PreviewCaptions['position']) => Number(/\\pos\(\d+,(\d+)\)/.exec(dialogues(captionsToAss(caps({ position }), opts))[0])![1])
    expect(y('top')).toBeLessThan(y('middle'))
    expect(y('middle')).toBeLessThan(y('bottom'))
  })
  it('uses the saved language, or the script of the text when there is none', () => {
    const ar = captionsToAss(caps({ language: 'ar', cues: [{ startMs: 0, endMs: 1000, text: 'مرحبا' }] }), opts)
    expect(ar).toContain('PlayResX: 1920')
    expect(ar).toContain('Style: Default,Noto Sans,') // the look's fallback font for a non-Latin script
    const guessed = captionsToAss(caps({ cues: [{ startMs: 0, endMs: 1000, text: '你好世界' }] }), opts)
    expect(guessed).toContain('Style: Default,Noto Sans,')
  })
  it('is empty when there are no captions', () => {
    expect(captionsToAss(caps({ cues: [] }), opts)).toBe('')
  })
  it('keeps separate captions apart, with or without real word times', () => {
    const c = caps({ cues: [{ startMs: 0, endMs: 1000, text: 'Hello', words: [{ text: 'Hello', startMs: 0, endMs: 1000 }] }, { startMs: 10000, endMs: 11000, text: 'Later' }] })
    const d = dialogues(captionsToAss(c, opts))
    expect(d).toHaveLength(2)
    expect(d[0]).not.toContain('LATER'.toLowerCase())
    expect(d[0]).toContain('0:00:00.00,0:00:01.00')
    expect(d[1]).toContain('0:00:10.00,0:00:11.00')
  })
  it('never keeps a caption on screen past its own end, even when a word is timed beyond it', () => {
    const c = caps({ cues: [{ startMs: 0, endMs: 1000, text: 'Hello', words: [{ text: 'Hello', startMs: 0, endMs: 5000 }] }] })
    expect(dialogues(captionsToAss(c, opts))[0]).toContain('0:00:00.00,0:00:01.00')
  })
  it('keeps a caption up for the whole of its cue, even when its words are timed inside it (a short cue is padded to a minimum length)', () => {
    const c = caps({ cues: [{ startMs: 0, endMs: 800, text: 'Hi', words: [{ text: 'Hi', startMs: 100, endMs: 200 }] }] })
    expect(dialogues(captionsToAss(c, opts))[0]).toContain('0:00:00.00,0:00:00.80')
  })
  it('never runs an event past its cue when a word starts after the cue ends', () => {
    const c = caps({ cues: [{ startMs: 0, endMs: 1000, text: 'Hi', words: [{ text: 'Hi', startMs: 1500, endMs: 1800 }] }] })
    for (const d of dialogues(captionsToAss(c, opts))) expect(d.split(',')[2] <= '0:00:01.00').toBe(true)
  })
  it('exports the Bar look with its dark bar behind the text', () => {
    const ass = captionsToAss(caps({ style: 'bar' }), opts)
    expect(ass).toMatch(/,100,100,[^,]*,0,3,/) // BorderStyle 3: a box behind the whole caption
  })
})
