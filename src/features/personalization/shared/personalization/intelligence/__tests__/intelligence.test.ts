import { describe, expect, it } from 'vitest'
import { analyzePixels, buildAssetReport, dHash, hammingDistance, sharpnessScore, suggestBrandPalette, extractPalette, type PixelBuffer } from '../imageIntel'
import { analyzeAudioSamples, fadeGainAt, recommendGain } from '../audioIntel'
import { detectSceneCuts, scenesFromCuts } from '../sceneDetect'
import { checkTextFit, findUnresolvedTokens, isPromotionalClaim, readingSeconds, resolveTokens, tightenOffer } from '../textIntel'
import { extractKeywords, searchTranscript, suggestChapters } from '../transcriptIntel'
import { cropWindow, planCrops, smoothFocalPath } from '../smartCrop'
import { platformsOverlapping } from '../safeZones'
import { buildPreflight } from '../preflight'
import { buildScript, ctaIdeas } from '../scriptIntel'
import { checkLocalAvailability } from '../localAvailability'

/** Deterministic test image: gradient + optional box, so hashes/sharpness are reproducible. */
function img(w: number, h: number, f: (x: number, y: number) => [number, number, number, number]): PixelBuffer {
  const data = new Uint8ClampedArray(w * h * 4)
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) data.set(f(x, y), (y * w + x) * 4)
  return { data, width: w, height: h }
}
const gradient = (w: number, h: number) => img(w, h, (x, y) => [(x / w) * 255, (y / h) * 255, 120, 255])
const checker = (w: number, h: number) => img(w, h, (x, y) => ((x >> 2) + (y >> 2)) % 2 ? [255, 255, 255, 255] : [0, 0, 0, 255])
const flat = (w: number, h: number, c: [number, number, number]) => img(w, h, () => [...c, 255])

describe('image intelligence', () => {
  it('gives the same hash to a resized copy and a different hash to a different picture', () => {
    const a = dHash(gradient(512, 512)), b = dHash(gradient(160, 160)), c = dHash(checker(256, 256))
    expect(hammingDistance(a, b)).toBeLessThanOrEqual(12)
    expect(hammingDistance(a, c)).toBeGreaterThan(12)
  })
  it('does not call two different flat-colour pictures duplicates', () => {
    const mk = (id: string, c: [number, number, number]) => ({ id, url: id, width: 900, height: 900, metrics: analyzePixels(flat(100, 100, c)) })
    expect(buildAssetReport([mk('red', [200, 20, 20]), mk('blue', [20, 20, 200])]).duplicateGroups).toEqual([])
    expect(buildAssetReport([mk('red1', [200, 20, 20]), mk('red2', [205, 22, 18])]).duplicateGroups).toEqual([['red1', 'red2']])
  })
  it('scores a sharp pattern far above a flat one', () => {
    expect(sharpnessScore(checker(200, 200))).toBeGreaterThan(sharpnessScore(flat(200, 200, [120, 120, 120])) + 100)
  })
  it('extracts the dominant colour and ignores transparent pixels', () => {
    const p = img(40, 40, (x) => (x < 20 ? [200, 30, 30, 255] : [0, 0, 0, 0]))
    const { palette, hasAlpha } = extractPalette(p)
    expect(hasAlpha).toBe(true)
    expect(palette[0]!.hex).toMatch(/^#c[0-9a-f]1[0-9a-f]1[0-9a-f]$|^#c8/i)
    expect(palette.length).toBe(1)
  })
  it('suggests a coloured primary over a bigger neutral share', () => {
    const s = suggestBrandPalette([{ hex: '#ffffff', share: 0.7 }, { hex: '#d12b2b', share: 0.2 }, { hex: '#1a4fd1', share: 0.1 }])
    expect(s.primary).toBe('#d12b2b')
    expect(s.accent).toBe('#1a4fd1')
  })
  it('reports duplicates without dropping any asset, and flags low resolution', () => {
    const big = gradient(512, 512), small = gradient(160, 160), other = checker(300, 300)
    const report = buildAssetReport([
      { id: 'big', url: 'a', width: 1200, height: 1200, metrics: analyzePixels(big) },
      { id: 'small', url: 'b', width: 300, height: 300, metrics: analyzePixels(small) },
      { id: 'other', url: 'c', width: 900, height: 900, metrics: analyzePixels(other) },
    ])
    expect(report.items).toHaveLength(3)
    expect(report.duplicateGroups).toEqual([['big', 'small']])
    expect(report.items.find((i) => i.id === 'small')!.duplicateOf).toBe('big')
    expect(report.items.find((i) => i.id === 'big')!.duplicateOf).toBeUndefined()
    expect(report.items.find((i) => i.id === 'small')!.flags.map((f) => f.code)).toEqual(expect.arrayContaining(['low-resolution', 'duplicate']))
    expect(report.summary.duplicates).toBe(1)
  })
})

describe('audio intelligence', () => {
  const sr = 8000
  const tone = (amp: number, sec = 3) => Float32Array.from({ length: sr * sec }, (_, i) => amp * Math.sin((2 * Math.PI * 220 * i) / sr))
  it('detects clipping on a hard-clipped signal and not on a clean one', () => {
    const hot = tone(2).map((v) => Math.max(-1, Math.min(1, v)))
    expect(analyzeAudioSamples(hot, sr).clipped).toBe(true)
    expect(analyzeAudioSamples(tone(0.3), sr).clipped).toBe(false)
  })
  it('never recommends a gain that pushes the peak past the ceiling', () => {
    const plan = recommendGain({ lufs: -30, peakDb: -3, silent: false })
    expect(-3 + plan.gainDb).toBeLessThanOrEqual(-1 + 0.05)
    expect(plan.limitedByPeak).toBe(true)
  })
  it('leaves silent or unmeasurable clips alone', () => {
    expect(recommendGain({ lufs: null, peakDb: -10, silent: false }).gain).toBe(1)
    expect(recommendGain({ lufs: -20, peakDb: -60, silent: true }).gain).toBe(1)
  })
  it('finds long silences as suggestions with a speech-like signal around them', () => {
    const s = new Float32Array(sr * 6)
    s.set(tone(0.4, 2), 0); s.set(tone(0.4, 2), sr * 4)
    const r = analyzeAudioSamples(s, sr)
    expect(r.silences.length).toBe(1)
    expect(r.silences[0]!.startMs).toBeGreaterThan(1900)
    expect(r.silences[0]!.endMs).toBeLessThan(4100)
  })
  it('fades in and out linearly', () => {
    expect(fadeGainAt(0, 10, 2, 2)).toBe(0)
    expect(fadeGainAt(1, 10, 2, 2)).toBeCloseTo(0.5)
    expect(fadeGainAt(5, 10, 2, 2)).toBe(1)
    expect(fadeGainAt(9, 10, 2, 2)).toBeCloseTo(0.5)
  })
})

describe('scene detection', () => {
  const frame = (t: number, v: number) => ({ t, luma: new Uint8Array(32 * 18).fill(v) })
  it('finds the hard cut and nothing in a static clip', () => {
    const frames = [0, 1, 2, 3, 4, 5, 6, 7].map((t) => frame(t, t < 4 ? 40 : 200))
    const cuts = detectSceneCuts(frames)
    expect(cuts).toHaveLength(1)
    expect(cuts[0]!.t).toBe(4)
    expect(detectSceneCuts([0, 1, 2, 3, 4, 5].map((t) => frame(t, 90)))).toEqual([])
    expect(scenesFromCuts(cuts, 8)).toEqual([{ start: 0, end: 4 }, { start: 4, end: 8 }])
  })
})

describe('text intelligence', () => {
  it('finds raw placeholders and resolves them only when a value or fallback exists', () => {
    expect(findUnresolvedTokens('Hi {{firstname}}, welcome to [[company]]!')).toEqual(['{{firstname}}', '[[company]]'])
    const r = resolveTokens('Hi {{firstname}} at {{company}}', { firstname: 'Sam' }, {})
    expect(r.text).toBe('Hi Sam at {{company}}')
    expect(r.unresolved).toEqual(['{{company}}'])
    expect(resolveTokens('Hi {{firstname}}', {}, { firstname: 'there' }).text).toBe('Hi there')
  })
  it('flags text that cannot be read in the time it is shown', () => {
    expect(readingSeconds('one two three four five six')).toBeGreaterThan(2)
    const r = checkTextFit('Grand opening this weekend with free coffee for everyone', { boxWidthPx: 300, boxHeightPx: 60, fontPx: 24, seconds: 1 })
    expect(r.ok).toBe(false)
    expect(r.warnings.length).toBeGreaterThanOrEqual(2)
  })
  it('requires confirmation for prices and promotions', () => {
    for (const t of ['50% off today', 'Only $19.99', 'Free consultation', '100% satisfaction guarantee']) expect(isPromotionalClaim(t)).toBe(true)
    expect(isPromotionalClaim('Family owned since 1998')).toBe(false)
  })
  it('shortens an offer without changing its numbers', () => {
    expect(tightenOffer('We are really offering 20% off all cleaning services this month only', 40)!.text).toContain('20%')
    expect(tightenOffer('Save 20% or 30% on 5 services every single month of the year', 10)).toBeNull()
  })
})

describe('transcript intelligence', () => {
  const cues = [
    { text: 'Welcome to Sunny Dental, we offer teeth whitening', startMs: 0, endMs: 4000 },
    { text: 'Our whitening takes under an hour', startMs: 4500, endMs: 8000 },
    { text: 'Call us to book your visit', startMs: 12000, endMs: 15000 },
    { text: 'We are open on Saturdays', startMs: 30000, endMs: 33000 },
  ]
  it('extracts keywords, searches and builds chapters', () => {
    expect(extractKeywords(cues.map((c) => c.text).join('. '))).toContain('whitening')
    expect(searchTranscript(cues, 'SATURDAY').map((c) => c.startMs)).toEqual([30000])
    const ch = suggestChapters(cues, { targetSec: 10, pauseMs: 3000 })
    expect(ch.length).toBeGreaterThanOrEqual(2)
    expect(ch[0]!.startMs).toBe(0)
  })
})

describe('smart crop', () => {
  it('keeps the window inside the frame and centred on the subject', () => {
    const r = cropWindow(1920, 1080, 9 / 16, { x: 0.97, y: 0.5 })
    expect(r.x + r.w).toBeLessThanOrEqual(1.0001)
    expect(r.x).toBeCloseTo(1 - r.w)
    expect((r.w * 1920) / (r.h * 1080)).toBeCloseTo(9 / 16)
  })
  it('limits crop speed so it never jumps', () => {
    const path = smoothFocalPath([{ t: 0, x: 0.1, y: 0.5 }, { t: 0.1, x: 0.9, y: 0.5 }])
    expect(path[1]!.x - path[0]!.x).toBeLessThanOrEqual(0.25 * 0.1 + 1e-9)
  })
  it('says when the subject does not fit the narrow crop', () => {
    const [vertical] = planCrops(1920, 1080, [{ t: 0, x: 0.5, y: 0.5 }], ['9:16'], { x: 0.1, y: 0.2, w: 0.8, h: 0.5 })
    expect(vertical!.subjectInside).toBe(false)
  })
})

describe('social safe zones, preflight, share helpers', () => {
  it('flags a caption sitting where the platform UI is', () => {
    expect(platformsOverlapping({ x: 0.1, y: 0.85, w: 0.6, h: 0.1 }, '9:16').map((z) => z.id)).toContain('reels')
    expect(platformsOverlapping({ x: 0.2, y: 0.4, w: 0.5, h: 0.1 }, '9:16')).toEqual([])
  })
  const base = { hasVideo: true, texts: ['Hello'], imageLayers: [{ label: 'Logo', url: 'x' }], unusedSelectedAssets: 0, captions: { present: false, count: 0 }, audio: null, layout: null, readability: null, formats: { prepared: [], total: 4 } }
  it('blocks only on real failures and reports unrun checks as unchecked, not passed', () => {
    const ok = buildPreflight(base)
    expect(ok.ready).toBe(true)
    expect(ok.items.find((i) => i.id === 'audio')!.status).toBe('unchecked')
    expect(ok.items.find((i) => i.id === 'layout')!.status).toBe('unchecked')
    const bad = buildPreflight({ ...base, texts: ['Hi {{firstname}}'], imageLayers: [{ label: 'Logo', url: null }] })
    expect(bad.ready).toBe(false)
    expect(bad.blocking.map((b) => b.id).sort()).toEqual(['assets', 'tokens'])
    expect(buildPreflight({ ...base, audio: { clipped: true, silent: false, lufs: -10 } }).ready).toBe(true)
  })
  it('writes only from supplied facts and fits the duration', () => {
    const s = buildScript({ businessName: 'Sunny Dental', industry: 'Dentist', location: 'Austin, TX', website: 'https://www.sunny.com/' }, { purpose: 'intro', tone: 'friendly', seconds: 10 })
    expect(s.text).toContain('Sunny Dental')
    expect(s.text).not.toMatch(/\d+%|\$|free|guarantee/i)
    expect(s.words).toBeLessThanOrEqual(25)
    expect(ctaIdeas({ website: 'https://x.com', phone: '555', industry: 'Dental clinic' })).toContain('Book an Appointment')
  })
  it('reports local AI availability without downloading anything', () => {
    expect(checkLocalAvailability({ navigator: {} }).promptApi).toBe(false)
    expect(checkLocalAvailability({ navigator: { gpu: {} }, Translator: {} }).translator).toBe(true)
  })
})
