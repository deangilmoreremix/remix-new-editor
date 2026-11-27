import '@testing-library/jest-dom/vitest'
import React from 'react'
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import { AudioTools, type AudioDeps } from '../AudioTools'
import { TextOverlayTools } from '../TextOverlayTools'

const g = globalThis as any
const downloads: Array<{ name: string; blob: Blob }> = []
vi.mock('@ohb/shared/social/exportNames', async (orig) => ({ ...(await orig<any>()), downloadBlob: (blob: Blob, name: string) => downloads.push({ blob, name }) }))

const buf = (over: any = {}): any => ({ duration: 4, length: 4, numberOfChannels: 1, sampleRate: 8000, getChannelData: () => new Float32Array([0, 0.5, -0.9, 0.2]), ...over })
const deps = (over: Partial<AudioDeps> = {}): AudioDeps => ({
  decode: vi.fn(async () => buf()),
  render: vi.fn(async () => buf()),
  applyToVideo: vi.fn(async () => ({ blob: new Blob(['v'], { type: 'video/mp4' }) })),
  ...over,
})
const src = async () => new Blob(['video'], { type: 'video/mp4' })

beforeEach(() => { downloads.length = 0; g.AudioContext = function () {}; g.VideoEncoder = function () {}; g.VideoDecoder = function () {} })
afterEach(() => { cleanup(); delete g.AudioContext; delete g.VideoEncoder; delete g.VideoDecoder; vi.restoreAllMocks() })

describe('AudioTools', () => {
  it('without Web Audio it says so and offers an alternative instead of failing', () => {
    delete g.AudioContext
    render(<AudioTools title="Clip" getSource={src} onOutput={vi.fn()} deps={deps()} />)
    expect(screen.getByRole('alert')).toHaveTextContent(/no Web Audio/)
    expect(screen.getByRole('button', { name: 'Read audio' })).toBeDisabled()
  })

  it('reads the audio, shows measured levels with plain advice, and states it is not AI noise removal', async () => {
    const d = deps()
    render(<AudioTools title="Clip" getSource={src} onOutput={vi.fn()} deps={d} />)
    expect(screen.getByText(/not AI noise removal/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Read audio' }))
    expect(await screen.findByText(/Peak -0\.9 dB/)).toBeInTheDocument()
    expect(d.decode).toHaveBeenCalled()
    expect(screen.getByLabelText('Waveform')).toBeInTheDocument()
    expect(await screen.findByRole('status')).toHaveTextContent(/Levels look healthy|quiet|loud|distort/)
  })

  it('applying is disabled until something is changed, then renders and applies the new audio', async () => {
    const d = deps(); const onOutput = vi.fn()
    render(<AudioTools title="Clip" getSource={src} onOutput={onOutput} deps={d} />)
    fireEvent.click(screen.getByRole('button', { name: 'Read audio' }))
    const apply = await screen.findByRole('button', { name: 'Apply to video' })
    expect(apply).toBeDisabled()
    fireEvent.change(screen.getByLabelText('Volume'), { target: { value: '6' } })
    expect(apply).toBeEnabled()
    fireEvent.click(apply)
    await waitFor(() => expect(onOutput).toHaveBeenCalledWith(expect.objectContaining({ kind: 'video', label: 'Audio adjusted' })))
    expect((d.render as any).mock.calls[0][1]).toMatchObject({ gainDb: 6 })
    expect((d.applyToVideo as any).mock.calls[0][0].audioBuffer).toBeTruthy()
  })

  it('a preset sets several controls at once; the WAV download uses a clear filename', async () => {
    render(<AudioTools title="My Clip" getSource={src} onOutput={vi.fn()} deps={deps()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Read audio' }))
    await screen.findByLabelText('Audio preset')
    fireEvent.change(screen.getByLabelText('Audio preset'), { target: { value: 'voice' } })
    expect(screen.getByLabelText('High-pass filter')).toHaveValue('80')
    fireEvent.click(screen.getByRole('button', { name: 'Download audio (WAV)' }))
    await waitFor(() => expect(downloads).toHaveLength(1))
    expect(downloads[0].name).toMatch(/^my-clip_.*\.wav$/)
    expect(downloads[0].blob.type).toBe('audio/wav')
  })

  it('reports a file it cannot decode, and a failed apply, and leaves the video alone', async () => {
    const d = deps({ decode: vi.fn(async () => { throw new Error('This browser could not read an audio track from the file') }) })
    const { unmount } = render(<AudioTools title="Clip" getSource={src} onOutput={vi.fn()} deps={d} />)
    fireEvent.click(screen.getByRole('button', { name: 'Read audio' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/could not read an audio track.*unchanged/)
    unmount()
    const d2 = deps({ applyToVideo: vi.fn(async () => { throw new Error('Apply audio changes and trimming in two separate steps') }) })
    const onOutput = vi.fn()
    render(<AudioTools title="Clip" getSource={src} onOutput={onOutput} deps={d2} />)
    fireEvent.click(screen.getByRole('button', { name: 'Read audio' }))
    fireEvent.change(await screen.findByLabelText('Volume'), { target: { value: '3' } })
    fireEvent.click(screen.getByRole('button', { name: 'Apply to video' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/two separate steps.*unchanged/)
    expect(onOutput).not.toHaveBeenCalled()
  })

  it('without WebCodecs the video apply is disabled but the audio download still works', async () => {
    delete g.VideoEncoder
    render(<AudioTools title="Clip" getSource={src} onOutput={vi.fn()} deps={deps()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Read audio' }))
    fireEvent.change(await screen.findByLabelText('Volume'), { target: { value: '3' } })
    expect(screen.getByRole('button', { name: 'Apply to video' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Download audio (WAV)' })).toBeEnabled()
  })
})

describe('TextOverlayTools', () => {
  it('validates the text and timing before it can be added', () => {
    render(<TextOverlayTools duration={10} getSource={src} onOutput={vi.fn()} apply={vi.fn()} />)
    const add = screen.getByRole('button', { name: 'Add to video' })
    expect(add).toBeEnabled()
    fireEvent.change(screen.getByLabelText('Overlay text'), { target: { value: '  ' } })
    expect(add).toBeDisabled(); expect(screen.getByText('Type some text.')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Overlay text'), { target: { value: 'Hi' } })
    fireEvent.change(screen.getByLabelText('Text end'), { target: { value: '0' } })
    expect(screen.getByText('The end must be after the start.')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Text end'), { target: { value: '3' } })
    fireEvent.change(screen.getByLabelText('Text start'), { target: { value: '12' } })
    expect(screen.getByText(/only 10\.0 s long/)).toBeInTheDocument()
  })

  it('previews with the Web Animations API using the shared curves', () => {
    const animate = vi.fn()
    ;(HTMLElement.prototype as any).animate = animate
    render(<TextOverlayTools duration={10} getSource={src} onOutput={vi.fn()} apply={vi.fn()} />)
    fireEvent.change(screen.getByLabelText('Animation'), { target: { value: 'bounce' } })
    fireEvent.click(screen.getByRole('button', { name: 'Replay preview' }))
    expect(animate).toHaveBeenCalledTimes(1)
    const [frames, opts] = animate.mock.calls[0]
    expect(frames.length).toBeGreaterThan(8)
    expect(opts.duration).toBe(3000)
    delete (HTMLElement.prototype as any).animate
  })

  it('adds overlays, removes them, and burns them into the video', async () => {
    const apply = vi.fn(async () => ({ blob: new Blob(['v'], { type: 'video/mp4' }) })); const onOutput = vi.fn()
    render(<TextOverlayTools duration={10} getSource={src} onOutput={onOutput} apply={apply} />)
    expect(screen.queryByRole('button', { name: 'Burn text into video' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Add to video' }))
    fireEvent.change(screen.getByLabelText('Overlay text'), { target: { value: 'Second' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add to video' }))
    fireEvent.click(screen.getByRole('button', { name: 'Remove text 1' }))
    fireEvent.click(screen.getByRole('button', { name: 'Burn text into video' }))
    await waitFor(() => expect(onOutput).toHaveBeenCalledWith(expect.objectContaining({ kind: 'video', label: 'Animated text (1)' })))
    expect((apply.mock.calls[0] as any)[0].overlays).toEqual([expect.objectContaining({ text: 'Second', preset: 'pop' })])
  })

  it('reports an unsupported browser and a failed render without touching the video', async () => {
    const apply = vi.fn(async () => { throw new Error('This browser cannot encode H.264 or VP8/VP9 video.') })
    render(<TextOverlayTools duration={10} getSource={src} onOutput={vi.fn()} apply={apply} />)
    fireEvent.click(screen.getByRole('button', { name: 'Add to video' }))
    fireEvent.click(screen.getByRole('button', { name: 'Burn text into video' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/cannot encode.*unchanged/)
    delete g.VideoEncoder
    cleanup()
    render(<TextOverlayTools duration={10} getSource={src} onOutput={vi.fn()} apply={apply} />)
    fireEvent.click(screen.getByRole('button', { name: 'Add to video' }))
    expect(screen.getByRole('button', { name: 'Burn text into video' })).toBeDisabled()
    expect(screen.getByText(/needs WebCodecs/)).toBeInTheDocument()
  })
})
