// @vitest-environment jsdom
/**
 * TASK 4 — the customer audio track survives into the exported MP4.
 *
 * The branded render is produced in the browser by `@remotion/web-renderer`
 * from the composition input props, and the composition renders the selected
 * audio track with `@remotion/media`'s <Audio>. This test drives the real
 * provider path (with the renderer mocked by the shared harness) and proves the
 * track the customer picked is inside the props handed to the renderer, and
 * that the render is NOT muted — i.e. the exported file carries the audio.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act } from 'react'
import {
  cancelActiveExport,
  configureCapableBrowser,
  getCtx,
  openSource,
  renderMediaOnWeb,
  renderProvider,
  resetRendererMocks,
  type HarnessRef,
} from './_createFinalVideoHarness'
import { uploadPersonalizationAsset } from '../assetUploadService'

const DURABLE_AUDIO_URL = 'https://cdn.example.com/audio/jingle.mp3'

function audioFile(name: string, type: string): File {
  return new File([name], name, { type })
}

beforeEach(() => {
  localStorage.clear()
  URL.createObjectURL = vi.fn(() => 'blob:http://localhost/audio') as unknown as typeof URL.createObjectURL
  URL.revokeObjectURL = vi.fn() as unknown as typeof URL.revokeObjectURL
  resetRendererMocks()
  configureCapableBrowser()
  ;(uploadPersonalizationAsset as unknown as { mockReset: () => void }).mockReset()
})

afterEach(() => {
  cancelActiveExport()
  document.body.innerHTML = ''
})

describe('TASK 4 — the customer audio track reaches the browser export', () => {
  it('hands the selected track to the renderer with an audio codec and no mute', async () => {
    ;(uploadPersonalizationAsset as unknown as { mockResolvedValue: (v: unknown) => void })
      .mockResolvedValue({ url: DURABLE_AUDIO_URL })

    const ref: HarnessRef = { current: null }
    await renderProvider(ref)
    await openSource(ref)

    await act(async () => {
      await getCtx(ref).setPreviewAudio(audioFile('jingle.mp3', 'audio/mpeg'))
    })
    await act(async () => {
      await new Promise((r) => setTimeout(r, 30))
    })
    // The preview reference is already durable before the render starts.
    expect(getCtx(ref).previewSettings.audio?.url).toBe(DURABLE_AUDIO_URL)

    let captured: any = null
    renderMediaOnWeb.mockImplementation(async (opts: any) => {
      captured = opts
      return { getBlob: async () => new Blob(['fake-branded-video-bytes'], { type: 'video/mp4' }) }
    })

    await act(async () => {
      getCtx(ref).approvePersonalization()
    })
    await act(async () => {
      await getCtx(ref).createFinalVideo()
    })
    await vi.waitFor(() => expect(renderMediaOnWeb).toHaveBeenCalledTimes(1), { timeout: 5000 })

    expect(captured.inputProps.audioUrl).toBe(DURABLE_AUDIO_URL)
    expect(captured.inputProps.settings.audio).toEqual({ url: DURABLE_AUDIO_URL, name: 'jingle.mp3' })
    // An encodable audio codec is requested and the render is not muted, so the
    // exported MP4 carries the track instead of a silent video.
    expect(captured.audioCodec).toBe('aac')
    expect(captured.muted).toBe(false)
  })

  it('renders with the source video audio when the customer picked no track', async () => {
    const ref: HarnessRef = { current: null }
    await renderProvider(ref)
    await openSource(ref)

    let captured: any = null
    renderMediaOnWeb.mockImplementation(async (opts: any) => {
      captured = opts
      return { getBlob: async () => new Blob(['fake-branded-video-bytes'], { type: 'video/mp4' }) }
    })

    await act(async () => {
      getCtx(ref).approvePersonalization()
    })
    await act(async () => {
      await getCtx(ref).createFinalVideo()
    })
    await vi.waitFor(() => expect(renderMediaOnWeb).toHaveBeenCalledTimes(1), { timeout: 5000 })

    expect(captured.inputProps.audioUrl).toBeNull()
    expect(captured.muted).toBe(false)
  })
})
