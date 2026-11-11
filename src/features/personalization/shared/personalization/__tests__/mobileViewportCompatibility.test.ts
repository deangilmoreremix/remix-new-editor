// @vitest-environment jsdom
/**
 * Mobile viewport certification for the browser export engine.
 *
 * `exportPersonalizedVideo` runs `evenDimension()` on the approved composition
 * width/height before handing them to `@remotion/web-renderer`: H.264 (and most
 * in-browser encoders) reject odd pixel dimensions. These tests certify that
 * every common portrait/mobile ratio — including hand-typed odd values — is
 * rounded to an even, renderer-acceptable size.
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
  renderMediaOnWeb.mockImplementation(async () => ({ getBlob: async () => makeStubBlob() }))
})

describe('even dimensions for mobile/portrait ratios', () => {
  const assertEven = (dims: { width: number; height: number }) => {
    expect(dims.width % 2).toBe(0)
    expect(dims.height % 2).toBe(0)
  }

  it('renders native 9:16 (1080x1920) untouched and even', async () => {
    const inputProps = makeInputProps({
      settings: createDefaultPreviewSettings({ aspectRatio: '9:16', width: 1080, height: 1920 }),
    })
    const res = await exportPersonalizedVideo({ inputProps })
    expect(res.ok).toBe(true)
    const call = renderMediaOnWeb.mock.calls[0][0] as any
    assertEven(call.composition)
    expect(call.composition.width).toBe(1080)
    expect(call.composition.height).toBe(1920)
  })

  it('rounds odd custom 9:16 dimensions UP to the nearest even pair', async () => {
    const inputProps = makeInputProps({
      settings: createDefaultPreviewSettings({ aspectRatio: '9:16', width: 1081, height: 1921 }),
    })
    const res = await exportPersonalizedVideo({ inputProps })
    expect(res.ok).toBe(true)
    const call = renderMediaOnWeb.mock.calls[0][0] as any
    assertEven(call.composition)
    expect(call.composition.width).toBe(1082)
    expect(call.composition.height).toBe(1922)
  })

  it('rounds odd 1:1 and 4:5 dimensions up to even', async () => {
    for (const [w, h] of [
      [541, 541] as const,
      [1080, 1351] as const,
    ]) {
      const inputProps = makeInputProps({
        settings: createDefaultPreviewSettings({ aspectRatio: '1:1', width: w, height: h }),
      })
      await exportPersonalizedVideo({ inputProps })
      const call = renderMediaOnWeb.mock.calls[0][0] as any
      assertEven(call.composition)
    }
  })

  it('clamps sub-minimum dimensions up to 2x2', async () => {
    const inputProps = makeInputProps({
      settings: createDefaultPreviewSettings({ aspectRatio: '9:16', width: 1, height: 3 }),
    })
    await exportPersonalizedVideo({ inputProps })
    const call = renderMediaOnWeb.mock.calls[0][0] as any
    assertEven(call.composition)
    expect(call.composition.width).toBe(2)
    expect(call.composition.height).toBe(4)
  })
})
