// @vitest-environment jsdom
/**
 * Codec fallback certification for the browser export engine.
 *
 * `chooseWebExportProfile` (finalOutput.ts) decides the profile from what the
 * browser reports it can encode; `exportPersonalizedVideo` (webExport.ts) wires
 * that detection to the real `@remotion/web-renderer` (mocked here). These tests
 * certify the integration: the profile that reaches `renderMediaOnWeb` matches
 * the fallback preference order (h264 → vp9 → vp8) and the failure tier the
 * caller observes.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { exportPersonalizedVideo } from '../webExport'
import { createDefaultPreviewSettings } from '../preview/presets'
import {
  audioCodecPresets,
  makeInputProps,
  makeStubBlob,
  videoCodecPresets,
} from './_webRendererHarness'

const mocks = vi.hoisted(() => ({
  canRenderMediaOnWeb: vi.fn(),
  renderMediaOnWeb: vi.fn(),
  getEncodableVideoCodecs: vi.fn(),
  getEncodableAudioCodecs: vi.fn(),
}))

vi.mock('@remotion/web-renderer', () => ({
  canRenderMediaOnWeb: mocks.canRenderMediaOnWeb,
  renderMediaOnWeb: mocks.renderMediaOnWeb,
  getEncodableVideoCodecs: mocks.getEncodableVideoCodecs,
  getEncodableAudioCodecs: mocks.getEncodableAudioCodecs,
}))

const { canRenderMediaOnWeb, renderMediaOnWeb, getEncodableVideoCodecs, getEncodableAudioCodecs } = mocks

beforeEach(() => {
  vi.clearAllMocks()
  getEncodableVideoCodecs.mockImplementation(videoCodecPresets.full)
  getEncodableAudioCodecs.mockImplementation(audioCodecPresets.full)
  canRenderMediaOnWeb.mockResolvedValue({ canRender: true, issues: [] as unknown[] })
  renderMediaOnWeb.mockImplementation(async () => ({
    getBlob: async () => makeStubBlob(),
  }))
})

describe('codec fallback through the export engine', () => {
  it('prefers h264 + mp4 + aac when the browser can encode everything', async () => {
    const res = await exportPersonalizedVideo({ inputProps: makeInputProps() })
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.extension).toBe('mp4')
    expect(res.mimeType).toBe('video/mp4')
    expect(renderMediaOnWeb).toHaveBeenCalledWith(
      expect.objectContaining({
        container: 'mp4',
        videoCodec: 'h264',
        audioCodec: 'aac',
        muted: false,
      }),
    )
  })

  it('falls back to vp9 + webm when h264 cannot be encoded', async () => {
    getEncodableVideoCodecs.mockImplementation(videoCodecPresets.noH264)
    getEncodableAudioCodecs.mockImplementation((c: string) =>
      Promise.resolve(c === 'mp4' ? [] : (['opus'] as const)),
    )

    const res = await exportPersonalizedVideo({ inputProps: makeInputProps() })
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.extension).toBe('webm')
    expect(res.mimeType).toBe('video/webm')
    expect(renderMediaOnWeb).toHaveBeenCalledWith(
      expect.objectContaining({
        container: 'webm',
        videoCodec: 'vp9',
        audioCodec: 'opus',
        muted: false,
      }),
    )
  })

  it('honours an explicitly requested codec when the browser supports it', async () => {
    const res = await exportPersonalizedVideo({
      inputProps: makeInputProps(),
      videoCodec: 'vp8',
    })
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(renderMediaOnWeb).toHaveBeenCalledWith(
      expect.objectContaining({ container: 'webm', videoCodec: 'vp8' }),
    )
  })

  it('rejects an unsupported requested codec with the supported alternative named', async () => {
    getEncodableVideoCodecs.mockImplementation(videoCodecPresets.noH264)
    const res = await exportPersonalizedVideo({
      inputProps: makeInputProps(),
      videoCodec: 'h264',
    })
    expect(res.ok).toBe(false)
    if (res.ok) return
    expect(res.reason).toBe('unsupported-codec')
    expect(res.error).toContain('MP4 (H.264)')
    expect(res.error).toContain('WebM (VP9)')
  })

  it('renders muted with a warning when no audio codec can be encoded at all', async () => {
    getEncodableAudioCodecs.mockImplementation(audioCodecPresets.none)
    const res = await exportPersonalizedVideo({ inputProps: makeInputProps() })
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(renderMediaOnWeb).toHaveBeenCalledWith(
      expect.objectContaining({ muted: true, audioCodec: null }),
    )
    expect(res.warning).toMatch(/audio/i)
  })

  it('forwards even 9:16 composition dimensions to the renderer', async () => {
    const inputProps = makeInputProps({
      settings: createDefaultPreviewSettings({ aspectRatio: '9:16', width: 1080, height: 1920 }),
    })
    const res = await exportPersonalizedVideo({ inputProps })
    expect(res.ok).toBe(true)
    const call = renderMediaOnWeb.mock.calls[0][0] as any
    expect(call.composition.width).toBe(1080)
    expect(call.composition.height).toBe(1920)
    expect(call.composition.width % 2).toBe(0)
    expect(call.composition.height % 2).toBe(0)
  })
})

describe('unsupported tier (renderer capability check)', () => {
  it('returns unsupported-codec when the renderer cannot produce the chosen profile', async () => {
    canRenderMediaOnWeb.mockResolvedValue({
      canRender: false,
      issues: [{ type: 'video-codec-unsupported', severity: 'error', message: 'H.264 encoder unavailable' }],
    })
    const res = await exportPersonalizedVideo({ inputProps: makeInputProps() })
    expect(res.ok).toBe(false)
    if (res.ok) return
    expect(res.reason).toBe('unsupported-codec')
  })

  it('returns unsupported-browser when no video codec is encodable at all', async () => {
    getEncodableVideoCodecs.mockImplementation(videoCodecPresets.none)
    getEncodableAudioCodecs.mockImplementation(audioCodecPresets.none)
    const res = await exportPersonalizedVideo({ inputProps: makeInputProps() })
    expect(res.ok).toBe(false)
    if (res.ok) return
    expect(res.reason).toBe('unsupported-browser')
    expect(res.error).toMatch(/cannot encode video/i)
  })
})
