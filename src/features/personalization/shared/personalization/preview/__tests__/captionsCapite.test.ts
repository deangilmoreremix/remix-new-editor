import { describe, expect, it } from 'vitest'
import {
  ALL_CAPTION_PRESETS, CAPITE_PRESETS, CAPTION_PRESETS, captionPreset, captionWords, cuesToSrt, cuesToVtt, normalizeCaptions, parseSubtitles,
} from '../captions'
import { CAPTION_STYLES, CAPTION_STYLE_CONFIGS } from '../capite/captionStyles'
import { ACTIVE_WORD, visibleWordRange } from '../capite/activeWord'
import { transcriptToSrt } from '../capite/subtitleExport'

const brand = { primary: '#112233', accent: '#ddeeff', text: '#ffffff' }
const HEX = /^#[0-9a-f]{6}$/i

describe('Capite caption styles', () => {
  it('loads all 27 styles unchanged from the copied config', () => {
    expect(CAPTION_STYLES).toHaveLength(27)
    expect(Object.keys(CAPTION_STYLE_CONFIGS)).toHaveLength(27)
    expect(CAPTION_STYLE_CONFIGS.hormozi).toMatchObject({ primaryColor: '#FFFFFF', highlightColor: '#00FFFF', animationType: 'highlight' })
  })
  it('turns every one into a valid preset with unique ids', () => {
    expect(CAPITE_PRESETS).toHaveLength(27)
    const ids = ALL_CAPTION_PRESETS.map((p) => p.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(ALL_CAPTION_PRESETS).toHaveLength(CAPTION_PRESETS.length + 27)
    for (const p of CAPITE_PRESETS) {
      const st = captionPreset(p.id, brand)!
      expect(st.color).toMatch(HEX)
      expect(st.highlightColor).toMatch(HEX)
      expect(st.size).toBeGreaterThanOrEqual(0.025)
      expect(st.size).toBeLessThanOrEqual(0.14)
      expect(st.animation).toBeTruthy()
      expect(st.windowed).toBe(true)
      expect(st.outline!.color).toMatch(HEX)
    }
  })
  it('keeps Capite styles when a project is saved and restored, and still reads older ones', () => {
    const style = captionPreset('capite-hormozi', brand)!
    const back = normalizeCaptions({ enabled: true, cues: [], style })!.style
    expect(back).toMatchObject({ animation: 'highlight', windowed: true, uppercase: true })
    expect(back.outline).toEqual(style.outline)
    const old = normalizeCaptions({ enabled: true, cues: [], style: { preset: 'clean', position: 'bottom', size: 0.05, highlight: 'none', color: '#fff', highlightColor: '#fff', box: false, boxColor: '#000', boxOpacity: 0.5, uppercase: false, bold: true } })!.style
    expect(old.animation).toBeUndefined()
    expect(old.outline).toBeUndefined()
  })
  it('drops bad extra fields', () => {
    const s = normalizeCaptions({ enabled: true, cues: [], style: { animation: 'explode', outline: { size: 'x' }, letterSpacing: 99, wordSpacing: -3 } })!.style
    expect(s.animation).toBeUndefined()
    expect(s.outline).toBeUndefined()
    expect(s.letterSpacing).toBe(0.3)
    expect(s.wordSpacing).toBeUndefined()
  })
})

describe('active word', () => {
  it('uses Capite\'s values', () => {
    expect(ACTIVE_WORD.pop.scale).toBe(1.16)
    expect(ACTIVE_WORD.bounce.scale).toBe(1.18)
    expect(ACTIVE_WORD.scale.scale).toBe(1.12)
    expect(ACTIVE_WORD.box.box).not.toBeNull()
    expect(ACTIVE_WORD.glow.glow).toHaveLength(2)
  })
  it('shows a five-word window starting two words before the spoken one', () => {
    expect(visibleWordRange(12, 6)).toEqual([4, 9])
    expect(visibleWordRange(12, 0)).toEqual([0, 5])
    expect(visibleWordRange(12, 11)).toEqual([7, 12])
    expect(visibleWordRange(3, 1)).toEqual([0, 3])
  })
  it('reports how long and how far through the spoken word it is', () => {
    const cue = { id: 'a', start: 0, end: 2, text: 'aaaa bbbb' }
    const w = captionWords(cue, 29, 30, 'word')
    expect(w[0].active).toBe(true)
    expect(w[0].progress).toBeGreaterThan(0.9)
    const w2 = captionWords(cue, 31, 30, 'word')
    expect(w2[1].active).toBe(true)
    expect(w2[1].elapsed).toBeGreaterThan(0)
  })
})

describe('subtitle files', () => {
  const cues = [{ id: 'a', start: 0.5, end: 2.25, text: 'hello there' }, { id: 'b', start: 2.25, end: 4, text: 'second line' }]
  it('matches the copied Capite exporter', () => {
    expect(cuesToSrt(cues)).toBe(transcriptToSrt({ language: 'en', segments: cues.map((c) => ({ ...c, words: [] })) }))
    expect(cuesToSrt(cues)).toContain('00:00:00,500 --> 00:00:02,250')
    expect(cuesToVtt(cues).startsWith('WEBVTT')).toBe(true)
    expect(cuesToVtt(cues)).toContain('00:00:02.250 --> 00:00:04.000')
  })
  it('round-trips through our own subtitle reader', () => {
    const back = parseSubtitles(cuesToSrt(cues))
    expect(back.map((c) => [c.start, c.end, c.text])).toEqual(cues.map((c) => [c.start, c.end, c.text]))
  })
})
