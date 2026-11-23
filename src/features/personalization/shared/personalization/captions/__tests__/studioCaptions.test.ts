import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { cleanStudioCaptions, withPositionY, studioToCues, studioFallbackStyle, MAX_TOKENS_PER_PAGE, MAX_STUDIO_PAGES } from '../studioCaptions'
import { applyCaptionsPatch, normalizeCaptions } from '../captionStyle'

const page = (start: number, words: string[]) => ({ startMs: start, durationMs: words.length * 400, tokens: words.map((text, i) => ({ text: (i ? ' ' : '') + text, fromMs: start + i * 400, toMs: start + i * 400 + 400 })) })
const good = { pages: [page(0, ['hello', 'brave', 'new', 'world'])], style: { fontFamily: 'Anton', fontSize: 7, position: 'top', positionY: 0.3, color: '#fff', highlightColor: '#00ffff', animation: 'bounce', preset: 'capite-hormozi' } }

describe('studio captions: what a saved project is allowed to contain', () => {
  it('keeps a good payload and fills the gaps with safe defaults', () => {
    const s = cleanStudioCaptions(good)!
    expect(s.pages[0].tokens.map((t) => t.text.trim())).toEqual(['hello', 'brave', 'new', 'world'])
    expect(s.style).toMatchObject({ fontFamily: 'Anton', fontSize: 7, position: 'top', positionY: 0.3, highlightColor: '#00ffff', animation: 'bounce', preset: 'capite-hormozi', stroke: true, combineMs: 900 })
  })
  it('rejects anything that is not valid, never throwing', () => {
    expect(cleanStudioCaptions(null)).toBeUndefined()
    expect(cleanStudioCaptions({ pages: 'x' })).toBeUndefined()
    expect(cleanStudioCaptions({ pages: [{ startMs: 'a', tokens: [] }] })).toBeUndefined()
    expect(cleanStudioCaptions({ pages: [page(0, [])] })).toBeUndefined()
  })
  it('refuses colours, fonts and motions that could inject CSS', () => {
    const s = cleanStudioCaptions({ pages: good.pages, style: { color: 'red; background:url(//evil)', highlightColor: 'url(x)', strokeColor: '#12', fontFamily: 'x"; }body{', animation: 'rm -rf', fontSize: 9999, positionY: -4, combineMs: 1 } })!
    expect(s.style.color).toBe('#FFFFFF')
    expect(s.style.highlightColor).toBe('#FFE14D')
    expect(s.style.strokeColor).toBe('#000000')
    expect(s.style.fontFamily).toBe('Inter')
    expect(s.style.animation).toBe('highlight')
    expect(s.style.fontSize).toBe(20)
    expect(s.style.positionY).toBe(0)
    expect(s.style.combineMs).toBe(100)
  })
  it('accepts rgb(a) colours and caps sizes', () => {
    const s = cleanStudioCaptions({ pages: [page(0, Array.from({ length: 40 }, (_, i) => `w${i}`))], style: { backgroundColor: 'rgba(0, 0, 0, 0.6)' } })!
    expect(s.style.backgroundColor).toBe('rgba(0, 0, 0, 0.6)')
    expect(s.pages[0].tokens).toHaveLength(MAX_TOKENS_PER_PAGE)
    expect(cleanStudioCaptions({ pages: Array.from({ length: MAX_STUDIO_PAGES + 50 }, (_, i) => page(i * 1000, ['a'])) })!.pages).toHaveLength(MAX_STUDIO_PAGES)
  })
  it('turns pages into cues with word times, at most 8 words each', () => {
    const cues = studioToCues(cleanStudioCaptions({ pages: [page(0, Array.from({ length: 10 }, (_, i) => `w${i}`))] })!)
    expect(cues.map((c) => c.words!.length)).toEqual([8, 2])
    expect(cues[0]).toMatchObject({ startMs: 0, text: 'w0 w1 w2 w3 w4 w5 w6 w7' })
    expect(cues[1].startMs).toBe(3200)
  })
  it('picks the closest built-in look for when the studio data is dropped', () => {
    const st = cleanStudioCaptions(good)!.style
    expect(studioFallbackStyle(st)).toBe('hormozi')
    expect(studioFallbackStyle({ ...st, preset: 'tiktok', background: true })).toBe('bar')
    expect(studioFallbackStyle({ ...st, preset: 'tiktok', background: false, stroke: false })).toBe('clean')
  })
  it('keeps a valid weight and drops an invalid one', () => {
    expect(cleanStudioCaptions({ ...good, style: { ...good.style, weight: 'light' } })!.style.weight).toBe('light')
    expect(cleanStudioCaptions({ ...good, style: { ...good.style, weight: 'heavy' } })!.style.weight).toBeUndefined()
  })
})

describe('studio captions in the project', () => {
  const cues = [{ startMs: 0, endMs: 1600, text: 'hello brave new world' }]
  it('survive a save and reload', () => {
    const n = normalizeCaptions({ enabled: true, forUrl: 'https://x/v.mp4', style: 'bold', position: 'bottom', cues, studio: good })!
    expect(n.studio?.style.fontFamily).toBe('Anton')
    expect(normalizeCaptions(JSON.parse(JSON.stringify(n)))!.studio).toEqual(n.studio)
  })
  it('are dropped by an edit made outside the studio, so they never go stale', () => {
    const n = normalizeCaptions({ enabled: true, forUrl: 'https://x/v.mp4', style: 'bold', position: 'bottom', cues, studio: good })!
    expect(applyCaptionsPatch(n, { cues: [{ startMs: 0, endMs: 1000, text: 'fixed' }], studio: undefined })!.studio).toBeUndefined()
    expect(applyCaptionsPatch(n, { enabled: false })!.studio).toBeDefined()
  })
  it('are ignored when invalid, leaving ordinary captions', () => {
    const n = normalizeCaptions({ enabled: true, forUrl: 'https://x/v.mp4', cues, studio: { pages: 5 } })!
    expect(n.studio).toBeUndefined()
    expect(n.cues).toHaveLength(1)
  })
})

// The layout is shared verbatim with the Caption Studio in remix-new-editor; that repo's copy is the source of truth.
const core = join(__dirname, '../../../../../../lib/captionStudio/layout.js')
describe.skipIf(!existsSync(core))('studio layout copy', () => {
  it('is byte-identical to the Caption Studio core', () => {
    expect(readFileSync(join(__dirname, '../studioLayout.js'), 'utf8')).toBe(readFileSync(core, 'utf8'))
  })
})

describe('withPositionY', () => {
  const s = cleanStudioCaptions(good)!
  it('sets the dragged height and leaves the rest alone', () => {
    const moved = withPositionY(s, 0.61)
    expect(moved.style.positionY).toBe(0.61)
    expect(moved.pages).toBe(s.pages)
    expect(s.style.positionY).toBe(0.3) // the original is untouched
  })
  it('puts them back in their place with undefined', () => {
    expect('positionY' in withPositionY(s, undefined).style).toBe(false)
  })
})
