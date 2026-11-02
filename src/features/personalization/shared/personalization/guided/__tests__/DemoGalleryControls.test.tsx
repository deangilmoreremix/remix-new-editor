// @vitest-environment jsdom
/**
 * Unit tests for the reusable, content-free gallery primitives used by the
 * Personalization modal's Demos tab.
 *
 * The primitives must render whatever they are given and nothing more: no
 * hardcoded demo list, no video URL, no premium template record.
 */

import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import {
  DemoCategoryTabs,
  DemoFilterSelect,
  DemoSearchInput,
} from '../DemoGalleryControls'
import { DEMO_CATEGORIES } from '../demoCategories'

afterEach(() => {
  cleanup()
})

describe('DemoCategoryTabs', () => {
  it('renders one tab per category and marks the active one', () => {
    render(
      <DemoCategoryTabs
        categories={DEMO_CATEGORIES}
        counts={{ all: 12, ecommerce: 3 }}
        activeId="all"
        onChange={() => {}}
      />,
    )

    const tabs = screen.getAllByRole('tab')
    expect(tabs).toHaveLength(DEMO_CATEGORIES.length)
    expect(tabs[0].getAttribute('aria-selected')).toBe('true')
    expect(tabs[1].getAttribute('aria-selected')).toBe('false')
  })

  it('shows the count for each category that has one', () => {
    render(
      <DemoCategoryTabs
        categories={DEMO_CATEGORIES}
        counts={{ all: 12, ecommerce: 3 }}
        activeId="ecommerce"
        onChange={() => {}}
      />,
    )

    expect(screen.getByTestId('demo-category-tab-all').textContent).toContain('12')
    expect(screen.getByTestId('demo-category-tab-ecommerce').textContent).toContain('3')
    // Categories without a count render no badge at all.
    expect(screen.getByTestId('demo-category-tab-real-estate').textContent).not.toMatch(/\d/)
  })

  it('reports the clicked category id', () => {
    const onChange = vi.fn()
    render(
      <DemoCategoryTabs
        categories={DEMO_CATEGORIES}
        activeId="all"
        onChange={onChange}
      />,
    )

    fireEvent.click(screen.getByTestId('demo-category-tab-automotive'))
    expect(onChange).toHaveBeenCalledWith('automotive')
  })

  it('renders no content of its own', () => {
    const { container } = render(
      <DemoCategoryTabs categories={[]} activeId="all" onChange={() => {}} />,
    )
    expect(container.innerHTML).not.toMatch(/https?:\/\//i)
    expect(container.innerHTML).not.toMatch(/\.(mp4|webm|mov)\b/i)
  })
})

describe('DemoSearchInput', () => {
  it('renders the current value and reports changes', () => {
    const onChange = vi.fn()
    render(<DemoSearchInput value="ramen" onChange={onChange} />)

    const input = screen.getByLabelText('Search') as HTMLInputElement
    expect(input.value).toBe('ramen')

    fireEvent.change(input, { target: { value: 'ramen bowl' } })
    expect(onChange).toHaveBeenCalledWith('ramen bowl')
  })

  it('uses the supplied placeholder', () => {
    render(<DemoSearchInput value="" onChange={() => {}} placeholder="Search by name…" />)
    expect(screen.getByPlaceholderText('Search by name…')).toBeTruthy()
  })
})

describe('DemoFilterSelect', () => {
  it('renders a labelled select with the supplied options', () => {
    render(
      <DemoFilterSelect
        label="Style"
        value="all"
        options={[
          { value: 'all', label: 'All styles' },
          { value: 'ugc', label: 'UGC' },
        ]}
        onChange={() => {}}
      />,
    )

    const select = screen.getByLabelText('Style') as HTMLSelectElement
    expect(select.value).toBe('all')
    expect(Array.from(select.options).map((option) => option.value)).toEqual(['all', 'ugc'])
  })

  it('reports the selected value', () => {
    const onChange = vi.fn()
    render(
      <DemoFilterSelect
        label="Style"
        value="all"
        options={[
          { value: 'all', label: 'All styles' },
          { value: 'ugc', label: 'UGC' },
        ]}
        onChange={onChange}
      />,
    )

    fireEvent.change(screen.getByLabelText('Style'), { target: { value: 'ugc' } })
    expect(onChange).toHaveBeenCalledWith('ugc')
  })
})
