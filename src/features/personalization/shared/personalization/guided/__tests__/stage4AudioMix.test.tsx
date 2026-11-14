// @vitest-environment jsdom
/**
 * Stage 4 — baking the mix (fake decoder, in-memory store): caching, reuse, force, every failure; the export hook
 * (prepareAudioForExport); and the Audio mix panel (controls write valid settings, apply / stale / pending / failure / cancel).
 */
import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { AudioMixPanel, describeMixError, type AnalyzeFn, type MixBakeFn } from '../AudioMixPanel'
import { MAX_MIX_SECONDS, MixError, audioSourcesOf, bakeAudioMix, prepareAudioForExport, type DecodedAudio, type MixdownDeps } from '../audioMixdown'
import { createMemoryBlobStore } from '../presenterMatteStore'
import { audioMixKey, defaultAudioMix, type AudioMix } from '../../preview/audioMix'
import { clearMatteRegistry, registerMatteUrl, resolveMatteUrl } from '../../preview/presenterMatteRegistry'
import { createDefaultPreviewSettings } from '../../preview/presets'
import type { PersonalizationPreviewSettings, PreviewInputProps } from '../../preview/types'

const VIDEO = 'https://cdn.example.com/talk.mp4'
const MUSIC = 'https://cdn.example.com/music.mp3'
const FS = 48000
const tone = (f: number, sec: number, amp: number): DecodedAudio => { const x = new Float32Array(Math.round(sec * FS)); for (let i = 0; i < x.length; i += 1) x[i] = amp * Math.sin((2 * Math.PI * f * i) / FS); return { channels: [x, x], sampleRate: FS } }

function deps(over: Partial<Record<string, DecodedAudio | null | Error>> = {}) {
  const calls: string[] = []
  const d: MixdownDeps = {
    decode: async (url) => {
      calls.push(url)
      const v = url in over ? over[url] : url === VIDEO ? tone(220, 4, 0.1) : tone(500, 4, 0.2)
      if (v instanceof Error) throw v
      return v ?? null
    },
    now: () => '2026-11-13T00:00:00.000Z',
  }
  return { d, calls }
}
const urlMocks = () => { let n = 0; vi.spyOn(URL, 'createObjectURL').mockImplementation(() => `blob:mix-${++n}`); vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {}) }
afterEach(() => { cleanup(); clearMatteRegistry(); vi.restoreAllMocks() })

describe('bakeAudioMix', () => {
  it('refuses mixes longer than the measured memory limit BEFORE decoding anything, with a plain message', async () => {
    const store = createMemoryBlobStore(); const { d, calls } = deps()
    await expect(bakeAudioMix(VIDEO, MUSIC, defaultAudioMix(), MAX_MIX_SECONDS + 1, {}, store, d)).rejects.toMatchObject({ name: 'MixError', code: 'TOO_LONG', message: expect.stringMatching(/up to 10 minutes.*Turn the audio mix off/) })
    expect(calls).toEqual([]); expect(MAX_MIX_SECONDS).toBe(600)
    urlMocks(); await expect(bakeAudioMix(VIDEO, MUSIC, defaultAudioMix(), MAX_MIX_SECONDS, {}, store, d)).resolves.toBeTruthy() // exactly the limit is allowed
  }, 60000)
  it('renders, stores a WAV, registers a playable url, and returns the report', async () => {
    urlMocks(); const store = createMemoryBlobStore(); const { d, calls } = deps()
    const r = await bakeAudioMix(VIDEO, MUSIC, defaultAudioMix(), 4, {}, store, d)
    expect(r.reused).toBe(false); expect(r.mixdown.key).toBe(audioMixKey(VIDEO, MUSIC, defaultAudioMix(), 4)); expect(r.mixdown.report.finalLufs).toBeCloseTo(-16, 0)
    expect(resolveMatteUrl({ key: r.mixdown.key })).toBe(r.url); expect(calls.sort()).toEqual([MUSIC, VIDEO].sort())
    const rec = await store.get(r.mixdown.key); expect(rec?.blob.type).toBe('audio/wav'); expect(rec!.blob.size).toBe(44 + 4 * FS * 4)
  })
  it('REUSES the stored mixdown when nothing changed (no decoding); changes or force re-render', async () => {
    urlMocks(); const store = createMemoryBlobStore(); const a = deps(); const b = deps()
    const first = await bakeAudioMix(VIDEO, MUSIC, defaultAudioMix(), 4, {}, store, a.d); clearMatteRegistry()
    const second = await bakeAudioMix(VIDEO, MUSIC, defaultAudioMix(), 4, {}, store, b.d)
    expect(second.reused).toBe(true); expect(b.calls).toEqual([]); expect(second.mixdown.key).toBe(first.mixdown.key)
    const changed = defaultAudioMix(); changed.voice.gainDb = 3
    expect((await bakeAudioMix(VIDEO, MUSIC, changed, 4, {}, store, b.d)).reused).toBe(false)
    expect((await bakeAudioMix(VIDEO, MUSIC, defaultAudioMix(), 4, { force: true }, store, b.d)).reused).toBe(false)
    expect((await store.keys()).length).toBe(2)
  })
  it('a video with no decodable audio still bakes (music only) and says so', async () => {
    urlMocks(); const r = await bakeAudioMix(VIDEO, MUSIC, defaultAudioMix(), 4, {}, createMemoryBlobStore(), deps({ [VIDEO]: null }).d)
    expect(r.mixdown.report.notes.join(' ')).toMatch(/no audio track/)
  })
  it('a muted voice is not even decoded', async () => {
    urlMocks(); const m = defaultAudioMix(); m.voice.muted = true; const { d, calls } = deps()
    await bakeAudioMix(VIDEO, MUSIC, m, 4, {}, createMemoryBlobStore(), d); expect(calls).toEqual([MUSIC])
  })
  it('failures: undecodable music, network error, cancel', async () => {
    urlMocks(); const store = createMemoryBlobStore()
    await expect(bakeAudioMix(VIDEO, MUSIC, defaultAudioMix(), 4, {}, store, deps({ [MUSIC]: null }).d)).rejects.toMatchObject({ code: 'DECODE', message: expect.stringContaining('music track') })
    await expect(bakeAudioMix(VIDEO, MUSIC, defaultAudioMix(), 4, {}, store, deps({ [VIDEO]: new MixError("Couldn't load the audio (HTTP 404).", 'DECODE') }).d)).rejects.toThrow(/HTTP 404/)
    const ac = new AbortController(); ac.abort()
    await expect(bakeAudioMix(VIDEO, MUSIC, defaultAudioMix(), 4, { signal: ac.signal }, store, deps().d)).rejects.toMatchObject({ code: 'ABORTED' })
    expect(await store.keys()).toEqual([])
  })
})

const inputProps = (over: Partial<PreviewInputProps> = {}, mix: AudioMix | null = defaultAudioMix()): PreviewInputProps => ({
  videoUrl: VIDEO, posterUrl: null, isImageSource: false, audioUrl: MUSIC,
  settings: { ...createDefaultPreviewSettings(), fps: 30, durationInFrames: 120, ...(mix ? { audioMix: mix } : {}) } as never,
  brand: { businessName: 'Acme', headline: 'H', offer: '', cta: '', phone: '', website: '', logoUrl: null, productUrl: null, serviceUrl: null },
  ...over,
})

describe('prepareAudioForExport (the exporter hook)', () => {
  it('no mix, or a disabled mix: untouched and nothing decoded', async () => {
    const { d, calls } = deps(); const p = inputProps({}, null)
    expect(await prepareAudioForExport(p, {}, createMemoryBlobStore(), d)).toEqual({ ok: true, inputProps: p, baked: false })
    const off = defaultAudioMix(); off.enabled = false
    expect(await prepareAudioForExport(inputProps({}, off), {}, createMemoryBlobStore(), d)).toMatchObject({ ok: true, baked: false }); expect(calls).toEqual([])
  })
  it('a mix that was never applied is rendered now, and the render gets a CURRENT mixdown', async () => {
    urlMocks(); const store = createMemoryBlobStore(); const { d } = deps(); const p = inputProps()
    const r = await prepareAudioForExport(p, {}, store, d)
    expect(r.ok && r.baked).toBe(true)
    if (r.ok) { const s = audioSourcesOf(r.inputProps); expect(r.inputProps.settings.audioMix!.mixdown!.key).toBe(audioMixKey(s.voiceUrl, s.musicUrl, r.inputProps.settings.audioMix!, s.durationSec)); expect(resolveMatteUrl({ key: r.inputProps.settings.audioMix!.mixdown!.key })).toBeTruthy() }
    expect(p.settings.audioMix!.mixdown).toBeUndefined() // the caller's project is not mutated
  })
  it('an up-to-date mixdown is used as is; a stale one is re-rendered', async () => {
    urlMocks(); const store = createMemoryBlobStore(); const { d, calls } = deps()
    const first = await prepareAudioForExport(inputProps(), {}, store, d); if (!first.ok) throw new Error('x')
    calls.length = 0
    const again = await prepareAudioForExport(first.inputProps, {}, store, d); expect(again).toMatchObject({ ok: true, baked: false }); expect(calls).toEqual([])
    const edited = { ...first.inputProps, settings: { ...first.inputProps.settings, audioMix: { ...first.inputProps.settings.audioMix!, master: { ...first.inputProps.settings.audioMix!.master, targetLufs: -14 } } } }
    const re = await prepareAudioForExport(edited, {}, store, d); expect(re).toMatchObject({ ok: true, baked: true })
  })
  it('after a reload (registry empty) the stored mixdown is restored instead of re-rendered', async () => {
    urlMocks(); const store = createMemoryBlobStore(); const { d, calls } = deps()
    const first = await prepareAudioForExport(inputProps(), {}, store, d); if (!first.ok) throw new Error('x'); clearMatteRegistry(); calls.length = 0
    const again = await prepareAudioForExport(first.inputProps, {}, store, d)
    expect(again).toMatchObject({ ok: true, baked: false }); expect(calls).toEqual([]); expect(resolveMatteUrl({ key: first.inputProps.settings.audioMix!.mixdown!.key })).toBeTruthy()
  })
  it('image sources have no voice; failures come back as errors, cancel as cancelled', async () => {
    urlMocks(); const store = createMemoryBlobStore()
    expect(audioSourcesOf(inputProps({ isImageSource: true })).voiceUrl).toBeNull()
    const bad = await prepareAudioForExport(inputProps(), {}, store, deps({ [MUSIC]: null }).d); expect(bad).toMatchObject({ ok: false, error: expect.stringContaining('could not be prepared') })
    const ac = new AbortController(); ac.abort()
    expect(await prepareAudioForExport(inputProps(), { signal: ac.signal }, store, deps().d)).toEqual({ ok: false, error: 'Render cancelled.' })
  })
})

let latest: PersonalizationPreviewSettings
function Harness({ initial, bakeFn, analyzeFn, music = MUSIC, video = VIDEO }: { initial?: Partial<PersonalizationPreviewSettings>; bakeFn?: MixBakeFn; analyzeFn?: AnalyzeFn; music?: string | null; video?: string | null }) {
  const [s, setS] = useState<PersonalizationPreviewSettings>(() => ({ ...createDefaultPreviewSettings(), fps: 30, durationInFrames: 120, ...initial } as PersonalizationPreviewSettings))
  latest = s
  return <AudioMixPanel settings={s} edit={(fn) => setS((p) => fn(p))} videoUrl={video} musicUrl={music} bakeFn={bakeFn} analyzeFn={analyzeFn} />
}
const range = (label: string, v: number) => fireEvent.change(screen.getByLabelText(label), { target: { value: String(v) } })

describe('AudioMixPanel', () => {
  it('nothing to mix without a video or music', () => { render(<Harness video={null} music={null} />); expect(screen.getByText(/Choose a video or a music track first/)).toBeTruthy() })
  it('starts off; turning on creates valid defaults; remove deletes it', () => {
    render(<Harness />); expect(latest.audioMix).toBeUndefined(); fireEvent.click(screen.getByText('Turn on audio mix'))
    expect(latest.audioMix).toMatchObject({ enabled: true, master: { targetLufs: -16 } })
    fireEvent.click(screen.getByText('Remove mix')); expect(latest.audioMix).toBeUndefined()
  })
  it('every control writes a valid, clamped value', () => {
    render(<Harness />); fireEvent.click(screen.getByText('Turn on audio mix'))
    range('Voice level', -6); expect(latest.audioMix!.voice.gainDb).toBe(-6)
    range('Rumble filter (high-pass; 0 = off)', 120); expect(latest.audioMix!.voice.eq.highpassHz).toBe(120)
    range('Bass', 3); range('Presence', 4); range('Treble', -2)
    expect(latest.audioMix!.voice.eq).toMatchObject({ lowDb: 3, midDb: 4, highDb: -2 })
    fireEvent.change(screen.getByLabelText('Voice tone preset'), { target: { value: 'phone' } }); expect(latest.audioMix!.voice.eq.highpassHz).toBe(300)
    range('Music level', -8); range('Fade in', 2); range('Fade out', 3); range('Start the music from', 12)
    expect(latest.audioMix!.music).toMatchObject({ gainDb: -8, fadeInSec: 2, fadeOutSec: 3, startSec: 12 })
    range('Ducking depth', 18); expect(latest.audioMix!.music.duck.amountDb).toBe(18); range('Recovery time', 900); expect(latest.audioMix!.music.duck.releaseMs).toBe(900)
    range('Target loudness', -14); expect(latest.audioMix!.master.targetLufs).toBe(-14); range('Peak ceiling', -2); expect(latest.audioMix!.master.ceilingDb).toBe(-2)
    fireEvent.click(screen.getByLabelText('Mute voice')); expect(latest.audioMix!.voice.muted).toBe(true)
    fireEvent.click(screen.getByLabelText('Loop music')); expect(latest.audioMix!.music.loop).toBe(false)
    fireEvent.click(screen.getByLabelText('Duck music under the voice')); expect(latest.audioMix!.music.duck.enabled).toBe(false); expect(screen.queryByLabelText('Ducking depth')).toBeNull()
    fireEvent.click(screen.getByLabelText('Set final loudness')); expect(latest.audioMix!.master.targetLufs).toBeNull()
    fireEvent.click(screen.getByLabelText('Use audio mix')); expect(latest.audioMix!.enabled).toBe(false)
  })
  it('no music track hides the music controls; no video hides the voice controls', () => {
    const { unmount } = render(<Harness music={null} />); fireEvent.click(screen.getByText('Turn on audio mix'))
    expect(screen.queryByLabelText('Music level')).toBeNull(); expect(screen.getByLabelText('Voice level')).toBeTruthy(); unmount()
    render(<Harness video={null} />); fireEvent.click(screen.getByText('Turn on audio mix')); expect(screen.queryByLabelText('Voice level')).toBeNull(); expect(screen.getByLabelText('Music level')).toBeTruthy()
  })
  it('applying: pending → applied; the settings keep the mixdown reference and the report is shown', async () => {
    urlMocks()
    const bakeFn: MixBakeFn = async (v, m, mix, dur) => { const key = audioMixKey(v, m, mix, dur); registerMatteUrl(key, 'blob:ok'); return { mixdown: { key, createdAt: 'x', durationSec: dur, report: { voiceLufs: -22.5, musicLufs: -18, finalLufs: -16, peakDb: -1.2, duckMaxDb: 12, masterGainDb: 5, notes: ['n1'] } }, url: 'blob:ok', reused: false } }
    render(<Harness bakeFn={bakeFn} />); fireEvent.click(screen.getByText('Turn on audio mix'))
    expect(screen.getByTestId('audio-mix-pending')).toBeTruthy()
    fireEvent.click(screen.getByText('Apply audio mix'))
    await waitFor(() => expect(screen.getByTestId('audio-mix-active')).toBeTruthy())
    expect(screen.getByTestId('audio-mix-report').textContent).toMatch(/-22.5 LUFS.*-18 LUFS.*-16 LUFS.*-1.2 dB.*12 dB/); expect(screen.getByTestId('audio-mix-report').textContent).toMatch(/n1/)
    expect(screen.queryByTestId('audio-mix-pending')).toBeNull()
    range('Voice level', 3) // any change makes it stale
    expect(screen.getByTestId('audio-mix-stale')).toBeTruthy(); expect(screen.queryByTestId('audio-mix-active')).toBeNull()
  })
  it('apply failures are alerts and store nothing; cancel is quiet', async () => {
    render(<Harness bakeFn={async () => { throw new MixError('The music track could not be decoded by this browser.', 'DECODE') }} />); fireEvent.click(screen.getByText('Turn on audio mix')); fireEvent.click(screen.getByText('Apply audio mix'))
    await waitFor(() => expect(screen.getByRole('alert').textContent).toMatch(/music track could not be decoded/)); expect(latest.audioMix!.mixdown).toBeUndefined(); cleanup()
    const slow: MixBakeFn = (_v, _m, _x, _d, h) => new Promise((_r, rej) => h.signal?.addEventListener('abort', () => rej(new MixError('Cancelled', 'ABORTED'))))
    render(<Harness bakeFn={slow} />); fireEvent.click(screen.getByText('Turn on audio mix')); fireEvent.click(screen.getByText('Apply audio mix'))
    await waitFor(() => screen.getByText('Cancel')); fireEvent.click(screen.getByText('Cancel'))
    await waitFor(() => expect(screen.getByTestId('audio-mix-message').textContent).toBe('Cancelled.')); expect(screen.queryByRole('alert')).toBeNull()
  })
  it('measuring shows loudness, quiet gaps and tempo; the beat button moves the fade-out onto a beat', async () => {
    const analyzeFn: AnalyzeFn = async () => ({ voice: { lufs: -24.1, durationSec: 4, quietGaps: [{ startSec: 1, endSec: 1.8 }, { startSec: 3, endSec: 3.5 }] }, music: { lufs: -12, durationSec: 30, bpm: 120, confidence: 3, beats: [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5] } })
    render(<Harness analyzeFn={analyzeFn} />); fireEvent.click(screen.getByText('Turn on audio mix'))
    fireEvent.click(screen.getByText('Measure my audio'))
    await waitFor(() => expect(screen.getByTestId('audio-analysis').textContent).toMatch(/-24.1 LUFS, 2 quiet gaps \(1.3 s\)/)); expect(screen.getByTestId('audio-analysis').textContent).toMatch(/120 BPM/)
    fireEvent.click(screen.getByText('Start the fade-out on a beat'))
    // video is 4 s; fade-out 1.5 s starts at 2.5 s, which is already a beat → unchanged
    expect(latest.audioMix!.music.fadeOutSec).toBe(1.5)
    range('Fade out', 1.2); fireEvent.click(screen.getByText('Start the fade-out on a beat')); expect(latest.audioMix!.music.fadeOutSec).toBe(1) // starts at 2.8 s; the nearest beat is 3.0 s, so the fade now lasts 4 - 3 = 1 s
  })
  it('measure failure is reported', async () => {
    render(<Harness analyzeFn={async () => { throw new Error('decode failed') }} />); fireEvent.click(screen.getByText('Turn on audio mix')); fireEvent.click(screen.getByText('Measure my audio'))
    await waitFor(() => expect(screen.getByTestId('audio-mix-message').textContent).toMatch(/Could not measure the audio: decode failed/))
  })
  it('describeMixError', () => { expect(describeMixError(new MixError('x', 'ABORTED'))).toBe('Cancelled.'); expect(describeMixError(new Error('boom'))).toBe('boom') })
  it('act wrapper sanity', async () => { await act(async () => {}); expect(true).toBe(true) })
})
