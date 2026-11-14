/**
 * Stage 6 — captions model: validation, SRT/VTT import (good, malformed, hostile) and export round trips, pages and word
 * highlight over time, layout, editing, quality checks, real-transcription mapping, scene-cut detection on synthetic frame
 * differences, and codec classification.
 */
import { describe, expect, it } from 'vitest'
import {
  CAPTION_PRESETS, CaptionParseError, DEFAULT_SCENE_PARAMS, MAX_CUES, MAX_CUE_TEXT, addCue, captionLayout, captionPages, captionProblems, chunksToCues, classifyVideoCodec,
  cuesToSrt, cuesToVtt, defaultCaptionStyle, deleteCue, detectCuts, lumaDifference, mergeCues, normalizeCaptionStyle, normalizeCaptionTrack, normalizeCue, normalizeCues,
  pageAt, parseCaptionFile, readableCues, shiftCues, splitCue, updateCue, wordColor, wordState, type CaptionCue,
} from '../captions'
import { createDefaultPreviewSettings, normalizePreviewSettings } from '../presets'
import { applyCaptionPreset, clearCaptions, importCaptionFile, patchCaptionStyle, setCaptionsEnabled, setCues } from '../../guided/captionsEdit'

const SRT = `1\n00:00:01,000 --> 00:00:03,500\nWelcome to Acme Roofing\n\n2\n00:00:04,000 --> 00:00:06,000\nWe fix leaks fast\n`
const words = (...w: Array<[string, number, number]>): CaptionCue[] => w.map(([text, s, e]) => ({ text, startMs: s, endMs: e }))

describe('cue and track validation', () => {
  it('normalizeCue clamps, trims hostile sizes, rejects non-cues', () => {
    expect(normalizeCue(null)).toBeNull(); expect(normalizeCue({ text: 5, startMs: 0 })).toBeNull(); expect(normalizeCue({ text: '   ', startMs: 0 })).toBeNull(); expect(normalizeCue({ text: 'x', startMs: NaN })).toBeNull()
    expect(normalizeCue({ text: 'a', startMs: -50, endMs: -10 })).toEqual({ text: 'a', startMs: 0, endMs: 1 })
    expect(normalizeCue({ text: 'a', startMs: 100, endMs: 50 })).toEqual({ text: 'a', startMs: 100, endMs: 101 })
    expect(normalizeCue({ text: 'x'.repeat(5000), startMs: 0, endMs: 10 })!.text.length).toBe(MAX_CUE_TEXT)
    expect(normalizeCue({ text: 'a', startMs: 1e15 })!.startMs).toBeLessThanOrEqual(36_000_000)
  })
  it('normalizeCues sorts, drops junk and caps the count', () => {
    expect(normalizeCues([{ text: 'b', startMs: 2000, endMs: 3000 }, { text: 'a', startMs: 0, endMs: 1000 }, 7, null]).map((c) => c.text)).toEqual(['a', 'b'])
    expect(normalizeCues(Array.from({ length: MAX_CUES + 50 }, (_, i) => ({ text: 'w', startMs: i, endMs: i + 1 }))).length).toBe(MAX_CUES)
    expect(normalizeCues('x')).toEqual([])
  })
  it('style: presets are stable under normalization; junk is clamped; colours must be real colours', () => {
    for (const id of Object.keys(CAPTION_PRESETS)) expect(normalizeCaptionStyle(defaultCaptionStyle(id)), id).toEqual(defaultCaptionStyle(id))
    const s = normalizeCaptionStyle({ preset: 'nope', fontSize: 99, position: 'left', color: 'red; x', highlightColor: 'rgb(1,2,3)', combineMs: 1, highlight: 'wild' })
    expect(s.preset).toBe('tiktok'); expect(s.fontSize).toBe(14); expect(s.position).toBe('bottom'); expect(s.color).toBe('#FFFFFF'); expect(s.highlightColor).toBe('rgb(1,2,3)'); expect(s.combineMs).toBe(100); expect(s.highlight).toBe('active')
    expect(normalizeCaptionStyle({ color: 'url(javascript:1)' }).color).toBe('#FFFFFF')
  })
  it('track normalizes, survives JSON, and is wired into normalizePreviewSettings', () => {
    expect(normalizeCaptionTrack(null)).toBeUndefined(); expect(normalizeCaptionTrack([])).toBeUndefined()
    const t = normalizeCaptionTrack({ cues: [{ text: 'hi', startMs: 0, endMs: 900 }], source: 'bogus' })!; expect(t.source).toBe('typed'); expect(t.enabled).toBe(true)
    expect(normalizeCaptionTrack(JSON.parse(JSON.stringify(t)))).toEqual(t)
    const s = createDefaultPreviewSettings(); expect(normalizePreviewSettings({ ...s, captions: t } as never).captions?.cues.length).toBe(1); expect(normalizePreviewSettings(s as never).captions).toBeUndefined()
  })
})

describe('SRT / VTT import and export', () => {
  it('imports SRT and VTT', () => {
    const a = parseCaptionFile(SRT, 'x.srt'); expect(a.format).toBe('srt'); expect(a.cues).toEqual([{ text: 'Welcome to Acme Roofing', startMs: 1000, endMs: 3500 }, { text: 'We fix leaks fast', startMs: 4000, endMs: 6000 }])
    const v = parseCaptionFile(`WEBVTT\n\n00:00:01.000 --> 00:00:02.000\nHello there\n`, 'x.vtt'); expect(v.format).toBe('vtt'); expect(v.cues[0]).toEqual({ text: 'Hello there', startMs: 1000, endMs: 2000 })
    expect(parseCaptionFile(`\uFEFF${SRT}`, 'a.txt').cues.length).toBe(2) // BOM tolerated
  })
  it('refuses empty, malformed and oversized input with a plain message', () => {
    for (const bad of ['', '   ', 'just some words', '1\nnot a time\ntext']) expect(() => parseCaptionFile(bad, 'x.srt')).toThrow(CaptionParseError)
    expect(() => parseCaptionFile('x'.repeat(5_000_001), 'x.srt')).toThrow(/too large/)
    try { parseCaptionFile('hello', 'x.srt') } catch (e) { expect((e as Error).message).toMatch(/No subtitles were found/) }
  })
  it('hostile text stays text (no markup is interpreted here; the composition renders it as text)', () => {
    const c = parseCaptionFile(`1\n00:00:00,000 --> 00:00:01,000\n<img src=x onerror=alert(1)>\n`, 'x.srt').cues[0]; expect(c.text).toContain('<img'); expect(typeof c.text).toBe('string')
  })
  it('export → import round trip keeps text and times (SRT and VTT)', () => {
    const cues = parseCaptionFile(SRT, 'x.srt').cues
    expect(parseCaptionFile(cuesToSrt(cues), 'x.srt').cues).toEqual(cues); expect(parseCaptionFile(cuesToVtt(cues), 'x.vtt').cues).toEqual(cues)
    expect(cuesToSrt(cues)).toContain('00:00:01,000 --> 00:00:03,500'); expect(cuesToVtt(cues)).toContain('00:00:01.000 --> 00:00:03.500'); expect(cuesToVtt(cues).startsWith('WEBVTT')).toBe(true)
  })
  it('word-level cues export as readable lines (grouped like the video shows them)', () => {
    const w = words(['Welcome', 0, 400], ['to', 450, 600], ['Acme', 650, 1000], ['Roofing', 1050, 1500], ['We', 4000, 4200], ['fix', 4250, 4500])
    const lines = readableCues(w, { combineMs: 900 }); expect(lines.length).toBeLessThan(w.length); expect(lines[0].text).toContain('Welcome')
    const srt = cuesToSrt(w, { combineMs: 900 }); expect(srt.split('\n\n').length).toBe(lines.length)
  })
})

describe('pages, word highlight, layout', () => {
  const w = words(['Hello', 0, 500], ['big', 500, 900], ['world', 900, 1400], ['Next', 3000, 3400], ['page', 3400, 3800])
  it('word cues group by a time window from the page start; sentence cues are one page each', () => {
    const pages = captionPages(w, { combineMs: 1500 }); expect(pages.length).toBe(2); expect(pages[0].text.trim()).toBe('Hello big world'); expect(pages[0].tokens.length).toBe(3); expect(pages[1].text.trim()).toBe('Next page')
    expect(captionPages(parseCaptionFile(SRT, 'x.srt').cues, { combineMs: 900 }).length).toBe(2); expect(captionPages([], { combineMs: 900 })).toEqual([])
  })
  it('a pause always breaks the page; pages are capped by words and characters; a window limit splits long runs', () => {
    const gap = captionPages(words(['a', 0, 200], ['b', 250, 400], ['c', 1500, 1700]), { combineMs: 6000 }); expect(gap.map((p) => p.text.trim())).toEqual(['a b', 'c'])
    const many = captionPages(Array.from({ length: 20 }, (_, i) => ({ text: 'w', startMs: i * 100, endMs: i * 100 + 90 })), { combineMs: 6000 }); expect(Math.max(...many.map((p) => p.tokens.length))).toBeLessThanOrEqual(8)
    const long = captionPages(words(['abcdefghijklmnopqrstuvwxyz', 0, 100], ['abcdefghijklmnopqrstuvwxyz', 110, 200]), { combineMs: 6000 }); expect(long.length).toBe(2)
    const win = captionPages(words(['a', 0, 300], ['b', 400, 700], ['c', 800, 1100], ['d', 1200, 1500]), { combineMs: 900 }); expect(win.map((p) => p.text.trim())).toEqual(['a b c', 'd'])
  })
  it('sentence cues give their words time in proportion to length and keep the cue span', () => {
    const [p] = captionPages([{ text: 'aa bbbb', startMs: 1000, endMs: 4000 }], { combineMs: 900 })
    expect(p.tokens.map((t) => t.text)).toEqual(['aa', ' bbbb']); expect(p.tokens[0].fromMs).toBe(1000); expect(p.tokens[0].toMs).toBe(2000); expect(p.tokens[1].toMs).toBe(4000); expect(p.startMs).toBe(1000); expect(p.durationMs).toBe(3000)
  })
  it('the page shows from its first word to just after its last, and nothing in the gap', () => {
    const pages = captionPages(w, { combineMs: 1500 })
    expect(pageAt(pages, -5)).toBeNull(); expect(pageAt(pages, 100)!.text.trim()).toBe('Hello big world'); expect(pageAt(pages, 1500)!.text.trim()).toBe('Hello big world'); expect(pageAt(pages, 2500)).toBeNull(); expect(pageAt(pages, 3100)!.text.trim()).toBe('Next page'); expect(pageAt(pages, 9000)).toBeNull()
  })
  it('word state and colour by highlight mode', () => {
    const t = { fromMs: 500, toMs: 900 }
    expect(wordState(t, 400)).toBe('upcoming'); expect(wordState(t, 500)).toBe('active'); expect(wordState(t, 899)).toBe('active'); expect(wordState(t, 900)).toBe('spoken')
    const s = (highlight: 'none' | 'active' | 'karaoke') => ({ ...defaultCaptionStyle('tiktok'), color: '#111111', highlightColor: '#eeeeee', highlight })
    expect([400, 600, 1000].map((ms) => wordColor(s('active'), t, ms))).toEqual(['#111111', '#eeeeee', '#111111'])
    expect([400, 600, 1000].map((ms) => wordColor(s('karaoke'), t, ms))).toEqual(['#111111', '#eeeeee', '#eeeeee'])
    expect([400, 600, 1000].map((ms) => wordColor(s('none'), t, ms))).toEqual(['#111111', '#111111', '#111111'])
  })
  it('layout scales with the frame height and places top / middle / bottom', () => {
    const a = captionLayout({ fontSize: 6, position: 'bottom' }, 1920, 1080), b = captionLayout({ fontSize: 6, position: 'bottom' }, 640, 360)
    expect(a.fontPx / b.fontPx).toBeCloseTo(3, 5); expect(a.bottomPx).not.toBeNull(); expect(a.topPx).toBeNull()
    expect(captionLayout({ fontSize: 6, position: 'top' }, 100, 100).topPx).not.toBeNull(); expect(captionLayout({ fontSize: 6, position: 'middle' }, 100, 100).centered).toBe(true)
  })
})

describe('editing and quality', () => {
  const base = words(['one two three four', 0, 2000], ['five', 2500, 3000])
  it('add / update / delete / shift / split / merge keep cues valid and sorted', () => {
    expect(addCue(base, 1000).map((c) => c.startMs)).toEqual([0, 1000, 2500])
    expect(updateCue(base, 1, { startMs: 100, endMs: 50 })[0].startMs).toBe(0); expect(updateCue(base, 9, { text: 'x' })).toBe(base); expect(updateCue(base, 0, { text: '  ' })).toBe(base)
    expect(deleteCue(base, 0).length).toBe(1); expect(shiftCues(base, 500)[0].startMs).toBe(500); expect(shiftCues(base, -2200).map((c) => c.startMs)).toEqual([300]); expect(shiftCues(base, -9999)).toEqual([])
    const sp = splitCue(base, 0); expect(sp.map((c) => c.text)).toEqual(['one two', 'three four', 'five']); expect(sp[0].endMs).toBe(sp[1].startMs); expect(sp[1].endMs).toBe(2000); expect(splitCue(base, 1)).toBe(base)
    const mg = mergeCues(base, 0); expect(mg.length).toBe(1); expect(mg[0]).toEqual({ text: 'one two three four five', startMs: 0, endMs: 3000 }); expect(mergeCues(base, 1)).toBe(base)
  })
  it('problems: overlap, past the end, too fast, too long, too short; clean cues have none', () => {
    const cues: CaptionCue[] = [
      { text: 'A perfectly readable subtitle line', startMs: 0, endMs: 3000 },
      { text: 'This one overlaps the previous', startMs: 2500, endMs: 5000 },
      { text: 'This line is way too fast for anyone to read aloud', startMs: 6000, endMs: 6800 },
      { text: 'x '.repeat(60).trim(), startMs: 7000, endMs: 12000 },
      { text: 'two words', startMs: 13000, endMs: 13100 },
      { text: 'runs past the end of it', startMs: 14000, endMs: 20000 },
    ]
    const p = captionProblems(cues, 15000); const kinds = p.map((x) => `${x.index}:${x.kind}`)
    expect(kinds).toContain('1:overlap'); expect(kinds).toContain('2:too-fast'); expect(kinds).toContain('3:too-long'); expect(kinds).toContain('4:too-short'); expect(kinds).toContain('5:past-end')
    expect(captionProblems([cues[0]], 15000)).toEqual([]); expect(captionProblems([{ text: 'late', startMs: 20000, endMs: 21000 }], 15000)[0].kind).toBe('past-end')
  })
  it('word-level cues are not flagged for speed or length', () => { expect(captionProblems(words(['hi', 0, 50], ['there', 60, 100]), 5000)).toEqual([]) })
})

describe('real transcription mapping', () => {
  it('maps Whisper chunks to word cues without inventing anything', () => {
    const c = chunksToCues([{ text: ' Welcome', timestamp: [0.1, 0.5] }, { text: '', timestamp: [0.5, 0.6] }, { text: 'to', timestamp: [0.5, null] }, { text: 'bad' }, { text: 'Acme', timestamp: [0.9, 1.4] }])
    expect(c).toEqual([{ text: 'Welcome', startMs: 100, endMs: 500 }, { text: 'to', startMs: 500, endMs: 800 }, { text: 'Acme', startMs: 900, endMs: 1400 }]); expect(chunksToCues([])).toEqual([])
  })
})

describe('scene cuts', () => {
  const frame = (v: number, n = 64 * 36) => new Uint8Array(n).fill(v)
  const run = (levels: number[], fps = 5) => { const d: number[] = []; for (let i = 1; i < levels.length; i++) d.push(lumaDifference(frame(levels[i - 1]), frame(levels[i]))); return detectCuts(d, levels.map((_, i) => i / fps)) }
  it('lumaDifference is 0 for identical, 1 for black↔white, symmetric, safe on empty', () => {
    expect(lumaDifference(frame(100), frame(100))).toBe(0); expect(lumaDifference(frame(0), frame(255))).toBe(1); expect(lumaDifference(frame(10), frame(60))).toBeCloseTo(lumaDifference(frame(60), frame(10)), 9); expect(lumaDifference(new Uint8Array(0), new Uint8Array(0))).toBe(0)
  })
  it('finds hard cuts at the right time', () => {
    const levels = [...Array(10).fill(40), ...Array(10).fill(200), ...Array(10).fill(90)]
    expect(run(levels)).toEqual([2, 4])
  })
  it('does not cut on a static clip, a slow fade, a gentle camera drift or tiny noise', () => {
    expect(run(Array(40).fill(100))).toEqual([]); expect(run(Array.from({ length: 40 }, (_, i) => 40 + i * 4))).toEqual([]); expect(run(Array.from({ length: 40 }, (_, i) => 100 + (i % 2)))).toEqual([])
  })
  it('a one-frame flash is not two scenes; cuts closer than the minimum scene length are merged', () => {
    const flash = [...Array(10).fill(40), 255, ...Array(10).fill(40)]; expect(run(flash).length).toBeLessThanOrEqual(2)
    const quick = [...Array(3).fill(40), ...Array(2).fill(200), ...Array(3).fill(40), ...Array(10).fill(120)]; const cuts = run(quick); for (let i = 1; i < cuts.length; i++) expect(cuts[i] - cuts[i - 1]).toBeGreaterThanOrEqual(DEFAULT_SCENE_PARAMS.minSceneSec)
  })
  it('higher threshold = fewer cuts', () => {
    const levels = [...Array(8).fill(100), ...Array(8).fill(135), ...Array(8).fill(60), ...Array(8).fill(250)]; const d: number[] = []; for (let i = 1; i < levels.length; i++) d.push(lumaDifference(frame(levels[i - 1]), frame(levels[i])))
    const t = levels.map((_, i) => i / 5)
    expect(detectCuts(d, t, { threshold: 0.9, minSceneSec: 0.8 }).length).toBeLessThanOrEqual(detectCuts(d, t, { threshold: 0.1, minSceneSec: 0.8 }).length)
  })
})

describe('codec classification', () => {
  it('H.264 / VP9 / VP8 ok, AV1 / HEVC warn, pro codecs bad, unknown warns', () => {
    for (const c of ['avc1.64001f', 'h264']) expect(classifyVideoCodec(c)).toMatchObject({ family: 'H.264', level: 'ok' })
    expect(classifyVideoCodec('vp09.00.10.08').level).toBe('ok'); expect(classifyVideoCodec('vp8').level).toBe('ok')
    expect(classifyVideoCodec('av01.0.04M.08').level).toBe('warn'); expect(classifyVideoCodec('hvc1.1.6.L93.B0')).toMatchObject({ family: 'HEVC', level: 'warn' }); expect(classifyVideoCodec('hev1').level).toBe('warn')
    expect(classifyVideoCodec('prores').level).toBe('bad'); expect(classifyVideoCodec('mjpeg').level).toBe('bad'); expect(classifyVideoCodec(null).level).toBe('warn'); expect(classifyVideoCodec('zzz').level).toBe('warn')
  })
})

describe('settings edits (pure)', () => {
  const base = createDefaultPreviewSettings()
  it('setCues creates the track; presets keep cues; style patches are validated; enable/clear', () => {
    const a = setCues(base, [{ text: 'hi', startMs: 0, endMs: 900 }], 'typed'); expect(a.captions?.cues.length).toBe(1); expect(base.captions).toBeUndefined()
    expect(applyCaptionPreset(a, 'classic').captions).toMatchObject({ style: { preset: 'classic', background: true } }); expect(applyCaptionPreset(a, 'classic').captions!.cues.length).toBe(1); expect(applyCaptionPreset(a, 'nope')).toBe(a)
    expect(patchCaptionStyle(a, { fontSize: 99 }).captions!.style.fontSize).toBe(14); expect(setCaptionsEnabled(a, false).captions!.enabled).toBe(false); expect(setCaptionsEnabled(base, false)).toBe(base); expect(clearCaptions(a).captions).toBeUndefined()
  })
  it('importCaptionFile: ok with count, classic look for subtitle files, error message otherwise, existing style kept', () => {
    const r = importCaptionFile(base, SRT, 'a.srt'); expect(r).toMatchObject({ ok: true, count: 2, format: 'srt' }); if (r.ok) expect(r.settings.captions!.style.preset).toBe('classic')
    const withStyle = patchCaptionStyle(base, { preset: 'karaoke' }); const r2 = importCaptionFile(withStyle, SRT, 'a.srt'); if (r2.ok) expect(r2.settings.captions!.style.preset).toBe('karaoke')
    expect(importCaptionFile(base, 'nonsense', 'a.srt')).toMatchObject({ ok: false, error: expect.stringContaining('No subtitles') })
  })
})
