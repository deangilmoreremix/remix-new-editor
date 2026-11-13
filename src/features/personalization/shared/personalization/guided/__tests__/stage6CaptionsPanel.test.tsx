// @vitest-environment jsdom
/**
 * Stage 6 — the Captions panel with fake services: import (good and bad files), transcription (success, no speech, failure,
 * cancel), cue editing, problem warnings, style controls, SRT/VTT download, the video format check and the scene filmstrip.
 */
import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { CaptionsPanel, describeTranscribeError } from '../CaptionsPanel'
import { createDefaultPreviewSettings } from '../../preview/presets'
import { normalizeCaptionTrack } from '../../preview/captions'
import type { PersonalizationPreviewSettings } from '../../preview/types'

let latest: PersonalizationPreviewSettings
const SRT = `1\n00:00:01,000 --> 00:00:03,500\nWelcome to Acme Roofing\n\n2\n00:00:04,000 --> 00:00:06,000\nWe fix leaks fast\n`
function Harness(p: Omit<React.ComponentProps<typeof CaptionsPanel>, 'settings' | 'edit'> & { initial?: Partial<PersonalizationPreviewSettings> }) {
  const [s, setS] = useState<PersonalizationPreviewSettings>(() => ({ ...createDefaultPreviewSettings(), fps: 30, durationInFrames: 300, ...p.initial } as PersonalizationPreviewSettings))
  latest = s
  const { initial: _i, ...rest } = p; void _i
  return <CaptionsPanel settings={s} edit={(fn) => setS((x) => fn(x))} {...rest} />
}
const VIDEO = 'https://cdn.example.com/v.mp4'
const file = (text: string, name: string) => new File([text], name, { type: 'text/plain' })
const upload = (f: File) => fireEvent.change(screen.getByLabelText('Import subtitle file'), { target: { files: [f] } })
afterEach(cleanup)

describe('CaptionsPanel', () => {
  it('starts empty with the three ways to begin', () => { render(<Harness videoUrl={VIDEO} />); expect(latest.captions).toBeUndefined(); expect(screen.getByText('Transcribe the speech')).toBeTruthy(); expect(screen.getByText('Add a caption')).toBeTruthy() })
  it('imports an SRT file; a bad file is an alert and changes nothing', async () => {
    render(<Harness videoUrl={VIDEO} />); upload(file(SRT, 'a.srt'))
    await waitFor(() => expect(latest.captions?.cues.length).toBe(2)); expect(screen.getByTestId('captions-message').textContent).toMatch(/Imported 2 subtitles from the SRT/); expect(latest.captions?.source).toBe('srt')
    upload(file('nonsense', 'b.srt')); await waitFor(() => expect(screen.getByRole('alert').textContent).toMatch(/No subtitles were found/)); expect(latest.captions?.cues.length).toBe(2)
  })
  it('transcription: progress, success makes real word cues, and the message warns about accuracy', async () => {
    const transcribeFn = vi.fn(async (_u: string, h: { onProgress?: (p: { stage: string; progress: number }) => void }) => { h.onProgress?.({ stage: 'download', progress: 0.5 }); return { cues: [{ text: 'Hello', startMs: 100, endMs: 500 }, { text: 'world', startMs: 600, endMs: 900 }], text: 'Hello world' } })
    render(<Harness videoUrl={VIDEO} transcribeFn={transcribeFn} />); fireEvent.click(screen.getByText('Transcribe the speech'))
    await waitFor(() => expect(latest.captions?.cues.length).toBe(2)); expect(latest.captions?.source).toBe('transcribed'); expect(screen.getByTestId('captions-message').textContent).toMatch(/Transcribed 2 words.*can be wrong/); expect(transcribeFn).toHaveBeenCalledWith(VIDEO, expect.anything())
  })
  it('no speech → an alert and no captions; failures are described; cancel is quiet', async () => {
    const { unmount } = render(<Harness videoUrl={VIDEO} transcribeFn={async () => ({ cues: [], text: '' })} />); fireEvent.click(screen.getByText('Transcribe the speech'))
    await waitFor(() => expect(screen.getByRole('alert').textContent).toMatch(/No speech was found/)); expect(latest.captions).toBeUndefined(); unmount()
    const r2 = render(<Harness videoUrl={VIDEO} transcribeFn={async () => { throw new Error('This clip has no audio track that the browser can decode') }} />); fireEvent.click(screen.getByText('Transcribe the speech'))
    await waitFor(() => expect(screen.getByRole('alert').textContent).toMatch(/no audio the browser can read/)); r2.unmount()
    const slow = (_u: string, h: { signal?: AbortSignal }) => new Promise<never>((_r, rej) => h.signal?.addEventListener('abort', () => rej(Object.assign(new Error('Transcription cancelled'), { name: 'AbortError' }))))
    render(<Harness videoUrl={VIDEO} transcribeFn={slow as never} />); fireEvent.click(screen.getByText('Transcribe the speech')); await waitFor(() => screen.getByText('Cancel')); fireEvent.click(screen.getByText('Cancel'))
    await waitFor(() => expect(screen.getByTestId('captions-message').textContent).toBe('Cancelled.')); expect(screen.queryByRole('alert')).toBeNull()
  })
  it('no video → transcription is disabled', () => { render(<Harness videoUrl={null} />); expect((screen.getByText('Transcribe the speech') as HTMLButtonElement).disabled).toBe(true) })
  it('cue editing: text, times, add, split, merge, delete, shift', async () => {
    render(<Harness videoUrl={VIDEO} />); upload(file(SRT, 'a.srt')); await waitFor(() => expect(latest.captions?.cues.length).toBe(2))
    fireEvent.change(screen.getByLabelText('Cue 1 text'), { target: { value: 'Hello Acme' } }); expect(latest.captions!.cues[0].text).toBe('Hello Acme')
    fireEvent.change(screen.getByLabelText('Cue 1 start (s)'), { target: { value: '0.5' } }); fireEvent.change(screen.getByLabelText('Cue 1 end (s)'), { target: { value: '2' } }); expect(latest.captions!.cues[0]).toMatchObject({ startMs: 500, endMs: 2000 })
    fireEvent.click(screen.getByLabelText('Merge cue 1 with the next')); expect(latest.captions!.cues.length).toBe(1)
    fireEvent.click(screen.getByLabelText('Split cue 1')); expect(latest.captions!.cues.length).toBe(2)
    fireEvent.change(screen.getByLabelText('Shift all captions (seconds)'), { target: { value: '1.5' } }); fireEvent.click(screen.getByText('Shift')); expect(latest.captions!.cues[0].startMs).toBe(2000)
    fireEvent.click(screen.getByText('Add a caption')); expect(latest.captions!.cues.length).toBe(3); fireEvent.click(screen.getByLabelText('Delete cue 1')); expect(latest.captions!.cues.length).toBe(2)
  })
  it('shows warnings for cues that are too fast or run past the video', async () => {
    render(<Harness videoUrl={VIDEO} initial={{ captions: normalizeCaptionTrack({ cues: [{ text: 'This line is way too fast for anyone to read aloud', startMs: 0, endMs: 700 }, { text: 'hi there', startMs: 20000, endMs: 21000 }] }) }} />)
    await waitFor(() => expect(screen.getAllByTestId('caption-problem').map((n) => n.textContent).join(' ')).toMatch(/Too fast to read.*Starts after the video ends/))
  })
  it('style controls write valid values', async () => {
    render(<Harness videoUrl={VIDEO} />); upload(file(SRT, 'a.srt')); await waitFor(() => expect(latest.captions).toBeDefined())
    fireEvent.change(screen.getByLabelText('Caption style preset'), { target: { value: 'karaoke' } }); expect(latest.captions!.style).toMatchObject({ preset: 'karaoke', highlight: 'karaoke' })
    fireEvent.change(screen.getByLabelText('Caption position'), { target: { value: 'top' } }); expect(latest.captions!.style.position).toBe('top')
    fireEvent.change(screen.getByLabelText('Word highlight'), { target: { value: 'none' } }); expect(latest.captions!.style.highlight).toBe('none')
    fireEvent.change(screen.getByLabelText('Text size'), { target: { value: '9' } }); expect(latest.captions!.style.fontSize).toBe(9)
    fireEvent.change(screen.getByLabelText('Caption colour'), { target: { value: '#ff0000' } }); expect(latest.captions!.style.color).toBe('#ff0000')
    fireEvent.click(screen.getByLabelText('Caption box')); expect(latest.captions!.style.background).toBe(true); fireEvent.click(screen.getByLabelText('Show captions')); expect(latest.captions!.enabled).toBe(false)
    fireEvent.click(screen.getByText('Remove captions')); expect(latest.captions).toBeUndefined()
  })
  it('downloads SRT and VTT with the cues', async () => {
    const downloadFn = vi.fn(); render(<Harness videoUrl={VIDEO} downloadFn={downloadFn} />); upload(file(SRT, 'a.srt')); await waitFor(() => expect(latest.captions).toBeDefined())
    fireEvent.click(screen.getByText('Download SRT')); expect(downloadFn.mock.calls[0][0]).toBe('captions.srt'); expect(downloadFn.mock.calls[0][1]).toContain('00:00:01,000 --> 00:00:03,500')
    fireEvent.click(screen.getByText('Download VTT')); expect(downloadFn.mock.calls[1][1]).toMatch(/^WEBVTT/)
  })
  it('video format check: ok and warning', async () => {
    const ok = { codec: 'avc1.64001f', width: 1280, height: 720, durationSec: 10, canDecode: true, advice: { family: 'H.264', level: 'ok' as const, message: 'H.264 plays and exports everywhere.' } }
    const { unmount } = render(<Harness videoUrl={VIDEO} probeFn={async () => ok} />); fireEvent.click(screen.getByText('Check the video format')); await waitFor(() => expect(screen.getByTestId('video-facts').textContent).toMatch(/1280×720, 10.0 s, H.264/)); expect(screen.getByTestId('video-facts').getAttribute('role')).toBe('status'); unmount()
    render(<Harness videoUrl={VIDEO} probeFn={async () => ({ ...ok, codec: 'hvc1', advice: { family: 'HEVC', level: 'warn' as const, message: 'HEVC is risky.' } })} />); fireEvent.click(screen.getByText('Check the video format')); await waitFor(() => expect(screen.getByTestId('video-facts').getAttribute('role')).toBe('alert'))
  })
  it('scene filmstrip: thumbnails per scene; clicking one starts a caption there', async () => {
    const scanFn = async () => ({ cuts: [3, 8], sampledFrames: 50, durationSec: 12, scenes: [{ startSec: 0, endSec: 3, thumb: null }, { startSec: 3, endSec: 8, thumb: 'data:image/jpeg;base64,AAAA' }, { startSec: 8, endSec: 12, thumb: null }] })
    render(<Harness videoUrl={VIDEO} scanFn={scanFn} />); fireEvent.click(screen.getByText('Find scene changes')); await waitFor(() => expect(screen.getAllByTestId('scene-thumb').length).toBe(3))
    expect(screen.getByTestId('scene-strip').textContent).toMatch(/3 scenes found/); fireEvent.click(screen.getByLabelText('Scene 2 at 3.0 seconds')); expect(latest.captions!.cues[0].startMs).toBe(3000)
  })
  it('describeTranscribeError', () => { expect(describeTranscribeError(new Error('Couldn\'t load the clip\'s media (HTTP 404)'))).toMatch(/HTTP 404/); expect(describeTranscribeError(undefined)).toBe('Transcription failed.') })
})
