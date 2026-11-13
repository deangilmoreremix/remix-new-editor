// @vitest-environment jsdom
/**
 * Stage 4 — what the shared composition does with audio: with a CURRENT mixdown it plays only the mixdown and mutes every
 * source (the full-frame video and the presenter layers); without one (or with a stale one) the sources play as they are.
 */
import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { PersonalizationComposition } from '../PersonalizationComposition'
import { createDefaultPreviewSettings } from '../presets'
import { audioMixKey, defaultAudioMix } from '../audioMix'
import { defaultPresenter } from '../presenter'
import { clearMatteRegistry, registerMatteUrl } from '../presenterMatteRegistry'
import type { PreviewInputProps } from '../types'

vi.mock('@remotion/media', () => ({
  Video: ({ src, muted, objectFit }: { src: string; muted?: boolean; objectFit?: string }) => <div data-testid="media-video" data-src={src} data-muted={String(Boolean(muted))} data-fit={objectFit} />,
  Audio: ({ src }: { src: string }) => <div data-testid="media-audio" data-src={src} />,
}))
vi.mock('remotion', async () => ({
  AbsoluteFill: ({ children, style }: { children?: React.ReactNode; style?: React.CSSProperties }) => <div style={style}>{children}</div>,
  Img: ({ src }: { src: string }) => <img src={src} alt="" />,
  Sequence: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
  Internals: { SequenceManager: { Provider: ({ children }: { children?: React.ReactNode }) => <>{children}</> } },
  useCurrentFrame: () => 10,
  useVideoConfig: () => ({ width: 1280, height: 720, fps: 30, durationInFrames: 150 }),
  interpolate: (_i: number, _r: number[], out: number[]) => out[out.length - 1] ?? 1,
  spring: () => 1,
  Easing: { out: () => (t: number) => t, in: () => (t: number) => t, inOut: () => (t: number) => t, bezier: () => (t: number) => t, back: () => (t: number) => t, cubic: (t: number) => t, quad: (t: number) => t, ease: (t: number) => t, linear: (t: number) => t },
}))

const VIDEO = 'https://cdn.example.com/talk.mp4'
const MUSIC = 'https://cdn.example.com/music.mp3'
const SEC = 5
const base = (patch: Record<string, unknown> = {}, music: string | null = MUSIC): PreviewInputProps => ({
  videoUrl: VIDEO, posterUrl: null, isImageSource: false, audioUrl: music,
  settings: { ...createDefaultPreviewSettings(), layers: [], showEndCard: false, fps: 30, durationInFrames: SEC * 30, width: 1280, height: 720, ...patch } as never,
  brand: { businessName: 'Acme', headline: 'H', offer: '', cta: '', phone: '', website: '', logoUrl: null, productUrl: null, serviceUrl: null },
})
const withMix = (mixPatch: Record<string, unknown> = {}, music: string | null = MUSIC, settingsPatch: Record<string, unknown> = {}) => {
  const m = defaultAudioMix()
  return base({ audioMix: { ...m, mixdown: { key: audioMixKey(VIDEO, music, m, SEC), createdAt: 'x', durationSec: SEC, report: { voiceLufs: null, musicLufs: null, finalLufs: null, peakDb: null, duckMaxDb: 0, masterGainDb: 0, notes: [] } }, ...mixPatch }, ...settingsPatch }, music)
}
const mounted: Array<{ root: ReturnType<typeof createRoot>; container: HTMLElement }> = []
function mount(p: PreviewInputProps) {
  const container = document.createElement('div'); document.body.appendChild(container)
  const root = createRoot(container); mounted.push({ root, container })
  act(() => root.render(<PersonalizationComposition {...p} />))
  return container
}
afterEach(() => { for (const { root, container } of mounted.splice(0)) { act(() => root.unmount()); container.remove() } clearMatteRegistry() })
const videos = (c: HTMLElement) => [...c.querySelectorAll('[data-testid="media-video"]')] as HTMLElement[]
const audios = (c: HTMLElement) => [...c.querySelectorAll('[data-testid="media-audio"]')] as HTMLElement[]

describe('composition audio', () => {
  it('no mix: the video keeps its sound and the music track plays (unchanged behaviour)', () => {
    const c = mount(base())
    expect(videos(c).map((v) => v.dataset.muted)).toEqual(['false']); expect(audios(c).map((a) => a.dataset.src)).toEqual([MUSIC])
  })
  it('a current mixdown: only the mixdown plays; the video is muted', () => {
    registerMatteUrl(withMix().settings.audioMix!.mixdown!.key, 'blob:mixdown')
    const c = mount(withMix())
    expect(audios(c).map((a) => a.dataset.src)).toEqual(['blob:mixdown']); expect(videos(c).map((v) => v.dataset.muted)).toEqual(['true'])
  })
  it('the presenter layers are muted too, in every background mode', () => {
    const key = withMix().settings.audioMix!.mixdown!.key
    registerMatteUrl(key, 'blob:mixdown'); registerMatteUrl('pm_mediapipe_abcdef12', 'blob:matte')
    for (const mode of ['keep', 'blur', 'color', 'remove'] as const) {
      const presenter = { ...defaultPresenter('full'), background: { ...defaultPresenter('full').background, mode }, matte: { key: 'pm_mediapipe_abcdef12', engine: 'mediapipe' as const, sourceUrl: VIDEO, createdAt: 'x' } }
      const c = mount(withMix({}, MUSIC, { presenter })); expect(videos(c).length).toBeGreaterThan(0)
      expect(videos(c).every((v) => v.dataset.muted === 'true'), mode).toBe(true); expect(audios(c).map((a) => a.dataset.src)).toEqual(['blob:mixdown'])
    }
  })
  it('without a mixdown the presenter plays one audible layer, as before', () => {
    registerMatteUrl('pm_mediapipe_abcdef12', 'blob:matte')
    const presenter = { ...defaultPresenter('full'), background: { ...defaultPresenter('full').background, mode: 'blur' as const }, matte: { key: 'pm_mediapipe_abcdef12', engine: 'mediapipe' as const, sourceUrl: VIDEO, createdAt: 'x' } }
    const c = mount(base({ presenter })); expect(videos(c).map((v) => v.dataset.muted).sort()).toEqual(['false', 'true'])
  })
  it('a stale mixdown (settings changed since) is NOT played: the sources play', () => {
    const p = withMix(); registerMatteUrl(p.settings.audioMix!.mixdown!.key, 'blob:mixdown')
    p.settings.audioMix = { ...p.settings.audioMix!, voice: { ...p.settings.audioMix!.voice, gainDb: 6 } }
    const c = mount(p); expect(audios(c).map((a) => a.dataset.src)).toEqual([MUSIC]); expect(videos(c)[0].dataset.muted).toBe('false')
  })
  it('a mixdown whose file is gone is not played; a disabled mix is ignored', () => {
    const c = mount(withMix()); expect(audios(c).map((a) => a.dataset.src)).toEqual([MUSIC]); expect(videos(c)[0].dataset.muted).toBe('false')
    const p = withMix(); registerMatteUrl(p.settings.audioMix!.mixdown!.key, 'blob:mixdown'); p.settings.audioMix = { ...p.settings.audioMix!, enabled: false }
    const d = mount(p); expect(audios(d).map((a) => a.dataset.src)).toEqual([MUSIC])
  })
  it('a mixdown made for a different video or duration is stale', () => {
    const p = withMix(); registerMatteUrl(p.settings.audioMix!.mixdown!.key, 'blob:mixdown')
    expect(audios(mount({ ...p, videoUrl: 'https://cdn.example.com/other.mp4' })).map((a) => a.dataset.src)).toEqual([MUSIC])
    expect(audios(mount({ ...p, settings: { ...p.settings, durationInFrames: 200 } })).map((a) => a.dataset.src)).toEqual([MUSIC])
  })
  it('re-renders when the mixdown file becomes available after the first paint (restore after reload)', () => {
    const p = withMix(); const c = mount(p)
    expect(audios(c).map((a) => a.dataset.src)).toEqual([MUSIC])
    act(() => registerMatteUrl(p.settings.audioMix!.mixdown!.key, 'blob:late'))
    expect(audios(c).map((a) => a.dataset.src)).toEqual(['blob:late']); expect(videos(c)[0].dataset.muted).toBe('true')
  })
  it('the full-frame video is cover-fitted via the objectFit PROP', () => { expect(videos(mount(base()))[0].dataset.fit).toBe('cover') })
  it('voice-only mix (no music track) plays the mixdown too', () => {
    const p = withMix({}, null); registerMatteUrl(p.settings.audioMix!.mixdown!.key, 'blob:voiceonly')
    expect(audios(mount(p)).map((a) => a.dataset.src)).toEqual(['blob:voiceonly'])
  })
})
