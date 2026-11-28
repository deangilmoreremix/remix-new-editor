/**
 * Audio checks on decoded samples: clipping, peak, loudness, silence and a safe gain recommendation.
 * Reuses the editor's loudness and silence cores (no second implementation). Analysis only: the customer chooses
 * whether to apply the recommended volume, and silence is reported as suggested cuts, never removed.
 */
import { integratedLoudnessFromSamples } from '../../../../../openchatcut/audio/loudness'
import { detectSilentSpans, rmsEnvelope, type SilenceSpan } from '../../../../../openchatcut/audio/silence'

export interface AudioReport {
  durationSec: number
  peakDb: number
  rmsDb: number
  /** Integrated loudness in LUFS, or null when the clip is too quiet/short to measure. */
  lufs: number | null
  clippedSamples: number
  clipped: boolean
  nearClipping: boolean
  silent: boolean
  silences: SilenceSpan[]
}

export const TARGET_LUFS = -16
export const PEAK_CEILING_DB = -1
const toDb = (v: number) => 20 * Math.log10(Math.max(v, 1e-8))

export function analyzeAudioSamples(samples: Float32Array, sampleRate: number): AudioReport {
  let peak = 0, sumSq = 0, clipped = 0
  for (let i = 0; i < samples.length; i++) {
    const a = Math.abs(samples[i]!)
    if (a > peak) peak = a
    sumSq += a * a
    if (a >= 0.999) clipped++
  }
  const rms = samples.length ? Math.sqrt(sumSq / samples.length) : 0
  const peakDb = toDb(peak)
  let lufs: number | null = null
  try {
    const l = integratedLoudnessFromSamples(samples, sampleRate)
    lufs = Number.isFinite(l) && l > -70 ? l : null
  } catch { lufs = null }
  const silences = detectSilentSpans(rmsEnvelope(samples, sampleRate, 50), 50)
  return {
    durationSec: sampleRate > 0 ? samples.length / sampleRate : 0,
    peakDb, rmsDb: toDb(rms), lufs,
    clippedSamples: clipped,
    // A handful of full-scale samples is normal; a real clip is a run of them.
    clipped: clipped >= 4,
    nearClipping: peakDb > -1 && clipped < 4,
    silent: peak < 0.001,
    silences,
  }
}

export interface GainPlan { gainDb: number; gain: number; reason: string; limitedByPeak: boolean }

/** Gain that moves the clip toward the loudness target without pushing peaks past the ceiling. */
export function recommendGain(report: Pick<AudioReport, 'lufs' | 'peakDb' | 'silent'>, targetLufs = TARGET_LUFS, ceilingDb = PEAK_CEILING_DB): GainPlan {
  if (report.silent) return { gainDb: 0, gain: 1, reason: 'No sound was found in this clip.', limitedByPeak: false }
  if (report.lufs == null) return { gainDb: 0, gain: 1, reason: 'Loudness could not be measured, so the volume was left as it is.', limitedByPeak: false }
  const wanted = targetLufs - report.lufs
  const headroom = ceilingDb - report.peakDb
  const gainDb = Math.max(-12, Math.min(wanted, headroom, 12))
  const limitedByPeak = wanted > headroom + 0.05
  const rounded = Math.round(gainDb * 10) / 10
  return {
    gainDb: rounded, gain: Math.pow(10, rounded / 20), limitedByPeak,
    reason: Math.abs(rounded) < 0.5 ? 'Volume is already close to a good level.' : limitedByPeak ? 'Raised as far as the loudest peaks allow without distortion.' : `${rounded > 0 ? 'Raised' : 'Lowered'} by ${Math.abs(rounded)} dB toward a consistent speaking level.`,
  }
}

/** Linear gain 0..1 at time t for a fade-in/out envelope (seconds). */
export function fadeGainAt(t: number, duration: number, fadeIn: number, fadeOut: number): number {
  let g = 1
  if (fadeIn > 0 && t < fadeIn) g = Math.min(g, Math.max(0, t / fadeIn))
  if (fadeOut > 0 && t > duration - fadeOut) g = Math.min(g, Math.max(0, (duration - t) / fadeOut))
  return g
}

/** Decodes the audio of a media URL to mono samples (first `maxSeconds`). Returns null if it has no decodable audio. */
export async function decodeMediaAudio(url: string, opts: { maxSeconds?: number; signal?: AbortSignal } = {}): Promise<{ samples: Float32Array; sampleRate: number } | null> {
  try {
    const Ctor: typeof AudioContext | undefined = typeof AudioContext !== 'undefined' ? AudioContext : (globalThis as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctor) return null
    const res = await fetch(url, { signal: opts.signal })
    if (!res.ok) return null
    const buf = await res.arrayBuffer()
    const ctx = new Ctor()
    try {
      const audio = await ctx.decodeAudioData(buf)
      const n = Math.min(audio.length, Math.floor((opts.maxSeconds ?? 600) * audio.sampleRate))
      const mono = new Float32Array(n)
      for (let c = 0; c < audio.numberOfChannels; c++) {
        const ch = audio.getChannelData(c)
        for (let i = 0; i < n; i++) mono[i]! += ch[i]! / audio.numberOfChannels
      }
      return { samples: mono, sampleRate: audio.sampleRate }
    } finally { void ctx.close?.() }
  } catch { return null }
}
