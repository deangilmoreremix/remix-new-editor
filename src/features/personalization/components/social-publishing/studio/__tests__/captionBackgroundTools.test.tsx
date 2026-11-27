import '@testing-library/jest-dom/vitest'
import React from 'react'
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'

const h = vi.hoisted(() => ({
  transcribe: vi.fn(), burn: vi.fn(), canRemove: vi.fn(), remove: vi.fn(),
}))
vi.mock('../../../../../../lib/captionStudio/transcribeClient.js', () => ({
  WHISPER_MODELS: [['model-base', 'Accurate (≈ 80 MB)'], ['model-tiny', 'Fast (≈ 40 MB)']],
  transcribeInBrowser: h.transcribe,
}))
vi.mock('../../../../../../lib/captionStudio/burn.js', () => ({ burnCaptions: h.burn }))
vi.mock('../../../../../../lib/captionStudio/model.js', () => ({
  CAPTION_PRESETS: { tiktok: { label: 'Word highlight' }, classic: { label: 'Classic subtitles' } },
  defaultCaptionStyle: (p: string) => ({ preset: p, position: 'bottom' }),
}))
vi.mock('@ohb/shared/personalization/backgroundRemoval/backgroundRemovalClient', () => ({
  BACKGROUND_REMOVAL_MODEL_MB: 192,
  canRemoveBackgrounds: h.canRemove,
  removeAssetBackground: h.remove,
}))
vi.mock('@ohb/shared/social/backgroundTools', async (orig) => ({ ...(await orig<any>()), compositeOnBackground: vi.fn(async () => new Blob(['composited'], { type: 'image/jpeg' })) }))

import { CaptionTools } from '../CaptionTools'
import { BackgroundTools } from '../BackgroundTools'
import { compositeOnBackground } from '@ohb/shared/social/backgroundTools'

beforeEach(() => {
  Object.values(h).forEach((f) => f.mockReset())
  vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:src')
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
  localStorage.clear?.()
})
afterEach(() => { cleanup(); vi.restoreAllMocks() })

const src = async () => new Blob(['video'], { type: 'video/mp4' })

describe('CaptionTools: generate + burn in', () => {
  it('transcribes on the device and puts the lines in the subtitle editor for correction', async () => {
    h.transcribe.mockResolvedValue({ captions: [{ text: 'Hello there', startMs: 0, endMs: 1500 }, { text: 'welcome', startMs: 1500, endMs: 2600 }] })
    const setCues = vi.fn(); const revoke = URL.revokeObjectURL as any
    render(<CaptionTools cues={[]} setCues={setCues} getSource={src} onOutput={vi.fn()} position="bottom" />)
    fireEvent.click(await screen.findByRole('button', { name: 'Generate captions' }))
    await waitFor(() => expect(setCues).toHaveBeenCalledWith([{ start: 0, end: 1.5, text: 'Hello there' }, { start: 1.5, end: 2.6, text: 'welcome' }]))
    expect(h.transcribe.mock.calls[0][1]).toMatchObject({ model: 'model-base' })
    expect(await screen.findByText(/Check and correct them/)).toBeInTheDocument()
    expect(revoke).toHaveBeenCalledWith('blob:src') // object URL released
  })

  it('a declined model download changes nothing and says so', async () => {
    h.transcribe.mockRejectedValue(Object.assign(new Error('Model download declined'), { name: 'AbortError' }))
    const setCues = vi.fn()
    render(<CaptionTools cues={[]} setCues={setCues} getSource={src} onOutput={vi.fn()} position="bottom" />)
    fireEvent.click(await screen.findByRole('button', { name: 'Generate captions' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/No model was downloaded/)
    expect(setCues).not.toHaveBeenCalled()
  })

  it('reports a failed transcription and a video with no speech without touching the video', async () => {
    h.transcribe.mockRejectedValueOnce(new Error('GPU lost'))
    render(<CaptionTools cues={[]} setCues={vi.fn()} getSource={src} onOutput={vi.fn()} position="bottom" />)
    fireEvent.click(await screen.findByRole('button', { name: 'Generate captions' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/GPU lost.*unchanged/)
    h.transcribe.mockResolvedValueOnce({ captions: [] })
    fireEvent.click(screen.getByRole('button', { name: 'Generate captions' }))
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/No speech was found/))
  })

  it('burns the captions in with the chosen style and position, and hands on the new video', async () => {
    h.burn.mockResolvedValue({ blob: new Blob(['out'], { type: 'video/mp4' }), url: 'blob:out', ext: 'mp4', engine: 'webcodecs' })
    const onOutput = vi.fn()
    render(<CaptionTools cues={[{ start: 0, end: 2, text: 'Hi' }]} setCues={vi.fn()} getSource={src} onOutput={onOutput} position="top" />)
    await screen.findByRole('option', { name: 'Classic subtitles' })
    fireEvent.change(screen.getByLabelText('Caption style'), { target: { value: 'classic' } })
    fireEvent.click(screen.getByRole('button', { name: 'Burn captions into video' }))
    await waitFor(() => expect(onOutput).toHaveBeenCalled())
    const args = h.burn.mock.calls[0][0]
    expect(args.captions).toEqual([{ text: 'Hi', startMs: 0, endMs: 2000, timestampMs: 1000, confidence: null }])
    expect(args.style).toMatchObject({ preset: 'classic', position: 'top' })
    expect(onOutput.mock.calls[0][0]).toMatchObject({ kind: 'video', label: expect.stringContaining('Captions burned in') })
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:out')
  })

  it('burning needs captions, and an unsupported browser / cancel is reported not hidden', async () => {
    const { rerender } = render(<CaptionTools cues={[]} setCues={vi.fn()} getSource={src} onOutput={vi.fn()} position="bottom" />)
    expect(await screen.findByRole('button', { name: 'Burn captions into video' })).toBeDisabled()
    rerender(<CaptionTools cues={[{ start: 0, end: 1, text: 'x' }]} setCues={vi.fn()} getSource={src} onOutput={vi.fn()} position="bottom" />)
    h.burn.mockRejectedValue(Object.assign(new Error('This browser cannot encode video.'), { code: 'unsupported' }))
    fireEvent.click(screen.getByRole('button', { name: 'Burn captions into video' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/cannot encode video.*unchanged/)
    h.burn.mockRejectedValue(Object.assign(new Error('Render cancelled'), { name: 'AbortError' }))
    fireEvent.click(screen.getByRole('button', { name: 'Burn captions into video' }))
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/Cancelled/))
  })
})

describe('BackgroundTools', () => {
  it('video: states plainly that it is not available here', () => {
    render(<BackgroundTools mediaType="video" getSource={src} onOutput={vi.fn()} />)
    expect(screen.getByText(/isn't available in this panel/)).toBeInTheDocument()
    expect(h.canRemove).not.toHaveBeenCalled()
  })

  it('shows an unavailable state with alternatives when the browser cannot run it', async () => {
    h.canRemove.mockResolvedValue(false)
    render(<BackgroundTools mediaType="image" getSource={src} onOutput={vi.fn()} />)
    expect(await screen.findByRole('alert')).toHaveTextContent(/needs WebGPU or WebAssembly/)
    expect(screen.queryByRole('button', { name: 'Remove background' })).toBeNull()
  })

  it('never downloads the model without a yes; declining changes nothing', async () => {
    h.canRemove.mockResolvedValue(true)
    const onOutput = vi.fn(); const confirmDownload = vi.fn(() => false)
    render(<BackgroundTools mediaType="image" getSource={src} onOutput={onOutput} confirmDownload={confirmDownload} />)
    const btn = await screen.findByRole('button', { name: 'Remove background' })
    await waitFor(() => expect(btn).toBeEnabled())
    fireEvent.click(btn)
    await waitFor(() => expect(confirmDownload).toHaveBeenCalledWith(expect.stringContaining('192 MB')))
    expect(await screen.findByRole('alert')).toHaveTextContent(/Cancelled/)
    expect(h.remove).not.toHaveBeenCalled()
    expect(onOutput).not.toHaveBeenCalled()
  })

  it('removes the background after consent (asked once), then puts the cut-out on a colour and on a picture', async () => {
    h.canRemove.mockResolvedValue(true)
    h.remove.mockResolvedValue({ blob: new Blob(['png'], { type: 'image/png' }), provider: 'webgpu', durationMs: 1800 })
    const onOutput = vi.fn(); const confirmDownload = vi.fn(() => true)
    render(<BackgroundTools mediaType="image" getSource={async () => new Blob(['img'], { type: 'image/png' })} onOutput={onOutput} confirmDownload={confirmDownload} />)
    const btn = await screen.findByRole('button', { name: 'Remove background' })
    await waitFor(() => expect(btn).toBeEnabled())
    fireEvent.click(btn)
    await waitFor(() => expect(onOutput).toHaveBeenCalledWith(expect.objectContaining({ kind: 'image', label: expect.stringContaining('transparent PNG') })))
    expect(confirmDownload).toHaveBeenCalledTimes(1)
    fireEvent.change(screen.getByLabelText('Background colour'), { target: { value: '#00ff00' } })
    fireEvent.click(screen.getByRole('button', { name: 'Put on colour' }))
    await waitFor(() => expect(compositeOnBackground).toHaveBeenCalledWith(expect.any(Blob), { color: '#00ff00' }))
    expect(onOutput).toHaveBeenLastCalledWith(expect.objectContaining({ label: 'On #00ff00' }))
    // second removal does not ask again
    fireEvent.click(screen.getByRole('button', { name: 'Remove background' }))
    await waitFor(() => expect(h.remove).toHaveBeenCalledTimes(2))
    expect(confirmDownload).toHaveBeenCalledTimes(1)
  })

  it('reports a failed removal (e.g. out of memory) and leaves the image alone', async () => {
    h.canRemove.mockResolvedValue(true)
    localStorage.setItem?.('remix-bg0-consent', '1')
    h.remove.mockRejectedValue(Object.assign(new Error('Not enough memory for this image'), { code: 'out-of-memory' }))
    const onOutput = vi.fn()
    render(<BackgroundTools mediaType="image" getSource={src} onOutput={onOutput} confirmDownload={() => true} />)
    const btn = await screen.findByRole('button', { name: 'Remove background' })
    await waitFor(() => expect(btn).toBeEnabled())
    fireEvent.click(btn)
    expect(await screen.findByRole('alert')).toHaveTextContent(/Not enough memory.*unchanged/)
    expect(onOutput).not.toHaveBeenCalled()
  })
})
