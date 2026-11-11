// @vitest-environment jsdom
/**
 * Certification: `createFinalVideo` snapshots the APPROVED preview settings
 * before the branded render starts.
 *
 * The branded render is a snapshot-at-call-time — the user keeps editing while
 * the render runs, but the export must reflect exactly the layout they signed
 * off on. These tests drive the real `DemoPersonalizeProvider`/`createFinalVideo`
 * path (with `@remotion/web-renderer` mocked by the shared harness) and prove the
 * frozen composition is immune to later edits.
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

function makeBlob() {
  return new Blob(['fake-branded-video-bytes'], { type: 'video/mp4' })
}

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

describe('createFinalVideo snapshots approved settings before render', () => {
  it('hands the approved composition to the renderer verbatim', async () => {
    const ref: HarnessRef = { current: null }
    await renderProvider(ref)
    await openSource(ref)

    let captured: any = null
    let resolveRender: () => void = () => {}
    renderMediaOnWeb.mockImplementation(async (opts: any) => {
      captured = opts
      return new Promise((resolve) => {
        resolveRender = () =>
          resolve({ getBlob: async () => makeBlob() })
      })
    })

    await act(async () => {
      getCtx(ref).approvePersonalization()
    })
    await act(async () => {})

    expect(getCtx(ref).previewApproved).toBe(true)

    const createPromise = getCtx(ref).createFinalVideo()
    await act(async () => {})
    await vi.waitFor(() => expect(renderMediaOnWeb).toHaveBeenCalledTimes(1), { timeout: 5000 })

    const frozenInput = captured.inputProps as any
    const approvedSettings = frozenInput.settings

    // The snapshot reflects the approved (default 16:9) preview, not an edit.
    expect(approvedSettings.aspectRatio).toBe('16:9')
    expect(approvedSettings.width).toBe(1920)
    expect(approvedSettings.height).toBe(1080)
    expect(approvedSettings.fps).toBeTypeOf('number')

    // The renderer receives the same frozen object as both inputProps and the
    // composition's defaultProps — i.e. one immutable snapshot.
    expect(captured.composition.defaultProps).toBe(frozenInput)
    expect(captured.composition.id).toBe('PersonalizationComposition')

    // Finish the render so the test can complete.
    resolveRender()
    await act(async () => {
      await createPromise
    })

    expect(getCtx(ref).generation.status).toBe('complete')
    expect(getCtx(ref).result).toBeTruthy()
  })

  it('is unaffected by edits made after the render starts', async () => {
    const ref: HarnessRef = { current: null }
    await renderProvider(ref)
    await openSource(ref)

    let captured: any = null
    let resolveRender: () => void = () => {}
    renderMediaOnWeb.mockImplementation(async (opts: any) => {
      captured = opts
      return new Promise((resolve) => {
        resolveRender = () =>
          resolve({ getBlob: async () => makeBlob() })
      })
    })

    await act(async () => {
      getCtx(ref).approvePersonalization()
    })
    await act(async () => {})

    const createPromise = getCtx(ref).createFinalVideo()
    await act(async () => {})
    await vi.waitFor(() => expect(renderMediaOnWeb).toHaveBeenCalledTimes(1), { timeout: 5000 })

    const frozenAspectRatio = captured.inputProps.settings.aspectRatio
    const frozenWidth = captured.inputProps.settings.width
    const frozenLayers = captured.inputProps.settings.layers

    // Simulate the user changing the live preview WHILE the render is in flight.
    await act(async () => {
      getCtx(ref).updatePreviewComposition({ aspectRatio: '1:1' })
    })
    await act(async () => {
      getCtx(ref).updatePreviewLayer('headline', { text: 'Edited while rendering' })
    })
    await act(async () => {})

    // The renderer still holds the frozen, pre-edit snapshot.
    expect(captured.inputProps.settings.aspectRatio).toBe(frozenAspectRatio)
    expect(captured.inputProps.settings.width).toBe(frozenWidth)
    expect(captured.inputProps.settings.layers).toBe(frozenLayers)
    expect(captured.inputProps.settings.aspectRatio).toBe('16:9')

    // …while the live preview state has moved on.
    expect(getCtx(ref).previewSettings.aspectRatio).toBe('1:1')

    resolveRender()
    await act(async () => {
      await createPromise
    })

    expect(getCtx(ref).generation.status).toBe('complete')
  })

  it('rejects rendering until a preview has been approved', async () => {
    const ref: HarnessRef = { current: null }
    await renderProvider(ref)
    await openSource(ref)

    // No approvePersonalization() call — previewApproved is still false.
    expect(getCtx(ref).previewApproved).toBe(false)

    const result = getCtx(ref).createFinalVideo()
    await act(async () => {
      await result
    })

    expect(renderMediaOnWeb).not.toHaveBeenCalled()
    expect(getCtx(ref).generation.status).toBe('error')
    expect(getCtx(ref).generation.errorMessage).toMatch(/approve the preview/i)
  })
})
