/**
 * Audio mix: several tracks (music, voiceover) over the video's own sound.
 *
 * Everything here is pure and works in frames, so the live Player and the browser export compute exactly the same gain for
 * every frame. A track starts `start` seconds into the video, skips its first `trimStart` seconds, may be cut short with
 * `length`, and fades in and out. Mute and solo decide what is audible; the video's own sound is a channel of the mix too.
 */
import type { PreviewAudioSelection } from './types'

export type AudioTrackKind = 'music' | 'voiceover'

export interface AudioTrack {
  id: string
  url: string
  name: string
  kind: AudioTrackKind
  /** 0..1 */
  volume: number
  /** Seconds. */
  fadeIn: number
  fadeOut: number
  /** Seconds into the video where the track begins to play. */
  start: number
  /** Seconds of the file to skip. */
  trimStart: number
  /** Seconds to play; undefined = until the file or the video ends. */
  length?: number
  muted: boolean
}

export const MAX_AUDIO_TRACKS = 6
/** `solo` value that isolates the video's own sound. */
export const SOLO_VIDEO = 'video'

export interface AudioMixSettings {
  audioTracks?: AudioTrack[]
  /** The video's own sound, 0..1 (default 1). */
  videoVolume?: number
  videoMuted?: boolean
  /** Seconds to fade the video's own sound in at the start and out at the end. */
  videoFadeIn?: number
  videoFadeOut?: number
  /** A track id or SOLO_VIDEO. Only that channel is audible. */
  audioSolo?: string
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const text = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null)

export function newAudioTrack(patch: Pick<AudioTrack, 'url' | 'name' | 'kind'> & Partial<AudioTrack>): AudioTrack {
  return {
    id: patch.id ?? `audio_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
    url: patch.url,
    name: patch.name,
    kind: patch.kind,
    // Voiceover sits on top, music sits under it.
    volume: patch.volume ?? (patch.kind === 'music' ? 0.5 : 1),
    fadeIn: patch.fadeIn ?? 0,
    fadeOut: patch.fadeOut ?? 0,
    start: patch.start ?? 0,
    trimStart: patch.trimStart ?? 0,
    length: patch.length,
    muted: patch.muted ?? false,
  }
}

/** Reads one saved track defensively. Session-only (blob:/data:) URLs are dropped because they die on reload. */
export function normalizeAudioTrack(raw: unknown): AudioTrack | null {
  if (!isRecord(raw)) return null
  const url = text(raw.url)
  const id = text(raw.id)
  if (!url || !id || /^(blob:|data:)/i.test(url)) return null
  const track: AudioTrack = {
    id,
    url,
    name: text(raw.name) ?? 'Audio',
    kind: raw.kind === 'voiceover' ? 'voiceover' : 'music',
    volume: finite(raw.volume) ? clamp(raw.volume, 0, 1) : 1,
    fadeIn: finite(raw.fadeIn) ? clamp(raw.fadeIn, 0, 30) : 0,
    fadeOut: finite(raw.fadeOut) ? clamp(raw.fadeOut, 0, 30) : 0,
    start: finite(raw.start) ? clamp(raw.start, 0, 3600) : 0,
    trimStart: finite(raw.trimStart) ? clamp(raw.trimStart, 0, 3600) : 0,
    muted: raw.muted === true,
  }
  if (finite(raw.length) && raw.length > 0) track.length = clamp(raw.length, 0.1, 3600)
  return track
}

export function normalizeAudioTracks(raw: unknown): AudioTrack[] | undefined {
  if (!Array.isArray(raw)) return undefined
  const seen = new Set<string>()
  const out: AudioTrack[] = []
  for (const item of raw) {
    const t = normalizeAudioTrack(item)
    if (t && !seen.has(t.id)) { seen.add(t.id); out.push(t) }
    if (out.length >= MAX_AUDIO_TRACKS) break
  }
  return out.length ? out : undefined
}

export function normalizeVideoVolume(raw: unknown): number | undefined {
  return finite(raw) && raw >= 0 && raw < 1 ? clamp(raw, 0, 1) : undefined
}

/** The tracks to play: the mix's own, or the old single track (and a recast's sound) as one music track at full level. */
export function effectiveTracks(settings: AudioMixSettings & { audio?: PreviewAudioSelection | null }, legacyUrl?: string | null): AudioTrack[] {
  if (settings.audioTracks?.length) return settings.audioTracks
  const url = settings.audio?.url ?? legacyUrl ?? null
  return url ? [newAudioTrack({ id: 'legacy', url, name: settings.audio?.name ?? 'Audio', kind: 'music', volume: 1 })] : []
}

/** Is a channel audible after mute and solo? */
export function isAudible(channel: { id: string; muted: boolean }, solo?: string): boolean {
  if (solo) return channel.id === solo
  return !channel.muted
}

/** Gain of the video's own sound (0..1). */
export function videoGain(settings: AudioMixSettings): number {
  const volume = settings.videoVolume ?? 1
  return isAudible({ id: SOLO_VIDEO, muted: settings.videoMuted === true }, settings.audioSolo) ? clamp(volume, 0, 1) : 0
}

/** Gain of the video's own sound at a frame, including its fade-in and fade-out (0..1). */
export function videoGainAt(settings: AudioMixSettings & { fps: number; durationInFrames: number }, frame: number): number {
  const base = videoGain(settings)
  const fi = Math.max(0, settings.videoFadeIn ?? 0) * settings.fps
  const fo = Math.max(0, settings.videoFadeOut ?? 0) * settings.fps
  let g = 1
  if (fi > 0 && frame < fi) g = Math.min(g, Math.max(0, frame / fi))
  if (fo > 0 && frame > settings.durationInFrames - fo) g = Math.min(g, Math.max(0, (settings.durationInFrames - frame) / fo))
  return base * g
}

export interface TrackWindow {
  /** First composition frame the track plays. */
  startFrame: number
  /** Frames of the FILE to skip. */
  trimFrames: number
  /** Frame (exclusive) where it stops, or undefined to run to the end. */
  endFrame: number | undefined
}

export function trackWindow(track: AudioTrack, fps: number, durationInFrames: number): TrackWindow {
  const f = Math.max(1, fps)
  const startFrame = clamp(Math.round(track.start * f), 0, Math.max(0, durationInFrames - 1))
  const end = track.length !== undefined ? startFrame + Math.max(1, Math.round(track.length * f)) : undefined
  return { startFrame, trimFrames: Math.round(track.trimStart * f), endFrame: end !== undefined ? Math.min(end, durationInFrames) : undefined }
}

/**
 * The track's gain at a composition frame: 0 outside its window, ramping in over `fadeIn` and out over `fadeOut`
 * (the end being where it stops: its length, or the end of the video), times its volume, and 0 if muted or not soloed.
 */
export function trackGainAt(track: AudioTrack, frame: number, fps: number, durationInFrames: number, solo?: string): number {
  if (!isAudible(track, solo)) return 0
  const f = Math.max(1, fps)
  const w = trackWindow(track, f, durationInFrames)
  const end = w.endFrame ?? durationInFrames
  if (frame < w.startFrame || frame >= end) return 0
  const fadeInFrames = Math.round(track.fadeIn * f)
  const fadeOutFrames = Math.round(track.fadeOut * f)
  let g = 1
  if (fadeInFrames > 0) g = Math.min(g, clamp((frame - w.startFrame) / fadeInFrames, 0, 1))
  if (fadeOutFrames > 0) g = Math.min(g, clamp((end - frame) / fadeOutFrames, 0, 1))
  return clamp(track.volume, 0, 1) * g
}

export function hasMixEdits(s: AudioMixSettings): boolean {
  return Boolean(s.audioTracks?.length) || (s.videoVolume !== undefined && s.videoVolume < 1) || s.videoMuted === true || Boolean(s.audioSolo)
}
