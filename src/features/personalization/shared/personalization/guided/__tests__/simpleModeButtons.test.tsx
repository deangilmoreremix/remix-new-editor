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

  describe('Export one video per saved client', () => {
    const seedClients = (n: number) => localStorage.setItem('smartvideo_clients', JSON.stringify(Object.fromEntries(
      Array.from({ length: n }, (_, i) => [`c${i}`, { id: `c${i}`, name: `Biz ${i}`, businessName: `Biz ${i}`, audience: 'client', createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z' }]),
    )))
    const batchButton = () => screen.queryByTestId('guided-export-all-clients') as HTMLButtonElement | null

    it('is hidden with fewer than two saved clients', () => {
      localStorage.clear(); seedClients(1)
      previewCtx({ exportForAllClients: vi.fn(), batchExport: { status: 'idle', progress: 0, message: '' } })
      render(<StepPreviewApprove />)
      expect(batchButton()).toBeNull()
    })

    it('is gated exactly like the single render: approval, then the rights confirmation', () => {
      localStorage.clear(); seedClients(3)
      const exportForAllClients = vi.fn()
      previewCtx({ exportForAllClients, batchExport: { status: 'idle', progress: 0, message: '' } })
      const { rerender } = render(<StepPreviewApprove />)
      expect(batchButton()!.textContent).toMatch(/Export one video per saved client \(3\)/)
      expect(batchButton()!.disabled).toBe(true) // not approved

      previewCtx({ previewApproved: true, exportForAllClients, batchExport: { status: 'idle', progress: 0, message: '' } })
      rerender(<StepPreviewApprove />)
      expect(batchButton()!.disabled).toBe(true) // licence not confirmed yet
      act(() => { (screen.getByTestId('guided-rights-confirm').querySelector('input') as HTMLInputElement).click() })
      expect(batchButton()!.disabled).toBe(false)
      act(() => { batchButton()!.click() })
      expect(exportForAllClients).toHaveBeenCalledTimes(1)
    })

    it('shows progress with Cancel while running, and the summary when done', () => {
      localStorage.clear(); seedClients(2)
      const cancelExport = vi.fn()
      previewCtx({ previewApproved: true, cancelExport, exportForAllClients: vi.fn(), batchExport: { status: 'running', progress: 40, message: 'Video 1 of 2 · Biz 0' } })
      const { rerender } = render(<StepPreviewApprove />)
      expect(batchButton()!.disabled).toBe(true)
      expect(batchButton()!.textContent).toMatch(/Rendering… 40%/)
      act(() => { (screen.getByTestId('guided-export-all-cancel') as HTMLButtonElement).click() })
      expect(cancelExport).toHaveBeenCalled()

      previewCtx({ previewApproved: true, exportForAllClients: vi.fn(), batchExport: { status: 'done', progress: 100, message: 'Exported 2 branded videos' } })
      rerender(<StepPreviewApprove />)
      expect(screen.getByTestId('guided-export-all-status').textContent).toBe('Exported 2 branded videos')
    })
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
