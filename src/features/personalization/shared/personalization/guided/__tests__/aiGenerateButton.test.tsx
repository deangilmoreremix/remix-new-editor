// @vitest-environment jsdom
/**
 * Step 4's "Generate with AI" button: always clickable, asks for the visitor's own MuAPI key when there is none, and then
 * generates; the free branded render has its own button. Neither needs a sign-in.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'

let mockCtx: Record<string, unknown>
const setApiKey = vi.fn()

vi.mock('../../DemoPersonalizeProvider', () => ({ useDemoPersonalize: () => mockCtx }))
vi.mock('../OverlayEditor', () => ({ OverlayEditor: () => null }))
vi.mock('../../preview/BeforeAfterPreview', () => ({ BeforeAfterPreview: () => null }))
vi.mock('../buildPreviewInput', () => ({ buildPreviewInput: () => ({}) }))
// Panels that analyse or edit the real composition are not what this test is about.
vi.mock('../useLayoutQuality', () => ({ useLayoutQuality: () => ({ report: { blocksExport: false, items: [] }, rightsNeedConfirmation: false }) }))
vi.mock('../LayoutQualityPanel', () => ({ LayoutQualityPanel: () => null }))
vi.mock('../RemoveBrandingControl', () => ({ RemoveBrandingControl: () => null }))
vi.mock('../ShapeExportPanel', () => ({ ShapeExportPanel: () => null }))
vi.mock('../ExtraFormatsExport', () => ({ ExtraFormatsExport: () => null }))
vi.mock('../AddDesignsPanel', () => ({ AddDesignsPanel: () => null }))
const keys = { muapi: '', openai: '' }
vi.mock('@ohb/lib/authConfig', () => ({
  useAuthConfig: () => ({
    apiKey: keys.muapi,
    openaiKey: keys.openai,
    setApiKey: (key: string) => setApiKey(key),
    setOpenAiKey: vi.fn(),
  }),
}))

const { StepPreviewApprove } = await import('../StepPreviewApprove')

function makeCtx(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    source: null,
    access: 'anonymous',
    clientForm: {},
    assets: {},
    previewSettings: { layout: 'business-introduction', aspectRatio: '16:9', fps: 30, durationInFrames: 90, showEndCard: false, layers: [] },
    previewVideo: { url: '/media/demo.mp4', poster: null, title: 'Demo', kind: 'demo' },
    updatePreviewComposition: () => {},
    setPreviewLayout: () => {},
    remotionDesignTemplates: [],
    activeRemotionDesignId: null,
    setRemotionDesign: () => {},
    remotionDesignError: null,
    previewApproved: true,
    approvePersonalization: () => {},
    createFinalVideo: vi.fn(async () => {}),
    cancelExport: () => {},
    apiKey: '',
    generation: null,
    result: null,
    mode: null,
    ...overrides,
  }
}

beforeEach(() => {
  setApiKey.mockReset()
  keys.muapi = ''
  keys.openai = ''
})

afterEach(() => {
  cleanup()
})

describe('Generate with AI', () => {
  it('is clickable in the free flow, with no AI mode and no sign-in', () => {
    mockCtx = makeCtx()
    render(<StepPreviewApprove />)
    expect((screen.getByRole('button', { name: /Generate with AI/ }) as HTMLButtonElement).disabled).toBe(false)
  })

  it('asks for the MuAPI key when there is none, then generates with AI', async () => {
    mockCtx = makeCtx()
    const view = render(<StepPreviewApprove />)
    fireEvent.click(screen.getByRole('button', { name: /Generate with AI/ }))
    expect(mockCtx.createFinalVideo).not.toHaveBeenCalled()

    fireEvent.change(screen.getByLabelText('Your MuAPI key'), { target: { value: 'sk-test-123' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save key and generate' }))
    expect(setApiKey).toHaveBeenCalledWith('sk-test-123')

    // The key store notifies and the step re-renders with the saved key.
    keys.muapi = 'sk-test-123'
    await act(async () => {
      view.rerender(<StepPreviewApprove />)
    })
    expect(mockCtx.createFinalVideo).toHaveBeenCalledWith({ path: 'ai-generation' })
  })

  it('generates straight away when a key is already saved', async () => {
    keys.muapi = 'sk-saved'
    mockCtx = makeCtx()
    render(<StepPreviewApprove />)
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Generate with AI/ }))
    })
    expect(mockCtx.createFinalVideo).toHaveBeenCalledWith({ path: 'ai-generation' })
  })

  it('renders the free branded video with its own button', async () => {
    mockCtx = makeCtx()
    render(<StepPreviewApprove />)
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Render branded video/ }))
    })
    expect(mockCtx.createFinalVideo).toHaveBeenCalledWith({ path: 'branded-render' })
  })
})
