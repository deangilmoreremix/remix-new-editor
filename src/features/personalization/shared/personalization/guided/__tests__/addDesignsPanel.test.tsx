// @vitest-environment jsdom
import React from 'react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { createDefaultPreviewSettings } from '../../preview/presets'
import { listRemotionDesignTemplates } from '../../templates'

vi.mock('../../DemoPersonalizeProvider', () => ({ useDemoPersonalize: vi.fn() }))
vi.mock('../DesignRecommendations', () => ({ DesignRecommendations: () => <div data-testid="recs" /> }))
import { useDemoPersonalize } from '../../DemoPersonalizeProvider'
import { AddDesignsPanel } from '../AddDesignsPanel'

afterEach(() => { cleanup(); vi.restoreAllMocks() })

function setup(error: string | null) {
  vi.mocked(useDemoPersonalize).mockImplementation(() => ({
    previewSettings: createDefaultPreviewSettings(), assets: {}, remotionDesignTemplates: listRemotionDesignTemplates(),
    activeRemotionDesignId: null, setRemotionDesign: vi.fn(), addRemotionDesign: vi.fn(), setPreviewLayout: vi.fn(),
    removePreviewDesignLayer: vi.fn(), moveAddedDesign: vi.fn(), updatePreviewLayer: vi.fn(), remotionDesignError: error,
  }) as unknown as ReturnType<typeof useDemoPersonalize>)
  return render(<AddDesignsPanel />)
}

describe('AddDesignsPanel refusal message', () => {
  it('shows the message once, above the recommendations and the library', () => {
    setup('Only one full scene at a time.')
    const alerts = screen.getAllByRole('alert')
    expect(alerts).toHaveLength(1)
    const recs = screen.getByTestId('recs')
    expect(alerts[0].compareDocumentPosition(recs) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })
  it('scrolls the message into view when it appears', () => {
    const scroll = vi.fn()
    HTMLElement.prototype.scrollIntoView = scroll
    setup('Only one full scene at a time.')
    expect(scroll).toHaveBeenCalledTimes(1)
  })
  it('shows nothing when there is no error', () => {
    setup(null)
    expect(screen.queryByRole('alert')).toBeNull()
  })
})
