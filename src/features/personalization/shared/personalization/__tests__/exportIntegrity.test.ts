// @vitest-environment jsdom
/**
 * Phase 4 — export integrity for the credit-free (browser) render: a failed render is a failure
 * (no success, no result), the customer's work is untouched, and Retry re-renders without any AI call.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act } from 'react'
vi.mock('../generationRouter', () => ({ runGeneration: vi.fn() }))
import { runGeneration } from '../generationRouter'
import {
  cancelActiveExport, configureCapableBrowser, getCtx, openSource, renderMediaOnWeb, renderProvider, resetRendererMocks, type HarnessRef,
} from './_createFinalVideoHarness'

beforeEach(() => {
  localStorage.clear()
  URL.createObjectURL = vi.fn(() => 'blob:http://localhost/final') as any
  URL.revokeObjectURL = vi.fn() as any
  resetRendererMocks()
  configureCapableBrowser()
})
afterEach(() => { cancelActiveExport(); document.body.innerHTML = '' })

describe('browser render failure', () => {
  it('is reported as an error (never complete), keeps all edits, and a retry succeeds with no AI call', async () => {
    const ref: HarnessRef = { current: null }
    await renderProvider(ref)
    await openSource(ref)
    await act(async () => { getCtx(ref).approvePersonalization() })
    await act(async () => {})
    const layersBefore = JSON.stringify(getCtx(ref).previewSettings.layers)

    renderMediaOnWeb.mockRejectedValueOnce(new Error('encoder exploded'))
    await act(async () => { await getCtx(ref).createFinalVideo() })
    expect(getCtx(ref).generation.status).toBe('error')
    expect(String(getCtx(ref).generation.errorMessage)).toMatch(/./)
    expect(getCtx(ref).result?.url ?? null).toBeNull()
    // work preserved: layers, approval and the chosen video are untouched
    expect(JSON.stringify(getCtx(ref).previewSettings.layers)).toBe(layersBefore)
    expect(getCtx(ref).previewApproved).toBe(true)

    renderMediaOnWeb.mockImplementation(async () => ({ getBlob: async () => new Blob(['ok'], { type: 'video/mp4' }) }))
    await act(async () => { await getCtx(ref).createFinalVideo() })
    expect(getCtx(ref).generation.status).toBe('complete')
    expect(getCtx(ref).result.metadata.source).toBe('branded-render')
    expect(runGeneration).not.toHaveBeenCalled()
  })
})

describe('Advanced Editing create button', () => {
  it('approveNow approves what is on screen and renders (no separate approve step in Advanced); without it, an unapproved render still errors', async () => {
    const ref: HarnessRef = { current: null }
    await renderProvider(ref)
    await openSource(ref)
    renderMediaOnWeb.mockImplementation(async () => ({ getBlob: async () => new Blob(['ok'], { type: 'video/mp4' }) }))
    await act(async () => { await getCtx(ref).createFinalVideo() })
    expect(getCtx(ref).generation.status).toBe('error')
    expect(getCtx(ref).previewApproved).toBe(false)
    await act(async () => { await getCtx(ref).createFinalVideo({ approveNow: true }) })
    expect(getCtx(ref).generation.status).toBe('complete')
    expect(getCtx(ref).previewApproved).toBe(true)
    expect(runGeneration).not.toHaveBeenCalled()
  })
})
