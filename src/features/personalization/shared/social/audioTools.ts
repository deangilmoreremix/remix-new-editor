/**
 * Audio adjustment with the Web Audio API: volume, fades, 3-band equalizer, compressor and a basic high-pass filter.
 * This is ordinary signal processing: it is NOT AI noise removal and does not claim to be.
 * The same `buildAudioChain` drives the live preview (AudioContext) and the export render (OfflineAudioContext), so what you hear is what is rendered
 * (except fades, which need a known timeline and are applied in the render only).
 */
export interface AudioSettings {
  gainDb: number
  fadeInSec: number
  fadeOutSec: number
  lowDb: number
  midDb: number
  highDb: number
  /** 0 = off. A gentle rumble/handling-noise filter, not noise removal. */
  highpassHz: number
  compressor: boolean
  thresholdDb: number
  ratio: number
}

export const DEFAULT_AUDIO: AudioSettings = { gainDb: 0, fadeInSec: 0, fadeOutSec: 0, lowDb: 0, midDb: 0, highDb: 0, highpassHz: 0, compressor: false, thresholdDb: -24, ratio: 4 }

export const AUDIO_PRESETS: Record<string, { label: string; settings: Partial<AudioSettings> }> = {
  flat: { label: 'Flat (no change)', settings: {} },
  voice: { label: 'Clearer voice', settings: { highpassHz: 80, lowDb: -2, midDb: 3, highDb: 1.5, compressor: true, thresholdDb: -22, ratio: 3, fadeInSec: 0.1, fadeOutSec: 0.3 } },
  music: { label: 'Fuller music', settings: { lowDb: 3, highDb: 2, compressor: true, thresholdDb: -18, ratio: 2, fadeOutSec: 1 } },
  quiet: { label: 'Boost quiet audio', settings: { gainDb: 9, compressor: true, thresholdDb: -30, ratio: 4 } },
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, Number.isFinite(n) ? n : lo))
export const dbToGain = (db: number) => 10 ** (db / 20)

/** Keeps every value in a safe range and the two fades inside the clip. */
export function clampSettings(s: Partial<AudioSettings>, durationSec: number): AudioSettings {
  const d = { ...DEFAULT_AUDIO, ...s }
  const total = Math.max(0, durationSec)
  const fadeIn = clamp(d.fadeInSec, 0, total)
  const fadeOut = clamp(d.fadeOutSec, 0, Math.max(0, total - fadeIn))
  return {
    gainDb: clamp(d.gainDb, -30, 18), fadeInSec: fadeIn, fadeOutSec: fadeOut,
    lowDb: clamp(d.lowDb, -12, 12), midDb: clamp(d.midDb, -12, 12), highDb: clamp(d.highDb, -12, 12),
    highpassHz: d.highpassHz > 0 ? clamp(d.highpassHz, 20, 400) : 0,
    compressor: !!d.compressor, thresholdDb: clamp(d.thresholdDb, -60, 0), ratio: clamp(d.ratio, 1, 20),
  }
}

export const isUnchanged = (s: AudioSettings) => JSON.stringify(clampSettings(s, Infinity)) === JSON.stringify(DEFAULT_AUDIO)

type Ctx = Pick<BaseAudioContext, 'createGain' | 'createBiquadFilter' | 'createDynamicsCompressor'> & { currentTime?: number }

/**
 * input → [high-pass] → low shelf (320 Hz) → mid peak (1 kHz) → high shelf (3.2 kHz) → [compressor] → gain with fades.
 * Returns the last node (connect it to the destination) and the gain node. Fades are only scheduled when `durationSec` is finite.
 */
export function buildAudioChain(ctx: Ctx, input: AudioNode, settings: AudioSettings, durationSec: number) {
  const s = clampSettings(settings, durationSec)
  let tail: AudioNode = input
  const add = (n: AudioNode) => { tail.connect(n); tail = n; return n }
  if (s.highpassHz > 0) { const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = s.highpassHz; add(f) }
  const band = (type: BiquadFilterType, hz: number, db: number, q?: number) => {
    if (!db) return
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = hz; f.gain.value = db; if (q) f.Q.value = q; add(f)
  }
  band('lowshelf', 320, s.lowDb); band('peaking', 1000, s.midDb, 1); band('highshelf', 3200, s.highDb)
  if (s.compressor) {
    const c = ctx.createDynamicsCompressor()
    c.threshold.value = s.thresholdDb; c.ratio.value = s.ratio; c.knee.value = 12; c.attack.value = 0.005; c.release.value = 0.2
    add(c)
  }
  const gain = ctx.createGain()
  const g = dbToGain(s.gainDb)
  gain.gain.value = g
  if (Number.isFinite(durationSec) && (s.fadeInSec > 0 || s.fadeOutSec > 0)) {
    const t0 = ctx.currentTime ?? 0
    if (s.fadeInSec > 0) { gain.gain.setValueAtTime(0, t0); gain.gain.linearRampToValueAtTime(g, t0 + s.fadeInSec) }
    if (s.fadeOutSec > 0) { gain.gain.setValueAtTime(g, t0 + durationSec - s.fadeOutSec); gain.gain.linearRampToValueAtTime(0, t0 + durationSec) }
  }
  add(gain)
  return { output: tail, gain }
}

/** Renders the whole buffer through the chain (offline: faster than real time, nothing is played). */
export async function renderAudio(buffer: AudioBuffer, settings: AudioSettings, Offline: typeof OfflineAudioContext = (globalThis as any).OfflineAudioContext): Promise<AudioBuffer> {
  if (!Offline) throw new Error('This browser cannot process audio (Web Audio is missing).')
  const ctx = new Offline(buffer.numberOfChannels, buffer.length, buffer.sampleRate)
  const src = ctx.createBufferSource()
  src.buffer = buffer
  const { output } = buildAudioChain(ctx, src, settings, buffer.duration)
  output.connect(ctx.destination)
  src.start(0)
  return ctx.startRendering()
}

/** Decodes the audio track of an audio or video file the browser can read. */
export async function decodeFileAudio(file: Blob, Ctor: any = (globalThis as any).AudioContext || (globalThis as any).webkitAudioContext): Promise<AudioBuffer> {
  if (!Ctor) throw new Error('This browser cannot read audio (Web Audio is missing).')
  const ctx = new Ctor()
  try { return await ctx.decodeAudioData(await file.arrayBuffer()) }
  catch { throw new Error('This browser could not read an audio track from the file (some formats, e.g. certain MOV files, are not decodable here).') }
  finally { try { await ctx.close?.() } catch { /* already closed */ } }
}

/** Waveform: the largest absolute sample in each of `buckets` equal slices, 0..1. */
export function peaks(channel: Float32Array, buckets: number): number[] {
  const n = Math.max(1, Math.floor(buckets))
  const out = new Array(n).fill(0)
  if (!channel.length) return out
  const size = channel.length / n
  for (let b = 0; b < n; b++) {
    const from = Math.floor(b * size), to = Math.max(from + 1, Math.floor((b + 1) * size))
    let m = 0
    for (let i = from; i < to && i < channel.length; i++) { const v = Math.abs(channel[i]); if (v > m) m = v }
    out[b] = Math.min(1, m)
  }
  return out
}

const toDb = (lin: number) => (lin > 1e-6 ? 20 * Math.log10(lin) : -120)
export const peakDb = (x: Float32Array) => { let m = 0; for (let i = 0; i < x.length; i++) { const v = Math.abs(x[i]); if (v > m) m = v } return toDb(m) }
export const rmsDb = (x: Float32Array) => { if (!x.length) return -120; let s = 0; for (let i = 0; i < x.length; i++) s += x[i] * x[i]; return toDb(Math.sqrt(s / x.length)) }

/** Plain-language advice from the measured levels. */
export function levelAdvice(peak: number, rms: number): string {
  if (peak > -0.5) return 'Peaks reach the maximum, so loud parts may distort. Lower the volume or turn on the compressor.'
  if (rms < -30) return 'This audio is very quiet. Try "Boost quiet audio".'
  if (rms > -10) return 'This audio is very loud on average. Consider lowering the volume a little.'
  return 'Levels look healthy for social video.'
}

/** 16-bit PCM WAV, so a processed track can be downloaded and opened anywhere. */
export function audioBufferToWav(buf: Pick<AudioBuffer, 'numberOfChannels' | 'sampleRate' | 'length' | 'getChannelData'>): Blob {
  const ch = buf.numberOfChannels, len = buf.length, bytes = len * ch * 2
  const view = new DataView(new ArrayBuffer(44 + bytes))
  const str = (o: number, s: string) => { for (let i = 0; i < s.length; i++) view.setUint8(o + i, s.charCodeAt(i)) }
  str(0, 'RIFF'); view.setUint32(4, 36 + bytes, true); str(8, 'WAVE'); str(12, 'fmt ')
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, ch, true)
  view.setUint32(24, buf.sampleRate, true); view.setUint32(28, buf.sampleRate * ch * 2, true); view.setUint16(32, ch * 2, true); view.setUint16(34, 16, true)
  str(36, 'data'); view.setUint32(40, bytes, true)
  const chans = Array.from({ length: ch }, (_, c) => buf.getChannelData(c))
  let o = 44
  for (let i = 0; i < len; i++) for (let c = 0; c < ch; c++) { const v = Math.max(-1, Math.min(1, chans[c][i])); view.setInt16(o, v < 0 ? v * 0x8000 : v * 0x7fff, true); o += 2 }
  return new Blob([view], { type: 'audio/wav' })
}

/**
 * For mediabunny's audio `process` hook: the original samples are dropped and the rendered audio is emitted once, at time 0.
 * `fromAudioBuffer` is injected (AudioSample.fromAudioBuffer) so this stays testable without WebCodecs.
 */
export function makeAudioReplacer(rendered: AudioBuffer, fromAudioBuffer: (b: AudioBuffer, t: number) => any[]) {
  let emitted = false
  return (input: { close?: () => void }) => {
    input.close?.()
    if (emitted) return null
    emitted = true
    return fromAudioBuffer(rendered, 0)
  }
}
