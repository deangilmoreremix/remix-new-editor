// @vitest-environment jsdom
/**
 * Regression tests for Defect A (Phase 3):
 * branded render's `'processing'` status must be visible as in-progress in
 * both:
 *   - the modal's progress view (PersonalizationModal.tsx — the spinner +
 *     progress bar + message), driven by `personalizationInProgress`
 *   - the Simple Mode wizard's step 4 (StepPreviewApprove.tsx — the "Cancel
 *     render" button while the in-browser export is running), driven by the
 *     component's local `generating` flag
 *
 * Before this fix the `'processing'` status was excluded from both lists, so
 * during the actual render the UI fell back to the idle "Render branded
 * video" label with no progress bar, no message and no Cancel button.
 *
 * `useDemoPersonalize` is mocked so the test drives `generation.status`
 * directly without spinning up the real provider (which has its own network
 * I/O, debounced Supabase persistence, and dozens of side effects that
 * don't belong in a focused regression test). The provider's
 * branded-render code at DemoPersonalizeProvider.tsx:3780 transitions to
 * status='processing' during the actual render — exactly the value we
 * inject here.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'

import { useDemoPersonalize } from '../DemoPersonalizeProvider'
import { StepPreviewApprove } from '../guided/StepPreviewApprove'

// Mocks MUST be registered before the component import resolves.
vi.mock('../DemoPersonalizeProvider', () => ({
  useDemoPersonalize: vi.fn(),
}))

// `lucide-react` icons are tree-shakeable; importing the real module keeps
// the test aligned with what StepPreviewApprove actually renders.

URL.createObjectURL = vi.fn(() => 'blob:http://localhost/test')
URL.revokeObjectURL = vi.fn()

// Default minimum viable context. Tests override the bits they need.
const baseCtx = {
  source: {
    id: 'render-progress-test',
    title: 'Render progress test',
    mediaType: 'video',
    originalPrompt: 'p',
    sourceMedia: null,
    poster: null,
    fullPrompt: 'p',
    shortPrompt: 'p',
    sourceType: 'landing-demo',
    sourceMetadata: {},
  },
  access: 'authenticated',
  clientForm: {},
  assets: {},
  previewSettings: {
    layout: 'business-introduction',
    layers: [],
    brandColors: { primary: '#222', secondary: '#888', accent: '#0ff' },
    aspectRatio: '16:9',
    fps: 30,
    durationInFrames: 90,
    showEndCard: false,
    width: 1280,
    height: 720,
  },
  previewVideo: null,
  updatePreviewComposition: vi.fn(),
  setPreviewLayout: vi.fn(),
  previewApproved: true,
  approvePersonalization: vi.fn(),
  createFinalVideo: vi.fn(),
  cancelExport: vi.fn(),
  apiKey: 'test-key',
  generation: { status: 'idle' },
  result: null,
  // mode=null → chooseFinalOutputPath returns 'branded-render' (the path
  // that runs in-browser and is the one Phase 3's `processing` status
  // belongs to).
  mode: null,
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(useDemoPersonalize).mockReturnValue(baseCtx as any)
})

afterEach(() => {
  cleanup()
})

function renderWithGeneration(generation: { status: string; progress?: number; progressMessage?: string }) {
  vi.mocked(useDemoPersonalize).mockReturnValue({
    ...baseCtx,
    generation: { ...baseCtx.generation, ...generation },
  } as any)
  return render(<StepPreviewApprove />)
}

describe('StepPreviewApprove — render progress / cancellation (Defect A)', () => {
  it('shows the "Cancel render" button while generation.status === "processing"', () => {
    const { container } = renderWithGeneration({
      status: 'processing',
      progress: 47,
      progressMessage: 'Rendering your branded video… 47%',
    })
    // The Cancel button is the canonical regression marker: when this text is
    // missing during a real render, the user has no way to stop a stuck job.
    expect(screen.getByRole('button', { name: /cancel render/i })).toBeTruthy()
    // The button copy on the primary CTA also reflects progress.
    expect(container.textContent || '').toMatch(/Rendering… 47%/)
    // The provider's progress message is rendered as supporting copy.
    expect(container.textContent || '').toMatch(/Rendering your branded video… 47%/)
  })

  it('shows the "Cancel render" button while generation.status === "generating" (no regression)', () => {
    const { container } = renderWithGeneration({
      status: 'generating',
      progress: 20,
      progressMessage: 'Preparing assets…',
    })
    expect(screen.getByRole('button', { name: /cancel render/i })).toBeTruthy()
    expect(container.textContent || '').toMatch(/Rendering… 20%/)
  })

  it('does NOT show "Cancel render" when generation.status is "idle" (no regression)', () => {
    renderWithGeneration({ status: 'idle' })
    // Step 4 still mounts the create buttons, but the Cancel-render button is
    // gated behind the in-progress flag — it must be absent in idle state.
    expect(screen.queryByRole('button', { name: /cancel render/i })).toBeNull()
  })

  it('does NOT show "Cancel render" when generation.status is "complete" (no regression)', () => {
    renderWithGeneration({ status: 'complete', progress: 100, progressMessage: 'Branded video ready' })
    expect(screen.queryByRole('button', { name: /cancel render/i })).toBeNull()
  })
})