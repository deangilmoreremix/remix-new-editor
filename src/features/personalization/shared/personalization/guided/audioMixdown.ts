/**
 * Renders the personalization audio mix (Stage 4) into ONE stereo 48 kHz WAV, caches it, and prepares it for export.
 *
 *   renderMix            pure: decoded voice + music + settings → stereo channels + a measured report
 *   bakeAudioMix         decode (injected), render, encode WAV, store under the mix's content key (reused when nothing changed)
 *   prepareAudioForExport  called by the exporter: makes sure a CURRENT mixdown exists before the render starts
 *
 * The composition plays this file with the video muted, so the preview and the export play the same samples.
 */
import {
  applyEq, applyFades, applyGainCurve, applyGainDb, duckingCurve, integratedLoudness, levelEnvelopeDb, limit, lin2db, peakDb,
} from '../preview/audioDsp'
import { MIX_SAMPLE_RATE, audioMixKey, mixdownIsCurrent, type AudioMix, type AudioMixReport, type AudioMixdownRef } from '../preview/audioMix'
import { resolveMatteUrl } from '../preview/presenterMatteRegistry'
import type { PreviewInputProps } from '../preview/types'
import { ensureMatteUrl, getDefaultStore, saveMatte, type BlobStore } from './presenterMatteStore'


export interface DecodedAudio { channels: Float32Array[]; sampleRate: number }

export interface MixdownDeps {
  /** Decodes a media URL's audio. null = the file has no audio track (or none this browser can decode). */
  decode(url: string, signal?: AbortSignal): Promise<DecodedAudio | null>
  now(): string
}

export class MixError extends Error {
  constructor(message: string, readonly code: 'DECODE' | 'ABORTED' | 'EMPTY') {
    super(message)
    this.name = 'MixError'
  }
}

export const defaultMixdownDeps: MixdownDeps = {
  decode: async (url, signal) => {
    const res = await fetch(url, { signal })
    if (!res.ok) throw new MixError(`Couldn't load the audio (HTTP ${res.status}).`, 'DECODE')
    const bytes = await res.arrayBuffer()
    // Decoding at the mix rate lets the browser resample with its own high-quality converter.
    const ctx = new OfflineAudioContext(2, 1, MIX_SAMPLE_RATE)
    try {
      const buf = await ctx.decodeAudioData(bytes)
      return { channels: Array.from({ length: Math.min(2, buf.numberOfChannels) }, (_, c) => buf.getChannelData(c).slice()), sampleRate: buf.sampleRate }
    } catch {
      return null
    }
  },
  now: () => new Date().toISOString(),
}

// ── pure rendering ───────────────────────────────────────────────────────────────────────────────────────────────

/** Linear-interpolation resampler (only used when a decoder returns something other than the mix rate). */
export function resampleLinear(x: Float32Array, from: number, to: number): Float32Array {
  if (from === to || x.length === 0) return x
  const n = Math.max(1, Math.round((x.length * to) / from))
  const y = new Float32Array(n)
  const ratio = from / to
  for (let i = 0; i < n; i += 1) {
    const p = i * ratio
    const a = Math.min(x.length - 1, Math.floor(p))
    const b = Math.min(x.length - 1, a + 1)
    y[i] = x[a] + (x[b] - x[a]) * (p - a)
  }
  return y
}

const stereo = (d: DecodedAudio): [Float32Array, Float32Array] => {
  const l = resampleLinear(d.channels[0], d.sampleRate, MIX_SAMPLE_RATE)
  const r = d.channels[1] ? resampleLinear(d.channels[1], d.sampleRate, MIX_SAMPLE_RATE) : l
  return [l, r]
}

const fitTo = (x: Float32Array, n: number): Float32Array => {
  if (x.length === n) return x
  const y = new Float32Array(n)
  y.set(x.subarray(0, Math.min(n, x.length)))
  return y
}

const sumInto = (a: Float32Array[], b: Float32Array[]) => a.map((ch, c) => { const y = new Float32Array(ch.length); for (let i = 0; i < ch.length; i += 1) y[i] = ch[i] + (b[c]?.[i] ?? 0); return y })
const clampGain = (db: number, lim: number) => Math.max(-lim, Math.min(lim, db))
const finiteOrNull = (v: number) => (Number.isFinite(v) ? Math.round(v * 100) / 100 : null)
/** 5 ms dips at loop points avoid a click where the end of the music meets its start. */
const LOOP_EDGE_SEC = 0.005

export function renderMix(voice: DecodedAudio | null, music: DecodedAudio | null, mix: AudioMix, durationSec: number): { channels: [Float32Array, Float32Array]; report: AudioMixReport } {
  const fs = MIX_SAMPLE_RATE
  const N = Math.max(1, Math.round(durationSec * fs))
  const notes: string[] = []
  const silent = (): Float32Array[] => [new Float32Array(N), new Float32Array(N)]
  const report: AudioMixReport = { voiceLufs: null, musicLufs: null, finalLufs: null, peakDb: null, duckMaxDb: 0, masterGainDb: 0, notes }

  // voice
  let v: Float32Array[] = silent()
  let voiceActive = false
  if (voice && voice.channels.length && voice.channels[0].length) {
    const [l, r] = stereo(voice).map((c) => fitTo(c, N))
    const eq = [applyEq(l, mix.voice.eq, fs), applyEq(r, mix.voice.eq, fs)]
    const lufs = integratedLoudness(eq, fs)
    report.voiceLufs = finiteOrNull(lufs)
    let g = mix.voice.gainDb
    if (mix.voice.normalize.enabled && Number.isFinite(lufs) && lufs > -69) g += clampGain(mix.voice.normalize.targetLufs - lufs, 24)
    else if (mix.voice.normalize.enabled) notes.push('The voice is too quiet to measure, so it was not normalised.')
    if (mix.voice.muted) notes.push('The voice is muted.')
    else { v = eq.map((c) => applyGainDb(c, g)); voiceActive = true }
  } else if (!mix.voice.muted) notes.push('The video has no audio track the browser can decode, so there is no voice in the mix.')

  // music
  let m: Float32Array[] = silent()
  if (music && music.channels.length && music.channels[0].length) {
    const [ml, mr] = stereo(music)
    const len = ml.length
    const start = Math.min(len - 1, Math.max(0, Math.round(mix.music.startSec * fs)))
    const region = len - start
    const edge = Math.round(LOOP_EDGE_SEC * fs)
    const seg = [new Float32Array(N), new Float32Array(N)]
    for (let i = 0; i < N; i += 1) {
      let idx = i, gain = 1
      if (i >= region) {
        if (!mix.music.loop) break
        idx = i % region
        const fromWrap = idx, toWrap = region - idx
        if (fromWrap < edge) gain = fromWrap / edge
        else if (toWrap < edge) gain = toWrap / edge
      } else if (mix.music.loop && region - i < edge && region < N) gain = (region - i) / edge
      seg[0][i] = ml[start + idx] * gain
      seg[1][i] = mr[start + idx] * gain
    }
    const lufs = integratedLoudness(seg, fs)
    report.musicLufs = finiteOrNull(lufs)
    let g = mix.music.gainDb
    if (mix.music.normalize.enabled && Number.isFinite(lufs) && lufs > -69) g += clampGain(mix.music.normalize.targetLufs - lufs, 24)
    m = seg.map((c) => applyGainDb(c, g))
    if (mix.music.duck.enabled && voiceActive && mix.music.duck.amountDb > 0) {
      const hopSec = 0.01
      const env = levelEnvelopeDb(v, fs, hopSec)
      const curve = duckingCurve(env, hopSec, mix.music.duck)
      let lo = 1
      for (const c of curve) if (c < lo) lo = c
      report.duckMaxDb = Math.round(-lin2db(lo) * 10) / 10
      const hopSamples = Math.round(hopSec * fs)
      m = m.map((c) => applyGainCurve(c, curve, hopSamples))
    } else if (mix.music.duck.enabled && !voiceActive) notes.push('There is no voice to duck the music under.')
    m = m.map((c) => applyFades(c, fs, mix.music.fadeInSec, mix.music.fadeOutSec))
  }

  // master: loudness first, then the peak ceiling; re-measure because limiting changes loudness
  let out: Float32Array[] = sumInto(v, m)
  const target = mix.master.targetLufs
  if (target !== null) {
    const measured = integratedLoudness(out, fs)
    if (Number.isFinite(measured) && measured > -69) {
      const g = clampGain(target - measured, 30)
      out = out.map((c) => applyGainDb(c, g))
      report.masterGainDb = Math.round(g * 10) / 10
    } else notes.push('The mix is too quiet to measure, so the final loudness was not set.')
  }
  out = limit(out, fs, mix.master.ceilingDb)
  if (target !== null) {
    for (let pass = 0; pass < 3; pass += 1) {
      const now = integratedLoudness(out, fs)
      if (!Number.isFinite(now) || Math.abs(now - target) <= 0.2) break
      const g = clampGain(target - now, 6)
      out = limit(out.map((c) => applyGainDb(c, g)), fs, mix.master.ceilingDb)
      report.masterGainDb = Math.round((report.masterGainDb + g) * 10) / 10
    }
    const final = integratedLoudness(out, fs)
    if (Number.isFinite(final) && final < target - 0.5) notes.push(`The peak ceiling (${mix.master.ceilingDb} dB) kept the mix ${(target - final).toFixed(1)} LU below the ${target} LUFS target.`)
  }
  report.finalLufs = finiteOrNull(integratedLoudness(out, fs))
  report.peakDb = finiteOrNull(peakDb(out))
  if (!voiceActive && !(music && music.channels.length)) notes.push('Nothing audible: the mix is silent.')
  return { channels: [out[0], out[1]], report }
}

/** 16-bit PCM stereo WAV (little-endian). Values are clamped, not dithered. */
export function encodeWav16(channels: Float32Array[], fs: number): Uint8Array {
  const n = channels[0]?.length ?? 0
  const nch = channels.length
  const bytes = new Uint8Array(44 + n * nch * 2)
  const dv = new DataView(bytes.buffer)
  const str = (o: number, s: string) => { for (let i = 0; i < s.length; i += 1) dv.setUint8(o + i, s.charCodeAt(i)) }
  str(0, 'RIFF'); dv.setUint32(4, 36 + n * nch * 2, true); str(8, 'WAVE'); str(12, 'fmt ')
  dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, nch, true); dv.setUint32(24, fs, true)
  dv.setUint32(28, fs * nch * 2, true); dv.setUint16(32, nch * 2, true); dv.setUint16(34, 16, true)
  str(36, 'data'); dv.setUint32(40, n * nch * 2, true)
  let o = 44
  for (let i = 0; i < n; i += 1) for (let c = 0; c < nch; c += 1) { const s = Math.max(-1, Math.min(1, channels[c][i])); dv.setInt16(o, s < 0 ? Math.round(s * 32768) : Math.round(s * 32767), true); o += 2 }
  return bytes
}

// ── baking and export ────────────────────────────────────────────────────────────────────────────────────────────

export interface MixBakeResult { mixdown: AudioMixdownRef; url: string; reused: boolean }

export async function bakeAudioMix(
  voiceUrl: string | null,
  musicUrl: string | null,
  mix: AudioMix,
  durationSec: number,
  hooks: { signal?: AbortSignal; force?: boolean } = {},
  store: BlobStore = getDefaultStore(),
  deps: MixdownDeps = defaultMixdownDeps,
): Promise<MixBakeResult> {
  const { signal } = hooks
  if (signal?.aborted) throw new MixError('Cancelled', 'ABORTED')
  const key = audioMixKey(voiceUrl, musicUrl, mix, durationSec)
  if (!hooks.force) {
    const rec = await store.get(key).catch(() => undefined)
    if (rec) {
      const url = await ensureMatteUrl({ key }, store)
      const prior = mix.mixdown?.key === key ? mix.mixdown : undefined
      if (url) return { mixdown: prior ?? { key, createdAt: rec.createdAt, durationSec, report: (rec as any).report ?? emptyReport() }, url, reused: true }
    }
  }
  const [voice, music] = await Promise.all([
    voiceUrl && !mix.voice.muted ? deps.decode(voiceUrl, signal) : Promise.resolve(null),
    musicUrl ? deps.decode(musicUrl, signal) : Promise.resolve(null),
  ])
  if (signal?.aborted) throw new MixError('Cancelled', 'ABORTED')
  if (musicUrl && !music) throw new MixError('The music track could not be decoded by this browser.', 'DECODE')
  const { channels, report } = renderMix(voice, music, mix, durationSec)
  const wav = encodeWav16(channels, MIX_SAMPLE_RATE)
  const createdAt = deps.now()
  const blob = new Blob([wav as unknown as BlobPart], { type: 'audio/wav' })
  const url = await saveMatte(key, { blob, sourceUrl: voiceUrl ?? '', engine: 'audio-mix', createdAt, ...({ report } as object) } as never, store)
  return { mixdown: { key, createdAt, durationSec, report }, url, reused: false }
}

const emptyReport = (): AudioMixReport => ({ voiceLufs: null, musicLufs: null, finalLufs: null, peakDb: null, duckMaxDb: 0, masterGainDb: 0, notes: [] })

/** What the exporter needs to know about a project's audio. */
export function audioSourcesOf(inputProps: Pick<PreviewInputProps, 'videoUrl' | 'audioUrl' | 'isImageSource' | 'settings'>) {
  const fps = inputProps.settings.fps > 0 ? inputProps.settings.fps : 30
  return {
    voiceUrl: inputProps.isImageSource ? null : inputProps.videoUrl ?? null,
    musicUrl: inputProps.audioUrl ?? null,
    durationSec: Math.max(1, Math.round(inputProps.settings.durationInFrames)) / fps,
  }
}

export type PrepareAudioResult = { ok: true; inputProps: PreviewInputProps; baked: boolean } | { ok: false; error: string }

/**
 * Called before an export: when the project has an audio mix, make sure a mixdown made from the CURRENT sources and
 * settings exists (render it now if the customer never applied it, or changed something since). Without a mix the
 * project is returned untouched.
 */
export async function prepareAudioForExport(
  inputProps: PreviewInputProps,
  hooks: { signal?: AbortSignal } = {},
  store: BlobStore = getDefaultStore(),
  deps: MixdownDeps = defaultMixdownDeps,
): Promise<PrepareAudioResult> {
  const mix = inputProps.settings.audioMix
  if (!mix?.enabled) return { ok: true, inputProps, baked: false }
  const { voiceUrl, musicUrl, durationSec } = audioSourcesOf(inputProps)
  if (mixdownIsCurrent(mix, voiceUrl, musicUrl, durationSec) && resolveMatteUrl({ key: mix.mixdown!.key })) return { ok: true, inputProps, baked: false }
  try {
    const r = await bakeAudioMix(voiceUrl, musicUrl, mix, durationSec, hooks, store, deps)
    return { ok: true, baked: !r.reused, inputProps: { ...inputProps, settings: { ...inputProps.settings, audioMix: { ...mix, mixdown: r.mixdown } } } }
  } catch (error) {
    if ((error as MixError)?.code === 'ABORTED') return { ok: false, error: 'Render cancelled.' }
    return { ok: false, error: `The audio mix could not be prepared: ${(error as Error)?.message ?? error}` }
  }
}
