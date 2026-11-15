import { describe, it, expect } from 'vitest'
import { MAX_WORDS_PER_CUE, MIN_CUE_MS, clockLabel, cuesToSrt, cuesToText, cuesToVtt, formatTimestamp, groupCaptionCues } from '../captionCues'

const w = (text: string, startMs: number, endMs: number) => ({ text, startMs, endMs })

describe('formatTimestamp', () => {
  it('formats SRT and VTT times', () => {
    expect(formatTimestamp(0)).toBe('00:00:00,000')
    expect(formatTimestamp(3723456)).toBe('01:02:03,456')
    expect(formatTimestamp(3723456, '.')).toBe('01:02:03.456')
    expect(formatTimestamp(-50)).toBe('00:00:00,000')
  })
  it('labels list rows', () => { expect(clockLabel(7400)).toBe('0:07'); expect(clockLabel(75000)).toBe('1:15') })
})

describe('groupCaptionCues', () => {
  it('joins words that belong together and breaks on a pause', () => {
    const cues = groupCaptionCues([w('Call', 0, 300), w('us', 320, 500), w('today', 520, 900), w('Free', 2500, 2800), w('quote', 2820, 3200)])
    expect(cues.map((c) => c.text)).toEqual(['Call us today', 'Free quote'])
    expect(cues[0].startMs).toBe(0)
  })
  it('breaks after a sentence end once there are a few words, and caps the line length', () => {
    const cues = groupCaptionCues([w('We', 0, 100), w('fix', 110, 200), w('roofs.', 210, 300), w('Fast', 310, 400), w('and', 410, 500), w('fair', 510, 600)])
    expect(cues.map((c) => c.text)).toEqual(['We fix roofs.', 'Fast and fair'])
    const long = Array.from({ length: 20 }, (_, i) => w(`w${i}`, i * 100, i * 100 + 90))
    expect(groupCaptionCues(long).every((c) => c.text.split(' ').length <= MAX_WORDS_PER_CUE)).toBe(true)
  })
  it('keeps a short cue on screen long enough to read, without running into the next one', () => {
    const cues = groupCaptionCues([w('Hi', 0, 100), w('there', 1000, 1100)])
    expect(cues).toHaveLength(2)
    expect(cues[0].endMs - cues[0].startMs).toBeGreaterThanOrEqual(1) // clamped below the next start
    expect(cues[0].endMs).toBeLessThanOrEqual(cues[1].startMs)
    const lone = groupCaptionCues([w('Hi', 0, 100)])
    expect(lone[0].endMs).toBe(MIN_CUE_MS)
  })
  it('skips empty or broken words, repairs order and reversed times', () => {
    const cues = groupCaptionCues([w('  ', 0, 10), w('b', 500, 600), w('a', 100, 200), { text: 'x', startMs: Number.NaN, endMs: 1 }, w('c', 700, 650)])
    expect(cues.map((c) => c.text)).toEqual(['a b c'])
    expect(cues[0].startMs).toBe(100)
  })
  it('keeps each cue\'s per-word times so a style can highlight the spoken word', () => {
    const [cue] = groupCaptionCues([w('Call', 0, 300), w('us', 320, 500)])
    expect(cue.words).toEqual([{ text: 'Call', startMs: 0, endMs: 300 }, { text: 'us', startMs: 320, endMs: 500 }])
  })
  it('returns nothing for no speech', () => { expect(groupCaptionCues([])).toEqual([]) })
})

describe('file formats', () => {
  const cues = [{ startMs: 0, endMs: 1500, text: 'Hello' }, { startMs: 2000, endMs: 3000, text: 'World' }]
  it('writes SRT', () => {
    expect(cuesToSrt(cues)).toBe('1\n00:00:00,000 --> 00:00:01,500\nHello\n\n2\n00:00:02,000 --> 00:00:03,000\nWorld\n')
    expect(cuesToSrt([])).toBe('')
  })
  it('writes WebVTT with dots in the times', () => {
    expect(cuesToVtt(cues)).toBe('WEBVTT\n\n00:00:00.000 --> 00:00:01.500\nHello\n\n00:00:02.000 --> 00:00:03.000\nWorld\n')
  })
  it('writes plain text', () => { expect(cuesToText(cues)).toBe('Hello\nWorld') })
})
