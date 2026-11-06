// @vitest-environment jsdom
/**
 * Certification: progress mapping for the branded render.
 *
 * `@remotion/web-renderer` reports real render progress as 0..1, but the
 * personalization modal reuses a single generation progress bar that must never
 * read 0% (looks stuck) or 100% (claims done) mid-render. `createFinalVideo`
 * maps the renderer progress into a 10..95% band. These tests capture the exact
 * `onProgress` closure wired to the renderer and certify the mapping, including
 * out-of-range and non-finite inputs.
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

describe('createFinalVideo progress mapping (0..1 -> 10..95%)', () => {
  async function startRender(ref: HarnessRef) {
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

    return { captured, resolveRender, createPromise }
  }

  it('starts at 5% ("preparing") before the renderer reports any progress', async () => {
    const ref: HarnessRef = { current: null }
    await renderProvider(ref)
    await openSource(ref)

    await startRender(ref)
    const gen = getCtx(ref).generation
    expect(gen.status).toBe('generating')
    expect(gen.progress).toBe(5)
    expect(gen.progressMessage).toMatch(/preparing/i)
  })

  it('maps the full 0..1 range into the 10..95% band', async () => {
    const ref: HarnessRef = { current: null }
    await renderProvider(ref)
    await openSource(ref)

    const { captured, resolveRender, createPromise } = await startRender(ref)
    const onProgress = captured.onProgress as (payload: { progress: number }) => void

    await act(async () => {
      onProgress({ progress: 0 })
    })
    expect(getCtx(ref).generation.progress).toBe(10)

    await act(async () => {
      onProgress({ progress: 0.25 })
    })
    expect(getCtx(ref).generation.progress).toBe(25)

    await act(async () => {
      onProgress({ progress: 0.5 })
    })
    expect(getCtx(ref).generation.progress).toBe(50)
    expect(getCtx(ref).generation.status).toBe('processing')
    expect(getCtx(ref).generation.progressMessage).toBe('Rendering your branded video… 50%')

    await act(async () => {
      onProgress({ progress: 0.75 })
    })
    expect(getCtx(ref).generation.progress).toBe(75)

    await act(async () => {
      onProgress({ progress: 1 })
    })
    expect(getCtx(ref).generation.progress).toBe(95)

    resolveRender()
    await act(async () => {
      await createPromise
    })
    // Final completion is reported separately at 100%.
    expect(getCtx(ref).generation.progress).toBe(100)
    expect(getCtx(ref).generation.status).toBe('complete')
  })

  it('clamps out-of-range and non-finite renderer values into the band', async () => {
    const ref: HarnessRef = { current: null }
    await renderProvider(ref)
    await openSource(ref)

    const { captured, resolveRender, createPromise } = await startRender(ref)
    const onProgress = captured.onProgress as (payload: { progress: number }) => void

    await act(async () => {
      onProgress({ progress: -0.5 })
    })
    expect(getCtx(ref).generation.progress).toBe(10)

    await act(async () => {
      onProgress({ progress: 1.5 })
    })
    expect(getCtx(ref).generation.progress).toBe(95)

    await act(async () => {
      onProgress({ progress: Number.NaN })
    })
    expect(getCtx(ref).generation.progress).toBe(10)

    resolveRender()
    await act(async () => {
      await createPromise
    })
  })

  it('never reports 0% or 100% from the renderer callback', async () => {
    const ref: HarnessRef = { current: null }
    await renderProvider(ref)
    await openSource(ref)

    const { captured, resolveRender, createPromise } = await startRender(ref)
    const onProgress = captured.onProgress as (payload: { progress: number }) => void

    for (const input of [0, 0.01, 0.1, 0.5, 0.9, 0.99, 1]) {
      await act(async () => {
        onProgress({ progress: input })
      })
      const progress = getCtx(ref).generation.progress
      expect(progress).toBeGreaterThanOrEqual(10)
      expect(progress).toBeLessThanOrEqual(95)
    }

    resolveRender()
    await act(async () => {
      await createPromise
    })
  })
})
