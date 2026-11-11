// @vitest-environment jsdom
/**
 * Phase 3 item 13 — the fixed-SVG-id constraint warning.
 *
 * Three designs (`logo-mask-wipe`, `logo-reveal`, `rve-circular-progress`)
 * hardcode SVG `id` attributes inside frozen upstream files, so mounting a
 * SECOND instance of the same design clips it against the first (SVG ids are
 * document-global: both instances resolve to the first instance's geometry).
 *
 * The constraint is declared in `templates/catalog.ts`
 * (`REMOTION_DESIGN_FIXED_SVG_IDS` + `getRemotionDesignFixedSvgIdWarning`)
 * and surfaced in the Step 4 UI (`guided/StepPreviewApprove.tsx`) next to
 * the "Designs" chip row. This file covers both halves:
 *  1. unit tests on the catalog helper;
 *  2. a rendered Step 4 test proving the warning appears for a constrained
 *     design and does not appear for an unconstrained one.
 *
 * For (2), the full Step 4 UI is mounted with the heavy children (the
 * before/after preview and the overlay editor) and the personalization
 * provider mocked out — the step's own wiring (chip row, error line, warning
 * line) is real, which is exactly the surface under test.
 */
import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'

import {
  REMOTION_DESIGN_FIXED_SVG_IDS,
  getRemotionDesignFixedSvgIdWarning,
} from '../catalog'

let mockCtx: Record<string, unknown>

vi.mock('../../DemoPersonalizeProvider', () => ({
  useDemoPersonalize: () => mockCtx,
}))
vi.mock('../../guided/OverlayEditor', () => ({
  OverlayEditor: () => null,
}))
vi.mock('../../preview/BeforeAfterPreview', () => ({
  BeforeAfterPreview: () => null,
}))
vi.mock('../../guided/buildPreviewInput', () => ({
  buildPreviewInput: () => ({}),
}))

const { StepPreviewApprove } = await import('../../guided/StepPreviewApprove')

function makeCtx(activeRemotionDesignId: string | null): Record<string, unknown> {
  return {
    source: null,
    access: 'authenticated',
    clientForm: {},
    assets: {},
    previewSettings: {
      layout: 'business-introduction',
      aspectRatio: '16:9',
      fps: 30,
      durationInFrames: 90,
      showEndCard: false,
    },
    previewVideo: null,
    updatePreviewComposition: () => {},
    setPreviewLayout: () => {},
    remotionDesignTemplates: [
      { id: 'logo-mask-wipe', name: 'Logo Mask Wipe', description: 'constrained fixture' },
      { id: 'animated-headline', name: 'Animated Headline', description: 'unconstrained fixture' },
    ],
    activeRemotionDesignId,
    setRemotionDesign: () => {},
    remotionDesignError: null,
    previewApproved: false,
    approvePersonalization: () => {},
    createFinalVideo: async () => {},
    cancelExport: () => {},
    apiKey: 'test-key',
    generation: null,
    result: null,
    mode: 'local',
  }
}

beforeEach(() => {
  mockCtx = makeCtx(null)
})

// No vitest `globals` in this project → testing-library's auto-cleanup does
// not run, so each render must be torn down explicitly or `screen` would see
// the previous test's DOM.
afterEach(() => {
  cleanup()
})

describe('getRemotionDesignFixedSvgIdWarning (catalog helper)', () => {
  it('declares exactly the three constrained designs', () => {
    expect(Object.keys(REMOTION_DESIGN_FIXED_SVG_IDS).sort()).toEqual([
      'logo-mask-wipe',
      'logo-reveal',
      'rve-circular-progress',
    ])
  })

  it('returns the warning, naming the fixed SVG ids, for a constrained design', () => {
    for (const templateId of ['logo-mask-wipe', 'logo-reveal', 'rve-circular-progress']) {
      const warning = getRemotionDesignFixedSvgIdWarning(templateId)
      expect(warning).not.toBeNull()
      for (const fixedId of REMOTION_DESIGN_FIXED_SVG_IDS[templateId]) {
        expect(warning).toContain(`"${fixedId}"`)
      }
      expect(warning).toContain('ONE instance')
      expect(warning).toContain('clipped')
    }
  })

  it('returns null for unconstrained designs, unknown ids and no selection', () => {
    expect(getRemotionDesignFixedSvgIdWarning('animated-headline')).toBeNull()
    expect(getRemotionDesignFixedSvgIdWarning('lower-third')).toBeNull()
    expect(getRemotionDesignFixedSvgIdWarning('not-a-real-design')).toBeNull()
    expect(getRemotionDesignFixedSvgIdWarning('')).toBeNull()
    expect(getRemotionDesignFixedSvgIdWarning(null)).toBeNull()
    expect(getRemotionDesignFixedSvgIdWarning(undefined)).toBeNull()
  })
})

describe('Step 4 UI warning (rendered)', () => {
  it('renders the helper warning near the Designs chip row for a constrained design', () => {
    mockCtx = makeCtx('logo-mask-wipe')
    render(<StepPreviewApprove />)

    const note = screen.getByRole('note')
    expect(note.textContent).toBe(getRemotionDesignFixedSvgIdWarning('logo-mask-wipe'))
    expect(note.textContent).toContain('lmw-wipe')
  })

  it('renders no warning for an unconstrained design', () => {
    mockCtx = makeCtx('animated-headline')
    render(<StepPreviewApprove />)

    expect(screen.queryByRole('note')).toBeNull()
  })
})
