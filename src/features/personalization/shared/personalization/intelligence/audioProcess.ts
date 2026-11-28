/**
 * Voice clarity: speech-focused EQ + compression + level matching, rendered offline with the Web Audio API.
 * This is classic signal processing (high-pass, presence boost, compressor), NOT AI noise removal, and is described that way.
 * The result is a new audio track; the original sound is untouched and can be restored.
 */
import { analyzeAudioSamples, recommendGain } from './audioIntel'

export interface VoiceParams {
  highpassHz: number
  presenceHz: number
  presenceDb: number
  thresholdDb: number
  ratio: number
  targetLufs: number
  ceilingDb: number
}

export const VOICE_CLARITY: VoiceParams = { highpassHz: 90, presenceHz: 3000, presenceDb: 3, thresholdDb: -24, ratio: 3, targetLufs: -16, ceilingDb: -1 }

const clamp = (v: number, lo: number, hi: number, d: number) => (Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d)
export function clampVoiceParams(p: Partial<VoiceParams>): VoiceParams {
  const d = VOICE_CLARITY
  return {
    highpassHz: clamp(p.highpassHz ?? d.highpassHz, 20, 300, d.highpassHz), presenceHz: clamp(p.presenceHz ?? d.presenceHz, 1000, 6000, d.presenceHz),
    presenceDb: clamp(p.presenceDb ?? d.presenceDb, -6, 8, d.presenceDb), thresholdDb: clamp(p.thresholdDb ?? d.thresholdDb, -50, 0, d.thresholdDb),
    ratio: clamp(p.ratio ?? d.ratio, 1, 12, d.ratio), targetLufs: clamp(p.targetLufs ?? d.targetLufs, -24, -10, d.targetLufs), ceilingDb: clamp(p.ceilingDb ?? d.ceilingDb, -6, -0.1, d.ceilingDb),
  }
}

/** Scales by `gain`, but never past the ceiling: the peak after scaling is at most `ceilingDb`. Returns the gain actually applied. */
export function applyGainWithCeiling(samples: Float32Array, gain: number, ceilingDb: number): { gain: number } {
  let peak = 0
  for (let i = 0; i < samples.length; i++) { const a = Math.abs(samples[i]!); if (a > peak) peak = a }
  const ceiling = Math.pow(10, ceilingDb / 20)
  const g = peak > 0 ? Math.min(gain, ceiling / peak) : gain
  for (let i = 0; i < samples.length; i++) samples[i]! *= g
  return { gain: g }
}

/** 16-bit PCM mono WAV. */
export function encodeWav(samples: Float32Array, sampleRate: number): Blob {
  const buf = new ArrayBuffer(44 + samples.length * 2)
  const v = new DataView(buf)
  const w = (o: number, s: string) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)) }
  w(0, 'RIFF'); v.setUint32(4, 36 + samples.length * 2, true); w(8, 'WAVE'); w(12, 'fmt ')
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, sampleRate, true)
  v.setUint32(28, sampleRate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); w(36, 'data'); v.setUint32(40, samples.length * 2, true)
  for (let i = 0; i < samples.length; i++) v.setInt16(44 + i * 2, Math.round(Math.max(-1, Math.min(1, samples[i]!)) * 32767), true)
  return new Blob([buf], { type: 'audio/wav' })
}

export const MAX_PROCESS_SECONDS = 300

/** Renders the chain offline, then matches loudness (up OR down) without passing the peak ceiling. Throws if the browser cannot do it. */
export async function renderVoiceClarity(input: { samples: Float32Array; sampleRate: number }, params: VoiceParams, signal?: AbortSignal): Promise<{ samples: Float32Array; sampleRate: number; gainDb: number }> {
  const Offline: typeof OfflineAudioContext | undefined = typeof OfflineAudioContext !== 'undefined' ? OfflineAudioContext : (globalThis as { webkitOfflineAudioContext?: typeof OfflineAudioContext }).webkitOfflineAudioContext
  if (!Offline) throw new Error('This browser cannot process audio here.')
  if (input.samples.length / input.sampleRate > MAX_PROCESS_SECONDS) throw new Error('Voice clarity works on clips up to 5 minutes.')
  const ctx = new Offline(1, input.samples.length, input.sampleRate)
  const buffer = ctx.createBuffer(1, input.samples.length, input.sampleRate)
  buffer.copyToChannel(new Float32Array(input.samples), 0)
  const src = ctx.createBufferSource(); src.buffer = buffer
  const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = params.highpassHz; hp.Q.value = 0.707
  const presence = ctx.createBiquadFilter(); presence.type = 'peaking'; presence.frequency.value = params.presenceHz; presence.Q.value = 0.9; presence.gain.value = params.presenceDb
  const comp = ctx.createDynamicsCompressor(); comp.threshold.value = params.thresholdDb; comp.ratio.value = params.ratio; comp.knee.value = 12; comp.attack.value = 0.01; comp.release.value = 0.25
  src.connect(hp); hp.connect(presence); presence.connect(comp); comp.connect(ctx.destination); src.start()
  const rendered = await ctx.startRendering()
  if (signal?.aborted) throw Object.assign(new Error('Cancelled'), { name: 'AbortError' })
  const out = new Float32Array(rendered.getChannelData(0))
  const plan = recommendGain(analyzeAudioSamples(out, rendered.sampleRate), params.targetLufs, params.ceilingDb)
  const { gain } = applyGainWithCeiling(out, plan.gain, params.ceilingDb)
  return { samples: out, sampleRate: rendered.sampleRate, gainDb: Math.round(20 * Math.log10(Math.max(gain, 1e-6)) * 10) / 10 }
}
