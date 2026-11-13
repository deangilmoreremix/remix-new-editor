/**
 * Measurements shown in the audio panel (Stage 4): loudness of the voice and the music, quiet gaps in the voice and the
 * music's tempo and beats. Reuses the app's existing silence and beat analysers (src/openchatcut/audio) on the same
 * decoded samples the mixdown uses, plus the BS.1770 meter from preview/audioDsp.
 */
import { integratedLoudness } from '../preview/audioDsp'
import type { DecodedAudio } from './audioMixdown'
import { defaultMixdownDeps } from './audioMixdown'

export interface AudioAnalysis {
  voice: null | { lufs: number | null; durationSec: number; quietGaps: Array<{ startSec: number; endSec: number }> }
  music: null | { lufs: number | null; durationSec: number; bpm: number; confidence: number; beats: number[] }
}

const mono = (d: DecodedAudio): Float32Array => {
  const out = new Float32Array(d.channels[0].length)
  for (const ch of d.channels) for (let i = 0; i < out.length; i += 1) out[i] += (ch[i] ?? 0) / d.channels.length
  return out
}
const lufsOrNull = (v: number) => (Number.isFinite(v) ? Math.round(v * 10) / 10 : null)

export async function analyzeAudioSources(
  voiceUrl: string | null,
  musicUrl: string | null,
  signal?: AbortSignal,
  decode: (url: string, signal?: AbortSignal) => Promise<DecodedAudio | null> = defaultMixdownDeps.decode,
): Promise<AudioAnalysis> {
  const out: AudioAnalysis = { voice: null, music: null }
  if (voiceUrl) {
    const d = await decode(voiceUrl, signal)
    if (d && d.channels[0]?.length) {
      const { rmsEnvelope, detectSilentSpans } = await import('../../../../../openchatcut/audio/silence')
      const env = rmsEnvelope(mono(d), d.sampleRate, 50)
      out.voice = {
        lufs: lufsOrNull(integratedLoudness(d.channels, d.sampleRate)),
        durationSec: d.channels[0].length / d.sampleRate,
        quietGaps: detectSilentSpans(env, 50).map((s) => ({ startSec: s.startMs / 1000, endSec: s.endMs / 1000 })),
      }
    }
  }
  if (musicUrl) {
    const d = await decode(musicUrl, signal)
    if (d && d.channels[0]?.length) {
      const { analyzeBeats } = await import('../../../../../openchatcut/audio/beats')
      const b = analyzeBeats(mono(d), d.sampleRate)
      out.music = { lufs: lufsOrNull(integratedLoudness(d.channels, d.sampleRate)), durationSec: d.channels[0].length / d.sampleRate, bpm: b.bpm, confidence: b.confidence, beats: b.beats }
    }
  }
  return out
}
