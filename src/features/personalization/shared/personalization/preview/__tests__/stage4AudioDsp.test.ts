/**
 * Stage 4 — audio DSP and mix model, checked with numbers: filter responses, BS.1770-4 loudness against published
 * reference values, the limiter's ceiling, ducking depth/timing, fades, the mix renderer end to end, the WAV encoder and
 * the cache key / plan rules.
 */
import { describe, expect, it } from 'vitest'
import {
  applyBiquad, applyEq, applyFades, applyGainCurve, applyGainDb, biquadCoefficients, duckingCurve, eqFilters, fadeGain, integratedLoudness,
  kWeightingFilters, levelEnvelopeDb, limit, lin2db, magnitudeDb, nearestBeat, peakDb,
} from '../audioDsp'
import {
  EQ_PRESETS, MIX_SAMPLE_RATE, audioMixKey, audioPlan, defaultAudioMix, mixdownIsCurrent, normalizeAudioMix, type AudioMix,
} from '../audioMix'
import { createDefaultPreviewSettings, normalizePreviewSettings } from '../presets'
import { encodeWav16, renderMix, resampleLinear, type DecodedAudio } from '../../guided/audioMixdown'

const FS = 48000
const sine = (f: number, sec: number, amp = 1, fs = FS) => { const x = new Float32Array(Math.round(sec * fs)); for (let i = 0; i < x.length; i += 1) x[i] = amp * Math.sin((2 * Math.PI * f * i) / fs); return x }
const dbfs = (db: number) => 10 ** (db / 20)
const rms = (x: Float32Array, from = 0, to = x.length) => { let s = 0; for (let i = from; i < to; i += 1) s += x[i] * x[i]; return Math.sqrt(s / Math.max(1, to - from)) }
const noise = (sec: number, amp: number, seed = 1) => { let s = seed; const x = new Float32Array(Math.round(sec * FS)); for (let i = 0; i < x.length; i += 1) { s = (s * 1664525 + 1013904223) >>> 0; x[i] = ((s / 2 ** 32) * 2 - 1) * amp } return x }
const dec = (...ch: Float32Array[]): DecodedAudio => ({ channels: ch, sampleRate: FS })
const mixOff = (over: (m: AudioMix) => void = () => {}): AudioMix => { const m = defaultAudioMix(); m.voice.eq = { highpassHz: 0, lowDb: 0, midDb: 0, highDb: 0 }; m.voice.normalize.enabled = false; m.music.normalize.enabled = false; m.music.fadeInSec = 0; m.music.fadeOutSec = 0; m.music.duck.enabled = false; m.master.targetLufs = null; m.master.ceilingDb = 0; over(m); return m }

describe('biquads', () => {
  it('shelves and peaks hit their design gain and leave the far side alone', () => {
    const lo = biquadCoefficients('lowshelf', FS, 120, Math.SQRT1_2, 6)
    expect(magnitudeDb(lo, 20, FS)).toBeCloseTo(6, 0); expect(magnitudeDb(lo, 8000, FS)).toBeCloseTo(0, 0)
    const hi = biquadCoefficients('highshelf', FS, 6500, Math.SQRT1_2, -6)
    expect(magnitudeDb(hi, 16000, FS)).toBeCloseTo(-6, 0); expect(magnitudeDb(hi, 200, FS)).toBeCloseTo(0, 0)
    const pk = biquadCoefficients('peaking', FS, 2500, 0.9, 5)
    expect(magnitudeDb(pk, 2500, FS)).toBeCloseTo(5, 1); expect(magnitudeDb(pk, 100, FS)).toBeCloseTo(0, 0)
  })
  it('high-pass is -3 dB at the corner and removes rumble', () => {
    const hp = biquadCoefficients('highpass', FS, 100, Math.SQRT1_2)
    expect(magnitudeDb(hp, 100, FS)).toBeCloseTo(-3.01, 1); expect(magnitudeDb(hp, 10, FS)).toBeLessThan(-35); expect(magnitudeDb(hp, 2000, FS)).toBeCloseTo(0, 1)
  })
  it('the analytic response matches filtering a real sine', () => {
    for (const [f, g] of [[300, 6], [2500, 6], [5000, -9]] as const) {
      const c = biquadCoefficients('peaking', FS, f, 1, g)
      const y = applyBiquad(sine(f, 1, 0.5), c)
      expect(lin2db(rms(y, 24000) / rms(sine(f, 1, 0.5), 24000))).toBeCloseTo(g, 1)
    }
  })
  it('stays finite and stable at extreme settings', () => {
    const y = applyBiquad(noise(0.5, 1), biquadCoefficients('highpass', FS, 0.5, 0.01)); expect(y.every(Number.isFinite)).toBe(true)
    const z = applyBiquad(noise(0.5, 1), biquadCoefficients('lowpass', FS, 1e9, 50)); expect(z.every(Number.isFinite)).toBe(true)
  })
  it('EQ presets: gains land at their bands; flat is only the rumble filter', () => {
    for (const p of EQ_PRESETS) expect(applyEq(new Float32Array(10), p.eq, FS).length).toBe(10)
    const clarity = eqFilters(EQ_PRESETS.find((p) => p.id === 'clarity')!.eq, FS)
    expect(magnitudeDb(clarity, 2500, FS)).toBeGreaterThan(2); expect(magnitudeDb(clarity, 30, FS)).toBeLessThan(-6)
    expect(eqFilters({ highpassHz: 0, lowDb: 0, midDb: 0, highDb: 0 }, FS)).toEqual([])
  })
})

describe('loudness (ITU-R BS.1770-4)', () => {
  it('K-weighting at 48 kHz equals the standard coefficients', () => {
    const [s, h] = kWeightingFilters(48000)
    expect(s.b0).toBeCloseTo(1.53512485958697, 9); expect(s.b1).toBeCloseTo(-2.69169618940638, 9); expect(s.b2).toBeCloseTo(1.19839281085285, 9)
    expect(s.a1).toBeCloseTo(-1.69065929318241, 9); expect(s.a2).toBeCloseTo(0.73248077421585, 9)
    expect(h.a1).toBeCloseTo(-1.99004745483398, 8); expect(h.a2).toBeCloseTo(0.99007225036621, 8)
  })
  it('a 997 Hz stereo sine at -23 dBFS reads -23.0 LUFS (EBU TECH 3341 reference)', () => {
    const s = sine(997, 5, dbfs(-23)); expect(integratedLoudness([s, s], FS)).toBeCloseTo(-23.0, 1)
  })
  it('is linear in gain and a single channel reads 3 LU lower than the same signal on both', () => {
    const s = sine(997, 4, dbfs(-30))
    const a = integratedLoudness([s, s], FS), b = integratedLoudness([applyGainDb(s, 10), applyGainDb(s, 10)], FS)
    expect(b - a).toBeCloseTo(10, 2); expect(a - integratedLoudness([s], FS)).toBeCloseTo(3.01, 1)
  })
  it('gating: silence around the signal does not drag the reading down', () => {
    const s = sine(997, 3, dbfs(-23)); const padded = new Float32Array(FS * 9); padded.set(s, FS * 3)
    // two partly-filled edge blocks stay above the absolute gate, so BS.1770 lets them lower the reading slightly; an UNGATED mean would read ~4.8 LU lower
    expect(Math.abs(integratedLoudness([padded, padded], FS) - integratedLoudness([s, s], FS))).toBeLessThan(0.6)
    expect(integratedLoudness([new Float32Array(FS), new Float32Array(FS)], FS)).toBe(-Infinity)
    expect(integratedLoudness([], FS)).toBe(-Infinity)
  })
  it('a quiet bed under loud speech is gated out (relative gate)', () => {
    const x = new Float32Array(FS * 20); x.set(sine(997, 10, dbfs(-20)), 0); x.set(sine(300, 10, dbfs(-50)), FS * 10)
    expect(integratedLoudness([x, x], FS)).toBeGreaterThan(-20.5 - 0.7 - 0.3)
  })
  it('works at other sample rates (44.1 kHz)', () => {
    const s = sine(997, 5, dbfs(-23), 44100); expect(integratedLoudness([s, s], 44100)).toBeCloseTo(-23.0, 1)
  })
  it('short clips (< 400 ms) still measure', () => {
    const s = sine(997, 0.2, dbfs(-23)); expect(integratedLoudness([s, s], FS)).toBeCloseTo(-23.0, 0)
  })
})

describe('limiter', () => {
  it('never exceeds the ceiling, on hot and spiky input', () => {
    const x = noise(2, 3); x[1000] = 9; x[50000] = -12
    const y = limit([x, x.slice().reverse()], FS, -1)
    for (const ch of y) { let p = 0; for (const v of ch) p = Math.max(p, Math.abs(v)); expect(p).toBeLessThanOrEqual(dbfs(-1) + 1e-6) }
  })
  it('leaves a signal under the ceiling untouched', () => {
    const x = sine(440, 1, 0.3); const y = limit([x], FS, -1)[0]
    let max = 0; for (let i = 0; i < x.length; i += 1) max = Math.max(max, Math.abs(x[i] - y[i])); expect(max).toBeLessThan(1e-6)
  })
  it('reduces gain before a peak arrives (look-ahead) and recovers afterwards', () => {
    const x = new Float32Array(FS); x.fill(0.2); x[24000] = 4
    const y = limit([x], FS, -1, 5, 100)[0]
    expect(y[24000 - 100]).toBeLessThan(0.2 - 1e-4) // already ducking 100 samples before the spike
    expect(y[FS - 1]).toBeGreaterThan(0.19) // recovered
  })
  it('handles empty input and no NaN', () => { expect(limit([new Float32Array(0)], FS, -1)[0].length).toBe(0); expect(limit([noise(0.1, 5)], FS, -3)[0].every(Number.isFinite)).toBe(true) })
})

describe('ducking, fades, helpers', () => {
  const hop = 0.01
  const voice = (activeSec: [number, number][], total: number) => { const v = new Float32Array(Math.round(total / hop)).fill(-90); for (const [a, b] of activeSec) for (let i = Math.round(a / hop); i < Math.round(b / hop); i += 1) v[i] = -25; return v }
  const p = { thresholdDb: -45, amountDb: 12, attackMs: 50, releaseMs: 400, holdMs: 200 }
  it('goes down by exactly the chosen depth and comes back', () => {
    const c = duckingCurve(voice([[1, 3]], 6), hop, p)
    expect(lin2db(Math.min(...c))).toBeCloseTo(-12, 0)
    expect(c[50]).toBeCloseTo(1, 3); expect(lin2db(c[250])).toBeCloseTo(-12, 0); expect(c[599]).toBeGreaterThan(0.99)
  })
  it('attack and release timing', () => {
    const c = duckingCurve(voice([[1, 3]], 6), hop, p)
    expect(c[100 + 15]).toBeLessThan(0.6) // 150 ms after speech starts it is well down (3 attack time constants)
    expect(c[300 + 20 + 10]).toBeLessThan(0.6) // 100 ms into the release (after the 200 ms hold) it is still well down
    expect(c[300 + 20 + 250]).toBeGreaterThan(0.99) // 2.5 s into the release it has fully recovered
  })
  it('hold bridges short pauses between words (no pumping)', () => {
    const c = duckingCurve(voice([[1, 1.5], [1.6, 2.1]], 4), hop, p)
    expect(lin2db(Math.min(...c.slice(155, 165)))).toBeLessThan(-10)
  })
  it('amount 0 leaves the music alone; nothing speaking leaves it alone', () => {
    expect(Math.min(...duckingCurve(voice([[1, 3]], 6), hop, { ...p, amountDb: 0 }))).toBeCloseTo(1, 5)
    expect(Math.min(...duckingCurve(voice([], 6), hop, p))).toBeCloseTo(1, 5)
  })
  it('applyGainCurve interpolates and keeps length; levelEnvelopeDb reads dBFS', () => {
    expect(applyGainCurve(new Float32Array(100).fill(1), new Float32Array([1, 0.5]), 50).length).toBe(100)
    const env = levelEnvelopeDb([sine(1000, 1, 0.1)], FS); expect(env[10]).toBeCloseTo(-23.0, 0) // 0.1 amp sine = -20 dBFS peak → -23 dB RMS
  })
  it('fades: silent ends, full in the middle, monotonic, never overlapping', () => {
    const n = FS * 4
    expect(fadeGain(0, n, FS, 1, 1)).toBeCloseTo(0, 6); expect(fadeGain(n - 1, n, FS, 1, 1)).toBeCloseTo(0, 3); expect(fadeGain(n / 2, n, FS, 1, 1)).toBe(1)
    let prev = -1; for (let i = 0; i < FS; i += 1000) { const g = fadeGain(i, n, FS, 1, 1); expect(g).toBeGreaterThanOrEqual(prev); prev = g }
    const y = applyFades(new Float32Array(n).fill(1), FS, 3, 3); let mx = 0; for (const v of y) mx = Math.max(mx, v); expect(mx).toBeLessThanOrEqual(1)
  })
  it('nearestBeat', () => { expect(nearestBeat(2.4, [0, 0.5, 1, 2, 2.5, 3])).toBe(2.5); expect(nearestBeat(5, [])).toBe(5) })
  it('peakDb', () => { expect(peakDb([new Float32Array([0.5, -0.25])])).toBeCloseTo(-6.02, 1); expect(peakDb([new Float32Array(3)])).toBeLessThan(-100) })
})

describe('renderMix (numbers)', () => {
  const voice6 = (amp = 0.05) => dec(noise(6, amp, 7), noise(6, amp, 7))
  const music6 = (amp = 0.2) => dec(noise(6, amp, 11), noise(6, amp, 13))
  it('hits the loudness target and the ceiling, and its report agrees with an independent measurement', () => {
    const m = defaultAudioMix(); m.music.duck.enabled = false
    const { channels, report } = renderMix(voice6(), music6(), m, 6)
    const lufs = integratedLoudness(channels, FS)
    expect(Math.abs(lufs - -16)).toBeLessThan(0.3); expect(report.finalLufs).toBeCloseTo(lufs, 1)
    expect(peakDb(channels)).toBeLessThanOrEqual(-1 + 0.01); expect(report.peakDb).toBeCloseTo(peakDb(channels), 1)
  })
  it('different targets give different loudness (-14 and -23)', () => {
    for (const t of [-14, -23]) { const m = defaultAudioMix(); m.master.targetLufs = t; m.music.duck.enabled = false; const { channels } = renderMix(voice6(), music6(), m, 6); expect(Math.abs(integratedLoudness(channels, FS) - t)).toBeLessThan(0.35) }
  })
  it('the ceiling can stop the target being reached, and says so', () => {
    const m = mixOff((x) => { x.master.targetLufs = -6; x.master.ceilingDb = -12 })
    const { report } = renderMix(voice6(0.5), null, m, 6)
    expect(report.finalLufs!).toBeLessThan(-6 - 0.5); expect(report.notes.join(' ')).toMatch(/peak ceiling/)
  })
  it('ducking lowers the music under the voice by the chosen depth (isolated music component)', () => {
    // 6 s: voice speaks 1.5–3.5 s only
    const v = new Float32Array(FS * 6); v.set(noise(2, 0.1, 3), Math.round(1.5 * FS)); const voice = dec(v, v)
    const withDuck = mixOff((x) => { x.music.duck = { enabled: true, thresholdDb: -45, amountDb: 12, attackMs: 30, releaseMs: 300, holdMs: 100 } })
    const without = mixOff()
    const voiceOnly = renderMix(voice, null, without, 6).channels[0]
    const musicComponent = (m: AudioMix) => { const o = renderMix(voice, music6(0.1), m, 6).channels[0]; const c = new Float32Array(o.length); for (let i = 0; i < c.length; i += 1) c[i] = o[i] - voiceOnly[i]; return c }
    const ducked = musicComponent(withDuck), plain = musicComponent(without)
    const at = (x: Float32Array, a: number, b: number) => rms(x, Math.round(a * FS), Math.round(b * FS))
    const depthInVoice = 20 * Math.log10(at(plain, 2, 3.2) / at(ducked, 2, 3.2))
    expect(depthInVoice).toBeGreaterThan(10.5); expect(depthInVoice).toBeLessThan(12.7)
    expect(20 * Math.log10(at(plain, 0.1, 1.0) / at(ducked, 0.1, 1.0))).toBeCloseTo(0, 1) // untouched before the voice
    expect(20 * Math.log10(at(plain, 5, 5.9) / at(ducked, 5, 5.9))).toBeCloseTo(0, 0) // recovered after
    expect(renderMix(voice, music6(0.1), withDuck, 6).report.duckMaxDb).toBeGreaterThan(11)
  })
  it('EQ changes the voice by the chosen amount; normalisation removes level differences between voices', () => {
    const tone = dec(sine(2500, 3, 0.1), sine(2500, 3, 0.1))
    const flat = renderMix(tone, null, mixOff(), 3).channels[0]
    const boosted = renderMix(tone, null, mixOff((x) => { x.voice.eq.midDb = 6 }), 3).channels[0]
    expect(20 * Math.log10(rms(boosted, FS) / rms(flat, FS))).toBeCloseTo(6, 0)
    const quiet = renderMix(voice6(0.01), null, mixOff((x) => { x.voice.normalize = { enabled: true, targetLufs: -20 }; x.master.targetLufs = null }), 6)
    const loud = renderMix(voice6(0.2), null, mixOff((x) => { x.voice.normalize = { enabled: true, targetLufs: -20 }; x.master.targetLufs = null }), 6)
    expect(Math.abs(integratedLoudness(quiet.channels, FS) - integratedLoudness(loud.channels, FS))).toBeLessThan(0.3)
  })
  it('voice gain, mute and music gain are exact', () => {
    const v = dec(sine(1000, 2, 0.1), sine(1000, 2, 0.1))
    const base = renderMix(v, null, mixOff(), 2).channels[0]
    expect(20 * Math.log10(rms(renderMix(v, null, mixOff((x) => { x.voice.gainDb = -6 }), 2).channels[0]) / rms(base))).toBeCloseTo(-6, 1)
    const muted = renderMix(v, null, mixOff((x) => { x.voice.muted = true }), 2)
    expect(rms(muted.channels[0])).toBe(0); expect(muted.report.notes.join(' ')).toMatch(/muted/)
    const mus = dec(sine(500, 2, 0.1), sine(500, 2, 0.1))
    expect(20 * Math.log10(rms(renderMix(null, mus, mixOff((x) => { x.music.gainDb = 6 }), 2).channels[0]) / rms(renderMix(null, mus, mixOff(), 2).channels[0]))).toBeCloseTo(6, 1)
  })
  it('music: fades shape the ends, loops fill the video, no loop leaves silence, start offset skips ahead', () => {
    const m = dec(sine(500, 1, 0.1), sine(500, 1, 0.1))
    const faded = renderMix(null, dec(sine(500, 4, 0.1), sine(500, 4, 0.1)), mixOff((x) => { x.music.fadeInSec = 1; x.music.fadeOutSec = 1 }), 4).channels[0]
    expect(rms(faded, 0, 2400)).toBeLessThan(0.002); expect(rms(faded, FS, 3 * FS)).toBeGreaterThan(0.06); expect(rms(faded, 4 * FS - 2400, 4 * FS)).toBeLessThan(0.002)
    const looped = renderMix(null, m, mixOff(), 3.5).channels[0]
    expect(rms(looped, Math.round(2.2 * FS), Math.round(3.4 * FS))).toBeGreaterThan(0.05)
    const once = renderMix(null, m, mixOff((x) => { x.music.loop = false }), 3.5).channels[0]
    expect(rms(once, Math.round(1.2 * FS), 3 * FS)).toBe(0)
    const stepFile = new Float32Array(FS * 4); stepFile.fill(0.01); stepFile.fill(0.2, FS * 2)
    const skipped = renderMix(null, dec(stepFile, stepFile), mixOff((x) => { x.music.startSec = 2 }), 1).channels[0]
    expect(skipped[100]).toBeCloseTo(0.2, 3)
  })
  it('loop points have a 5 ms dip, never a hard jump', () => {
    const m = dec(sine(500, 1, 0.5), sine(500, 1, 0.5)); const out = renderMix(null, m, mixOff(), 2.5).channels[0]
    let maxStep = 0; for (let i = 1; i < out.length; i += 1) maxStep = Math.max(maxStep, Math.abs(out[i] - out[i - 1])); expect(maxStep).toBeLessThan(0.5 * 2 * Math.PI * 500 / FS * 1.5)
  })
  it('missing / silent sources are reported, not hidden', () => {
    const none = renderMix(null, null, defaultAudioMix(), 2); expect(rms(none.channels[0])).toBe(0); expect(none.report.notes.join(' ')).toMatch(/no audio track|silent/)
    const quiet = renderMix(dec(new Float32Array(FS), new Float32Array(FS)), null, defaultAudioMix(), 1)
    expect(quiet.report.notes.join(' ')).toMatch(/too quiet/)
    const noVoiceDuck = renderMix(null, music6(), defaultAudioMix(), 3); expect(noVoiceDuck.report.notes.join(' ')).toMatch(/no voice to duck/)
  })
  it('mono sources become two identical channels; other sample rates are resampled', () => {
    const out = renderMix(dec(sine(1000, 1, 0.1)), null, mixOff(), 1); expect(out.channels[0]).toEqual(out.channels[1])
    const x44 = sine(1000, 1, 0.1, 44100); const r = resampleLinear(x44, 44100, 48000); expect(r.length).toBe(48000)
    const o = renderMix({ channels: [x44], sampleRate: 44100 }, null, mixOff(), 1).channels[0]; expect(rms(o, 4800)).toBeCloseTo(0.1 / Math.SQRT2, 2)
  })
  it('output length is exactly the video duration', () => { expect(renderMix(voice6(), null, defaultAudioMix(), 2.5).channels[0].length).toBe(120000) })
})

describe('WAV encoder', () => {
  it('writes a valid 16-bit stereo header and round-trips samples within one step', () => {
    const l = new Float32Array([0, 0.5, -0.5, 1, -1, 2, -2]), r = new Float32Array([0.25, -0.25, 0, 0, 0, 0, 0])
    const w = encodeWav16([l, r], 48000); const dv = new DataView(w.buffer)
    const tag = (o: number) => String.fromCharCode(...w.subarray(o, o + 4))
    expect([tag(0), tag(8), tag(12), tag(36)]).toEqual(['RIFF', 'WAVE', 'fmt ', 'data'])
    expect(dv.getUint16(20, true)).toBe(1); expect(dv.getUint16(22, true)).toBe(2); expect(dv.getUint32(24, true)).toBe(48000); expect(dv.getUint16(34, true)).toBe(16)
    expect(dv.getUint32(40, true)).toBe(7 * 4); expect(w.length).toBe(44 + 7 * 4); expect(dv.getUint32(4, true)).toBe(w.length - 8)
    expect(dv.getInt16(44, true) / 32768).toBeCloseTo(0, 4); expect(dv.getInt16(46, true) / 32768).toBeCloseTo(0.25, 4)
    expect(dv.getInt16(44 + 3 * 4, true)).toBe(32767); expect(dv.getInt16(44 + 4 * 4, true)).toBe(-32768); expect(dv.getInt16(44 + 5 * 4, true)).toBe(32767) // clamped
  })
})

describe('audio mix model', () => {
  it('normalizeAudioMix clamps, defaults, and ignores junk', () => {
    for (const bad of [null, undefined, 3, 'x', []]) expect(normalizeAudioMix(bad)).toBeUndefined()
    const m = normalizeAudioMix({ voice: { gainDb: 999, eq: { highpassHz: -5, midDb: 99 } }, music: { fadeInSec: -3, duck: { amountDb: 999, attackMs: 0 } }, master: { targetLufs: -99, ceilingDb: 5 } })!
    expect(m.voice.gainDb).toBe(12); expect(m.voice.eq.highpassHz).toBe(0); expect(m.voice.eq.midDb).toBe(12); expect(m.music.fadeInSec).toBe(0)
    expect(m.music.duck.amountDb).toBe(36); expect(m.music.duck.attackMs).toBe(5); expect(m.master.targetLufs).toBe(-40); expect(m.master.ceilingDb).toBe(0)
    expect(normalizeAudioMix({ master: { targetLufs: null } })!.master.targetLufs).toBeNull()
  })
  it('is idempotent and survives JSON; wired into normalizePreviewSettings', () => {
    const a = normalizeAudioMix(defaultAudioMix())!; expect(normalizeAudioMix(JSON.parse(JSON.stringify(a)))).toEqual(a)
    const s = createDefaultPreviewSettings()
    expect(normalizePreviewSettings({ ...s, audioMix: defaultAudioMix() } as never).audioMix?.master.targetLufs).toBe(-16)
    expect(normalizePreviewSettings(s as never).audioMix).toBeUndefined()
  })
  it('mixdown references are validated', () => {
    const base = { ...defaultAudioMix(), mixdown: { key: 'am_abc12345', createdAt: 'x', durationSec: 5, report: { finalLufs: -16, notes: ['a', 3] } } }
    expect(normalizeAudioMix(base)!.mixdown!.report.notes).toEqual(['a'])
    for (const bad of [{ ...base.mixdown, key: '../etc' }, { ...base.mixdown, durationSec: 0 }, { ...base.mixdown, durationSec: 'x' }]) expect(normalizeAudioMix({ ...base, mixdown: bad })!.mixdown).toBeUndefined()
  })
  it('the key changes with every input that changes the audio, and only those', () => {
    const m = defaultAudioMix(); const k = audioMixKey('v.mp4', 'm.mp3', m, 5)
    expect(audioMixKey('v.mp4', 'm.mp3', { ...m, mixdown: { key: 'am_zzzzzzzz', createdAt: 'q', durationSec: 5, report: m as never } }, 5)).toBe(k)
    expect(audioMixKey('v2.mp4', 'm.mp3', m, 5)).not.toBe(k); expect(audioMixKey('v.mp4', 'm2.mp3', m, 5)).not.toBe(k); expect(audioMixKey('v.mp4', null, m, 5)).not.toBe(k); expect(audioMixKey('v.mp4', 'm.mp3', m, 5.5)).not.toBe(k)
    const edits: Array<(x: AudioMix) => void> = [(x) => { x.voice.gainDb = 1 }, (x) => { x.voice.eq.lowDb = 1 }, (x) => { x.voice.muted = true }, (x) => { x.music.duck.amountDb = 3 }, (x) => { x.music.fadeOutSec = 4 }, (x) => { x.master.targetLufs = -14 }, (x) => { x.master.ceilingDb = -2 }, (x) => { x.music.startSec = 2 }, (x) => { x.music.loop = false }]
    for (const e of edits) { const c = JSON.parse(JSON.stringify(m)); e(c); expect(audioMixKey('v.mp4', 'm.mp3', c, 5)).not.toBe(k) }
  })
  it('plan: the mixdown plays only when it exists, matches the current sources and its file is available', () => {
    const m = defaultAudioMix(); const key = audioMixKey('v.mp4', 'm.mp3', m, 5)
    const withRef = { ...m, mixdown: { key, createdAt: 'x', durationSec: 5, report: { voiceLufs: null, musicLufs: null, finalLufs: null, peakDb: null, duckMaxDb: 0, masterGainDb: 0, notes: [] } } }
    expect(audioPlan(undefined, 'v.mp4', 'm.mp3', 5, null)).toEqual({ useMixdown: false, pending: null })
    expect(audioPlan({ ...m, enabled: false }, 'v.mp4', 'm.mp3', 5, null).pending).toBeNull()
    expect(audioPlan(m, 'v.mp4', 'm.mp3', 5, null).pending).toBe('not-applied')
    expect(audioPlan(withRef, 'v.mp4', 'm.mp3', 5, 'blob:x')).toEqual({ useMixdown: true, pending: null })
    expect(audioPlan(withRef, 'v.mp4', 'm.mp3', 5, null).pending).toBe('not-applied') // file gone
    expect(audioPlan(withRef, 'other.mp4', 'm.mp3', 5, 'blob:x')).toEqual({ useMixdown: false, pending: 'stale' })
    expect(audioPlan({ ...withRef, voice: { ...withRef.voice, gainDb: 3 } }, 'v.mp4', 'm.mp3', 5, 'blob:x').pending).toBe('stale')
    expect(mixdownIsCurrent(withRef, 'v.mp4', 'm.mp3', 5)).toBe(true); expect(mixdownIsCurrent(withRef, 'v.mp4', 'm.mp3', 6)).toBe(false)
    expect(MIX_SAMPLE_RATE).toBe(48000)
  })
})
