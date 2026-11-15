// @vitest-environment jsdom
/**
 * Phase 1 — credit-free Advanced: "Create without AI" needs no mode, derives from old saved projects,
 * and makes zero AI-generation / prompt-personalization calls (the render is local).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act } from 'react'

vi.mock('../promptPersonalizer', () => ({ personalizePrompt: vi.fn(), regeneratePrompt: vi.fn() }))
vi.mock('../generationRouter', () => ({ runGeneration: vi.fn() }))
import { validateProjectRequirements } from '../ai/toolExecutor'
import { personalizePrompt } from '../promptPersonalizer'
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
  vi.mocked(personalizePrompt).mockClear()
  vi.mocked(runGeneration).mockClear()
})
afterEach(() => { cancelActiveExport(); document.body.innerHTML = '' })

const base = {
  source: { id: 's' } as any,
  clientForm: { businessName: 'Joe Roofing' } as any,
  assets: { identities: [], logos: [], products: [], brandReferences: [] } as any,
  mode: null as any,
  outputType: 'video' as any,
  promptState: { personalized: false } as any,
  genOptions: { consentGiven: false } as any,
}
const errorFields = (ctx: any) => validateProjectRequirements(ctx).filter((r) => r.severity === 'error').map((r) => r.field)

describe('requirements by creation method', () => {
  it('browser creation needs no mode and no likeness consent', () => {
    expect(errorFields({ ...base, creationMethod: 'browser' })).toEqual([])
  })
  it('AI creation (and legacy contexts without the field) still require a mode', () => {
    expect(errorFields({ ...base, creationMethod: 'ai' })).toContain('mode')
    expect(errorFields({ ...base })).toContain('mode')
  })
  it('the business name is still required without AI', () => {
    expect(errorFields({ ...base, clientForm: {}, creationMethod: 'browser' })).toEqual(['client.businessName'])
  })
})

describe('creation method state', () => {
  it('defaults to browser, derives ai from an AI mode, and switching to browser clears the mode', async () => {
    const ref: HarnessRef = { current: null }
    await renderProvider(ref)
    await openSource(ref)
    expect(getCtx(ref).creationMethod).toBe('browser')
    await act(async () => { getCtx(ref).setMode('full_body') })
    expect(getCtx(ref).creationMethod).toBe('ai') // an old project saved with an AI mode
    await act(async () => { getCtx(ref).setCreationMethod('browser') })
    expect(getCtx(ref).mode).toBeNull()
    expect(getCtx(ref).creationMethod).toBe('browser')
    await act(async () => { getCtx(ref).setCreationMethod('ai') })
    expect(getCtx(ref).creationMethod).toBe('ai') // chosen, mode still to be picked
    expect(getCtx(ref).mode).toBeNull()
  })
})

describe('Create without AI makes no AI calls', () => {
  it('createFinalVideo with the browser method never calls prompt personalization or generation', async () => {
    const fetchSpy = vi.fn()
    ;(globalThis as any).fetch = fetchSpy
    const ref: HarnessRef = { current: null }
    await renderProvider(ref)
    await openSource(ref)
    await act(async () => { getCtx(ref).setCreationMethod('browser') })
    await act(async () => { getCtx(ref).approvePersonalization() })
    await new Promise((r) => setTimeout(r, 0))
    fetchSpy.mockClear()
    renderMediaOnWeb.mockImplementation(async () => ({ getBlob: async () => new Blob(['x'], { type: 'video/mp4' }) }))
    await act(async () => { await getCtx(ref).createFinalVideo() })
    expect(personalizePrompt).not.toHaveBeenCalled()
    expect(runGeneration).not.toHaveBeenCalled()
    expect(fetchSpy).not.toHaveBeenCalled()
    expect(getCtx(ref).result.metadata.source).toBe('branded-render')
  })
})
