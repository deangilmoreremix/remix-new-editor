import { describe, it, expect } from 'vitest'
import { applyCasing, clampNudge, findReplace, transcriptText } from '../textTools'

describe('applyCasing', () => {
  it('converts to UPPER, Title and lower', () => {
    expect(applyCasing('call us TODAY', 'upper')).toBe('CALL US TODAY')
    expect(applyCasing('call us TODAY', 'title')).toBe('Call Us Today')
    expect(applyCasing('Call Us TODAY', 'lower')).toBe('call us today')
  })
  it('keeps apostrophes and non-Latin text sensible', () => {
    expect(applyCasing("don't STOP", 'title')).toBe("Don't Stop")
    expect(applyCasing('привет мир', 'title')).toBe('Привет Мир')
    expect(applyCasing('', 'upper')).toBe('')
  })
})

describe('findReplace', () => {
  const lines = [{ text: 'Call us today', id: 'a' }, { text: 'call me TODAY or today', id: 'b' }, { text: 'nothing here', id: 'c' }]
  it('replaces everywhere, ignoring case by default, and counts', () => {
    const r = findReplace(lines, 'today', 'now')
    expect(r.items.map((l) => l.text)).toEqual(['Call us now', 'call me now or now', 'nothing here'])
    expect(r.count).toBe(3)
    expect(r.items[0].id).toBe('a') // other fields kept
  })
  it('can match case and whole words only', () => {
    expect(findReplace(lines, 'today', 'now', { matchCase: true }).count).toBe(2)
    expect(findReplace([{ text: 'cat catalog cat' }], 'cat', 'dog', { wholeWord: true }).items[0].text).toBe('dog catalog dog')
  })
  it('treats the search text literally and never changes anything for an empty search', () => {
    expect(findReplace([{ text: 'a.b a-b' }], 'a.b', 'X').items[0].text).toBe('X a-b')
    expect(findReplace([{ text: '(x) [y]' }], '(x)', 'z').items[0].text).toBe('z [y]')
    const r = findReplace(lines, '', 'x')
    expect(r.count).toBe(0)
    expect(r.items).toBe(lines)
  })
  it('drops a line that becomes empty only when asked, never by surprise', () => {
    expect(findReplace([{ text: 'um' }], 'um', '').items).toEqual([{ text: '' }])
  })
})

describe('clampNudge', () => {
  it('moves start and end by a delta and keeps a minimum length and zero floor', () => {
    expect(clampNudge(1, 3, 0.1, 0)).toEqual([1.1, 3])
    expect(clampNudge(1, 3, 0, -0.1)).toEqual([1, 2.9])
    expect(clampNudge(0.05, 3, -0.1, 0)).toEqual([0, 3])
    expect(clampNudge(1, 1.2, 0, -0.5, 0.1)).toEqual([1, 1.1])
    expect(clampNudge(1, 1.2, 0.5, 0, 0.1)).toEqual([1.1, 1.2])
  })
  it('does not accumulate floating-point noise', () => {
    let [s, e] = [0, 5]
    for (let i = 0; i < 30; i++) [s, e] = clampNudge(s, e, 0.1, 0)
    expect(s).toBe(3)
  })
})

describe('transcriptText', () => {
  it('is the lines joined with newlines, trimmed, skipping empty ones', () => {
    expect(transcriptText([' Hello ', '', 'world'])).toBe('Hello\nworld\n')
    expect(transcriptText([])).toBe('')
  })
})

describe('review fixes', () => {
  it('whole-word matching treats combining marks as part of the word', () => {
    const decomposed = 'cafe' + String.fromCodePoint(0x0301)
    expect(findReplace([{ text: decomposed }], 'cafe', 'tea', { wholeWord: true }).count).toBe(0)
    expect(findReplace([{ text: `${decomposed} and cafe` }], 'cafe', 'tea', { wholeWord: true }).items[0].text).toBe(`${decomposed} and tea`)
  })
  it('a nudge never goes below zero: the end is extended instead when the minimum length needs it', () => {
    expect(clampNudge(0, 0.1, 0.1, -0.1, 0.1)).toEqual([0, 0.1])
    expect(clampNudge(0.05, 0.15, 0.1, -0.1, 0.1)).toEqual([0, 0.1]) // squeezed from both sides: kept at the minimum length, from zero
    const [s, e] = clampNudge(0, 0.2, -1, 0)
    expect(s).toBe(0)
    expect(e).toBeGreaterThanOrEqual(0.1)
  })
  it('title-cases the first whole code point, not half of a surrogate pair', () => {
    expect(applyCasing(String.fromCodePoint(0x10428) + 'BC', 'title')).toBe(String.fromCodePoint(0x10400) + 'bc')
  })
})
