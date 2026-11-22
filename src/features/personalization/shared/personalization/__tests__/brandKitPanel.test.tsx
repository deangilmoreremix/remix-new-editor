// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

const close = vi.fn()
const state: any = {
  businessResearch: { status: 'done', result: { canonicalUrl: 'https://acme.com', brandColors: { primary: '#112233' }, logoUrl: 'https://acme.com/l.png' } },
  clientForm: { businessName: 'Acme', offer: 'Free quote', callToAction: 'Call now' },
  discoveredAssets: [{ id: 'a', previewUrl: 'https://acme.com/p.jpg', category: 'product', selected: true, rejected: false }],
  closePersonalize: close,
}
vi.mock('../DemoPersonalizeProvider', () => ({ useDemoPersonalize: () => state }))
vi.mock('../../../../../lib/router.js', () => ({ navigate: vi.fn() }))
vi.mock('../../../../../lib/supabase.js', () => ({ supabase: null, isSupabaseConfigured: () => false }))

import { BrandKitPanel } from '../BrandKitPanel'
import { navigate } from '../../../../../lib/router.js'
import { consumeStudioPrefill } from '../../../../../lib/studioPrefill.js'

beforeEach(() => { localStorage.clear(); vi.clearAllMocks() })

describe('BrandKitPanel', () => {
  it('shows nothing before a business is found', () => {
    state.businessResearch = { status: 'idle' }
    const keep = state.discoveredAssets
    state.discoveredAssets = []
    const { container } = render(<BrandKitPanel />)
    expect(container.firstChild).toBeNull()
    state.discoveredAssets = keep
    state.businessResearch = { status: 'done', result: { canonicalUrl: 'https://acme.com', brandColors: { primary: '#112233' }, logoUrl: 'https://acme.com/l.png' } }
  })

  it('saves the kit on request, and Make an ad opens Video Studio with the brief', () => {
    render(<BrandKitPanel />)
    fireEvent.click(screen.getByTestId('pz-brand-kit-save'))
    expect(JSON.parse(localStorage.getItem('brand_dna_list') || '[]')).toHaveLength(1)
    fireEvent.click(screen.getByTestId('pz-brand-kit-make-ad'))
    expect(navigate).toHaveBeenCalledWith('video')
    expect(close).toHaveBeenCalled()
    expect(consumeStudioPrefill('video').prompt).toContain('Acme')
    expect(JSON.parse(localStorage.getItem('brand_dna_list') || '[]')).toHaveLength(1)
  })
})
