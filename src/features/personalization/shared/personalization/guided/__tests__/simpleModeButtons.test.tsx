// @vitest-environment jsdom
/**
 * Simple Mode buttons found by the click-through to do nothing, or the wrong
 * thing: each now does its job or says why it can't.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import { cleanup, render, screen } from '@testing-library/react'

const ctx: Record<string, unknown> = {}
vi.mock('../../DemoPersonalizeProvider', () => ({
  useDemoPersonalize: () => ctx,
}))

import { StepFindBusiness } from '../StepFindBusiness'
import { StepPreviewApprove } from '../StepPreviewApprove'

URL.createObjectURL = vi.fn(() => 'blob:http://localhost/test')
URL.revokeObjectURL = vi.fn()

afterEach(() => {
  cleanup()
  for (const key of Object.keys(ctx)) delete ctx[key]
})

const previewCtx = (overrides: Record<string, unknown> = {}) => Object.assign(ctx, {
  source: { id: 's', title: 'S', mediaType: 'video', originalPrompt: 'p', sourceMedia: null, poster: null, fullPrompt: 'p', shortPrompt: 'p', sourceType: 'landing-demo', sourceMetadata: {} },
  access: 'authenticated',
  clientForm: {},
  assets: {},
  previewSettings: { layout: 'business-introduction', layers: [], brandColors: { primary: '#222', secondary: '#888', accent: '#0ff' }, aspectRatio: '16:9', fps: 30, durationInFrames: 90, showEndCard: false, width: 1280, height: 720 },
  previewVideo: null,
  updatePreviewComposition: vi.fn(),
  setPreviewLayout: vi.fn(),
  previewApproved: false,
  approvalStale: false,
  approvePersonalization: vi.fn(),
  createFinalVideo: vi.fn(),
  cancelExport: vi.fn(),
  setViewMode: vi.fn(),
  setAdvancedTab: vi.fn(),
  setAdvancedSection: vi.fn(),
  apiKey: 'test-key',
  generation: { status: 'idle' },
  result: null,
  mode: null,
  ...overrides,
})

describe('Step 1: Find business assets (signed in)', () => {
  it('runs the full workflow, which fills the business name', async () => {
    const runDiscoveryWorkflow = vi.fn(async () => {})
    const discoverAssets = vi.fn()
    Object.assign(ctx, {
      clientForm: { website: 'https://joes.example' },
      access: 'authenticated',
      discoveredAssets: [],
      discoveryStatus: 'idle',
      discoveryError: null,
      updateClientForm: vi.fn(),
      runDiscoveryWorkflow,
      discoverAssets,
      saveClient: vi.fn(),
      setViewMode: vi.fn(),
    })
    render(<StepFindBusiness />)
    await act(async () => { screen.getByText('Find business assets').click() })
    expect(runDiscoveryWorkflow).toHaveBeenCalledWith('https://joes.example')
    expect(discoverAssets).not.toHaveBeenCalled()
  })

  it('has a Business name field', () => {
    const updateClientForm = vi.fn()
    Object.assign(ctx, { clientForm: {}, access: 'authenticated', discoveredAssets: [], discoveryStatus: 'idle', updateClientForm, runDiscoveryWorkflow: vi.fn(), saveClient: vi.fn(), setViewMode: vi.fn() })
    render(<StepFindBusiness />)
    expect(document.querySelector('#guided-business-name-step1')).toBeTruthy()
  })
})

describe('Step 4: approve, render and AI', () => {
  it('Render needs an approval first, and says so', () => {
    previewCtx()
    render(<StepPreviewApprove />)
    const renderButton = screen.getByRole('button', { name: /Render branded video/ }) as HTMLButtonElement
    expect(renderButton.disabled).toBe(true)
    expect(screen.getByTestId('guided-render-needs-approval').textContent).toMatch(/Approve the preview first/)
  })

  it('after approving: Approved ✓ (disabled) and Render enabled', () => {
    previewCtx({ previewApproved: true })
    render(<StepPreviewApprove />)
    expect((screen.getByText('Approved ✓').closest('button') as HTMLButtonElement).disabled).toBe(true)
    const renderButton = () => screen.getByRole('button', { name: /Render branded video/ }) as HTMLButtonElement
    // An unrecorded licence is never assumed: the customer confirms before a final export.
    expect(renderButton().disabled).toBe(true)
    const confirm = screen.getByTestId('guided-rights-confirm').querySelector('input') as HTMLInputElement
    act(() => { confirm.click() })
    expect(renderButton().disabled).toBe(false)
  })

  it('says when a change cleared the approval', () => {
    previewCtx({ approvalStale: true })
    render(<StepPreviewApprove />)
    expect(screen.getByTestId('guided-approval-stale').textContent).toMatch(/approve again/)
  })

  it('Generate with AI explains itself and links to Advanced Editing', async () => {
    previewCtx()
    render(<StepPreviewApprove />)
    await act(async () => { screen.getByText('in Advanced Editing →').click() })
    expect(ctx.setViewMode).toHaveBeenCalledWith('advanced')
    expect(ctx.setAdvancedTab).toHaveBeenCalledWith('create')
    expect(ctx.setAdvancedSection).toHaveBeenCalledWith('create', 'output')
  })
})
