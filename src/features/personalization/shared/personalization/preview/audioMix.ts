/**
 * The personalization audio mix (Stage 4): what the customer chose for the voice (the source video's own audio), the
 * music track, ducking and the final loudness. Pure: validation, defaults, presets and the cache key.
 *
 * The mix is rendered ONCE into a stereo 48 kHz "mixdown" (guided/audioMixdown.ts) by the DSP in audioDsp.ts, and the
 * composition plays that single file with the video muted. The preview and the export therefore play the same audio.
 */
import type { DuckParams, VoiceEq } from './audioDsp'

export const MIX_SAMPLE_RATE = 48000

export interface AudioMixReport {
  voiceLufs: number | null
  musicLufs: number | null
  finalLufs: number | null
  peakDb: number | null
  /** Deepest music reduction caused by ducking, in dB (positive), 0 when ducking is off. */
  duckMaxDb: number
  /** Gain applied to the whole mix by loudness normalisation, in dB. */
  masterGainDb: number
  notes: string[]
}

export interface AudioMixdownRef {
  /** Content key (see audioMixKey). The playable URL is resolved from the registry / local store. */
  key: string
  createdAt: string
  durationSec: number
  report: AudioMixReport
}

export interface AudioMix {
  enabled: boolean
  voice: {
    muted: boolean
    gainDb: number
    eq: VoiceEq
    normalize: { enabled: boolean; targetLufs: number }
  }
  music: {
    gainDb: number
    fadeInSec: number
    fadeOutSec: number
    loop: boolean
    /** Where in the music file playback starts (seconds). */
    startSec: number
    normalize: { enabled: boolean; targetLufs: number }
    duck: { enabled: boolean } & DuckParams
  }
  master: {
    /** Final integrated loudness; null = leave as mixed. */
    targetLufs: number | null
    /** Sample-peak ceiling in dBFS. */
    ceilingDb: number
  }
  mixdown?: AudioMixdownRef
}

export const GAIN_MIN_DB = -40
export const GAIN_MAX_DB = 12
export const LUFS_MIN = -40
export const LUFS_MAX = -6

const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n))
const round = (n: number, d = 2) => Math.round(n * 10 ** d) / 10 ** d
const num = (v: unknown, fallback: number, lo: number, hi: number, d = 2) => round(clamp(finite(v) ? v : fallback, lo, hi), d)

export function defaultAudioMix(): AudioMix {
  return {
    enabled: true,
    voice: { muted: false, gainDb: 0, eq: { highpassHz: 80, lowDb: 0, midDb: 0, highDb: 0 }, normalize: { enabled: true, targetLufs: -16 } },
    music: {
      gainDb: 0, fadeInSec: 1, fadeOutSec: 1.5, loop: true, startSec: 0,
      normalize: { enabled: true, targetLufs: -28 },
      duck: { enabled: true, thresholdDb: -45, amountDb: 12, attackMs: 80, releaseMs: 600, holdMs: 250 },
    },
    master: { targetLufs: -16, ceilingDb: -1 },
  }
}

export interface EqPreset { id: string; label: string; eq: VoiceEq }
export const EQ_PRESETS: readonly EqPreset[] = [
  { id: 'flat', label: 'Flat (rumble filter only)', eq: { highpassHz: 80, lowDb: 0, midDb: 0, highDb: 0 } },
  { id: 'clarity', label: 'Voice clarity', eq: { highpassHz: 90, lowDb: -2, midDb: 3, highDb: 2 } },
  { id: 'warm', label: 'Warm', eq: { highpassHz: 70, lowDb: 3, midDb: 0, highDb: -2 } },
  { id: 'bright', label: 'Bright', eq: { highpassHz: 100, lowDb: -1, midDb: 1, highDb: 4 } },
  { id: 'phone', label: 'Telephone', eq: { highpassHz: 300, lowDb: -6, midDb: 4, highDb: -9 } },
]

export function normalizeAudioMix(raw: unknown): AudioMix | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined
  const r = raw as Record<string, any>
  const d = defaultAudioMix()
  const v = r.voice ?? {}, m = r.music ?? {}, ms = r.master ?? {}
  const eq = v.eq ?? {}
  const duck = m.duck ?? {}
  const out: AudioMix = {
    enabled: r.enabled !== false,
    voice: {
      muted: v.muted === true,
      gainDb: num(v.gainDb, d.voice.gainDb, GAIN_MIN_DB, GAIN_MAX_DB),
      eq: {
        highpassHz: num(eq.highpassHz, d.voice.eq.highpassHz, 0, 500, 0),
        lowDb: num(eq.lowDb, 0, -12, 12, 1),
        midDb: num(eq.midDb, 0, -12, 12, 1),
        highDb: num(eq.highDb, 0, -12, 12, 1),
      },
      normalize: { enabled: v.normalize?.enabled !== false, targetLufs: num(v.normalize?.targetLufs, d.voice.normalize.targetLufs, LUFS_MIN, LUFS_MAX, 1) },
    },
    music: {
      gainDb: num(m.gainDb, d.music.gainDb, GAIN_MIN_DB, GAIN_MAX_DB),
      fadeInSec: num(m.fadeInSec, d.music.fadeInSec, 0, 30),
      fadeOutSec: num(m.fadeOutSec, d.music.fadeOutSec, 0, 30),
      loop: m.loop !== false,
      startSec: num(m.startSec, 0, 0, 36000),
      normalize: { enabled: m.normalize?.enabled !== false, targetLufs: num(m.normalize?.targetLufs, d.music.normalize.targetLufs, LUFS_MIN, LUFS_MAX, 1) },
      duck: {
        enabled: duck.enabled !== false,
        thresholdDb: num(duck.thresholdDb, d.music.duck.thresholdDb, -80, -10, 1),
        amountDb: num(duck.amountDb, d.music.duck.amountDb, 0, 36, 1),
        attackMs: num(duck.attackMs, d.music.duck.attackMs, 5, 2000, 0),
        releaseMs: num(duck.releaseMs, d.music.duck.releaseMs, 20, 5000, 0),
        holdMs: num(duck.holdMs, d.music.duck.holdMs, 0, 2000, 0),
      },
    },
    master: {
      targetLufs: ms.targetLufs === null ? null : num(ms.targetLufs, d.master.targetLufs as number, LUFS_MIN, LUFS_MAX, 1),
      ceilingDb: num(ms.ceilingDb, d.master.ceilingDb, -12, 0, 1),
    },
  }
  const mx = r.mixdown
  if (mx && typeof mx === 'object' && typeof mx.key === 'string' && /^[a-z0-9_-]{8,128}$/i.test(mx.key) && finite(mx.durationSec) && mx.durationSec > 0 && mx.durationSec < 36000) {
    const rep = mx.report && typeof mx.report === 'object' ? mx.report : {}
    const n = (x: unknown) => (finite(x) ? round(x, 2) : null)
    out.mixdown = {
      key: mx.key,
      createdAt: typeof mx.createdAt === 'string' ? mx.createdAt.slice(0, 40) : '',
      durationSec: round(mx.durationSec, 3),
      report: {
        voiceLufs: n(rep.voiceLufs), musicLufs: n(rep.musicLufs), finalLufs: n(rep.finalLufs), peakDb: n(rep.peakDb),
        duckMaxDb: finite(rep.duckMaxDb) ? round(rep.duckMaxDb, 1) : 0,
        masterGainDb: finite(rep.masterGainDb) ? round(rep.masterGainDb, 1) : 0,
        notes: Array.isArray(rep.notes) ? rep.notes.filter((x: unknown) => typeof x === 'string').slice(0, 8).map((x: string) => x.slice(0, 200)) : [],
      },
    }
  }
  return out
}

function hashString(s: string): string {
  let h1 = 0xdeadbeef ^ s.length
  let h2 = 0x41c6ce57 ^ s.length
  for (let i = 0; i < s.length; i += 1) {
    const c = s.charCodeAt(i)
    h1 = Math.imul(h1 ^ c, 2654435761)
    h2 = Math.imul(h2 ^ c, 1597334677)
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909)
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909)
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36)
}

/** Everything that changes the rendered audio, and nothing else (the mixdown reference itself is excluded). */
export function audioMixKey(voiceUrl: string | null | undefined, musicUrl: string | null | undefined, mix: AudioMix, durationSec: number): string {
  const { mixdown: _ignored, ...settings } = mix
  void _ignored
  return `am_${hashString(JSON.stringify([voiceUrl ?? '', musicUrl ?? '', settings, round(durationSec, 3), MIX_SAMPLE_RATE, 'v1']))}`
}

/** Whether the stored mixdown was made from exactly the current sources and settings. */
export function mixdownIsCurrent(mix: AudioMix | undefined, voiceUrl: string | null | undefined, musicUrl: string | null | undefined, durationSec: number): boolean {
  return Boolean(mix?.enabled && mix.mixdown && mix.mixdown.key === audioMixKey(voiceUrl, musicUrl, mix, durationSec))
}

/** What the composition must do with audio. */
export interface AudioPlan {
  /** Play the mixdown and mute every source. */
  useMixdown: boolean
  /** Why the mix is not being applied although the customer asked for one (shown in the panel). */
  pending: null | 'not-applied' | 'stale'
}

export function audioPlan(mix: AudioMix | undefined, voiceUrl: string | null | undefined, musicUrl: string | null | undefined, durationSec: number, mixdownUrl: string | null): AudioPlan {
  if (!mix || !mix.enabled) return { useMixdown: false, pending: null }
  if (!mix.mixdown) return { useMixdown: false, pending: 'not-applied' }
  if (!mixdownIsCurrent(mix, voiceUrl, musicUrl, durationSec)) return { useMixdown: false, pending: 'stale' }
  if (!mixdownUrl) return { useMixdown: false, pending: 'not-applied' }
  return { useMixdown: true, pending: null }
}
