// @vitest-environment jsdom
import React, { act } from 'react'
import { describe, it, expect, vi, afterEach, beforeAll } from 'vitest'
import { createRoot } from 'react-dom/client'
import { LayoutQualityPanel } from '../LayoutQualityPanel'
import type { LayoutQualityState } from '../useLayoutQuality'
import type { QualityReport } from '../../preview/placement'
import { createLayer } from '../../preview/presets'

beforeAll(() => { (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true })

const analysis = { protectedZones: 1, frameSamples: 12, subjectVerified: true, contrastVerified: true }
const report = (over: Partial<QualityReport>): QualityReport => ({ status: 'ready', issues: [], blocksExport: false, notes: ['baked note'], analysis, ...over })
const layers = [{ ...createLayer('headline'), id: 'headline' }, { ...createLayer('logo'), id: 'logo' }]

function quality(r: QualityReport, extra: Partial<LayoutQualityState> = {}): LayoutQualityState {
  return {
    report: r, sampling: 'done', zones: [], rightsNeedConfirmation: false,
    profile: {} as never, show: vi.fn(), applyRecommended: vi.fn(() => 0), restoreRecommended: vi.fn(() => 0), markSubject: vi.fn(),
    ...extra,
  }
}
const mounted: { root: ReturnType<typeof createRoot>; el: HTMLElement }[] = []
function mount(q: LayoutQualityState) {
  const el = document.createElement('div'); document.body.appendChild(el)
  const root = createRoot(el); mounted.push({ root, el })
  act(() => { root.render(<LayoutQualityPanel quality={q} layers={layers} />) })
  return el
}
afterEach(() => { for (const { root, el } of mounted.splice(0)) { act(() => root.unmount()); el.remove() } })
const click = (el: Element | null) => act(() => { (el as HTMLElement).click() })

describe('LayoutQualityPanel', () => {
  it('shows the three statuses with their own wording', () => {
    for (const [status, label] of [['ready', 'Ready'], ['needs-adjustment', 'Needs adjustment'], ['review-required', 'Review required']] as const) {
      const el = mount(quality(report({ status })))
      const badge = el.querySelector('[data-testid="layout-quality-status"]')!
      expect(badge.textContent).toBe(label)
      expect(badge.getAttribute('data-status')).toBe(status)
    }
  })

  it('names the affected layer and time, and "Show" jumps there', () => {
    const q = quality(report({
      status: 'needs-adjustment',
      issues: [{ code: 'low-contrast', severity: 'adjust', layerId: 'headline', tStart: 3.5, tEnd: 5, fixable: true, message: 'Headline is hard to read at 3.5 s.' }],
    }))
    const el = mount(q)
    expect(el.textContent).toContain('Headline is hard to read at 3.5 s.')
    expect(el.textContent).toContain('0:03.5–0:05.0 s')
    click(el.querySelector('[data-testid="layout-quality-show"]'))
    expect(q.show).toHaveBeenCalledWith('headline', 3.5)
    click(el.querySelector('[data-testid="layout-quality-fix"]'))
    expect(q.applyRecommended).toHaveBeenCalledWith('headline')
  })

  it('only a critical issue shows "Blocks export"; a review item does not', () => {
    const critical = mount(quality(report({ status: 'needs-adjustment', blocksExport: true, issues: [{ code: 'missing-media', severity: 'critical', layerId: 'logo', fixable: false, message: 'Logo has no image.' }] })))
    expect(critical.querySelector('[data-testid="layout-quality-blocks"]')).toBeTruthy()
    const review = mount(quality(report({ status: 'review-required', issues: [{ code: 'subject-unknown', severity: 'review', fixable: false, message: 'Subject area not marked.' }] })))
    expect(review.querySelector('[data-testid="layout-quality-blocks"]')).toBeNull()
    expect(review.querySelector('[data-testid="layout-quality-fix"]')).toBeNull()
  })

  it('is honest about what could not be measured', () => {
    const el = mount(quality(report({ status: 'review-required', analysis: { ...analysis, frameSamples: 0, subjectVerified: false, protectedZones: 0 } }), { sampling: 'unavailable' }))
    const scope = el.querySelector('[data-testid="layout-quality-scope"]')!.textContent!
    expect(scope).toMatch(/could not be measured/)
    expect(scope).toMatch(/No subject area is marked/)
    expect(el.querySelector('[data-testid="layout-quality-note"]')!.textContent).toBe('baked note')
  })

  it('offers recommend, restore and subject marking', () => {
    const q = quality(report({}))
    const el = mount(q)
    click(el.querySelector('[data-testid="layout-quality-apply"]'))
    click(el.querySelector('[data-testid="layout-quality-restore"]'))
    click(el.querySelector('[data-testid="layout-quality-subject-left"]'))
    click(el.querySelector('[data-testid="layout-quality-subject-clear"]'))
    expect(q.applyRecommended).toHaveBeenCalledWith()
    expect(q.restoreRecommended).toHaveBeenCalled()
    expect(q.markSubject).toHaveBeenNthCalledWith(1, 'left')
    expect(q.markSubject).toHaveBeenNthCalledWith(2, 'clear')
  })
})
