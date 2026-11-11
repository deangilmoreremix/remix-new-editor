// @vitest-environment jsdom
/**
 * Certification evidence: expected MP4 properties of a branded (overlay-only)
 * render.
 *
 * This is a contract / evidence test, not a code-coverage test. It runs a full
 * `createFinalVideo` branded render against the mocked `@remotion/web-renderer`
 * and records the exact properties the pipeline must produce so a later
 * refactor (or a new codec fallback) cannot silently change the delivered file:
 *
 *   - container / mime / extension = mp4 / video/mp4 / mp4 for an H.264-capable browser
 *   - videoCodec = 'h264' (the universally playable default), audioCodec = 'aac'
 *   - composition dimensions are even (required by H.264)
 *   - the result surfaces as a blob URL with `source: 'branded-render'`
 *   - the renderer is called exactly once and the provider reaches 'complete'
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act } from 'react'
import {
  cancelActiveExport,
  configureCapableBrowser,
  getCtx,
  getEncodableAudioCodecs,
  getEncodableVideoCodecs,
  openSource,
  renderMediaOnWeb,
  renderProvider,
  resetRendererMocks,
  type HarnessRef,
} from './_createFinalVideoHarness'
import {
  PERSONALIZATION_COMPOSITION_ID,
  WEB_RENDER_EXTENSION,
  WEB_RENDER_MIME_TYPE,
} from '../finalOutput'

beforeEach(() => {
  localStorage.clear()
  URL.createObjectURL = vi.fn(() => 'blob:http://localhost/final') as any
  URL.revokeObjectURL = vi.fn() as any
  resetRendererMocks()
  configureCapableBrowser()
})

afterEach(() => {
  cancelActiveExport()
  document.body.innerHTML = ''
})

describe('branded render evidence — expected MP4 properties', () => {
  it('produces an H.264 / MP4 / AAC file with even dimensions', async () => {
    const ref: HarnessRef = { current: null }
    await renderProvider(ref)
    await openSource(ref)

    await act(async () => {
      getCtx(ref).approvePersonalization()
    })
    await act(async () => {})

    renderMediaOnWeb.mockImplementation(async () => ({
      getBlob: async () => new Blob(['fake-branded-video-bytes'], { type: 'video/mp4' }),
    }))

    await act(async () => {
      await getCtx(ref).createFinalVideo()
    })

    const opts = renderMediaOnWeb.mock.calls[0][0] as any
    expect(opts, 'renderMediaOnWeb should have been called').toBeTruthy()
    expect(opts.composition.id).toBe(PERSONALIZATION_COMPOSITION_ID)
    expect(opts.container).toBe('mp4')
    expect(opts.videoCodec).toBe('h264')
    expect(opts.audioCodec).toBe('aac')
    expect(opts.muted).toBe(false)
    expect(opts.signal).toBeInstanceOf(AbortSignal)

    // H.264 requires even pixel dimensions.
    expect(opts.composition.width % 2).toBe(0)
    expect(opts.composition.height % 2).toBe(0)
    expect(opts.composition.width).toBe(1920)
    expect(opts.composition.height).toBe(1080)
    expect(opts.composition.fps).toBe(30)
    expect(typeof opts.composition.durationInFrames).toBe('number')

    // The provider surfaces the finished MP4 through a blob URL.
    const ctx = getCtx(ref)
    expect(ctx.generation.status).toBe('complete')
    expect(ctx.generation.progress).toBe(100)
    expect(ctx.generation.progressMessage).toBe('Branded video ready')
    expect(ctx.result.type).toBe('video')
    expect(ctx.result.url).toMatch(/^blob:/)
    expect(ctx.result.metadata.compositionId).toBe(PERSONALIZATION_COMPOSITION_ID)
    expect(ctx.result.metadata.container).toBe(WEB_RENDER_MIME_TYPE.mp4)
    expect(ctx.result.metadata.extension).toBe(WEB_RENDER_EXTENSION.mp4)
    expect(ctx.result.metadata.fileName).toMatch(/^personalized-.*\.mp4$/)

    // Exactly one render call.
    expect(renderMediaOnWeb).toHaveBeenCalledTimes(1)
  })

  it('falls back to WebM (VP9 / Opus) and still emits even dimensions when H.264 is unavailable', async () => {
    const ref: HarnessRef = { current: null }
    await renderProvider(ref)
    await openSource(ref)

    await act(async () => {
      getCtx(ref).approvePersonalization()
    })
    await act(async () => {})

    getEncodableVideoCodecs.mockImplementation((container: string) =>
      Promise.resolve(container === 'mp4' ? ([] as const) : (['vp9', 'vp8'] as const)),
    )
    getEncodableAudioCodecs.mockImplementation((container: string) =>
      Promise.resolve(container === 'mp4' ? ([] as const) : (['opus', 'vorbis'] as const)),
    )

    renderMediaOnWeb.mockImplementation(async () => ({
      getBlob: async () => new Blob(['x'], { type: 'video/webm' }),
    }))

    await act(async () => {
      await getCtx(ref).createFinalVideo()
    })

    const opts = renderMediaOnWeb.mock.calls[0][0] as any
    expect(opts.container).toBe('webm')
    expect(opts.videoCodec).toBe('vp9')
    expect(opts.audioCodec).toBe('opus')
    expect(opts.composition.width % 2).toBe(0)
    expect(opts.composition.height % 2).toBe(0)

    expect(getCtx(ref).result.metadata.container).toBe('video/webm')
    expect(getCtx(ref).result.metadata.extension).toBe('webm')
    expect(getCtx(ref).generation.status).toBe('complete')
  })
})
