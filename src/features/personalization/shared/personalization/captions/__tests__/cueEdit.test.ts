import { describe, expect, it } from 'vitest'
import { nudgeCue, retimeCue } from '../cueEdit'

const cue = { startMs: 1000, endMs: 3000, text: 'Call us today', words: [{ text: 'Call', startMs: 1000, endMs: 1500 }, { text: 'us', startMs: 1500, endMs: 2000 }, { text: 'today', startMs: 2000, endMs: 3000 }] }

describe('retimeCue', () => {
  it('sets the times and keeps word times that still fit, trimmed to the new window', () => {
    const c = retimeCue(cue, 1200, 2500)
    expect(c).toMatchObject({ startMs: 1200, endMs: 2500, text: 'Call us today' })
    expect(c.words).toEqual([{ text: 'Call', startMs: 1200, endMs: 1500 }, { text: 'us', startMs: 1500, endMs: 2000 }, { text: 'today', startMs: 2000, endMs: 2500 }])
  })
  it('drops words that no longer fall inside the window, and the word list when none do', () => {
    expect(retimeCue(cue, 1600, 2600).words?.map((w) => w.text)).toEqual(['us', 'today'])
    expect(retimeCue(cue, 3000, 4000).words).toBeUndefined()
  })
  it('keeps times non-negative and the end after the start', () => {
    expect(retimeCue(cue, -50, 900)).toMatchObject({ startMs: 0 })
    const c = retimeCue(cue, 2000, 1500)
    expect(c.endMs).toBeGreaterThan(c.startMs)
  })
  it('keeps a cue that has no words as it is', () => {
    expect(retimeCue({ startMs: 0, endMs: 1000, text: 'Hi' }, 100, 900)).toEqual({ startMs: 100, endMs: 900, text: 'Hi' })
  })
})

describe('nudgeCue', () => {
  it('moves one edge by a tenth of a second', () => {
    expect(nudgeCue(cue, 100, 0, 10000)).toMatchObject({ startMs: 1100, endMs: 3000 })
    expect(nudgeCue(cue, 0, -100, 10000)).toMatchObject({ startMs: 1000, endMs: 2900 })
  })
  it('never goes below zero or past the end of the video, and keeps at least a tenth of a second', () => {
    expect(nudgeCue({ ...cue, startMs: 50, words: undefined }, -100, 0, 10000).startMs).toBe(0)
    expect(nudgeCue(cue, 0, 100, 3000).endMs).toBe(3000)
    const short = nudgeCue({ startMs: 1000, endMs: 1100, text: 'x' }, 100, 0, 10000)
    expect(short.endMs - short.startMs).toBeGreaterThanOrEqual(100)
  })
})
