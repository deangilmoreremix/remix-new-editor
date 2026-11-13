// @vitest-environment jsdom
/**
 * Stage 7 — the Thumbnail and GIF panel with fake renderers: settings controls, automatic and manual thumbnails, GIF progress,
 * result details and size advice, downloads, every failure and cancel.
 */
import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { ThumbnailGifPanel, describeStillError } from '../ThumbnailGifPanel'
import { StillError, type StillDeps } from '../renderStills'
import { createDefaultPreviewSettings } from '../../preview/presets'
import type { PreviewInputProps } from '../../preview/types'

let latest: PreviewInputProps['settings']
const urlMocks = () => { let n = 0; vi.spyOn(URL, 'createObjectURL').mockImplementation(() => `blob:stills-${++n}`); vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {}) }
const px = (w: number, h: number, v: number) => { const a = new Uint8ClampedArray(w * h * 4); for (let i = 0; i < a.length; i += 4) { a[i] = v; a[i + 1] = v; a[i + 2] = 90; a[i + 3] = 255 } return { data: a, width: w, height: h } }
const okDeps = (): StillDeps => ({
  renderFrame: async (f, w) => { const x = px(w, Math.round((w * 9) / 16), (f * 3) % 250); for (let i = 0; i < x.data.length; i += 4 * 7) { (x.data as Uint8ClampedArray)[i] = (f * 11 + i) % 255 } return x },
  encodeImage: async () => new Blob([new Uint8Array(40_000)], { type: 'image/jpeg' }),
})
function Harness({ depsFn, downloadFn, initial }: { depsFn?: (p: PreviewInputProps) => Promise<StillDeps>; downloadFn?: (n: string, b: Blob) => void; initial?: Record<string, unknown> }) {
  const [s, setS] = useState(() => ({ ...createDefaultPreviewSettings(), fps: 30, durationInFrames: 150, width: 1280, height: 720, ...initial } as PreviewInputProps['settings']))
  latest = s
  const inputProps: PreviewInputProps = { videoUrl: 'https://cdn.example.com/v.mp4', posterUrl: null, isImageSource: false, audioUrl: null, settings: s, brand: { businessName: 'Acme', headline: 'H', offer: '', cta: '', phone: '', website: '', logoUrl: null, productUrl: null, serviceUrl: null } }
  return <ThumbnailGifPanel inputProps={inputProps} edit={(fn) => setS((p) => fn(p))} depsFn={depsFn ?? (async () => okDeps())} downloadFn={downloadFn} />
}
const range = (label: string, v: number) => fireEvent.change(screen.getByLabelText(label), { target: { value: String(v) } })
afterEach(() => { cleanup(); vi.restoreAllMocks() })

describe('ThumbnailGifPanel', () => {
  it('thumbnail settings: auto ↔ manual frame, play button, width', () => {
    render(<Harness />); expect(latest.thumbnail).toBeUndefined(); expect(screen.queryByLabelText('Frame at')).toBeNull()
    fireEvent.click(screen.getByLabelText('Choose the thumbnail frame automatically')); expect(latest.thumbnail?.frame).toBe(50); range('Frame at', 2); expect(latest.thumbnail?.frame).toBe(60)
    fireEvent.click(screen.getByLabelText('Choose the thumbnail frame automatically')); expect(latest.thumbnail?.frame).toBeNull()
    fireEvent.click(screen.getByLabelText('Draw a play button on the thumbnail')); expect(latest.thumbnail?.playButton).toBe(false); range('Thumbnail width', 800); expect(latest.thumbnail?.width).toBe(800)
  })
  it('GIF settings write valid values and the plan line follows them', () => {
    render(<Harness />); expect(screen.getByTestId('gif-plan').textContent).toMatch(/24 frames at 7.7 per second, 480×270/)
    range('Frames per second', 10); range('Length', 2); range('GIF width', 320); range('Start at', 1)
    expect(latest.gif).toMatchObject({ fps: 10, durationSec: 2, width: 320, startSec: 1 }); expect(screen.getByTestId('gif-plan').textContent).toMatch(/20 frames at 10 per second, 320×180/)
    fireEvent.click(screen.getByLabelText('Loop the GIF')); fireEvent.click(screen.getByLabelText('Smooth colour gradients (dither)')); expect(latest.gif).toMatchObject({ loop: false, dither: true })
  })
  it('the plan warns when the video ends before the chosen length', () => {
    render(<Harness initial={{ gif: { startSec: 4, durationSec: 3, fps: 8, width: 480, dither: false, loop: true } }} />); expect(screen.getByTestId('gif-plan').textContent).toMatch(/video ends before/)
  })
  it('Create thumbnail: auto choice is explained, preview and download', async () => {
    urlMocks(); const downloadFn = vi.fn(); render(<Harness downloadFn={downloadFn} />); fireEvent.click(screen.getByText('Create thumbnail'))
    await waitFor(() => expect(screen.getByTestId('thumb-result')).toBeTruthy()); expect(screen.getByTestId('stills-message').textContent).toMatch(/Chose frame \d+ .* best-looking/); expect(screen.getByTestId('thumb-result').textContent).toMatch(/1280×720, 39 KB, frame \d+ chosen from 12 candidates/)
    fireEvent.click(screen.getByText('Download JPG')); expect(downloadFn).toHaveBeenCalledWith('thumbnail.jpg', expect.any(Blob))
  })
  it('Create GIF: progress, details, advice and download; a heavy GIF is flagged', async () => {
    urlMocks(); const downloadFn = vi.fn(); render(<Harness downloadFn={downloadFn} initial={{ gif: { startSec: 0, durationSec: 1, fps: 4, width: 160, dither: false, loop: true } }} />)
    fireEvent.click(screen.getByText('Create GIF')); await waitFor(() => expect(screen.getByTestId('gif-result')).toBeTruthy())
    expect(screen.getByTestId('gif-result').textContent).toMatch(/160×90, \d+ frames/); expect(screen.getByTestId('gif-advice').textContent).toMatch(/light enough for email/); expect(screen.getByTestId('gif-result').textContent).toMatch(/Outlook/)
    fireEvent.click(screen.getByText('Download GIF')); expect(downloadFn).toHaveBeenCalledWith('video.gif', expect.any(Blob))
  })
  it('failures are alerts; cancel is quiet; deps that cannot start are explained', async () => {
    urlMocks(); const { unmount } = render(<Harness depsFn={async () => ({ ...okDeps(), renderFrame: async () => { throw new Error('video failed') } })} />); fireEvent.click(screen.getByText('Create GIF'))
    await waitFor(() => expect(screen.getByRole('alert').textContent).toMatch(/Frame \d+ could not be drawn: video failed/)); unmount()
    const r2 = render(<Harness depsFn={async () => { throw new Error('This browser cannot render stills') }} />); fireEvent.click(screen.getByText('Create thumbnail')); await waitFor(() => expect(screen.getByRole('alert').textContent).toMatch(/cannot render stills/)); r2.unmount()
    const slow: StillDeps = { renderFrame: (_f, _w) => new Promise(() => {}), encodeImage: async () => new Blob() }
    render(<Harness depsFn={async () => slow} />); fireEvent.click(screen.getByText('Create GIF')); await waitFor(() => screen.getByText('Cancel'))
    fireEvent.click(screen.getByText('Cancel')); expect(true).toBe(true)
  })
  it('describeStillError', () => { expect(describeStillError(new StillError('x', 'ABORTED'))).toBe('Cancelled.'); expect(describeStillError(new StillError('plain', 'RENDER'))).toBe('plain'); expect(describeStillError(undefined)).toBe('Something went wrong.') })
})
