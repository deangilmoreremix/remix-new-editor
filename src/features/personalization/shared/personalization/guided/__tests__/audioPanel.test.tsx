// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { newAudioTrack, type AudioTrack } from '../../preview/audioMix'

const state: { settings: Record<string, unknown> } = { settings: {} }
const updatePreviewComposition = vi.fn()
const addAudioTrack = vi.fn()
const removeAudioTrack = vi.fn()
vi.mock('../../DemoPersonalizeProvider', () => ({
  useDemoPersonalize: () => ({ previewSettings: state.settings, updatePreviewComposition, addAudioTrack, removeAudioTrack }),
}))
vi.mock('../editor/waveform', () => ({ loadWaveform: async () => ({ peaks: [0.2, 0.8, 0.5], durationSec: 4 }) }))

import { AudioPanel } from '../AudioPanel'

afterEach(() => { cleanup(); vi.clearAllMocks() })

const track = (p: Partial<AudioTrack> = {}) => newAudioTrack({ id: 't1', url: 'https://x/a.mp3', name: 'song.mp3', kind: 'music', ...p })
function open(settings: Record<string, unknown> = {}) {
  state.settings = { durationInFrames: 150, fps: 30, ...settings }
  render(<AudioPanel />)
  fireEvent.click(screen.getByTestId('audio-toggle-panel'))
}

describe('AudioPanel', () => {
  it('starts collapsed and shows the track count in its title', () => {
    state.settings = { durationInFrames: 150, fps: 30, audioTracks: [track(), track({ id: 't2' })] }
    render(<AudioPanel />)
    expect(screen.getByTestId('audio-toggle-panel').textContent).toContain('2 tracks')
    expect(screen.queryByTestId('audio-video-volume')).toBeNull()
  })

  it('video sound: volume, mute and solo write to the mix', () => {
    open()
    fireEvent.change(screen.getByTestId('audio-video-volume'), { target: { value: '0.3' } })
    expect(updatePreviewComposition).toHaveBeenLastCalledWith({ videoVolume: 0.3 })
    fireEvent.click(screen.getByTestId('audio-video-mute'))
    expect(updatePreviewComposition).toHaveBeenLastCalledWith({ videoMuted: true })
    fireEvent.click(screen.getByTestId('audio-video-solo'))
    expect(updatePreviewComposition).toHaveBeenLastCalledWith({ audioSolo: 'video' })
  })

  it('edits one track and leaves the others alone', () => {
    open({ audioTracks: [track(), track({ id: 't2', name: 'voice.wav', kind: 'voiceover' })] })
    const first = screen.getAllByTestId('audio-track')[0]
    fireEvent.change(first.querySelector('[data-testid="audio-track-volume"]')!, { target: { value: '0.25' } })
    const patch = updatePreviewComposition.mock.calls.at(-1)![0].audioTracks as AudioTrack[]
    expect(patch[0].volume).toBe(0.25)
    expect(patch[1].volume).toBe(1) // the voiceover default is untouched
  })

  it('numeric fields set start, skip and fades, clamped', () => {
    open({ audioTracks: [track()] })
    fireEvent.change(screen.getByTestId('audio-start-t1'), { target: { value: '2.5' } })
    expect((updatePreviewComposition.mock.calls.at(-1)![0].audioTracks as AudioTrack[])[0].start).toBe(2.5)
    fireEvent.change(screen.getByTestId('audio-fadein-t1'), { target: { value: '99' } })
    expect((updatePreviewComposition.mock.calls.at(-1)![0].audioTracks as AudioTrack[])[0].fadeIn).toBe(30)
    fireEvent.change(screen.getByTestId('audio-fadeout-t1'), { target: { value: '' } })
    expect(updatePreviewComposition).toHaveBeenCalledTimes(2) // an emptied field is ignored
  })

  it('mute, solo (toggles off again), type change and delete', () => {
    open({ audioTracks: [track()] })
    fireEvent.click(screen.getByTestId('audio-track-mute'))
    expect((updatePreviewComposition.mock.calls.at(-1)![0].audioTracks as AudioTrack[])[0].muted).toBe(true)
    fireEvent.click(screen.getByTestId('audio-track-solo'))
    expect(updatePreviewComposition).toHaveBeenLastCalledWith({ audioSolo: 't1' })
    cleanup()
    open({ audioTracks: [track()], audioSolo: 't1' })
    fireEvent.click(screen.getByTestId('audio-track-solo'))
    expect(updatePreviewComposition).toHaveBeenLastCalledWith({ audioSolo: undefined })
    fireEvent.change(screen.getByTestId('audio-track-kind'), { target: { value: 'voiceover' } })
    expect((updatePreviewComposition.mock.calls.at(-1)![0].audioTracks as AudioTrack[])[0].kind).toBe('voiceover')
    fireEvent.click(screen.getByTestId('audio-track-delete'))
    expect(removeAudioTrack).toHaveBeenCalledWith('t1')
  })

  it('adds a valid file as the chosen kind and rejects an invalid one with a message', () => {
    open()
    fireEvent.click(screen.getByTestId('audio-add-voiceover'))
    const input = screen.getByTestId('audio-file') as HTMLInputElement
    const good = new File(['x'], 'voice.mp3', { type: 'audio/mpeg' })
    fireEvent.change(input, { target: { files: [good] } })
    expect(addAudioTrack).toHaveBeenCalledWith(good, 'voiceover')
    const bad = new File(['x'], 'notes.txt', { type: 'text/plain' })
    fireEvent.change(input, { target: { files: [bad] } })
    expect(addAudioTrack).toHaveBeenCalledTimes(1)
    expect(screen.getByTestId('audio-error').textContent).toMatch(/not an audio format/)
  })

  it('stops offering more tracks at the limit', () => {
    open({ audioTracks: Array.from({ length: 6 }, (_, i) => track({ id: `t${i}` })) })
    expect((screen.getByTestId('audio-add-music') as HTMLButtonElement).disabled).toBe(true)
  })

  it('draws a waveform bar positioned by the track start', async () => {
    open({ audioTracks: [track({ start: 1.5 })] })
    const bar = await screen.findByTestId('audio-wave-bar')
    expect(bar.style.left).toBe('30%') // 1.5 s of a 5 s video
  })
})
