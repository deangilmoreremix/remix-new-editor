// @vitest-environment jsdom
/**
 * Certification: cancellation of the branded render.
 *
 * `createFinalVideo` hands an `AbortController` (owned by `exportPersonalizedVideo`)
 * to `@remotion/web-renderer`, and the provider exposes it through
 * `cancelExport()` -> `cancelActiveExport()`. Cancelling must (a) flip the UI
 * state back to idle/0 and (b) actually reach the renderer's abort signal. These
 * tests prove both halves: the abort signal that reaches `renderMediaOnWeb` is
 * the same one `cancelExport()` fires, and the provider resets its state.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act } from 'react'
import {
  cancelActiveExport,
  configureCapableBrowser,
  getCtx,
  isExportActive,
  openSource,
  renderMediaOnWeb,
  renderProvider,
  resetRendererMocks,
  type HarnessRef,
} from './_createFinalVideoHarness'
import { cancelActiveExport as cancelExportDirect } from '../webExport'

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
  cancelExportDirect()
  document.body.innerHTML = ''
})

describe('createFinalVideo cancellation', () => {
  it('wires an abort signal to the renderer and reaches it on cancel', async () => {
    const ref: HarnessRef = { current: null }
    await renderProvider(ref)
    await openSource(ref)

    await act(async () => {
      getCtx(ref).approvePersonalization()
    })
    await act(async () => {})

    // A render that stays pending until the signal aborts — mirroring a long
    // encode the user chooses to cancel.
    let abortHandler: (() => void) | null = null
    renderMediaOnWeb.mockImplementation(async (opts: any) => {
      return new Promise((_, reject) => {
        if (opts.signal) {
          abortHandler = () =>
            reject(new DOMException('The render was cancelled.', 'AbortError'))
          opts.signal.addEventListener('abort', abortHandler)
        }
      })
    })

    expect(isExportActive()).toBe(false)

    const createPromise = getCtx(ref).createFinalVideo()
    await act(async () => {})
    await vi.waitFor(() => expect(renderMediaOnWeb).toHaveBeenCalledTimes(1), { timeout: 5000 })

    const renderCall = renderMediaOnWeb.mock.calls[0][0] as any
    expect(renderCall.signal).toBeInstanceOf(AbortSignal)
    expect(renderCall.signal.aborted).toBe(false)

    // While rendering, the export is marked active and the UI reflects progress.
    expect(isExportActive()).toBe(true)
    expect(getCtx(ref).generation.status).toBe('generating')
    expect(getCtx(ref).generation.progress).toBe(5)

    // Fire cancellation from the UI callback.
    getCtx(ref).cancelExport()

    // The signal that reached the renderer has flipped to aborted.
    expect(renderCall.signal.aborted).toBe(true)
    expect(isExportActive()).toBe(true) // still active until the render settles

    await act(async () => {
      await createPromise
    })

    // State resets to idle and the export is no longer active.
    expect(getCtx(ref).generation.status).toBe('idle')
    expect(getCtx(ref).generation.progress).toBe(0)
    expect(getCtx(ref).generation.errorMessage).toBe(null)
    expect(isExportActive()).toBe(false)
    abortHandler = null
  })

  it('cancelActiveExport is a no-op when nothing is rendering', () => {
    expect(isExportActive()).toBe(false)
    expect(cancelExportDirect()).toBe(false)
    expect(isExportActive()).toBe(false)
  })

  it('completes through the cancelled branch when aborted before resolve', async () => {
    const ref: HarnessRef = { current: null }
    await renderProvider(ref)
    await openSource(ref)
    await act(async () => {
      getCtx(ref).approvePersonalization()
    })
    await act(async () => {})

    renderMediaOnWeb.mockImplementation(async (opts: any) => {
      return new Promise((_, reject) => {
        opts.signal?.addEventListener('abort', () =>
          reject(new DOMException('Aborted', 'AbortError')),
        )
      })
    })

    const createPromise = getCtx(ref).createFinalVideo()
    await act(async () => {})
    await vi.waitFor(() => expect(renderMediaOnWeb).toHaveBeenCalledTimes(1), { timeout: 5000 })

    getCtx(ref).cancelExport()

    await act(async () => {
      await createPromise
    })

    expect(getCtx(ref).generation.status).toBe('idle')
    expect(isExportActive()).toBe(false)
  })
})
