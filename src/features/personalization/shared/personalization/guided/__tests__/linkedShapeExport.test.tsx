// @vitest-environment jsdom
/**
 * The preview step has two free ways to export other shapes: "pick shapes" (ExtraFormatsExport) and the
 * one-click "all shapes" (ShapeExportPanel). They share one renderer, so each must be disabled while the other runs.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import { cleanup, render, screen } from '@testing-library/react'

const ctx: Record<string, unknown> = {}
vi.mock('../../DemoPersonalizeProvider', () => ({ useDemoPersonalize: () => ctx }))

let reportRunning: ((running: boolean) => void) | undefined
vi.mock('../ExtraFormatsExport', () => ({
  ExtraFormatsExport: (props: { disabled?: boolean; onRunningChange?: (r: boolean) => void }) => {
    reportRunning = props.onRunningChange
    return <div data-testid="mock-extra" data-disabled={String(!!props.disabled)} />
  },
}))
vi.mock('../ShapeExportPanel', () => ({
  ShapeExportPanel: (props: { disabled: boolean }) => <div data-testid="mock-shapes" data-disabled={String(props.disabled)} />,
}))

import { StepPreviewApprove } from '../StepPreviewApprove'

URL.createObjectURL = vi.fn(() => 'blob:http://localhost/test')
URL.revokeObjectURL = vi.fn()

afterEach(() => {
  cleanup()
  reportRunning = undefined
  for (const key of Object.keys(ctx)) delete ctx[key]
})

const setup = (overrides: Record<string, unknown> = {}) => Object.assign(ctx, {
  source: { id: 's', title: 'S', mediaType: 'video', originalPrompt: 'p', sourceMedia: null, poster: null, fullPrompt: 'p', shortPrompt: 'p', sourceType: 'landing-demo' },
  access: 'authenticated',
  clientForm: {},
  assets: {},
  previewSettings: { layout: 'business-introduction', layers: [], brandColors: { primary: '#222', secondary: '#888', accent: '#0ff' }, aspectRatio: '16:9', fps: 30, durationInFrames: 90, width: 1920, height: 1080 },
  previewVideo: null,
  updatePreviewComposition: vi.fn(),
  setPreviewLayout: vi.fn(),
  previewApproved: true,
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

// An unrecorded licence is never assumed: confirm it so only the export-sharing rule is under test.
const confirmLicence = async () => { await act(async () => { (screen.getByTestId('guided-rights-confirm').querySelector('input') as HTMLInputElement).click() }) }

const disabled = (id: string) => screen.getByTestId(id).getAttribute('data-disabled') === 'true'

describe('shape export controls in the preview step', () => {
  it('shows both controls once the preview is approved', () => {
    setup({ shapeExport: { status: 'idle', items: [] } })
    render(<StepPreviewApprove />)
    expect(screen.getByTestId('mock-extra')).toBeTruthy()
    expect(screen.getByTestId('mock-shapes')).toBeTruthy()
  })

  it('disables the one-click panel while the picker is rendering', async () => {
    setup({ shapeExport: { status: 'idle', items: [] } })
    render(<StepPreviewApprove />)
    await confirmLicence()
    expect(disabled('mock-shapes')).toBe(false)
    await act(async () => { reportRunning?.(true) })
    expect(disabled('mock-shapes')).toBe(true)
    await act(async () => { reportRunning?.(false) })
    expect(disabled('mock-shapes')).toBe(false)
  })

  it('disables the picker while the one-click export is running, and not otherwise', async () => {
    setup({ shapeExport: { status: 'running', items: [] } })
    render(<StepPreviewApprove />)
    await confirmLicence()
    expect(disabled('mock-extra')).toBe(true)
    cleanup()
    setup({ shapeExport: { status: 'idle', items: [] } })
    render(<StepPreviewApprove />)
    await confirmLicence()
    expect(disabled('mock-extra')).toBe(false)
  })
})
