import { describe, expect, it } from 'vitest'
import {
  MAX_AUDIO_TRACKS, SOLO_VIDEO, effectiveTracks, hasMixEdits, isAudible, newAudioTrack, normalizeAudioTrack, normalizeAudioTracks,
  normalizeVideoVolume, trackGainAt, trackWindow, videoGain,
} from '../audioMix'
import { normalizePreviewSettings } from '../presets'

const FPS = 30
const DUR = 150
const t = (p: Partial<Parameters<typeof newAudioTrack>[0]> = {}) => newAudioTrack({ id: 'a', url: 'https://x/a.mp3', name: 'a', kind: 'music', volume: 1, ...p })
const gain = (track: ReturnType<typeof t>, frame: number, solo?: string) => trackGainAt(track, frame, FPS, DUR, solo)

describe('trackGainAt', () => {
  it('plays at its volume from the start to the end of the video', () => {
    expect(gain(t({ volume: 0.5 }), 0)).toBe(0.5)
    expect(gain(t({ volume: 0.5 }), 149)).toBe(0.5)
  })
  it('is silent before its start offset', () => {
    const track = t({ start: 2 })
    expect(gain(track, 59)).toBe(0)
    expect(gain(track, 60)).toBe(1)
  })
  it('ramps up over the fade-in and down over the fade-out', () => {
    const track = t({ fadeIn: 1, fadeOut: 1 })
    expect(gain(track, 0)).toBe(0)
    expect(gain(track, 15)).toBeCloseTo(0.5, 6)
    expect(gain(track, 30)).toBe(1)
    expect(gain(track, 120)).toBe(1)
    expect(gain(track, 135)).toBeCloseTo(0.5, 6)
    expect(gain(track, 149)).toBeCloseTo(1 / 30, 6)
  })
  it('fades relative to its own start and length, not the video', () => {
    const track = t({ start: 1, length: 2, fadeIn: 0.5, fadeOut: 0.5 })
    expect(gain(track, 29)).toBe(0)
    expect(gain(track, 30)).toBe(0)
    expect(gain(track, 37.5)).toBeCloseTo(0.5, 6)
    expect(gain(track, 45)).toBe(1)
    expect(gain(track, 82)).toBeCloseTo(8 / 15, 6)
    expect(gain(track, 90)).toBe(0)
  })
  it('a fade longer than the track never exceeds the shorter ramp', () => {
    const track = t({ length: 1, fadeIn: 5, fadeOut: 5 })
    expect(gain(track, 15)).toBeLessThan(0.2)
  })
  it('mute silences it; solo isolates one channel', () => {
    expect(gain(t({ muted: true }), 10)).toBe(0)
    expect(gain(t(), 10, 'other')).toBe(0)
    expect(gain(t(), 10, 'a')).toBe(1)
    expect(gain(t({ muted: true }), 10, 'a')).toBe(1) // solo wins over mute for the soloed channel
    expect(gain(t(), 10, SOLO_VIDEO)).toBe(0)
  })
})

describe('trackWindow', () => {
  it('converts seconds to frames and caps the end at the video', () => {
    expect(trackWindow(t({ start: 1, trimStart: 2, length: 1 }), FPS, DUR)).toEqual({ startFrame: 30, trimFrames: 60, endFrame: 60 })
    expect(trackWindow(t({ start: 4, length: 10 }), FPS, DUR).endFrame).toBe(DUR)
    expect(trackWindow(t({ start: 99 }), FPS, DUR).startFrame).toBe(DUR - 1)
  })
})

describe('video sound', () => {
  it('is full by default, scaled by volume, silent when muted or another channel is soloed', () => {
    expect(videoGain({})).toBe(1)
    expect(videoGain({ videoVolume: 0.3 })).toBe(0.3)
    expect(videoGain({ videoMuted: true })).toBe(0)
    expect(videoGain({ audioSolo: 'a' })).toBe(0)
    expect(videoGain({ audioSolo: SOLO_VIDEO })).toBe(1)
  })
  it('isAudible', () => {
    expect(isAudible({ id: 'a', muted: false })).toBe(true)
    expect(isAudible({ id: 'a', muted: true })).toBe(false)
    expect(isAudible({ id: 'a', muted: true }, 'a')).toBe(true)
  })
})

describe('effectiveTracks', () => {
  it('uses the mix when it has tracks', () => {
    expect(effectiveTracks({ audioTracks: [t()], audio: { url: 'https://old/x.mp3', name: 'old' } })).toHaveLength(1)
    expect(effectiveTracks({ audioTracks: [t()], audio: { url: 'https://old/x.mp3', name: 'old' } })[0].id).toBe('a')
  })
  it('falls back to the old single track, then to a recast sound, at full volume', () => {
    const legacy = effectiveTracks({ audio: { url: 'https://old/x.mp3', name: 'old' } })
    expect(legacy).toHaveLength(1)
    expect(legacy[0]).toMatchObject({ id: 'legacy', url: 'https://old/x.mp3', volume: 1 })
    expect(effectiveTracks({}, 'https://recast/s.mp3')[0].url).toBe('https://recast/s.mp3')
    expect(effectiveTracks({})).toEqual([])
  })
})

describe('normalizing', () => {
  it('drops tracks with session-only urls, missing ids, junk', () => {
    expect(normalizeAudioTrack({ id: 'a', url: 'blob:x' })).toBeNull()
    expect(normalizeAudioTrack({ id: 'a', url: 'data:audio/mp3;base64,AAA' })).toBeNull()
    expect(normalizeAudioTrack({ url: 'https://x/a.mp3' })).toBeNull()
    expect(normalizeAudioTrack('x')).toBeNull()
  })
  it('clamps values and keeps good ones', () => {
    const tr = normalizeAudioTrack({ id: 'a', url: 'https://x/a.mp3', volume: 9, fadeIn: -1, fadeOut: 99, start: -3, trimStart: 5, length: 0, kind: 'voiceover', muted: true })!
    expect(tr).toMatchObject({ volume: 1, fadeIn: 0, fadeOut: 30, start: 0, trimStart: 5, kind: 'voiceover', muted: true })
    expect(tr.length).toBeUndefined()
  })
  it('dedupes ids and caps the count', () => {
    expect(normalizeAudioTracks([{ id: 'a', url: 'https://x/1.mp3' }, { id: 'a', url: 'https://x/2.mp3' }])).toHaveLength(1)
    const many = Array.from({ length: 20 }, (_, i) => ({ id: `t${i}`, url: `https://x/${i}.mp3` }))
    expect(normalizeAudioTracks(many)).toHaveLength(MAX_AUDIO_TRACKS)
    expect(normalizeAudioTracks([])).toBeUndefined()
  })
  it('video volume: only below 1 is stored', () => {
    expect(normalizeVideoVolume(0.4)).toBe(0.4)
    expect(normalizeVideoVolume(1)).toBeUndefined()
    expect(normalizeVideoVolume('x')).toBeUndefined()
  })
  it('survives normalizePreviewSettings, and an old project has none of it', () => {
    const out = normalizePreviewSettings({ audioTracks: [{ id: 'a', url: 'https://x/a.mp3', fadeIn: 2 }], videoVolume: 0.2, videoMuted: true, audioSolo: 'a' })
    expect(out.audioTracks?.[0].fadeIn).toBe(2)
    expect(out.videoVolume).toBe(0.2)
    expect(out.videoMuted).toBe(true)
    expect(out.audioSolo).toBe('a')
    const old = normalizePreviewSettings({})
    expect(old.audioTracks).toBeUndefined()
    expect(old.videoVolume).toBeUndefined()
    expect(hasMixEdits(old)).toBe(false)
  })
  it('hasMixEdits', () => {
    expect(hasMixEdits({ videoVolume: 0.5 })).toBe(true)
    expect(hasMixEdits({ audioTracks: [t()] })).toBe(true)
  })
})
