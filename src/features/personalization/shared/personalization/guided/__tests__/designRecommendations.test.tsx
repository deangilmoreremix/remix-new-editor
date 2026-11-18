// @vitest-environment jsdom
import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { listRemotionDesignTemplates } from '../../templates'

vi.mock('../PersonalizationTemplateBrowser', () => ({ PersonalizationTemplateBrowser: () => <div data-testid="full-browser" /> }))
import { DesignRecommendations } from '../DesignRecommendations'

beforeAll(() => { (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true })
afterEach(() => { document.body.innerHTML = '' })

const designs = listRemotionDesignTemplates()
function mount(over: Partial<React.ComponentProps<typeof DesignRecommendations>> = {}) {
  const onSelectDesign = vi.fn(); const onAddDesign = vi.fn()
  const el = document.createElement('div'); document.body.appendChild(el)
  act(() => {
    createRoot(el).render(<DesignRecommendations designs={designs} aspectRatio="16:9" activeDesignId={null} available={{ logo: true, product: true, service: true }} onSelectDesign={onSelectDesign} onSelectLayout={vi.fn()} onAddDesign={onAddDesign} {...over} />)
  })
  return { el, onSelectDesign, onAddDesign }
}
const q = (el: HTMLElement, id: string) => el.querySelector(`[data-testid="${id}"]`) as HTMLElement | null

describe('DesignRecommendations', () => {
  it('shows goals and about six recommended designs, not one button per design', () => {
    const { el } = mount()
    expect(el.querySelectorAll('[data-testid^="design-goal-"]').length).toBeGreaterThanOrEqual(4)
    const n = el.querySelectorAll('[data-testid^="design-rec-"]').length
    expect(n).toBeGreaterThan(0); expect(n).toBeLessThanOrEqual(6)
    expect(n).toBeLessThan(designs.length)
  })
  it('changing the goal changes the recommendations', () => {
    const { el } = mount()
    const ids = () => [...el.querySelectorAll('[data-testid^="design-rec-"]')].map((b) => b.getAttribute('data-testid')).join(',')
    const before = ids()
    act(() => { q(el, 'design-goal-brand-moment')!.click() })
    expect(ids()).not.toBe(before)
    expect(q(el, 'design-goal-brand-moment')!.getAttribute('aria-pressed')).toBe('true')
  })
  it('selecting a recommended design uses the single shared selection; selecting the active one clears it', () => {
    const { el, onSelectDesign } = mount()
    act(() => { q(el, 'design-how-replace')!.click() })
    const first = el.querySelector('[data-testid^="design-rec-"]') as HTMLElement
    act(() => { first.click() })
    expect(onSelectDesign).toHaveBeenCalledWith(first.getAttribute('data-testid')!.replace('design-rec-', ''))
    document.body.innerHTML = ''
    const id = first.getAttribute('data-testid')!.replace('design-rec-', '')
    const m2 = mount({ activeDesignId: id })
    act(() => { q(m2.el, 'design-how-replace')!.click() })
    act(() => { (m2.el.querySelector(`[data-testid="design-rec-${id}"]`) as HTMLElement).click() })
    expect(m2.onSelectDesign).toHaveBeenCalledWith(null)
  })
  it('the full searchable library is one click away', () => {
    const { el } = mount()
    expect(q(el, 'full-browser')).toBeNull()
    act(() => { q(el, 'design-browse-all')!.click() })
    expect(q(el, 'full-browser')).not.toBeNull()
  })
  it('adds the design on top (keeping the layout) by default instead of replacing it', () => {
    const { el, onSelectDesign, onAddDesign } = mount()
    expect(q(el, 'design-how-add')!.getAttribute('aria-pressed')).toBe('true')
    const first = el.querySelector('[data-testid^="design-rec-"]') as HTMLElement
    act(() => { first.click() })
    expect(onAddDesign).toHaveBeenCalledWith(first.getAttribute('data-testid')!.replace('design-rec-', ''))
    expect(onSelectDesign).not.toHaveBeenCalled()
  })
  it('preselects the suggested goal with its reason until the customer picks one', () => {
    const { el } = mount({ suggestion: { goal: 'promote-offer', reason: 'Their website has online booking.' } })
    expect(q(el, 'design-goal-promote-offer')!.getAttribute('aria-pressed')).toBe('true')
    expect(q(el, 'design-goal-reason')!.textContent).toContain('online booking')
    act(() => { q(el, 'design-goal-brand-moment')!.click() })
    expect(q(el, 'design-goal-brand-moment')!.getAttribute('aria-pressed')).toBe('true')
    expect(q(el, 'design-goal-reason')).toBeNull()
  })
})
