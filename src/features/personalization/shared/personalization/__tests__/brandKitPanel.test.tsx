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

  it('scans more pages, shows fonts and tone, and opens the chosen studio', async () => {
    const profile = { fonts: ['Poppins'], toneOfVoice: ['friendly'], offerings: ['Drain cleaning'], testimonials: [], images: [], pages: [{ url: 'https://acme.com/about', kind: 'about' }], inferred: ['toneOfVoice'] }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true, profile }) }))
    render(<BrandKitPanel />)
    fireEvent.click(screen.getByTestId('pz-brand-kit-scan'))
    expect(await screen.findByText('Read 1 page')).toBeTruthy()
    expect(screen.getByTestId('pz-brand-kit-profile').textContent).toContain('Poppins')
    expect(screen.getByTestId('pz-brand-kit-profile').textContent).toContain('inferred')
    fireEvent.change(screen.getByLabelText('Make with'), { target: { value: 'storyboard' } })
    fireEvent.click(screen.getByTestId('pz-brand-kit-make-ad'))
    expect(navigate).toHaveBeenCalledWith('storyboard')
    expect(consumeStudioPrefill('storyboard').prompt).toContain('5 scenes')
    vi.unstubAllGlobals()
  })

  it('shows a scan error without losing the kit', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, json: async () => ({ ok: false, error: 'Could not read that website' }) }))
    render(<BrandKitPanel />)
    fireEvent.click(screen.getByTestId('pz-brand-kit-scan'))
    expect(await screen.findByText('Could not read that website')).toBeTruthy()
    expect(screen.getByTestId('pz-brand-kit-make-ad')).toBeTruthy()
    vi.unstubAllGlobals()
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
